import {
  ElectionClosedProgressStatusProto,
  type ElectionHubEntryView,
  ElectionHubNextActionHintProto,
  type ElectionCeremonyProfile,
  ElectionCeremonyActionTypeProto,
  ElectionCeremonyActorRoleProto,
  ElectionCeremonyShareCustodyStatusProto,
  ElectionCeremonyVersionStatusProto,
  ElectionBindingStatusProto,
  ElectionClassProto,
  ElectionDisclosureModeProto,
  type ElectionDraftInput,
  type ElectionDraftSnapshot,
  type ElectionFinalizationReleaseEvidence,
  ElectionFinalizationReleaseModeProto,
  type ElectionFinalizationSession,
  ElectionFinalizationSessionPurposeProto,
  ElectionFinalizationSessionStatusProto,
  type ElectionFinalizationShare,
  ElectionFinalizationShareStatusProto,
  ElectionFinalizationTargetTypeProto,
  ElectionGovernedActionTypeProto,
  type ElectionGovernedProposal,
  type ElectionGovernedProposalApproval,
  ElectionGovernedProposalExecutionStatusProto,
  ElectionGovernanceModeProto,
  ElectionLifecycleStateProto,
  type ElectionOption,
  type ElectionRecordView,
  type ElectionSummary,
  ElectionTrusteeCeremonyStateProto,
  ElectionWarningCodeProto,
  EligibilityMutationPolicyProto,
  EligibilitySourceTypeProto,
  type GetElectionCeremonyActionViewResponse,
  type GetElectionResponse,
  type GrpcTimestamp,
  OfficialResultVisibilityPolicyProto,
  OutcomeRuleKindProto,
  ParticipationPrivacyModeProto,
  ReportingPolicyProto,
  ReviewWindowPolicyProto,
  VoteUpdatePolicyProto,
} from '@/lib/grpc';

export type ElectionSelectOption<TValue extends number> = {
  label: string;
  value: TValue;
  description: string;
};

export type ElectionWarningChoice = {
  code: ElectionWarningCodeProto;
  title: string;
  description: string;
};

export type CeremonyActionViewState = {
  actionType: ElectionCeremonyActionTypeProto;
  label: string;
  status: 'available' | 'completed' | 'blocked';
  reason: string;
};

export type ElectionWorkspaceSectionId =
  | 'voter'
  | 'owner-admin'
  | 'trustee'
  | 'auditor'
  | 'results';

export type ClosedProgressBannerState = {
  title: string;
  description: string;
};

export const DEFAULT_APPROVED_CLIENT_APPLICATIONS = [
  { ApplicationId: 'hushsocial', Version: '1.0.0' },
];

export const DEFAULT_PROTOCOL_OMEGA_VERSION = 'omega-v1.0.0';

export const BINDING_OPTIONS: ElectionSelectOption<ElectionBindingStatusProto>[] = [
  {
    value: ElectionBindingStatusProto.Binding,
    label: 'Binding',
    description: 'Results are intended to be the official organizational decision.',
  },
  {
    value: ElectionBindingStatusProto.NonBinding,
    label: 'Non-binding',
    description: 'Results are advisory but still follow the same lifecycle and frozen-policy rules.',
  },
];

export const GOVERNANCE_OPTIONS: ElectionSelectOption<ElectionGovernanceModeProto>[] = [
  {
    value: ElectionGovernanceModeProto.AdminOnly,
    label: 'Admin only',
    description: 'The owner can open, close, and finalize directly in FEAT-094.',
  },
  {
    value: ElectionGovernanceModeProto.TrusteeThreshold,
    label: 'Trustee threshold',
    description: 'Draft setup is supported now, but open remains blocked until FEAT-096.',
  },
];

export const OUTCOME_RULE_OPTIONS: ElectionSelectOption<OutcomeRuleKindProto>[] = [
  {
    value: OutcomeRuleKindProto.SingleWinner,
    label: 'Single winner',
    description: 'One winner is selected from the non-blank options.',
  },
  {
    value: OutcomeRuleKindProto.PassFail,
    label: 'Pass / fail',
    description: 'Two-option majority decision with blank votes reported separately.',
  },
];

export const WARNING_CHOICES: ElectionWarningChoice[] = [
  {
    code: ElectionWarningCodeProto.LowAnonymitySet,
    title: 'Low anonymity set',
    description:
      'Acknowledge that a small election reduces practical anonymity even with private ballots.',
  },
  {
    code: ElectionWarningCodeProto.AllTrusteesRequiredFragility,
    title: 'All trustees required fragility',
    description:
      'Acknowledge that requiring every accepted trustee can block lifecycle progress if one becomes unavailable.',
  },
];

const LIFECYCLE_LABELS: Record<ElectionLifecycleStateProto, string> = {
  [ElectionLifecycleStateProto.Draft]: 'Draft',
  [ElectionLifecycleStateProto.Open]: 'Open',
  [ElectionLifecycleStateProto.Closed]: 'Closed',
  [ElectionLifecycleStateProto.Finalized]: 'Finalized',
};

const BINDING_LABELS: Record<ElectionBindingStatusProto, string> = {
  [ElectionBindingStatusProto.Binding]: 'Binding',
  [ElectionBindingStatusProto.NonBinding]: 'Non-binding',
};

const GOVERNANCE_LABELS: Record<ElectionGovernanceModeProto, string> = {
  [ElectionGovernanceModeProto.AdminOnly]: 'Admin only',
  [ElectionGovernanceModeProto.TrusteeThreshold]: 'Trustee threshold',
};

const OUTCOME_LABELS: Record<OutcomeRuleKindProto, string> = {
  [OutcomeRuleKindProto.SingleWinner]: 'Single winner',
  [OutcomeRuleKindProto.PassFail]: 'Pass / fail',
  [OutcomeRuleKindProto.TopN]: 'Top N',
};

const DISCLOSURE_LABELS: Record<ElectionDisclosureModeProto, string> = {
  [ElectionDisclosureModeProto.FinalResultsOnly]: 'Final results only',
  [ElectionDisclosureModeProto.SeparatedParticipationAndResultReports]:
    'Separated participation and result reports',
  [ElectionDisclosureModeProto.SeparatedParticipationAndPlaintextBallotReports]:
    'Separated participation and plaintext ballot reports',
};

const PARTICIPATION_PRIVACY_LABELS: Record<ParticipationPrivacyModeProto, string> = {
  [ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice]:
    'Public checkoff, anonymous ballot, private choice',
};

const VOTE_UPDATE_LABELS: Record<VoteUpdatePolicyProto, string> = {
  [VoteUpdatePolicyProto.SingleSubmissionOnly]: 'Single submission only',
  [VoteUpdatePolicyProto.LatestValidVoteWins]: 'Latest valid vote wins',
};

const ELIGIBILITY_SOURCE_LABELS: Record<EligibilitySourceTypeProto, string> = {
  [EligibilitySourceTypeProto.OrganizationImportedRoster]: 'Organization imported roster',
};

