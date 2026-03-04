// API Route: GET /api/feeds/inner-circle?ownerAddress=<publicSigningAddress>
// Retrieves inner circle existence/feed info for an owner address

import { NextRequest, NextResponse } from 'next/server';
import {
  buildGetInnerCircleRequest,
  grpcCall,
  parseGetInnerCircleResponse,
  parseGrpcResponse,
} from '@/lib/grpc/grpc-web-helper';

export async function GET(request: NextRequest) {
  const ownerAddress = request.nextUrl.searchParams.get('ownerAddress');

  if (!ownerAddress) {
    return NextResponse.json(
      { error: 'Missing ownerAddress parameter' },
      { status: 400 }
    );
  }

  try {
    const requestBytes = buildGetInnerCircleRequest(ownerAddress);
    const responseBytes = await grpcCall('rpcHush.HushFeed', 'GetInnerCircle', requestBytes);
    const messageBytes = parseGrpcResponse(responseBytes);

    if (!messageBytes) {
      return NextResponse.json({
        success: false,
        exists: false,
        message: 'Empty inner-circle response',
      });
    }

    const parsed = parseGetInnerCircleResponse(messageBytes);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error('[API] GetInnerCircle failed:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve inner circle' },
      { status: 502 }
    );
  }
}

