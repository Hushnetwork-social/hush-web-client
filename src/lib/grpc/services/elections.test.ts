import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as secp256k1 from '@noble/secp256k1';
import { bytesToHex, hexToBytes } from '@/lib/crypto';
import { useAppStore } from '@/stores/useAppStore';

import { electionsService } from './elections';

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

describe('electionsService query proxy', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    useAppStore.setState({ credentials: TEST_CREDENTIALS });
  });

  afterEach(() => {
    useAppStore.setState({ credentials: null });
    vi.unstubAllGlobals();
  });

  it('posts election hub queries to the server-side proxy', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          Success: true,
          ErrorMessage: '',
          ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
          Elections: [],
          HasAnyElectionRoles: false,
          EmptyStateReason: 'No election roles were found for this actor.',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    const response = await electionsService.getElectionHubView({
      ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/elections/query', {
      method: 'POST',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        'x-hush-election-query-signatory': TEST_CREDENTIALS.signingPublicKey,
        'x-hush-election-query-signed-at': expect.any(String),
        'x-hush-election-query-signature': expect.any(String),
      }),
      body: JSON.stringify({
        method: 'GetElectionHubView',
        request: {
          ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
        },
      }),
    });
    expect(response.Success).toBe(true);
    expect(response.ActorPublicAddress).toBe(TEST_CREDENTIALS.signingPublicKey);
  });

  it('posts actor-bound election directory searches to the server-side proxy', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          Success: true,
          ErrorMessage: '',
          SearchTerm: 'admin',
          ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
          Elections: [],
          Entries: [],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    const response = await electionsService.searchElectionDirectory({
      SearchTerm: 'admin',
      OwnerPublicAddresses: ['owner-address'],
      Limit: 12,
      ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/elections/query', {
      method: 'POST',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        'x-hush-election-query-signatory': TEST_CREDENTIALS.signingPublicKey,
        'x-hush-election-query-signed-at': expect.any(String),
        'x-hush-election-query-signature': expect.any(String),
      }),
      body: JSON.stringify({
        method: 'SearchElectionDirectory',
        request: {
          SearchTerm: 'admin',
          OwnerPublicAddresses: ['owner-address'],
          Limit: 12,
          ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
        },
      }),
    });
    expect(response.Success).toBe(true);
    expect(response.ActorPublicAddress).toBe(TEST_CREDENTIALS.signingPublicKey);
  });

  it('includes upstream response details when the proxy returns an error', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response('upstream unavailable', {
        status: 502,
      })
    );

    await expect(
      electionsService.getElectionHubView({
        ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
      })
    ).rejects.toThrow(
      'Election query proxy failed for GetElectionHubView: 502 upstream unavailable'
    );
  });

  it('posts receipt verification queries to the server-side proxy', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          Success: true,
          ErrorMessage: '',
          ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
          ElectionId: 'election-open',
          LifecycleState: 1,
          HasAcceptedCheckoff: true,
          ReceiptMatchesAcceptedCheckoff: true,
          ParticipationCountedAsVoted: true,
          TallyVerificationAvailable: false,
          VerifiedReceiptId: 'receipt-1',
          VerifiedAcceptanceId: 'acceptance-1',
          VerifiedServerProof: 'proof-1',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    const response = await electionsService.verifyElectionReceipt({
      ElectionId: 'election-open',
      ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
      ReceiptId: 'receipt-1',
      AcceptanceId: 'acceptance-1',
      ServerProof: 'proof-1',
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/elections/query', {
      method: 'POST',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        'x-hush-election-query-signatory': TEST_CREDENTIALS.signingPublicKey,
        'x-hush-election-query-signed-at': expect.any(String),
        'x-hush-election-query-signature': expect.any(String),
      }),
      body: JSON.stringify({
        method: 'VerifyElectionReceipt',
        request: {
          ElectionId: 'election-open',
          ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
          ReceiptId: 'receipt-1',
          AcceptanceId: 'acceptance-1',
          ServerProof: 'proof-1',
        },
      }),
    });
    expect(response.Success).toBe(true);
    expect(response.ReceiptMatchesAcceptedCheckoff).toBe(true);
  });

  it('allows unsigned public election reads when no actor credentials are present', async () => {
    const fetchMock = vi.mocked(fetch);
    useAppStore.setState({ credentials: null });
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          Success: true,
          ErrorMessage: '',
          Election: null,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    await electionsService.getElection({
      ElectionId: 'election-public-1',
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/elections/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'GetElection',
        request: {
          ElectionId: 'election-public-1',
        },
      }),
    });
  });

  it('signs getElection when actor credentials are present', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          Success: true,
          ErrorMessage: '',
          Election: null,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    await electionsService.getElection({
      ElectionId: 'election-public-2',
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/elections/query', {
      method: 'POST',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        'x-hush-election-query-signatory': TEST_CREDENTIALS.signingPublicKey,
        'x-hush-election-query-signed-at': expect.any(String),
        'x-hush-election-query-signature': expect.any(String),
      }),
      body: JSON.stringify({
        method: 'GetElection',
        request: {
          ElectionId: 'election-public-2',
        },
      }),
    });
  });
});
