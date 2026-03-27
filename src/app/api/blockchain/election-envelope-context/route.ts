import { NextResponse } from 'next/server';
import { grpcCall, parseGrpcResponse, parseString, parseVarint } from '@/lib/grpc/grpc-web-helper';

function parseElectionEnvelopeContext(messageBytes: Uint8Array): {
  nodePublicEncryptAddress: string;
  electionEnvelopeVersion: string;
} {
  let offset = 0;
  let nodePublicEncryptAddress = '';
  let electionEnvelopeVersion = '';

  while (offset < messageBytes.length) {
    const tagResult = parseVarint(messageBytes, offset);
    offset += tagResult.bytesRead;

    const fieldNumber = tagResult.value >>> 3;
    const wireType = tagResult.value & 0x07;

    if (wireType !== 2) {
      break;
    }

    const lengthResult = parseVarint(messageBytes, offset);
    offset += lengthResult.bytesRead;
    const fieldValue = parseString(messageBytes, offset, lengthResult.value);

    if (fieldNumber === 1) {
      nodePublicEncryptAddress = fieldValue;
    } else if (fieldNumber === 2) {
      electionEnvelopeVersion = fieldValue;
    }

    offset += lengthResult.value;
  }

  return {
    nodePublicEncryptAddress,
    electionEnvelopeVersion,
  };
}

export async function GET() {
  try {
    const responseBytes = await grpcCall(
      'rpcHush.HushBlockchain',
      'GetElectionEnvelopeContext',
      new Uint8Array(),
    );
    const messageBytes = parseGrpcResponse(responseBytes);

    if (!messageBytes) {
      return NextResponse.json({ error: 'Invalid gRPC response' }, { status: 502 });
    }

    const result = parseElectionEnvelopeContext(messageBytes);
    if (!result.nodePublicEncryptAddress || !result.electionEnvelopeVersion) {
      return NextResponse.json({ error: 'Incomplete election envelope context' }, { status: 502 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Failed to fetch election envelope context:', error);
    return NextResponse.json(
      { error: 'Failed to fetch election envelope context' },
      { status: 502 },
    );
  }
}
