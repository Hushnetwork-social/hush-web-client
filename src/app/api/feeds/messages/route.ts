// API Route: GET /api/feeds/messages?address=<publicSigningAddress>&blockIndex=<number>
// Retrieves all messages for a user's feeds

import { NextRequest, NextResponse } from 'next/server';

// Mark as dynamic to exclude from static export
export const dynamic = 'force-dynamic';
import {
  grpcCall,
  parseGrpcResponse,
  buildGetFeedMessagesRequest,
  parseFeedMessagesResponse,
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
    const requestBytes = buildGetFeedMessagesRequest(address, blockIndex);
    const responseBytes = await grpcCall(
      'rpcHush.HushFeed',
      'GetFeedMessagesForAddress',
      requestBytes
    );
    const messageBytes = parseGrpcResponse(responseBytes);

    if (!messageBytes) {
      // Empty response is valid - user might have no messages yet
      return NextResponse.json({ messages: [] });
    }

    const messages = parseFeedMessagesResponse(messageBytes);

    return NextResponse.json({
      messages: messages.map(msg => ({
        feedId: msg.feedId,
        feedMessageId: msg.feedMessageId,
        messageContent: msg.messageContent,
        issuerPublicAddress: msg.issuerPublicAddress,
        issuerName: msg.issuerName,
        timestamp: msg.timestamp?.toISOString() || null,
        blockIndex: msg.blockIndex,
      })),
    });
  } catch (error) {
    console.error('[API] Messages retrieval failed:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve messages' },
      { status: 502 }
    );
  }
}
