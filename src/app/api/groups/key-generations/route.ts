// API Route: GET /api/groups/key-generations?feedId=<feedId>&userAddress=<userAddress>
// Retrieves all key generations for a user in a group feed

import { NextRequest, NextResponse } from 'next/server';
import {
  grpcCall,
  parseGrpcResponse,
  buildGetKeyGenerationsRequest,
  parseGetKeyGenerationsResponse,
} from '@/lib/grpc/grpc-web-helper';


export async function GET(request: NextRequest) {
  const feedId = request.nextUrl.searchParams.get('feedId');
  const userAddress = request.nextUrl.searchParams.get('userAddress');

  if (!feedId) {
    return NextResponse.json(
      { error: 'Missing feedId parameter' },
      { status: 400 }
    );
  }

  if (!userAddress) {
    return NextResponse.json(
      { error: 'Missing userAddress parameter' },
      { status: 400 }
    );
  }

  try {
    console.log(`[API] GetKeyGenerations request for feedId: ${feedId.substring(0, 8)}..., user: ${userAddress.substring(0, 8)}...`);
    const requestBytes = buildGetKeyGenerationsRequest(feedId, userAddress);
    const responseBytes = await grpcCall('rpcHush.HushFeed', 'GetKeyGenerations', requestBytes);
    const messageBytes = parseGrpcResponse(responseBytes);

    if (!messageBytes) {
      // Empty response - user might not have access to any keys
      console.log('[API] GetKeyGenerations: empty response');
      return NextResponse.json({ keyGenerations: [] });
    }

    const keyGenerations = parseGetKeyGenerationsResponse(messageBytes);
    console.log(`[API] GetKeyGenerations: returning ${keyGenerations.length} key generations`);

    return NextResponse.json({
      keyGenerations: keyGenerations.map(kg => ({
        keyGeneration: kg.keyGeneration,
        encryptedKey: kg.encryptedKey,
        validFromBlock: kg.validFromBlock,
        validToBlock: kg.validToBlock,
      })),
    });
  } catch (error) {
    console.error('[API] GetKeyGenerations failed:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve key generations' },
      { status: 502 }
    );
  }
}