const ELIGIBILITY_MUTATION_LABELS: Record<EligibilityMutationPolicyProto, string> = {
  [EligibilityMutationPolicyProto.FrozenAtOpen]: 'Frozen at open',
  [EligibilityMutationPolicyProto.LateActivationForRosteredVotersOnly]:
    'Late activation for rostered voters only',
};

const REPORTING_POLICY_LABELS: Record<ReportingPolicyProto, string> = {
  [ReportingPolicyProto.DefaultPhaseOnePackage]: 'Default phase one package',
};

const REVIEW_WINDOW_LABELS: Record<ReviewWindowPolicyProto, string> = {
  [ReviewWindowPolicyProto.NoReviewWindow]: 'No review window',
  [ReviewWindowPolicyProto.GovernedReviewWindowReserved]: 'Governed review window reserved',
};

const OFFICIAL_RESULT_VISIBILITY_LABELS: Record<OfficialResultVisibilityPolicyProto, string> = {
  [OfficialResultVisibilityPolicyProto.ParticipantEncryptedOnly]: 'Participant encrypted only',
  [OfficialResultVisibilityPolicyProto.PublicPlaintext]: 'Public plaintext',
};

const CLOSED_PROGRESS_STATUS_LABELS: Record<ElectionClosedProgressStatusProto, string> = {
  [ElectionClosedProgressStatusProto.ClosedProgressNone]: 'No active close processing',
  [ElectionClosedProgressStatusProto.ClosedProgressWaitingForTrusteeShares]:
    'Waiting for trustee shares',
  [ElectionClosedProgressStatusProto.ClosedProgressTallyCalculationInProgress]:
    'Tally calculation in progress',
};

const GOVERNED_ACTION_LABELS: Record<ElectionGovernedActionTypeProto, string> = {
  [ElectionGovernedActionTypeProto.Open]: 'Open',
  [ElectionGovernedActionTypeProto.Close]: 'Close',
  [ElectionGovernedActionTypeProto.Finalize]: 'Finalize',
};

const GOVERNED_PROPOSAL_STATUS_LABELS: Record<
  ElectionGovernedProposalExecutionStatusProto,
  string
> = {
  [ElectionGovernedProposalExecutionStatusProto.WaitingForApprovals]: 'Waiting for approvals',
  [ElectionGovernedProposalExecutionStatusProto.ExecutionSucceeded]: 'Executed',
  [ElectionGovernedProposalExecutionStatusProto.ExecutionFailed]: 'Execution failed',
};

const CEREMONY_VERSION_STATUS_LABELS: Record<ElectionCeremonyVersionStatusProto, string> = {
  [ElectionCeremonyVersionStatusProto.CeremonyVersionInProgress]: 'In progress',
  [ElectionCeremonyVersionStatusProto.CeremonyVersionReady]: 'Ready',
  [ElectionCeremonyVersionStatusProto.CeremonyVersionSuperseded]: 'Superseded',
};

const TRUSTEE_CEREMONY_STATE_LABELS: Record<ElectionTrusteeCeremonyStateProto, string> = {
  [ElectionTrusteeCeremonyStateProto.CeremonyStateInvited]: 'Invited',
  [ElectionTrusteeCeremonyStateProto.CeremonyStateAcceptedTrustee]: 'Accepted trustee',
  [ElectionTrusteeCeremonyStateProto.CeremonyStateNotStarted]: 'Not started',
  [ElectionTrusteeCeremonyStateProto.CeremonyStateJoined]: 'Joined',
  [ElectionTrusteeCeremonyStateProto.CeremonyStateMaterialSubmitted]: 'Material submitted',
  [ElectionTrusteeCeremonyStateProto.CeremonyStateValidationFailed]: 'Validation failed',
  [ElectionTrusteeCeremonyStateProto.CeremonyStateCompleted]: 'Completed',
  [ElectionTrusteeCeremonyStateProto.CeremonyStateRemoved]: 'Removed',
};

const CEREMONY_ACTION_LABELS: Record<ElectionCeremonyActionTypeProto, string> = {
  [ElectionCeremonyActionTypeProto.CeremonyActionUnknown]: 'Unknown action',
  [ElectionCeremonyActionTypeProto.CeremonyActionStartVersion]: 'Start ceremony',
  [ElectionCeremonyActionTypeProto.CeremonyActionRestartVersion]: 'Restart version',
  [ElectionCeremonyActionTypeProto.CeremonyActionPublishTransportKey]: 'Publish transport key',
  [ElectionCeremonyActionTypeProto.CeremonyActionJoinVersion]: 'Join version',
  [ElectionCeremonyActionTypeProto.CeremonyActionRunSelfTest]: 'Run self-test',
  [ElectionCeremonyActionTypeProto.CeremonyActionSubmitMaterial]: 'Submit material',
  [ElectionCeremonyActionTypeProto.CeremonyActionExportShare]: 'Export share backup',
  [ElectionCeremonyActionTypeProto.CeremonyActionImportShare]: 'Import share backup',
};

const CEREMONY_ACTOR_ROLE_LABELS: Record<ElectionCeremonyActorRoleProto, string> = {
  [ElectionCeremonyActorRoleProto.CeremonyActorUnknown]: 'Unknown',
  [ElectionCeremonyActorRoleProto.CeremonyActorOwner]: 'Owner',
  [ElectionCeremonyActorRoleProto.CeremonyActorTrustee]: 'Trustee',
  [ElectionCeremonyActorRoleProto.CeremonyActorReadOnly]: 'Read-only',
};

const CEREMONY_SHARE_CUSTODY_STATUS_LABELS: Record<ElectionCeremonyShareCustodyStatusProto, string> = {
  [ElectionCeremonyShareCustodyStatusProto.ShareCustodyNotExported]: 'Not exported',
  [ElectionCeremonyShareCustodyStatusProto.ShareCustodyExported]: 'Exported',
  [ElectionCeremonyShareCustodyStatusProto.ShareCustodyImported]: 'Imported',
  [ElectionCeremonyShareCustodyStatusProto.ShareCustodyImportFailed]: 'Import failed',
};

const FINALIZATION_SESSION_STATUS_LABELS: Record<ElectionFinalizationSessionStatusProto, string> = {
  [ElectionFinalizationSessionStatusProto.FinalizationSessionAwaitingShares]: 'Awaiting shares',
  [ElectionFinalizationSessionStatusProto.FinalizationSessionCompleted]: 'Completed',
};

const FINALIZATION_SESSION_PURPOSE_LABELS: Record<ElectionFinalizationSessionPurposeProto, string> = {
  [ElectionFinalizationSessionPurposeProto.FinalizationSessionPurposeCloseCounting]:
    'Close counting',
  [ElectionFinalizationSessionPurposeProto.FinalizationSessionPurposeFinalize]: 'Finalize',
};

