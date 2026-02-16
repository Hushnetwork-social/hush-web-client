// API Route: GET /api/feeds/attachment-download?attachmentId=<id>&feedId=<id>&userAddress=<addr>&thumbnailOnly=<bool>
// FEAT-066: Downloads attachment bytes via gRPC streaming, returns concatenated binary

import { NextRequest, NextResponse } from 'next/server';
import {
  grpcCall,
  parseAllGrpcDataFrames,
  buildDownloadAttachmentRequest,
  parseAttachmentChunkData,
} from '@/lib/grpc/grpc-web-helper';


export async function GET(request: NextRequest) {
  const attachmentId = request.nextUrl.searchParams.get('attachmentId');
  const feedId = request.nextUrl.searchParams.get('feedId');
  const userAddress = request.nextUrl.searchParams.get('userAddress');
  const thumbnailOnly = request.nextUrl.searchParams.get('thumbnailOnly') === 'true';

  if (!attachmentId || !feedId || !userAddress) {
    return NextResponse.json(
      { error: 'Missing required parameters: attachmentId, feedId, userAddress' },
      { status: 400 }
    );
  }

  try {
    const requestBytes = buildDownloadAttachmentRequest(
      attachmentId,
      feedId,
      userAddress,
      thumbnailOnly,
    );
    const responseBytes = await grpcCall(
      'rpcHush.HushFeed',
      'DownloadAttachment',
      requestBytes,
    );

    // Parse all streaming frames from the gRPC response
    const frames = parseAllGrpcDataFrames(responseBytes);

    if (frames.length === 0) {
      return NextResponse.json(
        { error: 'Attachment not found or empty' },
        { status: 404 }
      );
    }

    // Extract Data bytes from each AttachmentChunk and concatenate
    const chunks: Uint8Array[] = [];
    let totalSize = 0;
    for (const frame of frames) {
      const data = parseAttachmentChunkData(frame);
      if (data) {
        chunks.push(data);
        totalSize += data.length;
      }
    }

    // Concatenate all chunks into a single buffer
    const result = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    // Return binary response
    return new NextResponse(result, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': totalSize.toString(),
      },
    });
  } catch (error) {
    console.error('[API] DownloadAttachment failed:', error);
    return NextResponse.json(
      { error: 'Failed to download attachment' },
      { status: 502 }
    );
  }
}
