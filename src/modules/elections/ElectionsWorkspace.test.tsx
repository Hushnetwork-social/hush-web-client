import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ElectionCommandResponse,
  ElectionDraftInput,
  ElectionDraftSnapshot,
  ElectionRecordView,
  ElectionSummary,
  GetElectionOpenReadinessResponse,
  GetElectionResponse,
} from '@/lib/grpc';
import {
  ElectionBindingStatusProto,
  ElectionClassProto,
  ElectionDisclosureModeProto,
  ElectionGovernanceModeProto,
  ElectionLifecycleStateProto,
  ElectionTrusteeInvitationStatusProto,
  EligibilityMutationPolicyProto,
  EligibilitySourceTypeProto,
  OutcomeRuleKindProto,
  ParticipationPrivacyModeProto,
  ReportingPolicyProto,
  ReviewWindowPolicyProto,
  VoteUpdatePolicyProto,
} from '@/lib/grpc';
import { ElectionsWorkspace } from './ElectionsWorkspace';
import { createDefaultElectionDraft } from './contracts';
import { useElectionsStore } from './useElectionsStore';

const { electionsServiceMock } = vi.hoisted(() => ({
  electionsServiceMock: {
    approveElectionGovernedProposal: vi.fn(),
    closeElection: vi.fn(),
    createElectionDraft: vi.fn(),
    finalizeElection: vi.fn(),
    getElection: vi.fn(),
    getElectionOpenReadiness: vi.fn(),
    getElectionsByOwner: vi.fn(),
    inviteElectionTrustee: vi.fn(),
    openElection: vi.fn(),
    revokeElectionTrusteeInvitation: vi.fn(),
    retryElectionGovernedProposalExecution: vi.fn(),
    startElectionGovernedProposal: vi.fn(),
    updateElectionDraft: vi.fn(),
  },
}));

vi.mock('@/lib/grpc/services/elections', () => ({
  electionsService: electionsServiceMock,
}));

const timestamp = { seconds: 1_711_410_000, nanos: 0 };

function createDraftInput(overrides?: Partial<ElectionDraftInput>): ElectionDraftInput {
  return {
    ...createDefaultElectionDraft(),
    Title: 'Board Election',
    ExternalReferenceCode: 'ORG-2026-01',
    OwnerOptions: [
      {
        OptionId: 'option-a',
        DisplayLabel: 'Alice',
        ShortDescription: 'First option',
        BallotOrder: 1,
        IsBlankOption: false,
      },
      {
        OptionId: 'option-b',
        DisplayLabel: 'Bob',
        ShortDescription: 'Second option',
        BallotOrder: 2,
        IsBlankOption: false,
      },
    ],
    ...overrides,
  };
}

function createElectionRecord(
  lifecycleState: ElectionLifecycleStateProto,
  overrides?: Partial<ElectionRecordView>
): ElectionRecordView {
  const draft = createDraftInput();

  return {
    ElectionId: 'election-1',
    Title: draft.Title,
    ShortDescription: draft.ShortDescription,
    OwnerPublicAddress: 'owner-public-key',
    ExternalReferenceCode: draft.ExternalReferenceCode,
    LifecycleState: lifecycleState,
    ElectionClass: draft.ElectionClass,
    BindingStatus: draft.BindingStatus,
    GovernanceMode: draft.GovernanceMode,
    DisclosureMode: draft.DisclosureMode,
    ParticipationPrivacyMode: draft.ParticipationPrivacyMode,
    VoteUpdatePolicy: draft.VoteUpdatePolicy,
    EligibilitySourceType: draft.EligibilitySourceType,
    EligibilityMutationPolicy: draft.EligibilityMutationPolicy,
    OutcomeRule: draft.OutcomeRule,
    ApprovedClientApplications: draft.ApprovedClientApplications,
    ProtocolOmegaVersion: draft.ProtocolOmegaVersion,
    ReportingPolicy: draft.ReportingPolicy,
    ReviewWindowPolicy: draft.ReviewWindowPolicy,
    CurrentDraftRevision: 1,
    Options: draft.OwnerOptions,
    AcknowledgedWarningCodes: draft.AcknowledgedWarningCodes,
    RequiredApprovalCount: draft.RequiredApprovalCount,
    CreatedAt: timestamp,
    LastUpdatedAt: timestamp,
    OpenedAt: lifecycleState >= ElectionLifecycleStateProto.Open ? timestamp : undefined,
    ClosedAt: lifecycleState >= ElectionLifecycleStateProto.Closed ? timestamp : undefined,
    FinalizedAt: lifecycleState >= ElectionLifecycleStateProto.Finalized ? timestamp : undefined,
    OpenArtifactId: lifecycleState >= ElectionLifecycleStateProto.Open ? 'open-artifact' : '',
    CloseArtifactId: lifecycleState >= ElectionLifecycleStateProto.Closed ? 'close-artifact' : '',
    FinalizeArtifactId:
      lifecycleState >= ElectionLifecycleStateProto.Finalized ? 'finalize-artifact' : '',
    ...overrides,
  };
}

