// gRPC-Web Helper for making binary gRPC calls from Next.js API routes

const GRPC_URL = process.env.NEXT_PUBLIC_GRPC_URL || 'http://localhost:4666';

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
function encodeString(fieldNumber: number, value: string): number[] {
  const encoder = new TextEncoder();
  const strBytes = encoder.encode(value);
  const tag = (fieldNumber << 3) | 2; // wire type 2 = length-delimited
  return [...encodeVarint(tag), ...encodeVarint(strBytes.length), ...strBytes];
}

// Encode a varint field for protobuf
function encodeVarintField(fieldNumber: number, value: number): number[] {
  const tag = (fieldNumber << 3) | 0; // wire type 0 = varint
  return [...encodeVarint(tag), ...encodeVarint(value)];
}

// Encode a bool field for protobuf
function encodeBoolField(fieldNumber: number, value: boolean): number[] {
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
    throw new Error(`gRPC call failed: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
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

export function buildGetFeedMessagesRequest(profilePublicKey: string, blockIndex: number): Uint8Array {
  const bytes = [
    ...encodeString(1, profilePublicKey),
    ...encodeVarintField(2, blockIndex),
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
}

export function parseFeedMessagesResponse(messageBytes: Uint8Array): FeedMessage[] {
  const messages: FeedMessage[] = [];
  let offset = 0;

  while (offset < messageBytes.length) {
    const tagResult = parseVarint(messageBytes, offset);
    const tag = tagResult.value;
    offset += tagResult.bytesRead;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (wireType === 2 && fieldNumber === 1) {
      const lenResult = parseVarint(messageBytes, offset);
      offset += lenResult.bytesRead;
      const msgBytes = messageBytes.slice(offset, offset + lenResult.value);
      offset += lenResult.value;

      messages.push(parseSingleMessage(msgBytes));
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

  return messages;
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
    } else if (wireType === 2) {
      const lenResult = parseVarint(bytes, offset);
      offset += lenResult.bytesRead;

      if (fieldNumber === 6) {
        // Timestamp (embedded message with seconds/nanos)
        const tsBytes = bytes.slice(offset, offset + lenResult.value);
        msg.timestamp = parseTimestamp(tsBytes);
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

export interface SubmitTransactionResponse {
  successful: boolean;
  message: string;
}

export function parseSubmitTransactionResponse(messageBytes: Uint8Array): SubmitTransactionResponse {
  const result: SubmitTransactionResponse = {
    successful: false,
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
      result.successful = valueResult.value === 1;
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
