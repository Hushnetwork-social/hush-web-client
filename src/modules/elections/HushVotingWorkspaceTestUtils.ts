import type {
  ElectionHubEntryView,
  ElectionRecordView,
  ElectionReportArtifactView,
  ElectionReportPackageSummaryView,
  ElectionResultArtifact,
  ElectionSummary,
  GetElectionHubViewResponse,
  GetElectionResponse,
  GetElectionResultViewResponse,
} from '@/lib/grpc';
import {
  ElectionBindingStatusProto,
  ElectionClosedProgressStatusProto,
  ElectionGovernanceModeProto,
  ElectionLifecycleStateProto,
  ElectionReportArtifactAccessScopeProto,
  ElectionReportArtifactFormatProto,
  ElectionReportArtifactKindProto,
  ElectionReportPackageStatusProto,
  ElectionResultArtifactKindProto,
  ElectionResultArtifactVisibilityProto,
  OfficialResultVisibilityPolicyProto,
} from '@/lib/grpc';

export const timestamp = { seconds: 1_711_410_000, nanos: 0 };

export function createSummary(
  electionId: string,
  lifecycleState: ElectionLifecycleStateProto,
  title: string,
  ownerPublicAddress: string = 'actor-address'
): ElectionSummary {
  return {
    ElectionId: electionId,
    Title: title,
    OwnerPublicAddress: ownerPublicAddress,
    LifecycleState: lifecycleState,
    BindingStatus: ElectionBindingStatusProto.Binding,
    GovernanceMode: ElectionGovernanceModeProto.AdminOnly,
    CurrentDraftRevision: 2,
    LastUpdatedAt: timestamp,
  };
}

export function createHubEntry(
  electionId: string,
  lifecycleState: ElectionLifecycleStateProto,
  title: string,
  overrides?: Partial<ElectionHubEntryView>
): ElectionHubEntryView {
  return {
    Election: createSummary(electionId, lifecycleState, title),
    ActorRoles: {
      IsOwnerAdmin: true,
      IsTrustee: false,
      IsVoter: lifecycleState === ElectionLifecycleStateProto.Open,
      IsDesignatedAuditor: false,
    },
    SuggestedAction: 0,
    SuggestedActionReason: 'Review the mixed-role workspace.',
    CanClaimIdentity: false,
    CanViewNamedParticipationRoster: true,
    CanViewReportPackage: true,
    CanViewParticipantResults: true,
    ClosedProgressStatus: ElectionClosedProgressStatusProto.ClosedProgressNone,
    HasUnofficialResult: lifecycleState !== ElectionLifecycleStateProto.Draft,
    HasOfficialResult: lifecycleState === ElectionLifecycleStateProto.Finalized,
    ...overrides,
  };
}

