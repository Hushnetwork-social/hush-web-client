import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ElectionHubEntryView,
  ElectionRecordView,
  ElectionSummary,
  GetElectionHubViewResponse,
  GetElectionResponse,
} from '@/lib/grpc';
import {
  ElectionBindingStatusProto,
  ElectionClosedProgressStatusProto,
  ElectionGovernanceModeProto,
  ElectionHubNextActionHintProto,
  ElectionLifecycleStateProto,
} from '@/lib/grpc';
import { HushVotingWorkspace } from './HushVotingWorkspace';
import { useElectionsStore } from './useElectionsStore';

const mockPush = vi.fn();
const storeReset = useElectionsStore.getState().reset;

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const timestamp = { seconds: 1_711_410_000, nanos: 0 };

function createSummary(
  electionId: string,
  lifecycleState: ElectionLifecycleStateProto,
  title: string
): ElectionSummary {
  return {
    ElectionId: electionId,
    Title: title,
    OwnerPublicAddress: 'actor-address',
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
  title: string
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
  };
}

function createDetail(
  electionId: string,
  lifecycleState: ElectionLifecycleStateProto,
  title: string
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

describe('HushVotingWorkspace', () => {
  beforeEach(() => {
    cleanup();
    storeReset();
    mockPush.mockReset();
  });

  afterEach(() => {
    cleanup();
    storeReset();
  });

  it('loads the hub shell and routes selection through the combined workspace', async () => {
    const loadElectionHub = vi.fn().mockResolvedValue(undefined);
    const selectHubElection = vi.fn().mockResolvedValue(undefined);
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
      selectHubElection,
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

    expect(await screen.findByText('HushVoting Hub')).toBeInTheDocument();
    expect(loadElectionHub).toHaveBeenCalledWith('actor-address');
    expect(screen.getByTestId('election-hub-list')).toBeInTheDocument();
    expect(screen.getByTestId('hush-voting-section-voter')).toBeInTheDocument();
    expect(screen.getByTestId('hush-voting-section-owner-admin')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('election-hub-card-election-draft'));

    await waitFor(() => {
      expect(selectHubElection).toHaveBeenCalledWith('actor-address', 'election-draft');
    });
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

    expect(await screen.findByText('No election surfaces available')).toBeInTheDocument();
    expect(screen.getByText('No election roles are assigned to this actor.')).toBeInTheDocument();
  });

  it('renders the pre-link voter section when the hub entry only allows claim-linking', async () => {
    const loadElectionHub = vi.fn().mockResolvedValue(undefined);
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
      selectHubElection: vi.fn().mockResolvedValue(undefined),
      reset: vi.fn(),
      hubView: createHubView([claimEntry]),
      hubEntries: [claimEntry],
      selectedElectionId: 'election-claim',
      selectedHubEntry: claimEntry,
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
      />
    );

    expect(await screen.findByTestId('hush-voting-section-voter')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open identity and eligibility' })).toHaveAttribute(
      'href',
      '/account/elections/election-claim/eligibility'
    );
  });

  it('keeps the mixed-role vertical-slice links available from the shared workspace shell', async () => {
    const loadElectionHub = vi.fn().mockResolvedValue(undefined);
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

    useElectionsStore.setState({
      loadElectionHub,
      clearGrantCandidateSearch: vi.fn(),
      selectHubElection: vi.fn().mockResolvedValue(undefined),
      reset: vi.fn(),
      hubView: createHubView([mixedRoleEntry]),
      hubEntries: [mixedRoleEntry],
      selectedElectionId: 'election-mixed',
      selectedHubEntry: mixedRoleEntry,
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
      />
    );

    expect(await screen.findByTestId('hush-voting-section-owner-admin')).toBeInTheDocument();
    expect(screen.getByTestId('hush-voting-section-trustee')).toBeInTheDocument();
    expect(screen.getByTestId('hush-voting-section-auditor')).toBeInTheDocument();
    expect(screen.getByTestId('hush-voting-section-results')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open detailed owner workspace' })).toHaveAttribute(
      'href',
      '/account/elections/owner'
    );
    expect(screen.getByRole('link', { name: 'Open ceremony workspace' })).toHaveAttribute(
      'href',
      '/account/elections/trustee/election-mixed/ceremony'
    );
    expect(screen.getByRole('link', { name: 'Open share workspace' })).toHaveAttribute(
      'href',
      '/account/elections/trustee/election-mixed/finalization'
    );
    expect(screen.getByRole('link', { name: 'Open voter result detail' })).toHaveAttribute(
      'href',
      '/account/elections/voter/election-mixed'
    );
  });
});
