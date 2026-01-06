// API Route: POST /api/groups/settings
// Updates group feed settings (title, description, visibility) in a single call

import { NextRequest, NextResponse } from 'next/server';
import {
  grpcCall,
  parseGrpcResponse,
  encodeString,
  encodeBoolField,
} from '@/lib/grpc/grpc-web-helper';

// Mark as dynamic to exclude from static export
export const dynamic = 'force-dynamic';

interface UpdateGroupSettingsRequestBody {
  feedId: string;
  adminPublicAddress: string;
  newTitle?: string;
  newDescription?: string;
  isPublic?: boolean;
}

/**
 * Build UpdateGroupFeedSettingsRequest protobuf message
 *
 * Proto definition:
 * message UpdateGroupFeedSettingsRequest {
 *   string FeedId = 1;
 *   string AdminPublicAddress = 2;
 *   optional string NewTitle = 3;
 *   optional string NewDescription = 4;
 *   optional bool IsPublic = 5;
 * }
 */
function buildUpdateGroupSettingsRequest(
  feedId: string,
  adminPublicAddress: string,
  newTitle?: string,
  newDescription?: string,
  isPublic?: boolean
): Uint8Array {
  const bytes: number[] = [
    ...encodeString(1, feedId),
    ...encodeString(2, adminPublicAddress),
  ];

  // Only include optional fields if they are provided
  if (newTitle !== undefined) {
    bytes.push(...encodeString(3, newTitle));
  }

  if (newDescription !== undefined) {
    bytes.push(...encodeString(4, newDescription));
  }

  if (isPublic !== undefined) {
    bytes.push(...encodeBoolField(5, isPublic));
  }

  return new Uint8Array(bytes);
}

/**
 * Parse UpdateGroupFeedSettingsResponse protobuf message
 *
 * Proto definition:
 * message UpdateGroupFeedSettingsResponse {
 *   bool Success = 1;
 *   string Message = 2;
 * }
 */
function parseUpdateGroupSettingsResponse(data: Uint8Array): { success: boolean; message: string } {
  let success = false;
  let message = '';
  let pos = 0;

  while (pos < data.length) {
    const tag = data[pos];
    const fieldNumber = tag >> 3;
    const wireType = tag & 0x7;
    pos++;

    if (fieldNumber === 1 && wireType === 0) {
      // bool Success
      success = data[pos] === 1;
      pos++;
    } else if (fieldNumber === 2 && wireType === 2) {
      // string Message
      let len = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = data[pos++];
        len |= (byte & 0x7f) << shift;
        shift += 7;
      } while (byte >= 0x80);
      message = new TextDecoder().decode(data.slice(pos, pos + len));
      pos += len;
    } else {
      // Skip unknown fields
      if (wireType === 0) {
        while (data[pos] >= 0x80) pos++;
        pos++;
      } else if (wireType === 2) {
        let len = 0;
        let shift = 0;
        let byte: number;
        do {
          byte = data[pos++];
          len |= (byte & 0x7f) << shift;
          shift += 7;
        } while (byte >= 0x80);
        pos += len;
      }
    }
  }

  return { success, message };
}

export async function POST(request: NextRequest) {
  console.log('[API] UpdateGroupSettings: Request received');
  try {
    const body = await request.json() as UpdateGroupSettingsRequestBody;
    console.log('[API] UpdateGroupSettings: Body parsed:', JSON.stringify(body));

    const { feedId, adminPublicAddress, newTitle, newDescription, isPublic } = body;

    if (!feedId || !adminPublicAddress) {
      console.log('[API] UpdateGroupSettings: Missing required parameters');
      return NextResponse.json(
        { error: 'Missing required parameters (feedId, adminPublicAddress)' },
        { status: 400 }
      );
    }

    // At least one setting must be provided
    if (newTitle === undefined && newDescription === undefined && isPublic === undefined) {
      console.log('[API] UpdateGroupSettings: No settings provided');
      return NextResponse.json(
        { error: 'At least one setting must be provided to update' },
        { status: 400 }
      );
    }

    console.log(`[API] UpdateGroupSettings request: feedId=${feedId.substring(0, 8)}..., admin=${adminPublicAddress.substring(0, 8)}..., title=${newTitle !== undefined}, desc=${newDescription !== undefined}, isPublic=${isPublic}`);

    const requestBytes = buildUpdateGroupSettingsRequest(
      feedId,
      adminPublicAddress,
      newTitle,
      newDescription,
      isPublic
    );

    console.log('[API] UpdateGroupSettings: Calling gRPC...');
    const responseBytes = await grpcCall('rpcHush.HushFeed', 'UpdateGroupFeedSettings', requestBytes);
    console.log('[API] UpdateGroupSettings: gRPC call completed, response length:', responseBytes.length);
    const messageBytes = parseGrpcResponse(responseBytes);

    if (!messageBytes) {
      console.log('[API] UpdateGroupSettings: empty response (no message bytes)');
      return NextResponse.json({
        success: false,
        message: 'Empty response from server',
      });
    }

    console.log('[API] UpdateGroupSettings: Message bytes length:', messageBytes.length);
    const result = parseUpdateGroupSettingsResponse(messageBytes);
    console.log(`[API] UpdateGroupSettings result: success=${result.success}, message=${result.message}`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] UpdateGroupSettings failed:', error);
    return NextResponse.json(
      { error: 'Failed to update group settings', success: false },
      { status: 502 }
    );
  }
}
