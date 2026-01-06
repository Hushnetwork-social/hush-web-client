// API Route: GET /api/groups/by-code?code=<inviteCode>
// Looks up a public group feed by its invite code

import { NextRequest, NextResponse } from 'next/server';
import {
  grpcCall,
  parseGrpcResponse,
  encodeString,
} from '@/lib/grpc/grpc-web-helper';

// Mark as dynamic to exclude from static export
export const dynamic = 'force-dynamic';

/**
 * Build GetGroupFeedByInviteCodeRequest protobuf message
 *
 * Proto definition:
 * message GetGroupFeedByInviteCodeRequest {
 *   string InviteCode = 1;
 * }
 */
function buildGetGroupFeedByInviteCodeRequest(inviteCode: string): Uint8Array {
  return new Uint8Array([...encodeString(1, inviteCode)]);
}

/**
 * Parse GetGroupFeedByInviteCodeResponse protobuf message
 *
 * Proto definition:
 * message GetGroupFeedByInviteCodeResponse {
 *   bool Success = 1;
 *   string Message = 2;
 *   string FeedId = 3;
 *   string Title = 4;
 *   string Description = 5;
 *   bool IsPublic = 6;
 *   int32 MemberCount = 7;
 * }
 */
function parseGetGroupFeedByInviteCodeResponse(data: Uint8Array): {
  success: boolean;
  message: string;
  feedId: string;
  title: string;
  description: string;
  isPublic: boolean;
  memberCount: number;
} {
  const result = {
    success: false,
    message: '',
    feedId: '',
    title: '',
    description: '',
    isPublic: false,
    memberCount: 0,
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
  const inviteCode = request.nextUrl.searchParams.get('code');

  if (!inviteCode) {
    return NextResponse.json(
      { error: 'Missing code parameter', success: false },
      { status: 400 }
    );
  }

  // Normalize the code (uppercase, trim)
  const normalizedCode = inviteCode.trim().toUpperCase();

  // Validate format (8 chars, alphanumeric)
  if (!/^[A-Z0-9]{6,12}$/.test(normalizedCode)) {
    return NextResponse.json(
      { error: 'Invalid invite code format', success: false },
      { status: 400 }
    );
  }

  try {
    console.log(`[API] GetGroupFeedByInviteCode request: code=${normalizedCode}`);

    const requestBytes = buildGetGroupFeedByInviteCodeRequest(normalizedCode);
    const responseBytes = await grpcCall('rpcHush.HushFeed', 'GetGroupFeedByInviteCode', requestBytes);
    const messageBytes = parseGrpcResponse(responseBytes);

    if (!messageBytes) {
      console.log('[API] GetGroupFeedByInviteCode: empty response');
      return NextResponse.json({
        success: false,
        message: 'Empty response from server',
      });
    }

    const result = parseGetGroupFeedByInviteCodeResponse(messageBytes);
    console.log(`[API] GetGroupFeedByInviteCode result: success=${result.success}, title=${result.title}`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] GetGroupFeedByInviteCode failed:', error);
    return NextResponse.json(
      { error: 'Failed to lookup group by invite code', success: false },
      { status: 502 }
    );
  }
}
