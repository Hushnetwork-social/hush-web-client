import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ElectionAnomalyEvidenceManifestView,
  GetElectionAnomalyEvidenceManifestResponse,
} from '@/lib/grpc';
import { electionsService } from '@/lib/grpc/services/elections';
import { timestamp } from './HushVotingWorkspaceTestUtils';
import { AnomalyEvidenceManifestStatusPanel } from './AnomalyEvidenceManifestStatusPanel';

const { decryptAttachmentPayloadMock } = vi.hoisted(() => ({
  decryptAttachmentPayloadMock: vi.fn(),
}));

vi.mock('@/lib/grpc/services/elections', () => ({
  electionsService: {
    getElectionAnomalyEvidenceManifest: vi.fn(),
    getElectionAnomalyRestrictedPayload: vi.fn(),
  },
}));

vi.mock('./transactionService', () => ({
  decryptElectionAnomalyAttachmentPayload: decryptAttachmentPayloadMock,
}));

const getElectionAnomalyEvidenceManifestMock = vi.mocked(
  electionsService.getElectionAnomalyEvidenceManifest,
);
const getElectionAnomalyRestrictedPayloadMock = vi.mocked(
  electionsService.getElectionAnomalyRestrictedPayload,
);

function createManifest(
  overrides?: Partial<ElectionAnomalyEvidenceManifestView>,
): ElectionAnomalyEvidenceManifestView {
  return {
    ElectionId: 'election-128',
    ScopeId: 'owner',
    CanonicalizationId: 'anomaly-intake-manifest-v1',
    ManifestHash: 'sha256:manifest',
    PackageReadinessStatusId: 'blocked',
    PackageReadinessBlockerIds: ['pending'],
    TotalThreadCount: 1,
    AttachmentManifestCount: 1,
    RedactionCount: 1,
    Threads: [
      {
        AnomalyThreadId: 'thread-1',
        ElectionId: 'election-128',
        CategoryId: 'trustee_continuity',
        CaseStateId: 'under_review',
        CurrentThreadHash: 'sha256:thread',
        GovernedDecisionRef: '',
        HasGovernedDecisionRef: false,
        HasOpenClarificationRequest: true,
        OpenClarificationRequestId: 'clarification-1',
        HasOpenClarificationRequestId: true,
        CreatedAt: timestamp,
        UpdatedAt: timestamp,
        AttachmentManifests: [
          {
            AttachmentManifestId: 'manifest-1',
            AnomalyThreadId: 'thread-1',
            EventId: 'event-1',
            EventHash: 'sha256:event',
            AttachmentKindId: 'clarification_attachment',
            EncryptedPayloadReference: 'restricted-payload-ref-not-for-ui',
            EncryptedPayloadHash: 'sha256:payload',
            ContentHash: 'sha256:content',
            SizeBytes: 438_000,
            MimeType: 'image/png',
            ValidationStatusId: 'accepted',
            ScannerStatusId: 'pending',
            PayloadAvailabilityStatusId: 'available',
            ClarificationRequestId: 'clarification-1',
            HasClarificationRequest: true,
            ActorRoleId: 'submitter-address-not-for-ui',
            RecordedAt: timestamp,
            SourceTransactionId: 'tx-1',
            HasCallerContentKeyWrap: true,
            CallerContentKeyWrap: {
              WrapStatusId: 'available',
              RecipientKeyFingerprint: 'sha256:caller-key',
              EncryptedContentKey: 'caller-wrapped-content-key',
              WrapAlgorithm: 'x25519-aes-gcm',
            },
          },
        ],
        Redactions: [
          {
            RedactionEventId: 'redaction-1',
            AnomalyThreadId: 'thread-1',
            EventId: 'event-redaction-1',
            EventHash: 'sha256:redaction-event',
            TargetKindId: 'attachment_manifest',
            TargetId: 'manifest-1',
            ReasonCodeId: 'privacy',
            OriginalHash: 'sha256:original',
            ReplacementManifestHash: 'sha256:replacement',
            HasReplacementManifestHash: true,
            TombstoneStatusId: 'redacted',
            HasTombstoneStatus: true,
            RecordedAt: timestamp,
            SourceTransactionId: 'tx-redaction-1',
          },
        ],
        RecipientStatuses: [
          {
            RecipientRoleId: 'election_owner',
            WrapStatusId: 'available',
          },
          {
            RecipientRoleId: 'designated_auditor',
            WrapStatusId: 'pending_backfill',
          },
        ],
      },
    ],
    ...overrides,
  };
}

function createResponse(
  overrides?: Partial<GetElectionAnomalyEvidenceManifestResponse>,
  manifestOverrides?: Partial<ElectionAnomalyEvidenceManifestView>,
): GetElectionAnomalyEvidenceManifestResponse {
  return {
    Success: true,
    ErrorMessage: '',
    ActorPublicAddress: 'owner-address',
    HasManifest: true,
    Manifest: createManifest(manifestOverrides),
    ...overrides,
  };
}

