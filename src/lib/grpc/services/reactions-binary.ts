/**
 * Binary gRPC Reactions Service
 *
 * Browser-compatible binary protobuf encoding for reactions.
 * This bypasses the broken JSON-based GrpcClient and uses proper protobuf encoding.
 */

import { grpcConfig } from '../config';

// ============= Protobuf Encoding Helpers =============

function encodeVarint(value: number): number[] {
  const bytes: number[] = [];
  while (value > 0x7f) {
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  bytes.push(value & 0x7f);
  return bytes;
}

function encodeBytes(fieldNumber: number, value: Uint8Array): number[] {
  const tag = (fieldNumber << 3) | 2; // wire type 2 = length-delimited
  return [...encodeVarint(tag), ...encodeVarint(value.length), ...value];
}

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

// ============= UUID <-> Bytes Conversion (.NET GUID format) =============

export function uuidToBytes(uuid: string): Uint8Array {
  const parts = uuid.split('-');
  const bytes = new Uint8Array(16);

  // Part 1: 4 bytes, little-endian (reverse)
  const p1 = parts[0];
  bytes[0] = parseInt(p1.substring(6, 8), 16);
  bytes[1] = parseInt(p1.substring(4, 6), 16);
  bytes[2] = parseInt(p1.substring(2, 4), 16);
  bytes[3] = parseInt(p1.substring(0, 2), 16);

  // Part 2: 2 bytes, little-endian (reverse)
  const p2 = parts[1];
  bytes[4] = parseInt(p2.substring(2, 4), 16);
  bytes[5] = parseInt(p2.substring(0, 2), 16);

  // Part 3: 2 bytes, little-endian (reverse)
  const p3 = parts[2];
  bytes[6] = parseInt(p3.substring(2, 4), 16);
  bytes[7] = parseInt(p3.substring(0, 2), 16);

  // Part 4: 2 bytes, big-endian (as-is)
  const p4 = parts[3];
  bytes[8] = parseInt(p4.substring(0, 2), 16);
  bytes[9] = parseInt(p4.substring(2, 4), 16);

  // Part 5: 6 bytes, big-endian (as-is)
  const p5 = parts[4];
  bytes[10] = parseInt(p5.substring(0, 2), 16);
  bytes[11] = parseInt(p5.substring(2, 4), 16);
  bytes[12] = parseInt(p5.substring(4, 6), 16);
  bytes[13] = parseInt(p5.substring(6, 8), 16);
  bytes[14] = parseInt(p5.substring(8, 10), 16);
  bytes[15] = parseInt(p5.substring(10, 12), 16);

  return bytes;
}

function bytesToUuid(bytes: Uint8Array): string {
  if (bytes.length !== 16) return '';

  // Part 1: bytes 0-3, reverse (little-endian to big-endian)
  const p1 = [bytes[3], bytes[2], bytes[1], bytes[0]]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Part 2: bytes 4-5, reverse
  const p2 = [bytes[5], bytes[4]].map((b) => b.toString(16).padStart(2, '0')).join('');

  // Part 3: bytes 6-7, reverse
  const p3 = [bytes[7], bytes[6]].map((b) => b.toString(16).padStart(2, '0')).join('');

  // Part 4: bytes 8-9, as-is (big-endian)
  const p4 = [bytes[8], bytes[9]].map((b) => b.toString(16).padStart(2, '0')).join('');

  // Part 5: bytes 10-15, as-is (big-endian)
  const p5 = [bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}

// ============= EC Point Types =============

export interface ECPointBytes {
  x: Uint8Array;
  y: Uint8Array;
}

export interface ReactionTally {
  messageId: string;
  tallyC1: ECPointBytes[];
  tallyC2: ECPointBytes[];
  totalCount: number;
}

// ============= Request/Response Builders =============

function buildGetTalliesRequest(feedId: Uint8Array, messageIds: Uint8Array[]): Uint8Array {
  const bytes: number[] = [...encodeBytes(1, feedId)];
  for (const msgId of messageIds) {
    bytes.push(...encodeBytes(2, msgId));
  }
  return new Uint8Array(bytes);
}

function createGrpcFrame(messageBytes: Uint8Array): Uint8Array {
  const frame = new Uint8Array(5 + messageBytes.length);
  frame[0] = 0; // No compression
  frame[1] = (messageBytes.length >> 24) & 0xff;
  frame[2] = (messageBytes.length >> 16) & 0xff;
  frame[3] = (messageBytes.length >> 8) & 0xff;
  frame[4] = messageBytes.length & 0xff;
  frame.set(messageBytes, 5);
  return frame;
}

// ============= Response Parsers =============

function parseGrpcResponse(responseBytes: Uint8Array): Uint8Array | null {
  let offset = 0;

  while (offset < responseBytes.length) {
    if (offset + 5 > responseBytes.length) break;

    const flag = responseBytes[offset];
    const messageLength =
      (responseBytes[offset + 1] << 24) |
      (responseBytes[offset + 2] << 16) |
      (responseBytes[offset + 3] << 8) |
      responseBytes[offset + 4];
    offset += 5;

    // Data frame (flag = 0)
    if (flag === 0 && messageLength > 0) {
      return responseBytes.slice(offset, offset + messageLength);
    }

    offset += messageLength;
  }

  return null;
}

function parseECPoint(bytes: Uint8Array): ECPointBytes {
  const point: ECPointBytes = {
    x: new Uint8Array(0),
    y: new Uint8Array(0),
  };

  let offset = 0;
  while (offset < bytes.length) {
    const tagResult = parseVarint(bytes, offset);
    const tag = tagResult.value;
    offset += tagResult.bytesRead;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (wireType === 2) {
      const lenResult = parseVarint(bytes, offset);
      offset += lenResult.bytesRead;

      if (fieldNumber === 1) {
        // X coordinate (bytes)
        point.x = bytes.slice(offset, offset + lenResult.value);
      } else if (fieldNumber === 2) {
        // Y coordinate (bytes)
        point.y = bytes.slice(offset, offset + lenResult.value);
      }
      offset += lenResult.value;
    } else if (wireType === 0) {
      const valueResult = parseVarint(bytes, offset);
      offset += valueResult.bytesRead;
    } else {
      break;
    }
  }

  return point;
}

function parseMessageTally(bytes: Uint8Array): ReactionTally {
  const tally: ReactionTally = {
    messageId: '',
    tallyC1: [],
    tallyC2: [],
    totalCount: 0,
  };

  let offset = 0;
  while (offset < bytes.length) {
    const tagResult = parseVarint(bytes, offset);
    const tag = tagResult.value;
    offset += tagResult.bytesRead;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (wireType === 0) {
      const valueResult = parseVarint(bytes, offset);
      offset += valueResult.bytesRead;
      if (fieldNumber === 4) tally.totalCount = valueResult.value;
    } else if (wireType === 2) {
      const lenResult = parseVarint(bytes, offset);
      offset += lenResult.bytesRead;

      if (fieldNumber === 1) {
        // message_id (bytes) - convert to UUID string
        const idBytes = bytes.slice(offset, offset + lenResult.value);
        tally.messageId = bytesToUuid(idBytes);
      } else if (fieldNumber === 2) {
        // tally_c1 (ECPoint)
        const pointBytes = bytes.slice(offset, offset + lenResult.value);
        tally.tallyC1.push(parseECPoint(pointBytes));
      } else if (fieldNumber === 3) {
        // tally_c2 (ECPoint)
        const pointBytes = bytes.slice(offset, offset + lenResult.value);
        tally.tallyC2.push(parseECPoint(pointBytes));
      }
      offset += lenResult.value;
    } else {
      break;
    }
  }

  return tally;
}

function parseGetTalliesResponse(messageBytes: Uint8Array): ReactionTally[] {
  const tallies: ReactionTally[] = [];

  let offset = 0;
  while (offset < messageBytes.length) {
    const tagResult = parseVarint(messageBytes, offset);
    const tag = tagResult.value;
    offset += tagResult.bytesRead;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (wireType === 2 && fieldNumber === 1) {
      // MessageTally (repeated)
      const lenResult = parseVarint(messageBytes, offset);
      offset += lenResult.bytesRead;
      const tallyBytes = messageBytes.slice(offset, offset + lenResult.value);
      offset += lenResult.value;
      tallies.push(parseMessageTally(tallyBytes));
    } else if (wireType === 0) {
      const valueResult = parseVarint(messageBytes, offset);
      offset += valueResult.bytesRead;
    } else if (wireType === 2) {
      const lenResult = parseVarint(messageBytes, offset);
      offset += lenResult.bytesRead + lenResult.value;
    } else {
      break;
    }
  }

  return tallies;
}

// ============= Browser-Compatible gRPC Call =============

async function grpcCallBrowser(
  serviceName: string,
  methodName: string,
  requestBytes: Uint8Array
): Promise<Uint8Array> {
  const url = `${grpcConfig.serverUrl}/${serviceName}/${methodName}`;
  const frame = createGrpcFrame(requestBytes);

  console.log(`[ReactionsBinary] Calling ${serviceName}/${methodName}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/grpc-web+proto',
        Accept: 'application/grpc-web+proto, application/grpc-web',
        'X-Grpc-Web': '1',
      },
      body: frame.buffer.slice(frame.byteOffset, frame.byteOffset + frame.byteLength) as ArrayBuffer,
    });

    if (!response.ok) {
      console.error(`[ReactionsBinary] Call failed: HTTP ${response.status} ${response.statusText}`);
      throw new Error(`gRPC call failed: ${response.status}`);
    }

    console.log(`[ReactionsBinary] Call succeeded`);
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  } catch (error) {
    console.error(`[ReactionsBinary] Call error:`, error);
    throw error;
  }
}

// ============= Exported Service Functions =============

/**
 * Get reaction tallies for multiple messages.
 * Uses binary protobuf encoding for correct server communication.
 *
 * @param feedId - Feed UUID string
 * @param messageIds - Array of message UUID strings
 * @returns Array of reaction tallies
 */
export async function getTallies(feedId: string, messageIds: string[]): Promise<ReactionTally[]> {
  const feedIdBytes = uuidToBytes(feedId);
  const messageIdBytes = messageIds.map((id) => uuidToBytes(id));
  const requestBytes = buildGetTalliesRequest(feedIdBytes, messageIdBytes);

  const responseBytes = await grpcCallBrowser('rpcHush.HushReactions', 'GetReactionTallies', requestBytes);
  const grpcData = parseGrpcResponse(responseBytes);

  if (!grpcData) {
    console.warn('[ReactionsBinary] Empty gRPC response for GetReactionTallies');
    return [];
  }

  return parseGetTalliesResponse(grpcData);
}
