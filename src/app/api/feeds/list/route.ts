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
    const responseBytes = await grpcCall('rpcHush.HushFeed', 'GetFeedsForAddress', requestBytes);
    const messageBytes = parseGrpcResponse(responseBytes);

    if (!messageBytes) {
      // Empty response is valid - user might have no feeds yet
      return NextResponse.json({ feeds: [] });
    }

    const feeds = parseFeedsResponse(messageBytes);

    console.log(`[API] Found ${feeds.length} feed(s) for address: ${address}`);
    if (feeds.length > 0) {
      console.log('[API] Feed types:', feeds.map(f => `${f.feedTitle}(type=${f.feedType})`).join(', '));
    }

    return NextResponse.json({
      feeds: feeds.map(feed => ({
        feedId: feed.feedId,
        feedTitle: feed.feedTitle,
        feedOwner: feed.feedOwner,
        feedType: feed.feedType,
        blockIndex: feed.blockIndex,
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