describe('AnomalyEvidenceManifestStatusPanel', () => {
  const originalCreateObjectUrl = window.URL.createObjectURL;
  const originalRevokeObjectUrl = window.URL.revokeObjectURL;
  const originalAnchorClick = HTMLAnchorElement.prototype.click;

  beforeEach(() => {
    getElectionAnomalyEvidenceManifestMock.mockResolvedValue(createResponse());
    getElectionAnomalyRestrictedPayloadMock.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      ActorPublicAddress: 'owner-address',
      PayloadReference: 'restricted-payload-ref-not-for-ui',
      EncryptedPayloadBase64: 'AQID',
      EncryptedPayloadHash: 'sha256:payload',
      ContentHash: 'sha256:content',
      SizeBytes: 3,
      MimeType: 'image/png',
      ScannerStatusId: 'clear',
      PayloadAvailabilityStatusId: 'available',
      ValidationCode: '',
    });
    decryptAttachmentPayloadMock.mockResolvedValue(new Uint8Array([1, 2, 3]));
    window.URL.createObjectURL = vi.fn(() => 'blob:restricted-evidence');
    window.URL.revokeObjectURL = vi.fn();
    HTMLAnchorElement.prototype.click = vi.fn();
  });

  afterEach(() => {
    cleanup();
    window.URL.createObjectURL = originalCreateObjectUrl;
    window.URL.revokeObjectURL = originalRevokeObjectUrl;
    HTMLAnchorElement.prototype.click = originalAnchorClick;
    vi.clearAllMocks();
  });

  it('renders selected owner case evidence status without exposing payload references', async () => {
    render(
      <AnomalyEvidenceManifestStatusPanel
        electionId="election-128"
        actorPublicAddress="owner-address"
        scopeId="owner"
        focusThreadId="thread-1"
        title="Selected case evidence manifest"
      />,
    );

    const panel = await screen.findByTestId('anomaly-evidence-manifest-status');

    expect(panel).toHaveTextContent('Selected case evidence manifest');
    expect(panel).toHaveTextContent('Package readiness: blocked');
    expect(panel).toHaveTextContent('pending');
    expect(panel).toHaveTextContent('sha256:content');
    expect(panel).toHaveTextContent('sha256:payload');
    expect(panel).toHaveTextContent('Key: available');
    expect(panel).toHaveTextContent('A redaction records a new event');
    expect(screen.queryByText('restricted-payload-ref-not-for-ui')).not.toBeInTheDocument();
    expect(screen.queryByText('submitter-address-not-for-ui')).not.toBeInTheDocument();
  });

  it('downloads caller-decryptable restricted evidence without rendering references or wraps', async () => {
    render(
      <AnomalyEvidenceManifestStatusPanel
        electionId="election-128"
        actorPublicAddress="owner-address"
        actorPrivateEncryptKeyHex="owner-private-key"
        scopeId="owner"
        focusThreadId="thread-1"
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Decrypt evidence' }));

    await waitFor(() => {
      expect(getElectionAnomalyRestrictedPayloadMock).toHaveBeenCalledWith({
        ElectionId: 'election-128',
        ActorPublicAddress: 'owner-address',
        PayloadReference: 'restricted-payload-ref-not-for-ui',
      });
    });
    await waitFor(() => {
      expect(decryptAttachmentPayloadMock).toHaveBeenCalledWith({
        Attachment: expect.objectContaining({
          AttachmentManifestId: 'manifest-1',
          ContentHash: 'sha256:content',
        }),
        ActorPrivateEncryptKeyHex: 'owner-private-key',
        EncryptedPayloadBase64: 'AQID',
        EncryptedPayloadHash: 'sha256:payload',
        ContentHash: 'sha256:content',
      });
    });

    expect(window.URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('anomaly-evidence-payload-feedback-manifest-1'))
      .toHaveTextContent('Content hash verified');
    expect(screen.queryByText('restricted-payload-ref-not-for-ui')).not.toBeInTheDocument();
    expect(screen.queryByText('caller-wrapped-content-key')).not.toBeInTheDocument();
  });

  it('loads auditor scope and keeps reviewer copy free of submitter identity fields', async () => {
    getElectionAnomalyEvidenceManifestMock.mockResolvedValue(
      createResponse(
        {
          ActorPublicAddress: 'auditor-address',
        },
        {
          ScopeId: 'auditor',
          PackageReadinessStatusId: 'ready',
          PackageReadinessBlockerIds: [],
        },
      ),
    );

    render(
      <AnomalyEvidenceManifestStatusPanel
        electionId="election-128"
        actorPublicAddress="auditor-address"
        scopeId="auditor"
      />,
    );

    expect(await screen.findByText('Auditor manifest review')).toBeInTheDocument();
    expect(screen.getByText(/without submitter actor references/)).toBeInTheDocument();
    expect(screen.queryByText('restricted-payload-ref-not-for-ui')).not.toBeInTheDocument();
    expect(screen.queryByText('submitter-address-not-for-ui')).not.toBeInTheDocument();
    expect(getElectionAnomalyEvidenceManifestMock).toHaveBeenCalledWith({
      ElectionId: 'election-128',
      ActorPublicAddress: 'auditor-address',
      ScopeId: 'auditor',
    });
  });

  it('shows package blocker codes and refreshes package readiness', async () => {
    getElectionAnomalyEvidenceManifestMock.mockResolvedValue(
      createResponse(undefined, {
        ScopeId: 'package',
        PackageReadinessStatusId: 'blocked',
        PackageReadinessBlockerIds: ['manifest_hash_mismatch', 'quarantined'],
      }),
    );

    render(
      <AnomalyEvidenceManifestStatusPanel
        electionId="election-128"
        actorPublicAddress="owner-address"
        scopeId="package"
        testId="package-manifest"
      />,
    );

    expect(await screen.findByTestId('package-manifest-blockers')).toHaveTextContent(
      'manifest_hash_mismatch',
    );
    expect(screen.getByTestId('package-manifest-blockers')).toHaveTextContent('quarantined');

    fireEvent.click(screen.getByTestId('package-manifest-refresh'));

    await waitFor(() => {
      expect(getElectionAnomalyEvidenceManifestMock).toHaveBeenCalledTimes(2);
    });
  });

  it.each([
    ['ready', [], 'Package readiness: ready'],
    ['warning', [], 'Package readiness: warning'],
    ['blocked', ['pending'], 'Package readiness: blocked'],
    ['blocked', ['manifest_hash_mismatch'], 'Package readiness: blocked'],
    ['blocked', ['payload_missing'], 'Package readiness: blocked'],
  ])(
    'renders package readiness edge state %s with blockers %j',
    async (statusId, blockerIds, expectedLabel) => {
      getElectionAnomalyEvidenceManifestMock.mockResolvedValue(
        createResponse(undefined, {
          ScopeId: 'package',
          PackageReadinessStatusId: statusId,
          PackageReadinessBlockerIds: blockerIds,
        }),
      );

      render(
        <AnomalyEvidenceManifestStatusPanel
          electionId="election-128"
          actorPublicAddress="owner-address"
          scopeId="package"
          testId="package-edge-manifest"
        />,
      );

      expect(await screen.findByText(expectedLabel)).toBeInTheDocument();

      if (blockerIds.length > 0) {
        const blockers = screen.getByTestId('package-edge-manifest-blockers');
        blockerIds.forEach((blockerId) => {
          expect(blockers).toHaveTextContent(blockerId);
        });
      } else {
        expect(screen.queryByTestId('package-edge-manifest-blockers')).not.toBeInTheDocument();
      }
    },
  );

  it('does not render counts or manifest rows when the signed query is denied', async () => {
    getElectionAnomalyEvidenceManifestMock.mockResolvedValue({
      Success: false,
      ErrorMessage: 'Restricted anomaly manifest unavailable for this role.',
      ActorPublicAddress: 'voter-address',
      HasManifest: false,
    });

    render(
      <AnomalyEvidenceManifestStatusPanel
        electionId="election-128"
        actorPublicAddress="voter-address"
        scopeId="package"
      />,
    );

    expect(
      await screen.findByText('Restricted anomaly manifest unavailable for this role.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('thread-1')).not.toBeInTheDocument();
    expect(screen.queryByText('sha256:manifest')).not.toBeInTheDocument();
  });

  it('submits owner redaction input and refreshes manifest history', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <AnomalyEvidenceManifestStatusPanel
        electionId="election-128"
        actorPublicAddress="owner-address"
        scopeId="owner"
        focusThreadId="thread-1"
        redactionControls={{
          enabled: true,
          onSubmit,
        }}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Record redaction' }));
    fireEvent.change(screen.getByLabelText('Redaction reason'), {
      target: { value: 'legal_hold' },
    });
    fireEvent.change(screen.getByLabelText('Replacement manifest hash'), {
      target: { value: 'sha256:replacement-next' },
    });
    fireEvent.change(screen.getByLabelText('Operational or legal hold reference'), {
      target: { value: 'hold-ref-42' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit signed redaction event' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        anomalyThreadId: 'thread-1',
        attachmentManifestId: 'manifest-1',
        originalHash: 'sha256:content',
        reasonCodeId: 'legal_hold',
        replacementManifestHash: 'sha256:replacement-next',
        tombstoneStatusId: 'restricted_tombstone',
        holdReference: 'hold-ref-42',
      });
    });
    await waitFor(() => {
      expect(getElectionAnomalyEvidenceManifestMock).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByTestId('anomaly-evidence-manifest-status-redaction-feedback'))
      .toHaveTextContent('Redaction event submitted');
  });
});