function createElectionSummary(
  lifecycleState: ElectionLifecycleStateProto,
  overrides?: Partial<ElectionSummary>
): ElectionSummary {
  return {
    ElectionId: 'election-1',
    Title: 'Board Election',
    OwnerPublicAddress: 'owner-public-key',
    LifecycleState: lifecycleState,
    BindingStatus: ElectionBindingStatusProto.Binding,
    GovernanceMode: ElectionGovernanceModeProto.AdminOnly,
    CurrentDraftRevision: 1,
    LastUpdatedAt: timestamp,
    ...overrides,
  };
}

function createDraftSnapshot(overrides?: Partial<ElectionDraftSnapshot>): ElectionDraftSnapshot {
  const draft = createDraftInput();

  return {
    Id: 'snapshot-1',
    ElectionId: 'election-1',
    DraftRevision: 1,
    Metadata: {
      Title: draft.Title,
      ShortDescription: draft.ShortDescription,
      OwnerPublicAddress: 'owner-public-key',
      ExternalReferenceCode: draft.ExternalReferenceCode,
    },
    Policy: {
      ElectionClass: draft.ElectionClass,
      BindingStatus: draft.BindingStatus,
      GovernanceMode: draft.GovernanceMode,
      DisclosureMode: draft.DisclosureMode,
      ParticipationPrivacyMode: draft.ParticipationPrivacyMode,
      VoteUpdatePolicy: draft.VoteUpdatePolicy,
      EligibilitySourceType: draft.EligibilitySourceType,
      EligibilityMutationPolicy: draft.EligibilityMutationPolicy,
      OutcomeRule: draft.OutcomeRule,
      ApprovedClientApplications: draft.ApprovedClientApplications,
      ProtocolOmegaVersion: draft.ProtocolOmegaVersion,
      ReportingPolicy: draft.ReportingPolicy,
      ReviewWindowPolicy: draft.ReviewWindowPolicy,
      RequiredApprovalCount: draft.RequiredApprovalCount,
    },
    Options: draft.OwnerOptions,
    AcknowledgedWarningCodes: draft.AcknowledgedWarningCodes,
    SnapshotReason: 'Initial draft',
    RecordedAt: timestamp,
    RecordedByPublicAddress: 'owner-public-key',
    ...overrides,
  };
}

