import {
  ElectionCloseCountingJobStatusProto,
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
  type ElectionProtocolPackageBindingView,
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
  ProtocolPackageApprovalStatusProto,
  ProtocolPackageBindingStatusProto,
  ProtocolPackageExternalReviewStatusProto,
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
  | 'results'
  | 'artifacts';

export type ClosedProgressBannerState = {
  title: string;
  description: string;
};

type ClosedProgressNarrativeAudience =
  | 'owner-admin'
  | 'trustee'
  | 'auditor'
  | 'voter'
  | 'generic';

type PublishedResultNarrativeAudience = ClosedProgressNarrativeAudience;

export const DEFAULT_APPROVED_CLIENT_APPLICATIONS = [
  { ApplicationId: 'hushsocial', Version: '1.0.0' },
];

export const DEFAULT_PROTOCOL_OMEGA_VERSION = 'omega-v1.0.0';
const DEFAULT_CEREMONY_PROFILE_TIMESTAMP: GrpcTimestamp = {
  seconds: 0,
  nanos: 0,
};
const TRUSTEE_PRODUCTION_PROFILE_ID = 'dkg-prod-3of5';
const TRUSTEE_DEV_PROFILE_ID = 'dkg-dev-3of5';
const ADMIN_ONLY_PRODUCTION_PROFILE_ID = 'admin-prod-1of1';
const ADMIN_ONLY_DEV_PROFILE_ID = 'admin-dev-1of1';

const DEFAULT_TRUSTEE_CEREMONY_PROFILES: ElectionCeremonyProfile[] = [
  {
    ProfileId: TRUSTEE_PRODUCTION_PROFILE_ID,
    DisplayName: 'Default protected circuit (3 of 5)',
    Description:
      'Built-in protected circuit for binding elections and non-binding protected audit runs.',
    ProviderKey: 'built-in',
    ProfileVersion: 'v1',
    TrusteeCount: 5,
    RequiredApprovalCount: 3,
    DevOnly: false,
    RegisteredAt: DEFAULT_CEREMONY_PROFILE_TIMESTAMP,
    LastUpdatedAt: DEFAULT_CEREMONY_PROFILE_TIMESTAMP,
  },
  {
    ProfileId: TRUSTEE_DEV_PROFILE_ID,
    DisplayName: 'Open audit circuit (3 of 5)',
    Description:
      'Built-in dev/open circuit for explicit non-binding audit elections with readable ballots.',
    ProviderKey: 'built-in',
    ProfileVersion: 'v1',
    TrusteeCount: 5,
    RequiredApprovalCount: 3,
    DevOnly: true,
    RegisteredAt: DEFAULT_CEREMONY_PROFILE_TIMESTAMP,
    LastUpdatedAt: DEFAULT_CEREMONY_PROFILE_TIMESTAMP,
  },
];
const DEFAULT_ADMIN_ONLY_CEREMONY_PROFILES: ElectionCeremonyProfile[] = [
  {
    ProfileId: ADMIN_ONLY_PRODUCTION_PROFILE_ID,
    DisplayName: 'Admin-only protected circuit',
    Description:
      'Built-in protected circuit for admin-only elections with aggregate-only protected tally custody.',
    ProviderKey: 'built-in-admin',
    ProfileVersion: 'omega-v1.0.0-admin-prod-1of1',
    TrusteeCount: 1,
    RequiredApprovalCount: 1,
    DevOnly: false,
    RegisteredAt: DEFAULT_CEREMONY_PROFILE_TIMESTAMP,
    LastUpdatedAt: DEFAULT_CEREMONY_PROFILE_TIMESTAMP,
  },
  {
    ProfileId: ADMIN_ONLY_DEV_PROFILE_ID,
    DisplayName: 'Admin-only open audit circuit',
    Description:
      'Built-in dev/open circuit for explicit non-binding admin-only audit elections with readable ballots.',
    ProviderKey: 'built-in-admin',
    ProfileVersion: 'omega-v1.0.0-admin-dev-1of1',
    TrusteeCount: 1,
    RequiredApprovalCount: 1,
    DevOnly: true,
    RegisteredAt: DEFAULT_CEREMONY_PROFILE_TIMESTAMP,
    LastUpdatedAt: DEFAULT_CEREMONY_PROFILE_TIMESTAMP,
  },
];

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
    description: 'Draft setup is supported now, but open requires governed trustee approval.',
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
    'Waiting for trustee tally shares',
  [ElectionClosedProgressStatusProto.ClosedProgressTallyCalculationInProgress]:
    'Unofficial tally calculation in progress',
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
  [ElectionTrusteeCeremonyStateProto.CeremonyStateAcceptedTrustee]: 'Awaiting join',
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
  [ElectionCeremonyActionTypeProto.CeremonyActionSubmitMaterial]: 'Submit ceremony package',
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

const CLOSE_COUNTING_JOB_STATUS_LABELS: Record<ElectionCloseCountingJobStatusProto, string> = {
  [ElectionCloseCountingJobStatusProto.CloseCountingJobPending]: 'Pending',
  [ElectionCloseCountingJobStatusProto.CloseCountingJobAwaitingShares]:
    'Awaiting trustee shares',
  [ElectionCloseCountingJobStatusProto.CloseCountingJobThresholdReached]:
    'Threshold reached',
  [ElectionCloseCountingJobStatusProto.CloseCountingJobRunning]: 'Executor running',
  [ElectionCloseCountingJobStatusProto.CloseCountingJobPublishing]:
    'Publishing unofficial result',
  [ElectionCloseCountingJobStatusProto.CloseCountingJobCompleted]: 'Completed',
  [ElectionCloseCountingJobStatusProto.CloseCountingJobFailed]: 'Failed',
  [ElectionCloseCountingJobStatusProto.CloseCountingJobSuperseded]: 'Superseded',
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

export function getOwnerManagedElectionOptions(options: ElectionOption[]): ElectionOption[] {
  return renumberElectionOptions(
    options
      .filter((option) => !option.IsBlankOption)
      .map((option) => ({
        ...option,
        IsBlankOption: false,
      }))
  );
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

function normalizeSelectedCeremonyProfileId(
  governanceMode: ElectionGovernanceModeProto,
  profileId?: string | null
): string {
  const normalizedProfileId = profileId?.trim() ?? '';
  if (!normalizedProfileId) {
    return '';
  }

  if (governanceMode !== ElectionGovernanceModeProto.AdminOnly) {
    return normalizedProfileId;
  }

  if (normalizedProfileId === TRUSTEE_PRODUCTION_PROFILE_ID) {
    return ADMIN_ONLY_PRODUCTION_PROFILE_ID;
  }

  if (normalizedProfileId === TRUSTEE_DEV_PROFILE_ID) {
    return ADMIN_ONLY_DEV_PROFILE_ID;
  }

  return normalizedProfileId;
}

function getDefaultCeremonyProfiles(
  governanceMode: ElectionGovernanceModeProto
): ElectionCeremonyProfile[] {
  return governanceMode === ElectionGovernanceModeProto.AdminOnly
    ? DEFAULT_ADMIN_ONLY_CEREMONY_PROFILES
    : DEFAULT_TRUSTEE_CEREMONY_PROFILES;
}

export function getAvailableCeremonyProfiles(
  detail: GetElectionResponse | null,
  governanceMode?: ElectionGovernanceModeProto
): ElectionCeremonyProfile[] {
  const effectiveGovernanceMode =
    governanceMode ??
    detail?.LatestDraftSnapshot?.Policy.GovernanceMode ??
    detail?.Election?.GovernanceMode ??
    ElectionGovernanceModeProto.AdminOnly;
  const detailGovernanceMode =
    detail?.LatestDraftSnapshot?.Policy.GovernanceMode ??
    detail?.Election?.GovernanceMode;

  if (!detail?.CeremonyProfiles?.length) {
    return getDefaultCeremonyProfiles(effectiveGovernanceMode);
  }

  return detailGovernanceMode === effectiveGovernanceMode
    ? detail.CeremonyProfiles
    : getDefaultCeremonyProfiles(effectiveGovernanceMode);
}

export function isCeremonyProfileCompatible(
  bindingStatus: ElectionBindingStatusProto,
  profile: Pick<ElectionCeremonyProfile, 'DevOnly'>
): boolean {
  return bindingStatus === ElectionBindingStatusProto.Binding ? !profile.DevOnly : true;
}

export function findCeremonyProfileById(
  profiles: ElectionCeremonyProfile[],
  profileId?: string | null,
  governanceMode: ElectionGovernanceModeProto = ElectionGovernanceModeProto.AdminOnly
): ElectionCeremonyProfile | null {
  const normalizedProfileId = normalizeSelectedCeremonyProfileId(
    governanceMode,
    profileId
  );
  if (!normalizedProfileId) {
    return null;
  }

  return (
    profiles.find((profile) => profile.ProfileId === normalizedProfileId) ??
    getDefaultCeremonyProfiles(governanceMode).find(
      (profile) => profile.ProfileId === normalizedProfileId
    ) ??
    null
  );
}

export function getAllowedCeremonyProfiles(
  detail: GetElectionResponse | null,
  bindingStatus?: ElectionBindingStatusProto,
  governanceMode?: ElectionGovernanceModeProto
): ElectionCeremonyProfile[] {
  const effectiveGovernanceMode =
    governanceMode ??
    detail?.LatestDraftSnapshot?.Policy.GovernanceMode ??
    detail?.Election?.GovernanceMode ??
    ElectionGovernanceModeProto.AdminOnly;
  const profiles = getAvailableCeremonyProfiles(detail, effectiveGovernanceMode);
  if (bindingStatus === undefined) {
    return profiles;
  }

  return profiles.filter((profile) => isCeremonyProfileCompatible(bindingStatus, profile));
}

export function coerceSelectedCeremonyProfileId(
  bindingStatus: ElectionBindingStatusProto,
  governanceMode: ElectionGovernanceModeProto,
  selectedProfileId: string,
  profiles: ElectionCeremonyProfile[]
): string {
  const compatibleProfiles = profiles.filter((profile) =>
    isCeremonyProfileCompatible(bindingStatus, profile)
  );
  const normalizedSelectedProfileId = normalizeSelectedCeremonyProfileId(
    governanceMode,
    selectedProfileId
  );
  if (
    normalizedSelectedProfileId &&
    compatibleProfiles.some((profile) => profile.ProfileId === normalizedSelectedProfileId)
  ) {
    return normalizedSelectedProfileId;
  }

  return compatibleProfiles[0]?.ProfileId ??
    getDefaultCeremonyProfiles(governanceMode).find((profile) =>
      isCeremonyProfileCompatible(bindingStatus, profile)
    )?.ProfileId ??
    getDefaultCeremonyProfiles(governanceMode)[0].ProfileId;
}

export function resolveSelectedProfileDevOnly(
  profileId: string | null | undefined,
  explicitDevOnly: boolean | undefined,
  profiles: ElectionCeremonyProfile[],
  governanceMode: ElectionGovernanceModeProto = ElectionGovernanceModeProto.AdminOnly
): boolean | undefined {
  if (explicitDevOnly !== undefined) {
    return explicitDevOnly;
  }

  return findCeremonyProfileById(profiles, profileId, governanceMode)?.DevOnly;
}

export function createDefaultElectionDraft(): ElectionDraftInput {
  return {
    Title: '',
    ShortDescription: '',
    ExternalReferenceCode: '',
    ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
    BindingStatus: ElectionBindingStatusProto.Binding,
    SelectedProfileId: ADMIN_ONLY_PRODUCTION_PROFILE_ID,
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
    OwnerOptions: [],
    AcknowledgedWarningCodes: [],
    RequiredApprovalCount: undefined,
  };
}

export function createDraftFromElectionDetail(detail: GetElectionResponse | null): ElectionDraftInput {
  const draftSnapshot = detail?.LatestDraftSnapshot;
  if (draftSnapshot) {
    const governanceMode = draftSnapshot.Policy.GovernanceMode;
    const availableProfiles = getAvailableCeremonyProfiles(detail, governanceMode);
    return {
      Title: draftSnapshot.Metadata.Title,
      ShortDescription: draftSnapshot.Metadata.ShortDescription,
      ExternalReferenceCode: draftSnapshot.Metadata.ExternalReferenceCode,
      ElectionClass: draftSnapshot.Policy.ElectionClass,
      BindingStatus: draftSnapshot.Policy.BindingStatus,
      SelectedProfileId: coerceSelectedCeremonyProfileId(
        draftSnapshot.Policy.BindingStatus,
        governanceMode,
        draftSnapshot.Policy.SelectedProfileId || '',
        availableProfiles
      ),
      GovernanceMode: governanceMode,
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
      OwnerOptions: getOwnerManagedElectionOptions(draftSnapshot.Options),
      AcknowledgedWarningCodes: [...draftSnapshot.AcknowledgedWarningCodes],
      RequiredApprovalCount: draftSnapshot.Policy.RequiredApprovalCount,
    };
  }

  const election = detail?.Election;
  if (election) {
    const governanceMode = election.GovernanceMode;
    const availableProfiles = getAvailableCeremonyProfiles(detail, governanceMode);
    return {
      Title: election.Title,
      ShortDescription: election.ShortDescription,
      ExternalReferenceCode: election.ExternalReferenceCode,
      ElectionClass: election.ElectionClass,
      BindingStatus: election.BindingStatus,
      SelectedProfileId: coerceSelectedCeremonyProfileId(
        election.BindingStatus,
        governanceMode,
        election.SelectedProfileId || '',
        availableProfiles
      ),
      GovernanceMode: governanceMode,
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
      OwnerOptions: getOwnerManagedElectionOptions(election.Options),
      AcknowledgedWarningCodes: [...election.AcknowledgedWarningCodes],
      RequiredApprovalCount: election.RequiredApprovalCount,
    };
  }

  return createDefaultElectionDraft();
}

export function normalizeElectionDraft(
  draft: ElectionDraftInput,
  availableProfilesOverride?: ElectionCeremonyProfile[]
): ElectionDraftInput {
  const availableProfiles =
    availableProfilesOverride?.length
      ? availableProfilesOverride
      : getAvailableCeremonyProfiles(null, draft.GovernanceMode);
  const selectedProfileId = coerceSelectedCeremonyProfileId(
    draft.BindingStatus,
    draft.GovernanceMode,
    draft.SelectedProfileId,
    availableProfiles
  );
  const selectedProfile = findCeremonyProfileById(
    availableProfiles,
    selectedProfileId,
    draft.GovernanceMode
  );

  return {
    ...draft,
    Title: draft.Title.trim(),
    ShortDescription: draft.ShortDescription.trim(),
    ExternalReferenceCode: draft.ExternalReferenceCode.trim(),
    SelectedProfileId: selectedProfileId,
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
    OwnerOptions: getOwnerManagedElectionOptions(
      draft.OwnerOptions.map((option) => ({
        ...option,
        DisplayLabel: option.DisplayLabel.trim(),
        ShortDescription: option.ShortDescription.trim(),
      }))
    ),
    AcknowledgedWarningCodes: [...draft.AcknowledgedWarningCodes].sort((left, right) => left - right),
    RequiredApprovalCount:
      draft.GovernanceMode === ElectionGovernanceModeProto.TrusteeThreshold
        ? Math.max(1, selectedProfile?.RequiredApprovalCount ?? draft.RequiredApprovalCount ?? 1)
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

export function getModeProfileFamilyLabel(bindingStatus: ElectionBindingStatusProto): string {
  return bindingStatus === ElectionBindingStatusProto.NonBinding
    ? 'dev/open and non-dev circuits'
    : 'non-dev circuits';
}

export function getSelectedProfileFamilyLabel(selectedProfileDevOnly?: boolean): string {
  if (selectedProfileDevOnly === undefined) {
    return 'Not recorded';
  }

  return selectedProfileDevOnly ? 'Dev/open circuit' : 'Non-dev circuit';
}

export function getSecrecyBoundaryCopy(selectedProfileDevOnly?: boolean): string {
  if (selectedProfileDevOnly === undefined) {
    return 'The bound circuit is not recorded on this surface yet. Secrecy claims should be read from the selected or frozen profile once it is available.';
  }

  return selectedProfileDevOnly
    ? 'This election uses the explicit open-audit circuit. Readable ballot content may appear where artifact visibility allows, so this path is excluded from secret-ballot claims.'
    : 'This election uses a protected non-dev circuit. Result and report artifacts should expose aggregate outcomes and circuit metadata, not readable ballot choices.';
}

export function getGovernancePathLabel(governanceMode: ElectionGovernanceModeProto): string {
  return governanceMode === ElectionGovernanceModeProto.AdminOnly
    ? 'Admin-only protected custody path'
    : 'Trustee-threshold aggregate release path';
}

export function getCustodyBoundaryCopy(governanceMode: ElectionGovernanceModeProto): string {
  return governanceMode === ElectionGovernanceModeProto.AdminOnly
    ? 'Admin-only protected custody keeps tally release bound to the owner-admin protected custody profile. This path does not expose trustee shares, reusable tally private keys, or single-ballot inspection authority.'
    : 'Trustee-threshold custody requires exact-target aggregate tally release with executor-bound trustee submissions. This path does not expose arbitrary ballot inspection, raw trustee shares on persisted surfaces, or reusable tally private keys.';
}

export function getModeProfileFreezeCopy(bindingStatus: ElectionBindingStatusProto): string {
  return bindingStatus === ElectionBindingStatusProto.NonBinding
    ? 'Non-binding elections may choose either a dev/open circuit or a non-dev circuit. The selected circuit/profile locks before open.'
    : 'Binding elections may choose only non-dev circuits. The selected circuit/profile locks before open.';
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

export type ProtocolPackageBindingTone = 'success' | 'warning' | 'error' | 'neutral';

export interface ProtocolPackageBindingPresentation {
  status: ProtocolPackageBindingStatusProto;
  label: string;
  tone: ProtocolPackageBindingTone;
  description: string;
  openBlocked: boolean;
  version: string;
  specHashShort: string;
  proofHashShort: string;
  releaseHashShort: string;
  specHashFull: string;
  proofHashFull: string;
  releaseHashFull: string;
  approvalLabel: string;
  externalReviewLabel: string;
}

const PROTOCOL_PACKAGE_STATUS_COPY: Record<
  ProtocolPackageBindingStatusProto,
  Pick<ProtocolPackageBindingPresentation, 'label' | 'tone' | 'description' | 'openBlocked'>
> = {
  [ProtocolPackageBindingStatusProto.Missing]: {
    label: 'Missing package refs',
    tone: 'error',
    description: 'Opening is blocked until the latest approved Protocol Omega package is selected.',
    openBlocked: true,
  },
  [ProtocolPackageBindingStatusProto.Latest]: {
    label: 'Latest approved',
    tone: 'success',
    description: 'Compatible package refs are ready and will be sealed when the election opens.',
    openBlocked: false,
  },
  [ProtocolPackageBindingStatusProto.Stale]: {
    label: 'Stale package refs',
    tone: 'warning',
    description: 'Opening is blocked until the owner refreshes to the latest approved compatible package.',
    openBlocked: true,
  },
  [ProtocolPackageBindingStatusProto.Incompatible]: {
    label: 'Incompatible package refs',
    tone: 'error',
    description: 'Opening is blocked because the selected profile no longer matches the package refs.',
    openBlocked: true,
  },
  [ProtocolPackageBindingStatusProto.Sealed]: {
    label: 'Sealed at open',
    tone: 'neutral',
    description: 'These package refs are immutable evidence for this election.',
    openBlocked: false,
  },
  [ProtocolPackageBindingStatusProto.ReferenceOnly]: {
    label: 'Reference only',
    tone: 'warning',
    description:
      'These refs were backfilled for inspection and must not be treated as refs sealed during opening.',
    openBlocked: true,
  },
};

const PROTOCOL_PACKAGE_APPROVAL_LABELS: Record<ProtocolPackageApprovalStatusProto, string> = {
  [ProtocolPackageApprovalStatusProto.DraftPrivate]: 'Draft/private',
  [ProtocolPackageApprovalStatusProto.ApprovedInternal]: 'Approved internal',
  [ProtocolPackageApprovalStatusProto.Retired]: 'Retired',
};

const PROTOCOL_PACKAGE_EXTERNAL_REVIEW_LABELS: Record<ProtocolPackageExternalReviewStatusProto, string> = {
  [ProtocolPackageExternalReviewStatusProto.NotReviewed]: 'Not externally reviewed',
  [ProtocolPackageExternalReviewStatusProto.ReviewRequested]: 'External review requested',
  [ProtocolPackageExternalReviewStatusProto.ReviewInProgress]: 'External review in progress',
  [ProtocolPackageExternalReviewStatusProto.ReviewedWithFindings]: 'Reviewed with findings',
  [ProtocolPackageExternalReviewStatusProto.ReviewedAccepted]: 'External review accepted',
};

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

export function formatArtifactValue(value?: unknown): string {
  if (value === undefined || value === null || value === '') {
    return 'Not recorded';
  }

  let normalizedValue: string;

  if (typeof value === 'string') {
    normalizedValue = value;
  } else if (
    typeof value === 'object' &&
    value !== null &&
    'value' in value &&
    typeof (value as { value?: unknown }).value === 'string'
  ) {
    normalizedValue = (value as { value: string }).value;
  } else if (typeof value === 'object') {
    try {
      normalizedValue = JSON.stringify(value);
    } catch {
      normalizedValue = String(value);
    }
  } else {
    normalizedValue = String(value);
  }

  if (!normalizedValue || normalizedValue === '""') {
    return 'Not recorded';
  }

  if (normalizedValue.length <= 24) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, 12)}...${normalizedValue.slice(-8)}`;
}

export function shortenProtocolPackageHash(value?: string | null): string {
  const normalizedValue = value?.trim() ?? '';
  if (!normalizedValue) {
    return 'Not recorded';
  }

  if (normalizedValue.length <= 24) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, 12)}...${normalizedValue.slice(-8)}`;
}

export function getProtocolPackageApprovalLabel(status?: ProtocolPackageApprovalStatusProto): string {
  return status === undefined
    ? 'Unknown approval status'
    : PROTOCOL_PACKAGE_APPROVAL_LABELS[status] ?? 'Unknown approval status';
}

export function getProtocolPackageExternalReviewLabel(
  status?: ProtocolPackageExternalReviewStatusProto
): string {
  return status === undefined
    ? 'Unknown external review status'
    : PROTOCOL_PACKAGE_EXTERNAL_REVIEW_LABELS[status] ?? 'Unknown external review status';
}

export function getProtocolPackageBindingStatusLabel(
  status: ProtocolPackageBindingStatusProto
): string {
  return PROTOCOL_PACKAGE_STATUS_COPY[status]?.label ?? 'Unknown package state';
}

export function getProtocolPackageBindingPresentation(
  binding?: ElectionProtocolPackageBindingView | null,
  fallbackStatus: ProtocolPackageBindingStatusProto = ProtocolPackageBindingStatusProto.Missing,
  fallbackMessage?: string | null
): ProtocolPackageBindingPresentation {
  const status = binding?.Status ?? fallbackStatus;
  const copy = PROTOCOL_PACKAGE_STATUS_COPY[status] ?? PROTOCOL_PACKAGE_STATUS_COPY[ProtocolPackageBindingStatusProto.Missing];
  const fallbackText = fallbackMessage?.trim();

  return {
    status,
    label: copy.label,
    tone: copy.tone,
    description: fallbackText || copy.description,
    openBlocked: copy.openBlocked,
    version: binding?.PackageVersion || 'Not selected',
    specHashShort: shortenProtocolPackageHash(binding?.SpecPackageHash),
    proofHashShort: shortenProtocolPackageHash(binding?.ProofPackageHash),
    releaseHashShort: shortenProtocolPackageHash(binding?.ReleaseManifestHash),
    specHashFull: binding?.SpecPackageHash || '',
    proofHashFull: binding?.ProofPackageHash || '',
    releaseHashFull: binding?.ReleaseManifestHash || '',
    approvalLabel: getProtocolPackageApprovalLabel(binding?.PackageApprovalStatus),
    externalReviewLabel: getProtocolPackageExternalReviewLabel(binding?.ExternalReviewStatus),
  };
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

export function getFixedCeremonyProfileShape(detail: GetElectionResponse | null): {
  trusteeCount: number;
  requiredApprovalCount: number;
} | null {
  const governanceMode =
    detail?.LatestDraftSnapshot?.Policy.GovernanceMode ??
    detail?.Election?.GovernanceMode ??
    ElectionGovernanceModeProto.AdminOnly;
  if (governanceMode !== ElectionGovernanceModeProto.TrusteeThreshold) {
    return null;
  }

  const profiles = getAvailableCeremonyProfiles(
    detail,
    ElectionGovernanceModeProto.TrusteeThreshold
  );
  if (profiles.length === 0) {
    return null;
  }

  const trusteeCounts = Array.from(
    new Set(
      profiles
        .map((profile) => profile.TrusteeCount)
        .filter((trusteeCount) => trusteeCount > 0)
    )
  );
  const requiredApprovalCounts = Array.from(
    new Set(
      profiles
        .map((profile) => profile.RequiredApprovalCount)
        .filter((requiredApprovalCount) => requiredApprovalCount > 0)
    )
  );

  if (trusteeCounts.length !== 1 || requiredApprovalCounts.length !== 1) {
    return null;
  }

  return {
    trusteeCount: trusteeCounts[0],
    requiredApprovalCount: requiredApprovalCounts[0],
  };
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

export function getCloseCountingJobStatusLabel(
  status: ElectionCloseCountingJobStatusProto
): string {
  return CLOSE_COUNTING_JOB_STATUS_LABELS[status] ?? 'Unknown';
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
    messages.push('Trustee-threshold drafts should reserve the governed review-window policy.');
  }

  return messages;
}

export function getDraftSaveValidationErrors(draft: ElectionDraftInput): string[] {
  const errors = [...getUnsupportedDraftValueMessages(draft)];
  const ownerManagedOptions = getOwnerManagedElectionOptions(draft.OwnerOptions);

  if (!draft.Title.trim()) {
    errors.push('Election title is required.');
  }

  if (!draft.SelectedProfileId.trim()) {
    errors.push('A selected circuit / profile is required.');
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

  const optionIds = new Set<string>();
  const ballotOrders = new Set<number>();

  ownerManagedOptions.forEach((option, index) => {
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
  });

  return Array.from(new Set(errors));
}

export function getDraftOpenValidationErrors(draft: ElectionDraftInput): string[] {
  const errors: string[] = [];
  const nonBlankOptions = getOwnerManagedElectionOptions(draft.OwnerOptions).filter(
    (option) => option.DisplayLabel.trim().length > 0
  );

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

export function getElectionHubDisplayActionLabel(
  entry: Pick<
    ElectionHubEntryView,
    | 'ActorRoles'
    | 'SuggestedAction'
    | 'SuggestedActionReason'
    | 'Election'
    | 'ClosedProgressStatus'
    | 'HasUnofficialResult'
    | 'HasOfficialResult'
  >
): string {
  if (entry.HasOfficialResult) {
    return 'Review official result';
  }

  if (entry.HasUnofficialResult) {
    return 'Review unofficial result';
  }

  if (entry.SuggestedAction !== ElectionHubNextActionHintProto.ElectionHubActionNone) {
    return getElectionHubSuggestedActionLabel(entry.SuggestedAction);
  }

  const normalizedReason = entry.SuggestedActionReason.trim().toLowerCase();
  if (normalizedReason.includes('trustee invitation')) {
    return 'Respond to invitation';
  }

  if (
    entry.ActorRoles.IsTrustee &&
    normalizedReason.startsWith('continue the trustee ceremony.')
  ) {
    return 'Continue ceremony';
  }

  if (
    entry.ActorRoles.IsTrustee &&
    normalizedReason.startsWith('submit the bound trustee tally share for close-counting.')
  ) {
    return 'Submit tally share';
  }

  if (
    entry.ActorRoles.IsTrustee &&
    normalizedReason.startsWith('resubmit the bound trustee tally share for close-counting.')
  ) {
    return 'Resubmit tally share';
  }

  if (
    entry.Election.LifecycleState === ElectionLifecycleStateProto.Closed &&
    !entry.HasUnofficialResult &&
    !entry.HasOfficialResult
  ) {
    if (entry.ActorRoles.IsVoter) {
      return 'Waiting for unofficial result';
    }

    if (entry.ActorRoles.IsDesignatedAuditor) {
      return 'Await result package';
    }

    if (entry.ActorRoles.IsTrustee) {
      return 'Monitor tally phase';
    }
  }

  return getElectionHubSuggestedActionLabel(entry.SuggestedAction);
}

function resolveClosedProgressNarrativeAudience(
  entry: Pick<ElectionHubEntryView, 'ActorRoles'>
): ClosedProgressNarrativeAudience {
  if (entry.ActorRoles.IsOwnerAdmin) {
    return 'owner-admin';
  }

  if (entry.ActorRoles.IsTrustee) {
    return 'trustee';
  }

  if (entry.ActorRoles.IsDesignatedAuditor) {
    return 'auditor';
  }

  if (entry.ActorRoles.IsVoter) {
    return 'voter';
  }

  return 'generic';
}

export function getPublishedResultNarrative(
  entry: Pick<
    ElectionHubEntryView,
    | 'ActorRoles'
    | 'Election'
    | 'HasUnofficialResult'
    | 'HasOfficialResult'
  >,
  audience: PublishedResultNarrativeAudience = resolveClosedProgressNarrativeAudience(entry)
): ClosedProgressBannerState | null {
  if (!entry.HasUnofficialResult && !entry.HasOfficialResult) {
    return null;
  }

  if (entry.HasOfficialResult) {
    switch (audience) {
      case 'owner-admin':
        return {
          title: 'Official result published',
          description:
            'Finalization is complete and the official result is published. Report packages and boundary artifacts remain separate review surfaces.',
        };
      case 'trustee':
        return {
          title: 'Official result published',
          description:
            'Finalization is complete and the official result is published. Trustee operational steps are complete for this election.',
        };
      case 'auditor':
        return {
          title: 'Official result published',
          description:
            'Finalization is complete and the official result is published. Auditor-visible report artifacts remain available through the separate artifact/package surface.',
        };
      case 'voter':
        return {
          title: 'Official result published',
          description:
            'Finalization is complete and the official result is published. Voting is closed, and the voter surface remains available only for personal context and receipt verification.',
        };
      case 'generic':
      default:
        return {
          title: 'Official result published',
          description:
            'Finalization is complete and the official result is now published for this election.',
        };
    }
  }

  switch (audience) {
    case 'owner-admin':
      return {
        title: 'Unofficial result published',
        description:
          'Election close is complete and the unofficial result is published. Finalization remains the separate governed step that creates the official result.',
      };
    case 'trustee':
      return {
        title: 'Unofficial result published',
        description:
          'Election close is complete and the unofficial result is published. The trustee tally-share workflow is complete, and finalization remains the separate governed step.',
      };
    case 'auditor':
      return {
        title: 'Unofficial result published',
        description:
          'Election close is complete and the unofficial result is published. Auditor-visible package artifacts remain a separate review surface until finalization publishes the official result.',
      };
    case 'voter':
      return {
        title: 'Unofficial result published',
        description:
          'Election close is complete and the unofficial result is published. Finalization remains the later step that creates the official result.',
      };
    case 'generic':
    default:
      return {
        title: 'Unofficial result published',
        description:
          'Election close is complete and the unofficial result is now published. Finalization remains the later step that creates the official result.',
      };
  }
}

export function getClosedProgressNarrative(
  entry: Pick<
    ElectionHubEntryView,
    | 'ActorRoles'
    | 'SuggestedActionReason'
    | 'ClosedProgressStatus'
    | 'Election'
    | 'HasUnofficialResult'
    | 'HasOfficialResult'
  >,
  audience: ClosedProgressNarrativeAudience = resolveClosedProgressNarrativeAudience(entry)
): ClosedProgressBannerState | null {
  if (entry.Election.LifecycleState !== ElectionLifecycleStateProto.Closed) {
    return null;
  }

  if (entry.HasUnofficialResult || entry.HasOfficialResult) {
    return null;
  }

  const normalizedReason = entry.SuggestedActionReason.trim().toLowerCase();

  switch (entry.ClosedProgressStatus) {
    case ElectionClosedProgressStatusProto.ClosedProgressWaitingForTrusteeShares:
      switch (audience) {
        case 'owner-admin':
          return {
            title: 'Waiting for trustee tally shares',
            description:
              'Governed close is complete. Vote casting is locked, and the election is waiting for eligible trustees to provide the bound tally shares required to count votes and publish the unofficial result.',
          };
        case 'trustee':
          if (
            normalizedReason.startsWith(
              'submit the bound trustee tally share for close-counting.'
            )
          ) {
            return {
              title: 'Submit trustee tally share',
              description:
                'Governed close is complete. This trustee still needs to provide the bound tally share required to count votes and publish the unofficial result.',
            };
          }

          if (
            normalizedReason.startsWith(
              'resubmit the bound trustee tally share for close-counting.'
            )
          ) {
            return {
              title: 'Resubmit trustee tally share',
              description:
                'Governed close is complete. This trustee needs to resubmit the bound tally share before votes can be counted and the unofficial result can be published.',
            };
          }

          return {
            title: 'Waiting for trustee tally shares',
            description:
              'Governed close is complete. Eligible trustees are still providing the bound tally shares required to count votes and publish the unofficial result.',
          };
        case 'auditor':
          return {
            title: 'Awaiting unofficial result preparation',
            description:
              'Governed close is complete, but eligible trustees still need to provide the bound tally shares before the unofficial result and auditor-visible evidence can be reviewed.',
          };
        case 'voter':
          return {
            title: 'Waiting for the unofficial result',
            description:
              'Voting is closed. Eligible trustees still need to provide the bound tally shares before the election can count votes and publish the unofficial result.',
          };
        case 'generic':
        default:
          return {
            title: 'Waiting for trustee tally shares',
            description:
              'The election is closed and waiting for the required trustee tally shares before votes can be counted and the unofficial result can be published.',
          };
      }
    case ElectionClosedProgressStatusProto.ClosedProgressTallyCalculationInProgress:
      switch (audience) {
        case 'owner-admin':
          return {
            title: 'Counting votes for the unofficial result',
            description:
              'The required trustee tally shares were accepted. The election is counting the closed ballot set and preparing the unofficial result. The official result will be created only after finalization.',
          };
        case 'trustee':
          return {
            title: 'Unofficial tally calculation in progress',
            description:
              'The required trustee tally shares were accepted. The election is counting votes for the unofficial result. Finalization remains a separate governed step.',
          };
        case 'auditor':
          return {
            title: 'Unofficial result is being prepared',
            description:
              'The required trustee tally shares were accepted. The election is counting votes for the unofficial result and preparing the next auditor-visible artifacts. The official result will appear only after finalization.',
          };
        case 'voter':
          return {
            title: 'Unofficial result is being prepared',
            description:
              'Voting is closed. The required trustee tally shares were accepted, and the election is now counting votes for the unofficial result. The official result will appear only after finalization.',
          };
        case 'generic':
        default:
          return {
            title: 'Unofficial tally calculation in progress',
            description:
              'The required trustee tally shares were accepted, and the election is counting votes for the unofficial result. The official result will appear only after finalization.',
          };
      }
    default:
      return null;
  }
}

export function getClosedProgressBannerState(
  entry: ElectionHubEntryView | null
): ClosedProgressBannerState | null {
  if (!entry) {
    return null;
  }

  return getClosedProgressNarrative(entry);
}

export function getElectionHubNarrative(
  entry: Pick<
    ElectionHubEntryView,
    | 'ActorRoles'
    | 'SuggestedActionReason'
    | 'ClosedProgressStatus'
    | 'Election'
    | 'HasUnofficialResult'
    | 'HasOfficialResult'
  >
): string {
  return (
    getPublishedResultNarrative(entry)?.description ||
    getClosedProgressNarrative(entry)?.description ||
    entry.SuggestedActionReason ||
    'Review the available election surfaces for your roles.'
  );
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
  const hasPublishedResult = entry.HasUnofficialResult || entry.HasOfficialResult;
  const hasWorkspaceArtifactSurface =
    entry.CanViewReportPackage || entry.CanViewNamedParticipationRoster;

  if (hasPublishedResult) {
    sections.push('results');
  }

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

  if (hasWorkspaceArtifactSurface) {
    sections.push('artifacts');
  }

  return sections;
}