const FINALIZATION_SHARE_STATUS_LABELS: Record<ElectionFinalizationShareStatusProto, string> = {
  [ElectionFinalizationShareStatusProto.FinalizationShareAccepted]: 'Accepted',
  [ElectionFinalizationShareStatusProto.FinalizationShareRejected]: 'Rejected',
};

const FINALIZATION_TARGET_TYPE_LABELS: Record<ElectionFinalizationTargetTypeProto, string> = {
  [ElectionFinalizationTargetTypeProto.FinalizationTargetAggregateTally]: 'Final aggregate tally',
  [ElectionFinalizationTargetTypeProto.FinalizationTargetSingleBallot]: 'Single ballot',
};

const FINALIZATION_RELEASE_MODE_LABELS: Record<ElectionFinalizationReleaseModeProto, string> = {
  [ElectionFinalizationReleaseModeProto.FinalizationReleaseAggregateTallyOnly]:
    'Aggregate tally only',
};

let nextOptionSeed = 1;

export function createElectionOption(ballotOrder: number, displayLabel = ''): ElectionOption {
  const optionId = `option-${nextOptionSeed}`;
  nextOptionSeed += 1;

  return {
    OptionId: optionId,
    DisplayLabel: displayLabel,
    ShortDescription: '',
    BallotOrder: ballotOrder,
    IsBlankOption: false,
  };
}

export function renumberElectionOptions(options: ElectionOption[]): ElectionOption[] {
  return options.map((option, index) => ({
    ...option,
    OptionId: option.OptionId || `option-${index + 1}`,
    BallotOrder: index + 1,
  }));
}

export function createSingleWinnerOutcomeRule(): ElectionDraftInput['OutcomeRule'] {
  return {
    Kind: OutcomeRuleKindProto.SingleWinner,
    TemplateKey: 'single_winner',
    SeatCount: 1,
    BlankVoteCountsForTurnout: true,
    BlankVoteExcludedFromWinnerSelection: true,
    BlankVoteExcludedFromThresholdDenominator: false,
    TieResolutionRule: 'tie_unresolved',
    CalculationBasis: 'highest_non_blank_votes',
  };
}

export function createPassFailOutcomeRule(): ElectionDraftInput['OutcomeRule'] {
  return {
    Kind: OutcomeRuleKindProto.PassFail,
    TemplateKey: 'pass_fail_yes_no',
    SeatCount: 1,
    BlankVoteCountsForTurnout: true,
    BlankVoteExcludedFromWinnerSelection: true,
    BlankVoteExcludedFromThresholdDenominator: true,
    TieResolutionRule: 'tie_unresolved',
    CalculationBasis: 'simple_majority_of_non_blank_votes',
  };
}

export function createOutcomeRuleForKind(kind: OutcomeRuleKindProto): ElectionDraftInput['OutcomeRule'] {
  return kind === OutcomeRuleKindProto.PassFail
    ? createPassFailOutcomeRule()
    : createSingleWinnerOutcomeRule();
}

export function getReviewWindowPolicyForGovernance(
  governanceMode: ElectionGovernanceModeProto
): ReviewWindowPolicyProto {
  return governanceMode === ElectionGovernanceModeProto.TrusteeThreshold
    ? ReviewWindowPolicyProto.GovernedReviewWindowReserved
    : ReviewWindowPolicyProto.NoReviewWindow;
}

export function applyGovernanceModeDefaults(
  draft: ElectionDraftInput,
  governanceMode: ElectionGovernanceModeProto
): ElectionDraftInput {
  return {
    ...draft,
    GovernanceMode: governanceMode,
    ReviewWindowPolicy: getReviewWindowPolicyForGovernance(governanceMode),
    RequiredApprovalCount:
      governanceMode === ElectionGovernanceModeProto.TrusteeThreshold
        ? Math.max(1, draft.RequiredApprovalCount ?? 1)
        : undefined,
  };
}

export function createDefaultElectionDraft(): ElectionDraftInput {
  return {
    Title: '',
    ShortDescription: '',
    ExternalReferenceCode: '',
    ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
    BindingStatus: ElectionBindingStatusProto.Binding,
    GovernanceMode: ElectionGovernanceModeProto.AdminOnly,
    DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
    ParticipationPrivacyMode:
      ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
    VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
    EligibilitySourceType: EligibilitySourceTypeProto.OrganizationImportedRoster,
    EligibilityMutationPolicy: EligibilityMutationPolicyProto.FrozenAtOpen,
    OutcomeRule: createSingleWinnerOutcomeRule(),
    ApprovedClientApplications: [...DEFAULT_APPROVED_CLIENT_APPLICATIONS],
    ProtocolOmegaVersion: DEFAULT_PROTOCOL_OMEGA_VERSION,
    ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
    ReviewWindowPolicy: ReviewWindowPolicyProto.NoReviewWindow,
    OwnerOptions: [createElectionOption(1), createElectionOption(2)],
    AcknowledgedWarningCodes: [],
    RequiredApprovalCount: undefined,
  };
}

export function createDraftFromElectionDetail(detail: GetElectionResponse | null): ElectionDraftInput {
  const draftSnapshot = detail?.LatestDraftSnapshot;
  if (draftSnapshot) {
    return {
      Title: draftSnapshot.Metadata.Title,
      ShortDescription: draftSnapshot.Metadata.ShortDescription,
      ExternalReferenceCode: draftSnapshot.Metadata.ExternalReferenceCode,
      ElectionClass: draftSnapshot.Policy.ElectionClass,
      BindingStatus: draftSnapshot.Policy.BindingStatus,
      GovernanceMode: draftSnapshot.Policy.GovernanceMode,
      DisclosureMode: draftSnapshot.Policy.DisclosureMode,
      ParticipationPrivacyMode: draftSnapshot.Policy.ParticipationPrivacyMode,
      VoteUpdatePolicy: draftSnapshot.Policy.VoteUpdatePolicy,
      EligibilitySourceType: draftSnapshot.Policy.EligibilitySourceType,
      EligibilityMutationPolicy: draftSnapshot.Policy.EligibilityMutationPolicy,
      OutcomeRule: { ...draftSnapshot.Policy.OutcomeRule },
      ApprovedClientApplications: draftSnapshot.Policy.ApprovedClientApplications.map((application) => ({
        ...application,
      })),
      ProtocolOmegaVersion: draftSnapshot.Policy.ProtocolOmegaVersion,
      ReportingPolicy: draftSnapshot.Policy.ReportingPolicy,
      ReviewWindowPolicy: draftSnapshot.Policy.ReviewWindowPolicy,
      OwnerOptions: renumberElectionOptions(
        draftSnapshot.Options.map((option) => ({
          ...option,
        }))
      ),
      AcknowledgedWarningCodes: [...draftSnapshot.AcknowledgedWarningCodes],
      RequiredApprovalCount: draftSnapshot.Policy.RequiredApprovalCount,
    };
  }

  const election = detail?.Election;
  if (election) {
    return {
      Title: election.Title,
      ShortDescription: election.ShortDescription,
      ExternalReferenceCode: election.ExternalReferenceCode,
      ElectionClass: election.ElectionClass,
      BindingStatus: election.BindingStatus,
      GovernanceMode: election.GovernanceMode,
      DisclosureMode: election.DisclosureMode,
      ParticipationPrivacyMode: election.ParticipationPrivacyMode,
      VoteUpdatePolicy: election.VoteUpdatePolicy,
      EligibilitySourceType: election.EligibilitySourceType,
      EligibilityMutationPolicy: election.EligibilityMutationPolicy,
      OutcomeRule: { ...election.OutcomeRule },
      ApprovedClientApplications: election.ApprovedClientApplications.map((application) => ({
        ...application,
      })),
      ProtocolOmegaVersion: election.ProtocolOmegaVersion,
      ReportingPolicy: election.ReportingPolicy,
      ReviewWindowPolicy: election.ReviewWindowPolicy,
      OwnerOptions: renumberElectionOptions(
        election.Options.map((option) => ({
          ...option,
        }))
      ),
      AcknowledgedWarningCodes: [...election.AcknowledgedWarningCodes],
      RequiredApprovalCount: election.RequiredApprovalCount,
    };
  }

  return createDefaultElectionDraft();
}

