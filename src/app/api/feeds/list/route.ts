// API Route: GET /api/feeds/list?address=<publicSigningAddress>&blockIndex=<number>
// Retrieves all feeds for a user

import { NextRequest, NextResponse } from 'next/server';
import {
  grpcCall,
  parseGrpcResponse,
  buildGetFeedsForAddressRequest,
  parseFeedsResponse,
} from '@/lib/grpc/grpc-web-helper';


export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address');
  const blockIndexStr = request.nextUrl.searchParams.get('blockIndex') || '0';
  const blockIndex = parseInt(blockIndexStr, 10) || 0;

  if (!address) {
    return NextResponse.json(
      { error: 'Missing address parameter' },
      { status: 400 }
    );
  }

  try {
    const requestBytes = buildGetFeedsForAddressRequest(address, blockIndex);
    console.log(`[API] Calling GetFeedsForAddress with address=${address?.substring(0, 20)}, blockIndex=${blockIndex}`);

    const responseBytes = await grpcCall('rpcHush.HushFeed', 'GetFeedsForAddress', requestBytes);
    console.log(`[API] Response received, bytes length: ${responseBytes?.length || 0}`);

    const messageBytes = parseGrpcResponse(responseBytes);
    console.log(`[API] Message bytes length: ${messageBytes?.length || 0}`);

    if (!messageBytes) {
      // Empty response is valid - user might have no feeds yet
      console.log('[API] No message bytes - returning empty feeds');
      return NextResponse.json({ feeds: [] });
    }

    const feeds = parseFeedsResponse(messageBytes);

    console.log(`[API] Found ${feeds.length} feed(s) for address: ${address}`);
    if (feeds.length > 0) {
      console.log('[API] Feeds:', JSON.stringify(feeds.map(f => ({ id: f.feedId, title: f.feedTitle, type: f.feedType, blockIndex: f.blockIndex })), null, 2));
      // [E2E] Log encryptedFeedKey presence for debugging key decryption issues
      feeds.forEach(f => {
        const userParticipant = f.participants?.find(p => p.participantPublicAddress === address);
        console.log(`[E2E Feed API] Feed ${f.feedId?.substring(0, 8)}... (${f.feedTitle}): encryptedFeedKey present = ${!!userParticipant?.encryptedFeedKey}, length = ${userParticipant?.encryptedFeedKey?.length || 0}`);
      });
    }

    return NextResponse.json({
      feeds: feeds.map(feed => ({
        feedId: feed.feedId,
        feedTitle: feed.feedTitle,
        feedOwner: feed.feedOwner,
        feedType: feed.feedType,
        blockIndex: feed.blockIndex,
        // FEAT-051: Include lastReadBlockIndex for cross-device read sync
        lastReadBlockIndex: feed.lastReadBlockIndex ?? 0,
        participants: feed.participants.map(p => ({
          feedId: p.feedId,
          participantPublicAddress: p.participantPublicAddress,
          participantType: p.participantType,
          encryptedFeedKey: p.encryptedFeedKey,
        })),
      })),
    });
  } catch (error) {
    console.error('[API] Feeds retrieval failed:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve feeds' },
      { status: 502 }
    );
  }
}
