// gRPC-Web Helper for making binary gRPC calls from Next.js API routes

// Server-side URL for API routes running in Docker - connects directly to HushNetworkNode
// GRPC_SERVER_URL is used for container-to-container communication within Docker network
const GRPC_URL = process.env.GRPC_SERVER_URL || process.env.NEXT_PUBLIC_GRPC_URL || 'http://localhost:4666';

// Log the configured URL on startup (server-side only)
if (typeof window === 'undefined') {
  console.log(`[gRPC] Server URL configured: ${GRPC_URL}`);
  console.log(`[gRPC] GRPC_SERVER_URL env: ${process.env.GRPC_SERVER_URL || '(not set)'}`);
  console.log(`[gRPC] NEXT_PUBLIC_GRPC_URL env: ${process.env.NEXT_PUBLIC_GRPC_URL || '(not set)'}`);
}

// Encode a varint (variable-length integer)
function encodeVarint(value: number): number[] {
  const bytes: number[] = [];
  while (value > 0x7f) {
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  bytes.push(value & 0x7f);
  return bytes;
}

// Parse a varint from bytes
export function parseVarint(bytes: Uint8Array, offset: number): { value: number; bytesRead: number } {
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

// Parse a string field from protobuf bytes
export function parseString(bytes: Uint8Array, offset: number, length: number): string {
  const decoder = new TextDecoder();
  return decoder.decode(bytes.slice(offset, offset + length));
}

// Encode a string field for protobuf
export function encodeString(fieldNumber: number, value: string): number[] {
  const encoder = new TextEncoder();
  const strBytes = encoder.encode(value);
  const tag = (fieldNumber << 3) | 2; // wire type 2 = length-delimited
  return [...encodeVarint(tag), ...encodeVarint(strBytes.length), ...strBytes];
}

// Encode a varint field for protobuf
export function encodeVarintField(fieldNumber: number, value: number): number[] {
  const tag = (fieldNumber << 3) | 0; // wire type 0 = varint
  return [...encodeVarint(tag), ...encodeVarint(value)];
}

// Encode a bool field for protobuf (used for protobuf message encoding)
export function encodeBoolField(fieldNumber: number, value: boolean): number[] {
  return encodeVarintField(fieldNumber, value ? 1 : 0);
}

// Create gRPC-Web frame from protobuf message bytes
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

// Make a gRPC-Web call
export async function grpcCall(
  service: string,
  method: string,
  requestBytes: Uint8Array
): Promise<Uint8Array> {
  const url = `${GRPC_URL}/${service}/${method}`;
  const frame = createGrpcFrame(requestBytes);

  console.log(`[gRPC] Calling ${service}/${method} at ${url}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/grpc-web+proto',
        'Accept': 'application/grpc-web+proto, application/grpc-web',
        'X-Grpc-Web': '1',
      },
      body: Buffer.from(frame),
    });

    if (!response.ok) {
      console.error(`[gRPC] Call failed: HTTP ${response.status} ${response.statusText}`);
      throw new Error(`gRPC call failed: ${response.status}`);
    }

    console.log(`[gRPC] Call succeeded: ${service}/${method}`);
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  } catch (error) {
    console.error(`[gRPC] Call error for ${url}:`, error);
    throw error;
  }
}

// Parse gRPC response to extract message bytes
export function parseGrpcResponse(responseBytes: Uint8Array): Uint8Array | null {
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

// Protobuf message builders for Identity service

export function buildGetIdentityRequest(publicSigningAddress: string): Uint8Array {
  const bytes = encodeString(1, publicSigningAddress);
  return new Uint8Array(bytes);
}

export function buildHasPersonalFeedRequest(publicKey: string): Uint8Array {
  const bytes = encodeString(1, publicKey);
  return new Uint8Array(bytes);
}

export function buildGetFeedsForAddressRequest(profilePublicKey: string, blockIndex: number): Uint8Array {
  const bytes = [
    ...encodeString(1, profilePublicKey),
    ...encodeVarintField(2, blockIndex),
  ];
  return new Uint8Array(bytes);
}

export function buildGetFeedMessagesRequest(
  profilePublicKey: string,
  blockIndex: number,
  lastReactionTallyVersion: number = 0
): Uint8Array {
  const bytes = [
    ...encodeString(1, profilePublicKey),
    ...encodeVarintField(2, blockIndex),
    ...encodeVarintField(3, lastReactionTallyVersion),
  ];
  return new Uint8Array(bytes);
}

export function buildSubmitTransactionRequest(signedTransaction: string): Uint8Array {
  const bytes = encodeString(1, signedTransaction);
  return new Uint8Array(bytes);
}

export function buildSearchByDisplayNameRequest(partialDisplayName: string): Uint8Array {
  const bytes = encodeString(1, partialDisplayName);
  return new Uint8Array(bytes);
}

// Response parsers

export interface IdentityResponse {
  successful: boolean;
  message: string;
  profileName: string;
  publicSigningAddress: string;
  publicEncryptAddress: string;
  isPublic: boolean;
}

export function parseIdentityResponse(messageBytes: Uint8Array): IdentityResponse {
  const result: IdentityResponse = {
    successful: false,
    message: '',
    profileName: '',
    publicSigningAddress: '',
    publicEncryptAddress: '',
    isPublic: false,
  };

  let offset = 0;
  while (offset < messageBytes.length) {
    const tagResult = parseVarint(messageBytes, offset);
    const tag = tagResult.value;
    offset += tagResult.bytesRead;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (wireType === 0) {
      // Varint
      const valueResult = parseVarint(messageBytes, offset);
      offset += valueResult.bytesRead;

      if (fieldNumber === 1) result.successful = valueResult.value === 1;
      if (fieldNumber === 6) result.isPublic = valueResult.value === 1;
    } else if (wireType === 2) {
      // Length-delimited (string)
      const lenResult = parseVarint(messageBytes, offset);
      offset += lenResult.bytesRead;
      const strValue = parseString(messageBytes, offset, lenResult.value);
      offset += lenResult.value;

      if (fieldNumber === 2) result.message = strValue;
      if (fieldNumber === 3) result.profileName = strValue;
      if (fieldNumber === 4) result.publicSigningAddress = strValue;
      if (fieldNumber === 5) result.publicEncryptAddress = strValue;
    } else {
      break;
    }
  }

  return result;
}

export interface HasPersonalFeedResponse {
  feedAvailable: boolean;
}

export function parseHasPersonalFeedResponse(messageBytes: Uint8Array): HasPersonalFeedResponse {
  const result: HasPersonalFeedResponse = { feedAvailable: false };

  let offset = 0;
  while (offset < messageBytes.length) {
    const tagResult = parseVarint(messageBytes, offset);
    const tag = tagResult.value;
    offset += tagResult.bytesRead;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (wireType === 0 && fieldNumber === 1) {
      const valueResult = parseVarint(messageBytes, offset);
      result.feedAvailable = valueResult.value === 1;
      break;
    } else {
      break;
    }
  }

  return result;
}

export interface FeedParticipant {
  feedId: string;
  participantPublicAddress: string;
  participantType: number;
  encryptedFeedKey: string;
}

export interface Feed {
  feedId: string;
  feedTitle: string;
  feedOwner: string;
  feedType: number;
  blockIndex: number;
  participants: FeedParticipant[];
}

export function parseFeedsResponse(messageBytes: Uint8Array): Feed[] {
  const feeds: Feed[] = [];
  let offset = 0;

  while (offset < messageBytes.length) {
    const tagResult = parseVarint(messageBytes, offset);
    const tag = tagResult.value;
    offset += tagResult.bytesRead;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (wireType === 2 && fieldNumber === 1) {
      // Embedded Feed message
      const lenResult = parseVarint(messageBytes, offset);
      offset += lenResult.bytesRead;
      const feedBytes = messageBytes.slice(offset, offset + lenResult.value);
      offset += lenResult.value;

      const feed = parseSingleFeed(feedBytes);
      feeds.push(feed);
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

  return feeds;
}

function parseSingleFeed(feedBytes: Uint8Array): Feed {
  const feed: Feed = {
    feedId: '',
    feedTitle: '',
    feedOwner: '',
    feedType: 0,
    blockIndex: 0,
    participants: [],
  };

  let offset = 0;
  while (offset < feedBytes.length) {
    const tagResult = parseVarint(feedBytes, offset);
    const tag = tagResult.value;
    offset += tagResult.bytesRead;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (wireType === 0) {
      const valueResult = parseVarint(feedBytes, offset);
      offset += valueResult.bytesRead;
      if (fieldNumber === 4) feed.feedType = valueResult.value;
      if (fieldNumber === 5) feed.blockIndex = valueResult.value;
    } else if (wireType === 2) {
      const lenResult = parseVarint(feedBytes, offset);
      offset += lenResult.bytesRead;

      if (fieldNumber === 6) {
        // Embedded participant
        const participantBytes = feedBytes.slice(offset, offset + lenResult.value);
        feed.participants.push(parseParticipant(participantBytes));
      } else {
        const strValue = parseString(feedBytes, offset, lenResult.value);
        if (fieldNumber === 1) feed.feedId = strValue;
        if (fieldNumber === 2) feed.feedTitle = strValue;
        if (fieldNumber === 3) feed.feedOwner = strValue;
      }
      offset += lenResult.value;
    } else {
      break;
    }
  }

  return feed;
}

function parseParticipant(bytes: Uint8Array): FeedParticipant {
  const participant: FeedParticipant = {
    feedId: '',
    participantPublicAddress: '',
    participantType: 0,
    encryptedFeedKey: '',
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
      if (fieldNumber === 3) participant.participantType = valueResult.value;
    } else if (wireType === 2) {
      const lenResult = parseVarint(bytes, offset);
      offset += lenResult.bytesRead;
      const strValue = parseString(bytes, offset, lenResult.value);
      offset += lenResult.value;
      if (fieldNumber === 1) participant.feedId = strValue;
      if (fieldNumber === 2) participant.participantPublicAddress = strValue;
      if (fieldNumber === 4) participant.encryptedFeedKey = strValue;
    } else {
      break;
    }
  }

  return participant;
}

export interface FeedMessage {
  feedId: string;
  feedMessageId: string;
  messageContent: string;
  issuerPublicAddress: string;
  issuerName: string;
  timestamp: Date | null;
  blockIndex: number;
  authorCommitment?: Uint8Array;  // Protocol Omega: Poseidon(author_secret)
  replyToMessageId?: string;  // Reply to Message: parent message reference
  keyGeneration?: number;  // Group Feeds: Key generation used to encrypt this message
}

// Protocol Omega: EC Point for reaction tallies
export interface ECPointBytes {
  x: Uint8Array;
  y: Uint8Array;
}

// Protocol Omega: Reaction tally for a message
export interface ReactionTally {
  messageId: string;
  tallyC1: ECPointBytes[];  // 6 aggregated C1 points
  tallyC2: ECPointBytes[];  // 6 aggregated C2 points
  tallyVersion: number;
  reactionCount: number;
}

// Extended response that includes reaction tallies
export interface FeedMessagesWithTalliesResponse {
  messages: FeedMessage[];
  reactionTallies: ReactionTally[];
  maxReactionTallyVersion: number;
}

export function parseFeedMessagesResponse(messageBytes: Uint8Array): FeedMessage[] {
  const result = parseFeedMessagesWithTalliesResponse(messageBytes);
  return result.messages;
}

/**
 * Parse full feed messages response including reaction tallies (Protocol Omega)
 */
export function parseFeedMessagesWithTalliesResponse(messageBytes: Uint8Array): FeedMessagesWithTalliesResponse {
  const result: FeedMessagesWithTalliesResponse = {
    messages: [],
    reactionTallies: [],
    maxReactionTallyVersion: 0,
  };

  let offset = 0;

  while (offset < messageBytes.length) {
    const tagResult = parseVarint(messageBytes, offset);
    const tag = tagResult.value;
    offset += tagResult.bytesRead;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (wireType === 2 && fieldNumber === 1) {
      // Field 1: FeedMessage (repeated)
      const lenResult = parseVarint(messageBytes, offset);
      offset += lenResult.bytesRead;
      const msgBytes = messageBytes.slice(offset, offset + lenResult.value);
      offset += lenResult.value;

      result.messages.push(parseSingleMessage(msgBytes));
    } else if (wireType === 2 && fieldNumber === 2) {
      // Field 2: ReactionTallies (repeated)
      const lenResult = parseVarint(messageBytes, offset);
      offset += lenResult.bytesRead;
      const tallyBytes = messageBytes.slice(offset, offset + lenResult.value);
      offset += lenResult.value;

      result.reactionTallies.push(parseSingleReactionTally(tallyBytes));
    } else if (wireType === 0 && fieldNumber === 3) {
      // Field 3: MaxReactionTallyVersion (int64)
      const valueResult = parseVarint(messageBytes, offset);
      offset += valueResult.bytesRead;
      result.maxReactionTallyVersion = valueResult.value;
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

  return result;
}

function parseSingleMessage(bytes: Uint8Array): FeedMessage {
  const msg: FeedMessage = {
    feedId: '',
    feedMessageId: '',
    messageContent: '',
    issuerPublicAddress: '',
    issuerName: '',
    timestamp: null,
    blockIndex: 0,
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
      if (fieldNumber === 7) msg.blockIndex = valueResult.value;
      if (fieldNumber === 10) msg.keyGeneration = valueResult.value;  // Group Feeds: Key generation
    } else if (wireType === 2) {
      const lenResult = parseVarint(bytes, offset);
      offset += lenResult.bytesRead;

      if (fieldNumber === 6) {
        // Timestamp (embedded message with seconds/nanos)
        const tsBytes = bytes.slice(offset, offset + lenResult.value);
        msg.timestamp = parseTimestamp(tsBytes);
      } else if (fieldNumber === 8) {
        // AuthorCommitment (bytes) - Protocol Omega
        msg.authorCommitment = bytes.slice(offset, offset + lenResult.value);
      } else if (fieldNumber === 9) {
        // ReplyToMessageId (optional string) - Reply to Message
        const strValue = parseString(bytes, offset, lenResult.value);
        if (strValue) msg.replyToMessageId = strValue;
      } else {
        const strValue = parseString(bytes, offset, lenResult.value);
        if (fieldNumber === 1) msg.feedId = strValue;
        if (fieldNumber === 2) msg.feedMessageId = strValue;
        if (fieldNumber === 3) msg.messageContent = strValue;
        if (fieldNumber === 4) msg.issuerPublicAddress = strValue;
        if (fieldNumber === 5) msg.issuerName = strValue;
      }
      offset += lenResult.value;
    } else {
      break;
    }
  }

  return msg;
}

function parseTimestamp(bytes: Uint8Array): Date | null {
  let seconds = 0;
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
      if (fieldNumber === 1) seconds = valueResult.value;
    } else {
      break;
    }
  }

  return seconds > 0 ? new Date(seconds * 1000) : null;
}

/**
 * Parse a single reaction tally from protobuf bytes (Protocol Omega)
 *
 * Proto definition:
 * message MessageReactionTally {
 *   string MessageId = 1;
 *   repeated ECPoint TallyC1 = 2;
 *   repeated ECPoint TallyC2 = 3;
 *   int64 TallyVersion = 4;
 *   int64 ReactionCount = 5;
 * }
 */
function parseSingleReactionTally(bytes: Uint8Array): ReactionTally {
  const tally: ReactionTally = {
    messageId: '',
    tallyC1: [],
    tallyC2: [],
    tallyVersion: 0,
    reactionCount: 0,
  };

  let offset = 0;
  while (offset < bytes.length) {
    const tagResult = parseVarint(bytes, offset);
    const tag = tagResult.value;
    offset += tagResult.bytesRead;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (wireType === 0) {
      // Varint fields
      const valueResult = parseVarint(bytes, offset);
      offset += valueResult.bytesRead;
      if (fieldNumber === 4) tally.tallyVersion = valueResult.value;
      if (fieldNumber === 5) tally.reactionCount = valueResult.value;
    } else if (wireType === 2) {
      // Length-delimited fields
      const lenResult = parseVarint(bytes, offset);
      offset += lenResult.bytesRead;

      if (fieldNumber === 1) {
        // MessageId (string)
        tally.messageId = parseString(bytes, offset, lenResult.value);
      } else if (fieldNumber === 2) {
        // TallyC1 (repeated ECPoint)
        const pointBytes = bytes.slice(offset, offset + lenResult.value);
        tally.tallyC1.push(parseECPoint(pointBytes));
      } else if (fieldNumber === 3) {
        // TallyC2 (repeated ECPoint)
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

/**
 * Parse an EC point from protobuf bytes
 *
 * Proto definition:
 * message ECPoint {
 *   bytes X = 1;
 *   bytes Y = 2;
 * }
 */
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

/**
 * FEAT-057: Transaction status for idempotency responses
 */
export enum TransactionStatusEnum {
  UNSPECIFIED = 0,      // Default for backward compatibility
  ACCEPTED = 1,         // New transaction accepted
  ALREADY_EXISTS = 2,   // Duplicate found in database (already confirmed)
  PENDING = 3,          // Duplicate found in MemPool (still pending)
  REJECTED = 4,         // Transaction validation failed
}

export interface SubmitTransactionResponse {
  successful: boolean;
  message: string;
  status: TransactionStatusEnum;  // FEAT-057: Idempotency status
}

export function parseSubmitTransactionResponse(messageBytes: Uint8Array): SubmitTransactionResponse {
  const result: SubmitTransactionResponse = {
    successful: false,
    message: '',
    status: TransactionStatusEnum.UNSPECIFIED,
  };

  let offset = 0;
  while (offset < messageBytes.length) {
    const tagResult = parseVarint(messageBytes, offset);
    const tag = tagResult.value;
    offset += tagResult.bytesRead;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (wireType === 0 && fieldNumber === 1) {
      const valueResult = parseVarint(messageBytes, offset);
      offset += valueResult.bytesRead;
      result.successful = valueResult.value === 1;
    } else if (wireType === 0 && fieldNumber === 3) {
      // FEAT-057: Parse status field (field 3, varint)
      const valueResult = parseVarint(messageBytes, offset);
      offset += valueResult.bytesRead;
      result.status = valueResult.value as TransactionStatusEnum;
    } else if (wireType === 2 && fieldNumber === 2) {
      const lenResult = parseVarint(messageBytes, offset);
      offset += lenResult.bytesRead;
      result.message = parseString(messageBytes, offset, lenResult.value);
      offset += lenResult.value;
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

  return result;
}

// Search by display name response types and parser

export interface SearchIdentityResult {
  displayName: string;
  publicSigningAddress: string;
  publicEncryptAddress: string;
}

export function parseSearchByDisplayNameResponse(messageBytes: Uint8Array): SearchIdentityResult[] {
  const results: SearchIdentityResult[] = [];
  let offset = 0;

  while (offset < messageBytes.length) {
    const tagResult = parseVarint(messageBytes, offset);
    const tag = tagResult.value;
    offset += tagResult.bytesRead;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (wireType === 2 && fieldNumber === 1) {
      // Embedded Identity message
      const lenResult = parseVarint(messageBytes, offset);
      offset += lenResult.bytesRead;
      const identityBytes = messageBytes.slice(offset, offset + lenResult.value);
      offset += lenResult.value;

      results.push(parseSingleSearchIdentity(identityBytes));
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

  return results;
}

function parseSingleSearchIdentity(bytes: Uint8Array): SearchIdentityResult {
  const result: SearchIdentityResult = {
    displayName: '',
    publicSigningAddress: '',
    publicEncryptAddress: '',
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
      const strValue = parseString(bytes, offset, lenResult.value);
      offset += lenResult.value;

      if (fieldNumber === 1) result.displayName = strValue;
      if (fieldNumber === 2) result.publicSigningAddress = strValue;
      if (fieldNumber === 3) result.publicEncryptAddress = strValue;
    } else if (wireType === 0) {
      const valueResult = parseVarint(bytes, offset);
      offset += valueResult.bytesRead;
    } else {
      break;
    }
  }

  return result;
}

// ============= Notification Service Builders & Parsers =============

export function buildSubscribeToEventsRequest(userId: string, deviceId?: string, platform?: string): Uint8Array {
  const bytes: number[] = [
    ...encodeString(1, userId),
  ];
  if (deviceId) bytes.push(...encodeString(2, deviceId));
  if (platform) bytes.push(...encodeString(3, platform));
  return new Uint8Array(bytes);
}

export function buildMarkFeedAsReadRequest(userId: string, feedId: string): Uint8Array {
  const bytes = [
    ...encodeString(1, userId),
    ...encodeString(2, feedId),
  ];
  return new Uint8Array(bytes);
}

export function buildGetUnreadCountsRequest(userId: string): Uint8Array {
  const bytes = encodeString(1, userId);
  return new Uint8Array(bytes);
}

export interface FeedEventResponse {
  type: number;
  feedId: string;
  senderName: string;
  messagePreview: string;
  unreadCount: number;
  allCounts: Record<string, number>;
  timestampUnixMs: number;
}

export function parseFeedEventResponse(messageBytes: Uint8Array): FeedEventResponse {
  const result: FeedEventResponse = {
    type: 0,
    feedId: '',
    senderName: '',
    messagePreview: '',
    unreadCount: 0,
    allCounts: {},
    timestampUnixMs: 0,
  };

  let offset = 0;
  while (offset < messageBytes.length) {
    const tagResult = parseVarint(messageBytes, offset);
    const tag = tagResult.value;
    offset += tagResult.bytesRead;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (wireType === 0) {
      // Varint
      const valueResult = parseVarint(messageBytes, offset);
      offset += valueResult.bytesRead;

      if (fieldNumber === 1) result.type = valueResult.value;
      if (fieldNumber === 5) result.unreadCount = valueResult.value;
      if (fieldNumber === 7) result.timestampUnixMs = valueResult.value;
    } else if (wireType === 2) {
      // Length-delimited (string or embedded message)
      const lenResult = parseVarint(messageBytes, offset);
      offset += lenResult.bytesRead;

      if (fieldNumber === 6) {
        // Map field - AllCounts (map<string, int32>)
        const mapBytes = messageBytes.slice(offset, offset + lenResult.value);
        const mapEntry = parseMapEntry(mapBytes);
        if (mapEntry) {
          result.allCounts[mapEntry.key] = mapEntry.value;
        }
      } else {
        const strValue = parseString(messageBytes, offset, lenResult.value);
        if (fieldNumber === 2) result.feedId = strValue;
        if (fieldNumber === 3) result.senderName = strValue;
        if (fieldNumber === 4) result.messagePreview = strValue;
      }
      offset += lenResult.value;
    } else {
      break;
    }
  }

  return result;
}

function parseMapEntry(bytes: Uint8Array): { key: string; value: number } | null {
  let key = '';
  let value = 0;
  let offset = 0;

  while (offset < bytes.length) {
    const tagResult = parseVarint(bytes, offset);
    const tag = tagResult.value;
    offset += tagResult.bytesRead;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (wireType === 2 && fieldNumber === 1) {
      // Key (string)
      const lenResult = parseVarint(bytes, offset);
      offset += lenResult.bytesRead;
      key = parseString(bytes, offset, lenResult.value);
      offset += lenResult.value;
    } else if (wireType === 0 && fieldNumber === 2) {
      // Value (int32)
      const valueResult = parseVarint(bytes, offset);
      offset += valueResult.bytesRead;
      value = valueResult.value;
    } else if (wireType === 0) {
      const valueResult = parseVarint(bytes, offset);
      offset += valueResult.bytesRead;
    } else if (wireType === 2) {
      const lenResult = parseVarint(bytes, offset);
      offset += lenResult.bytesRead + lenResult.value;
    } else {
      break;
    }
  }

  return key ? { key, value } : null;
}

export interface MarkFeedAsReadResponse {
  success: boolean;
  message?: string;  // FEAT-051: Optional message field for error details
}

export function parseMarkFeedAsReadResponse(messageBytes: Uint8Array): MarkFeedAsReadResponse {
  const result: MarkFeedAsReadResponse = { success: false };

  let offset = 0;
  while (offset < messageBytes.length) {
    const tagResult = parseVarint(messageBytes, offset);
    const tag = tagResult.value;
    offset += tagResult.bytesRead;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (wireType === 0 && fieldNumber === 1) {
      const valueResult = parseVarint(messageBytes, offset);
      offset += valueResult.bytesRead;
      result.success = valueResult.value === 1;
    } else if (wireType === 2 && fieldNumber === 2) {
      // FEAT-051: Parse message field
      const lenResult = parseVarint(messageBytes, offset);
      offset += lenResult.bytesRead;
      result.message = parseString(messageBytes, offset, lenResult.value);
      offset += lenResult.value;
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

  return result;
}

// ============= FEAT-051: Notification Service MarkFeedAsRead =============

/**
 * Build MarkFeedAsReadRequest for the HushNotification gRPC service (FEAT-051)
 * Proto (hushNotification.proto):
 * message MarkFeedAsReadRequest {
 *   string UserId = 1;
 *   string FeedId = 2;
 *   int64 UpToBlockIndex = 3;
 * }
 */
export function buildFeedMarkAsReadRequest(
  feedId: string,
  upToBlockIndex: number,
  userPublicAddress: string
): Uint8Array {
  const bytes = [
    ...encodeString(1, userPublicAddress),   // UserId = 1
    ...encodeString(2, feedId),              // FeedId = 2
    ...encodeVarintField(3, upToBlockIndex), // UpToBlockIndex = 3
  ];
  return new Uint8Array(bytes);
}

export interface GetUnreadCountsResponse {
  counts: Record<string, number>;
}

export function parseGetUnreadCountsResponse(messageBytes: Uint8Array): GetUnreadCountsResponse {
  const result: GetUnreadCountsResponse = { counts: {} };

  let offset = 0;
  while (offset < messageBytes.length) {
    const tagResult = parseVarint(messageBytes, offset);
    const tag = tagResult.value;
    offset += tagResult.bytesRead;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (wireType === 2 && fieldNumber === 1) {
      // Map entry
      const lenResult = parseVarint(messageBytes, offset);
      offset += lenResult.bytesRead;
      const mapBytes = messageBytes.slice(offset, offset + lenResult.value);
      const mapEntry = parseMapEntry(mapBytes);
      if (mapEntry) {
        result.counts[mapEntry.key] = mapEntry.value;
      }
      offset += lenResult.value;
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

  return result;
}

// ============= Reactions Service Builders & Parsers =============

// Encode bytes field for protobuf (wire type 2)
function encodeBytes(fieldNumber: number, value: Uint8Array): number[] {
  const tag = (fieldNumber << 3) | 2; // wire type 2 = length-delimited
  return [...encodeVarint(tag), ...encodeVarint(value.length), ...value];
}

/**
 * Build GetTalliesRequest for binary gRPC
 * Proto: message GetTalliesRequest {
 *   bytes feed_id = 1;
 *   repeated bytes message_ids = 2;
 * }
 */
export function buildGetTalliesRequest(feedId: Uint8Array, messageIds: Uint8Array[]): Uint8Array {
  const bytes: number[] = [
    ...encodeBytes(1, feedId),
  ];
  for (const msgId of messageIds) {
    bytes.push(...encodeBytes(2, msgId));
  }
  return new Uint8Array(bytes);
}

/**
 * Parse GetTalliesResponse
 * Proto: message GetTalliesResponse {
 *   repeated MessageTally tallies = 1;
 * }
 */
export interface GetTalliesResponseParsed {
  tallies: ReactionTally[];
}

export function parseGetTalliesResponse(messageBytes: Uint8Array): GetTalliesResponseParsed {
  const result: GetTalliesResponseParsed = {
    tallies: [],
  };

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
      result.tallies.push(parseMessageTally(tallyBytes));
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

  return result;
}

/**
 * Parse MessageTally from proto bytes
 * Proto: message MessageTally {
 *   bytes message_id = 1;
 *   repeated ECPoint tally_c1 = 2;
 *   repeated ECPoint tally_c2 = 3;
 *   int32 total_count = 4;
 * }
 */
function parseMessageTally(bytes: Uint8Array): ReactionTally {
  const tally: ReactionTally = {
    messageId: '',
    tallyC1: [],
    tallyC2: [],
    tallyVersion: 0,
    reactionCount: 0,
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
      if (fieldNumber === 4) tally.reactionCount = valueResult.value;
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

/**
 * Convert .NET GUID bytes to UUID string
 */
function bytesToUuid(bytes: Uint8Array): string {
  if (bytes.length !== 16) return '';

  // Part 1: bytes 0-3, reverse (little-endian to big-endian)
  const p1 = [bytes[3], bytes[2], bytes[1], bytes[0]]
    .map(b => b.toString(16).padStart(2, '0')).join('');

  // Part 2: bytes 4-5, reverse
  const p2 = [bytes[5], bytes[4]]
    .map(b => b.toString(16).padStart(2, '0')).join('');

  // Part 3: bytes 6-7, reverse
  const p3 = [bytes[7], bytes[6]]
    .map(b => b.toString(16).padStart(2, '0')).join('');

  // Part 4: bytes 8-9, as-is (big-endian)
  const p4 = [bytes[8], bytes[9]]
    .map(b => b.toString(16).padStart(2, '0')).join('');

  // Part 5: bytes 10-15, as-is (big-endian)
  const p5 = [bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]]
    .map(b => b.toString(16).padStart(2, '0')).join('');

  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}

/**
 * Convert UUID string to .NET GUID bytes
 */
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

// ============= Group Feed Query Service Builders & Parsers (FEAT-017) =============

/**
 * Build GetGroupMembersRequest for binary gRPC
 * Proto: message GetGroupMembersRequest {
 *   string FeedId = 1;
 * }
 */
export function buildGetGroupMembersRequest(feedId: string): Uint8Array {
  const bytes = encodeString(1, feedId);
  return new Uint8Array(bytes);
}

/**
 * Group member info from GetGroupMembersResponse
 */
export interface GroupMemberInfo {
  publicAddress: string;
  participantType: number;
  joinedAtBlock: number;
  leftAtBlock?: number;  // Set if member has left or been banned
  displayName?: string;  // Display name at time of query
}

/**
 * Parse GetGroupMembersResponse
 * Proto: message GetGroupMembersResponse {
 *   repeated GroupFeedMemberProto Members = 1;
 * }
 *
 * message GroupFeedMemberProto {
 *   string PublicAddress = 1;
 *   int32 ParticipantType = 2;
 *   int64 JoinedAtBlock = 3;
 *   optional int64 LeftAtBlock = 4;
 *   optional string DisplayName = 5;
 * }
 */
export function parseGetGroupMembersResponse(messageBytes: Uint8Array): GroupMemberInfo[] {
  const members: GroupMemberInfo[] = [];
  let offset = 0;

  while (offset < messageBytes.length) {
    const tagResult = parseVarint(messageBytes, offset);
    const tag = tagResult.value;
    offset += tagResult.bytesRead;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (wireType === 2 && fieldNumber === 1) {
      // GroupFeedMemberProto (repeated)
      const lenResult = parseVarint(messageBytes, offset);
      offset += lenResult.bytesRead;
      const memberBytes = messageBytes.slice(offset, offset + lenResult.value);
      offset += lenResult.value;
      members.push(parseGroupMember(memberBytes));
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

  return members;
}

/**
 * Parse a single GroupFeedMemberProto from protobuf bytes
 */
function parseGroupMember(bytes: Uint8Array): GroupMemberInfo {
  const member: GroupMemberInfo = {
    publicAddress: '',
    participantType: 0,
    joinedAtBlock: 0,
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
      if (fieldNumber === 2) member.participantType = valueResult.value;
      if (fieldNumber === 3) member.joinedAtBlock = valueResult.value;
      if (fieldNumber === 4) member.leftAtBlock = valueResult.value;
    } else if (wireType === 2) {
      const lenResult = parseVarint(bytes, offset);
      offset += lenResult.bytesRead;
      const strValue = parseString(bytes, offset, lenResult.value);
      offset += lenResult.value;
      if (fieldNumber === 1) member.publicAddress = strValue;
      if (fieldNumber === 5) member.displayName = strValue;
    } else {
      break;
    }
  }

  return member;
}

/**
 * Build GetKeyGenerationsRequest for binary gRPC
 * Proto: message GetKeyGenerationsRequest {
 *   string FeedId = 1;
 *   string UserPublicAddress = 2;
 * }
 */
export function buildGetKeyGenerationsRequest(feedId: string, userPublicAddress: string): Uint8Array {
  const bytes = [
    ...encodeString(1, feedId),
    ...encodeString(2, userPublicAddress),
  ];
  return new Uint8Array(bytes);
}

/**
 * KeyGeneration info from GetKeyGenerationsResponse
 */
export interface KeyGenerationInfo {
  keyGeneration: number;
  encryptedKey: string;
  validFromBlock: number;
  validToBlock?: number;
}

/**
 * Parse GetKeyGenerationsResponse
 * Proto: message GetKeyGenerationsResponse {
 *   repeated KeyGenerationProto KeyGenerations = 1;
 * }
 *
 * message KeyGenerationProto {
 *   int32 KeyGeneration = 1;
 *   string EncryptedKey = 2;
 *   int64 ValidFromBlock = 3;
 *   optional int64 ValidToBlock = 4;
 * }
 */
export function parseGetKeyGenerationsResponse(messageBytes: Uint8Array): KeyGenerationInfo[] {
  const keyGenerations: KeyGenerationInfo[] = [];
  let offset = 0;

  while (offset < messageBytes.length) {
    const tagResult = parseVarint(messageBytes, offset);
    const tag = tagResult.value;
    offset += tagResult.bytesRead;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (wireType === 2 && fieldNumber === 1) {
      // KeyGenerationProto (repeated)
      const lenResult = parseVarint(messageBytes, offset);
      offset += lenResult.bytesRead;
      const kgBytes = messageBytes.slice(offset, offset + lenResult.value);
      offset += lenResult.value;
      keyGenerations.push(parseKeyGeneration(kgBytes));
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

  return keyGenerations;
}

/**
 * Parse a single KeyGenerationProto from protobuf bytes
 */
function parseKeyGeneration(bytes: Uint8Array): KeyGenerationInfo {
  const kg: KeyGenerationInfo = {
    keyGeneration: 0,
    encryptedKey: '',
    validFromBlock: 0,
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
      if (fieldNumber === 1) kg.keyGeneration = valueResult.value;
      if (fieldNumber === 3) kg.validFromBlock = valueResult.value;
      if (fieldNumber === 4) kg.validToBlock = valueResult.value;
    } else if (wireType === 2) {
      const lenResult = parseVarint(bytes, offset);
      offset += lenResult.bytesRead;
      const strValue = parseString(bytes, offset, lenResult.value);
      offset += lenResult.value;
      if (fieldNumber === 2) kg.encryptedKey = strValue;
    } else {
      break;
    }
  }

  return kg;
}

// ============= Group Feed Admin Operations (FEAT-017) =============

/**
 * Build AddMemberToGroupFeedRequest for binary gRPC
 * Proto: message AddMemberToGroupFeedRequest {
 *   string FeedId = 1;
 *   string AdminPublicAddress = 2;
 *   string NewMemberPublicAddress = 3;
 *   string NewMemberPublicEncryptKey = 4;
 * }
 */
export function buildAddMemberToGroupFeedRequest(
  feedId: string,
  adminPublicAddress: string,
  newMemberPublicAddress: string,
  newMemberPublicEncryptKey: string
): Uint8Array {
  const bytes = [
    ...encodeString(1, feedId),
    ...encodeString(2, adminPublicAddress),
    ...encodeString(3, newMemberPublicAddress),
    ...encodeString(4, newMemberPublicEncryptKey),
  ];
  return new Uint8Array(bytes);
}

/**
 * Response from AddMemberToGroupFeed
 */
export interface AddMemberToGroupFeedResult {
  success: boolean;
  message: string;
}

/**
 * Parse AddMemberToGroupFeedResponse
 * Proto: message AddMemberToGroupFeedResponse {
 *   bool Success = 1;
 *   string Message = 2;
 * }
 */
export function parseAddMemberToGroupFeedResponse(messageBytes: Uint8Array): AddMemberToGroupFeedResult {
  const result: AddMemberToGroupFeedResult = {
    success: false,
    message: '',
  };

  let offset = 0;
  while (offset < messageBytes.length) {
    const tagResult = parseVarint(messageBytes, offset);
    const tag = tagResult.value;
    offset += tagResult.bytesRead;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (wireType === 0 && fieldNumber === 1) {
      const valueResult = parseVarint(messageBytes, offset);
      offset += valueResult.bytesRead;
      result.success = valueResult.value === 1;
    } else if (wireType === 2 && fieldNumber === 2) {
      const lenResult = parseVarint(messageBytes, offset);
      offset += lenResult.bytesRead;
      result.message = parseString(messageBytes, offset, lenResult.value);
      offset += lenResult.value;
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

  return result;
}

// ============= Join Group Feed Operation =============

/**
 * Build JoinGroupFeedRequest for binary gRPC
 * Proto: message JoinGroupFeedRequest {
 *   string FeedId = 1;
 *   string JoiningUserPublicAddress = 2;
 *   optional string InvitationSignature = 3;
 *   optional string JoiningUserPublicEncryptKey = 4;
 * }
 */
export function buildJoinGroupFeedRequest(
  feedId: string,
  joiningUserPublicAddress: string,
  invitationSignature?: string,
  joiningUserPublicEncryptKey?: string
): Uint8Array {
  const bytes = [
    ...encodeString(1, feedId),
    ...encodeString(2, joiningUserPublicAddress),
  ];
  if (invitationSignature) {
    bytes.push(...encodeString(3, invitationSignature));
  }
  if (joiningUserPublicEncryptKey) {
    bytes.push(...encodeString(4, joiningUserPublicEncryptKey));
  }
  return new Uint8Array(bytes);
}

/**
 * Response from JoinGroupFeed
 */
export interface JoinGroupFeedResult {
  success: boolean;
  message: string;
}

/**
 * Parse JoinGroupFeedResponse
 * Proto: message JoinGroupFeedResponse {
 *   bool Success = 1;
 *   string Message = 2;
 * }
 */
export function parseJoinGroupFeedResponse(messageBytes: Uint8Array): JoinGroupFeedResult {
  const result: JoinGroupFeedResult = {
    success: false,
    message: '',
  };

  let offset = 0;
  while (offset < messageBytes.length) {
    const tagResult = parseVarint(messageBytes, offset);
    const tag = tagResult.value;
    offset += tagResult.bytesRead;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (wireType === 0 && fieldNumber === 1) {
      const valueResult = parseVarint(messageBytes, offset);
      offset += valueResult.bytesRead;
      result.success = valueResult.value === 1;
    } else if (wireType === 2 && fieldNumber === 2) {
      const lenResult = parseVarint(messageBytes, offset);
      offset += lenResult.bytesRead;
      result.message = parseString(messageBytes, offset, lenResult.value);
      offset += lenResult.value;
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

  return result;
}

// ============= Leave Group Feed Operation =============

/**
 * Build LeaveGroupFeedRequest for binary gRPC
 * Proto: message LeaveGroupFeedRequest {
 *   string FeedId = 1;
 *   string LeavingUserPublicAddress = 2;
 * }
 */
export function buildLeaveGroupFeedRequest(
  feedId: string,
  leavingUserPublicAddress: string
): Uint8Array {
  const bytes = [
    ...encodeString(1, feedId),
    ...encodeString(2, leavingUserPublicAddress),
  ];
  return new Uint8Array(bytes);
}

/**
 * Response from LeaveGroupFeed
 */
export interface LeaveGroupFeedResult {
  success: boolean;
  message: string;
}

/**
 * Parse LeaveGroupFeedResponse
 * Proto: message LeaveGroupFeedResponse {
 *   bool Success = 1;
 *   string Message = 2;
 * }
 */
export function parseLeaveGroupFeedResponse(messageBytes: Uint8Array): LeaveGroupFeedResult {
  const result: LeaveGroupFeedResult = {
    success: false,
    message: '',
  };

  let offset = 0;
  while (offset < messageBytes.length) {
    const tagResult = parseVarint(messageBytes, offset);
    const tag = tagResult.value;
    offset += tagResult.bytesRead;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (wireType === 0 && fieldNumber === 1) {
      const valueResult = parseVarint(messageBytes, offset);
      offset += valueResult.bytesRead;
      result.success = valueResult.value === 1;
    } else if (wireType === 2 && fieldNumber === 2) {
      const lenResult = parseVarint(messageBytes, offset);
      offset += lenResult.bytesRead;
      result.message = parseString(messageBytes, offset, lenResult.value);
      offset += lenResult.value;
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

  return result;
}

// ============= Delete Group Feed Operation =============

/**
 * Build DeleteGroupFeedRequest for binary gRPC
 * Proto: message DeleteGroupFeedRequest {
 *   string FeedId = 1;
 *   string AdminPublicAddress = 2;
 * }
 */
export function buildDeleteGroupFeedRequest(
  feedId: string,
  adminPublicAddress: string
): Uint8Array {
  const bytes = [
    ...encodeString(1, feedId),
    ...encodeString(2, adminPublicAddress),
  ];
  return new Uint8Array(bytes);
}

/**
 * Response from DeleteGroupFeed
 */
export interface DeleteGroupFeedResult {
  success: boolean;
  message: string;
}

/**
 * Parse DeleteGroupFeedResponse
 * Proto: message DeleteGroupFeedResponse {
 *   bool Success = 1;
 *   string Message = 2;
 * }
 */
export function parseDeleteGroupFeedResponse(messageBytes: Uint8Array): DeleteGroupFeedResult {
  const result: DeleteGroupFeedResult = {
    success: false,
    message: '',
  };

  let offset = 0;
  while (offset < messageBytes.length) {
    const tagResult = parseVarint(messageBytes, offset);
    const tag = tagResult.value;
    offset += tagResult.bytesRead;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (wireType === 0 && fieldNumber === 1) {
      const valueResult = parseVarint(messageBytes, offset);
      offset += valueResult.bytesRead;
      result.success = valueResult.value === 1;
    } else if (wireType === 2 && fieldNumber === 2) {
      const lenResult = parseVarint(messageBytes, offset);
      offset += lenResult.bytesRead;
      result.message = parseString(messageBytes, offset, lenResult.value);
      offset += lenResult.value;
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

  return result;
}

// ============= Device Token Registration (Push Notifications) =============

/**
 * Push platform enum values matching the proto definition
 */
export const PushPlatform = {
  UNSPECIFIED: 0,
  ANDROID: 1,
  IOS: 2,
  WEB: 3,
} as const;

export type PushPlatformType = (typeof PushPlatform)[keyof typeof PushPlatform];

/**
 * Build RegisterDeviceTokenRequest for binary gRPC
 * Proto: message RegisterDeviceTokenRequest {
 *   string UserId = 1;
 *   PushPlatform Platform = 2;
 *   string Token = 3;
 *   string DeviceName = 4;
 * }
 */
export function buildRegisterDeviceTokenRequest(
  userId: string,
  platform: PushPlatformType,
  token: string,
  deviceName?: string
): Uint8Array {
  const bytes = [
    ...encodeString(1, userId),
    ...encodeVarintField(2, platform),
    ...encodeString(3, token),
  ];
  if (deviceName) {
    bytes.push(...encodeString(4, deviceName));
  }
  return new Uint8Array(bytes);
}

/**
 * Response from RegisterDeviceToken
 */
export interface RegisterDeviceTokenResult {
  success: boolean;
  message: string;
}

/**
 * Parse RegisterDeviceTokenResponse
 * Proto: message RegisterDeviceTokenResponse {
 *   bool Success = 1;
 *   string Message = 2;
 * }
 */
export function parseRegisterDeviceTokenResponse(messageBytes: Uint8Array): RegisterDeviceTokenResult {
  const result: RegisterDeviceTokenResult = {
    success: false,
    message: '',
  };

  let offset = 0;
  while (offset < messageBytes.length) {
    const tagResult = parseVarint(messageBytes, offset);
    const tag = tagResult.value;
    offset += tagResult.bytesRead;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (wireType === 0 && fieldNumber === 1) {
      const valueResult = parseVarint(messageBytes, offset);
      offset += valueResult.bytesRead;
      result.success = valueResult.value === 1;
    } else if (wireType === 2 && fieldNumber === 2) {
      const lenResult = parseVarint(messageBytes, offset);
      offset += lenResult.bytesRead;
      result.message = parseString(messageBytes, offset, lenResult.value);
      offset += lenResult.value;
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

  return result;
}
