import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ElectionCeremonyShareCustody,
  ElectionCeremonyTrusteeState,
  ElectionRecordView,
  GetElectionCeremonyActionViewResponse,
  GetElectionResponse,
} from '@/lib/grpc';
import {
  ElectionCeremonyActionTypeProto,
  ElectionCeremonyActorRoleProto,
  ElectionCeremonyShareCustodyStatusProto,
  ElectionCeremonyVersionStatusProto,
  ElectionBindingStatusProto,
  ElectionClassProto,
  ElectionDisclosureModeProto,
  ElectionGovernanceModeProto,
  ElectionLifecycleStateProto,
  ElectionTrusteeCeremonyStateProto,
  EligibilityMutationPolicyProto,
  EligibilitySourceTypeProto,
  OutcomeRuleKindProto,
  ParticipationPrivacyModeProto,
  ReportingPolicyProto,
  ReviewWindowPolicyProto,
  VoteUpdatePolicyProto,
} from '@/lib/grpc';
import { TrusteeElectionCeremonyPanel } from './TrusteeElectionCeremonyPanel';
import { useElectionsStore } from './useElectionsStore';

const { electionsServiceMock, blockchainServiceMock, transactionServiceMock } = vi.hoisted(() => ({
  electionsServiceMock: {
    getElection: vi.fn(),
    getElectionCeremonyActionView: vi.fn(),
  },
  blockchainServiceMock: {
    submitTransaction: vi.fn(),
  },
  transactionServiceMock: {
    createAcceptElectionTrusteeInvitationTransaction: vi.fn(),
    createApproveElectionGovernedProposalTransaction: vi.fn(),
    createCloseElectionTransaction: vi.fn(),
    createCompleteElectionCeremonyTrusteeTransaction: vi.fn(),
    createElectionDraftTransaction: vi.fn(),
    createElectionTrusteeInvitationTransaction: vi.fn(),
    createFinalizeElectionTransaction: vi.fn(),
    createJoinElectionCeremonyTransaction: vi.fn(),
    createOpenElectionTransaction: vi.fn(),
    createPublishElectionCeremonyTransportKeyTransaction: vi.fn(),
    createRecordElectionCeremonySelfTestSuccessTransaction: vi.fn(),
    createRecordElectionCeremonyShareExportTransaction: vi.fn(),
    createRecordElectionCeremonyShareImportTransaction: vi.fn(),
    createRecordElectionCeremonyValidationFailureTransaction: vi.fn(),
    createRejectElectionTrusteeInvitationTransaction: vi.fn(),
    createRestartElectionCeremonyTransaction: vi.fn(),
    createRetryElectionGovernedProposalExecutionTransaction: vi.fn(),
    createRevokeElectionTrusteeInvitationTransaction: vi.fn(),
    createStartElectionCeremonyTransaction: vi.fn(),
    createStartElectionGovernedProposalTransaction: vi.fn(),
    createSubmitElectionFinalizationShareTransaction: vi.fn(),
    createSubmitElectionCeremonyMaterialTransaction: vi.fn(),
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
  createAcceptElectionTrusteeInvitationTransaction: (...args: unknown[]) =>
    transactionServiceMock.createAcceptElectionTrusteeInvitationTransaction(...args),
  createApproveElectionGovernedProposalTransaction: (...args: unknown[]) =>
    transactionServiceMock.createApproveElectionGovernedProposalTransaction(...args),
  createCloseElectionTransaction: (...args: unknown[]) =>
    transactionServiceMock.createCloseElectionTransaction(...args),
  createCompleteElectionCeremonyTrusteeTransaction: (...args: unknown[]) =>
    transactionServiceMock.createCompleteElectionCeremonyTrusteeTransaction(...args),
  createElectionDraftTransaction: (...args: unknown[]) =>
    transactionServiceMock.createElectionDraftTransaction(...args),
  createElectionTrusteeInvitationTransaction: (...args: unknown[]) =>
    transactionServiceMock.createElectionTrusteeInvitationTransaction(...args),
  createFinalizeElectionTransaction: (...args: unknown[]) =>
    transactionServiceMock.createFinalizeElectionTransaction(...args),
  createJoinElectionCeremonyTransaction: (...args: unknown[]) =>
    transactionServiceMock.createJoinElectionCeremonyTransaction(...args),
  createOpenElectionTransaction: (...args: unknown[]) =>
    transactionServiceMock.createOpenElectionTransaction(...args),
  createPublishElectionCeremonyTransportKeyTransaction: (...args: unknown[]) =>
    transactionServiceMock.createPublishElectionCeremonyTransportKeyTransaction(...args),
  createRecordElectionCeremonySelfTestSuccessTransaction: (...args: unknown[]) =>
    transactionServiceMock.createRecordElectionCeremonySelfTestSuccessTransaction(...args),
  createRecordElectionCeremonyShareExportTransaction: (...args: unknown[]) =>
    transactionServiceMock.createRecordElectionCeremonyShareExportTransaction(...args),
  createRecordElectionCeremonyShareImportTransaction: (...args: unknown[]) =>
    transactionServiceMock.createRecordElectionCeremonyShareImportTransaction(...args),
  createRecordElectionCeremonyValidationFailureTransaction: (...args: unknown[]) =>
    transactionServiceMock.createRecordElectionCeremonyValidationFailureTransaction(...args),
  createRejectElectionTrusteeInvitationTransaction: (...args: unknown[]) =>
    transactionServiceMock.createRejectElectionTrusteeInvitationTransaction(...args),
  createRestartElectionCeremonyTransaction: (...args: unknown[]) =>
    transactionServiceMock.createRestartElectionCeremonyTransaction(...args),
  createRetryElectionGovernedProposalExecutionTransaction: (...args: unknown[]) =>
    transactionServiceMock.createRetryElectionGovernedProposalExecutionTransaction(...args),
  createRevokeElectionTrusteeInvitationTransaction: (...args: unknown[]) =>
    transactionServiceMock.createRevokeElectionTrusteeInvitationTransaction(...args),
  createStartElectionCeremonyTransaction: (...args: unknown[]) =>
    transactionServiceMock.createStartElectionCeremonyTransaction(...args),
  createStartElectionGovernedProposalTransaction: (...args: unknown[]) =>
    transactionServiceMock.createStartElectionGovernedProposalTransaction(...args),
  createSubmitElectionFinalizationShareTransaction: (...args: unknown[]) =>
    transactionServiceMock.createSubmitElectionFinalizationShareTransaction(...args),
  createSubmitElectionCeremonyMaterialTransaction: (...args: unknown[]) =>
    transactionServiceMock.createSubmitElectionCeremonyMaterialTransaction(...args),
  createUpdateElectionDraftTransaction: (...args: unknown[]) =>
    transactionServiceMock.createUpdateElectionDraftTransaction(...args),
}));

const timestamp = { seconds: 1_711_410_000, nanos: 0 };

function createElectionRecord(overrides?: Partial<ElectionRecordView>): ElectionRecordView {
  return {
    ElectionId: 'election-1',
    Title: 'Governed Referendum',
    ShortDescription: 'Policy vote',
    OwnerPublicAddress: 'owner-public-key',
    ExternalReferenceCode: 'REF-2026-01',
    LifecycleState: ElectionLifecycleStateProto.Draft,
    ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
    BindingStatus: ElectionBindingStatusProto.Binding,
    GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
    DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
    ParticipationPrivacyMode:
      ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
    VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
    EligibilitySourceType: EligibilitySourceTypeProto.OrganizationImportedRoster,
    EligibilityMutationPolicy: EligibilityMutationPolicyProto.FrozenAtOpen,
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
    ApprovedClientApplications: [{ ApplicationId: 'hushsocial', Version: '1.0.0' }],
    ProtocolOmegaVersion: 'omega-v1.0.0',
    ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
    ReviewWindowPolicy: ReviewWindowPolicyProto.GovernedReviewWindowReserved,
    CurrentDraftRevision: 1,
    Options: [
      {
        OptionId: 'yes',
        DisplayLabel: 'Yes',
        ShortDescription: '',
        BallotOrder: 1,
        IsBlankOption: false,
      },
      {
        OptionId: 'no',
        DisplayLabel: 'No',
        ShortDescription: '',
        BallotOrder: 2,
        IsBlankOption: false,
      },
    ],
    AcknowledgedWarningCodes: [],
    RequiredApprovalCount: 3,
    CreatedAt: timestamp,
    LastUpdatedAt: timestamp,
    OpenArtifactId: '',
    CloseArtifactId: '',
    FinalizeArtifactId: '',
    ...overrides,
  };
}

function createElectionResponse(overrides?: Partial<GetElectionResponse>): GetElectionResponse {
  return {
    Success: true,
    ErrorMessage: '',
    Election: createElectionRecord(),
    WarningAcknowledgements: [],
    TrusteeInvitations: [],
    BoundaryArtifacts: [],
    GovernedProposals: [],
    GovernedProposalApprovals: [],
    CeremonyProfiles: [],
    CeremonyVersions: [
      {
        Id: 'ceremony-version-1',
        ElectionId: 'election-1',
        VersionNumber: 4,
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
    CeremonyTranscriptEvents: [
      {
        Id: 'event-1',
        ElectionId: 'election-1',
        CeremonyVersionId: 'ceremony-version-1',
        VersionNumber: 4,
        EventType: 0,
        ActorPublicAddress: 'owner-public-key',
        TrusteeUserAddress: '',
        TrusteeDisplayName: '',
        TrusteeState: ElectionTrusteeCeremonyStateProto.CeremonyStateNotStarted,
        EventSummary: 'Owner started the ceremony version.',
        EvidenceReference: '',
        RestartReason: '',
        TallyPublicKeyFingerprint: '',
        OccurredAt: timestamp,
        HasTrusteeState: false,
      },
    ],
    ActiveCeremonyTrusteeStates: [],
    ...overrides,
  };
}

function createCeremonyTrusteeState(
  overrides?: Partial<ElectionCeremonyTrusteeState>
): ElectionCeremonyTrusteeState {
  return {
    Id: 'trustee-state-1',
    ElectionId: 'election-1',
    CeremonyVersionId: 'ceremony-version-1',
    TrusteeUserAddress: 'trustee-a',
    TrusteeDisplayName: 'Alice Trustee',
    State: ElectionTrusteeCeremonyStateProto.CeremonyStateJoined,
    TransportPublicKeyFingerprint: 'transport-key-fingerprint-v1',
    TransportPublicKeyPublishedAt: timestamp,
    JoinedAt: timestamp,
    ValidationFailureReason: '',
    ShareVersion: '',
    LastUpdatedAt: timestamp,
    ...overrides,
  };
}

function createShareCustody(
  overrides?: Partial<ElectionCeremonyShareCustody>
): ElectionCeremonyShareCustody {
  return {
    Id: 'share-custody-1',
    ElectionId: 'election-1',
    CeremonyVersionId: 'ceremony-version-1',
    TrusteeUserAddress: 'trustee-a',
    ShareVersion: 'share-v1',
    PasswordProtected: true,
    Status: ElectionCeremonyShareCustodyStatusProto.ShareCustodyNotExported,
    LastUpdatedAt: timestamp,
    ...overrides,
  };
}

function createActionViewResponse(
  overrides?: Partial<GetElectionCeremonyActionViewResponse>
): GetElectionCeremonyActionViewResponse {
  return {
    Success: true,
    ErrorMessage: '',
    ActorRole: ElectionCeremonyActorRoleProto.CeremonyActorTrustee,
    ActorPublicAddress: 'trustee-a',
    ActiveCeremonyVersion: {
      Id: 'ceremony-version-1',
      ElectionId: 'election-1',
      VersionNumber: 4,
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
    OwnerActions: [],
    TrusteeActions: [
      {
        ActionType: ElectionCeremonyActionTypeProto.CeremonyActionPublishTransportKey,
        IsAvailable: true,
        IsCompleted: false,
        Reason: 'Publish your transport key.',
      },
      {
        ActionType: ElectionCeremonyActionTypeProto.CeremonyActionJoinVersion,
        IsAvailable: false,
        IsCompleted: false,
        Reason: 'Publish the transport key first.',
      },
      {
        ActionType: ElectionCeremonyActionTypeProto.CeremonyActionRunSelfTest,
        IsAvailable: false,
        IsCompleted: false,
        Reason: 'Join the version first.',
      },
      {
        ActionType: ElectionCeremonyActionTypeProto.CeremonyActionSubmitMaterial,
        IsAvailable: false,
        IsCompleted: false,
        Reason: 'Run the self-test first.',
      },
      {
        ActionType: ElectionCeremonyActionTypeProto.CeremonyActionExportShare,
        IsAvailable: false,
        IsCompleted: false,
        Reason: 'Complete the ceremony first.',
      },
      {
        ActionType: ElectionCeremonyActionTypeProto.CeremonyActionImportShare,
        IsAvailable: false,
        IsCompleted: false,
        Reason: 'No encrypted backup is recorded yet.',
      },
    ],
    PendingIncomingMessageCount: 1,
    BlockedReasons: [],
    SelfTrusteeState: createCeremonyTrusteeState(),
    SelfShareCustody: createShareCustody(),
    ...overrides,
  };
}

describe('TrusteeElectionCeremonyPanel', () => {
  beforeEach(() => {
    useElectionsStore.getState().reset();
    vi.clearAllMocks();
    electionsServiceMock.getElection.mockResolvedValue(createElectionResponse());
    electionsServiceMock.getElectionCeremonyActionView.mockResolvedValue(createActionViewResponse());
    blockchainServiceMock.submitTransaction.mockResolvedValue({ successful: true, message: 'Accepted' });
    transactionServiceMock.createRecordElectionCeremonyShareExportTransaction.mockResolvedValue({
      signedTransaction: 'signed-share-export-transaction',
    });
  });

  it('renders the ordered trustee ceremony step flow', async () => {
    render(
      <TrusteeElectionCeremonyPanel
        electionId="election-1"
        actorPublicAddress="trustee-a"
        actorEncryptionPublicKey="trustee-encryption-key"
        actorEncryptionPrivateKey="trustee-encryption-private-key"
        actorSigningPrivateKey="trustee-signing-private-key"
      />
    );

    expect(await screen.findByTestId('trustee-ceremony-summary')).toHaveTextContent(
      'Governed Referendum'
    );
    expect(screen.getByTestId('trustee-ceremony-summary').className).not.toContain(
      'border-hush-bg-light'
    );
    expect(screen.getByTestId('trustee-ceremony-steps').className).not.toContain(
      'border-hush-bg-light'
    );
    expect(screen.getByTestId('trustee-ceremony-step-list').className).not.toContain(
      'border-hush-bg-light'
    );
    expect(screen.getByTestId('trustee-ceremony-step-workspace').className).not.toContain(
      'border-hush-bg-light'
    );
    expect(screen.getByTestId('trustee-ceremony-steps')).toHaveTextContent('Publish transport key');
    expect(screen.getByTestId('trustee-ceremony-steps')).toHaveTextContent('Join version');
    expect(screen.getByTestId('trustee-ceremony-steps')).toHaveTextContent('Run self-test');
    expect(screen.getByTestId('trustee-ceremony-steps')).toHaveTextContent('Submit material');
    expect(screen.getByTestId('trustee-ceremony-steps')).toHaveTextContent('Export share backup');
    expect(screen.getByTestId('trustee-ceremony-steps')).toHaveTextContent(
      'Mobile and desktop share the same task boundary.'
    );
  });

  it('keeps trustee-only authority and transcript privacy copy visible without owner controls', async () => {
    render(
      <TrusteeElectionCeremonyPanel
        electionId="election-1"
        actorPublicAddress="trustee-a"
        actorEncryptionPublicKey="trustee-encryption-key"
        actorEncryptionPrivateKey="trustee-encryption-private-key"
        actorSigningPrivateKey="trustee-signing-private-key"
      />
    );

    expect(await screen.findByTestId('trustee-ceremony-summary')).toHaveTextContent(
      'Governed Referendum'
    );
    expect(screen.getByText('Authority boundary')).toBeInTheDocument();
    expect(screen.getByTestId('ceremony-transcript-panel')).toHaveTextContent(
      'Secret payloads stay outside this view.'
    );
    expect(screen.getByTestId('ceremony-transcript-panel').className).not.toContain(
      'border-hush-bg-light'
    );
    expect(screen.queryByTestId('elections-ceremony-start-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('elections-ceremony-restart-button')).not.toBeInTheDocument();
  });

  it('shows validation-failed recovery guidance', async () => {
    electionsServiceMock.getElectionCeremonyActionView.mockResolvedValue(
      createActionViewResponse({
        TrusteeActions: [
          {
            ActionType: ElectionCeremonyActionTypeProto.CeremonyActionPublishTransportKey,
            IsAvailable: false,
            IsCompleted: true,
            Reason: 'Already published.',
          },
          {
            ActionType: ElectionCeremonyActionTypeProto.CeremonyActionJoinVersion,
            IsAvailable: false,
            IsCompleted: true,
            Reason: 'Already joined.',
          },
          {
            ActionType: ElectionCeremonyActionTypeProto.CeremonyActionRunSelfTest,
            IsAvailable: true,
            IsCompleted: false,
            Reason: 'Run the self-test again before resubmitting.',
          },
          {
            ActionType: ElectionCeremonyActionTypeProto.CeremonyActionSubmitMaterial,
            IsAvailable: false,
            IsCompleted: false,
            Reason: 'Fix the failed submission first.',
          },
          {
            ActionType: ElectionCeremonyActionTypeProto.CeremonyActionExportShare,
            IsAvailable: false,
            IsCompleted: false,
            Reason: 'Complete the ceremony first.',
          },
          {
            ActionType: ElectionCeremonyActionTypeProto.CeremonyActionImportShare,
            IsAvailable: false,
            IsCompleted: false,
            Reason: 'No encrypted backup is recorded yet.',
          },
        ],
        SelfTrusteeState: createCeremonyTrusteeState({
          State: ElectionTrusteeCeremonyStateProto.CeremonyStateValidationFailed,
          ValidationFailedAt: timestamp,
          ValidationFailureReason: 'Wrong version binding.',
        }),
      })
    );

    render(
      <TrusteeElectionCeremonyPanel
        electionId="election-1"
        actorPublicAddress="trustee-a"
        actorEncryptionPublicKey="trustee-encryption-key"
        actorEncryptionPrivateKey="trustee-encryption-private-key"
        actorSigningPrivateKey="trustee-signing-private-key"
      />
    );

    expect(await screen.findByTestId('trustee-ceremony-validation-failed')).toHaveTextContent(
      'Wrong version binding.'
    );
    expect(screen.getByTestId('trustee-ceremony-steps')).toHaveTextContent(
      'Run the self-test again before resubmitting.'
    );
  });

  it('shows completion and records the share export action', async () => {
    const initialActionViewResponse = createActionViewResponse({
        TrusteeActions: [
          {
            ActionType: ElectionCeremonyActionTypeProto.CeremonyActionPublishTransportKey,
            IsAvailable: false,
            IsCompleted: true,
            Reason: 'Already published.',
          },
          {
            ActionType: ElectionCeremonyActionTypeProto.CeremonyActionJoinVersion,
            IsAvailable: false,
            IsCompleted: true,
            Reason: 'Already joined.',
          },
          {
            ActionType: ElectionCeremonyActionTypeProto.CeremonyActionRunSelfTest,
            IsAvailable: false,
            IsCompleted: true,
            Reason: 'Already completed.',
          },
          {
            ActionType: ElectionCeremonyActionTypeProto.CeremonyActionSubmitMaterial,
            IsAvailable: false,
            IsCompleted: true,
            Reason: 'Already submitted.',
          },
          {
            ActionType: ElectionCeremonyActionTypeProto.CeremonyActionExportShare,
            IsAvailable: true,
            IsCompleted: false,
            Reason: 'Export the encrypted backup now.',
          },
          {
            ActionType: ElectionCeremonyActionTypeProto.CeremonyActionImportShare,
            IsAvailable: false,
            IsCompleted: false,
            Reason: 'Import is not needed right now.',
          },
        ],
        SelfTrusteeState: createCeremonyTrusteeState({
          State: ElectionTrusteeCeremonyStateProto.CeremonyStateCompleted,
          CompletedAt: timestamp,
          ShareVersion: 'share-v1',
        }),
        SelfShareCustody: createShareCustody({
          ShareVersion: 'share-v1',
          Status: ElectionCeremonyShareCustodyStatusProto.ShareCustodyNotExported,
        }),
      });
    const indexedActionViewResponse = createActionViewResponse({
      ...initialActionViewResponse,
      SelfShareCustody: createShareCustody({
        ShareVersion: 'share-v1',
        Status: ElectionCeremonyShareCustodyStatusProto.ShareCustodyExported,
        LastExportedAt: timestamp,
      }),
    });
    electionsServiceMock.getElectionCeremonyActionView
      .mockResolvedValueOnce(initialActionViewResponse)
      .mockResolvedValueOnce(indexedActionViewResponse)
      .mockResolvedValue(indexedActionViewResponse);

    render(
      <TrusteeElectionCeremonyPanel
        electionId="election-1"
        actorPublicAddress="trustee-a"
        actorEncryptionPublicKey="trustee-encryption-key"
        actorEncryptionPrivateKey="trustee-encryption-private-key"
        actorSigningPrivateKey="trustee-signing-private-key"
      />
    );

    expect(await screen.findByTestId('trustee-ceremony-summary')).toHaveTextContent('Completed');

    fireEvent.click(screen.getByTestId('trustee-ceremony-export-button'));

    await waitFor(() => {
      expect(transactionServiceMock.createRecordElectionCeremonyShareExportTransaction).toHaveBeenCalledWith(
        'election-1',
        'trustee-a',
        'trustee-encryption-key',
        'trustee-encryption-private-key',
        'ceremony-version-1',
        'share-v1',
        'trustee-signing-private-key'
      );
    });
  });
});
