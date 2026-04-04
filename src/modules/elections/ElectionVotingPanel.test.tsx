import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ElectionBindingStatusProto,
  ElectionClassProto,
  ElectionDisclosureModeProto,
  ElectionEligibilitySnapshotTypeProto,
  ElectionGovernanceModeProto,
  ElectionLifecycleStateProto,
  ElectionParticipationStatusProto,
  ElectionResultArtifactKindProto,
  ElectionResultArtifactVisibilityProto,
  ElectionVotingRightStatusProto,
  ElectionVotingSubmissionStatusProto,
  EligibilityMutationPolicyProto,
  EligibilitySourceTypeProto,
  OfficialResultVisibilityPolicyProto,
  OutcomeRuleKindProto,
  ParticipationPrivacyModeProto,
  ReportingPolicyProto,
  ReviewWindowPolicyProto,
  TransactionStatus,
  VoteUpdatePolicyProto,
  type ElectionResultArtifact,
  type ElectionRecordView,
  type GetElectionResponse,
  type GetElectionResultViewResponse,
  type GetElectionVotingViewResponse,
} from '@/lib/grpc';
import { ElectionVotingPanel } from './ElectionVotingPanel';

const { electionsServiceMock, blockchainServiceMock, transactionServiceMock } = vi.hoisted(() => ({
  electionsServiceMock: {
    getElection: vi.fn(),
    getElectionVotingView: vi.fn(),
    getElectionResultView: vi.fn(),
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
    Options: [
      {
        OptionId: 'option-a',
        DisplayLabel: 'Candidate A',
        ShortDescription: 'A clear continuity option',
        BallotOrder: 1,
        IsBlankOption: false,
      },
      {
        OptionId: 'option-b',
        DisplayLabel: 'Candidate B',
        ShortDescription: 'A change-focused option',
        BallotOrder: 2,
        IsBlankOption: false,
      },
    ],
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

function createResultArtifact(overrides?: Partial<ElectionResultArtifact>): ElectionResultArtifact {
  return {
    Id: 'official-result-1',
    ElectionId: 'election-1',
    ArtifactKind: ElectionResultArtifactKindProto.ElectionResultArtifactOfficial,
    Visibility: ElectionResultArtifactVisibilityProto.ElectionResultArtifactPublicPlaintext,
    Title: 'Official result',
    NamedOptionResults: [
      {
        OptionId: 'option-a',
        DisplayLabel: 'Candidate A',
        ShortDescription: 'A clear continuity option',
        BallotOrder: 1,
        Rank: 1,
        VoteCount: 10,
      },
    ],
    BlankCount: 1,
    TotalVotedCount: 11,
    EligibleToVoteCount: 20,
    DidNotVoteCount: 9,
    DenominatorEvidence: {
      SnapshotType: ElectionEligibilitySnapshotTypeProto.EligibilitySnapshotClose,
      EligibilitySnapshotId: 'eligibility-snapshot-1',
      BoundaryArtifactId: 'close-artifact-1',
      ActiveDenominatorSetHash: 'active-denominator-hash-1',
    },
    TallyReadyArtifactId: 'tally-ready-artifact-1',
    SourceResultArtifactId: 'unofficial-result-1',
    EncryptedPayload: '',
    PublicPayload: '{"winner":"Candidate A"}',
    RecordedAt: timestamp,
    RecordedByPublicAddress: 'owner-public-key',
    ...overrides,
  };
}

function createResultView(
  overrides?: Partial<GetElectionResultViewResponse>,
): GetElectionResultViewResponse {
  return {
    Success: true,
    ErrorMessage: '',
    ActorPublicAddress: 'actor-public-key',
    CanViewParticipantEncryptedResults: false,
    OfficialResultVisibilityPolicy: OfficialResultVisibilityPolicyProto.PublicPlaintext,
    ClosedProgressStatus: 0,
    CanViewReportPackage: false,
    CanRetryFailedPackageFinalization: false,
    VisibleReportArtifacts: [],
    ...overrides,
  };
}

describe('ElectionVotingPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.localStorage.clear();
    process.env.NEXT_PUBLIC_ELECTIONS_ALLOW_DEV_MODE = 'false';
    delete (window as Window & { __e2e_forceElectionMode?: unknown }).__e2e_forceElectionMode;
    electionsServiceMock.getElection.mockResolvedValue(createElectionResponse());
    electionsServiceMock.getElectionResultView.mockResolvedValue(createResultView());
    blockchainServiceMock.submitTransaction.mockResolvedValue({
      successful: true,
      message: 'Accepted',
      status: TransactionStatus.ACCEPTED,
      validationCode: '',
    });
  });

  it('shows one submit button and blocks real protected submission in non-dev builds', async () => {
    electionsServiceMock.getElectionVotingView.mockResolvedValue(createVotingViewResponse());

    render(
      <ElectionVotingPanel
        electionId="election-1"
        actorPublicAddress="actor-public-key"
        actorEncryptionPublicKey="actor-encryption-public-key"
        actorEncryptionPrivateKey="actor-encryption-private-key"
        actorSigningPrivateKey="actor-signing-private-key"
      />,
    );

    expect(await screen.findByTestId('voting-ballot-workflow')).toBeInTheDocument();
    expect(screen.getByTestId('voting-option-option-a')).toBeInTheDocument();
    expect(screen.getByTestId('voting-option-option-b')).toBeInTheDocument();
    expect(screen.getByTestId('voting-submit')).toBeDisabled();
    expect(screen.getByTestId('voting-submit-panel')).toHaveTextContent(
      'Submit vote is reserved for the protected production path',
    );
    expect(screen.getByText('Your vote is not submitted yet')).toBeInTheDocument();
    expect(screen.getByTestId('voting-summary-section')).toBeInTheDocument();
    expect(
      screen.getByTestId('voting-advanced-context-toggle').compareDocumentPosition(
        screen.getByTestId('voting-summary-toggle'),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(screen.getByTestId('voting-option-option-a'));
    expect(screen.getByTestId('voting-selected-option-summary')).toHaveTextContent(
      'Candidate A',
    );
    expect(screen.getByTestId('voting-submit')).toBeEnabled();

    fireEvent.click(screen.getByTestId('voting-submit'));

    expect(
      await screen.findByText(/Real protected vote submission is not available in this build yet/),
    ).toBeInTheDocument();
    expect(
      transactionServiceMock.createRegisterElectionVotingCommitmentTransaction,
    ).not.toHaveBeenCalled();
    expect(
      transactionServiceMock.createAcceptElectionBallotCastTransaction,
    ).not.toHaveBeenCalled();
  });

  it('submits a dev-only election vote from the selected option when dev mode is enabled', async () => {
    process.env.NEXT_PUBLIC_ELECTIONS_ALLOW_DEV_MODE = 'true';
    electionsServiceMock.getElectionVotingView
      .mockResolvedValueOnce(createVotingViewResponse())
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
          ReceiptId: 'receipt-dev-1',
          AcceptanceId: 'acceptance-dev-1',
          ServerProof: 'server-proof-dev-1',
        }),
      );
    transactionServiceMock.createRegisterElectionVotingCommitmentTransaction.mockResolvedValue({
      signedTransaction: 'signed-register-commitment',
    });
    transactionServiceMock.createAcceptElectionBallotCastTransaction.mockResolvedValue({
      signedTransaction: 'signed-dev-cast-transaction',
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

    expect(await screen.findByTestId('voting-submit-panel')).toHaveTextContent(
      'Dev-only submit is enabled for this build',
    );

    fireEvent.click(screen.getByTestId('voting-option-option-a'));
    fireEvent.click(screen.getByTestId('voting-submit'));

    await waitFor(() => {
      expect(
        transactionServiceMock.createRegisterElectionVotingCommitmentTransaction,
      ).toHaveBeenCalled();
      expect(
        transactionServiceMock.createAcceptElectionBallotCastTransaction,
      ).toHaveBeenCalled();
    });

    const createCastCall =
      transactionServiceMock.createAcceptElectionBallotCastTransaction.mock.calls[0];
    const submittedBallotPackage = createCastCall?.[5];
    const submittedProofBundle = createCastCall?.[6];
    const submittedNullifier = createCastCall?.[7];

    expect(submittedBallotPackage).toContain('"mode":"election-dev-mode-v1"');
    expect(submittedBallotPackage).toContain('"optionId":"option-a"');
    expect(submittedBallotPackage).not.toContain('"actorPublicAddress"');
    expect(submittedBallotPackage).not.toContain('"generatedAt"');
    expect(submittedProofBundle).toContain('"proofType":"dev-election-proof"');
    expect(submittedProofBundle).toContain('"ballotPackageHash"');
    expect(submittedProofBundle).not.toContain('"actorPublicAddress"');
    expect(submittedProofBundle).not.toContain('"commitmentHash"');
    expect(submittedProofBundle).not.toContain('"ballotNullifier"');
    expect(submittedProofBundle).not.toContain('"generatedAt"');
    expect(submittedNullifier).toMatch(/^[a-f0-9]{64}$/);
    expect(blockchainServiceMock.submitTransaction).toHaveBeenCalledTimes(2);
    expect(await screen.findByTestId('voting-accepted-panel')).toBeInTheDocument();
  });

  it('shows the accepted ballot panel as soon as an acceptance receipt exists', async () => {
    electionsServiceMock.getElectionVotingView.mockResolvedValue(
      createVotingViewResponse({
        HasAcceptedAt: true,
        AcceptedAt: timestamp,
        ReceiptId: 'receipt-lagged-1',
        AcceptanceId: 'acceptance-lagged-1',
        ServerProof: 'server-proof-lagged-1',
      }),
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

    expect(await screen.findByTestId('voting-accepted-panel')).toBeInTheDocument();
    expect(screen.getByTestId('voting-accepted-panel-toggle')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.queryByTestId('voting-ballot-workflow')).not.toBeInTheDocument();
    expect(screen.getByTestId('voting-summary-section')).toBeInTheDocument();
  });

  it('conceals the selected ballot workflow while the submission is still being reconciled', async () => {
    process.env.NEXT_PUBLIC_ELECTIONS_ALLOW_DEV_MODE = 'true';
    electionsServiceMock.getElectionVotingView
      .mockResolvedValueOnce(createVotingViewResponse())
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
          SubmissionStatus:
            ElectionVotingSubmissionStatusProto.VotingSubmissionStatusStillProcessing,
        }),
      )
      .mockResolvedValueOnce(
        createVotingViewResponse({
          CommitmentRegistered: true,
          HasCommitmentRegisteredAt: true,
          CommitmentRegisteredAt: timestamp,
          SubmissionStatus:
            ElectionVotingSubmissionStatusProto.VotingSubmissionStatusStillProcessing,
        }),
      );
    transactionServiceMock.createRegisterElectionVotingCommitmentTransaction.mockResolvedValue({
      signedTransaction: 'signed-register-commitment',
    });
    transactionServiceMock.createAcceptElectionBallotCastTransaction.mockResolvedValue({
      signedTransaction: 'signed-dev-cast-transaction',
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

    fireEvent.click(await screen.findByTestId('voting-option-option-a'));
    fireEvent.click(screen.getByTestId('voting-submit'));

    expect(await screen.findByTestId('voting-pending-panel')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByTestId('voting-ballot-workflow')).not.toBeInTheDocument();
    });
    expect(screen.getByText(/selected ballot option is now hidden on this screen/i)).toBeInTheDocument();
    expect(screen.getByTestId('voting-check-status')).toBeInTheDocument();
  });

  it('shows accepted vote receipt details that were already retained on this device', async () => {
    window.localStorage.setItem(
      'feat099:receipt:election-1',
      JSON.stringify({
        electionId: 'election-1',
        receiptId: 'receipt-1',
        acceptanceId: 'acceptance-1',
        acceptedAt: '2026-04-02 13:00:00',
        ballotPackageCommitment: 'ballot-commitment-1',
        serverProof: 'server-proof-1',
      }),
    );
    electionsServiceMock.getElectionVotingView.mockResolvedValue(
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

    render(
      <ElectionVotingPanel
        electionId="election-1"
        actorPublicAddress="actor-public-key"
        actorEncryptionPublicKey="actor-encryption-public-key"
        actorEncryptionPrivateKey="actor-encryption-private-key"
        actorSigningPrivateKey="actor-signing-private-key"
      />,
    );

    expect(await screen.findByTestId('voting-accepted-panel')).toBeInTheDocument();
    expect(screen.getByText('Local receipt retained on this device')).toBeInTheDocument();
    expect(screen.queryByText(/Ballot commitment:/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('voting-copy-receipt')).toBeInTheDocument();
    expect(screen.getByTestId('voting-verify-receipt')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('voting-verify-receipt'));

    await waitFor(() => {
      expect(screen.getByTestId('voting-receipt-verification-dialog')).toHaveTextContent(
        'This voter is marked as voted',
      );
    });
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('keeps receipt actions available when the accepted checkoff exists but the original commitment was not retained locally', async () => {
    electionsServiceMock.getElectionVotingView.mockResolvedValue(
      createVotingViewResponse({
        CommitmentRegistered: true,
        HasCommitmentRegisteredAt: true,
        CommitmentRegisteredAt: timestamp,
        HasAcceptedAt: true,
        AcceptedAt: timestamp,
        PersonalParticipationStatus:
          ElectionParticipationStatusProto.ParticipationCountedAsVoted,
        ReceiptId: 'receipt-tauri-1',
        AcceptanceId: 'acceptance-tauri-1',
        ServerProof: 'server-proof-tauri-1',
      }),
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

    expect(await screen.findByTestId('voting-accepted-panel')).toBeInTheDocument();
    expect(
      screen.getByText(/Open-election receipts stay compact and include only the fields used for this check/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId('voting-copy-receipt')).toBeEnabled();
    expect(screen.getByTestId('voting-download-receipt')).toBeEnabled();
    expect(screen.getByTestId('voting-verify-receipt')).toBeEnabled();

    fireEvent.click(screen.getByTestId('voting-verify-receipt'));

    await waitFor(() => {
      expect(screen.getByTestId('voting-receipt-verification-dialog')).toHaveTextContent(
        'This voter is marked as voted',
      );
    });
  });

  it('moves published results above the voter diagnostics and keeps the secondary sections collapsed', async () => {
    electionsServiceMock.getElection.mockResolvedValue(
      createElectionResponse({
        Election: createElectionRecord({
          LifecycleState: ElectionLifecycleStateProto.Finalized,
        }),
      }),
    );
    electionsServiceMock.getElectionVotingView.mockResolvedValue(
      createVotingViewResponse({
        HasAcceptedAt: true,
        AcceptedAt: timestamp,
        ReceiptId: 'receipt-final-1',
        AcceptanceId: 'acceptance-final-1',
        ServerProof: 'server-proof-final-1',
      }),
    );
    electionsServiceMock.getElectionResultView.mockResolvedValue(
      createResultView({
        OfficialResult: createResultArtifact(),
      }),
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

    const resultsSection = await screen.findByTestId('election-results-section');
    const acceptedPanel = screen.getByTestId('voting-accepted-panel');
    const acceptedToggle = screen.getByTestId('voting-accepted-panel-toggle');
    const snapshotToggle = screen.getByTestId('voting-summary-toggle');

    expect(
      resultsSection.compareDocumentPosition(acceptedPanel) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      resultsSection.compareDocumentPosition(snapshotToggle) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(acceptedToggle).toHaveAttribute('aria-expanded', 'false');
    expect(snapshotToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Local receipt retained on this device')).not.toBeInTheDocument();
    expect(screen.queryByTestId('voting-advanced-context-toggle')).not.toBeInTheDocument();
    expect(screen.getByText('View eligibility details')).toBeInTheDocument();
  });

  it('confirms finalized counted-set inclusion when the verified receipt belongs to a finalized election', async () => {
    window.localStorage.setItem(
      'feat099:receipt:election-1',
      JSON.stringify({
        electionId: 'election-1',
        receiptId: 'receipt-final-1',
        acceptanceId: 'acceptance-final-1',
        acceptedAt: '2026-04-04 13:00:00',
        ballotPackageCommitment: 'ballot-commitment-final-1',
        serverProof: 'server-proof-final-1',
      }),
    );
    electionsServiceMock.getElection.mockResolvedValue(
      createElectionResponse({
        Election: createElectionRecord({
          LifecycleState: ElectionLifecycleStateProto.Finalized,
        }),
      }),
    );
    electionsServiceMock.getElectionVotingView.mockResolvedValue(
      createVotingViewResponse({
        HasAcceptedAt: true,
        AcceptedAt: timestamp,
        PersonalParticipationStatus:
          ElectionParticipationStatusProto.ParticipationCountedAsVoted,
        ReceiptId: 'receipt-final-1',
        AcceptanceId: 'acceptance-final-1',
        ServerProof: 'server-proof-final-1',
      }),
    );
    electionsServiceMock.getElectionResultView.mockResolvedValue(
      createResultView({
        OfficialResult: createResultArtifact(),
      }),
    );

    render(
      <ElectionVotingPanel
        electionId="election-1"
        actorPublicAddress="actor-public-key"
        actorEncryptionPublicKey="actor-encryption-public-key"
        actorEncryptionPrivateKey="actor-encryption-private-key"
        actorSigningPrivateKey="actor-signing-private-key"
      />
    );

    fireEvent.click(await screen.findByTestId('voting-accepted-panel-toggle'));
    fireEvent.click(await screen.findByTestId('voting-verify-receipt'));

    await waitFor(() => {
      expect(screen.getByTestId('voting-receipt-verification-dialog')).toHaveTextContent(
        'included in the finalized counted set'
      );
    });
    expect(screen.getByTestId('voting-receipt-verification-dialog')).toHaveTextContent(
      'This accepted vote is included in the finalized counted set used for the official result.'
    );
  });

  it('does not persist pending recovery state when dev vote transaction creation fails locally', async () => {
    process.env.NEXT_PUBLIC_ELECTIONS_ALLOW_DEV_MODE = 'true';
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

    fireEvent.click(await screen.findByTestId('voting-option-option-a'));
    fireEvent.click(screen.getByTestId('voting-submit'));

    expect(await screen.findByText(/Envelope access unavailable/)).toBeInTheDocument();
    expect(window.sessionStorage.getItem('feat099:pending:election-1')).toBeNull();
    expect(blockchainServiceMock.submitTransaction).toHaveBeenCalledTimes(1);
  });

  it('collapses the draft voter snapshot by default and shows the associated number instead of a generic linked label', async () => {
    electionsServiceMock.getElection.mockResolvedValue(
      createElectionResponse({
        Election: createElectionRecord({
          LifecycleState: ElectionLifecycleStateProto.Draft,
          OpenedAt: undefined,
          OpenArtifactId: '',
        }),
      }),
    );
    electionsServiceMock.getElectionVotingView.mockResolvedValue(
      createVotingViewResponse({
        OpenArtifactId: '',
        EligibleSetHash: '',
        CeremonyVersionId: '',
        DkgProfileId: '',
        TallyPublicKeyFingerprint: '',
      }),
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

    const snapshotToggle = await screen.findByTestId('voting-summary-toggle');
    expect(snapshotToggle).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.getByText(
        'Review lifecycle, associated number, commitment, and participation for this voter.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('voting-advanced-context-toggle')).not.toBeInTheDocument();

    fireEvent.click(snapshotToggle);

    expect(snapshotToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Associated number')).toBeInTheDocument();
    expect(screen.getByText('10042')).toBeInTheDocument();
  });
});
