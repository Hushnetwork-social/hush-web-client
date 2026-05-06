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
import { createProtocolPackageBinding } from './HushVotingWorkspaceTestUtils';

const { electionsServiceMock, blockchainServiceMock, transactionServiceMock } = vi.hoisted(() => ({
  electionsServiceMock: {
    getElection: vi.fn(),
    getElectionCeremonyActionView: vi.fn(),
  },
  blockchainServiceMock: {
    submitTransaction: vi.fn(),
  },
  transactionServiceMock: {
    createRefreshProtocolPackageBindingTransaction: vi.fn(),
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
  createRefreshProtocolPackageBindingTransaction: (...args: unknown[]) =>
    transactionServiceMock.createRefreshProtocolPackageBindingTransaction(...args),
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
    SelectedProfileId: 'dkg-prod-3of5',
    SelectedProfileDevOnly: false,
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
    BallotDefinitionVersion: 1,
    BallotDefinitionHash: 'ballot-definition-hash-1',
    HasBallotDefinitionSealedAt: true,
    BallotDefinitionSealedAt: timestamp,
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
    ControlDomainProfileId: 'high_assurance_independent_trustees_v1',
    ControlDomainProfileVersion: 'v1',
    ThresholdProfileId: 'dkg-prod-3of5',
    TrusteeCount: 3,
    TrusteeThreshold: 2,
    AcceptedReleaseArtifactCount: 0,
    MissingReleaseArtifactCount: 2,
    RejectedReleaseArtifactCount: 0,
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
    ProtocolPackageBinding: createProtocolPackageBinding({
      ElectionId: 'election-1',
      PackageVersion: 'v1.1.2',
      ReleaseManifestHash: 'f'.repeat(64),
    }),
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
    expect(screen.getByTestId('trustee-finalization-exact-target')).toHaveTextContent('election-1');
    expect(screen.getByTestId('trustee-finalization-exact-target')).toHaveTextContent(
      'finalization-session-1'
    );
    expect(screen.getByTestId('trustee-finalization-exact-target')).toHaveTextContent(
      'ballot-definition-hash-1'
    );
    expect(screen.getByTestId('trustee-finalization-exact-target')).toHaveTextContent('v1.1.2');
    expect(screen.getByTestId('trustee-finalization-exact-target')).toHaveTextContent(
      'high_assurance_independent_trustees_v1 v1'
    );
    expect(screen.getByTestId('trustee-finalization-exact-target')).toHaveTextContent(
      'SP-06 threshold: 0 accepted, 2 missing, 0 rejected; requires 2 of 3.'
    );

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

  it('shows a recoverable close-counting failure when more eligible trustees can still submit', async () => {
    const vaultFixture = await createStoredVaultEnvelopeFixture();

    electionsServiceMock.getElection.mockResolvedValue(
      createElectionResponse({
        FinalizationSessions: [
          createFinalizationSession({
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
              {
                TrusteeUserAddress: 'trustee-c',
                TrusteeDisplayName: 'Charlie Trustee',
              },
            ],
            CeremonySnapshot: {
              ...createFinalizationSession().CeremonySnapshot!,
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
                {
                  TrusteeUserAddress: 'trustee-c',
                  TrusteeDisplayName: 'Charlie Trustee',
                },
              ],
            },
            CloseCountingJobStatus:
              ElectionCloseCountingJobStatusProto.CloseCountingJobFailed,
          }),
        ],
        FinalizationShares: [
          createFinalizationShare({
            TrusteeUserAddress: 'trustee-a',
            TrusteeDisplayName: 'Alice Trustee',
          }),
          createFinalizationShare({
            Id: 'finalization-share-2',
            TrusteeUserAddress: 'trustee-b',
            TrusteeDisplayName: 'Bob Trustee',
            ShareIndex: 2,
            SubmittedAt: { seconds: timestamp.seconds + 90, nanos: 0 },
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
      'Executor stalled on the current share set'
    );
    expect(screen.getByTestId('trustee-finalization-executor-state')).toHaveTextContent(
      'Pending eligible trustees can still submit on this same session'
    );
    expect(screen.getByTestId('trustee-finalization-summary')).toHaveTextContent(
      '2 accepted / 3 eligible'
    );
    expect(screen.getByText(/Latest share status:/)).toHaveTextContent(
      'Pending eligible trustees: 1'
    );
  });

  it('keeps missing non-required trustees visible after the SP-06 threshold is satisfied', async () => {
    const vaultFixture = await createStoredVaultEnvelopeFixture();

    electionsServiceMock.getElection.mockResolvedValue(
      createElectionResponse({
        FinalizationSessions: [
          createFinalizationSession({
            TrusteeCount: 5,
            TrusteeThreshold: 3,
            RequiredShareCount: 3,
            AcceptedReleaseArtifactCount: 4,
            MissingReleaseArtifactCount: 1,
            RejectedReleaseArtifactCount: 0,
            EligibleTrustees: ['a', 'b', 'c', 'd', 'e'].map((suffix) => ({
              TrusteeUserAddress: `trustee-${suffix}`,
              TrusteeDisplayName: `Trustee ${suffix.toUpperCase()}`,
            })),
            CeremonySnapshot: {
              ...createFinalizationSession().CeremonySnapshot!,
              TrusteeCount: 5,
              RequiredApprovalCount: 3,
            },
          }),
        ],
        FinalizationShares: [
          createFinalizationShare({
            TrusteeUserAddress: 'trustee-a',
            TrusteeDisplayName: 'Trustee A',
          }),
          createFinalizationShare({
            Id: 'finalization-share-2',
            TrusteeUserAddress: 'trustee-b',
            TrusteeDisplayName: 'Trustee B',
            ShareIndex: 2,
          }),
          createFinalizationShare({
            Id: 'finalization-share-3',
            TrusteeUserAddress: 'trustee-c',
            TrusteeDisplayName: 'Trustee C',
            ShareIndex: 3,
          }),
          createFinalizationShare({
            Id: 'finalization-share-4',
            TrusteeUserAddress: 'trustee-d',
            TrusteeDisplayName: 'Trustee D',
            ShareIndex: 4,
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

    expect(await screen.findByTestId('trustee-finalization-exact-target')).toHaveTextContent(
      'Threshold met with missing evidence visible'
    );
    expect(screen.getByTestId('trustee-finalization-exact-target')).toHaveTextContent(
      'SP-06 threshold: 4 accepted, 1 missing, 0 rejected; requires 3 of 5.'
    );
    expect(screen.getByTestId('trustee-finalization-summary')).toHaveTextContent(
      '4 accepted / 5 eligible'
    );
  });

  it('shows rejected artifact recovery detail without exposing private share material', async () => {
    const vaultFixture = await createStoredVaultEnvelopeFixture();

    electionsServiceMock.getElection.mockResolvedValue(
      createElectionResponse({
        FinalizationSessions: [
          createFinalizationSession({
            TrusteeCount: 5,
            TrusteeThreshold: 3,
            RequiredShareCount: 3,
            AcceptedReleaseArtifactCount: 3,
            MissingReleaseArtifactCount: 1,
            RejectedReleaseArtifactCount: 1,
            EligibleTrustees: ['a', 'b', 'c', 'd', 'e'].map((suffix) => ({
              TrusteeUserAddress: `trustee-${suffix}`,
              TrusteeDisplayName: `Trustee ${suffix.toUpperCase()}`,
            })),
            CeremonySnapshot: {
              ...createFinalizationSession().CeremonySnapshot!,
              TrusteeCount: 5,
              RequiredApprovalCount: 3,
            },
          }),
        ],
        FinalizationShares: [
          createFinalizationShare({
            Status: ElectionFinalizationShareStatusProto.FinalizationShareRejected,
            FailureCode: 'wrong_tally_target',
            FailureReason: 'The submitted artifact targets a different tally hash.',
          }),
          createFinalizationShare({
            Id: 'finalization-share-2',
            TrusteeUserAddress: 'trustee-b',
            TrusteeDisplayName: 'Trustee B',
            ShareIndex: 2,
          }),
          createFinalizationShare({
            Id: 'finalization-share-3',
            TrusteeUserAddress: 'trustee-c',
            TrusteeDisplayName: 'Trustee C',
            ShareIndex: 3,
          }),
          createFinalizationShare({
            Id: 'finalization-share-4',
            TrusteeUserAddress: 'trustee-d',
            TrusteeDisplayName: 'Trustee D',
            ShareIndex: 4,
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

    expect(await screen.findByText(/Latest share status:/)).toHaveTextContent(
      'wrong_tally_target'
    );
    expect(screen.getByText(/Latest share status:/)).toHaveTextContent(
      'The submitted artifact targets a different tally hash.'
    );
    expect(screen.getByText(/Latest share status:/)).toHaveTextContent(
      'Recovery: reload the exact target refs'
    );
    expect(screen.getByTestId('trustee-finalization-exact-target')).toHaveTextContent(
      'SP-06 threshold: 3 accepted, 1 missing, 1 rejected; requires 3 of 5.'
    );
    expect(screen.queryByText(vaultFixture.shareMaterial)).not.toBeInTheDocument();
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
    expect(screen.getByTestId('trustee-finalization-boundary-context')).toHaveTextContent(
      'Binding',
    );
    expect(screen.getByTestId('trustee-finalization-boundary-context')).toHaveTextContent(
      'non-dev circuits',
    );
    expect(screen.getByTestId('trustee-finalization-boundary-context')).toHaveTextContent('Non-dev circuit');
    expect(screen.getByTestId('trustee-finalization-boundary-context')).toHaveTextContent('prod-3of5-v1');
    expect(screen.getByTestId('trustee-finalization-boundary-context')).toHaveTextContent(
      'tally-fingerprint-1',
    );
    expect(screen.getByTestId('trustee-finalization-boundary-context')).toHaveTextContent(
      'Bound session public key issued',
    );
    expect(screen.getByTestId('trustee-finalization-boundary-context')).toHaveTextContent(
      'exact aggregate-tally release',
    );
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
