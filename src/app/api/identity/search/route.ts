// API Route: GET /api/identity/search?name=<partialDisplayName>
// Searches for identities by display name

import { NextRequest, NextResponse } from 'next/server';
import {
  grpcCall,
  parseGrpcResponse,
  buildSearchByDisplayNameRequest,
  parseSearchByDisplayNameResponse,
} from '@/lib/grpc/grpc-web-helper';

// Mark as dynamic to exclude from static export
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name');

  if (!name) {
    return NextResponse.json(
      { error: 'Missing name parameter' },
      { status: 400 }
    );
  }

  try {
    const requestBytes = buildSearchByDisplayNameRequest(name);
    const responseBytes = await grpcCall('rpcHush.HushIdentity', 'SearchByDisplayName', requestBytes);
    const messageBytes = parseGrpcResponse(responseBytes);

    if (!messageBytes) {
      // Empty response means no results found
      return NextResponse.json({ identities: [] });
    }

    const identities = parseSearchByDisplayNameResponse(messageBytes);

    return NextResponse.json({
      identities: identities.map((identity) => ({
        displayName: identity.displayName,
        publicSigningAddress: identity.publicSigningAddress,
        publicEncryptAddress: identity.publicEncryptAddress,
      })),
    });
  } catch (error) {
    console.error('[API] Identity search failed:', error);
    return NextResponse.json(
      { error: 'Failed to search identities' },
      { status: 502 }
    );
  }
}
