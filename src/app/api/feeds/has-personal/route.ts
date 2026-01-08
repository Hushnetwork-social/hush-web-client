// API Route: GET /api/feeds/has-personal?address=<publicSigningAddress>
// Checks if user has a personal feed

import { NextRequest, NextResponse } from 'next/server';
import {
  grpcCall,
  parseGrpcResponse,
  buildHasPersonalFeedRequest,
  parseHasPersonalFeedResponse,
} from '@/lib/grpc/grpc-web-helper';


export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address');

  if (!address) {
    return NextResponse.json(
      { error: 'Missing address parameter' },
      { status: 400 }
    );
  }

  try {
    const requestBytes = buildHasPersonalFeedRequest(address);
    const responseBytes = await grpcCall('rpcHush.HushFeed', 'HasPersonalFeed', requestBytes);
    const messageBytes = parseGrpcResponse(responseBytes);

    if (!messageBytes) {
      return NextResponse.json(
        { error: 'Invalid gRPC response' },
        { status: 502 }
      );
    }

    const result = parseHasPersonalFeedResponse(messageBytes);

    return NextResponse.json({
      hasPersonalFeed: result.feedAvailable,
    });
  } catch (error) {
    console.error('[API] Personal feed check failed:', error);
    return NextResponse.json(
      { error: 'Failed to check personal feed' },
      { status: 502 }
    );
  }
}
