import path from 'node:path';
import protobuf from 'protobufjs';
import { NextRequest, NextResponse } from 'next/server';

import { parseGrpcResponse } from '@/lib/grpc/grpc-web-helper';
import {
  ELECTION_QUERY_AUTH_HEADERS,
  validateElectionQueryAuth,
} from '@/lib/grpc/electionQueryAuth';

const SERVICE_NAME = 'rpcHush.HushElections';
const PACKAGE_NAME = 'rpcHush';
const ALLOWED_METHODS = new Set([
  'GetElectionOpenReadiness',
  'GetElection',
  'SearchElectionDirectory',
  'GetElectionHubView',
  'GetElectionEligibilityView',
  'GetElectionVotingView',
  'VerifyElectionReceipt',
  'GetElectionEnvelopeAccess',
  'GetElectionResultView',
  'GetElectionReportAccessGrants',
  'GetElectionCeremonyActionView',
  'GetElectionsByOwner',
]);

let electionsRootPromise: Promise<protobuf.Root> | null = null;

function createGrpcFrame(messageBytes: Uint8Array): Uint8Array {
  const frame = new Uint8Array(5 + messageBytes.length);
  frame[0] = 0;
  frame[1] = (messageBytes.length >> 24) & 0xff;
  frame[2] = (messageBytes.length >> 16) & 0xff;
  frame[3] = (messageBytes.length >> 8) & 0xff;
  frame[4] = messageBytes.length & 0xff;
  frame.set(messageBytes, 5);
  return frame;
}

function getGrpcUrlCandidates(): string[] {
  const candidates = [
    process.env.GRPC_SERVER_URL,
    process.env.NEXT_PUBLIC_GRPC_URL,
    'http://localhost:4666',
    'https://api.hushnetwork.social',
  ];

  return candidates
    .filter((value): value is string => !!value)
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .filter((value, index, values) => values.indexOf(value) === index);
}

async function grpcCallWithFallback(
  service: string,
  method: string,
  requestBytes: Uint8Array,
  forwardedHeaders: Record<string, string>
): Promise<{ responseBytes: Uint8Array; grpcUrl: string }> {
  const frame = createGrpcFrame(requestBytes);
  const grpcUrls = getGrpcUrlCandidates();
  let lastError: Error | null = null;

  for (const grpcUrl of grpcUrls) {
    const url = `${grpcUrl}/${service}/${method}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/grpc-web+proto',
          'Accept': 'application/grpc-web+proto, application/grpc-web',
          'X-Grpc-Web': '1',
          ...forwardedHeaders,
        },
        body: Buffer.from(frame),
      });

      if (!response.ok) {
        lastError = new Error(`gRPC call failed at ${grpcUrl}: ${response.status} ${response.statusText}`);
        console.warn(`[API] Election query proxy upstream failed at ${grpcUrl}: ${response.status} ${response.statusText}`);
        continue;
      }

      const responseBytes = new Uint8Array(await response.arrayBuffer());
      if (!parseGrpcResponse(responseBytes) && grpcUrls.length > 1) {
        lastError = new Error(`gRPC upstream at ${grpcUrl} returned no payload frame for ${method}`);
        console.warn(`[API] Election query proxy upstream returned no payload at ${grpcUrl} for ${method}`);
        continue;
      }

      return { responseBytes, grpcUrl };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[API] Election query proxy upstream unreachable at ${grpcUrl}:`, lastError);
    }
  }

  throw lastError ?? new Error(`No gRPC endpoints were available for ${service}/${method}`);
}

function getForwardedElectionQueryHeaders(headers: Headers): Record<string, string> {
  const forwarded: Record<string, string> = {};
  for (const headerName of Object.values(ELECTION_QUERY_AUTH_HEADERS)) {
    const value = headers.get(headerName)?.trim();
    if (value) {
      forwarded[headerName] = value;
    }
  }

  return forwarded;
}

function getProtoPaths() {
  const workspaceRoot = path.resolve(process.cwd(), '..');
  return {
    electionsProtoPath: path.join(workspaceRoot, 'hush-server-node', 'Protos', 'hushElections.proto'),
    timestampProtoPath: path.join(
      process.cwd(),
      'src',
      'lib',
      'grpc',
      'protos',
      'google',
      'protobuf',
      'timestamp.proto'
    ),
  };
}

async function getElectionsRoot(): Promise<protobuf.Root> {
  if (!electionsRootPromise) {
    electionsRootPromise = (async () => {
      const { electionsProtoPath, timestampProtoPath } = getProtoPaths();
      const root = new protobuf.Root();
      root.resolvePath = (origin, target) => {
        if (target === 'google/protobuf/timestamp.proto') {
          return timestampProtoPath;
        }

        return path.resolve(path.dirname(origin), target);
      };

      await root.load(electionsProtoPath, { keepCase: true });
      root.resolveAll();
      return root;
    })();
  }

  return electionsRootPromise;
}

function getRequestTypeName(method: string): string {
  return `${PACKAGE_NAME}.${method}Request`;
}

function getResponseTypeName(method: string): string {
  return `${PACKAGE_NAME}.${method}Response`;
}

type QueryRequestBody = {
  method?: string;
  request?: Record<string, unknown>;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as QueryRequestBody;
    const method = body.method?.trim() ?? '';

    if (!ALLOWED_METHODS.has(method)) {
      return NextResponse.json(
        { success: false, message: `Unsupported election query method '${method}'` },
        { status: 400 }
      );
    }

    const authFailure = await validateElectionQueryAuth(method, body.request ?? {}, request.headers);
    if (authFailure) {
      return NextResponse.json(
        { success: false, message: authFailure.message },
        { status: authFailure.status }
      );
    }

    const root = await getElectionsRoot();
    const requestType = root.lookupType(getRequestTypeName(method));
    const responseType = root.lookupType(getResponseTypeName(method));

    const requestMessage = requestType.fromObject(body.request ?? {});
    const requestBytes = requestType.encode(requestMessage).finish();
    const forwardedHeaders = getForwardedElectionQueryHeaders(request.headers);
    const { responseBytes, grpcUrl } = await grpcCallWithFallback(
      SERVICE_NAME,
      method,
      requestBytes,
      forwardedHeaders
    );
    const messageBytes = parseGrpcResponse(responseBytes);

    if (!messageBytes) {
      return NextResponse.json(
        {
          success: false,
          message: `No gRPC payload returned for ${method} from ${grpcUrl}`,
        },
        { status: 502 }
      );
    }

    const decoded = responseType.decode(messageBytes);
    const payload = responseType.toObject(decoded, {
      enums: Number,
      longs: Number,
      defaults: true,
      arrays: true,
      objects: true,
      oneofs: true,
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error('[API] Election query proxy failed:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Election query proxy failed',
      },
      { status: 502 }
    );
  }
}
