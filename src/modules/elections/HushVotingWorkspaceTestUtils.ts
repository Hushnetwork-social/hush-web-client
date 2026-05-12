import type {
  ElectionHubEntryView,
  ElectionRecordView,
  ElectionReportArtifactView,
  ElectionReportPackageSummaryView,
  ElectionResultArtifact,
  ElectionProtocolPackageBindingView,
  ElectionSummary,
  ElectionVerificationPackageExportAvailabilityView,
  ElectionVerificationPackageStatusView,
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
  ElectionVerificationArtifactVisibilityProto,
  ElectionVerificationPackageBlockerProto,
  ElectionVerificationPackageStatusProto,
  ElectionVerificationPackageViewProto,
  ElectionVerifierOverallStatusProto,
  OfficialResultVisibilityPolicyProto,
  ProtocolPackageAccessLocationKindProto,
  ProtocolPackageApprovalStatusProto,
  ProtocolPackageBindingSourceProto,
  ProtocolPackageBindingStatusProto,
  ProtocolPackageExternalReviewStatusProto,
} from '@/lib/grpc';

export const timestamp = { seconds: 1_711_410_000, nanos: 0 };

export function createProtocolPackageBinding(
  overrides?: Partial<ElectionProtocolPackageBindingView>
): ElectionProtocolPackageBindingView {
  return {
    Id: 'protocol-package-binding-1',
    ElectionId: 'election-1',
    PackageId: 'omega-hushvoting-v1',
    PackageVersion: 'v1.0.0',
    SelectedProfileId: 'dkg-prod-3of5',
    SpecPackageHash: 'a'.repeat(64),
    ProofPackageHash: 'b'.repeat(64),
    ReleaseManifestHash: 'c'.repeat(64),
    SpecAccessLocations: [
      {
        LocationKind: ProtocolPackageAccessLocationKindProto.PublicWebsite,
        Label: 'Public spec package',
        Location:
          'https://www.hushnetwork.social/protocol-omega/hushvoting-v1/v1.0.0/spec.zip',
        ContentHash: 'a'.repeat(64),
      },
    ],
    ProofAccessLocations: [
      {
        LocationKind: ProtocolPackageAccessLocationKindProto.PublicWebsite,
        Label: 'Public proof package',
        Location:
          'https://www.hushnetwork.social/protocol-omega/hushvoting-v1/v1.0.0/proof.zip',
        ContentHash: 'b'.repeat(64),
      },
    ],
    PackageApprovalStatus: ProtocolPackageApprovalStatusProto.ApprovedInternal,
    Status: ProtocolPackageBindingStatusProto.Latest,
    Source: ProtocolPackageBindingSourceProto.CatalogSelection,
    DraftRevision: 2,
    BoundAt: timestamp,
    HasSealedAt: false,
    BoundByPublicAddress: 'actor-address',
    ExternalReviewStatus: ProtocolPackageExternalReviewStatusProto.NotReviewed,
    SourceTransactionId: '',
    SourceBlockHeight: 0,
    SourceBlockId: '',
    ...overrides,
  };
}

