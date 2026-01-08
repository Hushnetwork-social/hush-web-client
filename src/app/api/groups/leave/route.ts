// API Route: POST /api/groups/leave
// Allows a user to leave a group feed

import { NextRequest, NextResponse } from 'next/server';
import {
  grpcCall,
  parseGrpcResponse,
  buildLeaveGroupFeedRequest,
  parseLeaveGroupFeedResponse,
} from '@/lib/grpc/grpc-web-helper';


interface LeaveGroupRequestBody {
  feedId: string;
  leavingUserPublicAddress: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as LeaveGroupRequestBody;

    const { feedId, leavingUserPublicAddress } = body;

    if (!feedId || !leavingUserPublicAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    console.log(`[API] LeaveGroupFeed request: feedId=${feedId.substring(0, 8)}..., user=${leavingUserPublicAddress.substring(0, 8)}...`);

    const requestBytes = buildLeaveGroupFeedRequest(
      feedId,
      leavingUserPublicAddress
    );

    const responseBytes = await grpcCall('rpcHush.HushFeed', 'LeaveGroupFeed', requestBytes);
    const messageBytes = parseGrpcResponse(responseBytes);

    if (!messageBytes) {
      console.log('[API] LeaveGroupFeed: empty response');
      return NextResponse.json({
        success: false,
        message: 'Empty response from server',
      });
    }

    const result = parseLeaveGroupFeedResponse(messageBytes);
    console.log(`[API] LeaveGroupFeed result: success=${result.success}, message=${result.message}`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] LeaveGroupFeed failed:', error);
    return NextResponse.json(
      { error: 'Failed to leave group', success: false },
      { status: 502 }
    );
  }
}
