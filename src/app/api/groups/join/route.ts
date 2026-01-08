// API Route: POST /api/groups/join
// Allows a user to join a public group feed

import { NextRequest, NextResponse } from 'next/server';
import {
  grpcCall,
  parseGrpcResponse,
  buildJoinGroupFeedRequest,
  parseJoinGroupFeedResponse,
} from '@/lib/grpc/grpc-web-helper';


interface JoinGroupRequestBody {
  feedId: string;
  joiningUserPublicAddress: string;
  invitationSignature?: string;
  joiningUserPublicEncryptKey?: string;  // User's encrypt key to avoid identity lookup timing issue
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as JoinGroupRequestBody;

    const { feedId, joiningUserPublicAddress, invitationSignature, joiningUserPublicEncryptKey } = body;

    if (!feedId || !joiningUserPublicAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    console.log(`[API] JoinGroupFeed request: feedId=${feedId.substring(0, 8)}..., user=${joiningUserPublicAddress.substring(0, 8)}..., hasEncryptKey=${!!joiningUserPublicEncryptKey}`);

    const requestBytes = buildJoinGroupFeedRequest(
      feedId,
      joiningUserPublicAddress,
      invitationSignature,
      joiningUserPublicEncryptKey
    );

    const responseBytes = await grpcCall('rpcHush.HushFeed', 'JoinGroupFeed', requestBytes);
    const messageBytes = parseGrpcResponse(responseBytes);

    if (!messageBytes) {
      console.log('[API] JoinGroupFeed: empty response');
      return NextResponse.json({
        success: false,
        message: 'Empty response from server',
      });
    }

    const result = parseJoinGroupFeedResponse(messageBytes);
    console.log(`[API] JoinGroupFeed result: success=${result.success}, message=${result.message}`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] JoinGroupFeed failed:', error);
    return NextResponse.json(
      { error: 'Failed to join group', success: false },
      { status: 502 }
    );
  }
}
