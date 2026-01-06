// API Route: GET /api/groups/info?feedId=<feedId>
// Gets group feed information (title, description, visibility)

import { NextRequest, NextResponse } from 'next/server';
import {
  grpcCall,
  parseGrpcResponse,
  encodeString,
} from '@/lib/grpc/grpc-web-helper';

// Mark as dynamic to exclude from static export
export const dynamic = 'force-dynamic';

/**
 * Build GetGroupFeedRequest protobuf message
 *
 * Proto definition:
 * message GetGroupFeedRequest {
 *   string FeedId = 1;
 * }
 */
function buildGetGroupFeedRequest(feedId: string): Uint8Array {
  return new Uint8Array([...encodeString(1, feedId)]);
}

/**
 * Parse GetGroupFeedResponse protobuf message
 *
 * Proto definition:
 * message GetGroupFeedResponse {
 *   bool Success = 1;
 *   string Message = 2;
 *   string FeedId = 3;
 *   string Title = 4;
 *   string Description = 5;
 *   bool IsPublic = 6;
 *   int32 MemberCount = 7;
 *   int32 CurrentKeyGeneration = 8;
 * }
 */
function parseGetGroupFeedResponse(data: Uint8Array): {
  success: boolean;
  message: string;
  feedId: string;
  title: string;
  description: string;
  isPublic: boolean;
  memberCount: number;
  currentKeyGeneration: number;
} {
  const result = {
    success: false,
    message: '',
    feedId: '',
    title: '',
    description: '',
    isPublic: false,
    memberCount: 0,
    currentKeyGeneration: 0,
  };

  let pos = 0;

  while (pos < data.length) {
    const tag = data[pos];
    const fieldNumber = tag >> 3;
    const wireType = tag & 0x7;
    pos++;

    if (wireType === 0) {
      // Varint
      let value = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = data[pos++];
        value |= (byte & 0x7f) << shift;
        shift += 7;
      } while (byte >= 0x80);

      if (fieldNumber === 1) result.success = value === 1;
      else if (fieldNumber === 6) result.isPublic = value === 1;
      else if (fieldNumber === 7) result.memberCount = value;
      else if (fieldNumber === 8) result.currentKeyGeneration = value;
    } else if (wireType === 2) {
      // Length-delimited (string)
      let len = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = data[pos++];
        len |= (byte & 0x7f) << shift;
        shift += 7;
      } while (byte >= 0x80);

      const strValue = new TextDecoder().decode(data.slice(pos, pos + len));
      pos += len;

      if (fieldNumber === 2) result.message = strValue;
      else if (fieldNumber === 3) result.feedId = strValue;
      else if (fieldNumber === 4) result.title = strValue;
      else if (fieldNumber === 5) result.description = strValue;
    }
  }

  return result;
}

export async function GET(request: NextRequest) {
  const feedId = request.nextUrl.searchParams.get('feedId');

  if (!feedId) {
    return NextResponse.json(
      { error: 'Missing feedId parameter' },
      { status: 400 }
    );
  }

  try {
    console.log(`[API] GetGroupFeed request: feedId=${feedId.substring(0, 8)}...`);

    const requestBytes = buildGetGroupFeedRequest(feedId);
    const responseBytes = await grpcCall('rpcHush.HushFeed', 'GetGroupFeed', requestBytes);
    const messageBytes = parseGrpcResponse(responseBytes);

    if (!messageBytes) {
      console.log('[API] GetGroupFeed: empty response');
      return NextResponse.json({
        success: false,
        message: 'Empty response from server',
      });
    }

    const result = parseGetGroupFeedResponse(messageBytes);
    console.log(`[API] GetGroupFeed result: success=${result.success}, title=${result.title}, isPublic=${result.isPublic}`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] GetGroupFeed failed:', error);
    return NextResponse.json(
      { error: 'Failed to get group feed info', success: false },
      { status: 502 }
    );
  }
}
