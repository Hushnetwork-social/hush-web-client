import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ElectionCommandResponse, ElectionRecordView, GetElectionResponse } from '@/lib/grpc';
import {
  ElectionBindingStatusProto,
  ElectionClassProto,
  ElectionDisclosureModeProto,
  ElectionGovernanceModeProto,
  ElectionGovernedActionTypeProto,
  ElectionGovernedProposalExecutionStatusProto,
  ElectionLifecycleStateProto,
  EligibilityMutationPolicyProto,
  EligibilitySourceTypeProto,
  OutcomeRuleKindProto,
  ParticipationPrivacyModeProto,
  ReportingPolicyProto,
  ReviewWindowPolicyProto,
  VoteUpdatePolicyProto,
} from '@/lib/grpc';
import { TrusteeGovernedProposalPanel } from './TrusteeGovernedProposalPanel';
import { useElectionsStore } from './useElectionsStore';

const { electionsServiceMock } = vi.hoisted(() => ({
  electionsServiceMock: {
    approveElectionGovernedProposal: vi.fn(),
    getElection: vi.fn(),
  },
}));

vi.mock('@/lib/grpc/services/elections', () => ({
  electionsService: electionsServiceMock,
}));

const timestamp = { seconds: 1_711_410_000, nanos: 0 };

function createElectionRecord(overrides?: Partial<ElectionRecordView>): ElectionRecordView {
  return {
    ElectionId: 'election-1',
    Title: 'Governed Referendum',
    ShortDescription: 'Policy vote',
    OwnerPublicAddress: 'owner-public-key',
    ExternalReferenceCode: 'REF-2026-01',
    LifecycleState: ElectionLifecycleStateProto.Open,
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
    OpenArtifactId: 'open-artifact',
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
    GovernedProposals: [
      {
        Id: 'proposal-1',
        ElectionId: 'election-1',
        ActionType: ElectionGovernedActionTypeProto.Close,
        LifecycleStateAtCreation: ElectionLifecycleStateProto.Open,
        ProposedByPublicAddress: 'owner-public-key',
        CreatedAt: timestamp,
        ExecutionStatus: ElectionGovernedProposalExecutionStatusProto.WaitingForApprovals,
        ExecutionFailureReason: '',
        LastExecutionTriggeredByPublicAddress: '',
      },
    ],
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
    Election: createElectionRecord(),
    CeremonyTranscriptEvents: [],
    GovernedProposal: {
      Id: 'proposal-1',
      ElectionId: 'election-1',
      ActionType: ElectionGovernedActionTypeProto.Close,
      LifecycleStateAtCreation: ElectionLifecycleStateProto.Open,
      ProposedByPublicAddress: 'owner-public-key',
      CreatedAt: timestamp,
      ExecutionStatus: ElectionGovernedProposalExecutionStatusProto.WaitingForApprovals,
      ExecutionFailureReason: '',
      LastExecutionTriggeredByPublicAddress: '',
    },
    ...overrides,
  };
}

describe('TrusteeGovernedProposalPanel', () => {
  beforeEach(() => {
    useElectionsStore.getState().reset();
    vi.clearAllMocks();
    electionsServiceMock.getElection.mockResolvedValue(createElectionResponse());
    electionsServiceMock.approveElectionGovernedProposal.mockResolvedValue(createCommandResponse());
  });

  it('loads the proposal detail and submits a trustee approval with the note', async () => {
    render(
      <TrusteeGovernedProposalPanel
        electionId="election-1"
        proposalId="proposal-1"
        actorPublicAddress="trustee-a"
      />
    );

    expect(await screen.findByTestId('trustee-proposal-summary')).toHaveTextContent(
      'Governed Referendum'
    );

    fireEvent.change(screen.getByTestId('trustee-approval-note'), {
      target: { value: 'Ready to approve.' },
    });
    fireEvent.click(screen.getByTestId('trustee-approve-button'));

    await waitFor(() => {
      expect(electionsServiceMock.approveElectionGovernedProposal).toHaveBeenCalledWith({
        ElectionId: 'election-1',
        ProposalId: 'proposal-1',
        ActorPublicAddress: 'trustee-a',
        ApprovalNote: 'Ready to approve.',
      });
    });
  });
});
