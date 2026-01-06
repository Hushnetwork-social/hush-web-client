// API Route: GET /api/groups/search?query=<searchQuery>&maxResults=<number>
// Searches for public groups by title or description

import { NextRequest, NextResponse } from 'next/server';
import {
  grpcCall,
  parseGrpcResponse,
  encodeString,
  encodeVarintField,
  parseVarint,
  parseString,
} from '@/lib/grpc/grpc-web-helper';

// Mark as dynamic to exclude from static export
export const dynamic = 'force-dynamic';

/**
 * Build SearchPublicGroupsRequest protobuf message
 *
 * Proto definition:
 * message SearchPublicGroupsRequest {
 *   string SearchQuery = 1;
 *   int32 MaxResults = 2;
 * }
 */
function buildSearchPublicGroupsRequest(searchQuery: string, maxResults: number): Uint8Array {
  return new Uint8Array([
    ...encodeString(1, searchQuery),
    ...encodeVarintField(2, maxResults),
  ]);
}

/**
 * Public group info from search results
 */
interface PublicGroupInfoParsed {
  feedId: string;
  title: string;
  description: string;
  memberCount: number;
  createdAtBlock: number;
}

/**
 * Parse a single PublicGroupInfoProto from protobuf bytes
 *
 * Proto definition:
 * message PublicGroupInfoProto {
 *   string FeedId = 1;
 *   string Title = 2;
 *   string Description = 3;
 *   int32 MemberCount = 4;
 *   int64 CreatedAtBlock = 5;
 * }
 */
function parsePublicGroupInfo(bytes: Uint8Array): PublicGroupInfoParsed {
  const group: PublicGroupInfoParsed = {
    feedId: '',
    title: '',
    description: '',
    memberCount: 0,
    createdAtBlock: 0,
  };

  let offset = 0;
  while (offset < bytes.length) {
    const tagResult = parseVarint(bytes, offset);
    const tag = tagResult.value;
    offset += tagResult.bytesRead;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (wireType === 0) {
      // Varint
      const valueResult = parseVarint(bytes, offset);
      offset += valueResult.bytesRead;
      if (fieldNumber === 4) group.memberCount = valueResult.value;
      if (fieldNumber === 5) group.createdAtBlock = valueResult.value;
    } else if (wireType === 2) {
      // Length-delimited (string)
      const lenResult = parseVarint(bytes, offset);
      offset += lenResult.bytesRead;
      const strValue = parseString(bytes, offset, lenResult.value);
      offset += lenResult.value;

      if (fieldNumber === 1) group.feedId = strValue;
      else if (fieldNumber === 2) group.title = strValue;
      else if (fieldNumber === 3) group.description = strValue;
    } else {
      break;
    }
  }

  return group;
}

/**
 * Parse SearchPublicGroupsResponse protobuf message
 *
 * Proto definition:
 * message SearchPublicGroupsResponse {
 *   bool Success = 1;
 *   string Message = 2;
 *   repeated PublicGroupInfoProto Groups = 3;
 * }
 */
function parseSearchPublicGroupsResponse(data: Uint8Array): {
  success: boolean;
  message: string;
  groups: PublicGroupInfoParsed[];
} {
  const result = {
    success: false,
    message: '',
    groups: [] as PublicGroupInfoParsed[],
  };

  let pos = 0;

  while (pos < data.length) {
    const tagResult = parseVarint(data, pos);
    const tag = tagResult.value;
    pos += tagResult.bytesRead;

    const fieldNumber = tag >> 3;
    const wireType = tag & 0x7;

    if (wireType === 0) {
      // Varint
      const valueResult = parseVarint(data, pos);
      pos += valueResult.bytesRead;

      if (fieldNumber === 1) result.success = valueResult.value === 1;
    } else if (wireType === 2) {
      // Length-delimited
      const lenResult = parseVarint(data, pos);
      pos += lenResult.bytesRead;

      if (fieldNumber === 2) {
        // Message string
        result.message = parseString(data, pos, lenResult.value);
      } else if (fieldNumber === 3) {
        // Embedded PublicGroupInfoProto
        const groupBytes = data.slice(pos, pos + lenResult.value);
        result.groups.push(parsePublicGroupInfo(groupBytes));
      }
      pos += lenResult.value;
    } else {
      break;
    }
  }

  return result;
}

export async function GET(request: NextRequest) {
  const searchQuery = request.nextUrl.searchParams.get('query');
  const maxResultsStr = request.nextUrl.searchParams.get('maxResults');
  const maxResults = maxResultsStr ? parseInt(maxResultsStr, 10) : 20;

  if (!searchQuery) {
    return NextResponse.json(
      { error: 'Missing query parameter' },
      { status: 400 }
    );
  }

  try {
    console.log(`[API] SearchPublicGroups request: query=${searchQuery}, maxResults=${maxResults}`);

    const requestBytes = buildSearchPublicGroupsRequest(searchQuery, maxResults);
    const responseBytes = await grpcCall('rpcHush.HushFeed', 'SearchPublicGroups', requestBytes);
    const messageBytes = parseGrpcResponse(responseBytes);

    if (!messageBytes) {
      console.log('[API] SearchPublicGroups: empty response');
      return NextResponse.json({
        success: false,
        message: 'Empty response from server',
        groups: [],
      });
    }

    const result = parseSearchPublicGroupsResponse(messageBytes);
    console.log(`[API] SearchPublicGroups result: success=${result.success}, count=${result.groups.length}`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] SearchPublicGroups failed:', error);
    return NextResponse.json(
      { error: 'Failed to search public groups', success: false, groups: [] },
      { status: 502 }
    );
  }
}
