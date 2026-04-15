import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as secp256k1 from '@noble/secp256k1';
import type {
  ElectionCeremonyMessageEnvelope,
  ElectionFinalizationReleaseEvidence,
  ElectionFinalizationSession,
  ElectionFinalizationShare,
  ElectionRecordView,
  GetElectionCeremonyActionViewResponse,
  GetElectionResponse,
} from '@/lib/grpc';
import {
  ElectionBindingStatusProto,
  ElectionCeremonyActorRoleProto,
  ElectionCeremonyVersionStatusProto,
  ElectionClassProto,
  ElectionCloseCountingJobStatusProto,
  ElectionDisclosureModeProto,
  ElectionFinalizationReleaseModeProto,
  ElectionFinalizationSessionPurposeProto,
  ElectionFinalizationSessionStatusProto,
  ElectionFinalizationShareStatusProto,
  ElectionFinalizationTargetTypeProto,
  ElectionGovernanceModeProto,
  ElectionGovernedActionTypeProto,
  ElectionGovernedProposalExecutionStatusProto,
  ElectionLifecycleStateProto,
  EligibilityMutationPolicyProto,
  EligibilitySourceTypeProto,
  OutcomeRuleKindProto,
  ParticipationPrivacyModeProto,
  ReportingPolicyProto,
  ReviewWindowPolicyProto,
  VoteUpdatePolicyProto,
} from '@/lib/grpc';
import { bytesToBase64, bytesToHex, hexToBytes } from '@/lib/crypto';
import { useBlockchainStore } from '@/modules/blockchain/useBlockchainStore';
import { useAppStore } from '@/stores/useAppStore';
import {
  createTrusteeShareVaultEnvelope,
  deriveTrusteeCloseCountingShareMaterial,
} from './trusteeShareVault';
import { TrusteeElectionFinalizationPanel } from './TrusteeElectionFinalizationPanel';
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
    createSubmitElectionFinalizationShareTransaction: vi.fn(),
  },
}));

vi.mock('@/lib/grpc/services/elections', () => ({
  electionsService: electionsServiceMock,
}));

vi.mock('@/modules/blockchain/BlockchainService', () => ({
  submitTransaction: (...args: unknown[]) => blockchainServiceMock.submitTransaction(...args),
}));