export function normalizeElectionDraft(draft: ElectionDraftInput): ElectionDraftInput {
  return {
    ...draft,
    Title: draft.Title.trim(),
    ShortDescription: draft.ShortDescription.trim(),
    ExternalReferenceCode: draft.ExternalReferenceCode.trim(),
    OutcomeRule: {
      ...draft.OutcomeRule,
      TemplateKey: draft.OutcomeRule.TemplateKey.trim(),
      TieResolutionRule: draft.OutcomeRule.TieResolutionRule.trim(),
      CalculationBasis: draft.OutcomeRule.CalculationBasis.trim(),
    },
    ApprovedClientApplications: draft.ApprovedClientApplications
      .map((application) => ({
        ApplicationId: application.ApplicationId.trim(),
        Version: application.Version.trim(),
      }))
      .filter((application) => application.ApplicationId.length > 0 && application.Version.length > 0),
    OwnerOptions: renumberElectionOptions(
      draft.OwnerOptions.map((option) => ({
        ...option,
        DisplayLabel: option.DisplayLabel.trim(),
        ShortDescription: option.ShortDescription.trim(),
      }))
    ),
    AcknowledgedWarningCodes: [...draft.AcknowledgedWarningCodes].sort((left, right) => left - right),
    RequiredApprovalCount:
      draft.GovernanceMode === ElectionGovernanceModeProto.TrusteeThreshold
        ? draft.RequiredApprovalCount ?? 1
        : undefined,
  };
}

export function getLifecycleLabel(lifecycleState?: ElectionLifecycleStateProto): string {
  if (lifecycleState === undefined) {
    return 'Unsaved draft';
  }

  return LIFECYCLE_LABELS[lifecycleState];
}

export function getBindingLabel(bindingStatus: ElectionBindingStatusProto): string {
  return BINDING_LABELS[bindingStatus];
}

export function getElectionClassLabel(electionClass: ElectionClassProto): string {
  switch (electionClass) {
    case ElectionClassProto.OrganizationalRemoteVoting:
      return 'Organizational remote voting';
    case ElectionClassProto.PrivatePoll:
      return 'Private poll';
    case ElectionClassProto.SeriousSecretBallotVoting:
      return 'Serious secret ballot voting';
    default:
      return 'Unknown election class';
  }
}

export function getGovernanceLabel(governanceMode: ElectionGovernanceModeProto): string {
  return GOVERNANCE_LABELS[governanceMode];
}

export function getOutcomeRuleLabel(kind: OutcomeRuleKindProto): string {
  return OUTCOME_LABELS[kind];
}

export function getDisclosureModeLabel(mode: ElectionDisclosureModeProto): string {
  return DISCLOSURE_LABELS[mode];
}

export function getParticipationPrivacyLabel(mode: ParticipationPrivacyModeProto): string {
  return PARTICIPATION_PRIVACY_LABELS[mode];
}

export function getVoteUpdatePolicyLabel(policy: VoteUpdatePolicyProto): string {
  return VOTE_UPDATE_LABELS[policy];
}

export function getEligibilitySourceLabel(source: EligibilitySourceTypeProto): string {
  return ELIGIBILITY_SOURCE_LABELS[source];
}

export function getEligibilityMutationLabel(policy: EligibilityMutationPolicyProto): string {
  return ELIGIBILITY_MUTATION_LABELS[policy];
}

export function getReportingPolicyLabel(policy: ReportingPolicyProto): string {
  return REPORTING_POLICY_LABELS[policy];
}

export function getReviewWindowPolicyLabel(policy: ReviewWindowPolicyProto): string {
  return REVIEW_WINDOW_LABELS[policy];
}

export function getOfficialResultVisibilityLabel(
  policy: OfficialResultVisibilityPolicyProto
): string {
  return OFFICIAL_RESULT_VISIBILITY_LABELS[policy];
}

export function getClosedProgressStatusLabel(
  status: ElectionClosedProgressStatusProto
): string {
  return CLOSED_PROGRESS_STATUS_LABELS[status] ?? 'Unknown';
}

export function getWarningTitle(code: ElectionWarningCodeProto): string {
  return WARNING_CHOICES.find((warning) => warning.code === code)?.title ?? 'Unspecified warning';
}

export type GovernedActionViewStatus =
  | 'available'
  | 'pending'
  | 'execution_failed'
  | 'completed'
  | 'unavailable'
  | 'finalize_not_tally_ready';

export interface GovernedProposalProgress {
  approvalCount: number;
  requiredApprovalCount: number | null;
  approvals: ElectionGovernedProposalApproval[];
}

export interface GovernedActionViewState extends GovernedProposalProgress {
  actionType: ElectionGovernedActionTypeProto;
  label: string;
  status: GovernedActionViewStatus;
  reason: string;
  proposal: ElectionGovernedProposal | null;
}

function timestampToMilliseconds(timestamp?: GrpcTimestamp): number {
  if (!timestamp) {
    return 0;
  }

  return (timestamp.seconds * 1000) + Math.floor(timestamp.nanos / 1_000_000);
}

export function formatTimestamp(timestamp?: GrpcTimestamp): string {
  if (!timestamp) {
    return 'Not recorded';
  }

  const milliseconds = (timestamp.seconds * 1000) + Math.floor(timestamp.nanos / 1_000_000);
  return new Date(milliseconds).toLocaleString();
}

export function formatArtifactValue(value?: string): string {
  if (!value) {
    return 'Not recorded';
  }

  if (value.length <= 24) {
    return value;
  }

  return `${value.slice(0, 12)}...${value.slice(-8)}`;
}

export function getGovernedActionLabel(actionType: ElectionGovernedActionTypeProto): string {
  return GOVERNED_ACTION_LABELS[actionType];
}

export function getGovernedProposalExecutionStatusLabel(
  status: ElectionGovernedProposalExecutionStatusProto
): string {
  return GOVERNED_PROPOSAL_STATUS_LABELS[status];
}