function getDefaultSelectedProfileId(
  governanceMode: ElectionGovernanceModeProto,
  bindingStatus: ElectionBindingStatusProto
): string {
  if (governanceMode === ElectionGovernanceModeProto.TrusteeThreshold) {
    return bindingStatus === ElectionBindingStatusProto.NonBinding
      ? 'dkg-dev-3of5'
      : 'dkg-prod-3of5';
  }

  return bindingStatus === ElectionBindingStatusProto.NonBinding
    ? 'admin-dev-1of1'
    : 'admin-prod-1of1';
}

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
  const governanceMode =
    overrides?.GovernanceMode ?? ElectionGovernanceModeProto.AdminOnly;
  const bindingStatus =
    overrides?.BindingStatus ?? ElectionBindingStatusProto.Binding;
  const selectedProfileId =
    overrides?.SelectedProfileId ??
    getDefaultSelectedProfileId(governanceMode, bindingStatus);
  const selectedProfileDevOnly =
    overrides?.SelectedProfileDevOnly ?? selectedProfileId.includes('-dev-');

  return {
    ElectionId: electionId,
    Title: title,
    ShortDescription: 'Election description',
    OwnerPublicAddress: 'actor-address',
    ExternalReferenceCode: 'ORG-2026-01',
    LifecycleState: lifecycleState,
    ElectionClass: 0,
    BindingStatus: bindingStatus,
    SelectedProfileId: selectedProfileId,
    SelectedProfileDevOnly: selectedProfileDevOnly,
    GovernanceMode: governanceMode,
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
    TallyReadyArtifactId: '',
    OfficialResultVisibilityPolicy:
      OfficialResultVisibilityPolicyProto.PublicPlaintext,
    ClosedProgressStatus: ElectionClosedProgressStatusProto.ClosedProgressNone,
    UnofficialResultArtifactId: '',
    OfficialResultArtifactId: '',
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

export function createVerificationPackageAvailability(
  overrides?: Partial<ElectionVerificationPackageExportAvailabilityView>
): ElectionVerificationPackageExportAvailabilityView {
  return {
    PackageView: ElectionVerificationPackageViewProto.VerificationPackagePublicAnonymous,
    VerifierProfileId: 'public_anonymous_v1',
    IsAvailable: true,
    Blocker: ElectionVerificationPackageBlockerProto.VerificationPackageBlockerNone,
    BlockerCode: '',
    Message: 'Public anonymous verification package export is available.',
    PackageId: 'HushElectionPackage-election-1-public',
    PackageHash: 'd'.repeat(64),
    CanRetry: false,
    ...overrides,
  };
}

export function createVerificationPackageStatus(
  overrides?: Partial<ElectionVerificationPackageStatusView>
): ElectionVerificationPackageStatusView {
  return {
    ElectionId: 'election-1',
    ActorPublicAddress: 'actor-address',
    IsVisible: true,
    Status: ElectionVerificationPackageStatusProto.VerificationPackageReady,
    StatusMessage: 'Verification package export is available.',
    PublicPackage: createVerificationPackageAvailability(),
    RestrictedPackage: createVerificationPackageAvailability({
      PackageView: ElectionVerificationPackageViewProto.VerificationPackageRestrictedOwnerAuditor,
      VerifierProfileId: 'restricted_owner_auditor_v1',
      Message: 'Restricted owner/auditor verification package export is available.',
      PackageId: 'HushElectionPackage-election-1-restricted',
      PackageHash: 'e'.repeat(64),
    }),
    ProtocolPackageBinding: createProtocolPackageBinding({
      PackageApprovalStatus: ProtocolPackageApprovalStatusProto.DraftPrivate,
      Status: ProtocolPackageBindingStatusProto.Sealed,
      HasSealedAt: true,
      SealedAt: timestamp,
    }),
    LastVerifierResult: {
      OverallStatus: ElectionVerifierOverallStatusProto.ElectionVerifierNotAvailable,
      VerifierVersion: '',
      PackageHash: '',
      PassedCount: 0,
      WarningCount: 0,
      FailedCount: 0,
      NotApplicableCount: 0,
      Message: 'No verifier output has been recorded for this package.',
      HasVerifiedAt: false,
    },
    Sp05Evidence: {
      EvidenceExpected: true,
      PublicEvidenceAvailable: true,
      RestrictedEvidenceAvailable: true,
      RosteredCount: 18,
      LinkedCount: 17,
      ActiveDenominatorCount: 18,
      CommitmentCount: 13,
      CountedParticipationCount: 13,
      DuplicateContactWarningCount: 0,
      RosterCanonicalHash: 'f'.repeat(64),
      CommitmentTreeRoot: 'a'.repeat(64),
      LatestEliResultCode: 'ELI-001',
      Message: 'SP-05 eligibility evidence is available for verification package export.',
    },
    Sp06Evidence: {
      EvidenceExpected: true,
      PublicEvidenceAvailable: true,
      RestrictedEvidenceAvailable: true,
      ControlDomainProfileId: 'high_assurance_independent_trustees_v1',
      ControlDomainProfileVersion: 'v1',
      ThresholdProfileId: 'dkg-prod-3of5',
      TrusteeCount: 5,
      TrusteeThreshold: 3,
      AcceptedBeforeOpenCount: 5,
      CompleteEvidenceCount: 5,
      MissingEvidenceCount: 0,
      StaleEvidenceCount: 0,
      IncompatibleEvidenceCount: 0,
      AcceptedReleaseArtifactCount: 3,
      MissingReleaseArtifactCount: 0,
      RejectedReleaseArtifactCount: 0,
      LatestCtrlResultCode: 'CTRL-001',
      Blockers: [],
      Message: 'SP-06 trustee control-domain evidence is available for verification package export.',
    },
    Sp07Evidence: {
      EvidenceExpected: true,
      PublicEvidenceAvailable: true,
      RestrictedEvidenceAvailable: true,
      PublicationProofMode: 'zk_rerandomization_shuffle_v1',
      ProofConstruction: 'bayer_groth_reencryption_shuffle_argument_v1',
      StatementId: 'sp07-bayer-groth-hush-vector-shuffle-v1',
      ExternalReviewStatus: 'external_crypto_review_pending',
      AcceptedBallotCount: 18,
      PublishedBallotCount: 18,
      CiphertextSlotCount: 4,
      ChunkCount: 1,
      AcceptedBallotSetHash: '1'.repeat(64),
      PublishedBallotStreamHash: '2'.repeat(64),
      TranscriptHash: '3'.repeat(64),
      ProofHash: '4'.repeat(64),
      WitnessDeletionReceiptHash: '5'.repeat(64),
      LatestPubResultCode: 'PUB-001',
      ProgressStatus: ElectionClosedProgressStatusProto.ClosedProgressPublicationProofVerified,
      CanRetry: false,
      Blockers: [],
      Message: 'SP-07 publication-proof evidence is available for verification package export.',
      CompletedChunkCount: 1,
      FailedChunkCount: 0,
      SlowestChunkMilliseconds: 120,
    },
    Sp08ReleaseIntegrity: {
      EvidenceExpected: true,
      PublicEvidenceAvailable: true,
      RestrictedEvidenceAvailable: true,
      EvidenceMode: 'official_sp08',
      NotForReleaseIntegrityClaims: false,
      BlocksHighAssurance: false,
      ReleaseManifestName: 'HushVotingReleaseManifest-v1.json',
      ReleaseManifestHash: 'b'.repeat(64),
      ProtocolPackageManifestName: 'ProtocolOmegaPackageManifest.json',
      ProtocolPackageManifestHash: 'c'.repeat(64),
      PrimaryResultCode: 'release_integrity_evidence_valid',
      PrimaryIssue: '',
      ComponentCount: 2,
      LifecycleBindingCount: 1,
      EvidenceFileCount: 3,
      MobileEvidenceIncluded: true,
      Message: 'Official SP-08 release-integrity evidence is present in the verification package.',
      Components: [
        {
          ComponentId: 'server',
          ComponentType: 'container_image',
          EvidenceMode: 'official_sp08',
          ArtifactName: 'hush-server-node',
          ArtifactDigest: 'sha256:server',
          ImmutableReference: 'ghcr.io/hushnetwork/hush-server-node@sha256:server',
          BuildWorkflowRunId: '123',
          DistributionReference: 'ghcr.io/hushnetwork/hush-server-node@sha256:server',
          HasSigningFingerprint: false,
          IsPlaceholder: false,
        },
        {
          ComponentId: 'mobile_app',
          ComponentType: 'android_apk',
          EvidenceMode: 'official_sp08',
          ArtifactName: 'HushNetwork.apk',
          ArtifactDigest: 'sha256:mobile',
          ImmutableReference:
            'https://github.com/HushNetworkOrg/hush-web-client/actions/runs/123/artifacts/456',
          BuildWorkflowRunId: '123',
          DistributionReference:
            'https://github.com/HushNetworkOrg/hush-web-client/actions/runs/123/artifacts/456',
          HasSigningFingerprint: true,
          IsPlaceholder: false,
        },
      ],
      LifecycleBindings: [
        {
          LifecycleStage: 'open',
          ExpectedReleaseId: 'release-2026.05.11',
          ObservedReleaseId: 'release-2026.05.11',
          ExpectedArtifactDigest: 'sha256:server',
          ObservedArtifactDigest: 'sha256:server',
          MatchesSealedPolicy: true,
        },
      ],
      EvidenceFiles: [
        {
          RelativePath: 'artifacts/election-record/release-manifest.json',
          Visibility: ElectionVerificationArtifactVisibilityProto.VerificationArtifactPublic,
          IsPresent: true,
          ContentHash: 'sha256:release-manifest',
        },
        {
          RelativePath: 'artifacts/election-record/release-integrity.json',
          Visibility: ElectionVerificationArtifactVisibilityProto.VerificationArtifactPublic,
          IsPresent: true,
          ContentHash: 'sha256:release-integrity',
        },
        {
          RelativePath: 'artifacts/election-record/release-integrity-verifier-output.json',
          Visibility: ElectionVerificationArtifactVisibilityProto.VerificationArtifactPublic,
          IsPresent: true,
          ContentHash: 'sha256:release-verifier',
        },
      ],
    },
    Sp09ExternalReview: {
      EvidenceExpected: true,
      PublicEvidenceAvailable: true,
      RestrictedEvidenceAvailable: true,
      ProgramVersion: 'SP09-P1',
      ReviewScope: 'protocol_proof_verifier_publication_path_v1',
      ReviewType: 'private_third_party_crypto_protocol_review_v1',
      ReviewPhase: 'SP09-P1',
      DetailedStatus: 'not_started',
      Availability: 'planned',
      ClaimState: 'program_defined',
      ReviewScopeMatchesElection: true,
      PrimaryResultCode: 'external_review_not_complete',
      PrimaryIssue: 'External examination program is defined; no reviewer conclusion is available.',
      CustomerSafeSummaryHash: '',
      CustomerSafeSummaryUrl: '',
      KnownLimitationsVersion: 'v1.0.0',
      KnownLimitationsHash: 'sha256:limitations',
      ReviewedArtifactCount: 0,
      OpenCriticalFindingCount: 0,
      OpenHighFindingCount: 0,
      OpenFindingCount: 0,
      PublicEvidenceFileCount: 3,
      RestrictedEvidenceFileCount: 3,
      BlocksReviewedClaims: false,
      RequiresRedesign: false,
      Message: 'External examination program is defined; no reviewer conclusion is available.',
      ReviewedArtifacts: [],
      FindingSummary: [
        {
          Severity: 'critical',
          OpenCount: 0,
          FixedCount: 0,
          AcceptedLimitationCount: 0,
        },
        {
          Severity: 'high',
          OpenCount: 0,
          FixedCount: 0,
          AcceptedLimitationCount: 0,
        },
      ],
      EvidenceFiles: [
        {
          RelativePath: 'artifacts/election-record/external-review-status.json',
          Visibility: ElectionVerificationArtifactVisibilityProto.VerificationArtifactPublic,
          IsPresent: true,
          ContentHash: 'sha256:external-review-status',
        },
        {
          RelativePath: 'artifacts/election-record/external-review-claim-table.json',
          Visibility: ElectionVerificationArtifactVisibilityProto.VerificationArtifactPublic,
          IsPresent: true,
          ContentHash: 'sha256:external-review-claim-table',
        },
        {
          RelativePath: 'artifacts/election-record/external-review-verifier-output.json',
          Visibility: ElectionVerificationArtifactVisibilityProto.VerificationArtifactPublic,
          IsPresent: true,
          ContentHash: 'sha256:external-review-verifier-output',
        },
      ],
    },
    Sp10OperationalSecurity: {
      EvidenceExpected: true,
      PublicEvidenceAvailable: true,
      RestrictedEvidenceAvailable: true,
      ProgramVersion: 'SP10-P1',
      DeploymentProfileId: 'hushvoting_managed_aws_container_v1',
      EvidenceState: 'development_placeholder',
      DoesNotCompleteFeat106Readiness: true,
      Feat106ReadinessCaveat:
        'Development-only operational placeholders are present and cannot support high-assurance operational claims.',
      ReleaseEvidenceMode: 'development_placeholder',
      ReleaseManifestHash: 'b'.repeat(64),
      ImmutableDeploymentRef: 'ghcr.io/hushnetwork/hush-server-node:development-placeholder',
      CustodyMode: 'aws_kms_per_election_envelope_v1',
      ExecutorKeyLifecycle: 'executor_ephemeral_memory_key_v1',
      AccessSnapshotHashOrRestrictedRef: '',
      BackupRestoreHashOrRestrictedRef: '',
      IncidentStatus: 'no_incident_declared',
      AuditorRoomAccessLogHashOrRestrictedRef: '',
      BlocksHighAssurance: true,
      PrimaryResultCode: 'operational_security_development_placeholder',
      PrimaryIssue:
        'Development-only SP-10 operational evidence is exported for this package. FEAT-106 readiness, legal validation, public-election approval, and certification remain out of scope.',
      PublicEvidenceFileCount: 4,
      RestrictedEvidenceFileCount: 5,
      Message:
        'Development-only operational placeholders are present and cannot support high-assurance operational claims.',
      EvidenceFiles: [
        {
          RelativePath: 'artifacts/election-record/operational-security-summary.json',
          Visibility: ElectionVerificationArtifactVisibilityProto.VerificationArtifactPublic,
          IsPresent: true,
          ContentHash: 'sha256:operational-security-summary',
        },
        {
          RelativePath: 'artifacts/election-record/operational-deployment-evidence.json',
          Visibility: ElectionVerificationArtifactVisibilityProto.VerificationArtifactPublic,
          IsPresent: true,
          ContentHash: 'sha256:operational-deployment-evidence',
        },
        {
          RelativePath: 'artifacts/election-record/operational-custody-evidence.json',
          Visibility: ElectionVerificationArtifactVisibilityProto.VerificationArtifactPublic,
          IsPresent: true,
          ContentHash: 'sha256:operational-custody-evidence',
        },
        {
          RelativePath: 'artifacts/election-record/operational-verifier-output.json',
          Visibility: ElectionVerificationArtifactVisibilityProto.VerificationArtifactPublic,
          IsPresent: true,
          ContentHash: 'sha256:operational-verifier-output',
        },
        {
          RelativePath: 'artifacts/restricted/operational-access-control-snapshot.json',
          Visibility: ElectionVerificationArtifactVisibilityProto.VerificationArtifactRestricted,
          IsPresent: true,
          ContentHash: 'sha256:operational-access-control-snapshot',
        },
      ],
    },
    Sp11RegulatoryClaim: {
      EvidenceExpected: false,
      PublicEvidenceAvailable: false,
      RestrictedEvidenceAvailable: false,
      ClaimExported: false,
      TrackerVersion: 'SP11-P1',
      JurisdictionId: '',
      ClaimId: '',
      ClaimState: '',
      HasSourceCheckedAt: false,
      HasNextReviewAt: false,
      SourceRef: '',
      Owner: '',
      IsLegalAdvice: false,
      RequiresAuthorityEvidence: false,
      AuthorityEvidenceRef: '',
      RestrictedWorkpaperRef: '',
      AllowedWording: '',
      IsStale: false,
      BlocksClaims: false,
      PrimaryResultCode: '',
      PrimaryIssue: '',
      PublicEvidenceFileCount: 0,
      RestrictedEvidenceFileCount: 0,
      Message: 'No SP-11 regulatory claim is exported for this package.',
      EvidenceFiles: [],
    },
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
