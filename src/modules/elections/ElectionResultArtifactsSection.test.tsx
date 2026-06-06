import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ElectionRecordView,
  ElectionAnomalyPublicSummaryView,
  ElectionAnomalyReportReadinessView,
  ElectionReportArtifactView,
  ElectionReportPackageSummaryView,
  ElectionResultArtifact,
  GetElectionResultViewResponse,
} from '@/lib/grpc';
import {
  ElectionBindingStatusProto,
  ElectionClassProto,
  ElectionClosedProgressStatusProto,
  ElectionDisclosureModeProto,
  ElectionGovernanceModeProto,
  ElectionLifecycleStateProto,
  ElectionReportArtifactAccessScopeProto,
  ElectionReportArtifactFormatProto,
  ElectionReportArtifactKindProto,
  ElectionReportPackageKindProto,
  ElectionReportPackageStatusProto,
  ElectionResultArtifactKindProto,
  ElectionResultArtifactVisibilityProto,
  ElectionEligibilitySnapshotTypeProto,
  EligibilityMutationPolicyProto,
  EligibilitySourceTypeProto,
  OfficialResultVisibilityPolicyProto,
  OutcomeRuleKindProto,
  ParticipationPrivacyModeProto,
  ProtocolPackageBindingStatusProto,
  ReportingPolicyProto,
  ReviewWindowPolicyProto,
  VoteUpdatePolicyProto,
} from '@/lib/grpc';
import { ElectionResultArtifactsSection } from './ElectionResultArtifactsSection';
import { createProtocolPackageBinding } from './HushVotingWorkspaceTestUtils';

const timestamp = { seconds: 1_774_120_000, nanos: 0 };

function createElectionRecord(overrides?: Partial<ElectionRecordView>): ElectionRecordView {
  return {
    ElectionId: 'election-1',
    Title: 'Board Election',
    ShortDescription: 'Annual board vote',
    OwnerPublicAddress: 'owner-public-key',
    ExternalReferenceCode: 'ORG-2026-01',
    LifecycleState: ElectionLifecycleStateProto.Finalized,
    ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
    BindingStatus: ElectionBindingStatusProto.Binding,
    SelectedProfileId: 'dkg-prod-3of5',
    SelectedProfileDevOnly: false,
    GovernanceMode: ElectionGovernanceModeProto.AdminOnly,
    DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
    ParticipationPrivacyMode:
      ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
    VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
    EligibilitySourceType: EligibilitySourceTypeProto.OrganizationImportedRoster,
    EligibilityMutationPolicy: EligibilityMutationPolicyProto.FrozenAtOpen,
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
    ClosedAt: timestamp,
    FinalizedAt: timestamp,
    OpenArtifactId: 'open-artifact-1',
    CloseArtifactId: 'close-artifact-1',
    FinalizeArtifactId: 'finalize-artifact-1',
    TallyReadyAt: timestamp,
    VoteAcceptanceLockedAt: timestamp,
    TallyReadyArtifactId: 'tally-ready-artifact-1',
    OfficialResultVisibilityPolicy: OfficialResultVisibilityPolicyProto.PublicPlaintext,
    ClosedProgressStatus: ElectionClosedProgressStatusProto.ClosedProgressNone,
    UnofficialResultArtifactId: 'unofficial-result-1',
    OfficialResultArtifactId: 'official-result-1',
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
        DisplayLabel: 'Alice',
        ShortDescription: 'First option',
        BallotOrder: 1,
        Rank: 1,
        VoteCount: 10,
      },
      {
        OptionId: 'option-b',
        DisplayLabel: 'Bob',
        ShortDescription: 'Second option',
        BallotOrder: 2,
        Rank: 2,
        VoteCount: 4,
      },
    ],
    BlankCount: 1,
    TotalVotedCount: 15,
    EligibleToVoteCount: 20,
    DidNotVoteCount: 5,
    DenominatorEvidence: {
      SnapshotType: ElectionEligibilitySnapshotTypeProto.EligibilitySnapshotClose,
      EligibilitySnapshotId: 'eligibility-snapshot-1',
      BoundaryArtifactId: 'close-artifact-1',
      ActiveDenominatorSetHash: 'active-denominator-hash-1',
    },
    TallyReadyArtifactId: 'tally-ready-artifact-1',
    SourceResultArtifactId: 'unofficial-result-1',
    EncryptedPayload: '',
    PublicPayload: '{"winner":"Alice"}',
    RecordedAt: timestamp,
    RecordedByPublicAddress: 'owner-public-key',
    ...overrides,
  };
}

