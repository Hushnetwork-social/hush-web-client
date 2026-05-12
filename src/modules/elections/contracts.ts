import {
  ElectionCloseCountingJobStatusProto,
  ElectionClosedProgressStatusProto,
  ElectionActorLinkMultiplicityPolicyProto,
  type ElectionHubEntryView,
  ElectionHubNextActionHintProto,
  type ElectionCeremonyProfile,
  ElectionCeremonyActionTypeProto,
  ElectionCeremonyActorRoleProto,
  ElectionCeremonyShareCustodyStatusProto,
  ElectionCeremonyVersionStatusProto,
  ElectionBindingStatusProto,
  ElectionCheckoffVisibilityPolicyProto,
  ElectionClassProto,
  ElectionContactCodeProviderReadinessProto,
  ElectionDisclosureModeProto,
  ElectionIdentityLinkPolicyProto,
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
  type ElectionSp07EvidenceStatusView,
  type ElectionSp08ReleaseIntegrityStatusView,
  type ElectionSp09ExternalReviewStatusView,
  type ElectionSp10OperationalSecurityStatusView,
  type ElectionSp11RegulatoryClaimStatusView,
  ElectionTrusteeCeremonyStateProto,
  type ElectionVerificationPackageStatusView,
  type GetElectionOpenReadinessResponse,
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
  [ElectionClosedProgressStatusProto.ClosedProgressPublicationProofPending]:
    'Publication proof pending',
  [ElectionClosedProgressStatusProto.ClosedProgressPublicationProofGenerating]:
    'Publication proof generating',
  [ElectionClosedProgressStatusProto.ClosedProgressPublicationProofSelfVerifying]:
    'Publication proof self-verifying',
  [ElectionClosedProgressStatusProto.ClosedProgressPublicationProofFailed]:
    'Publication proof failed',
  [ElectionClosedProgressStatusProto.ClosedProgressPublicationProofVerified]:
    'Publication proof verified',
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
    IdentityLinkPolicy: ElectionIdentityLinkPolicyProto.ContactCodeV1,
    CheckoffVisibilityPolicy: ElectionCheckoffVisibilityPolicyProto.RestrictedOwnerAuditor,
    ActorLinkMultiplicityPolicy: ElectionActorLinkMultiplicityPolicyProto.SingleRosterEntryPerActor,
    ContactCodeProviderReadiness: ElectionContactCodeProviderReadinessProto.ContactCodeProviderDevOnly,
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
      IdentityLinkPolicy:
        draftSnapshot.Policy.IdentityLinkPolicy ?? ElectionIdentityLinkPolicyProto.ContactCodeV1,
      CheckoffVisibilityPolicy:
        draftSnapshot.Policy.CheckoffVisibilityPolicy ??
        ElectionCheckoffVisibilityPolicyProto.RestrictedOwnerAuditor,
      ActorLinkMultiplicityPolicy:
        draftSnapshot.Policy.ActorLinkMultiplicityPolicy ??
        ElectionActorLinkMultiplicityPolicyProto.SingleRosterEntryPerActor,
      ContactCodeProviderReadiness:
        draftSnapshot.Policy.ContactCodeProviderReadiness ??
        ElectionContactCodeProviderReadinessProto.ContactCodeProviderDevOnly,
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
      IdentityLinkPolicy: election.IdentityLinkPolicy ?? ElectionIdentityLinkPolicyProto.ContactCodeV1,
      CheckoffVisibilityPolicy:
        election.CheckoffVisibilityPolicy ??
        ElectionCheckoffVisibilityPolicyProto.RestrictedOwnerAuditor,
      ActorLinkMultiplicityPolicy:
        election.ActorLinkMultiplicityPolicy ??
        ElectionActorLinkMultiplicityPolicyProto.SingleRosterEntryPerActor,
      ContactCodeProviderReadiness:
        election.ContactCodeProviderReadiness ??
        ElectionContactCodeProviderReadinessProto.ContactCodeProviderDevOnly,
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
    IdentityLinkPolicy: draft.IdentityLinkPolicy ?? ElectionIdentityLinkPolicyProto.ContactCodeV1,
    CheckoffVisibilityPolicy:
      draft.CheckoffVisibilityPolicy ?? ElectionCheckoffVisibilityPolicyProto.RestrictedOwnerAuditor,
    ActorLinkMultiplicityPolicy:
      draft.ActorLinkMultiplicityPolicy ??
      ElectionActorLinkMultiplicityPolicyProto.SingleRosterEntryPerActor,
    ContactCodeProviderReadiness:
      draft.ContactCodeProviderReadiness ??
      ElectionContactCodeProviderReadinessProto.ContactCodeProviderDevOnly,
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

export type Sp07PublicationProofUiState =
  | 'not_required'
  | 'configured_ready'
  | 'configured_blocked'
  | 'publication_proof_pending'
  | 'publication_proof_generating'
  | 'publication_proof_self_verifying'
  | 'publication_proof_failed'
  | 'publication_proof_verified'
  | 'tally_ready';

export type Sp07PublicationProofTone = 'neutral' | 'success' | 'warning' | 'error';

export type Sp07PublicationProofAudience =
  | 'owner-admin'
  | 'auditor'
  | 'trustee'
  | 'voter'
  | 'generic';

export interface Sp07PublicationProofPresentation {
  state: Sp07PublicationProofUiState;
  label: string;
  tone: Sp07PublicationProofTone;
  description: string;
  canRetry: boolean;
  showTechnicalRefs: boolean;
  publicEvidenceAvailable: boolean;
  restrictedEvidenceAvailable: boolean;
  blockingCodes: string[];
}

export function getSp07OpenReadinessPresentation(
  readiness?: Pick<GetElectionOpenReadinessResponse, 'Sp07Evidence'> | null,
  audience: Sp07PublicationProofAudience = 'owner-admin'
): Sp07PublicationProofPresentation | null {
  return getSp07PublicationProofPresentation(readiness?.Sp07Evidence, audience, 'readiness');
}

export function getSp07VerificationPackagePresentation(
  status?: Pick<ElectionVerificationPackageStatusView, 'Sp07Evidence'> | null,
  audience: Sp07PublicationProofAudience = 'owner-admin'
): Sp07PublicationProofPresentation | null {
  return getSp07PublicationProofPresentation(status?.Sp07Evidence, audience, 'verification-package');
}

export function getSp07PublicationProofPresentation(
  evidence?: ElectionSp07EvidenceStatusView | null,
  audience: Sp07PublicationProofAudience = 'owner-admin',
  surface: 'readiness' | 'close-progress' | 'verification-package' = 'close-progress'
): Sp07PublicationProofPresentation | null {
  if (audience === 'voter') {
    return null;
  }

  if (!evidence || !evidence.EvidenceExpected) {
    return {
      state: 'not_required',
      label: 'Publication proof not required',
      tone: 'neutral',
      description:
        'This election profile does not require SP-07 publication-proof evidence.',
      canRetry: false,
      showTechnicalRefs: false,
      publicEvidenceAvailable: false,
      restrictedEvidenceAvailable: false,
      blockingCodes: [],
    };
  }

  const blockingCodes = evidence.Blockers
    .filter((blocker) => blocker.BlocksOpen || blocker.BlocksFinalization)
    .map((blocker) => blocker.Code);
  const hasBlockingState = blockingCodes.length > 0;

  if (surface === 'readiness') {
    if (hasBlockingState) {
      return {
        state: 'configured_blocked',
        label: 'Publication proof blocked',
        tone: 'error',
        description:
          evidence.Message ||
          'SP-07 publication-proof requirements must be resolved before the election can open.',
        canRetry: false,
        showTechnicalRefs: true,
        publicEvidenceAvailable: false,
        restrictedEvidenceAvailable: false,
        blockingCodes,
      };
    }

    return {
      state: 'configured_ready',
      label: 'Publication proof configured',
      tone: 'success',
      description:
        evidence.Message ||
        'SP-07 publication-proof profile and v1 envelope checks are ready for election open.',
      canRetry: false,
      showTechnicalRefs: true,
      publicEvidenceAvailable: false,
      restrictedEvidenceAvailable: false,
      blockingCodes,
    };
  }

  const base = {
    canRetry: evidence.CanRetry,
    showTechnicalRefs: true,
    publicEvidenceAvailable: evidence.PublicEvidenceAvailable,
    restrictedEvidenceAvailable: evidence.RestrictedEvidenceAvailable,
    blockingCodes,
  };

  switch (evidence.ProgressStatus) {
    case ElectionClosedProgressStatusProto.ClosedProgressPublicationProofPending:
      return {
        ...base,
        state: 'publication_proof_pending',
        label: 'Publication proof pending',
        tone: 'warning',
        description:
          evidence.Message ||
          'The election is closed and waiting to start SP-07 publication-proof generation.',
      };
    case ElectionClosedProgressStatusProto.ClosedProgressPublicationProofGenerating:
      return {
        ...base,
        state: 'publication_proof_generating',
        label: 'Publication proof generating',
        tone: 'neutral',
        description:
          evidence.Message ||
          'SP-07 publication-proof generation is running for the published encrypted ballot stream.',
      };
    case ElectionClosedProgressStatusProto.ClosedProgressPublicationProofSelfVerifying:
      return {
        ...base,
        state: 'publication_proof_self_verifying',
        label: 'Publication proof self-verifying',
        tone: 'neutral',
        description:
          evidence.Message ||
          'The generated SP-07 proof is being verified before publication.',
      };
    case ElectionClosedProgressStatusProto.ClosedProgressPublicationProofFailed:
      return {
        ...base,
        state: 'publication_proof_failed',
        label: 'Publication proof failed',
        tone: 'error',
        description:
          evidence.Message ||
          'SP-07 publication-proof generation or verification failed. Owner/admin retry is available only when sealed witness custody is still available.',
      };
    case ElectionClosedProgressStatusProto.ClosedProgressPublicationProofVerified:
      return {
        ...base,
        state: evidence.PublicEvidenceAvailable ? 'tally_ready' : 'publication_proof_verified',
        label: evidence.PublicEvidenceAvailable
          ? 'Publication proof verified'
          : 'Publication proof verified, package pending',
        tone: 'success',
        description:
          evidence.Message ||
          'SP-07 publication-proof evidence verified and can be included in auditor-visible packages.',
      };
    default:
      if (hasBlockingState) {
        return {
          ...base,
          state: 'configured_blocked',
          label: 'Publication proof blocked',
          tone: 'error',
          description:
            evidence.Message ||
            'SP-07 publication-proof evidence has blocking verifier findings.',
        };
      }

      return {
        ...base,
        state: 'configured_ready',
        label: 'Publication proof configured',
        tone: 'neutral',
        description:
          evidence.Message ||
          'SP-07 publication-proof evidence is configured and waiting for the close lifecycle.',
      };
  }
}

export type Sp08ReleaseIntegrityUiState =
  | 'not_visible'
  | 'not_required'
  | 'missing'
  | 'placeholder'
  | 'blocked'
  | 'official';

export type Sp08ReleaseIntegrityTone = 'neutral' | 'success' | 'warning' | 'error';

export type Sp08ReleaseIntegrityAudience =
  | 'owner-admin'
  | 'auditor'
  | 'trustee'
  | 'voter'
  | 'generic';

export interface Sp08ReleaseIntegrityPresentation {
  state: Sp08ReleaseIntegrityUiState;
  label: string;
  tone: Sp08ReleaseIntegrityTone;
  description: string;
  showTechnicalRefs: boolean;
  publicEvidenceAvailable: boolean;
  restrictedEvidenceAvailable: boolean;
  blocksHighAssurance: boolean;
  primaryResultCode: string;
  evidenceMode: string;
  componentCount: number;
  lifecycleBindingCount: number;
  lifecycleMismatchCount: number;
  evidenceFileCount: number;
  mobileEvidenceIncluded: boolean;
  releaseManifestHashShort: string;
  releaseManifestHashFull: string;
  protocolPackageManifestHashShort: string;
  protocolPackageManifestHashFull: string;
  blockingCodes: string[];
}

export type Sp09ExternalReviewUiState =
  | 'not_visible'
  | 'not_available'
  | 'planned'
  | 'available'
  | 'open_findings'
  | 'scope_mismatch'
  | 'claim_blocked'
  | 'requires_redesign';

export type Sp09ExternalReviewTone = 'neutral' | 'success' | 'warning' | 'error';

export type Sp09ExternalReviewAudience =
  | 'owner-admin'
  | 'auditor'
  | 'trustee'
  | 'voter'
  | 'generic';

export interface Sp09ExternalReviewPresentation {
  state: Sp09ExternalReviewUiState;
  label: string;
  tone: Sp09ExternalReviewTone;
  description: string;
  showTechnicalRefs: boolean;
  publicEvidenceAvailable: boolean;
  restrictedEvidenceAvailable: boolean;
  programVersion: string;
  reviewScope: string;
  reviewScopeShort: string;
  reviewType: string;
  reviewPhase: string;
  detailedStatus: string;
  availability: string;
  claimState: string;
  primaryResultCode: string;
  primaryIssue: string;
  reviewedArtifactCount: number;
  openCriticalFindingCount: number;
  openHighFindingCount: number;
  openFindingCount: number;
  evidenceFileCount: number;
  blockingCodes: string[];
}

export type Sp10OperationalSecurityUiState =
  | 'not_visible'
  | 'not_available'
  | 'development_placeholder'
  | 'managed_profile_declared'
  | 'managed_profile_evidence_available'
  | 'managed_profile_exception_declared'
  | 'blocked';

export type Sp10OperationalSecurityTone = 'neutral' | 'success' | 'warning' | 'error';

export type Sp10OperationalSecurityAudience =
  | 'owner-admin'
  | 'auditor'
  | 'trustee'
  | 'voter'
  | 'generic';

export interface Sp10OperationalSecurityPresentation {
  state: Sp10OperationalSecurityUiState;
  label: string;
  tone: Sp10OperationalSecurityTone;
  description: string;
  showTechnicalRefs: boolean;
  publicEvidenceAvailable: boolean;
  restrictedEvidenceAvailable: boolean;
  blocksHighAssurance: boolean;
  programVersion: string;
  deploymentProfileId: string;
  evidenceState: string;
  feat106ReadinessCaveat: string;
  releaseEvidenceMode: string;
  custodyMode: string;
  executorKeyLifecycle: string;
  incidentStatus: string;
  primaryResultCode: string;
  primaryIssue: string;
  publicEvidenceFileCount: number;
  restrictedEvidenceFileCount: number;
  evidenceFileCount: number;
  releaseManifestHashShort: string;
  releaseManifestHashFull: string;
  immutableDeploymentRefShort: string;
  immutableDeploymentRefFull: string;
  accessSnapshotRef: string;
  backupRestoreRef: string;
  auditorRoomAccessLogRef: string;
  blockingCodes: string[];
}

export type Sp11RegulatoryClaimUiState =
  | 'not_visible'
  | 'not_available'
  | 'allowed_now'
  | 'allowed_with_limitation'
  | 'blocked_until_review'
  | 'blocked_until_certification'
  | 'forbidden'
  | 'stale_tracker';

export type Sp11RegulatoryClaimTone = 'neutral' | 'success' | 'warning' | 'error';

export type Sp11RegulatoryClaimAudience =
  | 'owner-admin'
  | 'auditor'
  | 'trustee'
  | 'voter'
  | 'generic';

export interface Sp11RegulatoryClaimPresentation {
  state: Sp11RegulatoryClaimUiState;
  label: string;
  tone: Sp11RegulatoryClaimTone;
  description: string;
  showTechnicalRefs: boolean;
  claimExported: boolean;
  publicEvidenceAvailable: boolean;
  restrictedEvidenceAvailable: boolean;
  trackerVersion: string;
  jurisdictionId: string;
  claimId: string;
  claimState: string;
  sourceRef: string;
  owner: string;
  allowedWording: string;
  primaryResultCode: string;
  primaryIssue: string;
  requiresAuthorityEvidence: boolean;
  authorityEvidenceRef: string;
  restrictedWorkpaperRef: string;
  blocksClaims: boolean;
  isStale: boolean;
  publicEvidenceFileCount: number;
  restrictedEvidenceFileCount: number;
  evidenceFileCount: number;
  blockingCodes: string[];
}

const SP08_DEVELOPMENT_PLACEHOLDER_EVIDENCE_MODE = 'development_placeholder';
const SP08_OFFICIAL_EVIDENCE_MODE = 'official_sp08';
const SP08_RELEASE_INTEGRITY_VALID_RESULT_CODE = 'release_integrity_evidence_valid';
const SP08_RELEASE_INTEGRITY_LIFECYCLE_MISMATCH_RESULT_CODE =
  'release_integrity_lifecycle_mismatch';
const SP09_REVIEW_SCOPE_PROTOCOL_OMEGA_V1 = 'protocol_proof_verifier_publication_path_v1';
const SP09_PROGRAM_VERSION = 'SP09-P1';
const SP09_REVIEW_TYPE_CRYPTO_SECURITY = 'private_third_party_crypto_protocol_review_v1';
const SP09_AVAILABILITY_NOT_AVAILABLE = 'not_available';
const SP09_AVAILABILITY_PLANNED = 'planned';
const SP09_AVAILABILITY_AVAILABLE = 'available';
const SP09_CLAIM_STATE_PROGRAM_DEFINED = 'program_defined';
const SP09_CLAIM_STATE_PACKAGE_READY = 'package_ready';
const SP09_CLAIM_STATE_IN_REVIEW = 'in_review';
const SP09_CLAIM_STATE_REVIEWED_WITH_OPEN_FINDINGS = 'reviewed_with_open_findings';
const SP09_CLAIM_STATE_REVIEWED_WITH_LIMITATIONS = 'reviewed_with_limitations';
const SP09_CLAIM_STATE_REVIEWED_FOR_DECLARED_SCOPE = 'reviewed_for_declared_scope';
const SP09_CLAIM_STATE_BLOCKED_REQUIRES_REDESIGN = 'blocked_requires_redesign';
const SP09_RESULT_EXTERNAL_REVIEW_NOT_COMPLETE = 'external_review_not_complete';
const SP09_RESULT_EXTERNAL_REVIEW_SCOPE_MISMATCH = 'external_review_scope_mismatch';
const SP09_RESULT_EXTERNAL_REVIEW_OPEN_FINDINGS = 'external_review_open_findings_block_claims';
const SP09_RESULT_EXTERNAL_REVIEW_CLAIM_NOT_ALLOWED = 'external_review_claim_not_allowed';
const SP09_RESULT_EXTERNAL_REVIEW_PUBLIC_BOUNDARY = 'external_review_public_boundary_violation';
const SP09_RESULT_EXTERNAL_REVIEW_REQUIRES_REDESIGN = 'external_review_requires_redesign';
const SP10_PROGRAM_VERSION = 'SP10-P1';
const SP10_DEPLOYMENT_PROFILE_MANAGED_AWS_CONTAINER_V1 =
  'hushvoting_managed_aws_container_v1';
const SP10_EVIDENCE_NOT_AVAILABLE = 'not_available';
const SP10_EVIDENCE_DEVELOPMENT_PLACEHOLDER = 'development_placeholder';
const SP10_EVIDENCE_MANAGED_PROFILE_DECLARED = 'managed_profile_declared';
const SP10_EVIDENCE_MANAGED_PROFILE_AVAILABLE = 'managed_profile_evidence_available';
const SP10_EVIDENCE_MANAGED_PROFILE_EXCEPTION = 'managed_profile_exception_declared';
const SP10_EVIDENCE_BLOCKED = 'blocked';
const SP10_RESULT_OPERATIONAL_MISSING = 'operational_security_evidence_missing';
const SP11_TRACKER_VERSION = 'SP11-P1';
const SP11_CLAIM_ALLOWED_NOW = 'allowed_now';
const SP11_CLAIM_ALLOWED_WITH_LIMITATION = 'allowed_with_limitation';
const SP11_CLAIM_BLOCKED_UNTIL_REVIEW = 'blocked_until_review';
const SP11_CLAIM_BLOCKED_UNTIL_CERTIFICATION = 'blocked_until_certification';
const SP11_CLAIM_FORBIDDEN = 'forbidden';
const SP11_RESULT_TRACKER_STALE = 'regulatory_tracker_stale';

const SP09_ALLOWED_WORDING_BY_CLAIM_STATE: Record<string, string> = {
  not_claimed: 'External examination is not claimed for this package.',
  [SP09_CLAIM_STATE_PROGRAM_DEFINED]:
    'External examination program is defined; no reviewer conclusion is available.',
  [SP09_CLAIM_STATE_PACKAGE_READY]:
    'External examination package is ready for review; no reviewer conclusion is available.',
  [SP09_CLAIM_STATE_IN_REVIEW]:
    'External examination is in progress; no reviewer conclusion is available.',
  [SP09_CLAIM_STATE_REVIEWED_WITH_OPEN_FINDINGS]:
    'External review artifact exists for the declared scope, but open findings limit or block affected claims.',
  [SP09_CLAIM_STATE_REVIEWED_WITH_LIMITATIONS]:
    'Reviewed for declared scope and version, with limitations documented.',
  [SP09_CLAIM_STATE_REVIEWED_FOR_DECLARED_SCOPE]:
    'Reviewed for declared scope and version.',
  [SP09_CLAIM_STATE_BLOCKED_REQUIRES_REDESIGN]:
    'Reviewer identified redesign work; external review claim is blocked for this scope.',
  not_applicable_to_this_artifact_set:
    'No applicable external review is available for this artifact set.',
};

const SP10_ALLOWED_WORDING_BY_STATE: Record<string, string> = {
  [SP10_EVIDENCE_NOT_AVAILABLE]:
    'Operational security evidence is not available for this package; FEAT-106 readiness is not completed.',
  [SP10_EVIDENCE_DEVELOPMENT_PLACEHOLDER]:
    'Development-only operational placeholders are present and cannot support high-assurance operational claims.',
  [SP10_EVIDENCE_MANAGED_PROFILE_DECLARED]:
    'Managed deployment profile is declared; supporting operational evidence is not yet complete.',
  [SP10_EVIDENCE_MANAGED_PROFILE_AVAILABLE]:
    'Managed deployment profile evidence is available for the declared scope; this is not legal approval or certification.',
  [SP10_EVIDENCE_MANAGED_PROFILE_EXCEPTION]:
    'Managed deployment profile exception is declared and limits operational assurance for this package.',
  [SP10_EVIDENCE_BLOCKED]:
    'Operational security evidence is blocked for the declared scope; high-assurance operational claims are not allowed.',
};

const SP11_ALLOWED_WORDING_BY_CLAIM_STATE: Record<string, string> = {
  [SP11_CLAIM_ALLOWED_NOW]:
    'Regulatory tracker currently allows this organizational-election claim for the declared scope; this is not legal advice.',
  [SP11_CLAIM_ALLOWED_WITH_LIMITATION]:
    'Regulatory tracker allows this claim only with the listed limitations; this is not legal advice.',
  [SP11_CLAIM_BLOCKED_UNTIL_REVIEW]:
    'Regulatory tracker blocks this claim until business/legal review updates the register.',
  [SP11_CLAIM_BLOCKED_UNTIL_CERTIFICATION]:
    'Regulatory tracker blocks this claim until required authority or certification evidence exists.',
  [SP11_CLAIM_FORBIDDEN]:
    'Regulatory tracker forbids this claim for the declared scope.',
};

const SP09_LEGACY_REVIEW_COPY: Record<
  ProtocolPackageExternalReviewStatusProto,
  {
    label: string;
    availability: string;
    claimState: string;
  }
> = {
  [ProtocolPackageExternalReviewStatusProto.NotReviewed]: {
    label: 'No external review conclusion',
    availability: SP09_AVAILABILITY_NOT_AVAILABLE,
    claimState: SP09_CLAIM_STATE_PROGRAM_DEFINED,
  },
  [ProtocolPackageExternalReviewStatusProto.ReviewRequested]: {
    label: 'External review requested',
    availability: SP09_AVAILABILITY_PLANNED,
    claimState: SP09_CLAIM_STATE_PACKAGE_READY,
  },
  [ProtocolPackageExternalReviewStatusProto.ReviewInProgress]: {
    label: 'External review in progress',
    availability: SP09_AVAILABILITY_PLANNED,
    claimState: SP09_CLAIM_STATE_IN_REVIEW,
  },
  [ProtocolPackageExternalReviewStatusProto.ReviewedWithFindings]: {
    label: 'Review has findings',
    availability: SP09_AVAILABILITY_AVAILABLE,
    claimState: SP09_CLAIM_STATE_REVIEWED_WITH_OPEN_FINDINGS,
  },
  [ProtocolPackageExternalReviewStatusProto.ReviewedAccepted]: {
    label: 'Reviewed for declared scope',
    availability: SP09_AVAILABILITY_AVAILABLE,
    claimState: SP09_CLAIM_STATE_REVIEWED_FOR_DECLARED_SCOPE,
  },
};

export function getSp08VerificationPackagePresentation(
  status?: Pick<ElectionVerificationPackageStatusView, 'IsVisible' | 'Sp08ReleaseIntegrity'> | null,
  audience: Sp08ReleaseIntegrityAudience = 'owner-admin'
): Sp08ReleaseIntegrityPresentation | null {
  if (audience === 'voter') {
    return null;
  }

  if (status && !status.IsVisible) {
    return createSp08NotVisiblePresentation();
  }

  return getSp08ReleaseIntegrityPresentation(status?.Sp08ReleaseIntegrity, audience);
}

export function getSp09VerificationPackagePresentation(
  status?: Pick<ElectionVerificationPackageStatusView, 'IsVisible' | 'Sp09ExternalReview'> | null,
  audience: Sp09ExternalReviewAudience = 'owner-admin'
): Sp09ExternalReviewPresentation | null {
  if (audience === 'voter') {
    return null;
  }

  if (status && !status.IsVisible) {
    return createSp09NotVisiblePresentation();
  }

  return getSp09ExternalReviewPresentation(status?.Sp09ExternalReview, audience);
}

export function getSp09ExternalReviewPresentation(
  evidence?: ElectionSp09ExternalReviewStatusView | null,
  audience: Sp09ExternalReviewAudience = 'owner-admin'
): Sp09ExternalReviewPresentation | null {
  if (audience === 'voter') {
    return null;
  }

  if (!evidence) {
    return createSp09NotVisiblePresentation();
  }

  const state = resolveSp09ExternalReviewState(evidence);
  const blockingCodes = resolveSp09BlockingCodes(evidence, state);

  return {
    state,
    label: resolveSp09ExternalReviewLabel(state),
    tone: resolveSp09ExternalReviewTone(state),
    description: evidence.Message || resolveSp09ExternalReviewDescription(evidence, state),
    showTechnicalRefs: true,
    publicEvidenceAvailable: evidence.PublicEvidenceAvailable,
    restrictedEvidenceAvailable: evidence.RestrictedEvidenceAvailable,
    programVersion: evidence.ProgramVersion || SP09_PROGRAM_VERSION,
    reviewScope: evidence.ReviewScope || SP09_REVIEW_SCOPE_PROTOCOL_OMEGA_V1,
    reviewScopeShort: shortenProtocolPackageHash(evidence.ReviewScope || SP09_REVIEW_SCOPE_PROTOCOL_OMEGA_V1),
    reviewType: evidence.ReviewType || SP09_REVIEW_TYPE_CRYPTO_SECURITY,
    reviewPhase: evidence.ReviewPhase || SP09_PROGRAM_VERSION,
    detailedStatus: evidence.DetailedStatus || 'not_started',
    availability: evidence.Availability || SP09_AVAILABILITY_NOT_AVAILABLE,
    claimState: evidence.ClaimState || SP09_CLAIM_STATE_PROGRAM_DEFINED,
    primaryResultCode: evidence.PrimaryResultCode || SP09_RESULT_EXTERNAL_REVIEW_NOT_COMPLETE,
    primaryIssue: evidence.PrimaryIssue,
    reviewedArtifactCount: evidence.ReviewedArtifactCount,
    openCriticalFindingCount: evidence.OpenCriticalFindingCount,
    openHighFindingCount: evidence.OpenHighFindingCount,
    openFindingCount: evidence.OpenFindingCount,
    evidenceFileCount: evidence.PublicEvidenceFileCount + evidence.RestrictedEvidenceFileCount,
    blockingCodes,
  };
}

function createSp09NotVisiblePresentation(): Sp09ExternalReviewPresentation {
  return {
    state: 'not_visible',
    label: 'External review not visible',
    tone: 'neutral',
    description: 'SP-09 external-review status is not available on this surface.',
    showTechnicalRefs: false,
    publicEvidenceAvailable: false,
    restrictedEvidenceAvailable: false,
    programVersion: SP09_PROGRAM_VERSION,
    reviewScope: SP09_REVIEW_SCOPE_PROTOCOL_OMEGA_V1,
    reviewScopeShort: shortenProtocolPackageHash(SP09_REVIEW_SCOPE_PROTOCOL_OMEGA_V1),
    reviewType: SP09_REVIEW_TYPE_CRYPTO_SECURITY,
    reviewPhase: SP09_PROGRAM_VERSION,
    detailedStatus: 'not_started',
    availability: SP09_AVAILABILITY_NOT_AVAILABLE,
    claimState: SP09_CLAIM_STATE_PROGRAM_DEFINED,
    primaryResultCode: SP09_RESULT_EXTERNAL_REVIEW_NOT_COMPLETE,
    primaryIssue: '',
    reviewedArtifactCount: 0,
    openCriticalFindingCount: 0,
    openHighFindingCount: 0,
    openFindingCount: 0,
    evidenceFileCount: 0,
    blockingCodes: [],
  };
}

function resolveSp09ExternalReviewState(
  evidence: ElectionSp09ExternalReviewStatusView
): Sp09ExternalReviewUiState {
  if (evidence.RequiresRedesign || evidence.PrimaryResultCode === SP09_RESULT_EXTERNAL_REVIEW_REQUIRES_REDESIGN) {
    return 'requires_redesign';
  }

  if (evidence.PrimaryResultCode === SP09_RESULT_EXTERNAL_REVIEW_SCOPE_MISMATCH) {
    return 'scope_mismatch';
  }

  if (
    evidence.PrimaryResultCode === SP09_RESULT_EXTERNAL_REVIEW_CLAIM_NOT_ALLOWED ||
    evidence.PrimaryResultCode === SP09_RESULT_EXTERNAL_REVIEW_PUBLIC_BOUNDARY
  ) {
    return 'claim_blocked';
  }

  if (
    evidence.PrimaryResultCode === SP09_RESULT_EXTERNAL_REVIEW_OPEN_FINDINGS ||
    evidence.OpenCriticalFindingCount > 0 ||
    evidence.OpenHighFindingCount > 0 ||
    evidence.ClaimState === SP09_CLAIM_STATE_REVIEWED_WITH_OPEN_FINDINGS
  ) {
    return 'open_findings';
  }

  if (evidence.Availability === SP09_AVAILABILITY_AVAILABLE) {
    return 'available';
  }

  if (evidence.Availability === SP09_AVAILABILITY_PLANNED) {
    return 'planned';
  }

  return 'not_available';
}

function resolveSp09ExternalReviewLabel(state: Sp09ExternalReviewUiState): string {
  switch (state) {
    case 'available':
      return 'Review available';
    case 'open_findings':
      return 'Review has open findings';
    case 'planned':
      return 'Review planned';
    case 'requires_redesign':
      return 'Review requires redesign';
    case 'scope_mismatch':
      return 'Review scope mismatch';
    case 'claim_blocked':
      return 'Review claim blocked';
    case 'not_available':
      return 'Review not available';
    case 'not_visible':
    default:
      return 'External review not visible';
  }
}

function resolveSp09ExternalReviewTone(state: Sp09ExternalReviewUiState): Sp09ExternalReviewTone {
  switch (state) {
    case 'available':
      return 'success';
    case 'planned':
    case 'open_findings':
      return 'warning';
    case 'requires_redesign':
    case 'scope_mismatch':
    case 'claim_blocked':
      return 'error';
    case 'not_available':
    case 'not_visible':
    default:
      return 'neutral';
  }
}

function resolveSp09ExternalReviewDescription(
  evidence: ElectionSp09ExternalReviewStatusView,
  state: Sp09ExternalReviewUiState
): string {
  if (evidence.PrimaryIssue) {
    return evidence.PrimaryIssue;
  }

  if (state === 'available' || state === 'open_findings') {
    return getSp09AllowedWordingForClaimState(evidence.ClaimState);
  }

  if (state === 'requires_redesign') {
    return SP09_ALLOWED_WORDING_BY_CLAIM_STATE[SP09_CLAIM_STATE_BLOCKED_REQUIRES_REDESIGN];
  }

  if (state === 'scope_mismatch') {
    return 'Current package artifacts are outside the reviewed scope.';
  }

  if (state === 'claim_blocked') {
    return 'The package contains a review claim that is not allowed by available evidence.';
  }

  return getSp09AllowedWordingForClaimState(evidence.ClaimState);
}

function resolveSp09BlockingCodes(
  evidence: ElectionSp09ExternalReviewStatusView,
  state: Sp09ExternalReviewUiState
): string[] {
  const codes = new Set<string>();
  if (
    state === 'requires_redesign' ||
    state === 'scope_mismatch' ||
    state === 'claim_blocked' ||
    state === 'open_findings'
  ) {
    codes.add(evidence.PrimaryResultCode);
  }

  return Array.from(codes).filter(Boolean);
}

function getSp09AllowedWordingForClaimState(claimState?: string): string {
  return SP09_ALLOWED_WORDING_BY_CLAIM_STATE[claimState || ''] ??
    SP09_ALLOWED_WORDING_BY_CLAIM_STATE.not_claimed;
}

export function getSp10VerificationPackagePresentation(
  status?: Pick<ElectionVerificationPackageStatusView, 'IsVisible' | 'Sp10OperationalSecurity'> | null,
  audience: Sp10OperationalSecurityAudience = 'owner-admin'
): Sp10OperationalSecurityPresentation | null {
  if (audience === 'voter') {
    return null;
  }

  if (status && !status.IsVisible) {
    return createSp10NotVisiblePresentation();
  }

  return getSp10OperationalSecurityPresentation(status?.Sp10OperationalSecurity, audience);
}

export function getSp10OperationalSecurityPresentation(
  evidence?: ElectionSp10OperationalSecurityStatusView | null,
  audience: Sp10OperationalSecurityAudience = 'owner-admin'
): Sp10OperationalSecurityPresentation | null {
  if (audience === 'voter') {
    return null;
  }

  if (!evidence) {
    return createSp10NotVisiblePresentation();
  }

  const state = resolveSp10OperationalSecurityState(evidence);
  const blockingCodes = resolveSp10BlockingCodes(evidence, state);

  return {
    state,
    label: resolveSp10OperationalSecurityLabel(state),
    tone: resolveSp10OperationalSecurityTone(state, evidence.BlocksHighAssurance),
    description: evidence.Message || resolveSp10OperationalSecurityDescription(evidence, state),
    showTechnicalRefs: state !== 'not_visible',
    publicEvidenceAvailable: evidence.PublicEvidenceAvailable,
    restrictedEvidenceAvailable: evidence.RestrictedEvidenceAvailable,
    blocksHighAssurance: evidence.BlocksHighAssurance,
    programVersion: evidence.ProgramVersion || SP10_PROGRAM_VERSION,
    deploymentProfileId:
      evidence.DeploymentProfileId || SP10_DEPLOYMENT_PROFILE_MANAGED_AWS_CONTAINER_V1,
    evidenceState: evidence.EvidenceState || SP10_EVIDENCE_NOT_AVAILABLE,
    feat106ReadinessCaveat:
      evidence.Feat106ReadinessCaveat ||
      getSp10AllowedWordingForEvidenceState(evidence.EvidenceState),
    releaseEvidenceMode: evidence.ReleaseEvidenceMode || 'not_recorded',
    custodyMode: evidence.CustodyMode || 'not_recorded',
    executorKeyLifecycle: evidence.ExecutorKeyLifecycle || 'not_recorded',
    incidentStatus: evidence.IncidentStatus || 'not_recorded',
    primaryResultCode: evidence.PrimaryResultCode || SP10_RESULT_OPERATIONAL_MISSING,
    primaryIssue: evidence.PrimaryIssue,
    publicEvidenceFileCount: evidence.PublicEvidenceFileCount,
    restrictedEvidenceFileCount: evidence.RestrictedEvidenceFileCount,
    evidenceFileCount: evidence.PublicEvidenceFileCount + evidence.RestrictedEvidenceFileCount,
    releaseManifestHashShort: shortenProtocolPackageHash(evidence.ReleaseManifestHash),
    releaseManifestHashFull: evidence.ReleaseManifestHash,
    immutableDeploymentRefShort: shortenProtocolPackageHash(evidence.ImmutableDeploymentRef),
    immutableDeploymentRefFull: evidence.ImmutableDeploymentRef,
    accessSnapshotRef: evidence.AccessSnapshotHashOrRestrictedRef,
    backupRestoreRef: evidence.BackupRestoreHashOrRestrictedRef,
    auditorRoomAccessLogRef: evidence.AuditorRoomAccessLogHashOrRestrictedRef,
    blockingCodes,
  };
}

function createSp10NotVisiblePresentation(): Sp10OperationalSecurityPresentation {
  return {
    state: 'not_visible',
    label: 'Operational status not visible',
    tone: 'neutral',
    description: 'SP-10 operational-security status is not available on this surface.',
    showTechnicalRefs: false,
    publicEvidenceAvailable: false,
    restrictedEvidenceAvailable: false,
    blocksHighAssurance: false,
    programVersion: SP10_PROGRAM_VERSION,
    deploymentProfileId: SP10_DEPLOYMENT_PROFILE_MANAGED_AWS_CONTAINER_V1,
    evidenceState: SP10_EVIDENCE_NOT_AVAILABLE,
    feat106ReadinessCaveat: getSp10AllowedWordingForEvidenceState(SP10_EVIDENCE_NOT_AVAILABLE),
    releaseEvidenceMode: 'not_recorded',
    custodyMode: 'not_recorded',
    executorKeyLifecycle: 'not_recorded',
    incidentStatus: 'not_recorded',
    primaryResultCode: '',
    primaryIssue: '',
    publicEvidenceFileCount: 0,
    restrictedEvidenceFileCount: 0,
    evidenceFileCount: 0,
    releaseManifestHashShort: 'Not recorded',
    releaseManifestHashFull: '',
    immutableDeploymentRefShort: 'Not recorded',
    immutableDeploymentRefFull: '',
    accessSnapshotRef: '',
    backupRestoreRef: '',
    auditorRoomAccessLogRef: '',
    blockingCodes: [],
  };
}

function resolveSp10OperationalSecurityState(
  evidence: ElectionSp10OperationalSecurityStatusView
): Sp10OperationalSecurityUiState {
  if (!evidence.EvidenceExpected || !evidence.PublicEvidenceAvailable) {
    return 'not_available';
  }

  switch (evidence.EvidenceState) {
    case SP10_EVIDENCE_MANAGED_PROFILE_AVAILABLE:
      return 'managed_profile_evidence_available';
    case SP10_EVIDENCE_MANAGED_PROFILE_DECLARED:
      return 'managed_profile_declared';
    case SP10_EVIDENCE_MANAGED_PROFILE_EXCEPTION:
      return 'managed_profile_exception_declared';
    case SP10_EVIDENCE_BLOCKED:
      return 'blocked';
    case SP10_EVIDENCE_DEVELOPMENT_PLACEHOLDER:
      return 'development_placeholder';
    case SP10_EVIDENCE_NOT_AVAILABLE:
    default:
      return 'not_available';
  }
}

function resolveSp10OperationalSecurityLabel(state: Sp10OperationalSecurityUiState): string {
  switch (state) {
    case 'managed_profile_evidence_available':
      return 'Managed profile evidence available';
    case 'managed_profile_declared':
      return 'Managed profile declared';
    case 'managed_profile_exception_declared':
      return 'Managed profile exception declared';
    case 'development_placeholder':
      return 'Development placeholder';
    case 'blocked':
      return 'Operational evidence blocked';
    case 'not_available':
      return 'Operational evidence not available';
    case 'not_visible':
    default:
      return 'Operational status not visible';
  }
}

function resolveSp10OperationalSecurityTone(
  state: Sp10OperationalSecurityUiState,
  blocksHighAssurance: boolean
): Sp10OperationalSecurityTone {
  switch (state) {
    case 'managed_profile_evidence_available':
      return 'success';
    case 'managed_profile_declared':
    case 'managed_profile_exception_declared':
      return 'warning';
    case 'development_placeholder':
      return blocksHighAssurance ? 'error' : 'warning';
    case 'blocked':
      return 'error';
    case 'not_available':
    case 'not_visible':
    default:
      return 'neutral';
  }
}

function resolveSp10OperationalSecurityDescription(
  evidence: ElectionSp10OperationalSecurityStatusView,
  state: Sp10OperationalSecurityUiState
): string {
  if (evidence.PrimaryIssue && (state === 'blocked' || state === 'development_placeholder')) {
    return evidence.PrimaryIssue;
  }

  return (
    evidence.Feat106ReadinessCaveat ||
    getSp10AllowedWordingForEvidenceState(evidence.EvidenceState)
  );
}

function resolveSp10BlockingCodes(
  evidence: ElectionSp10OperationalSecurityStatusView,
  state: Sp10OperationalSecurityUiState
): string[] {
  if (
    !evidence.PrimaryResultCode ||
    (state !== 'blocked' &&
      state !== 'development_placeholder' &&
      state !== 'managed_profile_exception_declared' &&
      !evidence.BlocksHighAssurance)
  ) {
    return [];
  }

  return [evidence.PrimaryResultCode];
}

function getSp10AllowedWordingForEvidenceState(evidenceState?: string): string {
  return SP10_ALLOWED_WORDING_BY_STATE[evidenceState || ''] ??
    SP10_ALLOWED_WORDING_BY_STATE[SP10_EVIDENCE_NOT_AVAILABLE];
}

export function getSp11VerificationPackagePresentation(
  status?: Pick<ElectionVerificationPackageStatusView, 'IsVisible' | 'Sp11RegulatoryClaim'> | null,
  audience: Sp11RegulatoryClaimAudience = 'owner-admin'
): Sp11RegulatoryClaimPresentation | null {
  if (audience === 'voter') {
    return null;
  }

  if (status && !status.IsVisible) {
    return createSp11NotVisiblePresentation();
  }

  return getSp11RegulatoryClaimPresentation(status?.Sp11RegulatoryClaim, audience);
}

export function getSp11RegulatoryClaimPresentation(
  evidence?: ElectionSp11RegulatoryClaimStatusView | null,
  audience: Sp11RegulatoryClaimAudience = 'owner-admin'
): Sp11RegulatoryClaimPresentation | null {
  if (audience === 'voter') {
    return null;
  }

  if (!evidence) {
    return createSp11NotVisiblePresentation();
  }

  const state = resolveSp11RegulatoryClaimState(evidence);
  const blockingCodes = resolveSp11BlockingCodes(evidence, state);

  return {
    state,
    label: resolveSp11RegulatoryClaimLabel(state),
    tone: resolveSp11RegulatoryClaimTone(state),
    description: evidence.Message || resolveSp11RegulatoryClaimDescription(evidence, state),
    showTechnicalRefs: evidence.ClaimExported,
    claimExported: evidence.ClaimExported,
    publicEvidenceAvailable: evidence.PublicEvidenceAvailable,
    restrictedEvidenceAvailable: evidence.RestrictedEvidenceAvailable,
    trackerVersion: evidence.TrackerVersion || SP11_TRACKER_VERSION,
    jurisdictionId: evidence.JurisdictionId || 'Not recorded',
    claimId: evidence.ClaimId || 'Not recorded',
    claimState: evidence.ClaimState || 'not_exported',
    sourceRef: evidence.SourceRef,
    owner: evidence.Owner,
    allowedWording: evidence.AllowedWording || getSp11AllowedWordingForClaimState(evidence.ClaimState),
    primaryResultCode: evidence.PrimaryResultCode,
    primaryIssue: evidence.PrimaryIssue,
    requiresAuthorityEvidence: evidence.RequiresAuthorityEvidence,
    authorityEvidenceRef: evidence.AuthorityEvidenceRef,
    restrictedWorkpaperRef: evidence.RestrictedWorkpaperRef,
    blocksClaims: evidence.BlocksClaims,
    isStale: evidence.IsStale,
    publicEvidenceFileCount: evidence.PublicEvidenceFileCount,
    restrictedEvidenceFileCount: evidence.RestrictedEvidenceFileCount,
    evidenceFileCount: evidence.PublicEvidenceFileCount + evidence.RestrictedEvidenceFileCount,
    blockingCodes,
  };
}

function createSp11NotVisiblePresentation(): Sp11RegulatoryClaimPresentation {
  return {
    state: 'not_visible',
    label: 'Regulatory claim not visible',
    tone: 'neutral',
    description: 'SP-11 regulatory-claim status is not available on this surface.',
    showTechnicalRefs: false,
    claimExported: false,
    publicEvidenceAvailable: false,
    restrictedEvidenceAvailable: false,
    trackerVersion: SP11_TRACKER_VERSION,
    jurisdictionId: 'Not recorded',
    claimId: 'Not recorded',
    claimState: 'not_exported',
    sourceRef: '',
    owner: '',
    allowedWording: '',
    primaryResultCode: '',
    primaryIssue: '',
    requiresAuthorityEvidence: false,
    authorityEvidenceRef: '',
    restrictedWorkpaperRef: '',
    blocksClaims: false,
    isStale: false,
    publicEvidenceFileCount: 0,
    restrictedEvidenceFileCount: 0,
    evidenceFileCount: 0,
    blockingCodes: [],
  };
}

function resolveSp11RegulatoryClaimState(
  evidence: ElectionSp11RegulatoryClaimStatusView
): Sp11RegulatoryClaimUiState {
  if (!evidence.ClaimExported || !evidence.PublicEvidenceAvailable) {
    return 'not_available';
  }

  if (evidence.IsStale || evidence.PrimaryResultCode === SP11_RESULT_TRACKER_STALE) {
    return 'stale_tracker';
  }

  switch (evidence.ClaimState) {
    case SP11_CLAIM_ALLOWED_NOW:
      return 'allowed_now';
    case SP11_CLAIM_ALLOWED_WITH_LIMITATION:
      return 'allowed_with_limitation';
    case SP11_CLAIM_BLOCKED_UNTIL_REVIEW:
      return 'blocked_until_review';
    case SP11_CLAIM_BLOCKED_UNTIL_CERTIFICATION:
      return 'blocked_until_certification';
    case SP11_CLAIM_FORBIDDEN:
      return 'forbidden';
    default:
      return 'not_available';
  }
}

function resolveSp11RegulatoryClaimLabel(state: Sp11RegulatoryClaimUiState): string {
  switch (state) {
    case 'allowed_now':
      return 'Claim allowed now';
    case 'allowed_with_limitation':
      return 'Claim allowed with limitation';
    case 'blocked_until_review':
      return 'Claim blocked until review';
    case 'blocked_until_certification':
      return 'Claim blocked until authority evidence';
    case 'forbidden':
      return 'Claim forbidden';
    case 'stale_tracker':
      return 'Tracker needs review';
    case 'not_available':
      return 'No regulatory claim exported';
    case 'not_visible':
    default:
      return 'Regulatory claim not visible';
  }
}

function resolveSp11RegulatoryClaimTone(
  state: Sp11RegulatoryClaimUiState
): Sp11RegulatoryClaimTone {
  switch (state) {
    case 'allowed_now':
    case 'allowed_with_limitation':
      return 'success';
    case 'stale_tracker':
    case 'blocked_until_review':
      return 'warning';
    case 'blocked_until_certification':
    case 'forbidden':
      return 'error';
    case 'not_available':
    case 'not_visible':
    default:
      return 'neutral';
  }
}

function resolveSp11RegulatoryClaimDescription(
  evidence: ElectionSp11RegulatoryClaimStatusView,
  state: Sp11RegulatoryClaimUiState
): string {
  if (evidence.PrimaryIssue && state !== 'allowed_now' && state !== 'allowed_with_limitation') {
    return evidence.PrimaryIssue;
  }

  if (state === 'not_available') {
    return 'No SP-11 regulatory claim is exported for this package.';
  }

  return evidence.AllowedWording || getSp11AllowedWordingForClaimState(evidence.ClaimState);
}

function resolveSp11BlockingCodes(
  evidence: ElectionSp11RegulatoryClaimStatusView,
  state: Sp11RegulatoryClaimUiState
): string[] {
  if (
    !evidence.PrimaryResultCode ||
    (state !== 'stale_tracker' &&
      state !== 'blocked_until_review' &&
      state !== 'blocked_until_certification' &&
      state !== 'forbidden' &&
      !evidence.BlocksClaims)
  ) {
    return [];
  }

  return [evidence.PrimaryResultCode];
}

function getSp11AllowedWordingForClaimState(claimState?: string): string {
  return SP11_ALLOWED_WORDING_BY_CLAIM_STATE[claimState || ''] ??
    'No SP-11 regulatory claim is exported for this package.';
}

export function getSp08OpenReadinessPresentation(
  readiness?: Pick<GetElectionOpenReadinessResponse, 'Sp08ReleaseIntegrity'> | null,
  audience: Sp08ReleaseIntegrityAudience = 'owner-admin'
): Sp08ReleaseIntegrityPresentation | null {
  return getSp08ReleaseIntegrityPresentation(readiness?.Sp08ReleaseIntegrity, audience);
}

export function getSp08ReleaseIntegrityPresentation(
  evidence?: ElectionSp08ReleaseIntegrityStatusView | null,
  audience: Sp08ReleaseIntegrityAudience = 'owner-admin'
): Sp08ReleaseIntegrityPresentation | null {
  if (audience === 'voter') {
    return null;
  }

  if (!evidence) {
    return createSp08NotVisiblePresentation();
  }

  if (!evidence.EvidenceExpected) {
    return {
      state: 'not_required',
      label: 'Release integrity not required',
      tone: 'neutral',
      description:
        evidence.Message ||
        'This election profile does not require SP-08 release-integrity evidence.',
      showTechnicalRefs: false,
      publicEvidenceAvailable: false,
      restrictedEvidenceAvailable: false,
      blocksHighAssurance: false,
      primaryResultCode: evidence.PrimaryResultCode,
      evidenceMode: evidence.EvidenceMode,
      componentCount: 0,
      lifecycleBindingCount: 0,
      lifecycleMismatchCount: 0,
      evidenceFileCount: 0,
      mobileEvidenceIncluded: false,
      releaseManifestHashShort: shortenProtocolPackageHash(evidence.ReleaseManifestHash),
      releaseManifestHashFull: evidence.ReleaseManifestHash,
      protocolPackageManifestHashShort: shortenProtocolPackageHash(
        evidence.ProtocolPackageManifestHash
      ),
      protocolPackageManifestHashFull: evidence.ProtocolPackageManifestHash,
      blockingCodes: [],
    };
  }

  const lifecycleMismatchCount = evidence.LifecycleBindings.filter(
    (binding) => !binding.MatchesSealedPolicy
  ).length;
  const usesPlaceholderEvidence =
    evidence.NotForReleaseIntegrityClaims ||
    evidence.EvidenceMode === SP08_DEVELOPMENT_PLACEHOLDER_EVIDENCE_MODE ||
    evidence.Components.some((component) => component.IsPlaceholder);
  const usesOfficialEvidence =
    evidence.EvidenceMode === SP08_OFFICIAL_EVIDENCE_MODE &&
    !evidence.NotForReleaseIntegrityClaims;
  const hasValidOfficialEvidence =
    usesOfficialEvidence &&
    evidence.PrimaryResultCode === SP08_RELEASE_INTEGRITY_VALID_RESULT_CODE &&
    !evidence.BlocksHighAssurance &&
    lifecycleMismatchCount === 0;

  const state = resolveSp08ReleaseIntegrityState(
    evidence,
    usesPlaceholderEvidence,
    hasValidOfficialEvidence,
    lifecycleMismatchCount
  );
  const blockingCodes = resolveSp08BlockingCodes(evidence, state, lifecycleMismatchCount);

  return {
    state,
    label: resolveSp08ReleaseIntegrityLabel(state),
    tone: resolveSp08ReleaseIntegrityTone(state, evidence.BlocksHighAssurance),
    description: resolveSp08ReleaseIntegrityDescription(evidence, state),
    showTechnicalRefs: true,
    publicEvidenceAvailable: evidence.PublicEvidenceAvailable,
    restrictedEvidenceAvailable: evidence.RestrictedEvidenceAvailable,
    blocksHighAssurance: evidence.BlocksHighAssurance,
    primaryResultCode: evidence.PrimaryResultCode,
    evidenceMode: evidence.EvidenceMode,
    componentCount: evidence.ComponentCount,
    lifecycleBindingCount: evidence.LifecycleBindingCount,
    lifecycleMismatchCount,
    evidenceFileCount: evidence.EvidenceFileCount,
    mobileEvidenceIncluded: evidence.MobileEvidenceIncluded,
    releaseManifestHashShort: shortenProtocolPackageHash(evidence.ReleaseManifestHash),
    releaseManifestHashFull: evidence.ReleaseManifestHash,
    protocolPackageManifestHashShort: shortenProtocolPackageHash(
      evidence.ProtocolPackageManifestHash
    ),
    protocolPackageManifestHashFull: evidence.ProtocolPackageManifestHash,
    blockingCodes,
  };
}

function createSp08NotVisiblePresentation(): Sp08ReleaseIntegrityPresentation {
  return {
    state: 'not_visible',
    label: 'Release integrity not visible',
    tone: 'neutral',
    description: 'SP-08 release-integrity status is not available on this surface.',
    showTechnicalRefs: false,
    publicEvidenceAvailable: false,
    restrictedEvidenceAvailable: false,
    blocksHighAssurance: false,
    primaryResultCode: '',
    evidenceMode: '',
    componentCount: 0,
    lifecycleBindingCount: 0,
    lifecycleMismatchCount: 0,
    evidenceFileCount: 0,
    mobileEvidenceIncluded: false,
    releaseManifestHashShort: 'Not recorded',
    releaseManifestHashFull: '',
    protocolPackageManifestHashShort: 'Not recorded',
    protocolPackageManifestHashFull: '',
    blockingCodes: [],
  };
}

function resolveSp08ReleaseIntegrityState(
  evidence: ElectionSp08ReleaseIntegrityStatusView,
  usesPlaceholderEvidence: boolean,
  hasValidOfficialEvidence: boolean,
  lifecycleMismatchCount: number
): Sp08ReleaseIntegrityUiState {
  if (usesPlaceholderEvidence) {
    return 'placeholder';
  }

  if (!evidence.PublicEvidenceAvailable || evidence.EvidenceFileCount === 0) {
    return 'missing';
  }

  if (hasValidOfficialEvidence) {
    return 'official';
  }

  if (evidence.BlocksHighAssurance || lifecycleMismatchCount > 0) {
    return 'blocked';
  }

  return 'blocked';
}

function resolveSp08ReleaseIntegrityLabel(state: Sp08ReleaseIntegrityUiState): string {
  switch (state) {
    case 'not_visible':
      return 'Release integrity not visible';
    case 'not_required':
      return 'Release integrity not required';
    case 'missing':
      return 'Release evidence missing';
    case 'placeholder':
      return 'Development placeholder';
    case 'official':
      return 'Official SP-08 evidence';
    case 'blocked':
    default:
      return 'Release integrity blocked';
  }
}

function resolveSp08ReleaseIntegrityTone(
  state: Sp08ReleaseIntegrityUiState,
  blocksHighAssurance: boolean
): Sp08ReleaseIntegrityTone {
  switch (state) {
    case 'official':
      return 'success';
    case 'blocked':
    case 'missing':
      return 'error';
    case 'placeholder':
      return blocksHighAssurance ? 'error' : 'warning';
    case 'not_visible':
    case 'not_required':
    default:
      return 'neutral';
  }
}

function resolveSp08ReleaseIntegrityDescription(
  evidence: ElectionSp08ReleaseIntegrityStatusView,
  state: Sp08ReleaseIntegrityUiState
): string {
  if (evidence.Message) {
    return evidence.Message;
  }

  switch (state) {
    case 'missing':
      return 'SP-08 release-integrity evidence is not available in the verification package yet.';
    case 'placeholder':
      return 'Development placeholder SP-08 release evidence is present. It is not official release evidence and must not support release-integrity claims.';
    case 'official':
      return 'Official SP-08 release-integrity evidence is present in the verification package.';
    case 'blocked':
      return (
        evidence.PrimaryIssue ||
        'SP-08 release-integrity evidence has blocking findings that must be resolved before release-integrity claims can be made.'
      );
    case 'not_required':
      return 'This election profile does not require SP-08 release-integrity evidence.';
    case 'not_visible':
    default:
      return 'SP-08 release-integrity status is not available on this surface.';
  }
}

function resolveSp08BlockingCodes(
  evidence: ElectionSp08ReleaseIntegrityStatusView,
  state: Sp08ReleaseIntegrityUiState,
  lifecycleMismatchCount: number
): string[] {
  const blockingCodes = new Set<string>();

  if (
    evidence.PrimaryResultCode &&
    (state === 'blocked' ||
      state === 'missing' ||
      state === 'placeholder' ||
      evidence.BlocksHighAssurance)
  ) {
    blockingCodes.add(evidence.PrimaryResultCode);
  }

  if (lifecycleMismatchCount > 0) {
    blockingCodes.add(SP08_RELEASE_INTEGRITY_LIFECYCLE_MISMATCH_RESULT_CODE);
  }

  return Array.from(blockingCodes);
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
  externalReviewAvailability: string;
  externalReviewClaimState: string;
  externalReviewScope: string;
  externalReviewDescription: string;
  externalReviewTone: Sp09ExternalReviewTone;
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
    : SP09_LEGACY_REVIEW_COPY[status]?.label ?? 'Unknown external review status';
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
  const externalReview = binding?.ExternalReviewStatus === undefined
    ? SP09_LEGACY_REVIEW_COPY[ProtocolPackageExternalReviewStatusProto.NotReviewed]
    : SP09_LEGACY_REVIEW_COPY[binding.ExternalReviewStatus] ??
      SP09_LEGACY_REVIEW_COPY[ProtocolPackageExternalReviewStatusProto.NotReviewed];
  const externalReviewTone: Sp09ExternalReviewTone =
    externalReview.availability === SP09_AVAILABILITY_AVAILABLE
      ? binding?.ExternalReviewStatus === ProtocolPackageExternalReviewStatusProto.ReviewedWithFindings
        ? 'warning'
        : 'success'
      : externalReview.availability === SP09_AVAILABILITY_PLANNED
        ? 'warning'
        : 'neutral';

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
    externalReviewLabel: externalReview.label,
    externalReviewAvailability: externalReview.availability,
    externalReviewClaimState: externalReview.claimState,
    externalReviewScope: SP09_REVIEW_SCOPE_PROTOCOL_OMEGA_V1,
    externalReviewDescription: getSp09AllowedWordingForClaimState(externalReview.claimState),
    externalReviewTone,
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
    case ElectionClosedProgressStatusProto.ClosedProgressPublicationProofPending:
    case ElectionClosedProgressStatusProto.ClosedProgressPublicationProofGenerating:
    case ElectionClosedProgressStatusProto.ClosedProgressPublicationProofSelfVerifying:
      switch (audience) {
        case 'voter':
          return {
            title: 'Result evidence is being prepared',
            description:
              'Voting is closed. The election is preparing the evidence required before the unofficial result can be published.',
          };
        case 'auditor':
          return {
            title: 'Publication proof in progress',
            description:
              'The election is preparing SP-07 publication-proof evidence for the published encrypted ballot stream before result artifacts become reviewable.',
          };
        case 'owner-admin':
        case 'trustee':
        case 'generic':
        default:
          return {
            title: getClosedProgressStatusLabel(entry.ClosedProgressStatus),
            description:
              'The election is preparing and checking SP-07 publication-proof evidence before the unofficial result is marked ready.',
          };
      }
    case ElectionClosedProgressStatusProto.ClosedProgressPublicationProofFailed:
      switch (audience) {
        case 'voter':
          return {
            title: 'Result preparation needs attention',
            description:
              'Voting is closed, but result preparation needs operational attention before the unofficial result can be published.',
          };
        case 'auditor':
          return {
            title: 'Publication proof failed',
            description:
              'SP-07 publication-proof generation or verification failed. Owner/admin operators need to resolve the close evidence before result artifacts are reviewable.',
          };
        case 'owner-admin':
        case 'trustee':
        case 'generic':
        default:
          return {
            title: 'Publication proof failed',
            description:
              'SP-07 publication-proof generation or verification failed. Retry is available only when the server still has sealed witness custody for the failed attempt.',
          };
      }
    case ElectionClosedProgressStatusProto.ClosedProgressPublicationProofVerified:
      return {
        title: 'Publication proof verified',
        description:
          'SP-07 publication-proof evidence is verified. The election is completing the remaining close-counting publication steps.',
      };
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
