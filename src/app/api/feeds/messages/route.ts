// API Route: GET /api/feeds/messages?address=<publicSigningAddress>&blockIndex=<number>&lastReactionTallyVersion=<number>
// Retrieves all messages for a user's feeds, including reaction tallies (Protocol Omega)

import { NextRequest, NextResponse } from 'next/server';
import {
  grpcCall,
  parseGrpcResponse,
  buildGetFeedMessagesRequest,
  parseFeedMessagesWithTalliesResponse,
} from '@/lib/grpc/grpc-web-helper';


export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address');
  const blockIndexStr = request.nextUrl.searchParams.get('blockIndex') || '0';
  const lastReactionTallyVersionStr = request.nextUrl.searchParams.get('lastReactionTallyVersion') || '0';

  const blockIndex = parseInt(blockIndexStr, 10) || 0;
  const lastReactionTallyVersion = parseInt(lastReactionTallyVersionStr, 10) || 0;

  if (!address) {
    return NextResponse.json(
      { error: 'Missing address parameter' },
      { status: 400 }
    );
  }

  try {
    const requestBytes = buildGetFeedMessagesRequest(address, blockIndex, lastReactionTallyVersion);
    const responseBytes = await grpcCall(
      'rpcHush.HushFeed',
      'GetFeedMessagesForAddress',
      requestBytes
    );
    const messageBytes = parseGrpcResponse(responseBytes);

    if (!messageBytes) {
      // Empty response is valid - user might have no messages yet
      return NextResponse.json({
        messages: [],
        reactionTallies: [],
        maxReactionTallyVersion: lastReactionTallyVersion,
      });
    }

    const response = parseFeedMessagesWithTalliesResponse(messageBytes);

    return NextResponse.json({
      messages: response.messages.map(msg => ({
        feedId: msg.feedId,
        feedMessageId: msg.feedMessageId,
        messageContent: msg.messageContent,
        issuerPublicAddress: msg.issuerPublicAddress,
        issuerName: msg.issuerName,
        timestamp: msg.timestamp?.toISOString() || null,
        blockIndex: msg.blockIndex,
        replyToMessageId: msg.replyToMessageId || undefined,  // Reply to Message: include parent reference
        keyGeneration: msg.keyGeneration,  // Group Feeds: key generation for O(1) decryption
      })),
      // Protocol Omega: Include reaction tallies
      reactionTallies: response.reactionTallies.map(tally => ({
        messageId: tally.messageId,
        tallyC1: tally.tallyC1.map(p => ({
          x: Buffer.from(p.x).toString('base64'),
          y: Buffer.from(p.y).toString('base64'),
        })),
        tallyC2: tally.tallyC2.map(p => ({
          x: Buffer.from(p.x).toString('base64'),
          y: Buffer.from(p.y).toString('base64'),
        })),
        tallyVersion: tally.tallyVersion,
        reactionCount: tally.reactionCount,
      })),
      maxReactionTallyVersion: response.maxReactionTallyVersion,
    });
  } catch (error) {
    console.error('[API] Messages retrieval failed:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve messages' },
      { status: 502 }
    );
  }
}
