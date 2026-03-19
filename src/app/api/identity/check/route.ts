// API Route: GET /api/identity/check?address=<publicSigningAddress>
// Checks if an identity exists in the blockchain

import { NextRequest, NextResponse } from 'next/server';
import { getIdentityProfile } from '@/modules/identity/server/getIdentityProfile';


export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address');

  if (!address) {
    return NextResponse.json(
      { error: 'Missing address parameter' },
      { status: 400 }
    );
  }

  try {
    const identity = await getIdentityProfile(address);

    return NextResponse.json({
      exists: identity.exists,
      identity: identity.exists ? {
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
