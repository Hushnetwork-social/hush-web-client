import { NextRequest, NextResponse } from 'next/server';
import {
  buildGetMessageByIdRequest,
  grpcCall,
  parseGetMessageByIdResponse,
  parseGrpcResponse,
} from '@/lib/grpc/grpc-web-helper';

export async function GET(request: NextRequest) {
  const feedId = request.nextUrl.searchParams.get('feedId');
  const messageId = request.nextUrl.searchParams.get('messageId');

  if (!feedId) {
    return NextResponse.json({ error: 'Missing feedId parameter' }, { status: 400 });
  }

  if (!messageId) {
    return NextResponse.json({ error: 'Missing messageId parameter' }, { status: 400 });
  }

  try {
    const requestBytes = buildGetMessageByIdRequest(feedId, messageId);
    const responseBytes = await grpcCall('rpcHush.HushFeed', 'GetMessageById', requestBytes);
    const messageBytes = parseGrpcResponse(responseBytes);

    if (!messageBytes) {
      return NextResponse.json({ success: false, error: 'Empty GetMessageById response' }, { status: 502 });
    }

    const response = parseGetMessageByIdResponse(messageBytes);

    return NextResponse.json({
      success: response.success,
      error: response.error,
      message: response.message
        ? {
            feedId: response.message.feedId,
            feedMessageId: response.message.feedMessageId,
            messageContent: response.message.messageContent,
            issuerPublicAddress: response.message.issuerPublicAddress,
            issuerName: response.message.issuerName,
            authorCommitment: response.message.authorCommitment
              ? Buffer.from(response.message.authorCommitment).toString('base64')
              : undefined,
            timestamp: response.message.timestamp?.toISOString() || null,
            blockIndex: response.message.blockIndex,
            replyToMessageId: response.message.replyToMessageId || undefined,
            keyGeneration: response.message.keyGeneration,
            attachments: response.message.attachments,
          }
        : undefined,
    });
  } catch (error) {
    console.error('[API] GetMessageById failed:', error);
    return NextResponse.json({ error: 'Failed to retrieve message by id' }, { status: 502 });
  }
}
