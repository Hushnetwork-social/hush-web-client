import type { Credentials } from '@/types';
import * as secp256k1 from '@noble/secp256k1';
import {
  base64ToBytes,
  bytesToBase64,
  hexToBytes,
  signData,
} from '@/lib/crypto';

const ELECTION_QUERY_AUTH_WINDOW_MS = 10 * 60 * 1000;

export const ELECTION_QUERY_AUTH_HEADERS = {
  signatory: 'x-hush-election-query-signatory',
  signedAt: 'x-hush-election-query-signed-at',
  signature: 'x-hush-election-query-signature',
} as const;

const METHOD_ADDRESS_FIELD = new Map<string, string>([
  ['SearchElectionDirectory', 'ActorPublicAddress'],
  ['GetElectionHubView', 'ActorPublicAddress'],
  ['GetElectionEligibilityView', 'ActorPublicAddress'],
  ['GetElectionVotingView', 'ActorPublicAddress'],
  ['VerifyElectionReceipt', 'ActorPublicAddress'],
  ['GetElectionEnvelopeAccess', 'ActorPublicAddress'],
  ['GetElectionResultView', 'ActorPublicAddress'],
  ['GetElectionReportAccessGrants', 'ActorPublicAddress'],
  ['GetElectionCeremonyActionView', 'ActorPublicAddress'],
  ['GetElectionsByOwner', 'OwnerPublicAddress'],
]);

const OPTIONAL_SIGNED_METHODS = new Set<string>(['GetElection']);

type ElectionQueryRequest = Record<string, unknown>;

export type ElectionQueryAuthFailure = {
  status: number;
  message: string;
};

function normalizeAddress(value: string): string {
  return value.trim();
}

function addressesEqual(left: string, right: string): boolean {
  return normalizeAddress(left).localeCompare(normalizeAddress(right), undefined, {
    sensitivity: 'accent',
  }) === 0;
}

function deepSort(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => deepSort(entry));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort((left, right) => left.localeCompare(right))
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = deepSort((value as Record<string, unknown>)[key]);
        return accumulator;
      }, {});
  }

  return value;
}

function buildSignedPayload(
  method: string,
  actorAddress: string,
  signedAt: string,
  request: ElectionQueryRequest,
): string {
  return JSON.stringify(
    deepSort({
      method,
      actorAddress,
      signedAt,
      request,
    }),
  );
}

export function isSignedElectionQueryMethod(method: string): boolean {
  return METHOD_ADDRESS_FIELD.has(method);
}

export function supportsOptionalElectionQueryAuth(method: string): boolean {
  return OPTIONAL_SIGNED_METHODS.has(method);
}

export function getSignedElectionQueryAddress(
  method: string,
  request: ElectionQueryRequest,
): string | null {
  const addressField = METHOD_ADDRESS_FIELD.get(method);
  if (!addressField) {
    return null;
  }

  const rawValue = request[addressField];
  if (typeof rawValue !== 'string') {
    return null;
  }

  const normalized = normalizeAddress(rawValue);
  return normalized.length > 0 ? normalized : null;
}

export async function createElectionQueryAuthHeaders(
  method: string,
  request: ElectionQueryRequest,
  credentials: Credentials,
): Promise<Record<string, string>> {
  const actorAddress = method === 'GetElection'
    ? normalizeAddress(credentials.signingPublicKey)
    : getSignedElectionQueryAddress(method, request);
  if (!actorAddress) {
    throw new Error(`Election query ${method} requires a bound actor address.`);
  }

  const signatory = normalizeAddress(credentials.signingPublicKey);
  if (!signatory) {
    throw new Error(`Election query ${method} requires the actor signing public key.`);
  }

  if (!addressesEqual(signatory, actorAddress)) {
    throw new Error(`Election query ${method} must be signed by the same actor it targets.`);
  }

  const signedAt = new Date().toISOString();
  const payload = buildSignedPayload(method, actorAddress, signedAt, request);
  const signatureBytes = await signData(
    new TextEncoder().encode(payload),
    hexToBytes(credentials.signingPrivateKey),
  );

  return {
    [ELECTION_QUERY_AUTH_HEADERS.signatory]: signatory,
    [ELECTION_QUERY_AUTH_HEADERS.signedAt]: signedAt,
    [ELECTION_QUERY_AUTH_HEADERS.signature]: bytesToBase64(signatureBytes),
  };
}

export async function validateElectionQueryAuth(
  method: string,
  request: ElectionQueryRequest,
  headers: Headers,
): Promise<ElectionQueryAuthFailure | null> {
  if (!isSignedElectionQueryMethod(method)) {
    return null;
  }

  const actorAddress = getSignedElectionQueryAddress(method, request);
  if (!actorAddress) {
    return {
      status: 400,
      message: `Election query ${method} requires a bound actor address.`,
    };
  }

  const signatory = normalizeAddress(headers.get(ELECTION_QUERY_AUTH_HEADERS.signatory) ?? '');
  const signedAt = headers.get(ELECTION_QUERY_AUTH_HEADERS.signedAt)?.trim() ?? '';
  const signature = headers.get(ELECTION_QUERY_AUTH_HEADERS.signature)?.trim() ?? '';

  if (!signatory || !signedAt || !signature) {
    return {
      status: 401,
      message: `Election query ${method} requires signed actor-bound headers.`,
    };
  }

  if (!addressesEqual(signatory, actorAddress)) {
    return {
      status: 403,
      message: `Election query ${method} actor mismatch.`,
    };
  }

  const signedAtMs = Date.parse(signedAt);
  if (!Number.isFinite(signedAtMs)) {
    return {
      status: 401,
      message: `Election query ${method} contains an invalid signature timestamp.`,
    };
  }

  if (Math.abs(Date.now() - signedAtMs) > ELECTION_QUERY_AUTH_WINDOW_MS) {
    return {
      status: 401,
      message: `Election query ${method} signature is expired.`,
    };
  }

  try {
    const payload = buildSignedPayload(method, actorAddress, signedAt, request);
    const isValid = await secp256k1.verifyAsync(
      base64ToBytes(signature),
      new TextEncoder().encode(payload),
      hexToBytes(signatory),
    );
    if (!isValid) {
      return {
        status: 401,
        message: `Election query ${method} signature is invalid.`,
      };
    }
  } catch {
    return {
      status: 401,
      message: `Election query ${method} signature could not be verified.`,
    };
  }

  return null;
}
