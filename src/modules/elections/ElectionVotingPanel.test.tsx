import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ElectionBindingStatusProto,
  ElectionClassProto,
  ElectionDisclosureModeProto,
  ElectionGovernanceModeProto,
  ElectionLifecycleStateProto,
  ElectionParticipationStatusProto,
  ElectionVotingRightStatusProto,
  ElectionVotingSubmissionStatusProto,
  EligibilityMutationPolicyProto,
  EligibilitySourceTypeProto,
  OutcomeRuleKindProto,
  ParticipationPrivacyModeProto,
  ReportingPolicyProto,
  ReviewWindowPolicyProto,
  TransactionStatus,
  VoteUpdatePolicyProto,
  type ElectionRecordView,
  type GetElectionResponse,
  type GetElectionVotingViewResponse,
} from '@/lib/grpc';
import { ElectionVotingPanel } from './ElectionVotingPanel';

const { electionsServiceMock, blockchainServiceMock, transactionServiceMock } = vi.hoisted(() => ({
  electionsServiceMock: {
    getElection: vi.fn(),
    getElectionVotingView: vi.fn(),
  },
  blockchainServiceMock: {
    submitTransaction: vi.fn(),
  },
  transactionServiceMock: {
    createRegisterElectionVotingCommitmentTransaction: vi.fn(),
    createAcceptElectionBallotCastTransaction: vi.fn(),
  },
}));

vi.mock('@/lib/crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/crypto')>();
  return {
    ...actual,
    generateGuid: () => 'submission-guid-1',
  };
});

vi.mock('@/lib/grpc/services/elections', () => ({
  electionsService: electionsServiceMock,
}));

vi.mock('@/modules/blockchain/BlockchainService', () => ({
  submitTransaction: (...args: unknown[]) => blockchainServiceMock.submitTransaction(...args),
}));

vi.mock('./transactionService', () => ({
  createRegisterElectionVotingCommitmentTransaction: (...args: unknown[]) =>
    transactionServiceMock.createRegisterElectionVotingCommitmentTransaction(...args),
  createAcceptElectionBallotCastTransaction: (...args: unknown[]) =>
    transactionServiceMock.createAcceptElectionBallotCastTransaction(...args),
}));

const timestamp = { seconds: 1_774_120_000, nanos: 0 };

function createElectionRecord(overrides?: Partial<ElectionRecordView>): ElectionRecordView {
  return {
    ElectionId: 'election-1',
    Title: 'Board Election',
    ShortDescription: 'Annual board vote',
    OwnerPublicAddress: 'owner-public-key',
    ExternalReferenceCode: 'ORG-2026-01',
    LifecycleState: ElectionLifecycleStateProto.Open,
    ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
    BindingStatus: ElectionBindingStatusProto.Binding,
    GovernanceMode: ElectionGovernanceModeProto.AdminOnly,
    DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
    ParticipationPrivacyMode:
      ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
    VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
    EligibilitySourceType: EligibilitySourceTypeProto.OrganizationImportedRoster,
    EligibilityMutationPolicy: EligibilityMutationPolicyProto.LateActivationForRosteredVotersOnly,
    OutcomeRule: {
      Kind: OutcomeRuleKindProto.SingleWinner,
      TemplateKey: 'single_winner',
      SeatCount: 1,
      BlankVoteCountsForTurnout: true,
      BlankVoteExcludedFromWinnerSelection: true,
      BlankVoteExcludedFromThresholdDenominator: false,
      TieResolutionRule: 'tie_unresolved',
      CalculationBasis: 'highest_non_blank_votes',
    },
    ApprovedClientApplications: [{ ApplicationId: 'hushsocial', Version: '1.0.0' }],
    ProtocolOmegaVersion: 'omega-v1.0.0',
    ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
    ReviewWindowPolicy: ReviewWindowPolicyProto.NoReviewWindow,
    CurrentDraftRevision: 1,
    Options: [],
    AcknowledgedWarningCodes: [],
    CreatedAt: timestamp,
    LastUpdatedAt: timestamp,
    OpenedAt: timestamp,
    OpenArtifactId: 'open-artifact-7',
    CloseArtifactId: '',
    FinalizeArtifactId: '',
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
    ...overrides,
  };
}