export function getGovernedProposalApprovals(
  detail: GetElectionResponse | null,
  proposalId: string
): ElectionGovernedProposalApproval[] {
  return (detail?.GovernedProposalApprovals ?? [])
    .filter((approval) => approval.ProposalId === proposalId)
    .sort(
      (left, right) => timestampToMilliseconds(left.ApprovedAt) - timestampToMilliseconds(right.ApprovedAt)
    );
}

export function getLatestGovernedProposal(
  detail: GetElectionResponse | null,
  actionType?: ElectionGovernedActionTypeProto
): ElectionGovernedProposal | null {
  const proposals = (detail?.GovernedProposals ?? [])
    .filter((proposal) => actionType === undefined || proposal.ActionType === actionType)
    .sort(
      (left, right) => timestampToMilliseconds(right.CreatedAt) - timestampToMilliseconds(left.CreatedAt)
    );

  return proposals[0] ?? null;
}

export function getPendingGovernedProposal(detail: GetElectionResponse | null): ElectionGovernedProposal | null {
  const proposals = detail?.GovernedProposals ?? [];

  return (
    proposals
      .filter(
        (proposal) =>
          proposal.ExecutionStatus !== ElectionGovernedProposalExecutionStatusProto.ExecutionSucceeded
      )
      .sort(
        (left, right) => timestampToMilliseconds(right.CreatedAt) - timestampToMilliseconds(left.CreatedAt)
      )[0] ?? null
  );
}

export function getGovernedProposalProgress(
  detail: GetElectionResponse | null,
  proposalId: string
): GovernedProposalProgress {
  const approvals = getGovernedProposalApprovals(detail, proposalId);
  const requiredApprovalCount = detail?.Election?.RequiredApprovalCount ?? null;

  return {
    approvalCount: approvals.length,
    requiredApprovalCount,
    approvals,
  };
}

export function isDraftEditable(election?: ElectionRecordView): boolean {
  return !election || election.LifecycleState === ElectionLifecycleStateProto.Draft;
}

export function canOpenElection(election?: ElectionRecordView): boolean {
  return !!election &&
    election.LifecycleState === ElectionLifecycleStateProto.Draft &&
    election.GovernanceMode === ElectionGovernanceModeProto.AdminOnly;
}

export function canCloseElection(election?: ElectionRecordView): boolean {
  return election?.LifecycleState === ElectionLifecycleStateProto.Open &&
    election.GovernanceMode === ElectionGovernanceModeProto.AdminOnly;
}

export function canFinalizeElection(election?: ElectionRecordView): boolean {
  return election?.LifecycleState === ElectionLifecycleStateProto.Closed &&
    election.GovernanceMode === ElectionGovernanceModeProto.AdminOnly;
}

function buildPendingGovernedReason(
  actionType: ElectionGovernedActionTypeProto,
  election: ElectionRecordView
): string {
  switch (actionType) {
    case ElectionGovernedActionTypeProto.Open:
      return 'Draft edits are locked while trustee approval is pending.';
    case ElectionGovernedActionTypeProto.Close:
      return election.VoteAcceptanceLockedAt
        ? 'Vote acceptance is already locked while trustee approval is pending.'
        : 'Trustee approval is pending before the election can close.';
    case ElectionGovernedActionTypeProto.Finalize:
      return 'Trustee approval is pending before finalization can execute.';
    default:
      return 'Trustee approval is pending.';
  }
}

function buildGovernedAvailabilityState(
  detail: GetElectionResponse | null,
  actionType: ElectionGovernedActionTypeProto
): GovernedActionViewState {
  const election = detail?.Election;
  const label = getGovernedActionLabel(actionType);
  const proposal = getLatestGovernedProposal(detail, actionType);
  const progress = proposal
    ? getGovernedProposalProgress(detail, proposal.Id)
    : {
        approvalCount: 0,
        requiredApprovalCount: election?.RequiredApprovalCount ?? null,
        approvals: [],
      };

  if (!election) {
    return {
      actionType,
      label,
      status: 'unavailable',
      reason: `${label} is unavailable until election details load.`,
      proposal: null,
      ...progress,
    };
  }

  const pendingProposal = getPendingGovernedProposal(detail);
  if (
    pendingProposal &&
    pendingProposal.ActionType === actionType &&
    pendingProposal.ExecutionStatus === ElectionGovernedProposalExecutionStatusProto.WaitingForApprovals
  ) {
    return {
      actionType,
      label,
      status: 'pending',
      reason: buildPendingGovernedReason(actionType, election),
      proposal: pendingProposal,
      ...getGovernedProposalProgress(detail, pendingProposal.Id),
    };
  }

  if (
    proposal &&
    proposal.ExecutionStatus === ElectionGovernedProposalExecutionStatusProto.ExecutionFailed
  ) {
    return {
      actionType,
      label,
      status: 'execution_failed',
      reason:
        proposal.ExecutionFailureReason || `${label} execution failed. The owner can retry the proposal.`,
      proposal,
      ...progress,
    };
  }

  if (pendingProposal && pendingProposal.ActionType !== actionType) {
    return {
      actionType,
      label,
      status: 'unavailable',
      reason: `${getGovernedActionLabel(pendingProposal.ActionType)} is already pending for this election.`,
      proposal,
      ...progress,
    };
  }

  switch (actionType) {
    case ElectionGovernedActionTypeProto.Open:
      if (election.LifecycleState === ElectionLifecycleStateProto.Draft) {
        return {
          actionType,
          label,
          status: 'available',
          reason: 'Start trustee approval to open the election.',
          proposal,
          ...progress,
        };
      }

      return {
        actionType,
        label,
        status: 'completed',
        reason: 'The election is already open or beyond.',
        proposal,
        ...progress,
      };

    case ElectionGovernedActionTypeProto.Close:
      if (election.LifecycleState === ElectionLifecycleStateProto.Open) {
        return {
          actionType,
          label,
          status: 'available',
          reason: 'Starting close locks vote acceptance immediately while trustee approval is pending.',
          proposal,
          ...progress,
        };
      }

      if (election.LifecycleState === ElectionLifecycleStateProto.Closed ||
          election.LifecycleState === ElectionLifecycleStateProto.Finalized) {
        return {
          actionType,
          label,
          status: 'completed',
          reason: 'The election is already closed.',
          proposal,
          ...progress,
        };
      }

      return {
        actionType,
        label,
        status: 'unavailable',
        reason: 'Close proposals are only available while the election is open.',
        proposal,
        ...progress,
      };

    case ElectionGovernedActionTypeProto.Finalize:
      if (election.LifecycleState === ElectionLifecycleStateProto.Finalized) {
        return {
          actionType,
          label,
          status: 'completed',
          reason: 'The election is already finalized.',
          proposal,
          ...progress,
        };
      }

      if (election.LifecycleState !== ElectionLifecycleStateProto.Closed) {
        return {
          actionType,
          label,
          status: 'unavailable',
          reason: 'Finalize proposals are only available while the election is closed.',
          proposal,
          ...progress,
        };
      }

      if (!election.TallyReadyAt) {
        return {
          actionType,
          label,
          status: 'finalize_not_tally_ready',
          reason: 'Finalize remains unavailable until tally readiness is recorded.',
          proposal,
          ...progress,
        };
      }

      return {
        actionType,
        label,
        status: 'available',
        reason: 'Tally readiness is recorded and trustees can approve finalization.',
        proposal,
        ...progress,
      };

    default:
      return {
        actionType,
        label,
        status: 'unavailable',
        reason: `${label} is unavailable.`,
        proposal,
        ...progress,
      };
  }
}

