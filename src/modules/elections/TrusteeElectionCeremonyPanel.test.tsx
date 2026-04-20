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
import { useAppStore } from '@/stores/useAppStore';
import { TrusteeElectionCeremonyPanel } from './TrusteeElectionCeremonyPanel';
import { useElectionsStore } from './useElectionsStore';

const { electionsServiceMock, blockchainServiceMock, transactionServiceMock, trusteeShareVaultMock } = vi.hoisted(() => ({
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
  trusteeShareVaultMock: {
    createTrusteeShareVaultEnvelope: vi.fn(),
    decryptStoredTrusteeShareVaultEnvelope: vi.fn(),
    deriveTrusteeCloseCountingPublicCommitment: vi.fn(),
    deriveTrusteeCloseCountingShareMaterial: vi.fn(),
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

vi.mock('./trusteeShareVault', () => ({
  createTrusteeShareVaultEnvelope: (...args: unknown[]) =>
    trusteeShareVaultMock.createTrusteeShareVaultEnvelope(...args),
  decryptStoredTrusteeShareVaultEnvelope: (...args: unknown[]) =>
    trusteeShareVaultMock.decryptStoredTrusteeShareVaultEnvelope(...args),
  deriveTrusteeCloseCountingPublicCommitment: (...args: unknown[]) =>
    trusteeShareVaultMock.deriveTrusteeCloseCountingPublicCommitment(...args),
  deriveTrusteeCloseCountingShareMaterial: (...args: unknown[]) =>
    trusteeShareVaultMock.deriveTrusteeCloseCountingShareMaterial(...args),
}));

const timestamp = { seconds: 1_711_410_000, nanos: 0 };
const trusteeMnemonic = [
  'abandon',
  'abandon',
  'abandon',
  'abandon',
  'abandon',
  'abandon',
  'abandon',
  'abandon',
  'abandon',
  'abandon',
  'abandon',
  'about',
];

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
    useAppStore.setState({
      credentials: {
        signingPublicKey: 'trustee-signing-public-key',
        signingPrivateKey: 'trustee-signing-private-key',
        encryptionPublicKey: 'trustee-encryption-key',
        encryptionPrivateKey: 'trustee-encryption-private-key',
        mnemonic: trusteeMnemonic,
      },
    });
    vi.clearAllMocks();
    electionsServiceMock.getElection.mockResolvedValue(createElectionResponse());
    electionsServiceMock.getElectionCeremonyActionView.mockResolvedValue(createActionViewResponse());
    blockchainServiceMock.submitTransaction.mockResolvedValue({ successful: true, message: 'Accepted' });
    trusteeShareVaultMock.createTrusteeShareVaultEnvelope.mockResolvedValue({
      messageType: 'trustee-share-vault-package',
      payloadVersion: 'omega-trustee-share-vault-v1',
      encryptedPayload: 'vault-ciphertext',
      payloadFingerprint: 'vault-fingerprint',
      shareVersion: 'share-kc004-prod-3of5-v1-trustee-a',
    });
    trusteeShareVaultMock.deriveTrusteeCloseCountingShareMaterial.mockResolvedValue({
      format: 'omega-controlled-threshold-scalar-v1',
      scalarMaterial: '123456789',
      scalarMaterialHash: 'abc123',
    });
    trusteeShareVaultMock.deriveTrusteeCloseCountingPublicCommitment.mockReturnValue({
      X: 'commitment-x',
      Y: 'commitment-y',
    });
    trusteeShareVaultMock.decryptStoredTrusteeShareVaultEnvelope.mockResolvedValue({
      packageVersion: 'omega-trustee-share-vault-inner-v1',
      materialKind: 'ceremony-package',
      electionId: 'election-1',
      ceremonyVersionId: 'ceremony-version-1',
      trusteeUserAddress: 'trustee-a',
      shareVersion: 'share-kc004-prod-3of5-v1-trustee-a',
      material: {
        packageKind: 'trustee-ceremony-package',
        ceremonyMessageType: 'dkg-share-package',
        ceremonyPayloadVersion: 'omega-v1.0.0',
        ceremonyPayloadFingerprint: 'vault-fingerprint',
        ceremonyEncryptedPayload: '{"packageKind":"trustee-ceremony-package"}',
        transportPublicKeyFingerprint: 'transport-kc004-prod-3of5-v1-trustee-a',
        protocolVersion: 'omega-v1.0.0',
        profileId: 'dkg-prod-3of5',
        versionNumber: 4,
        closeCountingShare: {
          format: 'omega-controlled-threshold-scalar-v1',
          scalarMaterial: '123456789',
          scalarMaterialHash: 'abc123',
        },
      },
    });
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
    expect(screen.getByTestId('trustee-ceremony-steps')).toHaveTextContent('Submit ceremony package');
    expect(screen.getByTestId('trustee-ceremony-steps')).toHaveTextContent('Export share backup');
    expect(screen.getByTestId('trustee-ceremony-steps')).toHaveTextContent(
      'One task stays in focus at a time.'
    );
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByTestId('trustee-ceremony-continue-button')).toBeInTheDocument();
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

  it('continues from validation failure through rerun self-test and resubmission with one click', async () => {
    const validationFailed = createActionViewResponse({
      TrusteeActions: [
        {
          ActionType: ElectionCeremonyActionTypeProto.CeremonyActionPublishTransportKey,
          IsAvailable: false,
          IsCompleted: true,
          Reason: 'Transport key already published.',
        },
        {
          ActionType: ElectionCeremonyActionTypeProto.CeremonyActionJoinVersion,
          IsAvailable: false,
          IsCompleted: true,
          Reason: 'You already joined the active ceremony version.',
        },
        {
          ActionType: ElectionCeremonyActionTypeProto.CeremonyActionRunSelfTest,
          IsAvailable: true,
          IsCompleted: false,
          Reason: 'Validation failed previously. Run the self-test again before resubmitting.',
        },
        {
          ActionType: ElectionCeremonyActionTypeProto.CeremonyActionSubmitMaterial,
          IsAvailable: false,
          IsCompleted: false,
          Reason: 'Run the mandatory self-test before submitting ceremony material.',
        },
        {
          ActionType: ElectionCeremonyActionTypeProto.CeremonyActionExportShare,
          IsAvailable: false,
          IsCompleted: false,
          Reason: 'Share export becomes available after ceremony completion.',
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
        ValidationFailureReason: 'Old package format rejected.',
        SelfTestSucceededAt: undefined,
        MaterialSubmittedAt: undefined,
        ShareVersion: '',
      }),
    });
    const selfTestRecovered = createActionViewResponse({
      ...validationFailed,
      TrusteeActions: validationFailed.TrusteeActions.map((action) => {
        if (action.ActionType === ElectionCeremonyActionTypeProto.CeremonyActionRunSelfTest) {
          return {
            ...action,
            IsAvailable: false,
            IsCompleted: true,
            Reason: 'Mandatory self-test already completed for this submission cycle.',
          };
        }
        if (action.ActionType === ElectionCeremonyActionTypeProto.CeremonyActionSubmitMaterial) {
          return {
            ...action,
            IsAvailable: true,
            IsCompleted: false,
            Reason: 'Submit ceremony material for validation.',
          };
        }
        return action;
      }),
      SelfTrusteeState: createCeremonyTrusteeState({
        State: ElectionTrusteeCeremonyStateProto.CeremonyStateJoined,
        SelfTestSucceededAt: timestamp,
        MaterialSubmittedAt: undefined,
        ValidationFailedAt: undefined,
        ValidationFailureReason: '',
        ShareVersion: '',
      }),
    });
    const resubmitted = createActionViewResponse({
      ...selfTestRecovered,
      TrusteeActions: selfTestRecovered.TrusteeActions.map((action) => {
        if (action.ActionType === ElectionCeremonyActionTypeProto.CeremonyActionSubmitMaterial) {
          return {
            ...action,
            IsAvailable: false,
            IsCompleted: true,
            Reason: 'Ceremony material already submitted for this version.',
          };
        }
        return action;
      }),
      SelfTrusteeState: createCeremonyTrusteeState({
        State: ElectionTrusteeCeremonyStateProto.CeremonyStateMaterialSubmitted,
        SelfTestSucceededAt: timestamp,
        MaterialSubmittedAt: timestamp,
        ValidationFailedAt: undefined,
        ValidationFailureReason: '',
        ShareVersion: 'share-kc004-prod-3of5-v1-trustee-a',
      }),
    });

    let actionViewCallCount = 0;
    electionsServiceMock.getElectionCeremonyActionView.mockImplementation(async () => {
      actionViewCallCount += 1;
      if (actionViewCallCount === 1) return validationFailed;
      if (actionViewCallCount <= 3) return selfTestRecovered;
      return resubmitted;
    });

    transactionServiceMock.createRecordElectionCeremonySelfTestSuccessTransaction.mockResolvedValue({
      signedTransaction: 'signed-rerun-self-test-transaction',
    });
    transactionServiceMock.createSubmitElectionCeremonyMaterialTransaction.mockResolvedValue({
      signedTransaction: 'signed-resubmit-transaction',
    });

    render(
      <TrusteeElectionCeremonyPanel
        electionId="election-1"
        actorPublicAddress="trustee-a"
        actorEncryptionPublicKey="trustee-encryption-key"
        actorEncryptionPrivateKey="trustee-encryption-private-key"
        actorSigningPrivateKey="trustee-signing-private-key"
      />
    );

    expect(await screen.findByTestId('trustee-ceremony-current-step')).toHaveTextContent(
      'Run self-test'
    );

    fireEvent.click(screen.getByTestId('trustee-ceremony-continue-button'));

    await waitFor(() => {
      expect(transactionServiceMock.createRecordElectionCeremonySelfTestSuccessTransaction).toHaveBeenCalledTimes(1);
      expect(transactionServiceMock.createSubmitElectionCeremonyMaterialTransaction).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByTestId('trustee-ceremony-current-step')).toHaveTextContent(
        'Awaiting owner validation'
      );
    });
  });

  it('submits a system-managed ceremony package without calling trustee completion', async () => {
    const initialActionViewResponse = createActionViewResponse({
      TrusteeActions: [
        {
          ActionType: ElectionCeremonyActionTypeProto.CeremonyActionPublishTransportKey,
          IsAvailable: false,
          IsCompleted: true,
          Reason: 'Transport key already published.',
        },
        {
          ActionType: ElectionCeremonyActionTypeProto.CeremonyActionJoinVersion,
          IsAvailable: false,
          IsCompleted: true,
          Reason: 'You already joined the active ceremony version.',
        },
        {
          ActionType: ElectionCeremonyActionTypeProto.CeremonyActionRunSelfTest,
          IsAvailable: false,
          IsCompleted: true,
          Reason: 'Mandatory self-test already completed for this submission cycle.',
        },
        {
          ActionType: ElectionCeremonyActionTypeProto.CeremonyActionSubmitMaterial,
          IsAvailable: true,
          IsCompleted: false,
          Reason: 'Submit ceremony material for validation.',
        },
        {
          ActionType: ElectionCeremonyActionTypeProto.CeremonyActionExportShare,
          IsAvailable: false,
          IsCompleted: false,
          Reason: 'Share export becomes available after ceremony completion.',
        },
        {
          ActionType: ElectionCeremonyActionTypeProto.CeremonyActionImportShare,
          IsAvailable: false,
          IsCompleted: false,
          Reason: 'Share import becomes available after ceremony completion.',
        },
      ],
      SelfTrusteeState: createCeremonyTrusteeState({
        State: ElectionTrusteeCeremonyStateProto.CeremonyStateJoined,
        SelfTestSucceededAt: timestamp,
      }),
    });
    const indexedActionViewResponse = createActionViewResponse({
      ...initialActionViewResponse,
      TrusteeActions: initialActionViewResponse.TrusteeActions.map((action) =>
        action.ActionType === ElectionCeremonyActionTypeProto.CeremonyActionSubmitMaterial
          ? { ...action, IsAvailable: false, IsCompleted: true, Reason: 'Ceremony material already submitted for this version.' }
          : action
      ),
      SelfTrusteeState: createCeremonyTrusteeState({
        State: ElectionTrusteeCeremonyStateProto.CeremonyStateMaterialSubmitted,
        SelfTestSucceededAt: timestamp,
        MaterialSubmittedAt: timestamp,
        ShareVersion: 'share-kc004-prod-3of5-v1-trustee-a',
      }),
    });

    electionsServiceMock.getElectionCeremonyActionView
      .mockResolvedValueOnce(initialActionViewResponse)
      .mockResolvedValueOnce(indexedActionViewResponse)
      .mockResolvedValue(indexedActionViewResponse);
    transactionServiceMock.createSubmitElectionCeremonyMaterialTransaction.mockResolvedValue({
      signedTransaction: 'signed-submit-transaction',
    });

    render(
      <TrusteeElectionCeremonyPanel
        electionId="election-1"
        actorPublicAddress="trustee-a"
        actorEncryptionPublicKey="trustee-encryption-key"
        actorEncryptionPrivateKey="trustee-encryption-private-key"
        actorSigningPrivateKey="trustee-signing-private-key"
      />
    );

    expect(await screen.findByTestId('trustee-ceremony-current-step')).toHaveTextContent(
      'Submit ceremony package'
    );
    expect(screen.getByTestId('trustee-ceremony-step-workspace')).toHaveTextContent(
      'Self-addressed trustee vault envelope'
    );

    fireEvent.click(screen.getByTestId('trustee-ceremony-continue-button'));

    await waitFor(() => {
      expect(trusteeShareVaultMock.createTrusteeShareVaultEnvelope).toHaveBeenCalledTimes(1);
      expect(trusteeShareVaultMock.createTrusteeShareVaultEnvelope).toHaveBeenCalledWith(
        expect.objectContaining({
          mnemonic: trusteeMnemonic,
          material: expect.objectContaining({
            closeCountingShare: expect.objectContaining({
              format: 'omega-controlled-threshold-scalar-v1',
              scalarMaterial: expect.any(String),
              scalarMaterialHash: expect.any(String),
            }),
          }),
        })
      );
      expect(transactionServiceMock.createSubmitElectionCeremonyMaterialTransaction).toHaveBeenCalledWith(
        'election-1',
        'trustee-a',
        'trustee-encryption-key',
        'trustee-encryption-private-key',
        'ceremony-version-1',
        'trustee-a',
        'trustee-share-vault-package',
        'omega-trustee-share-vault-v1',
        'vault-ciphertext',
        'vault-fingerprint',
        expect.stringContaining('share-kc004'),
        {
          X: 'commitment-x',
          Y: 'commitment-y',
        },
        'trustee-signing-private-key'
      );
    });

    expect(transactionServiceMock.createCompleteElectionCeremonyTrusteeTransaction).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByTestId('trustee-ceremony-current-step')).toHaveTextContent(
        'Awaiting owner validation'
      );
    });
    expect(screen.getByTestId('trustee-ceremony-awaiting-owner-validation')).toHaveTextContent(
      'All trustee-local ceremony steps are complete'
    );
    expect(screen.queryByTestId('trustee-ceremony-continue-button')).not.toBeInTheDocument();
  });

  it('explains when an older submitted package needs owner resubmission before the trustee can continue', async () => {
    electionsServiceMock.getElectionCeremonyActionView.mockResolvedValue(
      createActionViewResponse({
        TrusteeActions: [
          {
            ActionType: ElectionCeremonyActionTypeProto.CeremonyActionPublishTransportKey,
            IsAvailable: false,
            IsCompleted: true,
            Reason: 'Transport key already published.',
          },
          {
            ActionType: ElectionCeremonyActionTypeProto.CeremonyActionJoinVersion,
            IsAvailable: false,
            IsCompleted: true,
            Reason: 'You already joined the active ceremony version.',
          },
          {
            ActionType: ElectionCeremonyActionTypeProto.CeremonyActionRunSelfTest,
            IsAvailable: false,
            IsCompleted: true,
            Reason: 'Mandatory self-test already completed for this submission cycle.',
          },
          {
            ActionType: ElectionCeremonyActionTypeProto.CeremonyActionSubmitMaterial,
            IsAvailable: false,
            IsCompleted: true,
            Reason: 'Ceremony material already submitted for this version.',
          },
          {
            ActionType: ElectionCeremonyActionTypeProto.CeremonyActionExportShare,
            IsAvailable: false,
            IsCompleted: false,
            Reason: 'Share export becomes available after ceremony completion.',
          },
          {
            ActionType: ElectionCeremonyActionTypeProto.CeremonyActionImportShare,
            IsAvailable: false,
            IsCompleted: false,
            Reason: 'Share import becomes available after ceremony completion.',
          },
        ],
        SelfTrusteeState: createCeremonyTrusteeState({
          State: ElectionTrusteeCeremonyStateProto.CeremonyStateMaterialSubmitted,
          SelfTestSucceededAt: timestamp,
          MaterialSubmittedAt: timestamp,
          ShareVersion: '',
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

    expect(await screen.findByTestId('trustee-ceremony-current-step')).toHaveTextContent(
      'Awaiting owner resubmission request'
    );
    expect(screen.getByTestId('trustee-ceremony-step-list')).toHaveTextContent(
      'Submitted using the older package format.'
    );
    expect(screen.getByTestId('trustee-ceremony-step-list')).toHaveTextContent(
      'Step 5 is downstream. The owner must request resubmission first'
    );
    expect(screen.getByTestId('trustee-ceremony-awaiting-owner-validation')).toHaveTextContent(
      'this older package cannot be approved'
    );
    expect(screen.getByText('Resubmission boundary')).toBeInTheDocument();
    expect(screen.getByText('Owner resubmission request')).toBeInTheDocument();
    expect(screen.getByText(/Step 5 stays blocked, but it is not the missing action\./i)).toBeInTheDocument();
    expect(screen.queryByTestId('trustee-ceremony-continue-button')).not.toBeInTheDocument();
  });

  it('continues through the trustee-local ceremony steps with one click', async () => {
    const preparedTransportFingerprint = 'transport-kc004-prod-3of5--trustee-a-ceremony-v';
    const publishAvailable = createActionViewResponse({
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
      SelfTrusteeState: createCeremonyTrusteeState({
        State: ElectionTrusteeCeremonyStateProto.CeremonyStateAcceptedTrustee,
        TransportPublicKeyFingerprint: '',
        TransportPublicKeyPublishedAt: undefined,
        JoinedAt: undefined,
        SelfTestSucceededAt: undefined,
      }),
    });
    const joinAvailable = createActionViewResponse({
      ...publishAvailable,
      TrusteeActions: publishAvailable.TrusteeActions.map((action) => {
        if (action.ActionType === ElectionCeremonyActionTypeProto.CeremonyActionPublishTransportKey) {
          return { ...action, IsAvailable: false, IsCompleted: true, Reason: 'Transport key already published.' };
        }
        if (action.ActionType === ElectionCeremonyActionTypeProto.CeremonyActionJoinVersion) {
          return { ...action, IsAvailable: true, IsCompleted: false, Reason: 'Join the active ceremony version.' };
        }
        return action;
      }),
      SelfTrusteeState: createCeremonyTrusteeState({
        State: ElectionTrusteeCeremonyStateProto.CeremonyStateAcceptedTrustee,
        TransportPublicKeyFingerprint: preparedTransportFingerprint,
        TransportPublicKeyPublishedAt: timestamp,
        JoinedAt: undefined,
        SelfTestSucceededAt: undefined,
      }),
    });
    const selfTestAvailable = createActionViewResponse({
      ...joinAvailable,
      TrusteeActions: joinAvailable.TrusteeActions.map((action) => {
        if (action.ActionType === ElectionCeremonyActionTypeProto.CeremonyActionJoinVersion) {
          return { ...action, IsAvailable: false, IsCompleted: true, Reason: 'You already joined the active ceremony version.' };
        }
        if (action.ActionType === ElectionCeremonyActionTypeProto.CeremonyActionRunSelfTest) {
          return { ...action, IsAvailable: true, IsCompleted: false, Reason: 'Run the mandatory self-test before submitting ceremony material.' };
        }
        return action;
      }),
      SelfTrusteeState: createCeremonyTrusteeState({
        State: ElectionTrusteeCeremonyStateProto.CeremonyStateJoined,
        TransportPublicKeyFingerprint: preparedTransportFingerprint,
        TransportPublicKeyPublishedAt: timestamp,
        JoinedAt: timestamp,
        SelfTestSucceededAt: undefined,
      }),
    });
    const submitAvailable = createActionViewResponse({
      ...selfTestAvailable,
      TrusteeActions: selfTestAvailable.TrusteeActions.map((action) => {
        if (action.ActionType === ElectionCeremonyActionTypeProto.CeremonyActionRunSelfTest) {
          return { ...action, IsAvailable: false, IsCompleted: true, Reason: 'Mandatory self-test already completed for this submission cycle.' };
        }
        if (action.ActionType === ElectionCeremonyActionTypeProto.CeremonyActionSubmitMaterial) {
          return { ...action, IsAvailable: true, IsCompleted: false, Reason: 'Submit ceremony material for validation.' };
        }
        return action;
      }),
      SelfTrusteeState: createCeremonyTrusteeState({
        State: ElectionTrusteeCeremonyStateProto.CeremonyStateJoined,
        TransportPublicKeyFingerprint: preparedTransportFingerprint,
        TransportPublicKeyPublishedAt: timestamp,
        JoinedAt: timestamp,
        SelfTestSucceededAt: timestamp,
      }),
    });
    const submitted = createActionViewResponse({
      ...submitAvailable,
      TrusteeActions: submitAvailable.TrusteeActions.map((action) => {
        if (action.ActionType === ElectionCeremonyActionTypeProto.CeremonyActionSubmitMaterial) {
          return { ...action, IsAvailable: false, IsCompleted: true, Reason: 'Ceremony material already submitted for this version.' };
        }
        return action;
      }),
      SelfTrusteeState: createCeremonyTrusteeState({
        State: ElectionTrusteeCeremonyStateProto.CeremonyStateMaterialSubmitted,
        TransportPublicKeyFingerprint: preparedTransportFingerprint,
        TransportPublicKeyPublishedAt: timestamp,
        JoinedAt: timestamp,
        SelfTestSucceededAt: timestamp,
        MaterialSubmittedAt: timestamp,
      }),
    });

    let actionViewCallCount = 0;
    electionsServiceMock.getElectionCeremonyActionView.mockImplementation(async () => {
      actionViewCallCount += 1;
      if (actionViewCallCount === 1) return publishAvailable;
      if (actionViewCallCount <= 3) return joinAvailable;
      if (actionViewCallCount <= 5) return selfTestAvailable;
      if (actionViewCallCount <= 7) return submitAvailable;
      return submitted;
    });

    transactionServiceMock.createPublishElectionCeremonyTransportKeyTransaction.mockResolvedValue({
      signedTransaction: 'signed-publish-transaction',
    });
    transactionServiceMock.createJoinElectionCeremonyTransaction.mockResolvedValue({
      signedTransaction: 'signed-join-transaction',
    });
    transactionServiceMock.createRecordElectionCeremonySelfTestSuccessTransaction.mockResolvedValue({
      signedTransaction: 'signed-self-test-transaction',
    });
    transactionServiceMock.createSubmitElectionCeremonyMaterialTransaction.mockResolvedValue({
      signedTransaction: 'signed-submit-transaction',
    });

    render(
      <TrusteeElectionCeremonyPanel
        electionId="election-1"
        actorPublicAddress="trustee-a"
        actorEncryptionPublicKey="trustee-encryption-key"
        actorEncryptionPrivateKey="trustee-encryption-private-key"
        actorSigningPrivateKey="trustee-signing-private-key"
      />
    );

    expect(await screen.findByTestId('trustee-ceremony-current-step')).toHaveTextContent(
      'Publish transport key'
    );

    fireEvent.click(screen.getByTestId('trustee-ceremony-continue-button'));

    await waitFor(() => {
      expect(transactionServiceMock.createPublishElectionCeremonyTransportKeyTransaction).toHaveBeenCalledTimes(1);
      expect(transactionServiceMock.createJoinElectionCeremonyTransaction).toHaveBeenCalledTimes(1);
      expect(transactionServiceMock.createRecordElectionCeremonySelfTestSuccessTransaction).toHaveBeenCalledTimes(1);
      expect(transactionServiceMock.createSubmitElectionCeremonyMaterialTransaction).toHaveBeenCalledTimes(1);
    });

    expect(transactionServiceMock.createCompleteElectionCeremonyTrusteeTransaction).not.toHaveBeenCalled();
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

    fireEvent.click(screen.getByTestId('trustee-ceremony-continue-button'));

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
