import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ElectionFinalizationReleaseEvidence,
  ElectionFinalizationSession,
  ElectionFinalizationShare,
  ElectionRecordView,
  GetElectionResponse,
} from '@/lib/grpc';
import {
  ElectionBindingStatusProto,
  ElectionClassProto,
  ElectionDisclosureModeProto,
  ElectionFinalizationReleaseModeProto,
  ElectionFinalizationSessionPurposeProto,
  ElectionFinalizationSessionStatusProto,
  ElectionFinalizationShareStatusProto,
  ElectionFinalizationTargetTypeProto,
  ElectionGovernanceModeProto,
  ElectionLifecycleStateProto,
  EligibilityMutationPolicyProto,
  EligibilitySourceTypeProto,
  OutcomeRuleKindProto,
  ParticipationPrivacyModeProto,
  ReportingPolicyProto,
  ReviewWindowPolicyProto,
  VoteUpdatePolicyProto,
} from '@/lib/grpc';
import { TrusteeElectionFinalizationPanel } from './TrusteeElectionFinalizationPanel';
import { useElectionsStore } from './useElectionsStore';

const { electionsServiceMock, blockchainServiceMock, transactionServiceMock } = vi.hoisted(() => ({
  electionsServiceMock: {
    getElection: vi.fn(),
  },
  blockchainServiceMock: {
    submitTransaction: vi.fn(),
  },
  transactionServiceMock: {
    createSubmitElectionFinalizationShareTransaction: vi.fn(),
  },
}));

vi.mock('@/lib/grpc/services/elections', () => ({
  electionsService: electionsServiceMock,
}));

vi.mock('@/modules/blockchain/BlockchainService', () => ({
  submitTransaction: (...args: unknown[]) => blockchainServiceMock.submitTransaction(...args),
}));

vi.mock('./transactionService', () => ({
  createSubmitElectionFinalizationShareTransaction: (...args: unknown[]) =>
    transactionServiceMock.createSubmitElectionFinalizationShareTransaction(...args),
}));

const timestamp = { seconds: 1_711_410_000, nanos: 0 };

function createElectionRecord(overrides?: Partial<ElectionRecordView>): ElectionRecordView {
  return {
    ElectionId: 'election-1',
    Title: 'Governed Referendum',
    ShortDescription: 'Policy vote',
    OwnerPublicAddress: 'owner-public-key',
    ExternalReferenceCode: 'REF-2026-01',
    LifecycleState: ElectionLifecycleStateProto.Closed,
    ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
    BindingStatus: ElectionBindingStatusProto.Binding,
    GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
    DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
    ParticipationPrivacyMode:
      ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
    VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
    EligibilitySourceType: EligibilitySourceTypeProto.OrganizationImportedRoster,
    EligibilityMutationPolicy: EligibilityMutationPolicyProto.FrozenAtOpen,
    OutcomeRule: {
      Kind: OutcomeRuleKindProto.PassFail,
      TemplateKey: 'pass_fail_yes_no',
      SeatCount: 1,
      BlankVoteCountsForTurnout: true,
      BlankVoteExcludedFromWinnerSelection: true,
      BlankVoteExcludedFromThresholdDenominator: true,
      TieResolutionRule: 'tie_unresolved',
      CalculationBasis: 'simple_majority_of_non_blank_votes',
    },
    ApprovedClientApplications: [{ ApplicationId: 'hushsocial', Version: '1.0.0' }],
    ProtocolOmegaVersion: 'omega-v1.0.0',
    ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
    ReviewWindowPolicy: ReviewWindowPolicyProto.GovernedReviewWindowReserved,
    CurrentDraftRevision: 1,
    Options: [
      {
        OptionId: 'yes',
        DisplayLabel: 'Yes',
        ShortDescription: '',
        BallotOrder: 1,
        IsBlankOption: false,
      },
      {
        OptionId: 'no',
        DisplayLabel: 'No',
        ShortDescription: '',
        BallotOrder: 2,
        IsBlankOption: false,
      },
    ],
    AcknowledgedWarningCodes: [],
    RequiredApprovalCount: 2,
    CreatedAt: timestamp,
    LastUpdatedAt: timestamp,
    OpenedAt: timestamp,
    ClosedAt: timestamp,
    OpenArtifactId: 'open-artifact',
    CloseArtifactId: 'close-artifact',
    FinalizeArtifactId: '',
    ...overrides,
  };
}

