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
import {
  WEBCLIENT_DEPLOYMENT_PROOF_COMPONENT_ID,
  WEBCLIENT_DEPLOYMENT_PROOF_SCHEMA_VERSION,
  WEBCLIENT_DEPLOYMENT_PROTOCOL_VERSION,
  normalizeWebClientDeploymentProofMetadata,
  type WebClientDeploymentProofObservation,
} from '@/lib/deploymentProof/webClientDeploymentProofContract';


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

    const webClientDeploymentProof = resolveSubmitWebClientDeploymentProofObservation(
      body.webClientDeploymentProof
    );
    const requestBytes = buildSubmitTransactionRequest(
      signedTransaction,
      attachments,
      webClientDeploymentProof
    );
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
      validationCode: result.validationCode,
    });
  } catch (error) {
    console.error('[API] Transaction submission failed:', error);
    const isWebClientProofValidationError =
      error instanceof Error && error.message.startsWith('webclient_proof_');

    return NextResponse.json(
      { error: isWebClientProofValidationError ? error.message : 'Failed to submit transaction' },
      { status: isWebClientProofValidationError ? 400 : 502 }
    );
  }
}

function resolveSubmitWebClientDeploymentProofObservation(
  value: unknown
): WebClientDeploymentProofObservation {
  if (!value) {
    return {
      schemaVersion: WEBCLIENT_DEPLOYMENT_PROOF_SCHEMA_VERSION,
      componentId: WEBCLIENT_DEPLOYMENT_PROOF_COMPONENT_ID,
      deploymentProtocolVersion: WEBCLIENT_DEPLOYMENT_PROTOCOL_VERSION,
      evidenceStatus: 'missing',
      observationScope: 'submit_transaction',
    };
  }

  const normalized = normalizeWebClientDeploymentProofMetadata(value);
  if (!normalized.ok) {
    throw new Error(`${normalized.code}: ${normalized.message}`);
  }

  return {
    ...normalized.metadata,
    observationScope: 'submit_transaction',
  };
}
