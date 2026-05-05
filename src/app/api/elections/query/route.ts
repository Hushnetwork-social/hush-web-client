import { existsSync } from 'node:fs';
import path from 'node:path';
import protobuf from 'protobufjs';
import { NextRequest, NextResponse } from 'next/server';

import { parseGrpcWebResponse } from '@/lib/grpc/grpc-web-helper';
import {
  ELECTION_QUERY_AUTH_HEADERS,
  validateElectionQueryAuth,
} from '@/lib/grpc/electionQueryAuth';

const SERVICE_NAME = 'rpcHush.HushElections';
const PACKAGE_NAME = 'rpcHush';
const DEFAULT_PUBLIC_GRPC_URL = 'https://api.hushnetwork.social';
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
  'GetElectionVerificationPackageStatus',
  'ExportElectionVerificationPackage',
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

type GrpcUrlCandidate = {
  explicit: boolean;
  url: string;
};

function getGrpcUrlCandidates(forwardedHeaders: Record<string, string>): string[] {
  const candidates = [
    { explicit: true, url: process.env.GRPC_SERVER_URL },
    { explicit: true, url: process.env.NEXT_PUBLIC_GRPC_URL },
    { explicit: false, url: 'http://localhost:4666' },
    { explicit: false, url: DEFAULT_PUBLIC_GRPC_URL },
  ];
  const isSignedForwardedQuery = Object.keys(forwardedHeaders).length > 0;
  const seen = new Set<string>();

  return candidates
    .filter((candidate): candidate is GrpcUrlCandidate & { url: string } => !!candidate.url)
    .map((candidate) => ({
      ...candidate,
      url: candidate.url.trim(),
    }))
    .filter((candidate) => candidate.url.length > 0)
    .filter((candidate) =>
      !isSignedForwardedQuery ||
      candidate.explicit ||
      candidate.url !== DEFAULT_PUBLIC_GRPC_URL
    )
    .filter((candidate) => {
      if (seen.has(candidate.url)) {
        return false;
      }

      seen.add(candidate.url);
      return true;
    })
    .map((candidate) => candidate.url);
}

async function grpcCallWithFallback(
  service: string,
  method: string,
  requestBytes: Uint8Array,
  forwardedHeaders: Record<string, string>
): Promise<{ grpcUrl: string; messageBytes: Uint8Array }> {
  const frame = createGrpcFrame(requestBytes);
  const grpcUrls = getGrpcUrlCandidates(forwardedHeaders);
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
      const parsedResponse = parseGrpcWebResponse(responseBytes);
      const grpcStatus = parsedResponse.trailers['grpc-status'];
      const grpcMessage = parsedResponse.trailers['grpc-message'];

      if (grpcStatus && grpcStatus !== '0') {
        lastError = new Error(
          `gRPC upstream at ${grpcUrl} failed for ${method} with status ${grpcStatus}${grpcMessage ? `: ${decodeURIComponent(grpcMessage)}` : ''}`
        );
        console.warn(
          `[API] Election query proxy upstream gRPC failure at ${grpcUrl} for ${method}: status=${grpcStatus} message=${grpcMessage ?? '(none)'}`
        );
        break;
      }

      if (!parsedResponse.messageBytes && grpcUrls.length > 1) {
        lastError = new Error(`gRPC upstream at ${grpcUrl} returned no payload frame for ${method}`);
        console.warn(`[API] Election query proxy upstream returned no payload at ${grpcUrl} for ${method}`);
        continue;
      }

      if (!parsedResponse.messageBytes) {
        throw new Error(`gRPC upstream at ${grpcUrl} returned no payload frame for ${method}`);
      }

      return {
        grpcUrl,
        messageBytes: parsedResponse.messageBytes,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lastError = new Error(`gRPC upstream at ${grpcUrl} unreachable for ${method}: ${message}`);
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

function resolveFirstExistingPath(label: string, candidates: string[]): string {
  const resolvedCandidates = candidates.map((candidate) => path.resolve(candidate));
  const match = resolvedCandidates.find((candidate) => existsSync(candidate));

  if (!match) {
    throw new Error(`Unable to resolve ${label}. Checked: ${resolvedCandidates.join(', ')}`);
  }

  return match;
}

function getProtoPaths() {
  const workspaceRoot = path.resolve(process.cwd(), '..');
  const webClientProtoRoot = path.join(process.cwd(), 'src', 'lib', 'grpc', 'protos');
  const deployedProtoRoot = path.join(process.cwd(), 'protos');

  return {
    electionsProtoPath: resolveFirstExistingPath('hushElections.proto', [
      path.join(webClientProtoRoot, 'hushElections.proto'),
      path.join(deployedProtoRoot, 'hushElections.proto'),
      path.join(workspaceRoot, 'hush-server-node', 'Protos', 'hushElections.proto'),
    ]),
    timestampProtoPath: resolveFirstExistingPath('google/protobuf/timestamp.proto', [
      path.join(webClientProtoRoot, 'google', 'protobuf', 'timestamp.proto'),
      path.join(deployedProtoRoot, 'google', 'protobuf', 'timestamp.proto'),
    ]),
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
    const { messageBytes } = await grpcCallWithFallback(
      SERVICE_NAME,
      method,
      requestBytes,
      forwardedHeaders
    );

    const decoded = responseType.decode(messageBytes);
    const payload = responseType.toObject(decoded, {
      enums: Number,
      longs: Number,
      bytes: String,
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