function createVotingViewResponse(
  overrides?: Partial<GetElectionVotingViewResponse>,
): GetElectionVotingViewResponse {
  return {
    Success: true,
    ErrorMessage: '',
    ActorPublicAddress: 'actor-public-key',
    Election: createElectionRecord(),
    SelfRosterEntry: {
      ElectionId: 'election-1',
      OrganizationVoterId: '10042',
      ContactType: 0,
      ContactValueHint: 'member-10042@example.org',
      LinkStatus: 1,
      VotingRightStatus: ElectionVotingRightStatusProto.VotingRightActive,
      WasPresentAtOpen: true,
      WasActiveAtOpen: true,
      InCurrentDenominator: true,
      ParticipationStatus: ElectionParticipationStatusProto.ParticipationDidNotVote,
      CountsAsParticipation: false,
    },
    CommitmentRegistered: false,
    HasCommitmentRegisteredAt: false,
    PersonalParticipationStatus: ElectionParticipationStatusProto.ParticipationDidNotVote,
    HasAcceptedAt: false,
    SubmissionStatus: ElectionVotingSubmissionStatusProto.VotingSubmissionStatusNone,
    OpenArtifactId: 'open-artifact-7',
    EligibleSetHash: 'eligible-set-hash-1',
    CeremonyVersionId: 'ceremony-version-5',
    DkgProfileId: 'dkg-profile-1',
    TallyPublicKeyFingerprint: 'tally-fingerprint-9',
    ReceiptId: '',
    AcceptanceId: '',
    ServerProof: '',
    ...overrides,
  };
}

