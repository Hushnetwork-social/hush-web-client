import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  ElectionCeremonyVersionStatusProto,
  ElectionBindingStatusProto,
  ElectionClosedProgressStatusProto,
  ElectionGovernanceModeProto,
  ElectionHubNextActionHintProto,
  ElectionLifecycleStateProto,
  ElectionParticipationStatusProto,
  ElectionReportArtifactAccessScopeProto,
  ElectionReportArtifactFormatProto,
  ElectionReportArtifactKindProto,
  ElectionReportPackageStatusProto,
  ElectionResultArtifactKindProto,
  ElectionResultArtifactVisibilityProto,
  OfficialResultVisibilityPolicyProto,
  ElectionTrusteeInvitationStatusProto,
  ReviewWindowPolicyProto,
} from '@/lib/grpc';
import { HushVotingWorkspace } from './HushVotingWorkspace';
import { useElectionsStore } from './useElectionsStore';

const { electionsServiceMock } = vi.hoisted(() => ({
  electionsServiceMock: {
    getElectionResultView: vi.fn(),
    getElectionVotingView: vi.fn(),
    verifyElectionReceipt: vi.fn(),
  },
}));

const mockPush = vi.fn();
const storeReset = useElectionsStore.getState().reset;

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock('@/lib/grpc/services/elections', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/grpc/services/elections')>();
  return {
    ...actual,
    electionsService: {
      ...actual.electionsService,
      getElectionResultView: (...args: unknown[]) =>
        electionsServiceMock.getElectionResultView(...args),
      getElectionVotingView: (...args: unknown[]) =>
        electionsServiceMock.getElectionVotingView(...args),
      verifyElectionReceipt: (...args: unknown[]) =>
        electionsServiceMock.verifyElectionReceipt(...args),
    },
  };
});

const timestamp = { seconds: 1_711_410_000, nanos: 0 };

