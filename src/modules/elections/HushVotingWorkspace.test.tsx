import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type ElectionAnomalyMessageView,
  type ElectionAnomalyOwnerMessageView,
  type ElectionAnomalyOwnerTriageThreadView,
  ElectionHubNextActionHintProto,
  ElectionLifecycleStateProto,
  ElectionResultArtifactKindProto,
  ElectionTrusteeInvitationStatusProto,
  type GetElectionAnomalyOwnThreadResponse,
  type GetElectionAnomalyOwnerTriageResponse,
} from '@/lib/grpc';
import { HushVotingWorkspace } from './HushVotingWorkspace';
import {
  ELECTION_ANOMALY_CASE_STATE_IDS,
  ELECTION_ANOMALY_ACTOR_ROLE_CONTEXT_IDS,
  ELECTION_ANOMALY_CATEGORY_IDS,
  ELECTION_ANOMALY_MESSAGE_KIND_IDS,
} from './transactionService';
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
    getElectionAnomalyOwnThread: vi.fn(),
    getElectionAnomalyOwnerTriage: vi.fn(),
    verifyElectionReceipt: vi.fn(),
  },
}));

const mockPush = vi.fn();
const storeReset = useElectionsStore.getState().reset;

function createAnomalyMessage(
  messageId: string,
  messageKindId: string,
  overrides?: Partial<ElectionAnomalyMessageView>,
): ElectionAnomalyMessageView {
  return {
    MessageId: messageId,
    MessageKindId: messageKindId,
    RecordedAt: timestamp,
    EncryptedBody: 'ciphertext-not-for-ui',
    EncryptedBodyHash: `sha256:${messageId}`,
    PlaintextCharacterCount: 48,
    RecipientWraps: [],
    ClarificationRequestId: '',
    HasClarificationRequest: false,
    AttachmentManifestHash: '',
    ...overrides,
  };
}

function createOwnAnomalyThreadResponse(): GetElectionAnomalyOwnThreadResponse {
  return {
    Success: true,
    ErrorMessage: '',
    ActorPublicAddress: 'actor-address',
    HasThread: true,
    Thread: {
      AnomalyThreadId: 'own-thread-1',
      ElectionId: 'election-anomaly-workspace',
      CategoryId: ELECTION_ANOMALY_CATEGORY_IDS.BALLOT_CASTING_OR_RECEIPT,
      CaseStateId: ELECTION_ANOMALY_CASE_STATE_IDS.OWNER_RESPONDED,
      CurrentThreadHash: 'sha256:thread',
      SeverityCandidateId: 'requires_authority_review',
      GovernedDecisionRef: '',
      HasOpenClarificationRequest: false,
      CreatedAt: timestamp,
      UpdatedAt: timestamp,
      Messages: [
        createAnomalyMessage(
          'message-initial',
          ELECTION_ANOMALY_MESSAGE_KIND_IDS.INITIAL_SUBMISSION,
        ),
        createAnomalyMessage(
          'message-request',
          ELECTION_ANOMALY_MESSAGE_KIND_IDS.AUTHORITY_INFORMATION_REQUEST,
          {
            ClarificationRequestId: 'clarification-1',
            HasClarificationRequest: true,
          },
        ),
        createAnomalyMessage(
          'message-response',
          ELECTION_ANOMALY_MESSAGE_KIND_IDS.AUTHORITY_RESPONSE,
        ),
      ],
    },
  };
}

function createOwnerAnomalyMessage(
  messageId: string,
  messageKindId: string,
  overrides?: Partial<ElectionAnomalyOwnerMessageView>,
): ElectionAnomalyOwnerMessageView {
  return {
    MessageId: messageId,
    MessageKindId: messageKindId,
    RecordedAt: timestamp,
    EncryptedBody: 'ciphertext-not-for-ui',
    EncryptedBodyHash: `sha256:${messageId}`,
    PlaintextCharacterCount: 48,
    RecipientStatuses: [],
    HasCallerOwnerWrap: true,
    CallerOwnerWrap: {
      WrapStatusId: 'available',
      RecipientKeyFingerprint: 'sha256:owner-key',
      EncryptedContentKey: 'owner-content-key',
      WrapAlgorithm: 'x25519-aes-gcm',
    },
    ClarificationRequestId: '',
    HasClarificationRequest: false,
    AttachmentManifestHash: '',
    ...overrides,
  };
}

