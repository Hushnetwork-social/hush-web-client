import { describe, expect, it } from 'vitest';
import type { ElectionRecordView, GetElectionResponse } from '@/lib/grpc';
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
import { getGovernedActionViewStates } from './contracts';

const timestamp = { seconds: 1_711_410_000, nanos: 0 };

function createElectionRecord(
  lifecycleState: ElectionLifecycleStateProto,
  overrides?: Partial<ElectionRecordView>
): ElectionRecordView {
  return {
    ElectionId: 'election-1',
    Title: 'Governed Referendum',
    ShortDescription: 'Policy vote',
    OwnerPublicAddress: 'owner-public-key',
    ExternalReferenceCode: 'REF-2026-01',
    LifecycleState: lifecycleState,
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

function createDetail(overrides?: Partial<GetElectionResponse>): GetElectionResponse {
  return {
    Success: true,
    ErrorMessage: '',
    Election: createElectionRecord(ElectionLifecycleStateProto.Draft),
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

describe('governed action view-state mapping', () => {
  it('marks pending close as pending and preserves the immediate vote-lock meaning', () => {
    const detail = createDetail({
      Election: createElectionRecord(ElectionLifecycleStateProto.Open, {
        VoteAcceptanceLockedAt: timestamp,
      }),
      GovernedProposals: [
        {
          Id: 'proposal-close',
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
      GovernedProposalApprovals: [
        {
          Id: 'approval-1',
          ProposalId: 'proposal-close',
          ElectionId: 'election-1',
          ActionType: ElectionGovernedActionTypeProto.Close,
          LifecycleStateAtProposalCreation: ElectionLifecycleStateProto.Open,
          TrusteeUserAddress: 'trustee-a',
          TrusteeDisplayName: 'Alice',
          ApprovalNote: 'Ready.',
          ApprovedAt: timestamp,
        },
      ],
    });

    const closeState = getGovernedActionViewStates(detail).find(
      (state) => state.actionType === ElectionGovernedActionTypeProto.Close
    );

    expect(closeState?.status).toBe('pending');
    expect(closeState?.approvalCount).toBe(1);
    expect(closeState?.reason).toContain('Vote acceptance is already locked');
  });

  it('exposes finalize-not-tally-ready explicitly instead of collapsing it into unavailable', () => {
    const detail = createDetail({
      Election: createElectionRecord(ElectionLifecycleStateProto.Closed, {
        TallyReadyAt: undefined,
      }),
    });

    const finalizeState = getGovernedActionViewStates(detail).find(
      (state) => state.actionType === ElectionGovernedActionTypeProto.Finalize
    );

    expect(finalizeState?.status).toBe('finalize_not_tally_ready');
    expect(finalizeState?.reason).toContain('tally readiness');
  });
});
