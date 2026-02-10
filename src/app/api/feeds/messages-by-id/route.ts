// API Route: GET /api/feeds/messages-by-id?feedId=<feedId>&userAddress=<address>&beforeBlockIndex=<number>&limit=<number>
// FEAT-059: Retrieves messages for a specific feed with cursor-based backward pagination

import { NextRequest, NextResponse } from 'next/server';
import {
  grpcCall,
  parseGrpcResponse,
  buildGetFeedMessagesByIdRequest,
  parseGetFeedMessagesByIdResponse,
} from '@/lib/grpc/grpc-web-helper';


export async function GET(request: NextRequest) {
  const feedId = request.nextUrl.searchParams.get('feedId');
  const userAddress = request.nextUrl.searchParams.get('userAddress');
  const beforeBlockIndexStr = request.nextUrl.searchParams.get('beforeBlockIndex');
  const limitStr = request.nextUrl.searchParams.get('limit');

  const beforeBlockIndex = beforeBlockIndexStr ? parseInt(beforeBlockIndexStr, 10) : undefined;
  const limit = limitStr ? parseInt(limitStr, 10) : undefined;

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
    const requestBytes = buildGetFeedMessagesByIdRequest(
      feedId,
      userAddress,
      beforeBlockIndex,
      limit
    );
    const responseBytes = await grpcCall(
      'rpcHush.HushFeed',
      'GetFeedMessagesById',
      requestBytes
    );
    const messageBytes = parseGrpcResponse(responseBytes);

    if (!messageBytes) {
      // Empty response is valid - feed might have no messages or user not authorized
      return NextResponse.json({
        messages: [],
        hasMoreMessages: false,
        oldestBlockIndex: 0,
        newestBlockIndex: 0,
      });
    }

    const response = parseGetFeedMessagesByIdResponse(messageBytes);

    return NextResponse.json({
      messages: response.messages.map(msg => ({
        feedId: msg.feedId,
        feedMessageId: msg.feedMessageId,
        messageContent: msg.messageContent,
        issuerPublicAddress: msg.issuerPublicAddress,
        issuerName: msg.issuerName,
        timestamp: msg.timestamp?.toISOString() || null,
        blockIndex: msg.blockIndex,
        replyToMessageId: msg.replyToMessageId || undefined,
        keyGeneration: msg.keyGeneration,
      })),
      hasMoreMessages: response.hasMoreMessages,
      oldestBlockIndex: response.oldestBlockIndex,
      newestBlockIndex: response.newestBlockIndex,
    });
  } catch (error) {
    console.error('[API] GetFeedMessagesById failed:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve messages for feed' },
      { status: 502 }
    );
  }
}