function createOwnerRegisteredThread(
  overrides?: Partial<ElectionAnomalyOwnerTriageThreadView>,
): ElectionAnomalyOwnerTriageThreadView {
  return {
    AnomalyThreadId: 'owner-registered-thread-1',
    ElectionId: 'election-anomaly-workspace',
    CategoryId: ELECTION_ANOMALY_CATEGORY_IDS.EXTERNAL_OBJECTION_OR_COMPLAINT,
    CaseStateId: ELECTION_ANOMALY_CASE_STATE_IDS.SUBMITTED,
    CurrentThreadHash: 'sha256:registered-thread',
    SeverityCandidateId: 'not_assessed',
    GovernedDecisionRef: '',
    SubmitterActorPublicAddress: 'actor-address',
    SubmitterRoleContextId: ELECTION_ANOMALY_ACTOR_ROLE_CONTEXT_IDS.EXTERNAL_CLAIMANT_REGISTRAR,
    LifecycleStateAtSubmission: ElectionLifecycleStateProto.Open,
    HasOpenClarificationRequest: false,
    OpenClarificationRequestId: '',
    HasOpenClarificationRequestId: false,
    CreatedAt: timestamp,
    UpdatedAt: timestamp,
    Messages: [
      createOwnerAnomalyMessage(
        'owner-message-initial',
        ELECTION_ANOMALY_MESSAGE_KIND_IDS.INITIAL_SUBMISSION,
      ),
    ],
    ...overrides,
  };
}

function createOwnerTriageResponse(
  threads: ElectionAnomalyOwnerTriageThreadView[] = [],
): GetElectionAnomalyOwnerTriageResponse {
  return {
    Success: true,
    ErrorMessage: '',
    ActorPublicAddress: 'actor-address',
    HasTriage: true,
    Triage: {
      ElectionId: 'election-anomaly-workspace',
      TotalThreadCount: threads.length,
      OpenThreadCount: threads.length,
      AwaitingInformationThreadCount: 0,
      ResponsePresentThreadCount: 0,
      ExternalClaimantThreadCount: threads.length,
      DecryptableMessageCount: threads.reduce((count, thread) => count + thread.Messages.length, 0),
      PendingRewrapMessageCount: 0,
      MissingOwnerWrapMessageCount: 0,
      AttachmentManifestCount: 0,
      GovernedContinuityHandoffStatusId: 'continuity_normal',
      CategoryCounts: [],
      CaseStateCounts: [],
      Threads: threads,
    },
  };
}

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
      getElectionAnomalyOwnThread: (...args: unknown[]) =>
        electionsServiceMock.getElectionAnomalyOwnThread(...args),
      getElectionAnomalyOwnerTriage: (...args: unknown[]) =>
        electionsServiceMock.getElectionAnomalyOwnerTriage(...args),
      verifyElectionReceipt: (...args: unknown[]) =>
        electionsServiceMock.verifyElectionReceipt(...args),
    },
  };
});

