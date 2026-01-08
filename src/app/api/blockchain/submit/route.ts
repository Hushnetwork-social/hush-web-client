// API Route: POST /api/blockchain/submit
// Submits a signed transaction to the blockchain

import { NextRequest, NextResponse } from 'next/server';
import {
  grpcCall,
  parseGrpcResponse,
  buildSubmitTransactionRequest,
  parseSubmitTransactionResponse,
} from '@/lib/grpc/grpc-web-helper';


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { signedTransaction } = body;

    if (!signedTransaction) {
      return NextResponse.json(
        { error: 'Missing signedTransaction in request body' },
        { status: 400 }
      );
    }

    const requestBytes = buildSubmitTransactionRequest(signedTransaction);
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
    });
  } catch (error) {
    console.error('[API] Transaction submission failed:', error);
    return NextResponse.json(
      { error: 'Failed to submit transaction' },
      { status: 502 }
    );
  }
}
