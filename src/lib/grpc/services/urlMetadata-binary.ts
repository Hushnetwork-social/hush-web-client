/**
 * Binary gRPC URL Metadata Service
 *
 * Browser-compatible binary protobuf encoding for URL metadata.
 * This bypasses the broken JSON-based GrpcClient and uses proper protobuf encoding.
 */

import { grpcConfig } from '../config';
import { debugLog } from '@/lib/debug-logger';

// ============= Protobuf Encoding Helpers =============

function encodeVarint(value: number): number[] {
  const bytes: number[] = [];
  if (value === 0) {
    bytes.push(0);
    return bytes;
  }
  while (value > 0x7f) {
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  bytes.push(value & 0x7f);
  return bytes;
}

function encodeString(fieldNumber: number, value: string): number[] {
  if (!value || value.length === 0) {
    return [];
  }
  const tag = (fieldNumber << 3) | 2; // wire type 2 = length-delimited
  const strBytes = new TextEncoder().encode(value);
  return [...encodeVarint(tag), ...encodeVarint(strBytes.length), ...strBytes];
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

// ============= Request Builders =============

/**
 * Build GetUrlMetadataBatchRequest protobuf message
 * message GetUrlMetadataBatchRequest {
 *   repeated string urls = 1;
 * }
 */
function buildGetUrlMetadataBatchRequest(urls: string[]): Uint8Array {
  const bytes: number[] = [];
  for (const url of urls) {
    bytes.push(...encodeString(1, url));
  }
  return new Uint8Array(bytes);
}

/**
 * Build GetUrlMetadataRequest protobuf message
 * message GetUrlMetadataRequest {
 *   string url = 1;
 * }
 */
function buildGetUrlMetadataRequest(url: string): Uint8Array {
  const bytes: number[] = [...encodeString(1, url)];
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

/**
 * URL Metadata Result interface
 */
export interface UrlMetadataResult {
  url: string;
  success: boolean;
  title: string;
  description: string;
  imageUrl: string;
  imageBase64: string;
  domain: string;
  errorMessage: string;
}

/**
 * Parse a single UrlMetadataResult from protobuf bytes
 * message UrlMetadataResult {
 *   string url = 1;
 *   bool success = 2;
 *   string title = 3;
 *   string description = 4;
 *   string image_url = 5;
 *   string image_base64 = 6;
 *   string domain = 7;
 *   string error_message = 8;
 * }
 */
function parseUrlMetadataResult(bytes: Uint8Array): UrlMetadataResult {
  const result: UrlMetadataResult = {
    url: '',
    success: false,
    title: '',
    description: '',
    imageUrl: '',
    imageBase64: '',
    domain: '',
    errorMessage: '',
  };

  let offset = 0;
  const decoder = new TextDecoder();

  while (offset < bytes.length) {
    const tagResult = parseVarint(bytes, offset);
    const tag = tagResult.value;
    offset += tagResult.bytesRead;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (wireType === 0) {
      // Varint - for bool (field 2: success)
      const valueResult = parseVarint(bytes, offset);
      offset += valueResult.bytesRead;
      if (fieldNumber === 2) {
        result.success = valueResult.value !== 0;
      }
    } else if (wireType === 2) {
      // Length-delimited - for strings
      const lenResult = parseVarint(bytes, offset);
      offset += lenResult.bytesRead;
      const strBytes = bytes.slice(offset, offset + lenResult.value);
      const strValue = decoder.decode(strBytes);
      offset += lenResult.value;

      switch (fieldNumber) {
        case 1:
          result.url = strValue;
          break;
        case 3:
          result.title = strValue;
          break;
        case 4:
          result.description = strValue;
          break;
        case 5:
          result.imageUrl = strValue;
          break;
        case 6:
          result.imageBase64 = strValue;
          break;
        case 7:
          result.domain = strValue;
          break;
        case 8:
          result.errorMessage = strValue;
          break;
      }
    } else {
      // Unknown wire type - skip (shouldn't happen for this message)
      break;
    }
  }

  return result;
}

/**
 * Parse GetUrlMetadataBatchResponse from protobuf bytes
 * message GetUrlMetadataBatchResponse {
 *   repeated UrlMetadataResult results = 1;
 * }
 */
function parseGetUrlMetadataBatchResponse(messageBytes: Uint8Array): UrlMetadataResult[] {
  const results: UrlMetadataResult[] = [];

  let offset = 0;
  while (offset < messageBytes.length) {
    const tagResult = parseVarint(messageBytes, offset);
    const tag = tagResult.value;
    offset += tagResult.bytesRead;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (wireType === 2 && fieldNumber === 1) {
      // UrlMetadataResult (repeated embedded message)
      const lenResult = parseVarint(messageBytes, offset);
      offset += lenResult.bytesRead;
      const resultBytes = messageBytes.slice(offset, offset + lenResult.value);
      offset += lenResult.value;
      results.push(parseUrlMetadataResult(resultBytes));
    } else if (wireType === 0) {
      // Varint - skip
      const valueResult = parseVarint(messageBytes, offset);
      offset += valueResult.bytesRead;
    } else if (wireType === 2) {
      // Length-delimited - skip
      const lenResult = parseVarint(messageBytes, offset);
      offset += lenResult.bytesRead + lenResult.value;
    } else {
      break;
    }
  }

  return results;
}

/**
 * Parse GetUrlMetadataResponse from protobuf bytes
 * message GetUrlMetadataResponse {
 *   bool success = 1;
 *   string title = 2;
 *   string description = 3;
 *   string image_url = 4;
 *   string image_base64 = 5;
 *   string domain = 6;
 *   string error_message = 7;
 * }
 */
function parseGetUrlMetadataResponse(messageBytes: Uint8Array): Omit<UrlMetadataResult, 'url'> {
  const result = {
    success: false,
    title: '',
    description: '',
    imageUrl: '',
    imageBase64: '',
    domain: '',
    errorMessage: '',
  };

  let offset = 0;
  const decoder = new TextDecoder();

  while (offset < messageBytes.length) {
    const tagResult = parseVarint(messageBytes, offset);
    const tag = tagResult.value;
    offset += tagResult.bytesRead;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (wireType === 0) {
      // Varint - for bool (field 1: success)
      const valueResult = parseVarint(messageBytes, offset);
      offset += valueResult.bytesRead;
      if (fieldNumber === 1) {
        result.success = valueResult.value !== 0;
      }
    } else if (wireType === 2) {
      // Length-delimited - for strings
      const lenResult = parseVarint(messageBytes, offset);
      offset += lenResult.bytesRead;
      const strBytes = messageBytes.slice(offset, offset + lenResult.value);
      const strValue = decoder.decode(strBytes);
      offset += lenResult.value;

      switch (fieldNumber) {
        case 2:
          result.title = strValue;
          break;
        case 3:
          result.description = strValue;
          break;
        case 4:
          result.imageUrl = strValue;
          break;
        case 5:
          result.imageBase64 = strValue;
          break;
        case 6:
          result.domain = strValue;
          break;
        case 7:
          result.errorMessage = strValue;
          break;
      }
    } else {
      break;
    }
  }

  return result;
}

// ============= Browser-Compatible gRPC Call =============

async function grpcCallBrowser(
  serviceName: string,
  methodName: string,
  requestBytes: Uint8Array
): Promise<Uint8Array> {
  const url = `${grpcConfig.serverUrl}/${serviceName}/${methodName}`;
  const frame = createGrpcFrame(requestBytes);

  debugLog(`[UrlMetadataBinary] Calling ${serviceName}/${methodName}`);

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
      debugLog(`[UrlMetadataBinary] Call failed: HTTP ${response.status} ${response.statusText}`);
      throw new Error(`gRPC call failed: ${response.status}`);
    }

    debugLog(`[UrlMetadataBinary] Call succeeded`);
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  } catch (error) {
    debugLog(`[UrlMetadataBinary] Call error:`, error);
    throw error;
  }
}

// ============= Exported Service Functions =============

const SERVICE_NAME = 'rpcHush.HushUrlMetadata';

/**
 * Get metadata for multiple URLs (batch request, max 10 URLs).
 * Uses binary protobuf encoding for correct server communication.
 *
 * @param urls - Array of URLs to fetch metadata for
 * @returns Array of URL metadata results
 */
export async function getUrlMetadataBatch(urls: string[]): Promise<UrlMetadataResult[]> {
  debugLog(`[UrlMetadataBinary] getUrlMetadataBatch called with ${urls.length} URLs`);

  const requestBytes = buildGetUrlMetadataBatchRequest(urls);
  const responseBytes = await grpcCallBrowser(SERVICE_NAME, 'GetUrlMetadataBatch', requestBytes);
  const grpcData = parseGrpcResponse(responseBytes);

  if (!grpcData) {
    debugLog('[UrlMetadataBinary] Empty gRPC response for GetUrlMetadataBatch');
    return [];
  }

  return parseGetUrlMetadataBatchResponse(grpcData);
}

/**
 * Get metadata for a single URL.
 * Uses binary protobuf encoding for correct server communication.
 *
 * @param url - The URL to fetch metadata for
 * @returns URL metadata result
 */
export async function getUrlMetadata(url: string): Promise<UrlMetadataResult> {
  debugLog(`[UrlMetadataBinary] getUrlMetadata called for: ${url}`);

  const requestBytes = buildGetUrlMetadataRequest(url);
  const responseBytes = await grpcCallBrowser(SERVICE_NAME, 'GetUrlMetadata', requestBytes);
  const grpcData = parseGrpcResponse(responseBytes);

  if (!grpcData) {
    debugLog('[UrlMetadataBinary] Empty gRPC response for GetUrlMetadata');
    return {
      url,
      success: false,
      title: '',
      description: '',
      imageUrl: '',
      imageBase64: '',
      domain: '',
      errorMessage: 'Empty response from server',
    };
  }

  const result = parseGetUrlMetadataResponse(grpcData);
  return {
    url,
    ...result,
  };
}