describe('HushVotingWorkspace', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    storeReset();
    mockPush.mockReset();
    electionsServiceMock.getElectionResultView.mockReset();
    electionsServiceMock.getElectionVotingView.mockReset();
    electionsServiceMock.getElectionAnomalyOwnThread.mockReset();
    electionsServiceMock.getElectionAnomalyOwnerTriage.mockReset();
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
    electionsServiceMock.getElectionAnomalyOwnThread.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      ActorPublicAddress: 'actor-address',
      HasThread: false,
    });
    electionsServiceMock.getElectionAnomalyOwnerTriage.mockResolvedValue({
      Success: false,
      ErrorMessage: 'Not owner triage for this actor.',
      ActorPublicAddress: 'actor-address',
      HasTriage: false,
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
    window.localStorage.clear();
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
      'Pending HushVoting Veritas Election',
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
        'Pending HushVoting Veritas Election',
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

  it('shows a first-class own anomaly workspace status on the election detail route', async () => {
    const loadElectionHub = vi.fn().mockResolvedValue(undefined);
    const selectHubElection = vi.fn().mockResolvedValue(undefined);
    const ownerEntry = createHubEntry(
      'election-anomaly-workspace',
      ElectionLifecycleStateProto.Draft,
      'Anomaly Workspace Election',
      {
        ActorRoles: {
          IsOwnerAdmin: true,
          IsTrustee: false,
          IsVoter: false,
          IsDesignatedAuditor: false,
        },
        CanViewParticipantResults: false,
        CanViewReportPackage: false,
      }
    );

    electionsServiceMock.getElectionAnomalyOwnThread.mockResolvedValueOnce(
      createOwnAnomalyThreadResponse()
    );

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
        'election-anomaly-workspace',
        ElectionLifecycleStateProto.Draft,
        'Anomaly Workspace Election'
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
        initialElectionId="election-anomaly-workspace"
      />
    );

    await waitFor(() => {
      expect(selectHubElection).toHaveBeenCalledWith(
        'actor-address',
        'election-anomaly-workspace'
      );
    });

    const workspace = await screen.findByTestId('hush-voting-my-anomaly-workspace');
    await waitFor(() => {
      expect(screen.getByTestId('hush-voting-my-anomaly-workspace-toggle'))
        .toHaveAttribute('aria-expanded', 'false');
    });
    expect(within(workspace).getByText('Authority responded.')).toBeInTheDocument();
    expect(within(workspace).queryByText('Ballot casting or receipt')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('hush-voting-my-anomaly-workspace-toggle'));

    expect(await within(workspace).findByText('Authority responded')).toBeInTheDocument();
    expect(within(workspace).getByText('Submitted')).toBeInTheDocument();
    expect(within(workspace).getByText('Ballot casting or receipt')).toBeInTheDocument();
    expect(within(workspace).getByText('Authority response recorded')).toBeInTheDocument();
    expect(
      within(workspace).getByRole('link', { name: 'Open my anomaly workspace' })
    ).toHaveAttribute('href', '/elections/election-anomaly-workspace/anomaly');
    expect(electionsServiceMock.getElectionAnomalyOwnThread).toHaveBeenCalledWith({
      ElectionId: 'election-anomaly-workspace',
      ActorPublicAddress: 'actor-address',
    });
  });

  it('expands the own anomaly workspace when authority activity changes after a seen marker', async () => {
    const loadElectionHub = vi.fn().mockResolvedValue(undefined);
    const selectHubElection = vi.fn().mockResolvedValue(undefined);
    const ownerEntry = createHubEntry(
      'election-anomaly-workspace',
      ElectionLifecycleStateProto.Draft,
      'Anomaly Workspace Election',
      {
        ActorRoles: {
          IsOwnerAdmin: true,
          IsTrustee: false,
          IsVoter: false,
          IsDesignatedAuditor: false,
        },
        CanViewParticipantResults: false,
        CanViewReportPackage: false,
      }
    );

    window.localStorage.setItem(
      'feat123:anomaly-workspace-seen-authority:election-anomaly-workspace:actor-address:own-thread-1',
      'own-thread-1:message-request',
    );
    electionsServiceMock.getElectionAnomalyOwnThread.mockResolvedValueOnce(
      createOwnAnomalyThreadResponse()
    );

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
        'election-anomaly-workspace',
        ElectionLifecycleStateProto.Draft,
        'Anomaly Workspace Election'
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
        initialElectionId="election-anomaly-workspace"
      />
    );

    const workspace = await screen.findByTestId('hush-voting-my-anomaly-workspace');
    await waitFor(() => {
      expect(screen.getByTestId('hush-voting-my-anomaly-workspace-toggle'))
        .toHaveAttribute('aria-expanded', 'true');
    });
    expect(within(workspace).getByText(/New authority activity is available/))
      .toBeInTheDocument();
    expect(await within(workspace).findByText('Ballot casting or receipt')).toBeInTheDocument();
  });

  it('collapses the own anomaly workspace when the latest authority message was already seen', async () => {
    const loadElectionHub = vi.fn().mockResolvedValue(undefined);
    const selectHubElection = vi.fn().mockResolvedValue(undefined);
    const ownerEntry = createHubEntry(
      'election-anomaly-workspace',
      ElectionLifecycleStateProto.Draft,
      'Anomaly Workspace Election',
      {
        ActorRoles: {
          IsOwnerAdmin: true,
          IsTrustee: false,
          IsVoter: false,
          IsDesignatedAuditor: false,
        },
        CanViewParticipantResults: false,
        CanViewReportPackage: false,
      }
    );

    window.localStorage.setItem(
      'feat123:anomaly-workspace-seen-authority:election-anomaly-workspace:actor-address:own-thread-1',
      'own-thread-1:message-response',
    );
    electionsServiceMock.getElectionAnomalyOwnThread.mockResolvedValueOnce(
      createOwnAnomalyThreadResponse()
    );

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
        'election-anomaly-workspace',
        ElectionLifecycleStateProto.Draft,
        'Anomaly Workspace Election'
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
        initialElectionId="election-anomaly-workspace"
      />
    );

    const workspace = await screen.findByTestId('hush-voting-my-anomaly-workspace');
    await waitFor(() => {
      expect(screen.getByTestId('hush-voting-my-anomaly-workspace-toggle'))
        .toHaveAttribute('aria-expanded', 'false');
    });
    expect(within(workspace).getByText('Authority responded.')).toBeInTheDocument();
    expect(within(workspace).queryByText('Ballot casting or receipt')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('hush-voting-my-anomaly-workspace-toggle'));

    expect(await within(workspace).findByText('Ballot casting or receipt')).toBeInTheDocument();
  });

  it('uses the owner-registered claimant report when the account own-thread projection is empty', async () => {
    const loadElectionHub = vi.fn().mockResolvedValue(undefined);
    const selectHubElection = vi.fn().mockResolvedValue(undefined);
    const ownerEntry = createHubEntry(
      'election-anomaly-workspace',
      ElectionLifecycleStateProto.Open,
      'Registered Claimant Election',
      {
        ActorRoles: {
          IsOwnerAdmin: true,
          IsTrustee: false,
          IsVoter: false,
          IsDesignatedAuditor: false,
        },
        CanViewParticipantResults: false,
        CanViewReportPackage: false,
      }
    );

    electionsServiceMock.getElectionAnomalyOwnThread.mockResolvedValueOnce({
      Success: true,
      ErrorMessage: '',
      ActorPublicAddress: 'actor-address',
      HasThread: false,
    });
    electionsServiceMock.getElectionAnomalyOwnerTriage.mockResolvedValueOnce(
      createOwnerTriageResponse([
        createOwnerRegisteredThread({
          CaseStateId: ELECTION_ANOMALY_CASE_STATE_IDS.AUTHORITY_REQUESTED_INFORMATION,
          Messages: [
            createOwnerAnomalyMessage(
              'owner-message-initial',
              ELECTION_ANOMALY_MESSAGE_KIND_IDS.INITIAL_SUBMISSION,
            ),
            createOwnerAnomalyMessage(
              'owner-message-authority-response',
              ELECTION_ANOMALY_MESSAGE_KIND_IDS.AUTHORITY_RESPONSE,
            ),
          ],
        }),
      ])
    );

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
        'election-anomaly-workspace',
        ElectionLifecycleStateProto.Open,
        'Registered Claimant Election'
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
        initialElectionId="election-anomaly-workspace"
      />
    );

    const workspace = await screen.findByTestId('hush-voting-my-anomaly-workspace');
    await waitFor(() => {
      expect(workspace).toHaveTextContent('Registered external claimant report');
    });
    fireEvent.click(screen.getByTestId('hush-voting-my-anomaly-workspace-toggle'));

    expect(within(workspace).getByText('Authority response recorded')).toBeInTheDocument();
    expect(within(workspace).queryByText('Awaiting information')).not.toBeInTheDocument();
    expect(within(workspace).getByText('External objection or complaint')).toBeInTheDocument();
    expect(within(workspace).queryByText('No anomaly submitted')).not.toBeInTheDocument();
    expect(electionsServiceMock.getElectionAnomalyOwnerTriage).toHaveBeenCalledWith({
      ElectionId: 'election-anomaly-workspace',
      ActorPublicAddress: 'actor-address',
    });
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
    const ownerAdminSection = screen.getByTestId('hush-voting-section-owner-admin');
    expect(ownerAdminSection).toBeInTheDocument();
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
    expect(within(ownerAdminSection).queryByRole('link', { name: 'My anomaly thread' }))
      .not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My anomaly thread' })).toHaveAttribute(
      'href',
      '/elections/election-mixed/anomaly'
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
      'Finalized HushVoting Veritas Election',
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
        'Finalized HushVoting Veritas Election',
        {
          Election: createElectionRecord(
            'election-finalized-stale',
            ElectionLifecycleStateProto.Finalized,
            'Finalized HushVoting Veritas Election',
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