function createReportPackage(
  overrides?: Partial<ElectionReportPackageSummaryView>
): ElectionReportPackageSummaryView {
  return {
    Id: 'report-package-1',
    Status: ElectionReportPackageStatusProto.ReportPackageSealed,
    AttemptNumber: 2,
    PreviousAttemptId: 'report-package-0',
    FinalizationSessionId: 'finalization-session-1',
    TallyReadyArtifactId: 'tally-ready-artifact-1',
    UnofficialResultArtifactId: 'unofficial-result-1',
    OfficialResultArtifactId: 'official-result-1',
    FinalizeArtifactId: 'finalize-artifact-1',
    CloseBoundaryArtifactId: 'close-artifact-1',
    CloseEligibilitySnapshotId: 'eligibility-snapshot-1',
    FinalizationReleaseEvidenceId: 'release-evidence-1',
    FrozenEvidenceHash: new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]),
    FrozenEvidenceFingerprint: 'close=close-artifact-1|tally=tally-ready-artifact-1',
    PackageHash: new Uint8Array([0x01, 0x02, 0x03, 0x04]),
    ArtifactCount: 12,
    FailureCode: '',
    FailureReason: '',
    AttemptedAt: timestamp,
    SealedAt: timestamp,
    HasSealedAt: true,
    AttemptedByPublicAddress: 'owner-public-key',
    ...overrides,
  };
}

function createReportArtifact(
  overrides?: Partial<ElectionReportArtifactView>
): ElectionReportArtifactView {
  return {
    Id: 'report-artifact-1',
    ReportPackageId: 'report-package-1',
    ElectionId: 'election-1',
    ArtifactKind: ElectionReportArtifactKindProto.ReportArtifactHumanManifest,
    Format: ElectionReportArtifactFormatProto.ReportArtifactMarkdown,
    AccessScope: ElectionReportArtifactAccessScopeProto.ReportArtifactOwnerAuditorTrustee,
    SortOrder: 1,
    Title: 'Final manifest',
    FileName: 'manifest.md',
    MediaType: 'text/markdown;charset=utf-8',
    ContentHash: new Uint8Array([0x10, 0x20, 0x30, 0x40]),
    Content: '# Final manifest',
    PairedArtifactId: 'report-artifact-2',
    RecordedAt: timestamp,
    ...overrides,
  };
}

