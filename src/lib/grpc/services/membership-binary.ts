/**
 * Membership gRPC Service - Binary Protobuf Encoding
 *
 * Uses binary protobuf encoding instead of JSON for proper gRPC-Web compatibility.
 * The server expects binary protobuf, not JSON.
 */

import { debugLog, debugError } from '@/lib/debug-logger';
import type {
  RegisterCommitmentResponse,
  IsCommitmentRegisteredResponse,
  GetMembershipProofResponse,
} from '../types';

const GRPC_URL = process.env.NEXT_PUBLIC_GRPC_URL || 'http://localhost:4666';
const SERVICE_NAME = 'rpcHush.HushMembership';

/**
 * Encode a varint (variable-length integer)
 */
function encodeVarint(value: number): number[] {
  const bytes: number[] = [];
  while (value > 0x7f) {
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  bytes.push(value & 0x7f);
  return bytes;
}

/**
 * Parse a varint from bytes
 */
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

/**
 * Encode a bytes field for protobuf
 */
function encodeBytesField(fieldNumber: number, bytes: Uint8Array): number[] {
  const tag = (fieldNumber << 3) | 2; // wire type 2 = length-delimited
  return [...encodeVarint(tag), ...encodeVarint(bytes.length), ...bytes];
}

/**
 * Create gRPC-Web frame from protobuf message bytes
 */
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

/**
 * Make a binary gRPC-Web call
 */
async function grpcCallBinary(
  methodName: string,
  requestBytes: Uint8Array
): Promise<Uint8Array> {
  const url = `${GRPC_URL}/${SERVICE_NAME}/${methodName}`;
  const frame = createGrpcFrame(requestBytes);

  debugLog(`[MembershipService] Calling ${methodName} at ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/grpc-web+proto',
      'Accept': 'application/grpc-web+proto, application/grpc-web',
      'X-Grpc-Web': '1',
    },
    body: frame as BodyInit,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`gRPC call failed: ${response.status} ${text}`);
  }

  const responseBuffer = await response.arrayBuffer();
  const responseBytes = new Uint8Array(responseBuffer);

  // Skip 5-byte header
  if (responseBytes.length < 5) {
    throw new Error('Invalid gRPC response: too short');
  }

  return responseBytes.slice(5);
}

/**
 * Decode base64 to bytes
 */
function base64ToBytes(base64: string): Uint8Array {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

/**
 * Parse a bool field from protobuf response
 */
function parseBoolField(bytes: Uint8Array): boolean {
  let offset = 0;
  while (offset < bytes.length) {
    const { value: tag, bytesRead: tagBytes } = parseVarint(bytes, offset);
    offset += tagBytes;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x7;

    if (wireType === 0) {
      // Varint
      const { value, bytesRead } = parseVarint(bytes, offset);
      offset += bytesRead;
      if (fieldNumber === 1) {
        return value !== 0;
      }
    } else if (wireType === 2) {
      // Length-delimited
      const { value: length, bytesRead } = parseVarint(bytes, offset);
      offset += bytesRead + length;
    }
  }
  return false;
}

/**
 * Parse RegisterCommitmentResponse
 */
function parseRegisterCommitmentResponse(bytes: Uint8Array): RegisterCommitmentResponse {
  const result: RegisterCommitmentResponse = {
    Success: false,
    NewMerkleRoot: '',
    AlreadyRegistered: false,
  };

  let offset = 0;
  while (offset < bytes.length) {
    const { value: tag, bytesRead: tagBytes } = parseVarint(bytes, offset);
    offset += tagBytes;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x7;

    if (wireType === 0) {
      // Varint
      const { value, bytesRead } = parseVarint(bytes, offset);
      offset += bytesRead;
      if (fieldNumber === 1) result.Success = value !== 0;
      if (fieldNumber === 3) result.AlreadyRegistered = value !== 0;
    } else if (wireType === 2) {
      // Length-delimited
      const { value: length, bytesRead } = parseVarint(bytes, offset);
      offset += bytesRead;
      if (fieldNumber === 2) {
        // NewMerkleRoot
        const rootBytes = bytes.slice(offset, offset + length);
        result.NewMerkleRoot = btoa(String.fromCharCode(...rootBytes));
      }
      offset += length;
    }
  }

  return result;
}

export const membershipServiceBinary = {
  /**
   * Register anonymous commitment for a feed.
   * Uses binary protobuf encoding.
   */
  async registerCommitment(
    feedIdBase64: string,
    userCommitmentBase64: string
  ): Promise<RegisterCommitmentResponse> {
    try {
      const feedIdBytes = base64ToBytes(feedIdBase64);
      const commitmentBytes = base64ToBytes(userCommitmentBase64);

      // Build protobuf message:
      // field 1: feed_id (bytes)
      // field 2: user_commitment (bytes)
      const messageBytes = new Uint8Array([
        ...encodeBytesField(1, feedIdBytes),
        ...encodeBytesField(2, commitmentBytes),
      ]);

      console.log(`[MembershipService] RegisterCommitment: calling gRPC with binary protobuf`);
      console.log(`[MembershipService] FeedId bytes length: ${feedIdBytes.length}, Commitment bytes length: ${commitmentBytes.length}`);
      debugLog(`[MembershipService] RegisterCommitment: feedId=${feedIdBase64.substring(0, 20)}..., commitment=${userCommitmentBase64.substring(0, 20)}...`);

      const responseBytes = await grpcCallBinary('RegisterCommitment', messageBytes);
      console.log(`[MembershipService] RegisterCommitment: got response, ${responseBytes.length} bytes`);
      const result = parseRegisterCommitmentResponse(responseBytes);

      console.log(`[MembershipService] RegisterCommitment result: success=${result.Success}, alreadyRegistered=${result.AlreadyRegistered}`);
      debugLog(`[MembershipService] RegisterCommitment result: success=${result.Success}, alreadyRegistered=${result.AlreadyRegistered}`);

      return result;
    } catch (error) {
      console.error('[MembershipService] RegisterCommitment failed:', error);
      debugError('[MembershipService] RegisterCommitment failed:', error);
      throw error;
    }
  },

  /**
   * Check if a commitment is already registered for a feed.
   * Uses binary protobuf encoding.
   */
  async isCommitmentRegistered(
    feedIdBase64: string,
    userCommitmentBase64: string
  ): Promise<IsCommitmentRegisteredResponse> {
    try {
      const feedIdBytes = base64ToBytes(feedIdBase64);
      const commitmentBytes = base64ToBytes(userCommitmentBase64);

      // Build protobuf message
      const messageBytes = new Uint8Array([
        ...encodeBytesField(1, feedIdBytes),
        ...encodeBytesField(2, commitmentBytes),
      ]);

      debugLog(`[MembershipService] IsCommitmentRegistered: feedId=${feedIdBase64.substring(0, 20)}...`);

      const responseBytes = await grpcCallBinary('IsCommitmentRegistered', messageBytes);
      const isRegistered = parseBoolField(responseBytes);

      debugLog(`[MembershipService] IsCommitmentRegistered result: ${isRegistered}`);

      return { IsRegistered: isRegistered };
    } catch (error) {
      debugError('[MembershipService] IsCommitmentRegistered failed:', error);
      throw error;
    }
  },

  /**
   * Get user's Merkle proof for a feed.
   * Uses binary protobuf encoding.
   */
  async getMembershipProof(
    feedIdBase64: string,
    userCommitmentBase64: string
  ): Promise<GetMembershipProofResponse> {
    try {
      const feedIdBytes = base64ToBytes(feedIdBase64);
      const commitmentBytes = base64ToBytes(userCommitmentBase64);

      // Build protobuf message
      const messageBytes = new Uint8Array([
        ...encodeBytesField(1, feedIdBytes),
        ...encodeBytesField(2, commitmentBytes),
      ]);

      debugLog(`[MembershipService] GetMembershipProof: feedId=${feedIdBase64.substring(0, 20)}...`);

      const responseBytes = await grpcCallBinary('GetMembershipProof', messageBytes);

      // Parse response (simplified - just check IsMember for now)
      const result: GetMembershipProofResponse = {
        IsMember: false,
        MerkleRoot: '',
        PathElements: [],
        PathIndices: [],
        TreeDepth: 0,
        RootBlockHeight: 0,
      };

      let offset = 0;
      while (offset < responseBytes.length) {
        const { value: tag, bytesRead: tagBytes } = parseVarint(responseBytes, offset);
        offset += tagBytes;

        const fieldNumber = tag >> 3;
        const wireType = tag & 0x7;

        if (wireType === 0) {
          const { value, bytesRead } = parseVarint(responseBytes, offset);
          offset += bytesRead;
          if (fieldNumber === 1) result.IsMember = value !== 0;
          if (fieldNumber === 5) result.TreeDepth = value;
          if (fieldNumber === 6) result.RootBlockHeight = value;
        } else if (wireType === 2) {
          const { value: length, bytesRead } = parseVarint(responseBytes, offset);
          offset += bytesRead;
          if (fieldNumber === 2) {
            result.MerkleRoot = btoa(String.fromCharCode(...responseBytes.slice(offset, offset + length)));
          }
          // Skip PathElements and PathIndices for now - complex parsing
          offset += length;
        }
      }

      debugLog(`[MembershipService] GetMembershipProof result: isMember=${result.IsMember}`);

      return result;
    } catch (error) {
      debugError('[MembershipService] GetMembershipProof failed:', error);
      throw error;
    }
  },
};
