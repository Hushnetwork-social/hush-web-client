// API Route: POST /api/feeds/mark-read
// FEAT-051: Marks a feed as read up to a specific block index
// Request body: { feedId: string, upToBlockIndex: number, userPublicAddress: string }

import { NextRequest, NextResponse } from 'next/server';
import {
  grpcCall,
  parseGrpcResponse,
  buildFeedMarkAsReadRequest,
  parseMarkFeedAsReadResponse,
} from '@/lib/grpc/grpc-web-helper';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { feedId, upToBlockIndex, userPublicAddress } = body;

    // Validate required fields
    if (!feedId) {
      return NextResponse.json(
        { success: false, message: 'Missing feedId parameter' },
        { status: 400 }
      );
    }

    if (typeof upToBlockIndex !== 'number' || upToBlockIndex < 0) {
      return NextResponse.json(
        { success: false, message: 'Invalid upToBlockIndex parameter' },
        { status: 400 }
      );
    }

    if (!userPublicAddress) {
      return NextResponse.json(
        { success: false, message: 'Missing userPublicAddress parameter' },
        { status: 400 }
      );
    }

    const requestBytes = buildFeedMarkAsReadRequest(feedId, upToBlockIndex, userPublicAddress);
    const responseBytes = await grpcCall('rpcHush.HushNotification', 'MarkFeedAsRead', requestBytes);
    const messageBytes = parseGrpcResponse(responseBytes);

    if (!messageBytes) {
      // Empty response treated as failure
      return NextResponse.json({ success: false, message: 'Empty response from server' });
    }

    const result = parseMarkFeedAsReadResponse(messageBytes);

    console.log(`[API] MarkFeedAsRead result for feed ${feedId}: success=${result.success}`);

    return NextResponse.json({
      success: result.success,
      message: result.message || '',
    });
  } catch (error) {
    console.error('[API] MarkFeedAsRead failed:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to mark feed as read' },
      { status: 502 }
    );
  }
}