function createPublicAnomalySummary(
  overrides?: Partial<ElectionAnomalyPublicSummaryView>
): ElectionAnomalyPublicSummaryView {
  return {
    SchemaId: 'public-anomaly-summary-v1',
    SuppressionPolicyId: 'anomaly-public-summary-v1',
    ElectionId: 'election-1',
    SourceManifestHash: 'sha256:manifest',
    HasSourceManifestHash: true,
    TotalThreadCount: 7,
    HasTotalThreadCount: true,
    TotalThreadCountMode: 'exact',
    VisibleBuckets: [
      {
        CategoryId: 'ballot_casting_or_receipt_anomaly',
        CountMode: 'exact',
        PublicCount: 4,
        HasPublicCount: true,
        SuppressionReasonIds: [],
        SourceCategoryIds: ['ballot_casting_or_receipt_anomaly'],
      },
      {
        CategoryId: 'other_process_anomaly',
        CountMode: 'aggregated',
        PublicCount: 3,
        HasPublicCount: true,
        SuppressionReasonIds: ['low_count_category'],
        SourceCategoryIds: [
          'access_or_authentication_anomaly',
          'trustee_continuity_anomaly',
        ],
      },
      {
        CategoryId: 'security_or_integrity_concern',
        CountMode: 'suppressed',
        PublicCount: 0,
        HasPublicCount: false,
        SuppressionReasonIds: ['restricted_evidence_only'],
        SourceCategoryIds: ['security_or_integrity_concern'],
      },
    ],
    AggregatedBucketCount: 2,
    SuppressedThreadCount: 1,
    SuppressionReasonIds: ['low_count_category', 'restricted_evidence_only'],
    RestrictedManifestArtifactId: 'restricted-anomaly-artifact-1',
    HasRestrictedManifestArtifactId: true,
    RestrictedManifestHash: 'sha256:restricted-manifest',
    HasRestrictedManifestHash: true,
    GeneratedAt: timestamp,
    ...overrides,
  };
}

function createAnomalyReportReadiness(
  overrides?: Partial<ElectionAnomalyReportReadinessView>
): ElectionAnomalyReportReadinessView {
  return {
    PublicSummarySchemaId: 'public-anomaly-summary-v1',
    SuppressionPolicyId: 'anomaly-public-summary-v1',
    ForbiddenFieldScanStatusId: 'passed',
    RestrictedManifestArtifactId: 'restricted-anomaly-artifact-1',
    HasRestrictedManifestArtifactId: true,
    RestrictedManifestHash: 'sha256:restricted-manifest',
    HasRestrictedManifestHash: true,
    PackageReadinessStatusId: 'ready',
    PackageReadinessBlockerIds: [],
    OpenCaseCount: 0,
    EscalatedCaseCount: 0,
    RetentionEvidenceStatusId: 'governed_hold_reference_recorded',
    RetentionEvidenceStatus: {
      StatusId: 'governed_hold_reference_recorded',
      GovernedDecisionRefs: ['gov-42'],
      RedactionHoldReferenceCount: 0,
      OpenCaseCount: 0,
      EscalatedCaseCount: 1,
      ReadinessBlocksValidationClaims: false,
      Message: 'Governed anomaly lifecycle evidence is recorded by reference.',
    },
    HasGovernedLifecycleEvidence: true,
    ReportGenerationReadOnlyStatusId: 'validated',
    ...overrides,
  };
}

function createCeremonySnapshot(overrides?: {
  ProfileId?: string;
  TrusteeCount?: number;
  RequiredApprovalCount?: number;
  TallyPublicKeyFingerprint?: string;
}): GetElectionResultViewResponse['CeremonySnapshot'] {
  return {
    CeremonyVersionId: 'ceremony-version-1',
    VersionNumber: 1,
    ProfileId: overrides?.ProfileId ?? 'dkg-prod-3of5',
    TrusteeCount: overrides?.TrusteeCount ?? 5,
    RequiredApprovalCount: overrides?.RequiredApprovalCount ?? 3,
    CompletedTrustees: [
      { TrusteeUserAddress: 'trustee-a', TrusteeDisplayName: 'Trustee A' },
      { TrusteeUserAddress: 'trustee-b', TrusteeDisplayName: 'Trustee B' },
      { TrusteeUserAddress: 'trustee-c', TrusteeDisplayName: 'Trustee C' },
    ],
    TallyPublicKeyFingerprint:
      overrides?.TallyPublicKeyFingerprint ?? 'tally-fingerprint-123456',
  };
}

function createResultView(
  overrides?: Partial<GetElectionResultViewResponse>
): GetElectionResultViewResponse {
  return {
    Success: true,
    ErrorMessage: '',
    ActorPublicAddress: 'actor-public-key',
    CanViewParticipantEncryptedResults: false,
    OfficialResultVisibilityPolicy: OfficialResultVisibilityPolicyProto.PublicPlaintext,
    ClosedProgressStatus: ElectionClosedProgressStatusProto.ClosedProgressNone,
    CanViewReportPackage: false,
    CanRetryFailedPackageFinalization: false,
    VisibleReportArtifacts: [],
    ...overrides,
  };
}

