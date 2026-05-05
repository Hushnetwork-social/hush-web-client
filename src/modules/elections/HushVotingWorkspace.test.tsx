import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ElectionHubNextActionHintProto,
  ElectionLifecycleStateProto,
  ElectionResultArtifactKindProto,
  ElectionTrusteeInvitationStatusProto,
} from '@/lib/grpc';
import { HushVotingWorkspace } from './HushVotingWorkspace';
import {
  createDetail,
  createElectionRecord,
  createHubEntry,
  createHubView,
  createReportArtifact,
  createReportPackage,
  createResultArtifact,
  createResultView,
  createVerificationPackageStatus,
  timestamp,
} from './HushVotingWorkspaceTestUtils';
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
      PersonalParticipationStatus: 0,
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
    expect(screen.getByTestId('election-hub-card-election-open')).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.getByTestId('election-hub-card-election-draft')).toHaveAttribute(
      'aria-pressed',
      'false'
    );
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

  it('shows the extracted mixed-role sections only on the election detail route', async () => {
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
        VerificationPackageStatus: createVerificationPackageStatus({
          ElectionId: 'election-mixed',
          ActorPublicAddress: 'actor-address',
        }),
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

    expect(await screen.findByTestId('hush-voting-section-voter')).toBeInTheDocument();
    expect(screen.getByTestId('hush-voting-section-owner-admin')).toBeInTheDocument();
    expect(screen.getByTestId('hush-voting-section-trustee')).toBeInTheDocument();
    expect(screen.getByTestId('hush-voting-section-auditor')).toBeInTheDocument();
    expect(screen.getByTestId('hush-voting-section-results')).toBeInTheDocument();
    expect(screen.getByTestId('hush-voting-section-artifacts')).toBeInTheDocument();
    const sectionOrder = Array.from(
      document.querySelectorAll('[data-testid^="hush-voting-section-"]')
    ).map((section) => section.getAttribute('data-testid'));
    expect(sectionOrder).toEqual([
      'hush-voting-section-results',
      'hush-voting-section-owner-admin',
      'hush-voting-section-trustee',
      'hush-voting-section-auditor',
      'hush-voting-section-voter',
      'hush-voting-section-artifacts',
    ]);
    expect(screen.getByRole('link', { name: 'Back to HushVoting! Hub' })).toHaveAttribute(
      'href',
      '/elections'
    );
    expect(electionsServiceMock.getElectionResultView).toHaveBeenCalledWith({
      ElectionId: 'election-mixed',
      ActorPublicAddress: 'actor-address',
    });

    fireEvent.click(screen.getByTestId('hush-voting-artifacts-toggle'));

    expect(await screen.findByTestId('verification-package-status-section')).toHaveTextContent(
      'Independent election-record export'
    );
  });

  it('promotes the official result from finalized detail artifacts when hub state lags behind', async () => {
    const loadElectionHub = vi.fn().mockResolvedValue(undefined);
    const selectHubElection = vi.fn().mockResolvedValue(undefined);
    const finalizedEntry = createHubEntry(
      'election-finalized-stale',
      ElectionLifecycleStateProto.Finalized,
      'Finalized Trustee Election',
      {
        ActorRoles: {
          IsOwnerAdmin: true,
          IsTrustee: true,
          IsVoter: false,
          IsDesignatedAuditor: false,
        },
        HasUnofficialResult: true,
        HasOfficialResult: false,
      }
    );

    electionsServiceMock.getElectionResultView.mockResolvedValue(createResultView());

    useElectionsStore.setState({
      loadElectionHub,
      clearGrantCandidateSearch: vi.fn(),
      selectHubElection,
      reset: vi.fn(),
      hubView: createHubView([finalizedEntry]),
      hubEntries: [finalizedEntry],
      selectedElectionId: null,
      selectedHubEntry: null,
      selectedElection: createDetail(
        'election-finalized-stale',
        ElectionLifecycleStateProto.Finalized,
        'Finalized Trustee Election',
        {
          Election: createElectionRecord(
            'election-finalized-stale',
            ElectionLifecycleStateProto.Finalized,
            'Finalized Trustee Election',
            {
              UnofficialResultArtifactId: 'unofficial-result-stale',
              OfficialResultArtifactId: 'official-result-stale',
            }
          ),
          ResultArtifacts: [
            createResultArtifact({
              Id: 'official-result-stale',
              ElectionId: 'election-finalized-stale',
              ArtifactKind: ElectionResultArtifactKindProto.ElectionResultArtifactOfficial,
              Title: 'Official result',
            }),
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
        initialElectionId="election-finalized-stale"
      />
    );

    await waitFor(() => {
      expect(selectHubElection).toHaveBeenCalledWith('actor-address', 'election-finalized-stale');
    });

    expect(await screen.findAllByText('Official result published.')).not.toHaveLength(0);
    expect(screen.getByRole('link', { name: 'Open official result' })).toBeInTheDocument();
    expect(screen.getByTestId('election-official-result')).toBeInTheDocument();
    expect(screen.queryByText('Unofficial result published.')).not.toBeInTheDocument();
  });
});