export function getGovernedActionViewStates(detail: GetElectionResponse | null): GovernedActionViewState[] {
  if (detail?.Election?.GovernanceMode !== ElectionGovernanceModeProto.TrusteeThreshold) {
    return [];
  }

  return [
    buildGovernedAvailabilityState(detail, ElectionGovernedActionTypeProto.Open),
    buildGovernedAvailabilityState(detail, ElectionGovernedActionTypeProto.Close),
    buildGovernedAvailabilityState(detail, ElectionGovernedActionTypeProto.Finalize),
  ];
}

export function getGovernedActionStatusLabel(status: GovernedActionViewState['status']): string {
  switch (status) {
    case 'available':
      return 'Available';
    case 'pending':
      return 'Pending';
    case 'execution_failed':
      return 'Execution failed';
    case 'completed':
      return 'Completed';
    case 'finalize_not_tally_ready':
      return 'Awaiting tally readiness';
    case 'unavailable':
    default:
      return 'Unavailable';
  }
}

export function getGovernedActionStatusClass(status: GovernedActionViewState['status']): string {
  switch (status) {
    case 'available':
      return 'border-green-500/40 bg-green-500/10 text-green-100';
    case 'pending':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-100';
    case 'execution_failed':
      return 'border-red-500/40 bg-red-500/10 text-red-100';
    case 'completed':
      return 'border-hush-purple/40 bg-hush-purple/10 text-hush-purple';
    case 'finalize_not_tally_ready':
      return 'border-blue-500/40 bg-blue-500/10 text-blue-100';
    case 'unavailable':
    default:
      return 'border-hush-bg-light bg-hush-bg-dark text-hush-text-accent';
  }
}

export function getLatestFinalizationSession(
  detail: GetElectionResponse | null
): ElectionFinalizationSession | null {
  const sessions = (detail?.FinalizationSessions ?? [])
    .slice()
    .sort(
      (left, right) => timestampToMilliseconds(right.CreatedAt) - timestampToMilliseconds(left.CreatedAt)
    );

  return sessions[0] ?? null;
}

export function getActiveFinalizationSession(
  detail: GetElectionResponse | null
): ElectionFinalizationSession | null {
  const sessions = (detail?.FinalizationSessions ?? [])
    .filter(
      (session) =>
        session.Status === ElectionFinalizationSessionStatusProto.FinalizationSessionAwaitingShares
    )
    .sort(
      (left, right) => timestampToMilliseconds(right.CreatedAt) - timestampToMilliseconds(left.CreatedAt)
    );

  return sessions[0] ?? null;
}

export function getFinalizationShares(
  detail: GetElectionResponse | null,
  finalizationSessionId?: string
): ElectionFinalizationShare[] {
  return (detail?.FinalizationShares ?? [])
    .filter((share) => !finalizationSessionId || share.FinalizationSessionId === finalizationSessionId)
    .slice()
    .sort(
      (left, right) => timestampToMilliseconds(right.SubmittedAt) - timestampToMilliseconds(left.SubmittedAt)
    );
}

export function getLatestFinalizationReleaseEvidence(
  detail: GetElectionResponse | null,
  finalizationSessionId?: string
): ElectionFinalizationReleaseEvidence | null {
  const records = (detail?.FinalizationReleaseEvidenceRecords ?? [])
    .filter((record) => !finalizationSessionId || record.FinalizationSessionId === finalizationSessionId)
    .slice()
    .sort(
      (left, right) => timestampToMilliseconds(right.CompletedAt) - timestampToMilliseconds(left.CompletedAt)
    );

  return records[0] ?? null;
}

export function getAcceptedFinalizationShareCount(
  detail: GetElectionResponse | null,
  finalizationSessionId?: string
): number {
  return getFinalizationShares(detail, finalizationSessionId).filter(
    (share) => share.Status === ElectionFinalizationShareStatusProto.FinalizationShareAccepted
  ).length;
}

export function getLatestFinalizationShareForTrustee(
  detail: GetElectionResponse | null,
  trusteeUserAddress: string,
  finalizationSessionId?: string
): ElectionFinalizationShare | null {
  return (
    getFinalizationShares(detail, finalizationSessionId).find(
      (share) => share.TrusteeUserAddress === trusteeUserAddress
    ) ?? null
  );
}

export function getAllowedCeremonyProfiles(detail: GetElectionResponse | null): ElectionCeremonyProfile[] {
  return detail?.CeremonyProfiles ?? [];
}

export function getActiveCeremonyVersion(detail: GetElectionResponse | null) {
  const versions = (detail?.CeremonyVersions ?? [])
    .filter((version) => version.Status !== ElectionCeremonyVersionStatusProto.CeremonyVersionSuperseded)
    .sort(
      (left, right) => timestampToMilliseconds(right.StartedAt) - timestampToMilliseconds(left.StartedAt)
    );

  return versions[0] ?? null;
}

export function getSupersededCeremonyVersions(detail: GetElectionResponse | null) {
  return (detail?.CeremonyVersions ?? [])
    .filter((version) => version.Status === ElectionCeremonyVersionStatusProto.CeremonyVersionSuperseded)
    .sort(
      (left, right) =>
        timestampToMilliseconds(right.SupersededAt ?? right.StartedAt) -
        timestampToMilliseconds(left.SupersededAt ?? left.StartedAt)
    );
}

export function getCeremonyTranscriptEvents(
  detail: GetElectionResponse | null,
  ceremonyVersionId?: string
) {
  return (detail?.CeremonyTranscriptEvents ?? [])
    .filter((event) => !ceremonyVersionId || event.CeremonyVersionId === ceremonyVersionId)
    .sort(
      (left, right) => timestampToMilliseconds(left.OccurredAt) - timestampToMilliseconds(right.OccurredAt)
    );
}

export function getActiveCeremonyTrusteeStates(detail: GetElectionResponse | null) {
  return (detail?.ActiveCeremonyTrusteeStates ?? [])
    .slice()
    .sort((left, right) => left.TrusteeDisplayName.localeCompare(right.TrusteeDisplayName));
}

export function getCeremonyVersionStatusLabel(status: ElectionCeremonyVersionStatusProto): string {
  return CEREMONY_VERSION_STATUS_LABELS[status] ?? 'Unknown';
}