describe('ElectionResultArtifactsSection', () => {
  const originalCreateObjectUrl = window.URL.createObjectURL;
  const originalRevokeObjectUrl = window.URL.revokeObjectURL;
  const originalAnchorClick = HTMLAnchorElement.prototype.click;

  beforeEach(() => {
    window.URL.createObjectURL = vi.fn(() => 'blob:report-artifact');
    window.URL.revokeObjectURL = vi.fn();
    HTMLAnchorElement.prototype.click = vi.fn();
  });

  afterEach(() => {
    window.URL.createObjectURL = originalCreateObjectUrl;
    window.URL.revokeObjectURL = originalRevokeObjectUrl;
    HTMLAnchorElement.prototype.click = originalAnchorClick;
  });

  it('shows failed package state and retry guidance for privileged actors', () => {
    render(
      <ElectionResultArtifactsSection
        election={createElectionRecord()}
        resultView={createResultView({
          CeremonySnapshot: createCeremonySnapshot(),
          CanViewReportPackage: true,
          CanRetryFailedPackageFinalization: true,
          LatestReportPackage: createReportPackage({
            Status: ElectionReportPackageStatusProto.ReportPackageGenerationFailed,
            HasSealedAt: false,
            SealedAt: undefined,
            FailureCode: 'report_package_content_mismatch',
            FailureReason: 'Machine and human artifact hashes diverged during sealing.',
          }),
        })}
      />
    );

    expect(screen.getByTestId('report-package-summary')).toHaveTextContent(
      'Finalization incomplete'
    );
    expect(screen.getByTestId('report-package-summary')).toHaveTextContent(
      'Retry available from owner finalization controls'
    );
    expect(screen.getByTestId('report-package-summary')).toHaveTextContent(
      'Machine and human artifact hashes diverged during sealing.'
    );
  });

  it('renders the trustee-visible sealed artifact catalog and allows downloads for visible artifacts', () => {
    render(
      <ElectionResultArtifactsSection
        election={createElectionRecord()}
        resultView={createResultView({
          CeremonySnapshot: createCeremonySnapshot(),
          CanViewReportPackage: true,
          LatestReportPackage: createReportPackage(),
          VisibleReportArtifacts: [
            createReportArtifact(),
            createReportArtifact({
              Id: 'report-artifact-2',
              ArtifactKind:
                ElectionReportArtifactKindProto.ReportArtifactMachineOutcomeDeterminationProjection,
              Format: ElectionReportArtifactFormatProto.ReportArtifactJson,
              Title: 'Outcome projection',
              FileName: 'outcome.json',
              MediaType: 'application/json',
              Content: '{"conclusion":"pass"}',
              PairedArtifactId: 'report-artifact-6',
            }),
            createReportArtifact({
              Id: 'report-artifact-3',
              ArtifactKind:
                ElectionReportArtifactKindProto.ReportArtifactMachineRestrictedAnomalyIntakeManifest,
              Format: ElectionReportArtifactFormatProto.ReportArtifactJson,
              Title: 'Restricted anomaly manifest',
              FileName: 'restricted-anomaly-intake-manifest.json',
              MediaType: 'application/json',
              Content: '{"packageReadinessStatusId":"ready"}',
              PairedArtifactId: '',
            }),
          ],
        })}
      />
    );

    expect(screen.getByTestId('report-package-summary')).toHaveTextContent(
      'Sealed package available'
    );
    expect(screen.getByTestId('report-package-catalog')).toHaveTextContent('Final manifest');
    expect(screen.getByTestId('report-package-catalog')).toHaveTextContent('Outcome projection');
    expect(screen.getByTestId('restricted-anomaly-artifact-row')).toHaveTextContent(
      'Restricted anomaly manifest'
    );
    expect(screen.queryByText('Named roster')).not.toBeInTheDocument();
    expect(screen.queryByText('{"packageReadinessStatusId":"ready"}')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('report-artifact-download-report-artifact-1'));

    expect(window.URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    expect(window.URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('renders public anomaly summary, readiness, retention, and restricted artifact status', () => {
    render(
      <ElectionResultArtifactsSection
        election={createElectionRecord()}
        resultView={createResultView({
          CeremonySnapshot: createCeremonySnapshot(),
          CanViewReportPackage: true,
          LatestReportPackage: createReportPackage(),
          PublicAnomalySummary: createPublicAnomalySummary(),
          AnomalyReportReadiness: createAnomalyReportReadiness(),
          VisibleReportArtifacts: [
            createReportArtifact({
              Id: 'restricted-anomaly-artifact-1',
              ArtifactKind:
                ElectionReportArtifactKindProto.ReportArtifactMachineRestrictedAnomalyIntakeManifest,
              Format: ElectionReportArtifactFormatProto.ReportArtifactJson,
              Title: 'Restricted anomaly manifest',
              FileName: 'restricted-anomaly-intake-manifest.json',
              MediaType: 'application/json',
              Content: '{"submitterActorPublicAddress":"private-address"}',
              PairedArtifactId: '',
            }),
          ],
        })}
      />
    );

    expect(screen.getByTestId('public-anomaly-summary-panel')).toHaveTextContent(
      'Privacy-safe anomaly reporting'
    );
    expect(screen.getByTestId('public-anomaly-summary-panel')).toHaveTextContent(
      'Ballot Casting Or Receipt Anomaly'
    );
    expect(screen.getByTestId('public-anomaly-summary-panel')).toHaveTextContent(
      'Aggregates 2 source categories.'
    );
    expect(screen.getByTestId('public-anomaly-summary-panel')).toHaveTextContent('Withheld');
    expect(screen.getByTestId('anomaly-report-readiness-strip')).toHaveTextContent(
      'Governed Hold Reference Recorded'
    );
    expect(screen.getByTestId('anomaly-retention-status')).toHaveTextContent('gov-42');
    expect(screen.getByTestId('restricted-anomaly-artifact-row')).toHaveTextContent(
      'Download is available'
    );
    expect(screen.queryByText('private-address')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('restricted-anomaly-artifact-download'));

    expect(window.URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('renders no-anomaly summary state without restricted artifact content', () => {
    render(
      <ElectionResultArtifactsSection
        election={createElectionRecord()}
        resultView={createResultView({
          CeremonySnapshot: createCeremonySnapshot(),
          CanViewReportPackage: true,
          LatestReportPackage: createReportPackage(),
          PublicAnomalySummary: createPublicAnomalySummary({
            TotalThreadCount: 0,
            HasTotalThreadCount: true,
            TotalThreadCountMode: 'exact',
            VisibleBuckets: [],
            AggregatedBucketCount: 0,
            SuppressedThreadCount: 0,
            SuppressionReasonIds: [],
            RestrictedManifestArtifactId: '',
            HasRestrictedManifestArtifactId: false,
            RestrictedManifestHash: '',
            HasRestrictedManifestHash: false,
          }),
        })}
      />
    );

    expect(screen.getByTestId('public-anomaly-summary-panel')).toHaveTextContent(
      'No anomaly threads are included'
    );
    expect(screen.queryByTestId('restricted-anomaly-artifact-row')).not.toBeInTheDocument();
  });

  it('renders blocked readiness and missing restricted artifact reference states', () => {
    render(
      <ElectionResultArtifactsSection
        election={createElectionRecord()}
        resultView={createResultView({
          CeremonySnapshot: createCeremonySnapshot(),
          CanViewReportPackage: true,
          LatestReportPackage: createReportPackage(),
          PublicAnomalySummary: createPublicAnomalySummary({
            TotalThreadCount: 0,
            HasTotalThreadCount: false,
            TotalThreadCountMode: 'suppressed',
            VisibleBuckets: [
              {
                CategoryId: 'security_or_integrity_concern',
                CountMode: 'suppressed',
                PublicCount: 0,
                HasPublicCount: false,
                SuppressionReasonIds: ['restricted_evidence_only'],
                SourceCategoryIds: ['security_or_integrity_concern'],
              },
            ],
            AggregatedBucketCount: 0,
            SuppressedThreadCount: 2,
            SuppressionReasonIds: ['restricted_evidence_only'],
          }),
          AnomalyReportReadiness: createAnomalyReportReadiness({
            PackageReadinessStatusId: 'blocked',
            PackageReadinessBlockerIds: ['payload_missing'],
            OpenCaseCount: 1,
            RetentionEvidenceStatusId: 'open_case_requires_policy_review',
            RetentionEvidenceStatus: {
              StatusId: 'open_case_requires_policy_review',
              GovernedDecisionRefs: [],
              RedactionHoldReferenceCount: 0,
              OpenCaseCount: 1,
              EscalatedCaseCount: 0,
              ReadinessBlocksValidationClaims: true,
              Message: 'Open anomaly cases require policy review.',
            },
          }),
        })}
      />
    );

    expect(screen.getByTestId('anomaly-report-readiness-strip')).toHaveTextContent('Blocked');
    expect(screen.getByTestId('public-anomaly-summary-panel')).toHaveTextContent(
      'All anomaly counts are withheld'
    );
    expect(screen.getByTestId('anomaly-report-readiness-strip')).toHaveTextContent(
      'Payload Missing'
    );
    expect(screen.getByTestId('anomaly-retention-status')).toHaveTextContent(
      'Open anomaly cases require policy review.'
    );
    expect(screen.getByTestId('restricted-anomaly-artifact-row')).toHaveTextContent('Not visible');
  });

  it('keeps ordinary participants on the official-result-only path', () => {
    render(
      <ElectionResultArtifactsSection
        election={createElectionRecord()}
        resultView={createResultView({
          CeremonySnapshot: createCeremonySnapshot(),
          UnofficialResult: createResultArtifact({
            Id: 'unofficial-result-1',
            ArtifactKind: ElectionResultArtifactKindProto.ElectionResultArtifactUnofficial,
            Title: 'Unofficial result',
            TallyReadyArtifactId: 'tally-ready-artifact-1',
            SourceResultArtifactId: '',
          }),
          OfficialResult: createResultArtifact(),
          LatestReportPackage: createReportPackage(),
          VisibleReportArtifacts: [
            createReportArtifact({
              ArtifactKind:
                ElectionReportArtifactKindProto.ReportArtifactHumanNamedParticipationRoster,
              AccessScope:
                ElectionReportArtifactAccessScopeProto.ReportArtifactOwnerAuditorOnly,
              Title: 'Named roster',
            }),
          ],
        })}
      />
    );

    expect(screen.getByTestId('election-official-result')).toHaveTextContent('Official result');
    expect(screen.getByTestId('election-artifact-context')).toHaveTextContent(
      'Official visibility'
    );
    expect(screen.queryByTestId('election-unofficial-result')).not.toBeInTheDocument();
    expect(screen.queryByTestId('report-package-summary')).not.toBeInTheDocument();
    expect(screen.queryByText('Named roster')).not.toBeInTheDocument();
  });

  it('shows binding mode, ceremony profile, and secrecy boundary context for result artifacts', () => {
    render(
      <ElectionResultArtifactsSection
        election={createElectionRecord()}
        resultView={createResultView({
          CeremonySnapshot: createCeremonySnapshot(),
          OfficialResult: createResultArtifact(),
        })}
      />
    );

    expect(screen.getByTestId('election-artifact-context')).toHaveTextContent('Mode and circuit truth');
    expect(screen.getByTestId('election-artifact-context')).toHaveTextContent('Binding');
    expect(screen.getByTestId('election-artifact-context')).toHaveTextContent('HushVoting Direct protected custody path');
    expect(screen.getByTestId('election-artifact-context')).toHaveTextContent('non-dev circuits');
    expect(screen.getByTestId('election-artifact-context')).toHaveTextContent('Non-dev circuit');
    expect(screen.getByTestId('election-artifact-context')).toHaveTextContent('dkg-prod-3of5');
    expect(screen.getByTestId('election-artifact-context')).toHaveTextContent('tally-fingerprint-123456');
    expect(screen.getByTestId('election-artifact-context')).toHaveTextContent(
      'protected non-dev circuit'
    );
    expect(screen.getByTestId('election-artifact-context')).toHaveTextContent(
      'HushVoting Direct protected custody keeps tally release bound'
    );
  });

  it('shows explicit open-audit context for non-binding election artifacts', () => {
    render(
      <ElectionResultArtifactsSection
        election={createElectionRecord({
          BindingStatus: ElectionBindingStatusProto.NonBinding,
          SelectedProfileId: 'dkg-dev-3of5',
          SelectedProfileDevOnly: true,
        })}
        resultView={createResultView({
          CeremonySnapshot: createCeremonySnapshot({
            ProfileId: 'dkg-dev-3of5',
          }),
          OfficialResult: createResultArtifact(),
        })}
      />
    );

    expect(screen.getByTestId('election-artifact-context')).toHaveTextContent('Non-binding');
    expect(screen.getByTestId('election-artifact-context')).toHaveTextContent('dev/open and non-dev circuits');
    expect(screen.getByTestId('election-artifact-context')).toHaveTextContent('Dev/open circuit');
    expect(screen.getByTestId('election-artifact-context')).toHaveTextContent('dkg-dev-3of5');
    expect(screen.getByTestId('election-artifact-context')).toHaveTextContent(
      'explicit open-audit circuit'
    );
  });

  it('shows inherited tally-ready lineage wording for official results', () => {
    render(
      <ElectionResultArtifactsSection
        election={createElectionRecord()}
        resultView={createResultView({
          CeremonySnapshot: createCeremonySnapshot(),
          OfficialResult: createResultArtifact({
            TallyReadyArtifactId: '',
            SourceResultArtifactId: 'unofficial-result-1',
          }),
        })}
      />
    );

    expect(screen.getByTestId('election-official-result')).toHaveTextContent(
      'Tally ready: Inherited via source result'
    );
  });

  it('can suppress the report package while still rendering result artifacts', () => {
    render(
      <ElectionResultArtifactsSection
        election={createElectionRecord()}
        resultView={createResultView({
          CeremonySnapshot: createCeremonySnapshot(),
          OfficialResult: createResultArtifact(),
          CanViewReportPackage: true,
          LatestReportPackage: createReportPackage(),
        })}
        showReportPackage={false}
      />
    );

    expect(screen.getByTestId('election-official-result')).toBeInTheDocument();
    expect(screen.queryByTestId('report-package-summary')).not.toBeInTheDocument();
  });

  it('shortens the frozen-evidence fingerprint in the package summary while keeping the full value on hover', () => {
    const longFingerprint =
      'ee0a9b7d10737e2dd1ce70e9998d9c3361e2a0ffb798e429c8a83b6d858041cb';

    render(
      <ElectionResultArtifactsSection
        election={createElectionRecord()}
        resultView={createResultView({
          CeremonySnapshot: createCeremonySnapshot(),
          CanViewReportPackage: true,
          LatestReportPackage: createReportPackage({
            FrozenEvidenceFingerprint: longFingerprint,
          }),
        })}
      />
    );

    expect(screen.getByTitle(longFingerprint)).toHaveTextContent('ee0a9b7d1073...858041cb');
    expect(screen.queryByText(longFingerprint)).not.toBeInTheDocument();
  });

  it('repeats the package boundary truth when a sealed report package is visible', () => {
    render(
      <ElectionResultArtifactsSection
        election={createElectionRecord()}
        resultView={createResultView({
          CeremonySnapshot: createCeremonySnapshot(),
          CanViewReportPackage: true,
          LatestReportPackage: createReportPackage(),
        })}
      />
    );

    expect(screen.getByTestId('report-package-boundary-context')).toHaveTextContent('Binding');
    expect(screen.getByTestId('report-package-boundary-context')).toHaveTextContent(
      'HushVoting Direct protected custody path'
    );
    expect(screen.getByTestId('report-package-boundary-context')).toHaveTextContent(
      'non-dev circuits'
    );
    expect(screen.getByTestId('report-package-boundary-context')).toHaveTextContent('Non-dev circuit');
    expect(screen.getByTestId('report-package-boundary-context')).toHaveTextContent('dkg-prod-3of5');
  });

  it('includes sealed Protocol Omega package refs inside the visible report package evidence', () => {
    render(
      <ElectionResultArtifactsSection
        election={createElectionRecord()}
        resultView={createResultView({
          CeremonySnapshot: createCeremonySnapshot(),
          CanViewReportPackage: true,
          LatestReportPackage: createReportPackage(),
          ProtocolPackageBinding: createProtocolPackageBinding({
            Status: ProtocolPackageBindingStatusProto.Sealed,
            HasSealedAt: true,
            SealedAt: timestamp,
          }),
        })}
      />
    );

    expect(screen.getByTestId('report-package-protocol-package-refs')).toHaveTextContent(
      'Sealed at open'
    );
    expect(screen.getByTestId('report-package-protocol-package-refs')).toHaveTextContent(
      'aaaaaaaaaaaa...aaaaaaaa'
    );
    expect(screen.queryByTestId('protocol-package-refresh')).not.toBeInTheDocument();
  });

  it('falls back to the persisted election closed-progress status when result view is unavailable', () => {
    render(
      <ElectionResultArtifactsSection
        election={createElectionRecord({
          LifecycleState: ElectionLifecycleStateProto.Closed,
          ClosedProgressStatus:
            ElectionClosedProgressStatusProto.ClosedProgressTallyCalculationInProgress,
          TallyReadyAt: undefined,
          UnofficialResultArtifactId: '',
          OfficialResultArtifactId: '',
        })}
        resultView={null}
      />
    );

    expect(screen.getByTestId('election-results-progress')).toHaveTextContent(
      'Tally calculation in progress'
    );
    expect(screen.getByTestId('election-results-progress')).toHaveTextContent(
      'The election is closed and the result workflow is running.'
    );
  });

  it('marks superseded historical packages without exposing them as current results', () => {
    render(
      <ElectionResultArtifactsSection
        election={createElectionRecord({
          LifecycleState: ElectionLifecycleStateProto.Voided,
        })}
        resultView={createResultView({
          CanViewReportPackage: true,
          LatestReportPackage: createReportPackage({
            Status: ElectionReportPackageStatusProto.ReportPackageSupersededByVoid,
            PackageKind: ElectionReportPackageKindProto.ReportPackageResult,
            SupersededByVoidDecisionId: 'void-decision-1',
            HasSupersededAt: true,
            SupersededAt: timestamp,
          }),
          OfficialResult: createResultArtifact({
            ArtifactKind: ElectionResultArtifactKindProto.ElectionResultArtifactOfficial,
          }),
        })}
      />
    );

    expect(screen.getByTestId('report-package-summary')).toHaveTextContent(
      'Historical package superseded by VOID'
    );
    expect(screen.getByTestId('superseded-artifact-notice')).toHaveTextContent(
      'not a current final-result claim'
    );
    expect(screen.queryByTestId('election-official-result')).not.toBeInTheDocument();
  });
});
