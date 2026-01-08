// API Route: GET /api/blockchain/height
// Proxies gRPC-Web call to HushServerNode from server side

import { NextResponse } from 'next/server';


// Helper to get GRPC URL at runtime (not at build time)
function getGrpcUrl(): string {
  return process.env.GRPC_SERVER_URL || process.env.NEXT_PUBLIC_GRPC_URL || 'http://localhost:4666';
}

// Parse a varint from bytes starting at offset
function parseVarint(bytes: Uint8Array, offset: number): { value: number; bytesRead: number } {
  let value = 0;
  let shift = 0;
  let bytesRead = 0;

  while (offset + bytesRead < bytes.length) {
    const byte = bytes[offset + bytesRead];
    value |= (byte & 0x7f) << shift;
    bytesRead++;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }

  return { value, bytesRead };
}

export async function GET() {
  const grpcUrl = getGrpcUrl();
  const url = `${grpcUrl}/rpcHush.HushBlockchain/GetBlockchainHeight`;
  console.log('[API] Fetching block height from:', url);

  try {
    // Create empty gRPC-Web request (5 byte header + empty message)
    // Format: 1 byte compression flag (0) + 4 bytes message length (0)
    const emptyRequest = new Uint8Array([0, 0, 0, 0, 0]);

    // Use binary gRPC-Web format (server returns application/grpc-web)
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/grpc-web+proto',
        'Accept': 'application/grpc-web+proto, application/grpc-web',
        'X-Grpc-Web': '1',
      },
      body: emptyRequest,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] gRPC server error:', response.status, errorText);
      return NextResponse.json(
        { error: `gRPC server returned ${response.status}: ${errorText}` },
        { status: 502 }
      );
    }

    // Get binary response
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    console.log('[API] Response received, bytes:', bytes.length);

    // Parse gRPC-Web response frames
    let offset = 0;
    while (offset < bytes.length) {
      if (offset + 5 > bytes.length) break;

      const flag = bytes[offset];
      const messageLength = (bytes[offset + 1] << 24) | (bytes[offset + 2] << 16) |
                           (bytes[offset + 3] << 8) | bytes[offset + 4];
      offset += 5;

      if (flag === 0x80) {
        // Trailer frame - contains grpc-status
        const trailerData = new TextDecoder().decode(bytes.slice(offset, offset + messageLength));
        console.log('[API] Trailer:', trailerData);
        offset += messageLength;
        continue;
      }

      if (flag === 0 && messageLength > 0) {
        // Data frame with protobuf message
        const messageEnd = offset + messageLength;

        if (bytes.length >= messageEnd) {
          let msgOffset = offset;

          while (msgOffset < messageEnd) {
            // Read field tag (varint)
            const tagResult = parseVarint(bytes, msgOffset);
            const tag = tagResult.value;
            msgOffset += tagResult.bytesRead;

            const fieldNumber = tag >> 3;
            const wireType = tag & 0x07;

            if (fieldNumber === 1 && wireType === 0) {
              // Field 1 (Index) is a varint - this is our block height
              const valueResult = parseVarint(bytes, msgOffset);
              console.log('[API] Block height:', valueResult.value);
              return NextResponse.json({ height: valueResult.value });
            } else {
              // Skip unknown field
              if (wireType === 0) {
                const skipResult = parseVarint(bytes, msgOffset);
                msgOffset += skipResult.bytesRead;
              } else if (wireType === 2) {
                const lenResult = parseVarint(bytes, msgOffset);
                msgOffset += lenResult.bytesRead + lenResult.value;
              } else {
                break;
              }
            }
          }
        }
        offset += messageLength;
      } else {
        offset += messageLength;
      }
    }

    return NextResponse.json({ error: 'No valid block height in response' }, { status: 502 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[API] Failed to fetch block height:', errorMessage);
    return NextResponse.json(
      { error: `Failed to connect to gRPC server at ${grpcUrl}: ${errorMessage}` },
      { status: 502 }
    );
  }
}