export function getTrusteeCeremonyStateLabel(state: ElectionTrusteeCeremonyStateProto): string {
  return TRUSTEE_CEREMONY_STATE_LABELS[state] ?? 'Unknown';
}

export function getCeremonyActionLabel(actionType: ElectionCeremonyActionTypeProto): string {
  return CEREMONY_ACTION_LABELS[actionType] ?? 'Unknown action';
}

export function getCeremonyActorRoleLabel(actorRole: ElectionCeremonyActorRoleProto): string {
  return CEREMONY_ACTOR_ROLE_LABELS[actorRole] ?? 'Unknown';
}

export function getCeremonyShareCustodyStatusLabel(
  status: ElectionCeremonyShareCustodyStatusProto
): string {
  return CEREMONY_SHARE_CUSTODY_STATUS_LABELS[status] ?? 'Unknown';
}

export function getFinalizationSessionStatusLabel(
  status: ElectionFinalizationSessionStatusProto
): string {
  return FINALIZATION_SESSION_STATUS_LABELS[status] ?? 'Unknown';
}

export function getFinalizationSessionPurposeLabel(
  purpose: ElectionFinalizationSessionPurposeProto
): string {
  return FINALIZATION_SESSION_PURPOSE_LABELS[purpose] ?? 'Unknown';
}

export function getFinalizationShareStatusLabel(
  status: ElectionFinalizationShareStatusProto
): string {
  return FINALIZATION_SHARE_STATUS_LABELS[status] ?? 'Unknown';
}

export function getFinalizationTargetTypeLabel(
  targetType: ElectionFinalizationTargetTypeProto
): string {
  return FINALIZATION_TARGET_TYPE_LABELS[targetType] ?? 'Unknown';
}

export function getFinalizationReleaseModeLabel(
  releaseMode: ElectionFinalizationReleaseModeProto
): string {
  return FINALIZATION_RELEASE_MODE_LABELS[releaseMode] ?? 'Unknown';
}

export function getCeremonyActionViewStates(
  view: GetElectionCeremonyActionViewResponse | null,
  scope: 'owner' | 'trustee'
): CeremonyActionViewState[] {
  const actions = scope === 'owner' ? view?.OwnerActions : view?.TrusteeActions;
  if (!actions?.length) {
    return [];
  }

  return actions.map((action) => ({
    actionType: action.ActionType,
    label: getCeremonyActionLabel(action.ActionType),
    status: action.IsCompleted ? 'completed' : action.IsAvailable ? 'available' : 'blocked',
    reason: action.Reason,
  }));
}

export function getUnsupportedDraftValueMessages(draft: ElectionDraftInput): string[] {
  const messages: string[] = [];

  if (draft.ElectionClass !== ElectionClassProto.OrganizationalRemoteVoting) {
    messages.push('FEAT-094 only supports organizational remote voting elections.');
  }

  if (draft.DisclosureMode !== ElectionDisclosureModeProto.FinalResultsOnly) {
    messages.push('FEAT-094 only supports the final-results-only disclosure mode.');
  }

  if (
    draft.ParticipationPrivacyMode !==
    ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice
  ) {
    messages.push('FEAT-094 only supports the phase-one participation privacy mode.');
  }

  if (draft.VoteUpdatePolicy !== VoteUpdatePolicyProto.SingleSubmissionOnly) {
    messages.push('FEAT-094 only supports the single-submission-only vote update policy.');
  }

  if (draft.EligibilitySourceType !== EligibilitySourceTypeProto.OrganizationImportedRoster) {
    messages.push('FEAT-094 only supports the organization-imported-roster eligibility source.');
  }

  if (draft.EligibilityMutationPolicy !== EligibilityMutationPolicyProto.FrozenAtOpen) {
    messages.push('FEAT-094 only supports the frozen-at-open eligibility mutation policy.');
  }

  if (draft.ReportingPolicy !== ReportingPolicyProto.DefaultPhaseOnePackage) {
    messages.push('FEAT-094 only supports the default phase-one reporting policy.');
  }

  if (
    draft.GovernanceMode === ElectionGovernanceModeProto.AdminOnly &&
    draft.ReviewWindowPolicy !== ReviewWindowPolicyProto.NoReviewWindow
  ) {
    messages.push('Admin-only elections must use the no-review-window policy in FEAT-094.');
  }

  if (
    draft.GovernanceMode === ElectionGovernanceModeProto.TrusteeThreshold &&
    draft.ReviewWindowPolicy !== ReviewWindowPolicyProto.GovernedReviewWindowReserved
  ) {
    messages.push(
      'Trustee-threshold drafts should reserve the governed review-window policy for FEAT-096.'
    );
  }

  return messages;
}

export function getDraftSaveValidationErrors(draft: ElectionDraftInput): string[] {
  const errors = [...getUnsupportedDraftValueMessages(draft)];

  if (!draft.Title.trim()) {
    errors.push('Election title is required.');
  }

  if (!draft.ProtocolOmegaVersion.trim()) {
    errors.push('Protocol Omega version is required.');
  }

  if (!draft.OutcomeRule.TemplateKey.trim()) {
    errors.push('Outcome rule template key is required.');
  }

  if (!draft.OutcomeRule.TieResolutionRule.trim()) {
    errors.push('Outcome rule tie-resolution policy is required.');
  }

  if (!draft.OutcomeRule.CalculationBasis.trim()) {
    errors.push('Outcome rule calculation basis is required.');
  }

  if (!draft.OutcomeRule.BlankVoteCountsForTurnout) {
    errors.push('Blank vote turnout accounting must remain enabled in FEAT-094.');
  }

  if (!draft.OutcomeRule.BlankVoteExcludedFromWinnerSelection) {
    errors.push('Blank vote must remain excluded from winner selection in FEAT-094.');
  }

  switch (draft.OutcomeRule.Kind) {
    case OutcomeRuleKindProto.SingleWinner:
      if (draft.OutcomeRule.SeatCount !== 1) {
        errors.push('Single-winner elections must use seat count 1.');
      }
      break;
    case OutcomeRuleKindProto.PassFail:
      if (draft.OutcomeRule.SeatCount !== 1) {
        errors.push('Pass / fail elections must use seat count 1.');
      }
      if (!draft.OutcomeRule.BlankVoteExcludedFromThresholdDenominator) {
        errors.push('Pass / fail elections must exclude blank votes from the threshold denominator.');
      }
      break;
    default:
      errors.push('FEAT-094 does not support this outcome rule kind.');
      break;
  }

  if (draft.GovernanceMode === ElectionGovernanceModeProto.AdminOnly && draft.RequiredApprovalCount) {
    errors.push('Admin-only elections must not set a required approval count.');
  }

  if (
    draft.GovernanceMode === ElectionGovernanceModeProto.TrusteeThreshold &&
    (!draft.RequiredApprovalCount || draft.RequiredApprovalCount < 1)
  ) {
    errors.push('Trustee-threshold elections require a required approval count of at least 1.');
  }

  if (draft.OwnerOptions.length === 0) {
    errors.push('At least one owner-managed option is required.');
  }

  const optionIds = new Set<string>();
  const ballotOrders = new Set<number>();

  draft.OwnerOptions.forEach((option, index) => {
    const trimmedId = option.OptionId.trim();
    const trimmedLabel = option.DisplayLabel.trim();

    if (!trimmedId) {
      errors.push(`Option ${index + 1} must have a stable option id.`);
    } else {
      const normalizedId = trimmedId.toLowerCase();
      if (optionIds.has(normalizedId)) {
        errors.push('Election option ids must be unique.');
      }
      optionIds.add(normalizedId);
    }

    if (!trimmedLabel) {
      errors.push(`Option ${index + 1} must have a display label.`);
    }

    if (option.BallotOrder < 1) {
      errors.push('Election option ballot order must be 1 or greater.');
    } else if (ballotOrders.has(option.BallotOrder)) {
      errors.push('Election option ballot order must be unique.');
    } else {
      ballotOrders.add(option.BallotOrder);
    }

    if (option.IsBlankOption) {
      errors.push('Owner options must not mark themselves as the reserved blank vote option.');
    }
  });

  return Array.from(new Set(errors));
}