describe('ElectionVotingPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    electionsServiceMock.getElection.mockResolvedValue(createElectionResponse());
    blockchainServiceMock.submitTransaction.mockResolvedValue({
      successful: true,
      message: 'Accepted',
      status: TransactionStatus.ACCEPTED,
      validationCode: '',
    });
  });

  it('registers a voting commitment before final cast', async () => {
    electionsServiceMock.getElectionVotingView
      .mockResolvedValueOnce(createVotingViewResponse())
      .mockResolvedValueOnce(
        createVotingViewResponse({
          CommitmentRegistered: true,
          HasCommitmentRegisteredAt: true,
          CommitmentRegisteredAt: timestamp,
        }),
      );
    transactionServiceMock.createRegisterElectionVotingCommitmentTransaction.mockResolvedValue({
      signedTransaction: 'signed-register-commitment',
    });

    render(
      <ElectionVotingPanel
        electionId="election-1"
        actorPublicAddress="actor-public-key"
        actorEncryptionPublicKey="actor-encryption-public-key"
        actorEncryptionPrivateKey="actor-encryption-private-key"
        actorSigningPrivateKey="actor-signing-private-key"
      />,
    );

    expect(await screen.findByTestId('voting-commitment-input')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('voting-commitment-input'), {
      target: { value: 'commitment-hash-1' },
    });
    fireEvent.click(screen.getByTestId('voting-commitment-submit'));

    await waitFor(() => {
      expect(
        transactionServiceMock.createRegisterElectionVotingCommitmentTransaction,
      ).toHaveBeenCalledWith(
        'election-1',
        'actor-public-key',
        'actor-encryption-public-key',
        'actor-encryption-private-key',
        'commitment-hash-1',
        'actor-signing-private-key',
      );
    });

    expect(blockchainServiceMock.submitTransaction).toHaveBeenCalledWith(
      'signed-register-commitment',
    );
    expect(await screen.findByText(/Voting commitment registered\./)).toBeInTheDocument();
  });

  it('submits an accepted ballot cast and stores a local receipt', async () => {
    electionsServiceMock.getElectionVotingView
      .mockResolvedValueOnce(
        createVotingViewResponse({
          CommitmentRegistered: true,
          HasCommitmentRegisteredAt: true,
          CommitmentRegisteredAt: timestamp,
        }),
      )
      .mockResolvedValueOnce(
        createVotingViewResponse({
          CommitmentRegistered: true,
          HasCommitmentRegisteredAt: true,
          CommitmentRegisteredAt: timestamp,
          HasAcceptedAt: true,
          AcceptedAt: timestamp,
          PersonalParticipationStatus:
            ElectionParticipationStatusProto.ParticipationCountedAsVoted,
          ReceiptId: 'receipt-1',
          AcceptanceId: 'acceptance-1',
          ServerProof: 'server-proof-1',
        }),
      );
    transactionServiceMock.createAcceptElectionBallotCastTransaction.mockResolvedValue({
      signedTransaction: 'signed-cast-transaction',
    });

    render(
      <ElectionVotingPanel
        electionId="election-1"
        actorPublicAddress="actor-public-key"
        actorEncryptionPublicKey="actor-encryption-public-key"
        actorEncryptionPrivateKey="actor-encryption-private-key"
        actorSigningPrivateKey="actor-signing-private-key"
      />,
    );

    expect(await screen.findByTestId('voting-cast-package')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('voting-cast-package'), {
      target: { value: 'ciphertext-ballot-package' },
    });
    fireEvent.change(screen.getByTestId('voting-cast-proof'), {
      target: { value: 'proof-bundle' },
    });
    fireEvent.change(screen.getByTestId('voting-cast-nullifier'), {
      target: { value: 'ballot-nullifier-1' },
    });
    fireEvent.click(screen.getByTestId('voting-cast-review'));
    fireEvent.click(await screen.findByTestId('voting-cast-confirm'));

    await waitFor(() => {
      expect(transactionServiceMock.createAcceptElectionBallotCastTransaction).toHaveBeenCalledWith(
        'election-1',
        'actor-public-key',
        'actor-encryption-public-key',
        'actor-encryption-private-key',
        'submission-guid-1',
        'ciphertext-ballot-package',
        'proof-bundle',
        'ballot-nullifier-1',
        'open-artifact-7',
        'eligible-set-hash-1',
        'ceremony-version-5',
        'dkg-profile-1',
        'tally-fingerprint-9',
        'actor-signing-private-key',
      );
    });

    expect(blockchainServiceMock.submitTransaction).toHaveBeenCalledWith('signed-cast-transaction');
    expect(await screen.findByTestId('voting-accepted-panel')).toBeInTheDocument();
    expect(screen.getByText('Local receipt retained on this device')).toBeInTheDocument();
    expect(window.sessionStorage.getItem('feat099:receipt:election-1')).toContain('receipt-1');
  });

  it('does not persist pending recovery state when cast transaction creation fails locally', async () => {
    electionsServiceMock.getElectionVotingView.mockResolvedValue(
      createVotingViewResponse({
        CommitmentRegistered: true,
        HasCommitmentRegisteredAt: true,
        CommitmentRegisteredAt: timestamp,
      }),
    );
    transactionServiceMock.createAcceptElectionBallotCastTransaction.mockRejectedValue(
      new Error('Envelope access unavailable'),
    );

    render(
      <ElectionVotingPanel
        electionId="election-1"
        actorPublicAddress="actor-public-key"
        actorEncryptionPublicKey="actor-encryption-public-key"
        actorEncryptionPrivateKey="actor-encryption-private-key"
        actorSigningPrivateKey="actor-signing-private-key"
      />,
    );

    expect(await screen.findByTestId('voting-cast-package')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('voting-cast-package'), {
      target: { value: 'ciphertext-ballot-package' },
    });
    fireEvent.change(screen.getByTestId('voting-cast-proof'), {
      target: { value: 'proof-bundle' },
    });
    fireEvent.change(screen.getByTestId('voting-cast-nullifier'), {
      target: { value: 'ballot-nullifier-1' },
    });
    fireEvent.click(screen.getByTestId('voting-cast-review'));
    fireEvent.click(await screen.findByTestId('voting-cast-confirm'));

    expect(await screen.findByText(/Envelope access unavailable/)).toBeInTheDocument();
    expect(window.sessionStorage.getItem('feat099:pending:election-1')).toBeNull();
    expect(blockchainServiceMock.submitTransaction).not.toHaveBeenCalled();
  });
});
