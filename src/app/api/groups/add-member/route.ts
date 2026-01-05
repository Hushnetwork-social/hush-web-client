// API Route: POST /api/groups/add-member
// Adds a new member to a group feed (admin only)

import { NextRequest, NextResponse } from 'next/server';
import {
  grpcCall,
  parseGrpcResponse,
  buildAddMemberToGroupFeedRequest,
  parseAddMemberToGroupFeedResponse,
} from '@/lib/grpc/grpc-web-helper';

// Mark as dynamic to exclude from static export
export const dynamic = 'force-dynamic';

interface AddMemberRequestBody {
  feedId: string;
  adminPublicAddress: string;
  newMemberPublicAddress: string;
  newMemberPublicEncryptKey: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as AddMemberRequestBody;

    const { feedId, adminPublicAddress, newMemberPublicAddress, newMemberPublicEncryptKey } = body;

    if (!feedId || !adminPublicAddress || !newMemberPublicAddress || !newMemberPublicEncryptKey) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    console.log(`[API] AddMemberToGroupFeed request: feedId=${feedId.substring(0, 8)}..., member=${newMemberPublicAddress.substring(0, 8)}...`);

    const requestBytes = buildAddMemberToGroupFeedRequest(
      feedId,
      adminPublicAddress,
      newMemberPublicAddress,
      newMemberPublicEncryptKey
    );

    const responseBytes = await grpcCall('rpcHush.HushFeed', 'AddMemberToGroupFeed', requestBytes);
    const messageBytes = parseGrpcResponse(responseBytes);

    if (!messageBytes) {
      console.log('[API] AddMemberToGroupFeed: empty response');
      return NextResponse.json({
        success: false,
        message: 'Empty response from server',
      });
    }

    const result = parseAddMemberToGroupFeedResponse(messageBytes);
    console.log(`[API] AddMemberToGroupFeed result: success=${result.success}, message=${result.message}`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] AddMemberToGroupFeed failed:', error);
    return NextResponse.json(
      { error: 'Failed to add member to group', success: false },
      { status: 502 }
    );
  }
}