function createFinalizationSession(
  overrides?: Partial<ElectionFinalizationSession>
): ElectionFinalizationSession {
  return {
    Id: 'finalization-session-1',
    ElectionId: 'election-1',
    GovernedProposalId: 'proposal-finalize-1',
    GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
    SessionPurpose: ElectionFinalizationSessionPurposeProto.FinalizationSessionPurposeFinalize,
    CloseArtifactId: 'close-artifact',
    AcceptedBallotSetHash: 'accepted-ballot-set-hash',
    FinalEncryptedTallyHash: 'final-encrypted-tally-hash',
    TargetTallyId: 'aggregate-tally-1',
    CeremonySnapshot: {
      CeremonyVersionId: 'ceremony-version-1',
      VersionNumber: 4,
      ProfileId: 'prod-3of5-v1',
      TrusteeCount: 3,
      RequiredApprovalCount: 2,
      CompletedTrustees: [
        {
          TrusteeUserAddress: 'trustee-a',
          TrusteeDisplayName: 'Alice Trustee',
        },
        {
          TrusteeUserAddress: 'trustee-b',
          TrusteeDisplayName: 'Bob Trustee',
        },
      ],
      TallyPublicKeyFingerprint: 'tally-fingerprint-1',
    },
    RequiredShareCount: 2,
    EligibleTrustees: [
      {
        TrusteeUserAddress: 'trustee-a',
        TrusteeDisplayName: 'Alice Trustee',
      },
      {
        TrusteeUserAddress: 'trustee-b',
        TrusteeDisplayName: 'Bob Trustee',
      },
    ],
    Status: ElectionFinalizationSessionStatusProto.FinalizationSessionAwaitingShares,
    CreatedAt: timestamp,
    CreatedByPublicAddress: 'owner-public-key',
    CompletedAt: undefined,
    ReleaseEvidenceId: '',
    LatestTransactionId: 'transaction-1',
    LatestBlockHeight: 100,
    LatestBlockId: 'block-100',
    ...overrides,
  };
}

function createFinalizationShare(
  overrides?: Partial<ElectionFinalizationShare>
): ElectionFinalizationShare {
  return {
    Id: 'finalization-share-1',
    FinalizationSessionId: 'finalization-session-1',
    ElectionId: 'election-1',
    TrusteeUserAddress: 'trustee-a',
    TrusteeDisplayName: 'Alice Trustee',
    SubmittedByPublicAddress: 'trustee-a',
    ShareIndex: 1,
    ShareVersion: 'share-v2',
    TargetType: ElectionFinalizationTargetTypeProto.FinalizationTargetAggregateTally,
    ClaimedCloseArtifactId: 'close-artifact',
    ClaimedAcceptedBallotSetHash: 'accepted-ballot-set-hash',
    ClaimedFinalEncryptedTallyHash: 'final-encrypted-tally-hash',
    ClaimedTargetTallyId: 'aggregate-tally-1',
    ClaimedCeremonyVersionId: 'ceremony-version-1',
    ClaimedTallyPublicKeyFingerprint: 'tally-fingerprint-1',
    Status: ElectionFinalizationShareStatusProto.FinalizationShareAccepted,
    FailureCode: '',
    FailureReason: '',
    SubmittedAt: { seconds: timestamp.seconds + 60, nanos: 0 },
    SourceTransactionId: 'transaction-2',
    SourceBlockHeight: 101,
    SourceBlockId: 'block-101',
    ...overrides,
  };
}

function createFinalizationReleaseEvidence(
  overrides?: Partial<ElectionFinalizationReleaseEvidence>
): ElectionFinalizationReleaseEvidence {
  return {
    Id: 'release-evidence-1',
    FinalizationSessionId: 'finalization-session-1',
    ElectionId: 'election-1',
    SessionPurpose: ElectionFinalizationSessionPurposeProto.FinalizationSessionPurposeFinalize,
    ReleaseMode: ElectionFinalizationReleaseModeProto.FinalizationReleaseAggregateTallyOnly,
    CloseArtifactId: 'close-artifact',
    AcceptedBallotSetHash: 'accepted-ballot-set-hash',
    FinalEncryptedTallyHash: 'final-encrypted-tally-hash',
    TargetTallyId: 'aggregate-tally-1',
    AcceptedShareCount: 2,
    AcceptedTrustees: [
      {
        TrusteeUserAddress: 'trustee-a',
        TrusteeDisplayName: 'Alice Trustee',
      },
      {
        TrusteeUserAddress: 'trustee-b',
        TrusteeDisplayName: 'Bob Trustee',
      },
    ],
    CompletedAt: { seconds: timestamp.seconds + 120, nanos: 0 },
    CompletedByPublicAddress: 'owner-public-key',
    SourceTransactionId: 'transaction-3',
    SourceBlockHeight: 102,
    SourceBlockId: 'block-102',
    ...overrides,
  };
}

function createElectionResponse(overrides?: Partial<GetElectionResponse>): GetElectionResponse {
  return {
    Success: true,
    ErrorMessage: '',
    Election: createElectionRecord(),
    WarningAcknowledgements: [],
    TrusteeInvitations: [],
    BoundaryArtifacts: [],
    GovernedProposals: [],
    GovernedProposalApprovals: [],
    CeremonyProfiles: [],
    CeremonyVersions: [],
    CeremonyTranscriptEvents: [],
    ActiveCeremonyTrusteeStates: [],
    FinalizationSessions: [createFinalizationSession()],
    FinalizationShares: [],
    FinalizationReleaseEvidenceRecords: [],
    ...overrides,
  };
}

