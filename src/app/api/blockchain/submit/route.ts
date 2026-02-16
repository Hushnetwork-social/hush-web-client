// API Route: POST /api/blockchain/submit
// Submits a signed transaction to the blockchain

import { NextRequest, NextResponse } from 'next/server';
import {
  grpcCall,
  parseGrpcResponse,
  buildSubmitTransactionRequest,
  parseSubmitTransactionResponse,
  type SubmitAttachmentBlob,
} from '@/lib/grpc/grpc-web-helper';


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { signedTransaction, attachments: rawAttachments } = body;

    if (!signedTransaction) {
      return NextResponse.json(
        { error: 'Missing signedTransaction in request body' },
        { status: 400 }
      );
    }

    // FEAT-067: Decode base64 attachment blobs if present
    let attachments: SubmitAttachmentBlob[] | undefined;
    if (Array.isArray(rawAttachments) && rawAttachments.length > 0) {
      attachments = rawAttachments.map((att: { attachmentId: string; encryptedOriginal: string; encryptedThumbnail?: string }) => ({
        attachmentId: att.attachmentId,
        encryptedOriginal: Uint8Array.from(Buffer.from(att.encryptedOriginal, 'base64')),
        encryptedThumbnail: att.encryptedThumbnail
          ? Uint8Array.from(Buffer.from(att.encryptedThumbnail, 'base64'))
          : null,
      }));
    }

    const requestBytes = buildSubmitTransactionRequest(signedTransaction, attachments);
    const responseBytes = await grpcCall(
      'rpcHush.HushBlockchain',
      'SubmitSignedTransaction',
      requestBytes
    );
    const messageBytes = parseGrpcResponse(responseBytes);

    if (!messageBytes) {
      return NextResponse.json(
        { error: 'Invalid gRPC response' },
        { status: 502 }
      );
    }

    const result = parseSubmitTransactionResponse(messageBytes);

    return NextResponse.json({
      successful: result.successful,
      message: result.message,
      status: result.status,  // FEAT-057: Include transaction status for idempotency
    });
  } catch (error) {
    console.error('[API] Transaction submission failed:', error);
    return NextResponse.json(
      { error: 'Failed to submit transaction' },
      { status: 502 }
    );
  }
}
