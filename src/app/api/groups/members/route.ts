// API Route: GET /api/groups/members?feedId=<feedId>
// Retrieves all members of a group feed

import { NextRequest, NextResponse } from 'next/server';

// Mark as dynamic to exclude from static export
export const dynamic = 'force-dynamic';
import {
  grpcCall,
  parseGrpcResponse,
  buildGetGroupMembersRequest,
  parseGetGroupMembersResponse,
} from '@/lib/grpc/grpc-web-helper';

export async function GET(request: NextRequest) {
  const feedId = request.nextUrl.searchParams.get('feedId');

  if (!feedId) {
    return NextResponse.json(
      { error: 'Missing feedId parameter' },
      { status: 400 }
    );
  }

  try {
    console.log(`[API] GetGroupMembers request for feedId: ${feedId.substring(0, 8)}...`);
    const requestBytes = buildGetGroupMembersRequest(feedId);
    const responseBytes = await grpcCall('rpcHush.HushFeed', 'GetGroupMembers', requestBytes);
    const messageBytes = parseGrpcResponse(responseBytes);

    if (!messageBytes) {
      // Empty response - group might have no members or doesn't exist
      console.log('[API] GetGroupMembers: empty response');
      return NextResponse.json({ members: [] });
    }

    const members = parseGetGroupMembersResponse(messageBytes);
    console.log(`[API] GetGroupMembers: returning ${members.length} members`);

    return NextResponse.json({
      members: members.map(m => ({
        publicAddress: m.publicAddress,
        participantType: m.participantType,
        joinedAtBlock: m.joinedAtBlock,
      })),
    });
  } catch (error) {
    console.error('[API] GetGroupMembers failed:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve group members' },
      { status: 502 }
    );
  }
}
