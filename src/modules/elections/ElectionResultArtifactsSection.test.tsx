import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ElectionRecordView,
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
  ElectionReportPackageStatusProto,
  ElectionResultArtifactKindProto,
  ElectionResultArtifactVisibilityProto,
  ElectionEligibilitySnapshotTypeProto,
  EligibilityMutationPolicyProto,
  EligibilitySourceTypeProto,
  OfficialResultVisibilityPolicyProto,
  OutcomeRuleKindProto,
  ParticipationPrivacyModeProto,
  ReportingPolicyProto,
  ReviewWindowPolicyProto,
  VoteUpdatePolicyProto,
} from '@/lib/grpc';
import { ElectionResultArtifactsSection } from './ElectionResultArtifactsSection';

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
          ],
        })}
      />
    );

    expect(screen.getByTestId('report-package-summary')).toHaveTextContent(
      'Sealed package available'
    );
    expect(screen.getByTestId('report-package-catalog')).toHaveTextContent('Final manifest');
    expect(screen.getByTestId('report-package-catalog')).toHaveTextContent('Outcome projection');
    expect(screen.queryByText('Named roster')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('report-artifact-download-report-artifact-1'));

    expect(window.URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    expect(window.URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('keeps ordinary participants on the official-result-only path', () => {
    render(
      <ElectionResultArtifactsSection
        election={createElectionRecord()}
        resultView={createResultView({
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
    expect(screen.queryByText('Official result visibility')).not.toBeInTheDocument();
    expect(screen.queryByTestId('election-unofficial-result')).not.toBeInTheDocument();
    expect(screen.queryByTestId('report-package-summary')).not.toBeInTheDocument();
    expect(screen.queryByText('Named roster')).not.toBeInTheDocument();
  });

  it('shows inherited tally-ready lineage wording for official results', () => {
    render(
      <ElectionResultArtifactsSection
        election={createElectionRecord()}
        resultView={createResultView({
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
});