function createSummary(
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

function createHubEntry(
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
    SuggestedAction: ElectionHubNextActionHintProto.ElectionHubActionOwnerManageDraft,
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

function createElectionRecord(
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

function createDetail(
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

function createHubView(entries: ElectionHubEntryView[]): GetElectionHubViewResponse {
  return {
    Success: true,
    ErrorMessage: '',
    ActorPublicAddress: 'actor-address',
    Elections: entries,
    HasAnyElectionRoles: entries.length > 0,
    EmptyStateReason: entries.length > 0 ? '' : 'No election roles are assigned to this actor.',
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

function createReportPackage(
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

function createReportArtifact(
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

function createResultView(
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

describe('HushVotingWorkspace', () => {
  beforeEach(() => {
    cleanup();
    storeReset();
    mockPush.mockReset();
    electionsServiceMock.getElectionResultView.mockReset();
    electionsServiceMock.getElectionVotingView.mockReset();
    electionsServiceMock.verifyElectionReceipt.mockReset();
    electionsServiceMock.getElectionResultView.mockResolvedValue(createResultView());
    electionsServiceMock.getElectionVotingView.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      HasAcceptedAt: false,
      ReceiptId: '',
      AcceptanceId: '',
      ServerProof: '',
      PersonalParticipationStatus: ElectionParticipationStatusProto.ParticipationDidNotVote,
    });
    electionsServiceMock.verifyElectionReceipt.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      ActorPublicAddress: 'actor-address',
      ElectionId: 'election-open',
      LifecycleState: ElectionLifecycleStateProto.Open,
      HasAcceptedCheckoff: true,
      ReceiptMatchesAcceptedCheckoff: true,
      ParticipationCountedAsVoted: true,
      TallyVerificationAvailable: false,
      VerifiedReceiptId: 'rcpt-open-1',
      VerifiedAcceptanceId: 'acceptance-open-1',
      VerifiedServerProof: 'server-proof-open-1',
    });
  });

  afterEach(() => {
    cleanup();
    storeReset();
  });

  it('loads the hub shell as linked-election cards only and routes clicks into election detail', async () => {
    const loadElectionHub = vi.fn().mockResolvedValue(undefined);
    const clearGrantCandidateSearch = vi.fn();

    const openEntry = createHubEntry(
      'election-open',
      ElectionLifecycleStateProto.Open,
      'Open Board Election'
    );
    const draftEntry = createHubEntry(
      'election-draft',
      ElectionLifecycleStateProto.Draft,
      'Draft Policy Election',
      {
        ActorRoles: {
          IsOwnerAdmin: true,
          IsTrustee: false,
          IsVoter: false,
          IsDesignatedAuditor: false,
        },
        CanViewParticipantResults: false,
        CanViewReportPackage: false,
        CanViewNamedParticipationRoster: false,
      }
    );

    useElectionsStore.setState({
      loadElectionHub,
      selectHubElection: vi.fn().mockResolvedValue(undefined),
      clearGrantCandidateSearch,
      reset: vi.fn(),
      hubView: createHubView([openEntry, draftEntry]),
      hubEntries: [openEntry, draftEntry],
      selectedElectionId: 'election-open',
      selectedHubEntry: openEntry,
      selectedElection: createDetail(
        'election-open',
        ElectionLifecycleStateProto.Open,
        'Open Board Election'
      ),
      canManageReportAccessGrants: false,
      reportAccessGrantDeniedReason: '',
      reportAccessGrants: [],
      feedback: null,
      error: null,
      isLoadingHub: false,
      isLoadingDetail: false,
      actorPublicAddress: 'actor-address',
    });

    render(
      <HushVotingWorkspace
        actorPublicAddress="actor-address"
        actorEncryptionPublicKey="actor-encrypt-address"
        actorEncryptionPrivateKey="actor-private-encrypt-key"
        actorSigningPrivateKey="actor-signing-private-key"
      />
    );

    expect(await screen.findByText('HushVoting! Hub')).toBeInTheDocument();
    expect(loadElectionHub).toHaveBeenCalledWith('actor-address');
    expect(screen.getByTestId('election-hub-list')).toBeInTheDocument();
    expect(screen.getByTestId('election-hub-card-election-open')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('election-hub-card-election-draft')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('hush-voting-section-voter')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hush-voting-section-owner-admin')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('election-hub-card-election-draft'));

    expect(mockPush).toHaveBeenCalledWith('/elections/election-draft');
  });

  it('shows the shared no-role boundary when the actor has no election surfaces', async () => {
    const loadElectionHub = vi.fn().mockResolvedValue(undefined);

    useElectionsStore.setState({
      loadElectionHub,
      clearGrantCandidateSearch: vi.fn(),
      selectHubElection: vi.fn().mockResolvedValue(undefined),
      reset: vi.fn(),
      hubView: createHubView([]),
      hubEntries: [],
      selectedElectionId: null,
      selectedHubEntry: null,
      selectedElection: null,
      canManageReportAccessGrants: false,
      reportAccessGrantDeniedReason: '',
      reportAccessGrants: [],
      feedback: null,
      error: null,
      isLoadingHub: false,
      isLoadingDetail: false,
      actorPublicAddress: 'actor-address',
    });

    render(
      <HushVotingWorkspace
        actorPublicAddress="actor-address"
        actorEncryptionPublicKey="actor-encrypt-address"
        actorEncryptionPrivateKey="actor-private-encrypt-key"
        actorSigningPrivateKey="actor-signing-private-key"
      />
    );

    expect(await screen.findByText('HushVoting! Hub')).toBeInTheDocument();
    expect(screen.getByText('No linked election surfaces available')).toBeInTheDocument();
    expect(screen.getByText('No election roles are assigned to this actor.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Back to HushVoting! Hub' })).not.toBeInTheDocument();
  });

  it('shows a pending trustee invitation surface and lets the invited trustee accept it', async () => {
    const loadElectionHub = vi.fn().mockResolvedValue(undefined);
    const selectHubElection = vi.fn().mockResolvedValue(undefined);
    const acceptTrusteeInvitation = vi.fn().mockResolvedValue(true);
    const rejectTrusteeInvitation = vi.fn().mockResolvedValue(true);
    const pendingTrusteeEntry = createHubEntry(
      'election-pending-trustee',
      ElectionLifecycleStateProto.Draft,
      'Pending Trustee Election',
      {
        ActorRoles: {
          IsOwnerAdmin: false,
          IsTrustee: false,
          IsVoter: false,
          IsDesignatedAuditor: false,
        },
        SuggestedAction: ElectionHubNextActionHintProto.ElectionHubActionNone,
        SuggestedActionReason: 'A trustee invitation is waiting for your response.',
        CanViewNamedParticipationRoster: false,
        CanViewReportPackage: false,
        CanViewParticipantResults: false,
        HasUnofficialResult: false,
        HasOfficialResult: false,
      }
    );

    useElectionsStore.setState({
      acceptTrusteeInvitation,
      rejectTrusteeInvitation,
      loadElectionHub,
      clearGrantCandidateSearch: vi.fn(),
      selectHubElection,
      reset: vi.fn(),
      hubView: createHubView([pendingTrusteeEntry]),
      hubEntries: [pendingTrusteeEntry],
      selectedElectionId: null,
      selectedHubEntry: null,
      selectedElection: createDetail(
        'election-pending-trustee',
        ElectionLifecycleStateProto.Draft,
        'Pending Trustee Election',
        {
          TrusteeInvitations: [
            {
              Id: 'invite-pending-1',
              ElectionId: 'election-pending-trustee',
              TrusteeUserAddress: 'actor-address',
              TrusteeDisplayName: 'Trustee Three',
              InvitedByPublicAddress: 'owner-address',
              LinkedMessageId: 'message-1',
              Status: ElectionTrusteeInvitationStatusProto.Pending,
              SentAtDraftRevision: 2,
              SentAt: timestamp,
            },
          ],
        }
      ),
      canManageReportAccessGrants: false,
      reportAccessGrantDeniedReason: '',
      reportAccessGrants: [],
      feedback: null,
      error: null,
      isLoadingHub: false,
      isLoadingDetail: false,
      isSubmitting: false,
      actorPublicAddress: 'actor-address',
    });

    render(
      <HushVotingWorkspace
        actorPublicAddress="actor-address"
        actorEncryptionPublicKey="actor-encrypt-address"
        actorEncryptionPrivateKey="actor-private-encrypt-key"
        actorSigningPrivateKey="actor-signing-private-key"
        initialElectionId="election-pending-trustee"
      />
    );

    await waitFor(() => {
      expect(selectHubElection).toHaveBeenCalledWith('actor-address', 'election-pending-trustee');
    });

    expect(await screen.findByTestId('hush-voting-pending-trustee-invitation')).toBeInTheDocument();
    expect(screen.getByText('Respond before trustee work unlocks')).toBeInTheDocument();
    expect(screen.queryByText('No workspace surface is available')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Accept invitation' }));

    await waitFor(() => {
      expect(acceptTrusteeInvitation).toHaveBeenCalledWith(
        {
          ElectionId: 'election-pending-trustee',
          InvitationId: 'invite-pending-1',
          ActorPublicAddress: 'actor-address',
        },
        'actor-encrypt-address',
        'actor-private-encrypt-key',
        'actor-signing-private-key'
      );
    });
    expect(loadElectionHub).toHaveBeenCalledTimes(2);
  });

  it('renders the pre-link voter section only on the dedicated election detail route', async () => {
    const loadElectionHub = vi.fn().mockResolvedValue(undefined);
    const selectHubElection = vi.fn().mockResolvedValue(undefined);
    const claimEntry = createHubEntry(
      'election-claim',
      ElectionLifecycleStateProto.Finalized,
      'Claim-Link Election',
      {
        ActorRoles: {
          IsOwnerAdmin: false,
          IsTrustee: false,
          IsVoter: false,
          IsDesignatedAuditor: false,
        },
        CanClaimIdentity: true,
        CanViewParticipantResults: false,
        CanViewReportPackage: false,
        CanViewNamedParticipationRoster: false,
        HasUnofficialResult: false,
        HasOfficialResult: false,
        SuggestedAction: ElectionHubNextActionHintProto.ElectionHubActionNone,
      }
    );

    useElectionsStore.setState({
      loadElectionHub,
      clearGrantCandidateSearch: vi.fn(),
      selectHubElection,
      reset: vi.fn(),
      hubView: createHubView([claimEntry]),
      hubEntries: [claimEntry],
      selectedElectionId: null,
      selectedHubEntry: null,
      selectedElection: createDetail(
        'election-claim',
        ElectionLifecycleStateProto.Finalized,
        'Claim-Link Election'
      ),
      canManageReportAccessGrants: false,
      reportAccessGrantDeniedReason: '',
      reportAccessGrants: [],
      feedback: null,
      error: null,
      isLoadingHub: false,
      isLoadingDetail: false,
      actorPublicAddress: 'actor-address',
    });

    render(
      <HushVotingWorkspace
        actorPublicAddress="actor-address"
        actorEncryptionPublicKey="actor-encrypt-address"
        actorEncryptionPrivateKey="actor-private-encrypt-key"
        actorSigningPrivateKey="actor-signing-private-key"
        initialElectionId="election-claim"
      />
    );

    await waitFor(() => {
      expect(selectHubElection).toHaveBeenCalledWith('actor-address', 'election-claim');
    });
    expect(await screen.findByTestId('hush-voting-section-voter')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open identity and eligibility' })).toHaveAttribute(
      'href',
      '/elections/election-claim/eligibility'
    );
  });

  it('shows the detailed mixed-role surfaces only on the election detail route', async () => {
    const loadElectionHub = vi.fn().mockResolvedValue(undefined);
    const selectHubElection = vi.fn().mockResolvedValue(undefined);
    const mixedRoleEntry = createHubEntry(
      'election-mixed',
      ElectionLifecycleStateProto.Finalized,
      'Mixed Role Election',
      {
        ActorRoles: {
          IsOwnerAdmin: true,
          IsTrustee: true,
          IsVoter: true,
          IsDesignatedAuditor: true,
        },
        CanViewNamedParticipationRoster: true,
        CanViewReportPackage: true,
        CanViewParticipantResults: true,
        HasUnofficialResult: true,
        HasOfficialResult: true,
      }
    );

    electionsServiceMock.getElectionResultView.mockResolvedValue(
      createResultView({
        CanViewReportPackage: true,
        LatestReportPackage: createReportPackage(),
        OfficialResult: createResultArtifact(),
        VisibleReportArtifacts: [createReportArtifact()],
      })
    );

    useElectionsStore.setState({
      loadElectionHub,
      clearGrantCandidateSearch: vi.fn(),
      selectHubElection,
      reset: vi.fn(),
      hubView: createHubView([mixedRoleEntry]),
      hubEntries: [mixedRoleEntry],
      selectedElectionId: null,
      selectedHubEntry: null,
      selectedElection: createDetail(
        'election-mixed',
        ElectionLifecycleStateProto.Finalized,
        'Mixed Role Election'
      ),
      canManageReportAccessGrants: false,
      reportAccessGrantDeniedReason: '',
      reportAccessGrants: [],
      feedback: null,
      error: null,
      isLoadingHub: false,
      isLoadingDetail: false,
      actorPublicAddress: 'actor-address',
    });

    render(
      <HushVotingWorkspace
        actorPublicAddress="actor-address"
        actorEncryptionPublicKey="actor-encrypt-address"
        actorEncryptionPrivateKey="actor-private-encrypt-key"
        actorSigningPrivateKey="actor-signing-private-key"
        initialElectionId="election-mixed"
      />
    );

    await waitFor(() => {
      expect(selectHubElection).toHaveBeenCalledWith('actor-address', 'election-mixed');
    });
    expect(await screen.findByTestId('hush-voting-section-owner-admin')).toBeInTheDocument();
    expect(screen.getByTestId('hush-voting-section-trustee')).toBeInTheDocument();
    expect(screen.getByTestId('hush-voting-section-auditor')).toBeInTheDocument();
    expect(screen.getByTestId('hush-voting-section-results')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ceremony workspace' })).toHaveAttribute(
      'href',
      '/elections/election-mixed/trustee/ceremony'
    );
    expect(screen.getByRole('link', { name: 'Ceremony workspace' }).className).toContain(
      'bg-hush-purple'
    );
    expect(screen.getByRole('link', { name: 'Share workspace' })).toHaveAttribute(
      'href',
      '/elections/election-mixed/trustee/finalization'
    );
    expect(screen.getByRole('link', { name: 'Share workspace' }).className).toContain(
      'bg-hush-purple'
    );
    expect(await screen.findByTestId('report-package-summary')).toBeInTheDocument();
    expect(screen.getByTestId('hush-voting-open-report-package')).toHaveAttribute(
      'href',
      '#hush-voting-report-package'
    );
    expect(screen.getByTestId('hush-voting-open-auditor-result')).toHaveAttribute(
      'href',
      '#hush-voting-official-result'
    );
    expect(screen.getByTestId('hush-voting-section-results')).toHaveTextContent(
      'Boundary Artifacts'
    );
    expect(screen.queryByRole('link', { name: 'Result details' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('hush-voting-results-open-result')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hush-voting-results-open-report-package')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Owner Workspace' })).toHaveAttribute(
      'href',
      '/elections/owner?electionId=election-mixed'
    );
    expect(screen.getByRole('link', { name: 'Back to HushVoting! Hub' })).toHaveAttribute('href', '/elections');
  });

  it('lets an auditor-only actor open the report package and official result from the hub workspace', async () => {
    const loadElectionHub = vi.fn().mockResolvedValue(undefined);
    const selectHubElection = vi.fn().mockResolvedValue(undefined);
    const auditorEntry = createHubEntry(
      'election-auditor',
      ElectionLifecycleStateProto.Finalized,
      'Auditor Review Election',
      {
        ActorRoles: {
          IsOwnerAdmin: false,
          IsTrustee: false,
          IsVoter: false,
          IsDesignatedAuditor: true,
        },
        SuggestedAction: ElectionHubNextActionHintProto.ElectionHubActionAuditorReviewPackage,
        CanViewNamedParticipationRoster: true,
        CanViewReportPackage: true,
        CanViewParticipantResults: true,
        HasUnofficialResult: true,
        HasOfficialResult: true,
      }
    );

    electionsServiceMock.getElectionResultView.mockResolvedValue(
      createResultView({
        CanViewReportPackage: true,
        LatestReportPackage: createReportPackage(),
        OfficialResult: createResultArtifact(),
        VisibleReportArtifacts: [createReportArtifact()],
      })
    );

    useElectionsStore.setState({
      loadElectionHub,
      clearGrantCandidateSearch: vi.fn(),
      selectHubElection,
      reset: vi.fn(),
      hubView: createHubView([auditorEntry]),
      hubEntries: [auditorEntry],
      selectedElectionId: null,
      selectedHubEntry: null,
      selectedElection: createDetail(
        'election-auditor',
        ElectionLifecycleStateProto.Finalized,
        'Auditor Review Election'
      ),
      canManageReportAccessGrants: false,
      reportAccessGrantDeniedReason: '',
      reportAccessGrants: [],
      feedback: null,
      error: null,
      isLoadingHub: false,
      isLoadingDetail: false,
      actorPublicAddress: 'actor-address',
    });

    render(
      <HushVotingWorkspace
        actorPublicAddress="actor-address"
        actorEncryptionPublicKey="actor-encrypt-address"
        actorEncryptionPrivateKey="actor-private-encrypt-key"
        actorSigningPrivateKey="actor-signing-private-key"
        initialElectionId="election-auditor"
      />
    );

    await waitFor(() => {
      expect(selectHubElection).toHaveBeenCalledWith('actor-address', 'election-auditor');
    });

    expect(await screen.findByTestId('hush-voting-section-auditor')).toBeInTheDocument();
    expect(await screen.findByTestId('report-package-summary')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Result details' })).not.toBeInTheDocument();
    expect(screen.getByTestId('hush-voting-open-report-package')).toHaveAttribute(
      'href',
      '#hush-voting-report-package'
    );
    expect(screen.getByTestId('hush-voting-open-auditor-result')).toHaveAttribute(
      'href',
      '#hush-voting-official-result'
    );
    expect(screen.queryByTestId('hush-voting-results-open-report-package')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hush-voting-results-open-result')).not.toBeInTheDocument();
  });

  it('shows the hub receipt verifier only after the voter already has an accepted checkoff record', async () => {
    const loadElectionHub = vi.fn().mockResolvedValue(undefined);
    const selectHubElection = vi.fn().mockResolvedValue(undefined);
    const voterEntry = createHubEntry(
      'election-open',
      ElectionLifecycleStateProto.Open,
      'Annual Elections 2026',
      {
        ActorRoles: {
          IsOwnerAdmin: false,
          IsTrustee: false,
          IsVoter: true,
          IsDesignatedAuditor: false,
        },
        SuggestedAction: ElectionHubNextActionHintProto.ElectionHubActionNone,
        SuggestedActionReason: 'No immediate action is required for this election.',
        CanViewNamedParticipationRoster: false,
        CanViewReportPackage: false,
        CanViewParticipantResults: true,
        HasUnofficialResult: false,
        HasOfficialResult: false,
      }
    );

    electionsServiceMock.getElectionVotingView.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      HasAcceptedAt: true,
      ReceiptId: 'rcpt-open-1',
      AcceptanceId: 'acceptance-open-1',
      ServerProof: 'server-proof-open-1',
      PersonalParticipationStatus: ElectionParticipationStatusProto.ParticipationCountedAsVoted,
    });

    useElectionsStore.setState({
      loadElectionHub,
      clearGrantCandidateSearch: vi.fn(),
      selectHubElection,
      reset: vi.fn(),
      hubView: createHubView([voterEntry]),
      hubEntries: [voterEntry],
      selectedElectionId: null,
      selectedHubEntry: null,
      selectedElection: createDetail(
        'election-open',
        ElectionLifecycleStateProto.Open,
        'Annual Elections 2026'
      ),
      canManageReportAccessGrants: false,
      reportAccessGrantDeniedReason: '',
      reportAccessGrants: [],
      feedback: null,
      error: null,
      isLoadingHub: false,
      isLoadingDetail: false,
      actorPublicAddress: 'actor-address',
    });

    render(
      <HushVotingWorkspace
        actorPublicAddress="actor-address"
        actorEncryptionPublicKey="actor-encrypt-address"
        actorEncryptionPrivateKey="actor-private-encrypt-key"
        actorSigningPrivateKey="actor-signing-private-key"
        initialElectionId="election-open"
      />
    );

    await waitFor(() => {
      expect(selectHubElection).toHaveBeenCalledWith('actor-address', 'election-open');
    });
    expect(await screen.findByTestId('hush-voting-verify-receipt-trigger')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('hush-voting-verify-receipt-trigger'));
    expect(screen.getByTestId('hush-voting-receipt-input')).not.toHaveAttribute(
      'placeholder',
      expect.stringContaining('Ballot Package Commitment'),
    );
    fireEvent.change(screen.getByTestId('hush-voting-receipt-input'), {
      target: {
        value: [
          'Accepted Ballot Receipt',
          'Election ID: election-open',
          'Receipt ID: rcpt-open-1',
          'Acceptance ID: acceptance-open-1',
          'Accepted At: 03/04/2026, 14:25:12',
          'Server Proof: server-proof-open-1',
        ].join('\n'),
      },
    });
    fireEvent.click(screen.getByTestId('hush-voting-verify-receipt-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('hush-voting-receipt-result')).toHaveTextContent(
        'This voter is marked as voted'
      );
    });
    expect(electionsServiceMock.verifyElectionReceipt).toHaveBeenCalledWith({
      ElectionId: 'election-open',
      ActorPublicAddress: 'actor-address',
      ReceiptId: 'rcpt-open-1',
      AcceptanceId: 'acceptance-open-1',
      ServerProof: 'server-proof-open-1',
    });
  });

  it('confirms the finalized counted set for a verified voter receipt once the official result is sealed', async () => {
    const loadElectionHub = vi.fn().mockResolvedValue(undefined);
    const selectHubElection = vi.fn().mockResolvedValue(undefined);
    const voterEntry = createHubEntry(
      'election-final',
      ElectionLifecycleStateProto.Finalized,
      'Annual Elections 2026',
      {
        ActorRoles: {
          IsOwnerAdmin: false,
          IsTrustee: false,
          IsVoter: true,
          IsDesignatedAuditor: false,
        },
        SuggestedAction: ElectionHubNextActionHintProto.ElectionHubActionVoterReviewResult,
        SuggestedActionReason: 'The official result is ready for review.',
        CanViewNamedParticipationRoster: false,
        CanViewReportPackage: false,
        CanViewParticipantResults: true,
        HasUnofficialResult: true,
        HasOfficialResult: true,
      }
    );

    electionsServiceMock.getElectionResultView.mockResolvedValue(
      createResultView({
        CanViewParticipantEncryptedResults: true,
        OfficialResult: createResultArtifact(),
      }),
    );
    electionsServiceMock.getElectionVotingView.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      HasAcceptedAt: true,
      ReceiptId: 'rcpt-final-1',
      AcceptanceId: 'acceptance-final-1',
      ServerProof: 'server-proof-final-1',
      PersonalParticipationStatus: ElectionParticipationStatusProto.ParticipationCountedAsVoted,
    });
    electionsServiceMock.verifyElectionReceipt.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      ActorPublicAddress: 'actor-address',
      ElectionId: 'election-final',
      LifecycleState: ElectionLifecycleStateProto.Finalized,
      HasAcceptedCheckoff: true,
      ReceiptMatchesAcceptedCheckoff: true,
      ParticipationCountedAsVoted: true,
      TallyVerificationAvailable: true,
      VerifiedReceiptId: 'rcpt-final-1',
      VerifiedAcceptanceId: 'acceptance-final-1',
      VerifiedServerProof: 'server-proof-final-1',
    });
    window.localStorage.setItem(
      'feat099:receipt:election-final',
      JSON.stringify({
        electionId: 'election-final',
        receiptId: 'rcpt-final-1',
        acceptanceId: 'acceptance-final-1',
        acceptedAt: '2026-04-04 14:25:12',
        ballotPackageCommitment: '85b033d06e016b1d9d392e47ff983ea3d9297da04fad13c5d32f11e7ce474e94',
        serverProof: 'server-proof-final-1',
      }),
    );

    useElectionsStore.setState({
      loadElectionHub,
      clearGrantCandidateSearch: vi.fn(),
      selectHubElection,
      reset: vi.fn(),
      hubView: createHubView([voterEntry]),
      hubEntries: [voterEntry],
      selectedElectionId: null,
      selectedHubEntry: null,
      selectedElection: createDetail(
        'election-final',
        ElectionLifecycleStateProto.Finalized,
        'Annual Elections 2026'
      ),
      canManageReportAccessGrants: false,
      reportAccessGrantDeniedReason: '',
      reportAccessGrants: [],
      feedback: null,
      error: null,
      isLoadingHub: false,
      isLoadingDetail: false,
      actorPublicAddress: 'actor-address',
    });

    render(
      <HushVotingWorkspace
        actorPublicAddress="actor-address"
        actorEncryptionPublicKey="actor-encrypt-address"
        actorEncryptionPrivateKey="actor-private-encrypt-key"
        actorSigningPrivateKey="actor-signing-private-key"
        initialElectionId="election-final"
      />
    );

    await waitFor(() => {
      expect(selectHubElection).toHaveBeenCalledWith('actor-address', 'election-final');
    });
    fireEvent.click(await screen.findByTestId('hush-voting-verify-receipt-trigger'));
    fireEvent.change(screen.getByTestId('hush-voting-receipt-input'), {
      target: {
        value: [
          'Accepted Ballot Receipt',
          'Election ID: election-final',
          'Receipt ID: rcpt-final-1',
          'Acceptance ID: acceptance-final-1',
          'Accepted At: 04/04/2026, 14:25:12',
          'Ballot Package Commitment: 85b033d06e016b1d9d392e47ff983ea3d9297da04fad13c5d32f11e7ce474e94',
          'Server Proof: server-proof-final-1',
        ].join('\n'),
      },
    });
    fireEvent.click(screen.getByTestId('hush-voting-verify-receipt-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('hush-voting-receipt-result')).toHaveTextContent(
        'included in the finalized counted set'
      );
    });
    expect(screen.getByTestId('hush-voting-receipt-result')).toHaveTextContent(
      'This accepted vote is included in the finalized counted set used for the official result.'
    );
    expect(screen.getByTestId('hush-voting-receipt-result')).toHaveTextContent(
      'The ballot commitment line is independently confirmed on this device.'
    );
  });

  it('shows a warning instead of full success when a finalized receipt cannot confirm the commitment line', async () => {
    const loadElectionHub = vi.fn().mockResolvedValue(undefined);
    const selectHubElection = vi.fn().mockResolvedValue(undefined);
    const voterEntry = createHubEntry(
      'election-final',
      ElectionLifecycleStateProto.Finalized,
      'Annual Elections 2026',
      {
        ActorRoles: {
          IsOwnerAdmin: false,
          IsTrustee: false,
          IsVoter: true,
          IsDesignatedAuditor: false,
        },
        SuggestedAction: ElectionHubNextActionHintProto.ElectionHubActionVoterReviewResult,
        SuggestedActionReason: 'The official result is ready for review.',
        CanViewNamedParticipationRoster: false,
        CanViewReportPackage: false,
        CanViewParticipantResults: true,
        HasUnofficialResult: true,
        HasOfficialResult: true,
      }
    );

    electionsServiceMock.getElectionResultView.mockResolvedValue(
      createResultView({
        CanViewParticipantEncryptedResults: true,
        OfficialResult: createResultArtifact(),
      }),
    );
    electionsServiceMock.getElectionVotingView.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      HasAcceptedAt: true,
      ReceiptId: 'rcpt-final-1',
      AcceptanceId: 'acceptance-final-1',
      ServerProof: 'server-proof-final-1',
      PersonalParticipationStatus: ElectionParticipationStatusProto.ParticipationCountedAsVoted,
    });
    electionsServiceMock.verifyElectionReceipt.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      ActorPublicAddress: 'actor-address',
      ElectionId: 'election-final',
      LifecycleState: ElectionLifecycleStateProto.Finalized,
      HasAcceptedCheckoff: true,
      ReceiptMatchesAcceptedCheckoff: true,
      ParticipationCountedAsVoted: true,
      TallyVerificationAvailable: true,
      VerifiedReceiptId: 'rcpt-final-1',
      VerifiedAcceptanceId: 'acceptance-final-1',
      VerifiedServerProof: 'server-proof-final-1',
    });

    useElectionsStore.setState({
      loadElectionHub,
      clearGrantCandidateSearch: vi.fn(),
      selectHubElection,
      reset: vi.fn(),
      hubView: createHubView([voterEntry]),
      hubEntries: [voterEntry],
      selectedElectionId: null,
      selectedHubEntry: null,
      selectedElection: createDetail(
        'election-final',
        ElectionLifecycleStateProto.Finalized,
        'Annual Elections 2026'
      ),
      canManageReportAccessGrants: false,
      reportAccessGrantDeniedReason: '',
      reportAccessGrants: [],
      feedback: null,
      error: null,
      isLoadingHub: false,
      isLoadingDetail: false,
      actorPublicAddress: 'actor-address',
    });

    render(
      <HushVotingWorkspace
        actorPublicAddress="actor-address"
        actorEncryptionPublicKey="actor-encrypt-address"
        actorEncryptionPrivateKey="actor-private-encrypt-key"
        actorSigningPrivateKey="actor-signing-private-key"
        initialElectionId="election-final"
      />
    );

    await waitFor(() => {
      expect(selectHubElection).toHaveBeenCalledWith('actor-address', 'election-final');
    });
    fireEvent.click(await screen.findByTestId('hush-voting-verify-receipt-trigger'));
    fireEvent.change(screen.getByTestId('hush-voting-receipt-input'), {
      target: {
        value: [
          'Accepted Ballot Receipt',
          'Election ID: election-final',
          'Receipt ID: rcpt-final-1',
          'Acceptance ID: acceptance-final-1',
          'Accepted At: 04/04/2026, 14:25:12',
          'Server Proof: server-proof-final-1',
        ].join('\n'),
      },
    });
    fireEvent.click(screen.getByTestId('hush-voting-verify-receipt-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('hush-voting-receipt-result')).toHaveTextContent(
        'Receipt verified with incomplete commitment confirmation'
      );
    });
    expect(screen.getByTestId('hush-voting-receipt-result')).toHaveTextContent(
      'The pasted receipt text does not include a confirmable Ballot Package Commitment line.'
    );
    expect(screen.getByTestId('hush-voting-receipt-result')).toHaveTextContent(
      'The ballot commitment line is independently confirmed on this device.'
    );
  });

  it('rejects a pasted finalized receipt when the ballot commitment does not match the retained device receipt', async () => {
    const loadElectionHub = vi.fn().mockResolvedValue(undefined);
    const selectHubElection = vi.fn().mockResolvedValue(undefined);
    const voterEntry = createHubEntry(
      'election-final',
      ElectionLifecycleStateProto.Finalized,
      'Annual Elections 2026',
      {
        ActorRoles: {
          IsOwnerAdmin: false,
          IsTrustee: false,
          IsVoter: true,
          IsDesignatedAuditor: false,
        },
        SuggestedAction: ElectionHubNextActionHintProto.ElectionHubActionVoterReviewResult,
        SuggestedActionReason: 'The official result is ready for review.',
        CanViewNamedParticipationRoster: false,
        CanViewReportPackage: false,
        CanViewParticipantResults: true,
        HasUnofficialResult: true,
        HasOfficialResult: true,
      }
    );

    electionsServiceMock.getElectionResultView.mockResolvedValue(
      createResultView({
        CanViewParticipantEncryptedResults: true,
        OfficialResult: createResultArtifact(),
      }),
    );
    electionsServiceMock.getElectionVotingView.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      HasAcceptedAt: true,
      ReceiptId: 'rcpt-final-1',
      AcceptanceId: 'acceptance-final-1',
      ServerProof: 'server-proof-final-1',
      PersonalParticipationStatus: ElectionParticipationStatusProto.ParticipationCountedAsVoted,
    });
    electionsServiceMock.verifyElectionReceipt.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      ActorPublicAddress: 'actor-address',
      ElectionId: 'election-final',
      LifecycleState: ElectionLifecycleStateProto.Finalized,
      HasAcceptedCheckoff: true,
      ReceiptMatchesAcceptedCheckoff: true,
      ParticipationCountedAsVoted: true,
      TallyVerificationAvailable: true,
      VerifiedReceiptId: 'rcpt-final-1',
      VerifiedAcceptanceId: 'acceptance-final-1',
      VerifiedServerProof: 'server-proof-final-1',
    });
    window.localStorage.setItem(
      'feat099:receipt:election-final',
      JSON.stringify({
        electionId: 'election-final',
        receiptId: 'rcpt-final-1',
        acceptanceId: 'acceptance-final-1',
        acceptedAt: '2026-04-04 14:25:12',
        ballotPackageCommitment: 'expected-commitment',
        serverProof: 'server-proof-final-1',
      }),
    );

    useElectionsStore.setState({
      loadElectionHub,
      clearGrantCandidateSearch: vi.fn(),
      selectHubElection,
      reset: vi.fn(),
      hubView: createHubView([voterEntry]),
      hubEntries: [voterEntry],
      selectedElectionId: null,
      selectedHubEntry: null,
      selectedElection: createDetail(
        'election-final',
        ElectionLifecycleStateProto.Finalized,
        'Annual Elections 2026'
      ),
      canManageReportAccessGrants: false,
      reportAccessGrantDeniedReason: '',
      reportAccessGrants: [],
      feedback: null,
      error: null,
      isLoadingHub: false,
      isLoadingDetail: false,
      actorPublicAddress: 'actor-address',
    });

    render(
      <HushVotingWorkspace
        actorPublicAddress="actor-address"
        actorEncryptionPublicKey="actor-encrypt-address"
        actorEncryptionPrivateKey="actor-private-encrypt-key"
        actorSigningPrivateKey="actor-signing-private-key"
        initialElectionId="election-final"
      />
    );

    await waitFor(() => {
      expect(selectHubElection).toHaveBeenCalledWith('actor-address', 'election-final');
    });
    fireEvent.click(await screen.findByTestId('hush-voting-verify-receipt-trigger'));
    fireEvent.change(screen.getByTestId('hush-voting-receipt-input'), {
      target: {
        value: [
          'Accepted Ballot Receipt',
          'Election ID: election-final',
          'Receipt ID: rcpt-final-1',
          'Acceptance ID: acceptance-final-1',
          'Accepted At: 04/04/2026, 14:25:12',
          'Ballot Package Commitment: tampered-commitment',
          'Server Proof: server-proof-final-1',
        ].join('\n'),
      },
    });
    fireEvent.click(screen.getByTestId('hush-voting-verify-receipt-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('hush-voting-receipt-result')).toHaveTextContent(
        'Receipt commitment does not match this device record'
      );
    });
    expect(screen.getByTestId('hush-voting-receipt-result')).toHaveTextContent(
      'The pasted Ballot Package Commitment does not match the receipt retained on this device'
    );
    expect(screen.getByTestId('hush-voting-receipt-result')).toHaveTextContent(
      'The ballot commitment line is independently confirmed on this device.'
    );
  });

  it('keeps the hub receipt verifier hidden when no accepted checkoff record exists yet', async () => {
    const loadElectionHub = vi.fn().mockResolvedValue(undefined);
    const selectHubElection = vi.fn().mockResolvedValue(undefined);
    const voterEntry = createHubEntry(
      'election-open',
      ElectionLifecycleStateProto.Open,
      'Annual Elections 2026',
      {
        ActorRoles: {
          IsOwnerAdmin: false,
          IsTrustee: false,
          IsVoter: true,
          IsDesignatedAuditor: false,
        },
        SuggestedAction: ElectionHubNextActionHintProto.ElectionHubActionNone,
        SuggestedActionReason: 'No immediate action is required for this election.',
        CanViewNamedParticipationRoster: false,
        CanViewReportPackage: false,
        CanViewParticipantResults: true,
        HasUnofficialResult: false,
        HasOfficialResult: false,
      }
    );

    useElectionsStore.setState({
      loadElectionHub,
      clearGrantCandidateSearch: vi.fn(),
      selectHubElection,
      reset: vi.fn(),
      hubView: createHubView([voterEntry]),
      hubEntries: [voterEntry],
      selectedElectionId: null,
      selectedHubEntry: null,
      selectedElection: createDetail(
        'election-open',
        ElectionLifecycleStateProto.Open,
        'Annual Elections 2026'
      ),
      canManageReportAccessGrants: false,
      reportAccessGrantDeniedReason: '',
      reportAccessGrants: [],
      feedback: null,
      error: null,
      isLoadingHub: false,
      isLoadingDetail: false,
      actorPublicAddress: 'actor-address',
    });

    render(
      <HushVotingWorkspace
        actorPublicAddress="actor-address"
        actorEncryptionPublicKey="actor-encrypt-address"
        actorEncryptionPrivateKey="actor-private-encrypt-key"
        actorSigningPrivateKey="actor-signing-private-key"
        initialElectionId="election-open"
      />
    );

    await waitFor(() => {
      expect(selectHubElection).toHaveBeenCalledWith('actor-address', 'election-open');
    });

    await screen.findByText('Participation and result review');
    await waitFor(() => {
      expect(
        screen.queryByTestId('hush-voting-verify-receipt-trigger')
      ).not.toBeInTheDocument();
    });
  });

  it('shows trustee and open-readiness status in the owner/admin shell instead of auditor controls', async () => {
    const loadElectionHub = vi.fn().mockResolvedValue(undefined);
    const selectHubElection = vi.fn().mockResolvedValue(undefined);
    const ownerEntry = createHubEntry(
      'election-owner',
      ElectionLifecycleStateProto.Draft,
      'Trustee Threshold Election',
      {
        ActorRoles: {
          IsOwnerAdmin: true,
          IsTrustee: false,
          IsVoter: false,
          IsDesignatedAuditor: false,
        },
        Election: createSummary(
          'election-owner',
          ElectionLifecycleStateProto.Draft,
          'Trustee Threshold Election',
          'actor-address'
        ),
      }
    );
    ownerEntry.Election.GovernanceMode = ElectionGovernanceModeProto.TrusteeThreshold;

    useElectionsStore.setState({
      loadElectionHub,
      clearGrantCandidateSearch: vi.fn(),
      selectHubElection,
      reset: vi.fn(),
      hubView: createHubView([ownerEntry]),
      hubEntries: [ownerEntry],
      selectedElectionId: null,
      selectedHubEntry: null,
      selectedElection: createDetail(
        'election-owner',
        ElectionLifecycleStateProto.Draft,
        'Trustee Threshold Election',
        {
          Election: createElectionRecord(
            'election-owner',
            ElectionLifecycleStateProto.Draft,
            'Trustee Threshold Election',
            {
              GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
              ReviewWindowPolicy: ReviewWindowPolicyProto.GovernedReviewWindowReserved,
              RequiredApprovalCount: 1,
            }
          ),
          TrusteeInvitations: [
            {
              Id: 'invite-1',
              ElectionId: 'election-owner',
              TrusteeUserAddress: 'trustee-a',
              TrusteeDisplayName: 'Alice Trustee',
              InvitedByPublicAddress: 'actor-address',
              LinkedMessageId: 'msg-1',
              Status: ElectionTrusteeInvitationStatusProto.Accepted,
              SentAtDraftRevision: 2,
              SentAt: timestamp,
            },
            {
              Id: 'invite-2',
              ElectionId: 'election-owner',
              TrusteeUserAddress: 'trustee-b',
              TrusteeDisplayName: 'Bob Trustee',
              InvitedByPublicAddress: 'actor-address',
              LinkedMessageId: 'msg-2',
              Status: ElectionTrusteeInvitationStatusProto.Pending,
              SentAtDraftRevision: 2,
              SentAt: timestamp,
            },
          ],
          CeremonyVersions: [
            {
              Id: 'ceremony-1',
              ElectionId: 'election-owner',
              VersionNumber: 1,
              ProfileId: 'prod-2of3-v1',
              TrusteeCount: 2,
              RequiredApprovalCount: 2,
              Status: ElectionCeremonyVersionStatusProto.CeremonyVersionInProgress,
              StartedAt: timestamp,
              StartedByPublicAddress: 'actor-address',
              TallyPublicKeyFingerprint: 'fingerprint-1',
            },
          ],
        }
      ),
      canManageReportAccessGrants: false,
      reportAccessGrantDeniedReason: '',
      reportAccessGrants: [],
      feedback: null,
      error: null,
      isLoadingHub: false,
      isLoadingDetail: false,
      actorPublicAddress: 'actor-address',
    });

    render(
      <HushVotingWorkspace
        actorPublicAddress="actor-address"
        actorEncryptionPublicKey="actor-encrypt-address"
        actorEncryptionPrivateKey="actor-private-encrypt-key"
        actorSigningPrivateKey="actor-signing-private-key"
        initialElectionId="election-owner"
      />
    );

    await waitFor(() => {
      expect(selectHubElection).toHaveBeenCalledWith('actor-address', 'election-owner');
    });

    expect(await screen.findByTestId('hush-voting-section-owner-admin')).toBeInTheDocument();
    expect(screen.getByTestId('hush-voting-section-owner-admin')).toHaveTextContent(
      'Ready-to-open snapshot'
    );
    expect(screen.getByTestId('hush-voting-section-owner-admin')).toHaveTextContent(
      'Accepted trustees'
    );
    expect(screen.getByTestId('hush-voting-section-owner-admin')).toHaveTextContent('Key ceremony');
    expect(screen.getByTestId('hush-voting-section-owner-admin')).toHaveTextContent(
      '1 accepted | 1 pending'
    );
    expect(screen.queryByText('Manage auditor access')).not.toBeInTheDocument();
  });

  it('keeps voter-only workspaces focused on voter details when no artifact package is available', async () => {
    const loadElectionHub = vi.fn().mockResolvedValue(undefined);
    const selectHubElection = vi.fn().mockResolvedValue(undefined);
    const draftVoterEntry = createHubEntry(
      'election-no-results',
      ElectionLifecycleStateProto.Draft,
      'Annual Elections 2026',
      {
        ActorRoles: {
          IsOwnerAdmin: false,
          IsTrustee: false,
          IsVoter: true,
          IsDesignatedAuditor: false,
        },
        SuggestedAction: ElectionHubNextActionHintProto.ElectionHubActionNone,
        SuggestedActionReason: 'No immediate action is required for this election.',
        CanViewNamedParticipationRoster: false,
        CanViewReportPackage: false,
        CanViewParticipantResults: true,
        HasUnofficialResult: false,
        HasOfficialResult: false,
      }
    );

    useElectionsStore.setState({
      loadElectionHub,
      clearGrantCandidateSearch: vi.fn(),
      selectHubElection,
      reset: vi.fn(),
      hubView: createHubView([draftVoterEntry]),
      hubEntries: [draftVoterEntry],
      selectedElectionId: null,
      selectedHubEntry: null,
      selectedElection: createDetail(
        'election-no-results',
        ElectionLifecycleStateProto.Draft,
        'Annual Elections 2026'
      ),
      canManageReportAccessGrants: false,
      reportAccessGrantDeniedReason: '',
      reportAccessGrants: [],
      feedback: null,
      error: null,
      isLoadingHub: false,
      isLoadingDetail: false,
      actorPublicAddress: 'actor-address',
    });

    render(
      <HushVotingWorkspace
        actorPublicAddress="actor-address"
        actorEncryptionPublicKey="actor-encrypt-address"
        actorEncryptionPrivateKey="actor-private-encrypt-key"
        actorSigningPrivateKey="actor-signing-private-key"
        initialElectionId="election-no-results"
      />
    );

    await waitFor(() => {
      expect(selectHubElection).toHaveBeenCalledWith('actor-address', 'election-no-results');
    });

    expect(await screen.findByTestId('hush-voting-section-voter')).toBeInTheDocument();
    expect(screen.queryByTestId('hush-voting-section-results')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Result details' })).not.toBeInTheDocument();
  });
});
