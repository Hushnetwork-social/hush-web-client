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

  it('posts verification package status queries to the server-side proxy', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          Success: true,
          ErrorMessage: '',
          ElectionId: 'election-finalized',
          ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
          Status: {
            ElectionId: 'election-finalized',
            ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
            IsVisible: true,
            Status: 5,
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    const response = await electionsService.getElectionVerificationPackageStatus({
      ElectionId: 'election-finalized',
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
        method: 'GetElectionVerificationPackageStatus',
        request: {
          ElectionId: 'election-finalized',
          ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
        },
      }),
    });
    expect(response.Success).toBe(true);
    expect(response.Status?.IsVisible).toBe(true);
  });

  it('posts trustee anomaly aggregate queries to the server-side proxy', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          Success: true,
          ErrorMessage: '',
          ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
          HasCounts: true,
          Counts: {
            ElectionId: 'election-trustee',
            TotalThreadCount: 2,
            CategoryCounts: [],
            CaseStateCounts: [],
            ContinuitySummary: {
              TrusteeContinuityThreadCount: 1,
              OpenContinuityThreadCount: 1,
              AwaitingInformationContinuityThreadCount: 0,
              ClosedContinuityThreadCount: 0,
              GovernedDecisionLinkedCount: 0,
              HasContinuityIssue: true,
            },
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    const response = await electionsService.getElectionAnomalyTrusteeCounts({
      ElectionId: 'election-trustee',
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
        method: 'GetElectionAnomalyTrusteeCounts',
        request: {
          ElectionId: 'election-trustee',
          ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
        },
      }),
    });
    expect(response.Success).toBe(true);
    expect(response.Counts?.ContinuitySummary?.HasContinuityIssue).toBe(true);
  });

  it('posts auditor anomaly restricted review queries to the server-side proxy', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          Success: true,
          ErrorMessage: '',
          ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
          HasReview: true,
          Review: {
            ElectionId: 'election-auditor',
            TotalThreadCount: 1,
            DecryptableMessageCount: 1,
            PendingRewrapMessageCount: 0,
            MissingWrapMessageCount: 0,
            AttachmentManifestCount: 0,
            Threads: [],
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    const response = await electionsService.getElectionAnomalyAuditorRestrictedReview({
      ElectionId: 'election-auditor',
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
        method: 'GetElectionAnomalyAuditorRestrictedReview',
        request: {
          ElectionId: 'election-auditor',
          ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
        },
      }),
    });
    expect(response.Success).toBe(true);
    expect(response.Review?.DecryptableMessageCount).toBe(1);
  });

  it('posts owner anomaly triage queries to the server-side proxy', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          Success: true,
          ErrorMessage: '',
          ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
          HasTriage: true,
          Triage: {
            ElectionId: 'election-owner',
            TotalThreadCount: 1,
            OpenThreadCount: 1,
            AwaitingInformationThreadCount: 0,
            ResponsePresentThreadCount: 0,
            ExternalClaimantThreadCount: 0,
            DecryptableMessageCount: 1,
            PendingRewrapMessageCount: 0,
            MissingOwnerWrapMessageCount: 0,
            AttachmentManifestCount: 0,
            GovernedContinuityHandoffStatusId: 'continuity_normal',
            CategoryCounts: [],
            CaseStateCounts: [],
            Threads: [],
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    const response = await electionsService.getElectionAnomalyOwnerTriage({
      ElectionId: 'election-owner',
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
        method: 'GetElectionAnomalyOwnerTriage',
        request: {
          ElectionId: 'election-owner',
          ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
        },
      }),
    });
    expect(response.Success).toBe(true);
    expect(response.Triage?.DecryptableMessageCount).toBe(1);
  });

  it('posts anomaly evidence manifest queries to the server-side proxy', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          Success: true,
          ErrorMessage: '',
          ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
          HasManifest: true,
          Manifest: {
            ElectionId: 'election-owner',
            ScopeId: 'owner',
            CanonicalizationId: 'anomaly-intake-manifest-v1',
            ManifestHash: `sha256:${'a'.repeat(64)}`,
            PackageReadinessStatusId: 'ready',
            PackageReadinessBlockerIds: [],
            TotalThreadCount: 1,
            AttachmentManifestCount: 1,
            RedactionCount: 0,
            Threads: [],
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    const response = await electionsService.getElectionAnomalyEvidenceManifest({
      ElectionId: 'election-owner',
      ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
      ScopeId: 'owner',
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
        method: 'GetElectionAnomalyEvidenceManifest',
        request: {
          ElectionId: 'election-owner',
          ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
          ScopeId: 'owner',
        },
      }),
    });
    expect(response.Success).toBe(true);
    expect(response.Manifest?.ManifestHash).toBe(`sha256:${'a'.repeat(64)}`);
  });

  it.each(['auditor', 'package'] as const)(
    'posts %s anomaly evidence manifest scope queries to the server-side proxy',
    async (scopeId) => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            Success: true,
            ErrorMessage: '',
            ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
            HasManifest: true,
            Manifest: {
              ElectionId: 'election-owner',
              ScopeId: scopeId,
              CanonicalizationId: 'anomaly-intake-manifest-v1',
              ManifestHash: `sha256:${scopeId}`,
              PackageReadinessStatusId: scopeId === 'package' ? 'blocked' : 'ready',
              PackageReadinessBlockerIds: scopeId === 'package' ? ['payload_missing'] : [],
              TotalThreadCount: 0,
              AttachmentManifestCount: 0,
              RedactionCount: 0,
              Threads: [],
            },
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )
      );

      const response = await electionsService.getElectionAnomalyEvidenceManifest({
        ElectionId: 'election-owner',
        ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
        ScopeId: scopeId,
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
          method: 'GetElectionAnomalyEvidenceManifest',
          request: {
            ElectionId: 'election-owner',
            ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
            ScopeId: scopeId,
          },
        }),
      });
      expect(response.Manifest?.ScopeId).toBe(scopeId);
    }
  );

  it('returns denied anomaly evidence manifest responses without exposing manifest rows', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          Success: false,
          ErrorMessage: 'Restricted anomaly manifest unavailable for this role.',
          ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
          HasManifest: false,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    const response = await electionsService.getElectionAnomalyEvidenceManifest({
      ElectionId: 'election-owner',
      ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
      ScopeId: 'package',
    });

    expect(response.Success).toBe(false);
    expect(response.HasManifest).toBe(false);
    expect(response.Manifest).toBeUndefined();
    expect(response.ErrorMessage).toBe('Restricted anomaly manifest unavailable for this role.');
  });

  it('throws when the anomaly evidence manifest proxy rejects the signed query', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response('signature rejected', {
        status: 403,
      })
    );

    await expect(
      electionsService.getElectionAnomalyEvidenceManifest({
        ElectionId: 'election-owner',
        ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
        ScopeId: 'owner',
      })
    ).rejects.toThrow(
      'Election query proxy failed for GetElectionAnomalyEvidenceManifest: 403 signature rejected'
    );
  });

  it('posts restricted anomaly payload staging requests to the signed proxy', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          Success: true,
          ErrorMessage: '',
          ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
          PayloadReference: 'hush-election-anomaly-payload-v1:33333333-3333-3333-3333-333333333333',
          EncryptedPayloadHash: `sha256:${'a'.repeat(64)}`,
          ContentHash: `sha256:${'b'.repeat(64)}`,
          SizeBytes: 256,
          MimeType: 'image/png',
          ScannerStatusId: 'pending',
          PayloadAvailabilityStatusId: 'available',
          ValidationCode: '',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    const request = {
      ElectionId: 'election-owner',
      ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
      AnomalyThreadId: '22222222-2222-2222-2222-222222222222',
      AttachmentKindId: 'authority_requested_evidence',
      EncryptedPayloadBase64: 'AQIDBA==',
      EncryptedPayloadHash: `sha256:${'a'.repeat(64)}`,
      ContentHash: `sha256:${'b'.repeat(64)}`,
      SizeBytes: 256,
      MimeType: 'image/png',
      ClarificationRequestId: '11111111-1111-1111-1111-111111111111',
    };

    const response = await electionsService.stageElectionAnomalyRestrictedPayload(request);

    expect(fetchMock).toHaveBeenCalledWith('/api/elections/query', {
      method: 'POST',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        'x-hush-election-query-signatory': TEST_CREDENTIALS.signingPublicKey,
        'x-hush-election-query-signed-at': expect.any(String),
        'x-hush-election-query-signature': expect.any(String),
      }),
      body: JSON.stringify({
        method: 'StageElectionAnomalyRestrictedPayload',
        request,
      }),
    });
    expect(response.Success).toBe(true);
    expect(response.PayloadReference).toMatch(/^hush-election-anomaly-payload-v1:/);
  });

  it('posts restricted anomaly payload retrieval requests to the signed proxy', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          Success: true,
          ErrorMessage: '',
          ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
          PayloadReference: 'hush-election-anomaly-payload-v1:33333333-3333-3333-3333-333333333333',
          EncryptedPayloadBase64: 'AQIDBA==',
          EncryptedPayloadHash: `sha256:${'a'.repeat(64)}`,
          ContentHash: `sha256:${'b'.repeat(64)}`,
          SizeBytes: 256,
          MimeType: 'image/png',
          ScannerStatusId: 'pending',
          PayloadAvailabilityStatusId: 'available',
          ValidationCode: '',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    const request = {
      ElectionId: 'election-owner',
      ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
      PayloadReference: 'hush-election-anomaly-payload-v1:33333333-3333-3333-3333-333333333333',
    };

    const response = await electionsService.getElectionAnomalyRestrictedPayload(request);

    expect(fetchMock).toHaveBeenCalledWith('/api/elections/query', {
      method: 'POST',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        'x-hush-election-query-signatory': TEST_CREDENTIALS.signingPublicKey,
        'x-hush-election-query-signed-at': expect.any(String),
        'x-hush-election-query-signature': expect.any(String),
      }),
      body: JSON.stringify({
        method: 'GetElectionAnomalyRestrictedPayload',
        request,
      }),
    });
    expect(response.Success).toBe(true);
    expect(response.EncryptedPayloadBase64).toBe('AQIDBA==');
  });

  it('posts verification package export queries to the server-side proxy', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          Success: true,
          ErrorMessage: '',
          ElectionId: 'election-finalized',
          ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
          PackageView: 0,
          Blocker: 0,
          ResultCode: '',
          PackageId: 'HushElectionPackage-election-finalized',
          PackageHash: 'a'.repeat(64),
          Files: [],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );

    const response = await electionsService.exportElectionVerificationPackage({
      ElectionId: 'election-finalized',
      ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
      PackageView: 0,
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
        method: 'ExportElectionVerificationPackage',
        request: {
          ElectionId: 'election-finalized',
          ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
          PackageView: 0,
        },
      }),
    });
    expect(response.Success).toBe(true);
    expect(response.PackageHash).toBe('a'.repeat(64));
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