export function createElectionRecord(
  electionId: string,
  lifecycleState: ElectionLifecycleStateProto,
  title: string,
  overrides?: Partial<ElectionRecordView>
): ElectionRecordView {
  return {
    ElectionId: electionId,
    Title: title,
    ShortDescription: 'Election description',
    OwnerPublicAddress: 'actor-address',
    ExternalReferenceCode: 'ORG-2026-01',
    LifecycleState: lifecycleState,
    ElectionClass: 0,
    BindingStatus: ElectionBindingStatusProto.Binding,
    GovernanceMode: ElectionGovernanceModeProto.AdminOnly,
    DisclosureMode: 0,
    ParticipationPrivacyMode: 0,
    VoteUpdatePolicy: 0,
    EligibilitySourceType: 0,
    EligibilityMutationPolicy: 0,
    OutcomeRule: {
      Kind: 0,
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
    ReportingPolicy: 0,
    ReviewWindowPolicy: 0,
    CurrentDraftRevision: 2,
    Options: [],
    AcknowledgedWarningCodes: [],
    RequiredApprovalCount: 0,
    CreatedAt: timestamp,
    LastUpdatedAt: timestamp,
    OpenedAt: lifecycleState >= ElectionLifecycleStateProto.Open ? timestamp : undefined,
    ClosedAt: lifecycleState >= ElectionLifecycleStateProto.Closed ? timestamp : undefined,
    FinalizedAt: lifecycleState >= ElectionLifecycleStateProto.Finalized ? timestamp : undefined,
    OpenArtifactId: '',
    CloseArtifactId: '',
    FinalizeArtifactId: '',
    ...overrides,
  };
}

export function createDetail(
  electionId: string,
  lifecycleState: ElectionLifecycleStateProto,
  title: string,
  overrides?: Partial<GetElectionResponse>
): GetElectionResponse {
  return {
    Success: true,
    ErrorMessage: '',
    Election: createElectionRecord(electionId, lifecycleState, title),
    WarningAcknowledgements: [],
    TrusteeInvitations: [],
    BoundaryArtifacts: [],
    GovernedProposals: [],
    GovernedProposalApprovals: [],
    CeremonyProfiles: [],
    CeremonyVersions: [],
    CeremonyTranscriptEvents: [],
    ActiveCeremonyTrusteeStates: [],
    FinalizationSessions: [],
    FinalizationShares: [],
    FinalizationReleaseEvidenceRecords: [],
    ResultArtifacts: [],
    ...overrides,
  };
}

export function createHubView(entries: ElectionHubEntryView[]): GetElectionHubViewResponse {
  return {
    Success: true,
    ErrorMessage: '',
    ActorPublicAddress: 'actor-address',
    Elections: entries,
    HasAnyElectionRoles: entries.length > 0,
    EmptyStateReason: entries.length > 0 ? '' : 'No election roles are assigned to this actor.',
  };
}

export function createResultArtifact(overrides?: Partial<ElectionResultArtifact>): ElectionResultArtifact {
  return {
    Id: 'official-result-1',
    ElectionId: 'election-1',
    ArtifactKind: ElectionResultArtifactKindProto.ElectionResultArtifactOfficial,
    Visibility: ElectionResultArtifactVisibilityProto.ElectionResultArtifactPublicPlaintext,
    Title: 'Official result',
    NamedOptionResults: [
      {
        OptionId: 'candidate-1',
        DisplayLabel: 'Alice',
        ShortDescription: 'Board candidate',
        BallotOrder: 1,
        Rank: 1,
        VoteCount: 12,
      },
    ],
    BlankCount: 1,
    TotalVotedCount: 13,
    EligibleToVoteCount: 18,
    DidNotVoteCount: 5,
    DenominatorEvidence: {
      SnapshotType: 0,
      EligibilitySnapshotId: 'eligibility-close-1',
      BoundaryArtifactId: 'close-artifact-1',
      ActiveDenominatorSetHash: 'active-denominator-1',
    },
    TallyReadyArtifactId: 'tally-ready-1',
    SourceResultArtifactId: 'source-result-1',
    EncryptedPayload: '',
    PublicPayload: '{"winner":"Alice"}',
    RecordedAt: timestamp,
    RecordedByPublicAddress: 'actor-address',
    ...overrides,
  };
}

export function createReportPackage(
  overrides?: Partial<ElectionReportPackageSummaryView>
): ElectionReportPackageSummaryView {
  return {
    Id: 'report-package-1',
    Status: ElectionReportPackageStatusProto.ReportPackageSealed,
    AttemptNumber: 1,
    PreviousAttemptId: '',
    FinalizationSessionId: 'finalization-session-1',
    TallyReadyArtifactId: 'tally-ready-1',
    UnofficialResultArtifactId: 'unofficial-result-1',
    OfficialResultArtifactId: 'official-result-1',
    FinalizeArtifactId: 'finalize-artifact-1',
    CloseBoundaryArtifactId: 'close-artifact-1',
    CloseEligibilitySnapshotId: 'eligibility-close-1',
    FinalizationReleaseEvidenceId: 'release-evidence-1',
    FrozenEvidenceHash: new Uint8Array([1, 2, 3, 4]),
    FrozenEvidenceFingerprint: 'close=close-artifact-1|tally=tally-ready-1',
    PackageHash: new Uint8Array([4, 3, 2, 1]),
    ArtifactCount: 1,
    FailureCode: '',
    FailureReason: '',
    AttemptedAt: timestamp,
    SealedAt: timestamp,
    HasSealedAt: true,
    AttemptedByPublicAddress: 'actor-address',
    ...overrides,
  };
}

export function createReportArtifact(
  overrides?: Partial<ElectionReportArtifactView>
): ElectionReportArtifactView {
  return {
    Id: 'report-artifact-1',
    ReportPackageId: 'report-package-1',
    ElectionId: 'election-1',
    ArtifactKind: ElectionReportArtifactKindProto.ReportArtifactHumanManifest,
    Format: ElectionReportArtifactFormatProto.ReportArtifactMarkdown,
    AccessScope: ElectionReportArtifactAccessScopeProto.ReportArtifactOwnerAuditorOnly,
    SortOrder: 1,
    Title: 'Final manifest',
    FileName: 'manifest.md',
    MediaType: 'text/markdown;charset=utf-8',
    ContentHash: new Uint8Array([9, 8, 7, 6]),
    Content: '# Final manifest',
    PairedArtifactId: '',
    RecordedAt: timestamp,
    ...overrides,
  };
}

export function createResultView(
  overrides?: Partial<GetElectionResultViewResponse>
): GetElectionResultViewResponse {
  return {
    Success: true,
    ErrorMessage: '',
    ActorPublicAddress: 'actor-address',
    CanViewParticipantEncryptedResults: false,
    OfficialResultVisibilityPolicy: OfficialResultVisibilityPolicyProto.PublicPlaintext,
    ClosedProgressStatus: ElectionClosedProgressStatusProto.ClosedProgressNone,
    CanViewReportPackage: false,
    CanRetryFailedPackageFinalization: false,
    VisibleReportArtifacts: [],
    ...overrides,
  };
}
