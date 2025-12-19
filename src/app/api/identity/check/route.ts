// API Route: GET /api/identity/check?address=<publicSigningAddress>
// Checks if an identity exists in the blockchain

import { NextRequest, NextResponse } from 'next/server';

// Mark as dynamic to exclude from static export
export const dynamic = 'force-dynamic';
import {
  grpcCall,
  parseGrpcResponse,
  buildGetIdentityRequest,
  parseIdentityResponse,
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
    const requestBytes = buildGetIdentityRequest(address);
    const responseBytes = await grpcCall('rpcHush.HushIdentity', 'GetIdentity', requestBytes);
    const messageBytes = parseGrpcResponse(responseBytes);

    if (!messageBytes) {
      return NextResponse.json(
        { error: 'Invalid gRPC response' },
        { status: 502 }
      );
    }

    const identity = parseIdentityResponse(messageBytes);

    return NextResponse.json({
      exists: identity.successful,
      identity: identity.successful ? {
        profileName: identity.profileName,
        publicSigningAddress: identity.publicSigningAddress,
        publicEncryptAddress: identity.publicEncryptAddress,
        isPublic: identity.isPublic,
      } : null,
      message: identity.message,
    });
  } catch (error) {
    console.error('[API] Identity check failed:', error);
    return NextResponse.json(
      { error: 'Failed to check identity' },
      { status: 502 }
    );
  }
}