describe('TrusteeElectionFinalizationPanel', () => {
  beforeEach(() => {
    useElectionsStore.getState().reset();
    vi.clearAllMocks();
    blockchainServiceMock.submitTransaction.mockResolvedValue({ successful: true, message: 'Accepted' });
    transactionServiceMock.createSubmitElectionFinalizationShareTransaction.mockResolvedValue({
      signedTransaction: 'signed-finalization-share-transaction',
    });
  });

  it('submits one aggregate-only finalization share bound to the active session', async () => {
    const initialResponse = createElectionResponse();
    const indexedResponse = createElectionResponse({
      FinalizationShares: [createFinalizationShare()],
      FinalizationReleaseEvidenceRecords: [createFinalizationReleaseEvidence()],
    });

    electionsServiceMock.getElection
      .mockResolvedValueOnce(initialResponse)
      .mockResolvedValue(indexedResponse);

    render(
      <TrusteeElectionFinalizationPanel
        electionId="election-1"
        actorPublicAddress="trustee-a"
        actorEncryptionPublicKey="trustee-encryption-key"
        actorEncryptionPrivateKey="trustee-encryption-private-key"
        actorSigningPrivateKey="trustee-signing-private-key"
      />
    );

    expect(await screen.findByTestId('trustee-finalization-summary')).toHaveTextContent(
      'Governed Referendum'
    );
    expect(screen.getByTestId('trustee-finalization-summary').className).not.toContain(
      'border-hush-bg-light'
    );
    expect(screen.getByTestId('trustee-finalization-panel').className).not.toContain(
      'border-hush-bg-light'
    );
    expect(screen.getByText('Session purpose').parentElement?.className).not.toContain(
      'border-hush-bg-light'
    );
    expect(screen.getByText('Target tally id').parentElement?.className).not.toContain(
      'border-hush-bg-light'
    );
    expect(screen.getByTestId('trustee-finalization-share-version').className).not.toContain(
      'border-hush-bg-light'
    );
    expect(screen.getByTestId('trustee-finalization-panel')).toHaveTextContent('Share index 1');

    fireEvent.change(screen.getByTestId('trustee-finalization-share-version'), {
      target: { value: 'share-v2' },
    });
    fireEvent.change(screen.getByTestId('trustee-finalization-share-material'), {
      target: { value: 'aggregate-share-material-v2' },
    });
    fireEvent.click(screen.getByTestId('trustee-finalization-submit-button'));

    await waitFor(() => {
      expect(
        transactionServiceMock.createSubmitElectionFinalizationShareTransaction
      ).toHaveBeenCalledWith(
        {
          ElectionId: 'election-1',
          FinalizationSessionId: 'finalization-session-1',
          ActorPublicAddress: 'trustee-a',
          ShareIndex: 1,
          ShareVersion: 'share-v2',
          TargetType: ElectionFinalizationTargetTypeProto.FinalizationTargetAggregateTally,
          ClaimedCloseArtifactId: 'close-artifact',
          ClaimedAcceptedBallotSetHash: 'accepted-ballot-set-hash',
          ClaimedFinalEncryptedTallyHash: 'final-encrypted-tally-hash',
          ClaimedTargetTallyId: 'aggregate-tally-1',
          ClaimedCeremonyVersionId: 'ceremony-version-1',
          ClaimedTallyPublicKeyFingerprint: 'tally-fingerprint-1',
          ShareMaterial: 'aggregate-share-material-v2',
        },
        'trustee-encryption-key',
        'trustee-encryption-private-key',
        'trustee-signing-private-key'
      );
    });

    expect(blockchainServiceMock.submitTransaction).toHaveBeenCalledWith(
      'signed-finalization-share-transaction'
    );
    expect(
      await screen.findByText('Finalization share recorded and aggregate release completed.')
    ).toBeInTheDocument();
  });

  it('shows the blocked FEAT-098 reason when no bound session exists yet', async () => {
    electionsServiceMock.getElection.mockResolvedValueOnce(
      createElectionResponse({
        FinalizationSessions: [],
        FinalizationShares: [],
        FinalizationReleaseEvidenceRecords: [],
      })
    );

    render(
      <TrusteeElectionFinalizationPanel
        electionId="election-1"
        actorPublicAddress="trustee-a"
        actorEncryptionPublicKey="trustee-encryption-key"
        actorEncryptionPrivateKey="trustee-encryption-private-key"
        actorSigningPrivateKey="trustee-signing-private-key"
      />
    );

    expect(await screen.findByTestId('trustee-finalization-blocked')).toHaveTextContent(
      'Finalize remains unavailable until tally readiness is recorded.'
    );
    expect(screen.getByTestId('trustee-finalization-blocked').className).not.toContain(
      'border-hush-bg-light'
    );
    expect(screen.queryByTestId('trustee-finalization-submit-button')).not.toBeInTheDocument();
  });
});