vi.mock('./transactionService', () => ({
  createSubmitElectionFinalizationShareTransaction: (...args: unknown[]) =>
    transactionServiceMock.createSubmitElectionFinalizationShareTransaction(...args),
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
const trusteeEncryptionPrivateKey =
  '1111111111111111111111111111111111111111111111111111111111111111';
const trusteeEncryptionPublicKey = bytesToHex(
  secp256k1.getPublicKey(hexToBytes(trusteeEncryptionPrivateKey), true)
);
const trusteeSigningPrivateKey =
  '2222222222222222222222222222222222222222222222222222222222222222';

function createElectionRecord(overrides?: Partial<ElectionRecordView>): ElectionRecordView {
  return {
    ElectionId: 'election-1',
    Title: 'Governed Referendum',
    ShortDescription: 'Policy vote',
    OwnerPublicAddress: 'owner-public-key',
    ExternalReferenceCode: 'REF-2026-01',
    LifecycleState: ElectionLifecycleStateProto.Closed,
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
    RequiredApprovalCount: 2,
    CreatedAt: timestamp,
    LastUpdatedAt: timestamp,
    OpenedAt: timestamp,
    ClosedAt: timestamp,
    OpenArtifactId: 'open-artifact',
    CloseArtifactId: 'close-artifact',
    FinalizeArtifactId: '',
    ...overrides,
  };
}

function createFinalizationSession(
  overrides?: Partial<ElectionFinalizationSession>
): ElectionFinalizationSession {
  return {
    Id: 'finalization-session-1',
    ElectionId: 'election-1',
    GovernedProposalId: 'proposal-close-1',
    GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
    SessionPurpose: ElectionFinalizationSessionPurposeProto.FinalizationSessionPurposeCloseCounting,
    CloseArtifactId: 'close-artifact',
    AcceptedBallotSetHash: 'accepted-ballot-set-hash',
    FinalEncryptedTallyHash: 'final-encrypted-tally-hash',
    TargetTallyId: 'aggregate-tally-1',
    CeremonySnapshot: {
      CeremonyVersionId: 'ceremony-version-1',
      VersionNumber: 4,
      ProfileId: 'prod-3of5-v1',
      TrusteeCount: 3,
      RequiredApprovalCount: 2,
      CompletedTrustees: [
        {
          TrusteeUserAddress: 'trustee-a',
          TrusteeDisplayName: 'Alice Trustee',
        },
        {
          TrusteeUserAddress: 'trustee-b',
          TrusteeDisplayName: 'Bob Trustee',
        },
      ],
      TallyPublicKeyFingerprint: 'tally-fingerprint-1',
    },
    RequiredShareCount: 2,
    EligibleTrustees: [
      {
        TrusteeUserAddress: 'trustee-a',
        TrusteeDisplayName: 'Alice Trustee',
      },
      {
        TrusteeUserAddress: 'trustee-b',
        TrusteeDisplayName: 'Bob Trustee',
      },
    ],
    CloseCountingJobId: 'close-counting-job-1',
    CloseCountingJobStatus: ElectionCloseCountingJobStatusProto.CloseCountingJobAwaitingShares,
    ExecutorSessionPublicKey: 'executor-session-public-key-1',
    ExecutorKeyAlgorithm: 'ecies-secp256k1-v1',
    Status: ElectionFinalizationSessionStatusProto.FinalizationSessionAwaitingShares,
    CreatedAt: timestamp,
    CreatedByPublicAddress: 'owner-public-key',
    CompletedAt: undefined,
    ReleaseEvidenceId: '',
    LatestTransactionId: 'transaction-1',
    LatestBlockHeight: 100,
    LatestBlockId: 'block-100',
    ...overrides,
  };
}

function createFinalizationShare(
  overrides?: Partial<ElectionFinalizationShare>
): ElectionFinalizationShare {
  return {
    Id: 'finalization-share-1',
    FinalizationSessionId: 'finalization-session-1',
    ElectionId: 'election-1',
    TrusteeUserAddress: 'trustee-a',
    TrusteeDisplayName: 'Alice Trustee',
    SubmittedByPublicAddress: 'trustee-a',
    ShareIndex: 1,
    ShareVersion: 'share-v2',
    TargetType: ElectionFinalizationTargetTypeProto.FinalizationTargetAggregateTally,
    ClaimedCloseArtifactId: 'close-artifact',
    ClaimedAcceptedBallotSetHash: 'accepted-ballot-set-hash',
    ClaimedFinalEncryptedTallyHash: 'final-encrypted-tally-hash',
    ClaimedTargetTallyId: 'aggregate-tally-1',
    ClaimedCeremonyVersionId: 'ceremony-version-1',
    ClaimedTallyPublicKeyFingerprint: 'tally-fingerprint-1',
    Status: ElectionFinalizationShareStatusProto.FinalizationShareAccepted,
    FailureCode: '',
    FailureReason: '',
    SubmittedAt: { seconds: timestamp.seconds + 60, nanos: 0 },
    SourceTransactionId: 'transaction-2',
    SourceBlockHeight: 101,
    SourceBlockId: 'block-101',
    ...overrides,
  };
}

function createFinalizationReleaseEvidence(
  overrides?: Partial<ElectionFinalizationReleaseEvidence>
): ElectionFinalizationReleaseEvidence {
  return {
    Id: 'release-evidence-1',
    FinalizationSessionId: 'finalization-session-1',
    ElectionId: 'election-1',
    SessionPurpose: ElectionFinalizationSessionPurposeProto.FinalizationSessionPurposeFinalize,
    ReleaseMode: ElectionFinalizationReleaseModeProto.FinalizationReleaseAggregateTallyOnly,
    CloseArtifactId: 'close-artifact',
    AcceptedBallotSetHash: 'accepted-ballot-set-hash',
    FinalEncryptedTallyHash: 'final-encrypted-tally-hash',
    TargetTallyId: 'aggregate-tally-1',
    AcceptedShareCount: 2,
    AcceptedTrustees: [
      {
        TrusteeUserAddress: 'trustee-a',
        TrusteeDisplayName: 'Alice Trustee',
      },
      {
        TrusteeUserAddress: 'trustee-b',
        TrusteeDisplayName: 'Bob Trustee',
      },
    ],
    CompletedAt: { seconds: timestamp.seconds + 120, nanos: 0 },
    CompletedByPublicAddress: 'owner-public-key',
    SourceTransactionId: 'transaction-3',
    SourceBlockHeight: 102,
    SourceBlockId: 'block-102',
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
    CeremonyVersions: [],
    CeremonyTranscriptEvents: [],
    ActiveCeremonyTrusteeStates: [],
    FinalizationSessions: [createFinalizationSession()],
    FinalizationShares: [],
    FinalizationReleaseEvidenceRecords: [],
    ...overrides,
  };
}

function createCeremonyActionViewResponse(
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
      Status: ElectionCeremonyVersionStatusProto.CeremonyVersionCompleted,
      TrusteeCount: 2,
      RequiredApprovalCount: 2,
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
      TallyPublicKeyFingerprint: 'tally-fingerprint-1',
    },
    OwnerActions: [],
    TrusteeActions: [],
    PendingIncomingMessageCount: 0,
    BlockedReasons: [],
    SelfVaultEnvelopes: [],
    ...overrides,
  };
}

async function createStoredVaultEnvelopeFixture(): Promise<{
  envelope: ElectionCeremonyMessageEnvelope;
  shareVersion: string;
  shareMaterial: string;
  shareMaterialHash: string;
}> {
  const shareVersion = 'share-v2';
  const closeCountingShare = await deriveTrusteeCloseCountingShareMaterial({
    electionId: 'election-1',
    ceremonyVersionId: 'ceremony-version-1',
    trusteeUserAddress: 'trustee-a',
    mnemonic: trusteeMnemonic,
    shareVersion,
  });
  const vaultEnvelope = await createTrusteeShareVaultEnvelope({
    electionId: 'election-1',
    ceremonyVersionId: 'ceremony-version-1',
    trusteeUserAddress: 'trustee-a',
    trusteeEncryptionPublicKey,
    mnemonic: trusteeMnemonic,
    shareVersion,
    material: {
      packageKind: 'trustee-ceremony-package',
      ceremonyMessageType: 'dkg-share-package',
      ceremonyPayloadVersion: 'omega-v1.0.0',
      ceremonyPayloadFingerprint: 'package-fingerprint',
      ceremonyEncryptedPayload: '{"packageKind":"trustee-ceremony-package"}',
      transportPublicKeyFingerprint: 'transport-fingerprint',
      protocolVersion: 'omega-v1.0.0',
      profileId: 'prod-3of5-v1',
      versionNumber: 4,
      closeCountingShare,
    },
  });

  return {
    envelope: {
      Id: 'vault-envelope-1',
      ElectionId: 'election-1',
      CeremonyVersionId: 'ceremony-version-1',
      VersionNumber: 4,
      ProfileId: 'prod-3of5-v1',
      SenderTrusteeUserAddress: 'trustee-a',
      RecipientTrusteeUserAddress: 'trustee-a',
      MessageType: vaultEnvelope.messageType,
      PayloadVersion: vaultEnvelope.payloadVersion,
      EncryptedPayload: bytesToBase64(
        new TextEncoder().encode(vaultEnvelope.encryptedPayload)
      ),
      PayloadFingerprint: vaultEnvelope.payloadFingerprint,
      SubmittedAt: timestamp,
    },
    shareVersion,
    shareMaterial: closeCountingShare.scalarMaterial,
    shareMaterialHash: closeCountingShare.scalarMaterialHash,
  };
}

describe('TrusteeElectionFinalizationPanel', () => {
  beforeEach(() => {
    useElectionsStore.getState().reset();
    useBlockchainStore.getState().reset();
    useAppStore.setState({
      credentials: {
        signingPublicKey: 'trustee-signing-public-key',
        signingPrivateKey: trusteeSigningPrivateKey,
        encryptionPublicKey: trusteeEncryptionPublicKey,
        encryptionPrivateKey: trusteeEncryptionPrivateKey,
        mnemonic: trusteeMnemonic,
      },
    });
    vi.clearAllMocks();
    blockchainServiceMock.submitTransaction.mockResolvedValue({
      successful: true,
      message: 'Accepted',
    });
    transactionServiceMock.createSubmitElectionFinalizationShareTransaction.mockResolvedValue({
      signedTransaction: 'signed-finalization-share-transaction',
    });
  });

  it('submits one aggregate-only close-counting share bound to the active session', async () => {
    const initialResponse = createElectionResponse();
    const indexedResponse = createElectionResponse({
      FinalizationShares: [createFinalizationShare()],
      FinalizationReleaseEvidenceRecords: [createFinalizationReleaseEvidence()],
    });
    const vaultFixture = await createStoredVaultEnvelopeFixture();

    electionsServiceMock.getElection
      .mockResolvedValueOnce(initialResponse)
      .mockResolvedValue(indexedResponse);
    electionsServiceMock.getElectionCeremonyActionView.mockResolvedValue(
      createCeremonyActionViewResponse({
        SelfVaultEnvelopes: [vaultFixture.envelope],
      })
    );

    render(
      <TrusteeElectionFinalizationPanel
        electionId="election-1"
        actorPublicAddress="trustee-a"
        actorEncryptionPublicKey={trusteeEncryptionPublicKey}
        actorEncryptionPrivateKey={trusteeEncryptionPrivateKey}
        actorSigningPrivateKey={trusteeSigningPrivateKey}
      />
    );

    expect(await screen.findByTestId('trustee-finalization-summary')).toHaveTextContent(
      'Governed Referendum'
    );
    expect(screen.getByTestId('trustee-finalization-summary').className).not.toContain(
      'border-hush-bg-light'
    );
    expect(screen.getByTestId('trustee-finalization-panel').className).not.toContain(
      'border-hush-bg-light'
    );
    expect(screen.getByText('Session purpose').parentElement?.className).not.toContain(
      'border-hush-bg-light'
    );
    expect(screen.getByText('Target tally id').parentElement?.className).not.toContain(
      'border-hush-bg-light'
    );
    expect(screen.getByTestId('trustee-finalization-share-version').className).not.toContain(
      'border-hush-bg-light'
    );
    expect(screen.getByTestId('trustee-finalization-panel')).toHaveTextContent('Share index 1');

    await waitFor(() => {
      expect(screen.getByTestId('trustee-finalization-vault-status')).toHaveTextContent('Loaded');
    });
    expect(screen.getByTestId('trustee-finalization-share-version')).toHaveTextContent(
      vaultFixture.shareVersion
    );
    expect(
      screen.getByTestId('trustee-finalization-share-material-hash')
    ).toHaveTextContent(vaultFixture.shareMaterialHash.slice(0, 8));

    fireEvent.click(screen.getByTestId('trustee-finalization-submit-button'));

    await waitFor(() => {
      expect(
        transactionServiceMock.createSubmitElectionFinalizationShareTransaction
      ).toHaveBeenCalledWith(
        {
          ElectionId: 'election-1',
          FinalizationSessionId: 'finalization-session-1',
          ActorPublicAddress: 'trustee-a',
          ShareIndex: 1,
          ShareVersion: vaultFixture.shareVersion,
          TargetType: ElectionFinalizationTargetTypeProto.FinalizationTargetAggregateTally,
          ClaimedCloseArtifactId: 'close-artifact',
          ClaimedAcceptedBallotSetHash: 'accepted-ballot-set-hash',
          ClaimedFinalEncryptedTallyHash: 'final-encrypted-tally-hash',
          ClaimedTargetTallyId: 'aggregate-tally-1',
          ClaimedCeremonyVersionId: 'ceremony-version-1',
          ClaimedTallyPublicKeyFingerprint: 'tally-fingerprint-1',
          CloseCountingJobId: 'close-counting-job-1',
          ExecutorSessionPublicKey: 'executor-session-public-key-1',
          ExecutorKeyAlgorithm: 'ecies-secp256k1-v1',
          ShareMaterial: vaultFixture.shareMaterial,
        },
        trusteeEncryptionPublicKey,
        trusteeEncryptionPrivateKey,
        trusteeSigningPrivateKey
      );
    });

    expect(blockchainServiceMock.submitTransaction).toHaveBeenCalledWith(
      'signed-finalization-share-transaction'
    );
    expect(
      await screen.findByText('Finalization share recorded and aggregate release completed.')
    ).toBeInTheDocument();
  });

  it('shows executor progress while the bound close-counting job is running', async () => {
    const vaultFixture = await createStoredVaultEnvelopeFixture();

    electionsServiceMock.getElection.mockResolvedValue(
      createElectionResponse({
        FinalizationSessions: [
          createFinalizationSession({
            CloseCountingJobStatus:
              ElectionCloseCountingJobStatusProto.CloseCountingJobRunning,
          }),
        ],
        FinalizationShares: [
          createFinalizationShare({
            Status: ElectionFinalizationShareStatusProto.FinalizationShareAccepted,
          }),
        ],
        FinalizationReleaseEvidenceRecords: [],
      })
    );
    electionsServiceMock.getElectionCeremonyActionView.mockResolvedValue(
      createCeremonyActionViewResponse({
        SelfVaultEnvelopes: [vaultFixture.envelope],
      })
    );

    render(
      <TrusteeElectionFinalizationPanel
        electionId="election-1"
        actorPublicAddress="trustee-a"
        actorEncryptionPublicKey={trusteeEncryptionPublicKey}
        actorEncryptionPrivateKey={trusteeEncryptionPrivateKey}
        actorSigningPrivateKey={trusteeSigningPrivateKey}
      />
    );

    expect(await screen.findByTestId('trustee-finalization-executor-state')).toHaveTextContent(
      'Executor running'
    );
    expect(screen.getByTestId('trustee-finalization-executor-state')).toHaveTextContent(
      'The tally executor is decrypting the bound submissions'
    );
    expect(screen.getByTestId('trustee-finalization-summary')).toHaveTextContent(
      'Close counting | Executor running'
    );
    expect(screen.getByTestId('trustee-finalization-summary')).toHaveTextContent('Executor job');
  });

  it('shows the waiting threshold state and unlocks the share form when close-counting becomes available', async () => {
    const vaultFixture = await createStoredVaultEnvelopeFixture();

    electionsServiceMock.getElection
      .mockResolvedValueOnce(
        createElectionResponse({
          GovernedProposals: [
            {
              Id: 'proposal-close-1',
              ElectionId: 'election-1',
              ActionType: ElectionGovernedActionTypeProto.Close,
              LifecycleStateAtCreation: ElectionLifecycleStateProto.Open,
              ProposedByPublicAddress: 'owner-public-key',
              CreatedAt: timestamp,
              ExecutionStatus: ElectionGovernedProposalExecutionStatusProto.WaitingForApprovals,
              ExecutionFailureReason: '',
              LastExecutionTriggeredByPublicAddress: '',
            },
          ],
          GovernedProposalApprovals: [
            {
              Id: 'approval-1',
              ProposalId: 'proposal-close-1',
              ElectionId: 'election-1',
              ActionType: ElectionGovernedActionTypeProto.Close,
              LifecycleStateAtProposalCreation: ElectionLifecycleStateProto.Open,
              TrusteeUserAddress: 'trustee-a',
              TrusteeDisplayName: 'Alice Trustee',
              ApprovalNote: '',
              ApprovedAt: timestamp,
            },
          ],
          FinalizationSessions: [],
          FinalizationShares: [],
          FinalizationReleaseEvidenceRecords: [],
        })
      )
      .mockResolvedValue(
        createElectionResponse({
          GovernedProposals: [
            {
              Id: 'proposal-close-1',
              ElectionId: 'election-1',
              ActionType: ElectionGovernedActionTypeProto.Close,
              LifecycleStateAtCreation: ElectionLifecycleStateProto.Open,
              ProposedByPublicAddress: 'owner-public-key',
              CreatedAt: timestamp,
              ExecutionStatus: ElectionGovernedProposalExecutionStatusProto.ExecutionSucceeded,
              ExecutionFailureReason: '',
              LastExecutionTriggeredByPublicAddress: 'owner-public-key',
            },
          ],
          GovernedProposalApprovals: [
            {
              Id: 'approval-1',
              ProposalId: 'proposal-close-1',
              ElectionId: 'election-1',
              ActionType: ElectionGovernedActionTypeProto.Close,
              LifecycleStateAtProposalCreation: ElectionLifecycleStateProto.Open,
              TrusteeUserAddress: 'trustee-a',
              TrusteeDisplayName: 'Alice Trustee',
              ApprovalNote: '',
              ApprovedAt: timestamp,
            },
          ],
          FinalizationSessions: [createFinalizationSession()],
          FinalizationShares: [],
          FinalizationReleaseEvidenceRecords: [],
        })
      );
    electionsServiceMock.getElectionCeremonyActionView.mockResolvedValue(
      createCeremonyActionViewResponse({
        SelfVaultEnvelopes: [vaultFixture.envelope],
      })
    );

    render(
      <TrusteeElectionFinalizationPanel
        electionId="election-1"
        actorPublicAddress="trustee-a"
        actorEncryptionPublicKey={trusteeEncryptionPublicKey}
        actorEncryptionPrivateKey={trusteeEncryptionPrivateKey}
        actorSigningPrivateKey={trusteeSigningPrivateKey}
      />
    );

    expect(await screen.findByTestId('trustee-finalization-blocked')).toHaveTextContent(
      'Your close approval is recorded. Share submission stays disabled until the proposal reaches threshold'
    );
    expect(screen.queryByTestId('trustee-finalization-submit-button')).not.toBeInTheDocument();

    await act(async () => {
      useBlockchainStore.getState().setBlockHeight(202);
    });

    await waitFor(() =>
      expect(screen.getByTestId('trustee-finalization-submit-button')).toBeEnabled()
    );
    expect(screen.getByTestId('trustee-finalization-vault-status')).toHaveTextContent('Loaded');
    expect(screen.getByText('Close Counting Share Status')).toBeInTheDocument();
  });

  it('blocks non-close-counting share sessions because finalize is approval-only', async () => {
    const vaultFixture = await createStoredVaultEnvelopeFixture();

    electionsServiceMock.getElection.mockResolvedValueOnce(
      createElectionResponse({
        FinalizationSessions: [
          createFinalizationSession({
            SessionPurpose: ElectionFinalizationSessionPurposeProto.FinalizationSessionPurposeFinalize,
          }),
        ],
      })
    );
    electionsServiceMock.getElectionCeremonyActionView.mockResolvedValue(
      createCeremonyActionViewResponse({
        SelfVaultEnvelopes: [vaultFixture.envelope],
      })
    );

    render(
      <TrusteeElectionFinalizationPanel
        electionId="election-1"
        actorPublicAddress="trustee-a"
        actorEncryptionPublicKey={trusteeEncryptionPublicKey}
        actorEncryptionPrivateKey={trusteeEncryptionPrivateKey}
        actorSigningPrivateKey={trusteeSigningPrivateKey}
      />
    );

    expect(
      await screen.findByTestId('trustee-finalization-non-closecounting')
    ).toHaveTextContent('Only close-counting sessions accept trustee shares in this rollout.');
    expect(screen.queryByTestId('trustee-finalization-submit-button')).not.toBeInTheDocument();
  });

  it('fails closed when the trustee vault package is missing', async () => {
    electionsServiceMock.getElection.mockResolvedValue(createElectionResponse());
    electionsServiceMock.getElectionCeremonyActionView.mockResolvedValue(
      createCeremonyActionViewResponse({
        SelfVaultEnvelopes: [],
      })
    );

    render(
      <TrusteeElectionFinalizationPanel
        electionId="election-1"
        actorPublicAddress="trustee-a"
        actorEncryptionPublicKey={trusteeEncryptionPublicKey}
        actorEncryptionPrivateKey={trusteeEncryptionPrivateKey}
        actorSigningPrivateKey={trusteeSigningPrivateKey}
      />
    );

    expect(await screen.findByTestId('trustee-finalization-vault-blocked')).toHaveTextContent(
      'No trustee-owned vault package is available'
    );
    expect(screen.getByTestId('trustee-finalization-submit-button')).toBeDisabled();
    expect(
      transactionServiceMock.createSubmitElectionFinalizationShareTransaction
    ).not.toHaveBeenCalled();
  });
});