function createElectionResponse(overrides?: Partial<GetElectionResponse>): GetElectionResponse {
  return {
    Success: true,
    ErrorMessage: '',
    Election: createElectionRecord(ElectionLifecycleStateProto.Draft),
    LatestDraftSnapshot: createDraftSnapshot(),
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

function createCommandResponse(overrides?: Partial<ElectionCommandResponse>): ElectionCommandResponse {
  return {
    Success: true,
    ErrorCode: 0,
    ErrorMessage: '',
    ValidationErrors: [],
    Election: createElectionRecord(ElectionLifecycleStateProto.Draft),
    CeremonyTranscriptEvents: [],
    ...overrides,
  };
}

function createReadinessResponse(
  overrides?: Partial<GetElectionOpenReadinessResponse>
): GetElectionOpenReadinessResponse {
  return {
    IsReadyToOpen: true,
    ValidationErrors: [],
    RequiredWarningCodes: [],
    MissingWarningAcknowledgements: [],
    ...overrides,
  };
}

describe('ElectionsWorkspace', () => {
  beforeEach(() => {
    useElectionsStore.getState().reset();
    vi.clearAllMocks();
    electionsServiceMock.getElectionsByOwner.mockResolvedValue({ Elections: [] });
    electionsServiceMock.getElection.mockResolvedValue(createElectionResponse());
    electionsServiceMock.getElectionOpenReadiness.mockResolvedValue(createReadinessResponse());
    electionsServiceMock.createElectionDraft.mockResolvedValue(createCommandResponse());
    electionsServiceMock.updateElectionDraft.mockResolvedValue(createCommandResponse());
    electionsServiceMock.inviteElectionTrustee.mockResolvedValue(createCommandResponse());
    electionsServiceMock.revokeElectionTrusteeInvitation.mockResolvedValue(createCommandResponse());
    electionsServiceMock.startElectionGovernedProposal.mockResolvedValue(createCommandResponse());
    electionsServiceMock.approveElectionGovernedProposal.mockResolvedValue(createCommandResponse());
    electionsServiceMock.retryElectionGovernedProposalExecution.mockResolvedValue(createCommandResponse());
    electionsServiceMock.openElection.mockResolvedValue(createCommandResponse());
    electionsServiceMock.closeElection.mockResolvedValue(createCommandResponse());
    electionsServiceMock.finalizeElection.mockResolvedValue(createCommandResponse());
  });

  it('creates a valid draft and shows save feedback', async () => {
    const createdRecord = createElectionRecord(ElectionLifecycleStateProto.Draft);
    electionsServiceMock.getElectionsByOwner
      .mockResolvedValueOnce({ Elections: [] })
      .mockResolvedValueOnce({
        Elections: [createElectionSummary(ElectionLifecycleStateProto.Draft)],
      });
    electionsServiceMock.createElectionDraft.mockResolvedValueOnce(
      createCommandResponse({ Election: createdRecord })
    );
    electionsServiceMock.getElection.mockResolvedValueOnce(
      createElectionResponse({
        Election: createdRecord,
        LatestDraftSnapshot: createDraftSnapshot(),
      })
    );

    render(<ElectionsWorkspace ownerPublicAddress="owner-public-key" />);

    fireEvent.change(screen.getByTestId('elections-title-input'), {
      target: { value: 'Board Election' },
    });
    fireEvent.change(screen.getByTestId('elections-option-label-0'), {
      target: { value: 'Alice' },
    });
    fireEvent.change(screen.getByTestId('elections-option-label-1'), {
      target: { value: 'Bob' },
    });

    fireEvent.click(screen.getByTestId('elections-save-button'));

    expect(await screen.findByText('Election draft created.')).toBeInTheDocument();
    expect(electionsServiceMock.createElectionDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        OwnerPublicAddress: 'owner-public-key',
        SnapshotReason: 'Initial draft',
        Draft: expect.objectContaining({
          Title: 'Board Election',
        }),
      })
    );
  });

  it('shows the trustee-threshold block and hides the open action', async () => {
    const trusteeDraft = createElectionRecord(ElectionLifecycleStateProto.Draft, {
      GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
      ReviewWindowPolicy: ReviewWindowPolicyProto.GovernedReviewWindowReserved,
      RequiredApprovalCount: 1,
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
    });

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Draft, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    electionsServiceMock.getElection.mockResolvedValueOnce(
      createElectionResponse({
        Election: trusteeDraft,
        LatestDraftSnapshot: createDraftSnapshot({
          Policy: {
            ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
            BindingStatus: ElectionBindingStatusProto.Binding,
            GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
            DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
            ParticipationPrivacyMode:
              ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
            VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
            EligibilitySourceType: EligibilitySourceTypeProto.OrganizationImportedRoster,
            EligibilityMutationPolicy: EligibilityMutationPolicyProto.FrozenAtOpen,
            OutcomeRule: trusteeDraft.OutcomeRule,
            ApprovedClientApplications: [{ ApplicationId: 'hushsocial', Version: '1.0.0' }],
            ProtocolOmegaVersion: 'omega-v1.0.0',
            ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
            ReviewWindowPolicy: ReviewWindowPolicyProto.GovernedReviewWindowReserved,
            RequiredApprovalCount: 1,
          },
        }),
        TrusteeInvitations: [
          {
            Id: 'invite-1',
            ElectionId: 'election-1',
            TrusteeUserAddress: 'trustee-a',
            TrusteeDisplayName: 'Alice',
            InvitedByPublicAddress: 'owner-public-key',
            LinkedMessageId: 'message-1',
            Status: ElectionTrusteeInvitationStatusProto.Accepted,
            SentAtDraftRevision: 1,
            SentAt: timestamp,
          },
        ],
      })
    );

    render(<ElectionsWorkspace ownerPublicAddress="owner-public-key" />);

    expect(await screen.findByTestId('elections-trustee-blocked-panel')).toHaveTextContent(
      'FEAT-096'
    );
    expect(screen.queryByTestId('elections-open-button')).not.toBeInTheDocument();
  });

  it('shows the non-binding advisory for advisory elections', async () => {
    const advisoryElection = createElectionRecord(ElectionLifecycleStateProto.Draft, {
      BindingStatus: ElectionBindingStatusProto.NonBinding,
    });

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Draft, {
          BindingStatus: ElectionBindingStatusProto.NonBinding,
        }),
      ],
    });
    electionsServiceMock.getElection.mockResolvedValueOnce(
      createElectionResponse({
        Election: advisoryElection,
        LatestDraftSnapshot: createDraftSnapshot({
          Policy: {
            ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
            BindingStatus: ElectionBindingStatusProto.NonBinding,
            GovernanceMode: ElectionGovernanceModeProto.AdminOnly,
            DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
            ParticipationPrivacyMode:
              ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
            VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
            EligibilitySourceType: EligibilitySourceTypeProto.OrganizationImportedRoster,
            EligibilityMutationPolicy: EligibilityMutationPolicyProto.FrozenAtOpen,
            OutcomeRule: advisoryElection.OutcomeRule,
            ApprovedClientApplications: [{ ApplicationId: 'hushsocial', Version: '1.0.0' }],
            ProtocolOmegaVersion: 'omega-v1.0.0',
            ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
            ReviewWindowPolicy: ReviewWindowPolicyProto.NoReviewWindow,
          },
        }),
      })
    );

    render(<ElectionsWorkspace ownerPublicAddress="owner-public-key" />);

    expect(await screen.findByTestId('elections-binding-advisory')).toHaveTextContent(
      'result is advisory'
    );
  });

  it('shows lifecycle controls and frozen policy for an open election', async () => {
    const openElection = createElectionRecord(ElectionLifecycleStateProto.Open, {
      OpenedAt: timestamp,
      OpenArtifactId: 'open-artifact',
    });

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [createElectionSummary(ElectionLifecycleStateProto.Open)],
    });
    electionsServiceMock.getElection.mockResolvedValueOnce(
      createElectionResponse({
        Election: openElection,
        WarningAcknowledgements: [
          {
            Id: 'warning-1',
            ElectionId: 'election-1',
            WarningCode: 0,
            DraftRevision: 1,
            AcknowledgedByPublicAddress: 'owner-public-key',
            AcknowledgedAt: timestamp,
          },
        ],
        BoundaryArtifacts: [
          {
            Id: 'open-artifact',
            ElectionId: 'election-1',
            ArtifactType: 0,
            LifecycleState: ElectionLifecycleStateProto.Open,
            SourceDraftRevision: 1,
            Metadata: {
              Title: 'Board Election',
              ShortDescription: '',
              OwnerPublicAddress: 'owner-public-key',
              ExternalReferenceCode: 'ORG-2026-01',
            },
            Policy: {
              ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
              BindingStatus: ElectionBindingStatusProto.Binding,
              GovernanceMode: ElectionGovernanceModeProto.AdminOnly,
              DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
              ParticipationPrivacyMode:
                ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
              VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
              EligibilitySourceType: EligibilitySourceTypeProto.OrganizationImportedRoster,
              EligibilityMutationPolicy: EligibilityMutationPolicyProto.FrozenAtOpen,
              OutcomeRule: openElection.OutcomeRule,
              ApprovedClientApplications: [{ ApplicationId: 'hushsocial', Version: '1.0.0' }],
              ProtocolOmegaVersion: 'omega-v1.0.0',
              ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
              ReviewWindowPolicy: ReviewWindowPolicyProto.NoReviewWindow,
            },
            Options: openElection.Options,
            AcknowledgedWarningCodes: [],
            FrozenEligibleVoterSetHash: 'frozen-hash',
            TrusteePolicyExecutionReference: '',
            ReportingPolicyExecutionReference: '',
            ReviewWindowExecutionReference: '',
            AcceptedBallotSetHash: '',
            FinalEncryptedTallyHash: '',
            RecordedAt: timestamp,
            RecordedByPublicAddress: 'owner-public-key',
          },
        ],
      })
    );

    render(<ElectionsWorkspace ownerPublicAddress="owner-public-key" />);

    expect(await screen.findByTestId('elections-close-button')).toBeInTheDocument();
    expect(screen.getByTestId('elections-read-only-banner')).toHaveTextContent(
      'Draft editing is frozen after open'
    );
    expect(screen.getByTestId('elections-title-input')).toBeDisabled();
    expect(screen.getByTestId('elections-frozen-policy')).toHaveTextContent('Protocol Omega version');
    expect(screen.getByTestId('elections-warning-evidence')).toHaveTextContent('Low anonymity set');
    expect(screen.getByText('Boundary artifacts')).toBeInTheDocument();
  });

  it('surfaces unsupported FEAT-094 values from an existing draft', async () => {
    const unsupportedElection = createElectionRecord(ElectionLifecycleStateProto.Draft, {
      VoteUpdatePolicy: VoteUpdatePolicyProto.LatestValidVoteWins,
      DisclosureMode: ElectionDisclosureModeProto.SeparatedParticipationAndResultReports,
    });

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [createElectionSummary(ElectionLifecycleStateProto.Draft)],
    });
    electionsServiceMock.getElection.mockResolvedValueOnce(
      createElectionResponse({
        Election: unsupportedElection,
        LatestDraftSnapshot: createDraftSnapshot({
          Policy: {
            ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
            BindingStatus: ElectionBindingStatusProto.Binding,
            GovernanceMode: ElectionGovernanceModeProto.AdminOnly,
            DisclosureMode: ElectionDisclosureModeProto.SeparatedParticipationAndResultReports,
            ParticipationPrivacyMode:
              ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
            VoteUpdatePolicy: VoteUpdatePolicyProto.LatestValidVoteWins,
            EligibilitySourceType: EligibilitySourceTypeProto.OrganizationImportedRoster,
            EligibilityMutationPolicy: EligibilityMutationPolicyProto.FrozenAtOpen,
            OutcomeRule: unsupportedElection.OutcomeRule,
            ApprovedClientApplications: [{ ApplicationId: 'hushsocial', Version: '1.0.0' }],
            ProtocolOmegaVersion: 'omega-v1.0.0',
            ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
            ReviewWindowPolicy: ReviewWindowPolicyProto.NoReviewWindow,
          },
        }),
      })
    );

    render(<ElectionsWorkspace ownerPublicAddress="owner-public-key" />);

    const unsupportedPanel = await screen.findByTestId('elections-unsupported-panel');
    expect(unsupportedPanel).toHaveTextContent('final-results-only disclosure mode');
    expect(unsupportedPanel).toHaveTextContent('single-submission-only vote update policy');
    await waitFor(() => {
      expect(screen.queryByTestId('elections-open-button')).not.toBeInTheDocument();
    });
  });
});
