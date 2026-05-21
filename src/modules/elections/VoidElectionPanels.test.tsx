import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ElectionLifecycleStateProto,
  ElectionVerificationPackageStatusProto,
  ElectionVerifierOverallStatusProto,
  ElectionVoidPublicationAttemptStatusProto,
} from '@/lib/grpc';
import {
  createElectionRecord,
  createVerificationPackageStatus,
} from './HushVotingWorkspaceTestUtils';
import { OwnerVoidDangerZoneSection } from './VoidElectionPanels';

const { electionsServiceMock } = vi.hoisted(() => ({
  electionsServiceMock: {
    getElectionVerificationPackageStatus: vi.fn(),
  },
}));

vi.mock('@/lib/grpc/services/elections', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/grpc/services/elections')>();
  return {
    ...actual,
    electionsService: {
      ...actual.electionsService,
      getElectionVerificationPackageStatus: (...args: unknown[]) =>
        electionsServiceMock.getElectionVerificationPackageStatus(...args),
    },
  };
});

function createVoidStatus() {
  return createVerificationPackageStatus({
    ElectionId: 'election-void',
    ActorPublicAddress: 'owner-address',
    Status: ElectionVerificationPackageStatusProto.VerificationPackageVoided,
    StatusMessage: 'Election VOID package is sealed.',
    LastVerifierResult: {
      OverallStatus: ElectionVerifierOverallStatusProto.ElectionVerifierWarn,
      VerifierVersion: 'hv-verifier-v1',
      PackageHash: 'void-package-hash',
      PassedCount: 4,
      WarningCount: 1,
      FailedCount: 0,
      NotApplicableCount: 1,
      Message: 'Election is VOID.',
      HasVerifiedAt: false,
      ResultCode: 'election_voided',
    },
    VoidPublicationStatus: {
      VoidDecisionId: 'void-decision-1',
      PublicationAttemptId: 'void-publication-1',
      Status: ElectionVoidPublicationAttemptStatusProto.VoidPublicationGenerationFailed,
      AttemptNumber: 1,
      PublicStatusArtifactRef: 'public/void-status.json',
      VoidPackageArtifactRef: 'public/void-package.zip',
      PackageHash: 'abc123',
      FailureCode: 'package_generation_failed',
      FailureReason: 'Package write failed.',
      AttemptedAt: { seconds: 1_774_120_000, nanos: 0 },
      SealedAt: undefined,
      HasSealedAt: false,
      AttemptedByPublicAddress: 'owner-address',
      CanRetry: true,
      PublicJustification: 'Trustee quorum was lost and finalization cannot continue.',
      PublicJustificationHash: 'justification-hash',
      PreviousLifecycleState: ElectionLifecycleStateProto.Closed,
      ResultingLifecycleState: ElectionLifecycleStateProto.Voided,
      ActorPublicAddress: 'owner-address',
      ActorRole: 'ElectionOwner',
      SourceTransactionId: 'tx-void-1',
      SourceBlockHeight: 42,
      SourceBlockId: 'block-42',
      DecidedAt: { seconds: 1_774_119_900, nanos: 0 },
      HasDecidedAt: true,
    },
  });
}

describe('VoidElectionPanels', () => {
  beforeEach(() => {
    electionsServiceMock.getElectionVerificationPackageStatus.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('requires a public justification and typed VOID before submitting the owner decision', async () => {
    const onVoidElection = vi.fn().mockResolvedValue(true);

    render(
      <OwnerVoidDangerZoneSection
        election={createElectionRecord('election-open', ElectionLifecycleStateProto.Open, 'Open Election', {
          OwnerPublicAddress: 'owner-address',
        })}
        actorPublicAddress="owner-address"
        actorPublicEncryptAddress="owner-encryption"
        actorPrivateEncryptKeyHex="owner-private"
        signingPrivateKeyHex="owner-signing"
        isSubmitting={false}
        onVoidElection={onVoidElection}
        onRetryVoidPublication={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('open-void-dialog-button'));
    expect(screen.getByTestId('void-submit-button')).toBeDisabled();

    fireEvent.change(screen.getByTestId('void-public-justification'), {
      target: {
        value: 'Trustee quorum was lost and finalization cannot continue.',
      },
    });
    fireEvent.change(screen.getByTestId('void-evidence-refs'), {
      target: {
        value: 'anomaly:00000000-0000-4000-8000-000000000000',
      },
    });
    fireEvent.change(screen.getByTestId('void-confirmation'), {
      target: { value: 'VOID' },
    });
    fireEvent.click(screen.getByTestId('void-submit-button'));

    await waitFor(() => expect(onVoidElection).toHaveBeenCalledTimes(1));
    expect(onVoidElection).toHaveBeenCalledWith(
      'Trustee quorum was lost and finalization cannot continue.',
      [
        expect.objectContaining({
          ReferenceKind: 0,
          InternalRecordId: '00000000-0000-4000-8000-000000000000',
          Visibility: 1,
        }),
      ],
      'owner-encryption',
      'owner-private',
      'owner-signing',
    );
  });

  it('shows indexed VOID publication status and retries the same decision', async () => {
    const onRetryVoidPublication = vi.fn().mockResolvedValue(true);
    electionsServiceMock.getElectionVerificationPackageStatus.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      Status: createVoidStatus(),
    });

    render(
      <OwnerVoidDangerZoneSection
        election={createElectionRecord('election-void', ElectionLifecycleStateProto.Voided, 'VOID Election', {
          OwnerPublicAddress: 'owner-address',
        })}
        actorPublicAddress="owner-address"
        actorPublicEncryptAddress="owner-encryption"
        actorPrivateEncryptKeyHex="owner-private"
        signingPrivateKeyHex="owner-signing"
        isSubmitting={false}
        onVoidElection={vi.fn()}
        onRetryVoidPublication={onRetryVoidPublication}
      />
    );

    expect(await screen.findByTestId('void-publication-status-details')).toHaveTextContent(
      'VOID publication failed'
    );
    expect(screen.getByTestId('void-publication-status-details')).toHaveTextContent(
      'Trustee quorum was lost'
    );

    fireEvent.click(screen.getByTestId('retry-void-publication-button'));

    await waitFor(() => expect(onRetryVoidPublication).toHaveBeenCalledTimes(1));
    expect(onRetryVoidPublication).toHaveBeenCalledWith(
      'void-decision-1',
      'owner-encryption',
      'owner-private',
      'owner-signing',
    );
  });
});
