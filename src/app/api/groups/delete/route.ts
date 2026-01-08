// API Route: POST /api/groups/delete
// Allows an admin to delete a group feed (soft delete)

import { NextRequest, NextResponse } from 'next/server';
import {
  grpcCall,
  parseGrpcResponse,
  buildDeleteGroupFeedRequest,
  parseDeleteGroupFeedResponse,
} from '@/lib/grpc/grpc-web-helper';

// Mark as dynamic to exclude from static export
export const dynamic = 'force-dynamic';

interface DeleteGroupRequestBody {
  feedId: string;
  adminPublicAddress: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as DeleteGroupRequestBody;

    const { feedId, adminPublicAddress } = body;

    if (!feedId || !adminPublicAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    console.log(`[API] DeleteGroupFeed request: feedId=${feedId.substring(0, 8)}..., admin=${adminPublicAddress.substring(0, 8)}...`);

    const requestBytes = buildDeleteGroupFeedRequest(
      feedId,
      adminPublicAddress
    );

    const responseBytes = await grpcCall('rpcHush.HushFeed', 'DeleteGroupFeed', requestBytes);
    const messageBytes = parseGrpcResponse(responseBytes);

    if (!messageBytes) {
      console.log('[API] DeleteGroupFeed: empty response');
      return NextResponse.json({
        success: false,
        message: 'Empty response from server',
      });
    }

    const result = parseDeleteGroupFeedResponse(messageBytes);
    console.log(`[API] DeleteGroupFeed result: success=${result.success}, message=${result.message}`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] DeleteGroupFeed failed:', error);
    return NextResponse.json(
      { error: 'Failed to delete group', success: false },
      { status: 502 }
    );
  }
}
