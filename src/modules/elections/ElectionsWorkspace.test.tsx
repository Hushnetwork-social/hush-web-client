import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ElectionCeremonyTrusteeState,
  ElectionCommandResponse,
  ElectionDraftInput,
  ElectionDraftSnapshot,
  ElectionRecordView,
  ElectionSummary,
  GetElectionCeremonyActionViewResponse,
  GetElectionOpenReadinessResponse,
  GetElectionResponse,
} from '@/lib/grpc';
import {
  ElectionCeremonyActionTypeProto,
  ElectionCeremonyActorRoleProto,
  ElectionCeremonyVersionStatusProto,
  ElectionBindingStatusProto,
  ElectionClassProto,
  ElectionDisclosureModeProto,
  ElectionGovernanceModeProto,
  ElectionGovernedActionTypeProto,
  ElectionGovernedProposalExecutionStatusProto,
  ElectionLifecycleStateProto,
  ElectionTrusteeCeremonyStateProto,
  ElectionTrusteeInvitationStatusProto,
  EligibilityMutationPolicyProto,
  EligibilitySourceTypeProto,
  OutcomeRuleKindProto,
  ParticipationPrivacyModeProto,
  ReportingPolicyProto,
  ReviewWindowPolicyProto,
  VoteUpdatePolicyProto,
} from '@/lib/grpc';
import { ElectionsWorkspace } from './ElectionsWorkspace';
import { createDefaultElectionDraft } from './contracts';
import { useElectionsStore } from './useElectionsStore';

const { electionsServiceMock, blockchainServiceMock, transactionServiceMock } = vi.hoisted(() => ({
  electionsServiceMock: {
    approveElectionGovernedProposal: vi.fn(),
    closeElection: vi.fn(),
    createElectionDraft: vi.fn(),
    finalizeElection: vi.fn(),
    getElection: vi.fn(),
    getElectionCeremonyActionView: vi.fn(),
    getElectionOpenReadiness: vi.fn(),
    getElectionsByOwner: vi.fn(),
    inviteElectionTrustee: vi.fn(),
    openElection: vi.fn(),
    restartElectionCeremony: vi.fn(),
    revokeElectionTrusteeInvitation: vi.fn(),
    retryElectionGovernedProposalExecution: vi.fn(),
    startElectionCeremony: vi.fn(),
    startElectionGovernedProposal: vi.fn(),
    updateElectionDraft: vi.fn(),
  },
  blockchainServiceMock: {
    submitTransaction: vi.fn(),
  },
  transactionServiceMock: {
    createApproveElectionGovernedProposalTransaction: vi.fn(),
    createCloseElectionTransaction: vi.fn(),
    createElectionDraftTransaction: vi.fn(),
    createElectionTrusteeInvitationTransaction: vi.fn(),
    createFinalizeElectionTransaction: vi.fn(),
    createOpenElectionTransaction: vi.fn(),
    createRevokeElectionTrusteeInvitationTransaction: vi.fn(),
    createRestartElectionCeremonyTransaction: vi.fn(),
    createRetryElectionGovernedProposalExecutionTransaction: vi.fn(),
    createStartElectionCeremonyTransaction: vi.fn(),
    createStartElectionGovernedProposalTransaction: vi.fn(),
    createUpdateElectionDraftTransaction: vi.fn(),
  },
}));

vi.mock('@/lib/grpc/services/elections', () => ({
  electionsService: electionsServiceMock,
}));

vi.mock('@/modules/blockchain/BlockchainService', () => ({
  submitTransaction: (...args: unknown[]) => blockchainServiceMock.submitTransaction(...args),
}));

vi.mock('./transactionService', () => ({
  createApproveElectionGovernedProposalTransaction: (...args: unknown[]) =>
    transactionServiceMock.createApproveElectionGovernedProposalTransaction(...args),
  createCloseElectionTransaction: (...args: unknown[]) =>
    transactionServiceMock.createCloseElectionTransaction(...args),
  createElectionDraftTransaction: (...args: unknown[]) =>
    transactionServiceMock.createElectionDraftTransaction(...args),
  createElectionTrusteeInvitationTransaction: (...args: unknown[]) =>
    transactionServiceMock.createElectionTrusteeInvitationTransaction(...args),
  createFinalizeElectionTransaction: (...args: unknown[]) =>
    transactionServiceMock.createFinalizeElectionTransaction(...args),
  createOpenElectionTransaction: (...args: unknown[]) =>
    transactionServiceMock.createOpenElectionTransaction(...args),
  createRevokeElectionTrusteeInvitationTransaction: (...args: unknown[]) =>
    transactionServiceMock.createRevokeElectionTrusteeInvitationTransaction(...args),
  createRestartElectionCeremonyTransaction: (...args: unknown[]) =>
    transactionServiceMock.createRestartElectionCeremonyTransaction(...args),
  createRetryElectionGovernedProposalExecutionTransaction: (...args: unknown[]) =>
    transactionServiceMock.createRetryElectionGovernedProposalExecutionTransaction(...args),
  createStartElectionCeremonyTransaction: (...args: unknown[]) =>
    transactionServiceMock.createStartElectionCeremonyTransaction(...args),
  createStartElectionGovernedProposalTransaction: (...args: unknown[]) =>
    transactionServiceMock.createStartElectionGovernedProposalTransaction(...args),
  createUpdateElectionDraftTransaction: (...args: unknown[]) =>
    transactionServiceMock.createUpdateElectionDraftTransaction(...args),
}));

const timestamp = { seconds: 1_711_410_000, nanos: 0 };

function createDraftInput(overrides?: Partial<ElectionDraftInput>): ElectionDraftInput {
  return {
    ...createDefaultElectionDraft(),
    Title: 'Board Election',
    ExternalReferenceCode: 'ORG-2026-01',
    OwnerOptions: [
      {
        OptionId: 'option-a',
        DisplayLabel: 'Alice',
        ShortDescription: 'First option',
        BallotOrder: 1,
        IsBlankOption: false,
      },
      {
        OptionId: 'option-b',
        DisplayLabel: 'Bob',
        ShortDescription: 'Second option',
        BallotOrder: 2,
        IsBlankOption: false,
      },
    ],
    ...overrides,
  };
}

function createElectionRecord(
  lifecycleState: ElectionLifecycleStateProto,
  overrides?: Partial<ElectionRecordView>
): ElectionRecordView {
  const draft = createDraftInput();

  return {
    ElectionId: 'election-1',
    Title: draft.Title,
    ShortDescription: draft.ShortDescription,
    OwnerPublicAddress: 'owner-public-key',
    ExternalReferenceCode: draft.ExternalReferenceCode,
    LifecycleState: lifecycleState,
    ElectionClass: draft.ElectionClass,
    BindingStatus: draft.BindingStatus,
    GovernanceMode: draft.GovernanceMode,
    DisclosureMode: draft.DisclosureMode,
    ParticipationPrivacyMode: draft.ParticipationPrivacyMode,
    VoteUpdatePolicy: draft.VoteUpdatePolicy,
    EligibilitySourceType: draft.EligibilitySourceType,
    EligibilityMutationPolicy: draft.EligibilityMutationPolicy,
    OutcomeRule: draft.OutcomeRule,
    ApprovedClientApplications: draft.ApprovedClientApplications,
    ProtocolOmegaVersion: draft.ProtocolOmegaVersion,
    ReportingPolicy: draft.ReportingPolicy,
    ReviewWindowPolicy: draft.ReviewWindowPolicy,
    CurrentDraftRevision: 1,
    Options: draft.OwnerOptions,
    AcknowledgedWarningCodes: draft.AcknowledgedWarningCodes,
    RequiredApprovalCount: draft.RequiredApprovalCount,
    CreatedAt: timestamp,
    LastUpdatedAt: timestamp,
    OpenedAt: lifecycleState >= ElectionLifecycleStateProto.Open ? timestamp : undefined,
    ClosedAt: lifecycleState >= ElectionLifecycleStateProto.Closed ? timestamp : undefined,
    FinalizedAt: lifecycleState >= ElectionLifecycleStateProto.Finalized ? timestamp : undefined,
    OpenArtifactId: lifecycleState >= ElectionLifecycleStateProto.Open ? 'open-artifact' : '',
    CloseArtifactId: lifecycleState >= ElectionLifecycleStateProto.Closed ? 'close-artifact' : '',
    FinalizeArtifactId:
      lifecycleState >= ElectionLifecycleStateProto.Finalized ? 'finalize-artifact' : '',
    ...overrides,
  };
}