export function getDraftOpenValidationErrors(draft: ElectionDraftInput): string[] {
  const errors: string[] = [];
  const nonBlankOptions = draft.OwnerOptions.filter((option) => option.DisplayLabel.trim().length > 0);

  if (nonBlankOptions.length < 2) {
    errors.push('At least two non-blank options are required before opening the election.');
  }

  if (draft.OutcomeRule.Kind === OutcomeRuleKindProto.PassFail && nonBlankOptions.length !== 2) {
    errors.push('Pass / fail elections require exactly two non-blank options before open.');
  }

  if (
    draft.GovernanceMode === ElectionGovernanceModeProto.TrusteeThreshold &&
    (!draft.RequiredApprovalCount || draft.RequiredApprovalCount < 1)
  ) {
    errors.push('Trustee-threshold elections require a required approval count before open.');
  }

  if (
    draft.GovernanceMode === ElectionGovernanceModeProto.AdminOnly &&
    draft.ReviewWindowPolicy !== ReviewWindowPolicyProto.NoReviewWindow
  ) {
    errors.push('Admin-only elections must use the no-review-window policy in FEAT-094.');
  }

  return errors;
}

export function getRequiredOpenWarningCodes(
  draft: ElectionDraftInput,
  acceptedTrusteeCount = 0
): ElectionWarningCodeProto[] {
  const warningCodes = new Set<ElectionWarningCodeProto>(draft.AcknowledgedWarningCodes);

  if (
    draft.GovernanceMode === ElectionGovernanceModeProto.TrusteeThreshold &&
    draft.RequiredApprovalCount &&
    acceptedTrusteeCount === draft.RequiredApprovalCount
  ) {
    warningCodes.add(ElectionWarningCodeProto.AllTrusteesRequiredFragility);
  }

  return Array.from(warningCodes).sort((left, right) => left - right);
}

export function getDraftRevisionLabel(
  draftSnapshot?: ElectionDraftSnapshot,
  election?: ElectionRecordView
): string {
  if (draftSnapshot) {
    return `Draft revision ${draftSnapshot.DraftRevision}`;
  }

  if (election) {
    return `Draft revision ${election.CurrentDraftRevision}`;
  }

  return 'Unsaved draft';
}

export function getSummaryBadge(summary: ElectionSummary): string {
  return `${getLifecycleLabel(summary.LifecycleState)} | ${getGovernanceLabel(summary.GovernanceMode)}`;
}

export function getElectionHubSuggestedActionLabel(
  suggestedAction: ElectionHubNextActionHintProto
): string {
  switch (suggestedAction) {
    case ElectionHubNextActionHintProto.ElectionHubActionOwnerManageDraft:
      return 'Manage draft';
    case ElectionHubNextActionHintProto.ElectionHubActionOwnerOpenElection:
      return 'Open election';
    case ElectionHubNextActionHintProto.ElectionHubActionOwnerMonitorClosedProgress:
      return 'Monitor close progress';
    case ElectionHubNextActionHintProto.ElectionHubActionOwnerReviewFinalResult:
      return 'Review final result';
    case ElectionHubNextActionHintProto.ElectionHubActionVoterClaimIdentity:
      return 'Claim voter identity';
    case ElectionHubNextActionHintProto.ElectionHubActionVoterCastBallot:
      return 'Cast ballot';
    case ElectionHubNextActionHintProto.ElectionHubActionVoterReviewResult:
      return 'Review result';
    case ElectionHubNextActionHintProto.ElectionHubActionTrusteeApproveGovernedAction:
      return 'Review governed action';
    case ElectionHubNextActionHintProto.ElectionHubActionTrusteeReviewResult:
      return 'Review trustee result';
    case ElectionHubNextActionHintProto.ElectionHubActionAuditorReviewPackage:
      return 'Review package';
    case ElectionHubNextActionHintProto.ElectionHubActionNone:
    default:
      return 'No suggested action';
  }
}

export function getClosedProgressBannerState(
  entry: ElectionHubEntryView | null
): ClosedProgressBannerState | null {
  if (!entry || entry.Election.LifecycleState !== ElectionLifecycleStateProto.Closed) {
    return null;
  }

  switch (entry.ClosedProgressStatus) {
    case ElectionClosedProgressStatusProto.ClosedProgressWaitingForTrusteeShares:
      return {
        title: 'Waiting for trustee shares',
        description:
          'The election is closed and waiting for the required trustee shares before tally work can continue.',
      };
    case ElectionClosedProgressStatusProto.ClosedProgressTallyCalculationInProgress:
      return {
        title: 'Tally calculation in progress',
        description:
          'The close boundary is sealed and tally processing is running on the persisted election state.',
      };
    default:
      return null;
  }
}

export function getElectionWorkspaceSectionOrder(
  entry: ElectionHubEntryView | null
): ElectionWorkspaceSectionId[] {
  if (!entry) {
    return [];
  }

  const sections: ElectionWorkspaceSectionId[] = [];
  const canOpenVoterSurface = entry.ActorRoles.IsVoter || entry.CanClaimIdentity;
  const isOpenVoter =
    canOpenVoterSurface && entry.Election.LifecycleState === ElectionLifecycleStateProto.Open;

  if (isOpenVoter) {
    sections.push('voter');
  }

  if (entry.ActorRoles.IsOwnerAdmin) {
    sections.push('owner-admin');
  }

  if (entry.ActorRoles.IsTrustee) {
    sections.push('trustee');
  }

  if (entry.ActorRoles.IsDesignatedAuditor) {
    sections.push('auditor');
  }

  if (canOpenVoterSurface && !isOpenVoter) {
    sections.push('voter');
  }

  if (entry.CanViewParticipantResults || entry.CanViewReportPackage) {
    sections.push('results');
  }

  return sections;
}
