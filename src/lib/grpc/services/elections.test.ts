import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { electionsService } from './elections';

describe('electionsService query proxy', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts election hub queries to the server-side proxy', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          Success: true,
          ErrorMessage: '',
          ActorPublicAddress: 'actor-address',
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
      ActorPublicAddress: 'actor-address',
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/elections/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'GetElectionHubView',
        request: {
          ActorPublicAddress: 'actor-address',
        },
      }),
    });
    expect(response.Success).toBe(true);
    expect(response.ActorPublicAddress).toBe('actor-address');
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
        ActorPublicAddress: 'actor-address',
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
          ActorPublicAddress: 'actor-address',
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
      ActorPublicAddress: 'actor-address',
      ReceiptId: 'receipt-1',
      AcceptanceId: 'acceptance-1',
      ServerProof: 'proof-1',
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/elections/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'VerifyElectionReceipt',
        request: {
          ElectionId: 'election-open',
          ActorPublicAddress: 'actor-address',
          ReceiptId: 'receipt-1',
          AcceptanceId: 'acceptance-1',
          ServerProof: 'proof-1',
        },
      }),
    });
    expect(response.Success).toBe(true);
    expect(response.ReceiptMatchesAcceptedCheckoff).toBe(true);
  });
});