function createElectionSummary(
  lifecycleState: ElectionLifecycleStateProto,
  overrides?: Partial<ElectionSummary>
): ElectionSummary {
  return {
    ElectionId: 'election-1',
    Title: 'Board Election',
    OwnerPublicAddress: 'owner-public-key',
    LifecycleState: lifecycleState,
    BindingStatus: ElectionBindingStatusProto.Binding,
    GovernanceMode: ElectionGovernanceModeProto.AdminOnly,
    CurrentDraftRevision: 1,
    LastUpdatedAt: timestamp,
    ...overrides,
  };
}

function createDraftSnapshot(overrides?: Partial<ElectionDraftSnapshot>): ElectionDraftSnapshot {
  const draft = createDraftInput();

  return {
    Id: 'snapshot-1',
    ElectionId: 'election-1',
    DraftRevision: 1,
    Metadata: {
      Title: draft.Title,
      ShortDescription: draft.ShortDescription,
      OwnerPublicAddress: 'owner-public-key',
      ExternalReferenceCode: draft.ExternalReferenceCode,
    },
    Policy: {
      ElectionClass: draft.ElectionClass,
      BindingStatus: draft.BindingStatus,
      GovernanceMode: draft.GovernanceMode,
      DisclosureMode: draft.DisclosureMode,
      ParticipationPrivacyMode: draft.ParticipationPrivacyMode,
      VoteUpdatePolicy: draft.VoteUpdatePolicy,
      EligibilitySourceType: draft.EligibilitySourceType,
      EligibilityMutationPolicy: draft.EligibilityMutationPolicy,
      OutcomeRule: draft.OutcomeRule,
      ApprovedClientApplications: draft.ApprovedClientApplications,
      ProtocolOmegaVersion: draft.ProtocolOmegaVersion,
      ReportingPolicy: draft.ReportingPolicy,
      ReviewWindowPolicy: draft.ReviewWindowPolicy,
      RequiredApprovalCount: draft.RequiredApprovalCount,
    },
    Options: draft.OwnerOptions,
    AcknowledgedWarningCodes: draft.AcknowledgedWarningCodes,
    SnapshotReason: 'Initial draft',
    RecordedAt: timestamp,
    RecordedByPublicAddress: 'owner-public-key',
    ...overrides,
  };
}

function createElectionResponse(overrides?: Partial<GetElectionResponse>): GetElectionResponse {
  return {
    Success: true,
    ErrorMessage: '',
    Election: createElectionRecord(ElectionLifecycleStateProto.Draft),
    LatestDraftSnapshot: createDraftSnapshot(),
    WarningAcknowledgements: [],
    TrusteeInvitations: [],
    BoundaryArtifacts: [],
    GovernedProposals: [],
    GovernedProposalApprovals: [],
    CeremonyProfiles: [],
    CeremonyVersions: [],
    CeremonyTranscriptEvents: [],
    ActiveCeremonyTrusteeStates: [],
    ...overrides,
  };
}

function createCeremonyActionViewResponse(
  overrides?: Partial<GetElectionCeremonyActionViewResponse>
): GetElectionCeremonyActionViewResponse {
  return {
    Success: true,
    ErrorMessage: '',
    ActorRole: ElectionCeremonyActorRoleProto.CeremonyActorOwner,
    ActorPublicAddress: 'owner-public-key',
    OwnerActions: [
      {
        ActionType: ElectionCeremonyActionTypeProto.CeremonyActionStartVersion,
        IsAvailable: true,
        IsCompleted: false,
        Reason: 'Start the first ceremony version.',
      },
      {
        ActionType: ElectionCeremonyActionTypeProto.CeremonyActionRestartVersion,
        IsAvailable: false,
        IsCompleted: false,
        Reason: 'No active version exists yet.',
      },
    ],
    TrusteeActions: [],
    PendingIncomingMessageCount: 0,
    BlockedReasons: [],
    ...overrides,
  };
}

function createCeremonyTrusteeState(
  overrides?: Partial<ElectionCeremonyTrusteeState>
): ElectionCeremonyTrusteeState {
  return {
    Id: 'ceremony-state-1',
    ElectionId: 'election-1',
    CeremonyVersionId: 'ceremony-version-1',
    TrusteeUserAddress: 'trustee-a',
    TrusteeDisplayName: 'Alice Trustee',
    State: ElectionTrusteeCeremonyStateProto.CeremonyStateJoined,
    TransportPublicKeyFingerprint: 'transport-fingerprint-1',
    LastUpdatedAt: timestamp,
    ShareVersion: '',
    ValidationFailureReason: '',
    ...overrides,
  };
}

function createCommandResponse(overrides?: Partial<ElectionCommandResponse>): ElectionCommandResponse {
  return {
    Success: true,
    ErrorCode: 0,
    ErrorMessage: '',
    ValidationErrors: [],
    Election: createElectionRecord(ElectionLifecycleStateProto.Draft),
    CeremonyTranscriptEvents: [],
    ...overrides,
  };
}

function createReadinessResponse(
  overrides?: Partial<GetElectionOpenReadinessResponse>
): GetElectionOpenReadinessResponse {
  return {
    IsReadyToOpen: true,
    ValidationErrors: [],
    RequiredWarningCodes: [],
    MissingWarningAcknowledgements: [],
    ...overrides,
  };
}

