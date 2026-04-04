import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as secp256k1 from '@noble/secp256k1';
import { bytesToHex, hexToBytes } from '@/lib/crypto';
import { createElectionQueryAuthHeaders } from '@/lib/grpc/electionQueryAuth';

const fetchMock = vi.fn();
const parseGrpcResponseMock = vi.fn();
const loadMock = vi.fn();
const resolveAllMock = vi.fn();
const lookupTypeMock = vi.fn();
const fromObjectMock = vi.fn((value) => value);
const encodeMock = vi.fn(() => ({
  finish: () => new Uint8Array([1, 2, 3]),
}));
const decodeMock = vi.fn(() => ({ Success: true, ErrorMessage: '', ActorPublicAddress: 'actor-1' }));
const toObjectMock = vi.fn(() => ({
  Success: true,
  ErrorMessage: '',
  ActorPublicAddress: 'actor-1',
}));

class MockRoot {
  resolvePath = vi.fn((origin: string, target: string) => `${origin}:${target}`);
  load = loadMock;
  resolveAll = resolveAllMock;
  lookupType = lookupTypeMock;
}

vi.mock('protobufjs', () => ({
  default: {
    Root: MockRoot,
  },
  Root: MockRoot,
}));

vi.mock('@/lib/grpc/grpc-web-helper', () => ({
  parseGrpcResponse: parseGrpcResponseMock,
}));

const TEST_SIGNING_PRIVATE_KEY =
  '1111111111111111111111111111111111111111111111111111111111111111';
const TEST_ENCRYPTION_PRIVATE_KEY =
  '2222222222222222222222222222222222222222222222222222222222222222';
const TEST_CREDENTIALS = {
  signingPublicKey: bytesToHex(secp256k1.getPublicKey(hexToBytes(TEST_SIGNING_PRIVATE_KEY), true)),
  signingPrivateKey: TEST_SIGNING_PRIVATE_KEY,
  encryptionPublicKey: bytesToHex(
    secp256k1.getPublicKey(hexToBytes(TEST_ENCRYPTION_PRIVATE_KEY), true)
  ),
  encryptionPrivateKey: TEST_ENCRYPTION_PRIVATE_KEY,
};

describe('POST /api/elections/query', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    loadMock.mockResolvedValue(undefined);
    lookupTypeMock.mockReturnValue({
      fromObject: fromObjectMock,
      encode: encodeMock,
      decode: decodeMock,
      toObject: toObjectMock,
    });
    parseGrpcResponseMock.mockReturnValue(new Uint8Array([9, 9, 9]));
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([7, 7, 7]), {
        status: 200,
      })
    );
  });

  it('rejects unsigned actor-bound election queries', async () => {
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost/api/elections/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'GetElectionEnvelopeAccess',
          request: {
            ElectionId: 'election-1',
            ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
          },
        }),
      }) as never
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: 'Election query GetElectionEnvelopeAccess requires signed actor-bound headers.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes through a signed actor-bound election query', async () => {
    const { POST } = await import('./route');
    const signedHeaders = await createElectionQueryAuthHeaders(
      'GetElectionEnvelopeAccess',
      {
        ElectionId: 'election-1',
        ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
      },
      TEST_CREDENTIALS
    );

    const response = await POST(
      new Request('http://localhost/api/elections/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...signedHeaders,
        },
        body: JSON.stringify({
          method: 'GetElectionEnvelopeAccess',
          request: {
            ElectionId: 'election-1',
            ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
          },
        }),
      }) as never
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      Success: true,
      ErrorMessage: '',
      ActorPublicAddress: 'actor-1',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4666/rpcHush.HushElections/GetElectionEnvelopeAccess',
      expect.objectContaining({
        headers: expect.objectContaining(signedHeaders),
      })
    );
  });

  it('passes through a signed actor-bound election directory search', async () => {
    const { POST } = await import('./route');
    const signedHeaders = await createElectionQueryAuthHeaders(
      'SearchElectionDirectory',
      {
        SearchTerm: 'admin',
        OwnerPublicAddresses: ['owner-address'],
        Limit: 12,
        ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
      },
      TEST_CREDENTIALS
    );

    const response = await POST(
      new Request('http://localhost/api/elections/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...signedHeaders,
        },
        body: JSON.stringify({
          method: 'SearchElectionDirectory',
          request: {
            SearchTerm: 'admin',
            OwnerPublicAddresses: ['owner-address'],
            Limit: 12,
            ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
          },
        }),
      }) as never
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4666/rpcHush.HushElections/SearchElectionDirectory',
      expect.objectContaining({
        headers: expect.objectContaining(signedHeaders),
      })
    );
  });

  it('still allows public unsigned election queries', async () => {
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost/api/elections/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method: 'GetElection',
          request: {
            ElectionId: 'election-1',
          },
        }),
      }) as never
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