describe('ElectionsWorkspace', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    useElectionsStore.getState().reset();
    vi.resetAllMocks();
    electionsServiceMock.getElectionsByOwner.mockResolvedValue({ Elections: [] });
    electionsServiceMock.getElection.mockResolvedValue(createElectionResponse());
    electionsServiceMock.getElectionCeremonyActionView.mockResolvedValue(createCeremonyActionViewResponse());
    electionsServiceMock.getElectionOpenReadiness.mockResolvedValue(createReadinessResponse());
    electionsServiceMock.createElectionDraft.mockResolvedValue(createCommandResponse());
    electionsServiceMock.updateElectionDraft.mockResolvedValue(createCommandResponse());
    electionsServiceMock.revokeElectionTrusteeInvitation.mockResolvedValue(createCommandResponse());
    electionsServiceMock.startElectionGovernedProposal.mockResolvedValue(createCommandResponse());
    electionsServiceMock.approveElectionGovernedProposal.mockResolvedValue(createCommandResponse());
    electionsServiceMock.retryElectionGovernedProposalExecution.mockResolvedValue(createCommandResponse());
    electionsServiceMock.openElection.mockResolvedValue(createCommandResponse());
    electionsServiceMock.closeElection.mockResolvedValue(createCommandResponse());
    electionsServiceMock.finalizeElection.mockResolvedValue(createCommandResponse());
    electionsServiceMock.startElectionCeremony.mockResolvedValue(createCommandResponse());
    electionsServiceMock.restartElectionCeremony.mockResolvedValue(createCommandResponse());
    blockchainServiceMock.submitTransaction.mockResolvedValue({ successful: true, message: 'Accepted' });
    transactionServiceMock.createElectionDraftTransaction.mockResolvedValue({
      signedTransaction: 'signed-election-transaction',
      electionId: 'election-1',
    });
    transactionServiceMock.createStartElectionGovernedProposalTransaction.mockResolvedValue({
      signedTransaction: 'signed-start-governed-proposal-transaction',
      proposalId: 'proposal-1',
    });
    transactionServiceMock.createApproveElectionGovernedProposalTransaction.mockResolvedValue({
      signedTransaction: 'signed-approve-governed-proposal-transaction',
    });
    transactionServiceMock.createRetryElectionGovernedProposalExecutionTransaction.mockResolvedValue({
      signedTransaction: 'signed-retry-governed-proposal-transaction',
    });
    transactionServiceMock.createOpenElectionTransaction.mockResolvedValue({
      signedTransaction: 'signed-open-election-transaction',
    });
    transactionServiceMock.createCloseElectionTransaction.mockResolvedValue({
      signedTransaction: 'signed-close-election-transaction',
    });
    transactionServiceMock.createFinalizeElectionTransaction.mockResolvedValue({
      signedTransaction: 'signed-finalize-election-transaction',
    });
    transactionServiceMock.createElectionTrusteeInvitationTransaction.mockResolvedValue({
      signedTransaction: 'signed-trustee-invite-transaction',
      invitationId: 'invite-1',
    });
    transactionServiceMock.createUpdateElectionDraftTransaction.mockResolvedValue({
      signedTransaction: 'signed-draft-update-transaction',
    });
    transactionServiceMock.createRevokeElectionTrusteeInvitationTransaction.mockResolvedValue({
      signedTransaction: 'signed-trustee-revoke-transaction',
    });
    transactionServiceMock.createStartElectionCeremonyTransaction.mockResolvedValue({
      signedTransaction: 'signed-start-election-ceremony-transaction',
    });
    transactionServiceMock.createRestartElectionCeremonyTransaction.mockResolvedValue({
      signedTransaction: 'signed-restart-election-ceremony-transaction',
    });
  });

  it('creates a valid draft and shows save feedback', async () => {
    const createdRecord = createElectionRecord(ElectionLifecycleStateProto.Draft);
    electionsServiceMock.getElectionsByOwner
      .mockResolvedValueOnce({ Elections: [] })
      .mockResolvedValueOnce({
        Elections: [createElectionSummary(ElectionLifecycleStateProto.Draft)],
      });
    electionsServiceMock.getElection.mockResolvedValue(
      createElectionResponse({
        Election: createdRecord,
        LatestDraftSnapshot: createDraftSnapshot(),
      })
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />
    );

    fireEvent.change(screen.getByTestId('elections-title-input'), {
      target: { value: 'Board Election' },
    });
    fireEvent.change(screen.getByTestId('elections-option-label-0'), {
      target: { value: 'Alice' },
    });
    fireEvent.change(screen.getByTestId('elections-option-label-1'), {
      target: { value: 'Bob' },
    });

    fireEvent.click(screen.getByTestId('elections-save-button'));

    expect(await screen.findByText('Election draft created.')).toBeInTheDocument();
    expect(transactionServiceMock.createElectionDraftTransaction).toHaveBeenCalledWith(
      'owner-public-key',
      'owner-encryption-key',
      'Initial draft',
      expect.objectContaining({
        Title: 'Board Election',
      }),
      'owner-private-key'
    );
    expect(blockchainServiceMock.submitTransaction).toHaveBeenCalledWith('signed-election-transaction');
    expect(electionsServiceMock.createElectionDraft).not.toHaveBeenCalled();
  });

  it('shows pending feedback when the draft transaction is accepted before indexing finishes', async () => {
    vi.useFakeTimers();
    electionsServiceMock.getElectionsByOwner
      .mockResolvedValueOnce({ Elections: [] })
      .mockResolvedValueOnce({ Elections: [] });
    electionsServiceMock.getElection.mockResolvedValue({
      Success: false,
      ErrorMessage: 'not indexed yet',
      Election: undefined,
      LatestDraftSnapshot: undefined,
      WarningAcknowledgements: [],
      TrusteeInvitations: [],
      BoundaryArtifacts: [],
      GovernedProposals: [],
      GovernedProposalApprovals: [],
      CeremonyProfiles: [],
      CeremonyVersions: [],
      CeremonyTranscriptEvents: [],
      ActiveCeremonyTrusteeStates: [],
    });

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />
    );

    fireEvent.change(screen.getByTestId('elections-title-input'), {
      target: { value: 'Board Election' },
    });
    fireEvent.change(screen.getByTestId('elections-option-label-0'), {
      target: { value: 'Alice' },
    });
    fireEvent.change(screen.getByTestId('elections-option-label-1'), {
      target: { value: 'Bob' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('elections-save-button'));
      await vi.runAllTimersAsync();
    });

    expect(screen.getByText('Election draft submitted.')).toBeInTheDocument();
    expect(screen.getByText(/waiting for block confirmation/i)).toBeInTheDocument();
  });

  it('updates an existing draft through blockchain submission and waits for the next revision', async () => {
    const baselineElection = createElectionRecord(ElectionLifecycleStateProto.Draft, {
      Title: 'Board Election',
      CurrentDraftRevision: 1,
    });
    const updatedElection = {
      ...baselineElection,
      Title: 'Board Election Final',
      CurrentDraftRevision: 2,
    };

    electionsServiceMock.getElectionsByOwner
      .mockResolvedValueOnce({
        Elections: [createElectionSummary(ElectionLifecycleStateProto.Draft)],
      })
      .mockResolvedValue({
        Elections: [
          createElectionSummary(ElectionLifecycleStateProto.Draft, {
            CurrentDraftRevision: 2,
          }),
        ],
      });
    electionsServiceMock.getElection
      .mockResolvedValueOnce(
        createElectionResponse({
          Election: baselineElection,
          LatestDraftSnapshot: createDraftSnapshot({
            DraftRevision: 1,
            SnapshotReason: 'Initial draft',
            Metadata: {
              Title: 'Board Election',
              ShortDescription: baselineElection.ShortDescription,
              OwnerPublicAddress: 'owner-public-key',
              ExternalReferenceCode: baselineElection.ExternalReferenceCode,
            },
          }),
        })
      )
      .mockResolvedValueOnce(
        createElectionResponse({
          Election: updatedElection,
          LatestDraftSnapshot: createDraftSnapshot({
            DraftRevision: 2,
            SnapshotReason: 'Owner draft update',
            Metadata: {
              Title: 'Board Election Final',
              ShortDescription: updatedElection.ShortDescription,
              OwnerPublicAddress: 'owner-public-key',
              ExternalReferenceCode: updatedElection.ExternalReferenceCode,
            },
          }),
        })
      )
      .mockResolvedValue(
        createElectionResponse({
          Election: updatedElection,
          LatestDraftSnapshot: createDraftSnapshot({
            DraftRevision: 2,
            SnapshotReason: 'Owner draft update',
            Metadata: {
              Title: 'Board Election Final',
              ShortDescription: updatedElection.ShortDescription,
              OwnerPublicAddress: 'owner-public-key',
              ExternalReferenceCode: updatedElection.ExternalReferenceCode,
            },
          }),
        })
      );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />
    );

    expect(await screen.findByTestId('elections-title-input')).toHaveValue('Board Election');

    fireEvent.change(screen.getByTestId('elections-title-input'), {
      target: { value: 'Board Election Final' },
    });
    fireEvent.click(screen.getByTestId('elections-save-button'));

    await waitFor(() => {
      expect(transactionServiceMock.createUpdateElectionDraftTransaction).toHaveBeenCalledWith(
        'election-1',
        'owner-public-key',
        'owner-encryption-key',
        'owner-encryption-private-key',
        'Owner draft update',
        expect.objectContaining({
          Title: 'Board Election Final',
        }),
        'owner-private-key'
      );
    });
    expect(blockchainServiceMock.submitTransaction).toHaveBeenCalledWith(
      'signed-draft-update-transaction'
    );
    expect(electionsServiceMock.updateElectionDraft).not.toHaveBeenCalled();
    expect(await screen.findByText('Election draft updated.')).toBeInTheDocument();
  });

  it('invites a trustee through blockchain submission and waits for indexed readback', async () => {
    const thresholdElection = createElectionRecord(ElectionLifecycleStateProto.Draft, {
      GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
      ReviewWindowPolicy: ReviewWindowPolicyProto.GovernedReviewWindowReserved,
      RequiredApprovalCount: 3,
    });
    const thresholdPolicy = {
      ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
      BindingStatus: ElectionBindingStatusProto.Binding,
      GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
      DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
      ParticipationPrivacyMode:
        ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
      VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
      EligibilitySourceType: EligibilitySourceTypeProto.OrganizationImportedRoster,
      EligibilityMutationPolicy: EligibilityMutationPolicyProto.FrozenAtOpen,
      OutcomeRule: thresholdElection.OutcomeRule,
      ApprovedClientApplications: [{ ApplicationId: 'hushsocial', Version: '1.0.0' }],
      ProtocolOmegaVersion: 'omega-v1.0.0',
      ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
      ReviewWindowPolicy: ReviewWindowPolicyProto.GovernedReviewWindowReserved,
      RequiredApprovalCount: 3,
    };
    const indexedInvitations = [
      {
        Id: 'invite-1',
        ElectionId: 'election-1',
        TrusteeUserAddress: 'trustee-z',
        TrusteeDisplayName: 'Zoe Trustee',
        InvitedByPublicAddress: 'owner-public-key',
        LinkedMessageId: 'message-1',
        Status: ElectionTrusteeInvitationStatusProto.Pending,
        SentAtDraftRevision: 1,
        SentAt: timestamp,
      },
    ];

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Draft, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    electionsServiceMock.getElection
      .mockResolvedValueOnce(
        createElectionResponse({
          Election: thresholdElection,
          LatestDraftSnapshot: createDraftSnapshot({ Policy: thresholdPolicy }),
          TrusteeInvitations: [],
          CeremonyProfiles: [],
        })
      )
      .mockResolvedValueOnce(
        createElectionResponse({
          Election: thresholdElection,
          LatestDraftSnapshot: createDraftSnapshot({ Policy: thresholdPolicy }),
          TrusteeInvitations: indexedInvitations,
          CeremonyProfiles: [],
        })
      )
      .mockResolvedValue(
        createElectionResponse({
          Election: thresholdElection,
          LatestDraftSnapshot: createDraftSnapshot({ Policy: thresholdPolicy }),
          TrusteeInvitations: indexedInvitations,
          CeremonyProfiles: [],
        })
      );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />
    );

    expect(await screen.findByTestId('elections-trustee-user-address-input')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('elections-trustee-user-address-input'), {
      target: { value: 'trustee-z' },
    });
    fireEvent.change(screen.getByTestId('elections-trustee-display-name-input'), {
      target: { value: 'Zoe Trustee' },
    });

    fireEvent.click(screen.getByTestId('elections-invite-trustee-button'));

    await waitFor(() => {
      expect(transactionServiceMock.createElectionTrusteeInvitationTransaction).toHaveBeenCalledWith(
        'election-1',
        'owner-public-key',
        'owner-encryption-key',
        'owner-encryption-private-key',
        'trustee-z',
        'Zoe Trustee',
        'owner-private-key'
      );
    });
    expect(blockchainServiceMock.submitTransaction).toHaveBeenCalledWith(
      'signed-trustee-invite-transaction'
    );
    expect(await screen.findByText('Trustee invitation created.')).toBeInTheDocument();
    expect(screen.getByText('Zoe Trustee (trustee-z)')).toBeInTheDocument();
  });

  it('revokes a trustee invitation through blockchain submission and waits for the revoked status', async () => {
    const thresholdElection = createElectionRecord(ElectionLifecycleStateProto.Draft, {
      GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
      ReviewWindowPolicy: ReviewWindowPolicyProto.GovernedReviewWindowReserved,
      RequiredApprovalCount: 3,
    });
    const thresholdPolicy = {
      ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
      BindingStatus: ElectionBindingStatusProto.Binding,
      GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
      DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
      ParticipationPrivacyMode:
        ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
      VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
      EligibilitySourceType: EligibilitySourceTypeProto.OrganizationImportedRoster,
      EligibilityMutationPolicy: EligibilityMutationPolicyProto.FrozenAtOpen,
      OutcomeRule: thresholdElection.OutcomeRule,
      ApprovedClientApplications: [{ ApplicationId: 'hushsocial', Version: '1.0.0' }],
      ProtocolOmegaVersion: 'omega-v1.0.0',
      ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
      ReviewWindowPolicy: ReviewWindowPolicyProto.GovernedReviewWindowReserved,
      RequiredApprovalCount: 3,
    };
    const pendingInvitation = {
      Id: 'invite-1',
      ElectionId: 'election-1',
      TrusteeUserAddress: 'trustee-z',
      TrusteeDisplayName: 'Zoe Trustee',
      InvitedByPublicAddress: 'owner-public-key',
      LinkedMessageId: 'message-1',
      Status: ElectionTrusteeInvitationStatusProto.Pending,
      SentAtDraftRevision: 1,
      SentAt: timestamp,
    };
    const revokedInvitation = {
      ...pendingInvitation,
      Status: ElectionTrusteeInvitationStatusProto.Revoked,
      ResolvedAtDraftRevision: 1,
      RevokedAt: timestamp,
    };

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Draft, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    electionsServiceMock.getElection
      .mockResolvedValueOnce(
        createElectionResponse({
          Election: thresholdElection,
          LatestDraftSnapshot: createDraftSnapshot({ Policy: thresholdPolicy }),
          TrusteeInvitations: [pendingInvitation],
          CeremonyProfiles: [],
        })
      )
      .mockResolvedValueOnce(
        createElectionResponse({
          Election: thresholdElection,
          LatestDraftSnapshot: createDraftSnapshot({ Policy: thresholdPolicy }),
          TrusteeInvitations: [revokedInvitation],
          CeremonyProfiles: [],
        })
      )
      .mockResolvedValue(
        createElectionResponse({
          Election: thresholdElection,
          LatestDraftSnapshot: createDraftSnapshot({ Policy: thresholdPolicy }),
          TrusteeInvitations: [revokedInvitation],
          CeremonyProfiles: [],
        })
      );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />
    );

    expect(await screen.findByText('Zoe Trustee (trustee-z)')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Revoke'));

    await waitFor(() => {
      expect(
        transactionServiceMock.createRevokeElectionTrusteeInvitationTransaction
      ).toHaveBeenCalledWith(
        'election-1',
        'invite-1',
        'owner-public-key',
        'owner-encryption-key',
        'owner-encryption-private-key',
        'owner-private-key'
      );
    });
    expect(blockchainServiceMock.submitTransaction).toHaveBeenCalledWith(
      'signed-trustee-revoke-transaction'
    );
    expect(electionsServiceMock.revokeElectionTrusteeInvitation).not.toHaveBeenCalled();
    expect(await screen.findByText('Trustee invitation revoked.')).toBeInTheDocument();
    expect(screen.getByText(/Revoked • Sent at draft revision/i)).toBeInTheDocument();
  });

  it('keeps the busy state while the trustee invitation waits for indexing', async () => {
    const thresholdElection = createElectionRecord(ElectionLifecycleStateProto.Draft, {
      GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
      ReviewWindowPolicy: ReviewWindowPolicyProto.GovernedReviewWindowReserved,
      RequiredApprovalCount: 3,
    });
    const thresholdPolicy = {
      ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
      BindingStatus: ElectionBindingStatusProto.Binding,
      GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
      DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
      ParticipationPrivacyMode:
        ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
      VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
      EligibilitySourceType: EligibilitySourceTypeProto.OrganizationImportedRoster,
      EligibilityMutationPolicy: EligibilityMutationPolicyProto.FrozenAtOpen,
      OutcomeRule: thresholdElection.OutcomeRule,
      ApprovedClientApplications: [{ ApplicationId: 'hushsocial', Version: '1.0.0' }],
      ProtocolOmegaVersion: 'omega-v1.0.0',
      ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
      ReviewWindowPolicy: ReviewWindowPolicyProto.GovernedReviewWindowReserved,
      RequiredApprovalCount: 3,
    };

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Draft, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    electionsServiceMock.getElection
      .mockResolvedValueOnce(
        createElectionResponse({
          Election: thresholdElection,
          LatestDraftSnapshot: createDraftSnapshot({ Policy: thresholdPolicy }),
          TrusteeInvitations: [],
          CeremonyProfiles: [],
        })
      )
      .mockResolvedValue(
        createElectionResponse({
          Election: thresholdElection,
          LatestDraftSnapshot: createDraftSnapshot({ Policy: thresholdPolicy }),
          TrusteeInvitations: [],
          CeremonyProfiles: [],
        })
      );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />
    );

    expect(await screen.findByTestId('elections-trustee-user-address-input')).toBeInTheDocument();

    vi.useFakeTimers();

    fireEvent.change(screen.getByTestId('elections-trustee-user-address-input'), {
      target: { value: 'trustee-z' },
    });
    fireEvent.change(screen.getByTestId('elections-trustee-display-name-input'), {
      target: { value: 'Zoe Trustee' },
    });

    fireEvent.click(screen.getByTestId('elections-invite-trustee-button'));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('Trustee invitation submitted.')).toBeInTheDocument();
    expect(screen.getByText(/waiting for block confirmation/i)).toBeInTheDocument();
    expect(screen.getByTestId('elections-invite-trustee-button')).toBeDisabled();

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(screen.getByText('Trustee invitation submitted.')).toBeInTheDocument();
  });

  it('shows the trustee-threshold block and hides the open action', async () => {
    const trusteeDraft = createElectionRecord(ElectionLifecycleStateProto.Draft, {
      GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
      ReviewWindowPolicy: ReviewWindowPolicyProto.GovernedReviewWindowReserved,
      RequiredApprovalCount: 1,
      OutcomeRule: {
        Kind: OutcomeRuleKindProto.PassFail,
        TemplateKey: 'pass_fail_yes_no',
        SeatCount: 1,
        BlankVoteCountsForTurnout: true,
        BlankVoteExcludedFromWinnerSelection: true,
        BlankVoteExcludedFromThresholdDenominator: true,
        TieResolutionRule: 'tie_unresolved',
        CalculationBasis: 'simple_majority_of_non_blank_votes',
      },
    });

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Draft, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    electionsServiceMock.getElection.mockResolvedValueOnce(
      createElectionResponse({
        Election: trusteeDraft,
        LatestDraftSnapshot: createDraftSnapshot({
          Policy: {
            ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
            BindingStatus: ElectionBindingStatusProto.Binding,
            GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
            DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
            ParticipationPrivacyMode:
              ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
            VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
            EligibilitySourceType: EligibilitySourceTypeProto.OrganizationImportedRoster,
            EligibilityMutationPolicy: EligibilityMutationPolicyProto.FrozenAtOpen,
            OutcomeRule: trusteeDraft.OutcomeRule,
            ApprovedClientApplications: [{ ApplicationId: 'hushsocial', Version: '1.0.0' }],
            ProtocolOmegaVersion: 'omega-v1.0.0',
            ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
            ReviewWindowPolicy: ReviewWindowPolicyProto.GovernedReviewWindowReserved,
            RequiredApprovalCount: 1,
          },
        }),
        TrusteeInvitations: [
          {
            Id: 'invite-1',
            ElectionId: 'election-1',
            TrusteeUserAddress: 'trustee-a',
            TrusteeDisplayName: 'Alice',
            InvitedByPublicAddress: 'owner-public-key',
            LinkedMessageId: 'message-1',
            Status: ElectionTrusteeInvitationStatusProto.Accepted,
            SentAtDraftRevision: 1,
            SentAt: timestamp,
          },
        ],
      })
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />
    );

    expect(await screen.findByTestId('elections-trustee-blocked-panel')).toHaveTextContent(
      'FEAT-096'
    );
    expect(screen.queryByTestId('elections-open-button')).not.toBeInTheDocument();
  });

  it('shows the non-binding advisory for advisory elections', async () => {
    const advisoryElection = createElectionRecord(ElectionLifecycleStateProto.Draft, {
      BindingStatus: ElectionBindingStatusProto.NonBinding,
    });

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Draft, {
          BindingStatus: ElectionBindingStatusProto.NonBinding,
        }),
      ],
    });
    electionsServiceMock.getElection.mockResolvedValueOnce(
      createElectionResponse({
        Election: advisoryElection,
        LatestDraftSnapshot: createDraftSnapshot({
          Policy: {
            ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
            BindingStatus: ElectionBindingStatusProto.NonBinding,
            GovernanceMode: ElectionGovernanceModeProto.AdminOnly,
            DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
            ParticipationPrivacyMode:
              ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
            VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
            EligibilitySourceType: EligibilitySourceTypeProto.OrganizationImportedRoster,
            EligibilityMutationPolicy: EligibilityMutationPolicyProto.FrozenAtOpen,
            OutcomeRule: advisoryElection.OutcomeRule,
            ApprovedClientApplications: [{ ApplicationId: 'hushsocial', Version: '1.0.0' }],
            ProtocolOmegaVersion: 'omega-v1.0.0',
            ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
            ReviewWindowPolicy: ReviewWindowPolicyProto.NoReviewWindow,
          },
        }),
      })
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />
    );

    expect(await screen.findByTestId('elections-binding-advisory')).toHaveTextContent(
      'result is advisory'
    );
  });

  it('shows lifecycle controls and frozen policy for an open election', async () => {
    const openElection = createElectionRecord(ElectionLifecycleStateProto.Open, {
      OpenedAt: timestamp,
      OpenArtifactId: 'open-artifact',
    });

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [createElectionSummary(ElectionLifecycleStateProto.Open)],
    });
    electionsServiceMock.getElection.mockResolvedValueOnce(
      createElectionResponse({
        Election: openElection,
        WarningAcknowledgements: [
          {
            Id: 'warning-1',
            ElectionId: 'election-1',
            WarningCode: 0,
            DraftRevision: 1,
            AcknowledgedByPublicAddress: 'owner-public-key',
            AcknowledgedAt: timestamp,
          },
        ],
        BoundaryArtifacts: [
          {
            Id: 'open-artifact',
            ElectionId: 'election-1',
            ArtifactType: 0,
            LifecycleState: ElectionLifecycleStateProto.Open,
            SourceDraftRevision: 1,
            Metadata: {
              Title: 'Board Election',
              ShortDescription: '',
              OwnerPublicAddress: 'owner-public-key',
              ExternalReferenceCode: 'ORG-2026-01',
            },
            Policy: {
              ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
              BindingStatus: ElectionBindingStatusProto.Binding,
              GovernanceMode: ElectionGovernanceModeProto.AdminOnly,
              DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
              ParticipationPrivacyMode:
                ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
              VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
              EligibilitySourceType: EligibilitySourceTypeProto.OrganizationImportedRoster,
              EligibilityMutationPolicy: EligibilityMutationPolicyProto.FrozenAtOpen,
              OutcomeRule: openElection.OutcomeRule,
              ApprovedClientApplications: [{ ApplicationId: 'hushsocial', Version: '1.0.0' }],
              ProtocolOmegaVersion: 'omega-v1.0.0',
              ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
              ReviewWindowPolicy: ReviewWindowPolicyProto.NoReviewWindow,
            },
            Options: openElection.Options,
            AcknowledgedWarningCodes: [],
            FrozenEligibleVoterSetHash: 'frozen-hash',
            TrusteePolicyExecutionReference: '',
            ReportingPolicyExecutionReference: '',
            ReviewWindowExecutionReference: '',
            AcceptedBallotSetHash: '',
            FinalEncryptedTallyHash: '',
            RecordedAt: timestamp,
            RecordedByPublicAddress: 'owner-public-key',
          },
        ],
      })
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />
    );

    expect(await screen.findByTestId('elections-close-button')).toBeInTheDocument();
    expect(screen.getByTestId('elections-read-only-banner')).toHaveTextContent(
      'Draft editing is frozen after open'
    );
    expect(screen.getByTestId('elections-title-input')).toBeDisabled();
    expect(screen.getByTestId('elections-frozen-policy')).toHaveTextContent('Protocol Omega version');
    expect(screen.getByTestId('elections-warning-evidence')).toHaveTextContent('Low anonymity set');
    expect(screen.getByText('Boundary artifacts')).toBeInTheDocument();
  });

  it('opens an election through blockchain submission and waits for the open boundary readback', async () => {
    const draftElection = createElectionRecord(ElectionLifecycleStateProto.Draft, {
      AcknowledgedWarningCodes: [0],
    });
    const openElection = createElectionRecord(ElectionLifecycleStateProto.Open, {
      AcknowledgedWarningCodes: [0],
      OpenedAt: timestamp,
      OpenArtifactId: 'open-artifact',
    });

    electionsServiceMock.getElectionsByOwner
      .mockResolvedValueOnce({
        Elections: [createElectionSummary(ElectionLifecycleStateProto.Draft)],
      })
      .mockResolvedValueOnce({
        Elections: [createElectionSummary(ElectionLifecycleStateProto.Open)],
      });
    electionsServiceMock.getElection
      .mockResolvedValueOnce(
        createElectionResponse({
          Election: draftElection,
          LatestDraftSnapshot: createDraftSnapshot(),
          WarningAcknowledgements: [
            {
              Id: 'warning-1',
              ElectionId: 'election-1',
              WarningCode: 0,
              DraftRevision: 1,
              AcknowledgedByPublicAddress: 'owner-public-key',
              AcknowledgedAt: timestamp,
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        createElectionResponse({
          Election: openElection,
          LatestDraftSnapshot: createDraftSnapshot(),
        })
      )
      .mockResolvedValue(
        createElectionResponse({
          Election: openElection,
          LatestDraftSnapshot: createDraftSnapshot(),
        })
      );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />
    );

    fireEvent.click(await screen.findByTestId('elections-open-button'));

    expect(await screen.findByText('Election opened.')).toBeInTheDocument();
    expect(transactionServiceMock.createOpenElectionTransaction).toHaveBeenCalledWith(
      'election-1',
      'owner-public-key',
      'owner-encryption-key',
      'owner-encryption-private-key',
      expect.any(Array),
      null,
      '',
      '',
      '',
      'owner-private-key'
    );
    expect(blockchainServiceMock.submitTransaction).toHaveBeenCalledWith(
      'signed-open-election-transaction'
    );
    expect(electionsServiceMock.openElection).not.toHaveBeenCalled();
  });

  it('closes an election through blockchain submission and waits for the close boundary readback', async () => {
    const openElection = createElectionRecord(ElectionLifecycleStateProto.Open, {
      OpenedAt: timestamp,
      OpenArtifactId: 'open-artifact',
    });
    const closedElection = createElectionRecord(ElectionLifecycleStateProto.Closed, {
      OpenedAt: timestamp,
      ClosedAt: timestamp,
      OpenArtifactId: 'open-artifact',
      CloseArtifactId: 'close-artifact',
    });

    electionsServiceMock.getElectionsByOwner
      .mockResolvedValueOnce({
        Elections: [createElectionSummary(ElectionLifecycleStateProto.Open)],
      })
      .mockResolvedValueOnce({
        Elections: [createElectionSummary(ElectionLifecycleStateProto.Closed)],
      });
    electionsServiceMock.getElection
      .mockResolvedValueOnce(
        createElectionResponse({
          Election: openElection,
          BoundaryArtifacts: [],
        })
      )
      .mockResolvedValueOnce(
        createElectionResponse({
          Election: closedElection,
          BoundaryArtifacts: [],
        })
      )
      .mockResolvedValue(
        createElectionResponse({
          Election: closedElection,
          BoundaryArtifacts: [],
        })
      );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />
    );

    fireEvent.click(await screen.findByTestId('elections-close-button'));

    expect(await screen.findByText('Election closed.')).toBeInTheDocument();
    expect(transactionServiceMock.createCloseElectionTransaction).toHaveBeenCalledWith(
      'election-1',
      'owner-public-key',
      'owner-encryption-key',
      'owner-encryption-private-key',
      null,
      null,
      'owner-private-key'
    );
    expect(blockchainServiceMock.submitTransaction).toHaveBeenCalledWith(
      'signed-close-election-transaction'
    );
    expect(electionsServiceMock.closeElection).not.toHaveBeenCalled();
  });

  it('finalizes an election through blockchain submission and waits for the finalize boundary readback', async () => {
    const closedElection = createElectionRecord(ElectionLifecycleStateProto.Closed, {
      OpenedAt: timestamp,
      ClosedAt: timestamp,
      OpenArtifactId: 'open-artifact',
      CloseArtifactId: 'close-artifact',
      TallyReadyAt: timestamp,
    });
    const finalizedElection = createElectionRecord(ElectionLifecycleStateProto.Finalized, {
      OpenedAt: timestamp,
      ClosedAt: timestamp,
      FinalizedAt: timestamp,
      OpenArtifactId: 'open-artifact',
      CloseArtifactId: 'close-artifact',
      FinalizeArtifactId: 'finalize-artifact',
      TallyReadyAt: timestamp,
    });

    electionsServiceMock.getElectionsByOwner
      .mockResolvedValueOnce({
        Elections: [createElectionSummary(ElectionLifecycleStateProto.Closed)],
      })
      .mockResolvedValueOnce({
        Elections: [createElectionSummary(ElectionLifecycleStateProto.Finalized)],
      });
    electionsServiceMock.getElection
      .mockResolvedValueOnce(
        createElectionResponse({
          Election: closedElection,
          BoundaryArtifacts: [],
        })
      )
      .mockResolvedValueOnce(
        createElectionResponse({
          Election: finalizedElection,
          BoundaryArtifacts: [],
        })
      )
      .mockResolvedValue(
        createElectionResponse({
          Election: finalizedElection,
          BoundaryArtifacts: [],
        })
      );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />
    );

    fireEvent.click(await screen.findByTestId('elections-finalize-button'));

    expect(await screen.findByText('Election finalized.')).toBeInTheDocument();
    expect(transactionServiceMock.createFinalizeElectionTransaction).toHaveBeenCalledWith(
      'election-1',
      'owner-public-key',
      'owner-encryption-key',
      'owner-encryption-private-key',
      null,
      null,
      'owner-private-key'
    );
    expect(blockchainServiceMock.submitTransaction).toHaveBeenCalledWith(
      'signed-finalize-election-transaction'
    );
    expect(electionsServiceMock.finalizeElection).not.toHaveBeenCalled();
  });

  it('starts a governed close proposal through blockchain submission and waits for the indexed proposal', async () => {
    const openThresholdElection = createElectionRecord(ElectionLifecycleStateProto.Open, {
      GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
      ReviewWindowPolicy: ReviewWindowPolicyProto.GovernedReviewWindowReserved,
      RequiredApprovalCount: 3,
      OpenArtifactId: 'open-artifact',
    });
    const indexedProposal = {
      Id: 'proposal-1',
      ElectionId: 'election-1',
      ActionType: ElectionGovernedActionTypeProto.Close,
      LifecycleStateAtCreation: ElectionLifecycleStateProto.Open,
      ProposedByPublicAddress: 'owner-public-key',
      CreatedAt: timestamp,
      ExecutionStatus: ElectionGovernedProposalExecutionStatusProto.WaitingForApprovals,
      ExecutionFailureReason: '',
      LastExecutionTriggeredByPublicAddress: '',
    };

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Open, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    electionsServiceMock.getElection
      .mockResolvedValueOnce(
        createElectionResponse({
          Election: openThresholdElection,
          GovernedProposals: [],
        })
      )
      .mockResolvedValue(
        createElectionResponse({
          Election: {
            ...openThresholdElection,
            VoteAcceptanceLockedAt: timestamp,
          },
          GovernedProposals: [indexedProposal],
        })
      );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />
    );

    expect(await screen.findByTestId('elections-governed-actions')).toBeInTheDocument();
    fireEvent.click(
      screen.getByTestId(`elections-governed-start-${ElectionGovernedActionTypeProto.Close}`)
    );

    await waitFor(() => {
      expect(transactionServiceMock.createStartElectionGovernedProposalTransaction).toHaveBeenCalledWith(
        'election-1',
        ElectionGovernedActionTypeProto.Close,
        'owner-public-key',
        'owner-encryption-key',
        'owner-encryption-private-key',
        'owner-private-key'
      );
    });
    expect(blockchainServiceMock.submitTransaction).toHaveBeenCalledWith(
      'signed-start-governed-proposal-transaction'
    );
    expect(electionsServiceMock.startElectionGovernedProposal).not.toHaveBeenCalled();
  });

  it('retries a failed governed proposal through blockchain submission and waits for the execution update', async () => {
    const openThresholdElection = createElectionRecord(ElectionLifecycleStateProto.Open, {
      GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
      ReviewWindowPolicy: ReviewWindowPolicyProto.GovernedReviewWindowReserved,
      RequiredApprovalCount: 3,
      OpenArtifactId: 'open-artifact',
    });
    const failedProposal = {
      Id: 'proposal-1',
      ElectionId: 'election-1',
      ActionType: ElectionGovernedActionTypeProto.Close,
      LifecycleStateAtCreation: ElectionLifecycleStateProto.Open,
      ProposedByPublicAddress: 'owner-public-key',
      CreatedAt: timestamp,
      ExecutionStatus: ElectionGovernedProposalExecutionStatusProto.ExecutionFailed,
      ExecutionFailureReason: 'The election was not open during the first attempt.',
      LastExecutionTriggeredByPublicAddress: 'trustee-a',
      LastExecutionAttemptedAt: timestamp,
    };
    const succeededProposal = {
      ...failedProposal,
      ExecutionStatus: ElectionGovernedProposalExecutionStatusProto.ExecutionSucceeded,
      ExecutionFailureReason: '',
      ExecutedAt: { seconds: timestamp.seconds + 60, nanos: 0 },
      LastExecutionAttemptedAt: { seconds: timestamp.seconds + 60, nanos: 0 },
      LastExecutionTriggeredByPublicAddress: 'owner-public-key',
    };

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Open, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    electionsServiceMock.getElection
      .mockResolvedValueOnce(
        createElectionResponse({
          Election: openThresholdElection,
          GovernedProposals: [failedProposal],
        })
      )
      .mockResolvedValue(
        createElectionResponse({
          Election: {
            ...openThresholdElection,
            LifecycleState: ElectionLifecycleStateProto.Closed,
            ClosedAt: timestamp,
            CloseArtifactId: 'close-artifact',
          },
          GovernedProposals: [succeededProposal],
        })
      );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />
    );

    expect(await screen.findByTestId('elections-governed-actions')).toBeInTheDocument();
    fireEvent.click(
      screen.getByTestId(`elections-governed-retry-${ElectionGovernedActionTypeProto.Close}`)
    );

    await waitFor(() => {
      expect(transactionServiceMock.createRetryElectionGovernedProposalExecutionTransaction).toHaveBeenCalledWith(
        'election-1',
        'proposal-1',
        'owner-public-key',
        'owner-encryption-key',
        'owner-encryption-private-key',
        'owner-private-key'
      );
    });
    expect(blockchainServiceMock.submitTransaction).toHaveBeenCalledWith(
      'signed-retry-governed-proposal-transaction'
    );
    expect(electionsServiceMock.retryElectionGovernedProposalExecution).not.toHaveBeenCalled();
  });

  it('surfaces unsupported FEAT-094 values from an existing draft', async () => {
    const unsupportedElection = createElectionRecord(ElectionLifecycleStateProto.Draft, {
      VoteUpdatePolicy: VoteUpdatePolicyProto.LatestValidVoteWins,
      DisclosureMode: ElectionDisclosureModeProto.SeparatedParticipationAndResultReports,
    });

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [createElectionSummary(ElectionLifecycleStateProto.Draft)],
    });
    electionsServiceMock.getElection.mockResolvedValueOnce(
      createElectionResponse({
        Election: unsupportedElection,
        LatestDraftSnapshot: createDraftSnapshot({
          Policy: {
            ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
            BindingStatus: ElectionBindingStatusProto.Binding,
            GovernanceMode: ElectionGovernanceModeProto.AdminOnly,
            DisclosureMode: ElectionDisclosureModeProto.SeparatedParticipationAndResultReports,
            ParticipationPrivacyMode:
              ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
            VoteUpdatePolicy: VoteUpdatePolicyProto.LatestValidVoteWins,
            EligibilitySourceType: EligibilitySourceTypeProto.OrganizationImportedRoster,
            EligibilityMutationPolicy: EligibilityMutationPolicyProto.FrozenAtOpen,
            OutcomeRule: unsupportedElection.OutcomeRule,
            ApprovedClientApplications: [{ ApplicationId: 'hushsocial', Version: '1.0.0' }],
            ProtocolOmegaVersion: 'omega-v1.0.0',
            ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
            ReviewWindowPolicy: ReviewWindowPolicyProto.NoReviewWindow,
          },
        }),
      })
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerSigningPrivateKey="owner-private-key"
      />
    );

    const unsupportedPanel = await screen.findByTestId('elections-unsupported-panel');
    expect(unsupportedPanel).toHaveTextContent('final-results-only disclosure mode');
    expect(unsupportedPanel).toHaveTextContent('single-submission-only vote update policy');
    await waitFor(() => {
      expect(screen.queryByTestId('elections-open-button')).not.toBeInTheDocument();
    });
  });

  it('starts a trustee-threshold ceremony version from the owner workspace', async () => {
    const thresholdElection = createElectionRecord(ElectionLifecycleStateProto.Draft, {
      GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
      ReviewWindowPolicy: ReviewWindowPolicyProto.GovernedReviewWindowReserved,
      RequiredApprovalCount: 3,
    });

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Draft, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    const initialElectionResponse = createElectionResponse({
        Election: thresholdElection,
        LatestDraftSnapshot: createDraftSnapshot({
          Policy: {
            ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
            BindingStatus: ElectionBindingStatusProto.Binding,
            GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
            DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
            ParticipationPrivacyMode:
              ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
            VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
            EligibilitySourceType: EligibilitySourceTypeProto.OrganizationImportedRoster,
            EligibilityMutationPolicy: EligibilityMutationPolicyProto.FrozenAtOpen,
            OutcomeRule: thresholdElection.OutcomeRule,
            ApprovedClientApplications: [{ ApplicationId: 'hushsocial', Version: '1.0.0' }],
            ProtocolOmegaVersion: 'omega-v1.0.0',
            ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
            ReviewWindowPolicy: ReviewWindowPolicyProto.GovernedReviewWindowReserved,
            RequiredApprovalCount: 3,
          },
        }),
        TrusteeInvitations: [
          {
            Id: 'invite-1',
            ElectionId: 'election-1',
            TrusteeUserAddress: 'trustee-a',
            TrusteeDisplayName: 'Alice Trustee',
            InvitedByPublicAddress: 'owner-public-key',
            LinkedMessageId: 'message-1',
            Status: ElectionTrusteeInvitationStatusProto.Accepted,
            SentAtDraftRevision: 1,
            SentAt: timestamp,
          },
          {
            Id: 'invite-2',
            ElectionId: 'election-1',
            TrusteeUserAddress: 'trustee-b',
            TrusteeDisplayName: 'Bob Trustee',
            InvitedByPublicAddress: 'owner-public-key',
            LinkedMessageId: 'message-2',
            Status: ElectionTrusteeInvitationStatusProto.Accepted,
            SentAtDraftRevision: 1,
            SentAt: timestamp,
          },
        ],
        CeremonyProfiles: [
          {
            ProfileId: 'prod-3of5-v1',
            DisplayName: 'Production 3 of 5',
            Description: 'Production rollout profile',
            ProviderKey: 'provider-a',
            ProfileVersion: 'v1',
            TrusteeCount: 5,
            RequiredApprovalCount: 3,
            DevOnly: false,
            RegisteredAt: timestamp,
            LastUpdatedAt: timestamp,
          },
        ],
      });
    const indexedElectionResponse = createElectionResponse({
      ...initialElectionResponse,
      CeremonyVersions: [
        {
          Id: 'ceremony-version-1',
          ElectionId: 'election-1',
          VersionNumber: 1,
          ProfileId: 'prod-3of5-v1',
          Status: ElectionCeremonyVersionStatusProto.CeremonyVersionInProgress,
          TrusteeCount: 5,
          RequiredApprovalCount: 3,
          BoundTrustees: [
            {
              TrusteeUserAddress: 'trustee-a',
              TrusteeDisplayName: 'Alice Trustee',
            },
            {
              TrusteeUserAddress: 'trustee-b',
              TrusteeDisplayName: 'Bob Trustee',
            },
          ],
          StartedByPublicAddress: 'owner-public-key',
          StartedAt: timestamp,
          SupersededReason: '',
          TallyPublicKeyFingerprint: '',
        },
      ],
    });
    electionsServiceMock.getElection
      .mockResolvedValueOnce(initialElectionResponse)
      .mockResolvedValueOnce(indexedElectionResponse)
      .mockResolvedValue(indexedElectionResponse);
    electionsServiceMock.getElectionCeremonyActionView.mockResolvedValue(
      createCeremonyActionViewResponse()
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />
    );

    expect(await screen.findByTestId('elections-ceremony-section')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('elections-ceremony-start-button'));
    expect(await screen.findByTestId('elections-ceremony-confirm-button')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('elections-ceremony-confirm-button'));

    await waitFor(() => {
      expect(transactionServiceMock.createStartElectionCeremonyTransaction).toHaveBeenCalledWith(
        'election-1',
        'owner-public-key',
        'owner-encryption-key',
        'owner-encryption-private-key',
        'prod-3of5-v1',
        'owner-private-key'
      );
    });
  });

  it('shows the weak-trustee warning and keeps trustee-only controls out of the owner workspace', async () => {
    const thresholdElection = createElectionRecord(ElectionLifecycleStateProto.Draft, {
      GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
      ReviewWindowPolicy: ReviewWindowPolicyProto.GovernedReviewWindowReserved,
      RequiredApprovalCount: 3,
    });

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Draft, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    electionsServiceMock.getElection.mockResolvedValue(
      createElectionResponse({
        Election: thresholdElection,
        LatestDraftSnapshot: createDraftSnapshot({
          Policy: {
            ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
            BindingStatus: ElectionBindingStatusProto.Binding,
            GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
            DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
            ParticipationPrivacyMode:
              ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
            VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
            EligibilitySourceType: EligibilitySourceTypeProto.OrganizationImportedRoster,
            EligibilityMutationPolicy: EligibilityMutationPolicyProto.FrozenAtOpen,
            OutcomeRule: thresholdElection.OutcomeRule,
            ApprovedClientApplications: [{ ApplicationId: 'hushsocial', Version: '1.0.0' }],
            ProtocolOmegaVersion: 'omega-v1.0.0',
            ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
            ReviewWindowPolicy: ReviewWindowPolicyProto.GovernedReviewWindowReserved,
            RequiredApprovalCount: 3,
          },
        }),
        TrusteeInvitations: [
          {
            Id: 'invite-1',
            ElectionId: 'election-1',
            TrusteeUserAddress: 'trustee-a',
            TrusteeDisplayName: 'Alice Trustee',
            InvitedByPublicAddress: 'owner-public-key',
            LinkedMessageId: 'message-1',
            Status: ElectionTrusteeInvitationStatusProto.Accepted,
            SentAtDraftRevision: 1,
            SentAt: timestamp,
          },
          {
            Id: 'invite-2',
            ElectionId: 'election-1',
            TrusteeUserAddress: 'trustee-b',
            TrusteeDisplayName: 'Bob Trustee',
            InvitedByPublicAddress: 'owner-public-key',
            LinkedMessageId: 'message-2',
            Status: ElectionTrusteeInvitationStatusProto.Accepted,
            SentAtDraftRevision: 1,
            SentAt: timestamp,
          },
          {
            Id: 'invite-3',
            ElectionId: 'election-1',
            TrusteeUserAddress: 'trustee-c',
            TrusteeDisplayName: 'Charlie Trustee',
            InvitedByPublicAddress: 'owner-public-key',
            LinkedMessageId: 'message-3',
            Status: ElectionTrusteeInvitationStatusProto.Accepted,
            SentAtDraftRevision: 1,
            SentAt: timestamp,
          },
        ],
        CeremonyProfiles: [
          {
            ProfileId: 'prod-3of5-v1',
            DisplayName: 'Production 3 of 5',
            Description: 'Production rollout profile',
            ProviderKey: 'provider-a',
            ProfileVersion: 'v1',
            TrusteeCount: 5,
            RequiredApprovalCount: 3,
            DevOnly: false,
            RegisteredAt: timestamp,
            LastUpdatedAt: timestamp,
          },
        ],
      })
    );
    electionsServiceMock.getElectionCeremonyActionView.mockResolvedValue(
      createCeremonyActionViewResponse()
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerSigningPrivateKey="owner-private-key"
      />
    );

    expect(await screen.findByTestId('elections-ceremony-warning-card')).toHaveTextContent(
      'Opening can still proceed when the ceremony is ready'
    );
    expect(screen.queryByTestId('trustee-ceremony-export-button')).not.toBeInTheDocument();
    expect(screen.queryByText('Record share export')).not.toBeInTheDocument();
  });

  it('requires explicit confirmation before restarting a ceremony version', async () => {
    const thresholdElection = createElectionRecord(ElectionLifecycleStateProto.Draft, {
      GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
      ReviewWindowPolicy: ReviewWindowPolicyProto.GovernedReviewWindowReserved,
      RequiredApprovalCount: 3,
    });

    electionsServiceMock.getElectionsByOwner.mockResolvedValueOnce({
      Elections: [
        createElectionSummary(ElectionLifecycleStateProto.Draft, {
          GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
        }),
      ],
    });
    const initialElectionResponse = createElectionResponse({
        Election: thresholdElection,
        LatestDraftSnapshot: createDraftSnapshot({
          Policy: {
            ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
            BindingStatus: ElectionBindingStatusProto.Binding,
            GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
            DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
            ParticipationPrivacyMode:
              ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
            VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
            EligibilitySourceType: EligibilitySourceTypeProto.OrganizationImportedRoster,
            EligibilityMutationPolicy: EligibilityMutationPolicyProto.FrozenAtOpen,
            OutcomeRule: thresholdElection.OutcomeRule,
            ApprovedClientApplications: [{ ApplicationId: 'hushsocial', Version: '1.0.0' }],
            ProtocolOmegaVersion: 'omega-v1.0.0',
            ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
            ReviewWindowPolicy: ReviewWindowPolicyProto.GovernedReviewWindowReserved,
            RequiredApprovalCount: 3,
          },
        }),
        CeremonyProfiles: [
          {
            ProfileId: 'prod-3of5-v1',
            DisplayName: 'Production 3 of 5',
            Description: 'Production rollout profile',
            ProviderKey: 'provider-a',
            ProfileVersion: 'v1',
            TrusteeCount: 5,
            RequiredApprovalCount: 3,
            DevOnly: false,
            RegisteredAt: timestamp,
            LastUpdatedAt: timestamp,
          },
        ],
        CeremonyVersions: [
          {
            Id: 'ceremony-version-1',
            ElectionId: 'election-1',
            VersionNumber: 4,
            ProfileId: 'prod-3of5-v1',
            Status: ElectionCeremonyVersionStatusProto.CeremonyVersionInProgress,
            TrusteeCount: 5,
            RequiredApprovalCount: 3,
            BoundTrustees: [],
            StartedByPublicAddress: 'owner-public-key',
            StartedAt: timestamp,
            SupersededReason: '',
            TallyPublicKeyFingerprint: '',
          },
        ],
        ActiveCeremonyTrusteeStates: [
          createCeremonyTrusteeState(),
        ],
      });
    const indexedElectionResponse = createElectionResponse({
      ...initialElectionResponse,
      CeremonyVersions: [
        {
          Id: 'ceremony-version-2',
          ElectionId: 'election-1',
          VersionNumber: 5,
          ProfileId: 'prod-3of5-v1',
          Status: ElectionCeremonyVersionStatusProto.CeremonyVersionInProgress,
          TrusteeCount: 5,
          RequiredApprovalCount: 3,
          BoundTrustees: [],
          StartedByPublicAddress: 'owner-public-key',
          StartedAt: timestamp,
          SupersededReason: '',
          TallyPublicKeyFingerprint: '',
        },
      ],
      ActiveCeremonyTrusteeStates: [],
    });
    electionsServiceMock.getElection
      .mockResolvedValueOnce(initialElectionResponse)
      .mockResolvedValueOnce(indexedElectionResponse)
      .mockResolvedValue(indexedElectionResponse);
    electionsServiceMock.getElectionCeremonyActionView.mockResolvedValue(
      createCeremonyActionViewResponse({
        OwnerActions: [
          {
            ActionType: ElectionCeremonyActionTypeProto.CeremonyActionStartVersion,
            IsAvailable: false,
            IsCompleted: false,
            Reason: 'An active version already exists.',
          },
          {
            ActionType: ElectionCeremonyActionTypeProto.CeremonyActionRestartVersion,
            IsAvailable: true,
            IsCompleted: false,
            Reason: 'Supersede the current progress and restart.',
          },
        ],
      })
    );

    render(
      <ElectionsWorkspace
        ownerPublicAddress="owner-public-key"
        ownerEncryptionPublicKey="owner-encryption-key"
        ownerEncryptionPrivateKey="owner-encryption-private-key"
        ownerSigningPrivateKey="owner-private-key"
      />
    );

    expect(await screen.findByTestId('elections-ceremony-section')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('elections-ceremony-restart-button'));

    expect(screen.getByTestId('elections-ceremony-restart-reason')).toBeInTheDocument();
    expect(transactionServiceMock.createRestartElectionCeremonyTransaction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('elections-ceremony-confirm-button'));

    await waitFor(() => {
      expect(transactionServiceMock.createRestartElectionCeremonyTransaction).toHaveBeenCalledWith(
        'election-1',
        'owner-public-key',
        'owner-encryption-key',
        'owner-encryption-private-key',
        'prod-3of5-v1',
        'Supersede the current version and restart.',
        'owner-private-key'
      );
    });
  });
});
