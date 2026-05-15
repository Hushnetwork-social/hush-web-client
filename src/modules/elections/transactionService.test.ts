import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as secp256k1 from '@noble/secp256k1';
import {
  aesDecrypt,
  aesDecryptBytes,
  bytesToBase64,
  bytesToHex,
  eciesDecrypt,
  eciesEncrypt,
  hexToBytes,
} from '@/lib/crypto';
import {
  ElectionFinalizationTargetTypeProto,
  type ElectionAnomalyAttachmentManifestView,
  type ElectionAnomalyMessageView,
  type ElectionAnomalyOwnerMessageView,
  type ElectionAnomalyRestrictedMessageView,
  type ElectionDraftInput,
  type SubmitElectionFinalizationShareRequest,
} from '@/lib/grpc';
import {
  ENCRYPTED_ELECTION_ENVELOPE_PAYLOAD_KIND,
  ELECTION_ANOMALY_ATTACHMENT_KIND_IDS,
  ELECTION_ANOMALY_ATTACHMENT_VALIDATION_STATUS_IDS,
  ELECTION_ANOMALY_CASE_STATE_IDS,
  ELECTION_ANOMALY_CATEGORY_IDS,
  ELECTION_ANOMALY_EVIDENCE_MIME_TYPES,
  ELECTION_ANOMALY_MESSAGE_KIND_IDS,
  ELECTION_ANOMALY_RECIPIENT_ROLE_IDS,
  ELECTION_ANOMALY_RECIPIENT_WRAP_STATUS_IDS,
  ELECTION_ANOMALY_REDACTION_REASON_IDS,
  ELECTION_ANOMALY_REDACTION_TARGET_KIND_IDS,
  ELECTION_ANOMALY_RESTRICTED_PAYLOAD_REFERENCE_PREFIX,
  ELECTION_ANOMALY_SUBMITTER_CLARIFICATION_EVIDENCE_MAX_BYTES,
  ELECTION_ANOMALY_SEVERITY_CANDIDATE_IDS,
  ELECTION_ANOMALY_VALIDATION_CODES,
  type CloseCountingExecutorSubmissionPayload,
  createAcceptElectionBallotCastTransaction,
  createAcceptElectionTrusteeInvitationTransaction,
  createRegisterElectionVotingCommitmentTransaction,
  createApproveElectionGovernedProposalTransaction,
  createClaimElectionRosterEntryTransaction,
  createClassifyElectionAnomalyThreadTransaction,
  createElectionAnomalyAttachmentContentKeyWrap,
  createElectionAnomalyOwnerAttachmentContentKeyWraps,
  createElectionAnomalyRestrictedPayloadReference,
  createElectionAnomalyRestrictedEvidencePayload,
  createElectionAnomalySubmitterAttachmentContentKeyWraps,
  createRecordElectionAnomalyAuthorityResponseTransaction,
  createRecordElectionAnomalyAuditorRecipientRewrapTransaction,
  createRecordElectionAnomalyAttachmentManifestTransaction,
  createRecordElectionAnomalyEvidenceRedactionTransaction,
  createRegisterExternalElectionAnomalyClaimantTransaction,
  createRequestElectionAnomalyInformationTransaction,
  createSubmitElectionAnomalyInformationTransaction,
  createSubmitElectionAnomalyThreadTransaction,
  computeElectionAnomalyEvidenceHash,
  decryptElectionAnomalyAttachmentPayload,
  decryptElectionAnomalyMessageBody,
  decryptElectionAnomalyOwnerMessageBody,
  decryptElectionAnomalyRestrictedMessageBody,
  createElectionDraftTransaction,
  createElectionReportAccessGrantTransaction,
  createElectionTrusteeInvitationTransaction,
  createOpenElectionTransaction,
  createRefreshProtocolPackageBindingTransaction,
  createRejectElectionTrusteeInvitationTransaction,
  createSubmitElectionFinalizationShareTransaction,
  hasElectionAnomalyDuplicateThreadValidation,
  hashExternalElectionAnomalyClaimantReference,
  prepareElectionAnomalyAttachmentManifestMaterial,
  type ClassifyElectionAnomalyThreadActionPayload,
  type ElectionAnomalyMessageEnvelopePayload,
  type RecordElectionAnomalyAuthorityResponseActionPayload,
  type RecordElectionAnomalyAuditorRecipientRewrapActionPayload,
  type RecordElectionAnomalyAttachmentManifestActionPayload,
  type RecordElectionAnomalyEvidenceRedactionActionPayload,
  type RegisterExternalElectionAnomalyClaimantActionPayload,
  type RequestElectionAnomalyInformationActionPayload,
} from './transactionService';

const { blockchainServiceMock, electionsServiceMock, identityServiceMock } = vi.hoisted(() => ({
  blockchainServiceMock: {
    getElectionEnvelopeContext: vi.fn(),
  },
  electionsServiceMock: {
    getElectionEnvelopeAccess: vi.fn(),
  },
  identityServiceMock: {
    getIdentity: vi.fn(),
  },
}));

vi.mock('@/lib/grpc/services/blockchain', () => ({
  blockchainService: {
    getElectionEnvelopeContext: (...args: unknown[]) =>
      blockchainServiceMock.getElectionEnvelopeContext(...args),
  },
}));

vi.mock('@/lib/grpc/services/elections', () => ({
  electionsService: {
    getElectionEnvelopeAccess: (...args: unknown[]) =>
      electionsServiceMock.getElectionEnvelopeAccess(...args),
  },
}));

vi.mock('@/lib/grpc/services/identity', () => ({
  identityService: {
    getIdentity: (...args: unknown[]) => identityServiceMock.getIdentity(...args),
  },
}));

describe('transactionService encrypted election envelope helpers', () => {
  beforeEach(() => {
    blockchainServiceMock.getElectionEnvelopeContext.mockReset();
    electionsServiceMock.getElectionEnvelopeAccess.mockReset();
    identityServiceMock.getIdentity.mockReset();
  });

  it('creates a v2.1 election envelope with actor key access and plaintext validator action data', async () => {
    const ownerSigningPrivateKeyHex = '1111111111111111111111111111111111111111111111111111111111111111';
    const ownerEncryptionPrivateKeyHex = '2222222222222222222222222222222222222222222222222222222222222222';
    const nodeEncryptionPrivateKeyHex = '3333333333333333333333333333333333333333333333333333333333333333';
    const ownerSigningPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(ownerSigningPrivateKeyHex), true),
    );
    const ownerEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(ownerEncryptionPrivateKeyHex), true),
    );
    const nodeEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(nodeEncryptionPrivateKeyHex), true),
    );
    blockchainServiceMock.getElectionEnvelopeContext.mockResolvedValue({
      NodePublicEncryptAddress: nodeEncryptionPublicKey,
      ElectionEnvelopeVersion: 'election-envelope-v2.1',
    });

    const draft: ElectionDraftInput = {
      Title: 'Board Election',
      ShortDescription: 'Annual board vote',
      ExternalReferenceCode: 'ORG-2026-01',
      ElectionClass: 0,
      BindingStatus: 0,
      SelectedProfileId: 'dkg-prod-3of5',
      GovernanceMode: 0,
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
      ApprovedClientApplications: [
        {
          ApplicationId: 'hushsocial',
          Version: '1.0.0',
        },
      ],
      ProtocolOmegaVersion: 'omega-v1.0.0',
      ReportingPolicy: 0,
      ReviewWindowPolicy: 0,
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
      AcknowledgedWarningCodes: [0],
      RequiredApprovalCount: 0,
    };

    const { signedTransaction, electionId } = await createElectionDraftTransaction(
      ownerSigningPublicKey,
      ownerEncryptionPublicKey,
      'initial draft',
      draft,
      ownerSigningPrivateKeyHex,
    );

    const parsedTransaction = JSON.parse(signedTransaction) as {
      PayloadKind: string;
      UserSignature: { Signatory: string };
      Payload: {
        ElectionId: string;
        EnvelopeVersion: string;
        NodeEncryptedElectionPrivateKey: string;
        ActorEncryptedElectionPrivateKey: string;
        ElectionPublicEncryptKey: string;
        EncryptedPayload: string;
        ActionType: string;
        ActionPayload: {
          OwnerPublicAddress: string;
          SnapshotReason: string;
          Draft: typeof draft;
        };
      };
    };

    expect(parsedTransaction.PayloadKind).toBe(ENCRYPTED_ELECTION_ENVELOPE_PAYLOAD_KIND);
    expect(parsedTransaction.UserSignature.Signatory).toBe(ownerSigningPublicKey);
    expect(parsedTransaction.Payload.ElectionId).toBe(electionId);
    expect(parsedTransaction.Payload.EnvelopeVersion).toBe('election-envelope-v2.1');
    expect(parsedTransaction.Payload.NodeEncryptedElectionPrivateKey).toBe('');
    expect(parsedTransaction.Payload.ElectionPublicEncryptKey).toMatch(/^(02|03|04)[0-9a-f]+$/i);
    expect(parsedTransaction.Payload.ActionType).toBe('create_draft');
    expect(parsedTransaction.Payload.ActionPayload.OwnerPublicAddress).toBe(ownerSigningPublicKey);
    expect(parsedTransaction.Payload.ActionPayload.SnapshotReason).toBe('initial draft');
    expect(parsedTransaction.Payload.ActionPayload.Draft.Title).toBe(draft.Title);

    const actorElectionPrivateKey = await eciesDecrypt(
      parsedTransaction.Payload.ActorEncryptedElectionPrivateKey,
      ownerEncryptionPrivateKeyHex,
    );

    const decryptedPayloadJson = await eciesDecrypt(
      parsedTransaction.Payload.EncryptedPayload,
      actorElectionPrivateKey,
    );
    const decryptedPayload = JSON.parse(decryptedPayloadJson) as {
      ActionType: string;
      ActionPayload: {
        OwnerPublicAddress: string;
        SnapshotReason: string;
        Draft: typeof draft;
      };
    };

    expect(hexToBytes(actorElectionPrivateKey)).toHaveLength(32);
    expect(decryptedPayload.ActionType).toBe('create_draft');
    expect(decryptedPayload.ActionPayload.OwnerPublicAddress).toBe(ownerSigningPublicKey);
    expect(decryptedPayload.ActionPayload.SnapshotReason).toBe('initial draft');
    expect(decryptedPayload.ActionPayload.Draft.Title).toBe(draft.Title);
  });

  it('creates an invite envelope that grants the trustee a wrapped election private key', async () => {
    const ownerSigningPrivateKeyHex = '1111111111111111111111111111111111111111111111111111111111111111';
    const ownerEncryptionPrivateKeyHex = '2222222222222222222222222222222222222222222222222222222222222222';
    const trusteeEncryptionPrivateKeyHex = '4444444444444444444444444444444444444444444444444444444444444444';
    const nodeEncryptionPrivateKeyHex = '3333333333333333333333333333333333333333333333333333333333333333';
    const electionPrivateKeyHex = '5555555555555555555555555555555555555555555555555555555555555555';
    const ownerSigningPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(ownerSigningPrivateKeyHex), true),
    );
    const ownerEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(ownerEncryptionPrivateKeyHex), true),
    );
    const trusteeEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(trusteeEncryptionPrivateKeyHex), true),
    );
    const nodeEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(nodeEncryptionPrivateKeyHex), true),
    );
    const actorEncryptedElectionPrivateKey = await eciesEncrypt(
      electionPrivateKeyHex,
      ownerEncryptionPublicKey,
    );

    blockchainServiceMock.getElectionEnvelopeContext.mockResolvedValue({
      NodePublicEncryptAddress: nodeEncryptionPublicKey,
      ElectionEnvelopeVersion: 'election-envelope-v2.1',
    });
    electionsServiceMock.getElectionEnvelopeAccess.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      ActorEncryptedElectionPrivateKey: actorEncryptedElectionPrivateKey,
    });
    identityServiceMock.getIdentity.mockResolvedValue({
      Successfull: true,
      Message: '',
      ProfileName: 'Zoe Trustee',
      PublicSigningAddress: 'trustee-address',
      PublicEncryptAddress: trusteeEncryptionPublicKey,
      IsPublic: false,
    });

    const { signedTransaction } = await createElectionTrusteeInvitationTransaction(
      'election-123',
      ownerSigningPublicKey,
      ownerEncryptionPublicKey,
      ownerEncryptionPrivateKeyHex,
      'trustee-address',
      'Zoe Trustee',
      ownerSigningPrivateKeyHex,
    );

    const parsedTransaction = JSON.parse(signedTransaction) as {
      Payload: {
        ActionPayload: {
          TrusteeUserAddress: string;
          TrusteeEncryptedElectionPrivateKey?: string;
        };
        ActionArtifacts?: {
          TrusteeEncryptedElectionPrivateKey: string;
        };
        ActorEncryptedElectionPrivateKey: string;
        EncryptedPayload: string;
      };
    };

    const actorElectionPrivateKey = await eciesDecrypt(
      parsedTransaction.Payload.ActorEncryptedElectionPrivateKey,
      ownerEncryptionPrivateKeyHex,
    );
    const decryptedPayloadJson = await eciesDecrypt(
      parsedTransaction.Payload.EncryptedPayload,
      actorElectionPrivateKey,
    );
    const decryptedPayload = JSON.parse(decryptedPayloadJson) as {
      ActionType: string;
      ActionPayload: {
        TrusteeUserAddress: string;
        TrusteeEncryptedElectionPrivateKey: string;
      };
    };
    const trusteeElectionPrivateKey = await eciesDecrypt(
      parsedTransaction.Payload.ActionArtifacts!.TrusteeEncryptedElectionPrivateKey,
      trusteeEncryptionPrivateKeyHex,
    );

    expect(decryptedPayload.ActionType).toBe('invite_trustee');
    expect(parsedTransaction.Payload.ActionPayload.TrusteeEncryptedElectionPrivateKey).toBeUndefined();
    expect(decryptedPayload.ActionPayload.TrusteeUserAddress).toBe('trustee-address');
    expect(trusteeElectionPrivateKey).toBe(electionPrivateKeyHex);
  });

  it('creates a trustee-acceptance envelope without requiring existing election envelope access', async () => {
    const trusteeSigningPrivateKeyHex = '6666666666666666666666666666666666666666666666666666666666666666';
    const trusteeEncryptionPrivateKeyHex = '4444444444444444444444444444444444444444444444444444444444444444';
    const nodeEncryptionPrivateKeyHex = '3333333333333333333333333333333333333333333333333333333333333333';
    const trusteeSigningPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(trusteeSigningPrivateKeyHex), true),
    );
    const trusteeEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(trusteeEncryptionPrivateKeyHex), true),
    );
    const nodeEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(nodeEncryptionPrivateKeyHex), true),
    );

    blockchainServiceMock.getElectionEnvelopeContext.mockResolvedValue({
      NodePublicEncryptAddress: nodeEncryptionPublicKey,
      ElectionEnvelopeVersion: 'election-envelope-v2.1',
    });
    electionsServiceMock.getElectionEnvelopeAccess.mockResolvedValue({
      Success: false,
      ErrorMessage: 'should not be used',
      ActorEncryptedElectionPrivateKey: '',
    });

    const { signedTransaction } = await createAcceptElectionTrusteeInvitationTransaction(
      'election-123',
      'invite-123',
      trusteeSigningPublicKey,
      trusteeEncryptionPublicKey,
      trusteeEncryptionPrivateKeyHex,
      trusteeSigningPrivateKeyHex,
    );

    const parsedTransaction = JSON.parse(signedTransaction) as {
      PayloadKind: string;
      Payload: {
        ActorEncryptedElectionPrivateKey: string;
        EncryptedPayload: string;
      };
    };

    const actorElectionPrivateKey = await eciesDecrypt(
      parsedTransaction.Payload.ActorEncryptedElectionPrivateKey,
      trusteeEncryptionPrivateKeyHex,
    );
    const decryptedPayloadJson = await eciesDecrypt(
      parsedTransaction.Payload.EncryptedPayload,
      actorElectionPrivateKey,
    );
    const decryptedPayload = JSON.parse(decryptedPayloadJson) as {
      ActionType: string;
      ActionPayload: {
        InvitationId: string;
        ActorPublicAddress: string;
      };
    };

    expect(parsedTransaction.PayloadKind).toBe(ENCRYPTED_ELECTION_ENVELOPE_PAYLOAD_KIND);
    expect(electionsServiceMock.getElectionEnvelopeAccess).not.toHaveBeenCalled();
    expect(decryptedPayload.ActionType).toBe('accept_trustee_invitation');
    expect(decryptedPayload.ActionPayload.InvitationId).toBe('invite-123');
    expect(decryptedPayload.ActionPayload.ActorPublicAddress).toBe(trusteeSigningPublicKey);
  });

  it('creates a trustee-rejection envelope without requiring existing election envelope access', async () => {
    const trusteeSigningPrivateKeyHex = '6666666666666666666666666666666666666666666666666666666666666666';
    const trusteeEncryptionPrivateKeyHex = '4444444444444444444444444444444444444444444444444444444444444444';
    const nodeEncryptionPrivateKeyHex = '3333333333333333333333333333333333333333333333333333333333333333';
    const trusteeSigningPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(trusteeSigningPrivateKeyHex), true),
    );
    const trusteeEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(trusteeEncryptionPrivateKeyHex), true),
    );
    const nodeEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(nodeEncryptionPrivateKeyHex), true),
    );

    blockchainServiceMock.getElectionEnvelopeContext.mockResolvedValue({
      NodePublicEncryptAddress: nodeEncryptionPublicKey,
      ElectionEnvelopeVersion: 'election-envelope-v2.1',
    });
    electionsServiceMock.getElectionEnvelopeAccess.mockResolvedValue({
      Success: false,
      ErrorMessage: 'should not be used',
      ActorEncryptedElectionPrivateKey: '',
    });

    const { signedTransaction } = await createRejectElectionTrusteeInvitationTransaction(
      'election-123',
      'invite-123',
      trusteeSigningPublicKey,
      trusteeEncryptionPublicKey,
      trusteeEncryptionPrivateKeyHex,
      trusteeSigningPrivateKeyHex,
    );

    const parsedTransaction = JSON.parse(signedTransaction) as {
      PayloadKind: string;
      Payload: {
        ActorEncryptedElectionPrivateKey: string;
        EncryptedPayload: string;
      };
    };

    const actorElectionPrivateKey = await eciesDecrypt(
      parsedTransaction.Payload.ActorEncryptedElectionPrivateKey,
      trusteeEncryptionPrivateKeyHex,
    );
    const decryptedPayloadJson = await eciesDecrypt(
      parsedTransaction.Payload.EncryptedPayload,
      actorElectionPrivateKey,
    );
    const decryptedPayload = JSON.parse(decryptedPayloadJson) as {
      ActionType: string;
      ActionPayload: {
        InvitationId: string;
        ActorPublicAddress: string;
      };
    };

    expect(parsedTransaction.PayloadKind).toBe(ENCRYPTED_ELECTION_ENVELOPE_PAYLOAD_KIND);
    expect(electionsServiceMock.getElectionEnvelopeAccess).not.toHaveBeenCalled();
    expect(decryptedPayload.ActionType).toBe('reject_trustee_invitation');
    expect(decryptedPayload.ActionPayload.InvitationId).toBe('invite-123');
    expect(decryptedPayload.ActionPayload.ActorPublicAddress).toBe(trusteeSigningPublicKey);
  });

  it('creates a designated-auditor grant envelope using the existing election key wrappers', async () => {
    const ownerSigningPrivateKeyHex = '1111111111111111111111111111111111111111111111111111111111111111';
    const ownerEncryptionPrivateKeyHex = '2222222222222222222222222222222222222222222222222222222222222222';
    const nodeEncryptionPrivateKeyHex = '3333333333333333333333333333333333333333333333333333333333333333';
    const electionPrivateKeyHex = '5555555555555555555555555555555555555555555555555555555555555555';
    const ownerSigningPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(ownerSigningPrivateKeyHex), true),
    );
    const ownerEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(ownerEncryptionPrivateKeyHex), true),
    );
    const nodeEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(nodeEncryptionPrivateKeyHex), true),
    );
    const actorEncryptedElectionPrivateKey = await eciesEncrypt(
      electionPrivateKeyHex,
      ownerEncryptionPublicKey,
    );

    blockchainServiceMock.getElectionEnvelopeContext.mockResolvedValue({
      NodePublicEncryptAddress: nodeEncryptionPublicKey,
      ElectionEnvelopeVersion: 'election-envelope-v2.1',
    });
    electionsServiceMock.getElectionEnvelopeAccess.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      ActorEncryptedElectionPrivateKey: actorEncryptedElectionPrivateKey,
    });

    const { signedTransaction } = await createElectionReportAccessGrantTransaction(
      'election-123',
      ownerSigningPublicKey,
      ownerEncryptionPublicKey,
      ownerEncryptionPrivateKeyHex,
      'auditor-address',
      ownerSigningPrivateKeyHex,
    );

    const parsedTransaction = JSON.parse(signedTransaction) as {
      PayloadKind: string;
      Payload: {
        ActionPayload: {
          ActorPublicAddress: string;
          OrganizationVoterId: string;
          VerificationCode?: string;
        };
        ActorEncryptedElectionPrivateKey: string;
        EncryptedPayload: string;
      };
    };

    expect(parsedTransaction.PayloadKind).toBe(ENCRYPTED_ELECTION_ENVELOPE_PAYLOAD_KIND);
    expect(parsedTransaction.Payload.ActionPayload.VerificationCode).toBeUndefined();

    const actorElectionPrivateKey = await eciesDecrypt(
      parsedTransaction.Payload.ActorEncryptedElectionPrivateKey,
      ownerEncryptionPrivateKeyHex,
    );
    const decryptedPayloadJson = await eciesDecrypt(
      parsedTransaction.Payload.EncryptedPayload,
      actorElectionPrivateKey,
    );
    const decryptedPayload = JSON.parse(decryptedPayloadJson) as {
      ActionType: string;
      ActionPayload: {
        ActorPublicAddress: string;
        DesignatedAuditorPublicAddress: string;
      };
    };

    expect(decryptedPayload.ActionType).toBe('create_report_access_grant');
    expect(decryptedPayload.ActionPayload.ActorPublicAddress).toBe(ownerSigningPublicKey);
    expect(decryptedPayload.ActionPayload.DesignatedAuditorPublicAddress).toBe(
      'auditor-address',
    );
  });

  it('creates an encrypted open-election envelope using the existing election key wrappers', async () => {
    const ownerSigningPrivateKeyHex = '1111111111111111111111111111111111111111111111111111111111111111';
    const ownerEncryptionPrivateKeyHex = '2222222222222222222222222222222222222222222222222222222222222222';
    const nodeEncryptionPrivateKeyHex = '3333333333333333333333333333333333333333333333333333333333333333';
    const electionPrivateKeyHex = '5555555555555555555555555555555555555555555555555555555555555555';
    const ownerSigningPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(ownerSigningPrivateKeyHex), true),
    );
    const ownerEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(ownerEncryptionPrivateKeyHex), true),
    );
    const nodeEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(nodeEncryptionPrivateKeyHex), true),
    );
    const actorEncryptedElectionPrivateKey = await eciesEncrypt(
      electionPrivateKeyHex,
      ownerEncryptionPublicKey,
    );

    blockchainServiceMock.getElectionEnvelopeContext.mockResolvedValue({
      NodePublicEncryptAddress: nodeEncryptionPublicKey,
      ElectionEnvelopeVersion: 'election-envelope-v2.1',
    });
    electionsServiceMock.getElectionEnvelopeAccess.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      ActorEncryptedElectionPrivateKey: actorEncryptedElectionPrivateKey,
    });

    const { signedTransaction } = await createOpenElectionTransaction(
      'election-123',
      ownerSigningPublicKey,
      ownerEncryptionPublicKey,
      ownerEncryptionPrivateKeyHex,
      [1, 2],
      null,
      'trustee-policy-ref',
      'reporting-policy-ref',
      'review-window-ref',
      ownerSigningPrivateKeyHex,
    );

    const parsedTransaction = JSON.parse(signedTransaction) as {
      PayloadKind: string;
      Payload: {
        ActorEncryptedElectionPrivateKey: string;
        EncryptedPayload: string;
      };
    };

    expect(parsedTransaction.PayloadKind).toBe(ENCRYPTED_ELECTION_ENVELOPE_PAYLOAD_KIND);

    const actorElectionPrivateKey = await eciesDecrypt(
      parsedTransaction.Payload.ActorEncryptedElectionPrivateKey,
      ownerEncryptionPrivateKeyHex,
    );
    const decryptedPayloadJson = await eciesDecrypt(
      parsedTransaction.Payload.EncryptedPayload,
      actorElectionPrivateKey,
    );
    const decryptedPayload = JSON.parse(decryptedPayloadJson) as {
      ActionType: string;
      ActionPayload: {
        ActorPublicAddress: string;
        RequiredWarningCodes: number[];
        TrusteePolicyExecutionReference: string;
      };
    };

    expect(decryptedPayload.ActionType).toBe('open_election');
    expect(decryptedPayload.ActionPayload.ActorPublicAddress).toBe(ownerSigningPublicKey);
    expect(decryptedPayload.ActionPayload.RequiredWarningCodes).toEqual([1, 2]);
    expect(decryptedPayload.ActionPayload.TrusteePolicyExecutionReference).toBe('trustee-policy-ref');
  });

  it('creates an encrypted protocol-package refresh envelope for the owner actor', async () => {
    const ownerSigningPrivateKeyHex = '1111111111111111111111111111111111111111111111111111111111111111';
    const ownerEncryptionPrivateKeyHex = '2222222222222222222222222222222222222222222222222222222222222222';
    const nodeEncryptionPrivateKeyHex = '3333333333333333333333333333333333333333333333333333333333333333';
    const electionPrivateKeyHex = '5555555555555555555555555555555555555555555555555555555555555555';
    const ownerSigningPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(ownerSigningPrivateKeyHex), true),
    );
    const ownerEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(ownerEncryptionPrivateKeyHex), true),
    );
    const nodeEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(nodeEncryptionPrivateKeyHex), true),
    );
    const actorEncryptedElectionPrivateKey = await eciesEncrypt(
      electionPrivateKeyHex,
      ownerEncryptionPublicKey,
    );

    blockchainServiceMock.getElectionEnvelopeContext.mockResolvedValue({
      NodePublicEncryptAddress: nodeEncryptionPublicKey,
      ElectionEnvelopeVersion: 'election-envelope-v2.1',
    });
    electionsServiceMock.getElectionEnvelopeAccess.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      ActorEncryptedElectionPrivateKey: actorEncryptedElectionPrivateKey,
    });

    const { signedTransaction } = await createRefreshProtocolPackageBindingTransaction(
      'election-123',
      ownerSigningPublicKey,
      ownerEncryptionPublicKey,
      ownerEncryptionPrivateKeyHex,
      ownerSigningPrivateKeyHex,
    );

    const parsedTransaction = JSON.parse(signedTransaction) as {
      PayloadKind: string;
      Payload: {
        ActorEncryptedElectionPrivateKey: string;
        EncryptedPayload: string;
      };
    };

    expect(parsedTransaction.PayloadKind).toBe(ENCRYPTED_ELECTION_ENVELOPE_PAYLOAD_KIND);

    const actorElectionPrivateKey = await eciesDecrypt(
      parsedTransaction.Payload.ActorEncryptedElectionPrivateKey,
      ownerEncryptionPrivateKeyHex,
    );
    const decryptedPayloadJson = await eciesDecrypt(
      parsedTransaction.Payload.EncryptedPayload,
      actorElectionPrivateKey,
    );
    const decryptedPayload = JSON.parse(decryptedPayloadJson) as {
      ActionType: string;
      ActionPayload: {
        ActorPublicAddress: string;
      };
    };

    expect(decryptedPayload.ActionType).toBe('refresh_protocol_package_binding');
    expect(decryptedPayload.ActionPayload.ActorPublicAddress).toBe(ownerSigningPublicKey);
  });

  it('creates an encrypted governed-approval envelope for a trustee actor', async () => {
    const trusteeSigningPrivateKeyHex = '6666666666666666666666666666666666666666666666666666666666666666';
    const trusteeEncryptionPrivateKeyHex = '4444444444444444444444444444444444444444444444444444444444444444';
    const nodeEncryptionPrivateKeyHex = '3333333333333333333333333333333333333333333333333333333333333333';
    const electionPrivateKeyHex = '5555555555555555555555555555555555555555555555555555555555555555';
    const trusteeSigningPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(trusteeSigningPrivateKeyHex), true),
    );
    const trusteeEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(trusteeEncryptionPrivateKeyHex), true),
    );
    const nodeEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(nodeEncryptionPrivateKeyHex), true),
    );
    const actorEncryptedElectionPrivateKey = await eciesEncrypt(
      electionPrivateKeyHex,
      trusteeEncryptionPublicKey,
    );

    blockchainServiceMock.getElectionEnvelopeContext.mockResolvedValue({
      NodePublicEncryptAddress: nodeEncryptionPublicKey,
      ElectionEnvelopeVersion: 'election-envelope-v2.1',
    });
    electionsServiceMock.getElectionEnvelopeAccess.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      ActorEncryptedElectionPrivateKey: actorEncryptedElectionPrivateKey,
    });

    const { signedTransaction } = await createApproveElectionGovernedProposalTransaction(
      'election-123',
      'proposal-77',
      trusteeSigningPublicKey,
      trusteeEncryptionPublicKey,
      trusteeEncryptionPrivateKeyHex,
      'Looks good',
      trusteeSigningPrivateKeyHex,
    );

    const parsedTransaction = JSON.parse(signedTransaction) as {
      PayloadKind: string;
      Payload: {
        ActorEncryptedElectionPrivateKey: string;
        EncryptedPayload: string;
      };
    };

    expect(parsedTransaction.PayloadKind).toBe(ENCRYPTED_ELECTION_ENVELOPE_PAYLOAD_KIND);

    const actorElectionPrivateKey = await eciesDecrypt(
      parsedTransaction.Payload.ActorEncryptedElectionPrivateKey,
      trusteeEncryptionPrivateKeyHex,
    );
    const decryptedPayloadJson = await eciesDecrypt(
      parsedTransaction.Payload.EncryptedPayload,
      actorElectionPrivateKey,
    );
    const decryptedPayload = JSON.parse(decryptedPayloadJson) as {
      ActionType: string;
      ActionPayload: {
        ProposalId: string;
        ActorPublicAddress: string;
        ApprovalNote: string;
      };
    };

    expect(decryptedPayload.ActionType).toBe('approve_governed_proposal');
    expect(decryptedPayload.ActionPayload.ProposalId).toBe('proposal-77');
    expect(decryptedPayload.ActionPayload.ActorPublicAddress).toBe(trusteeSigningPublicKey);
    expect(decryptedPayload.ActionPayload.ApprovalNote).toBe('Looks good');
  });

  it('creates a claim-link envelope without reading stored election envelope access', async () => {
    const voterSigningPrivateKeyHex = '7777777777777777777777777777777777777777777777777777777777777777';
    const voterEncryptionPrivateKeyHex = '8888888888888888888888888888888888888888888888888888888888888888';
    const nodeEncryptionPrivateKeyHex = '3333333333333333333333333333333333333333333333333333333333333333';
    const voterSigningPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(voterSigningPrivateKeyHex), true),
    );
    const voterEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(voterEncryptionPrivateKeyHex), true),
    );
    const nodeEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(nodeEncryptionPrivateKeyHex), true),
    );

    blockchainServiceMock.getElectionEnvelopeContext.mockResolvedValue({
      NodePublicEncryptAddress: nodeEncryptionPublicKey,
      ElectionEnvelopeVersion: 'election-envelope-v2.1',
    });
    const { signedTransaction } = await createClaimElectionRosterEntryTransaction(
      'election-123',
      voterSigningPublicKey,
      voterEncryptionPublicKey,
      '10042',
      '1111',
      voterSigningPrivateKeyHex,
      voterEncryptionPrivateKeyHex,
    );

    const parsedTransaction = JSON.parse(signedTransaction) as {
      PayloadKind: string;
      Payload: {
        ActorEncryptedElectionPrivateKey: string;
        EncryptedPayload: string;
      };
    };

    expect(parsedTransaction.PayloadKind).toBe(ENCRYPTED_ELECTION_ENVELOPE_PAYLOAD_KIND);

    const actorElectionPrivateKey = await eciesDecrypt(
      parsedTransaction.Payload.ActorEncryptedElectionPrivateKey,
      voterEncryptionPrivateKeyHex,
    );
    const decryptedPayloadJson = await eciesDecrypt(
      parsedTransaction.Payload.EncryptedPayload,
      actorElectionPrivateKey,
    );
    const decryptedPayload = JSON.parse(decryptedPayloadJson) as {
      ActionType: string;
      ActionPayload: {
        ActorPublicAddress: string;
        OrganizationVoterId: string;
        VerificationCode: string;
      };
    };

    expect(hexToBytes(actorElectionPrivateKey)).toHaveLength(32);
    expect(decryptedPayload.ActionType).toBe('claim_roster_entry');
    expect(decryptedPayload.ActionPayload.ActorPublicAddress).toBe(voterSigningPublicKey);
    expect(decryptedPayload.ActionPayload.OrganizationVoterId).toBe('10042');
    expect(decryptedPayload.ActionPayload.VerificationCode).toBe('1111');
    expect(electionsServiceMock.getElectionEnvelopeAccess).not.toHaveBeenCalled();
  });

  it('creates a register-voting-commitment envelope without reading stored election envelope access', async () => {
    const voterSigningPrivateKeyHex = '7777777777777777777777777777777777777777777777777777777777777777';
    const voterEncryptionPrivateKeyHex = '8888888888888888888888888888888888888888888888888888888888888888';
    const nodeEncryptionPrivateKeyHex = '3333333333333333333333333333333333333333333333333333333333333333';
    const voterSigningPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(voterSigningPrivateKeyHex), true),
    );
    const voterEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(voterEncryptionPrivateKeyHex), true),
    );
    const nodeEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(nodeEncryptionPrivateKeyHex), true),
    );
    blockchainServiceMock.getElectionEnvelopeContext.mockResolvedValue({
      NodePublicEncryptAddress: nodeEncryptionPublicKey,
      ElectionEnvelopeVersion: 'election-envelope-v2.1',
    });

    const { signedTransaction } = await createRegisterElectionVotingCommitmentTransaction(
      'election-123',
      voterSigningPublicKey,
      voterEncryptionPublicKey,
      voterEncryptionPrivateKeyHex,
      'commitment-hash-1',
      voterSigningPrivateKeyHex,
    );

    const parsedTransaction = JSON.parse(signedTransaction) as {
      PayloadKind: string;
      Payload: {
        ActorEncryptedElectionPrivateKey: string;
        EncryptedPayload: string;
      };
    };

    expect(parsedTransaction.PayloadKind).toBe(ENCRYPTED_ELECTION_ENVELOPE_PAYLOAD_KIND);

    const actorElectionPrivateKey = await eciesDecrypt(
      parsedTransaction.Payload.ActorEncryptedElectionPrivateKey,
      voterEncryptionPrivateKeyHex,
    );
    const decryptedPayloadJson = await eciesDecrypt(
      parsedTransaction.Payload.EncryptedPayload,
      actorElectionPrivateKey,
    );
    const decryptedPayload = JSON.parse(decryptedPayloadJson) as {
      ActionType: string;
      ActionPayload: {
        ActorPublicAddress: string;
        CommitmentHash: string;
      };
    };

    expect(decryptedPayload.ActionType).toBe('register_voting_commitment');
    expect(decryptedPayload.ActionPayload.ActorPublicAddress).toBe(voterSigningPublicKey);
    expect(decryptedPayload.ActionPayload.CommitmentHash).toBe('commitment-hash-1');
    expect(electionsServiceMock.getElectionEnvelopeAccess).not.toHaveBeenCalled();
  });

  it('creates an accept-ballot-cast envelope with the FEAT-099 cast boundary fields without reading stored election envelope access', async () => {
    const voterSigningPrivateKeyHex = '7777777777777777777777777777777777777777777777777777777777777777';
    const voterEncryptionPrivateKeyHex = '8888888888888888888888888888888888888888888888888888888888888888';
    const nodeEncryptionPrivateKeyHex = '3333333333333333333333333333333333333333333333333333333333333333';
    const voterSigningPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(voterSigningPrivateKeyHex), true),
    );
    const voterEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(voterEncryptionPrivateKeyHex), true),
    );
    const nodeEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(nodeEncryptionPrivateKeyHex), true),
    );
    blockchainServiceMock.getElectionEnvelopeContext.mockResolvedValue({
      NodePublicEncryptAddress: nodeEncryptionPublicKey,
      ElectionEnvelopeVersion: 'election-envelope-v2.1',
    });

    const { signedTransaction } = await createAcceptElectionBallotCastTransaction(
      'election-123',
      voterSigningPublicKey,
      voterEncryptionPublicKey,
      voterEncryptionPrivateKeyHex,
      'cast-key-1',
      'ciphertext-ballot-package',
      'proof-bundle',
      'nullifier-1',
      'open-artifact-7',
      'AQIDBA==',
      'ceremony-version-5',
      'dkg-prod-1of1',
      'tally-fingerprint-9',
      voterSigningPrivateKeyHex,
    );

    const parsedTransaction = JSON.parse(signedTransaction) as {
      PayloadKind: string;
      Payload: {
        ActorEncryptedElectionPrivateKey: string;
        EncryptedPayload: string;
      };
    };

    expect(parsedTransaction.PayloadKind).toBe(ENCRYPTED_ELECTION_ENVELOPE_PAYLOAD_KIND);

    const actorElectionPrivateKey = await eciesDecrypt(
      parsedTransaction.Payload.ActorEncryptedElectionPrivateKey,
      voterEncryptionPrivateKeyHex,
    );
    const decryptedPayloadJson = await eciesDecrypt(
      parsedTransaction.Payload.EncryptedPayload,
      actorElectionPrivateKey,
    );
    const decryptedPayload = JSON.parse(decryptedPayloadJson) as {
      ActionType: string;
      ActionPayload: {
        ActorPublicAddress: string;
        IdempotencyKey: string;
        EncryptedBallotPackage: string;
        ProofBundle: string;
        BallotNullifier: string;
        OpenArtifactId: string;
        EligibleSetHash: string;
        CeremonyVersionId: string;
        DkgProfileId: string;
        TallyPublicKeyFingerprint: string;
      };
    };

    expect(decryptedPayload.ActionType).toBe('accept_ballot_cast');
    expect(decryptedPayload.ActionPayload.ActorPublicAddress).toBe(voterSigningPublicKey);
    expect(decryptedPayload.ActionPayload.IdempotencyKey).toBe('cast-key-1');
    expect(decryptedPayload.ActionPayload.EncryptedBallotPackage).toBe('ciphertext-ballot-package');
    expect(decryptedPayload.ActionPayload.ProofBundle).toBe('proof-bundle');
    expect(decryptedPayload.ActionPayload.BallotNullifier).toBe('nullifier-1');
    expect(decryptedPayload.ActionPayload.OpenArtifactId).toBe('open-artifact-7');
    expect(decryptedPayload.ActionPayload.EligibleSetHash).toBe('AQIDBA==');
    expect(decryptedPayload.ActionPayload.CeremonyVersionId).toBe('ceremony-version-5');
    expect(decryptedPayload.ActionPayload.DkgProfileId).toBe('dkg-prod-1of1');
    expect(decryptedPayload.ActionPayload.TallyPublicKeyFingerprint).toBe('tally-fingerprint-9');
    expect(electionsServiceMock.getElectionEnvelopeAccess).not.toHaveBeenCalled();
  });

  it('creates a voter anomaly thread envelope with encrypted body and submitter/owner wraps', async () => {
    const voterSigningPrivateKeyHex = '7777777777777777777777777777777777777777777777777777777777777777';
    const voterEncryptionPrivateKeyHex = '8888888888888888888888888888888888888888888888888888888888888888';
    const ownerSigningPrivateKeyHex = '1111111111111111111111111111111111111111111111111111111111111111';
    const ownerEncryptionPrivateKeyHex = '2222222222222222222222222222222222222222222222222222222222222222';
    const nodeEncryptionPrivateKeyHex = '3333333333333333333333333333333333333333333333333333333333333333';
    const voterSigningPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(voterSigningPrivateKeyHex), true),
    );
    const voterEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(voterEncryptionPrivateKeyHex), true),
    );
    const ownerSigningPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(ownerSigningPrivateKeyHex), true),
    );
    const ownerEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(ownerEncryptionPrivateKeyHex), true),
    );
    const nodeEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(nodeEncryptionPrivateKeyHex), true),
    );
    blockchainServiceMock.getElectionEnvelopeContext.mockResolvedValue({
      NodePublicEncryptAddress: nodeEncryptionPublicKey,
      ElectionEnvelopeVersion: 'election-envelope-v2.1',
    });
    identityServiceMock.getIdentity.mockResolvedValue({
      Successfull: true,
      Message: '',
      ProfileName: 'Election Owner',
      PublicSigningAddress: ownerSigningPublicKey,
      PublicEncryptAddress: ownerEncryptionPublicKey,
      IsPublic: false,
    });

    const { signedTransaction, anomalyThreadId } = await createSubmitElectionAnomalyThreadTransaction({
      ElectionId: 'election-123',
      ActorPublicAddress: voterSigningPublicKey,
      ActorPublicEncryptAddress: voterEncryptionPublicKey,
      ActorPrivateEncryptKeyHex: voterEncryptionPrivateKeyHex,
      OwnerPublicAddress: ownerSigningPublicKey,
      CategoryId: ELECTION_ANOMALY_CATEGORY_IDS.BALLOT_CASTING_OR_RECEIPT,
      Body: 'Receipt verification did not match my ballot status.',
      SigningPrivateKeyHex: voterSigningPrivateKeyHex,
    });

    const parsedTransaction = JSON.parse(signedTransaction) as {
      PayloadKind: string;
      Payload: {
        ActionType: string;
        ActionPayload: Record<string, unknown> & {
          InitialMessage: ElectionAnomalyMessageEnvelopePayload;
        };
        ActorEncryptedElectionPrivateKey: string;
        EncryptedPayload: string;
      };
    };

    expect(parsedTransaction.PayloadKind).toBe(ENCRYPTED_ELECTION_ENVELOPE_PAYLOAD_KIND);
    expect(parsedTransaction.Payload.ActionType).toBe('submit_anomaly_thread');
    expect(parsedTransaction.Payload.ActionPayload.AnomalyThreadId).toBe(anomalyThreadId);
    expect(JSON.stringify(parsedTransaction.Payload.ActionPayload)).not.toContain('submitterPersonScopeId');
    expect(electionsServiceMock.getElectionEnvelopeAccess).not.toHaveBeenCalled();

    const actorElectionPrivateKey = await eciesDecrypt(
      parsedTransaction.Payload.ActorEncryptedElectionPrivateKey,
      voterEncryptionPrivateKeyHex,
    );
    const decryptedPayloadJson = await eciesDecrypt(
      parsedTransaction.Payload.EncryptedPayload,
      actorElectionPrivateKey,
    );
    const decryptedPayload = JSON.parse(decryptedPayloadJson) as {
      ActionType: string;
      ActionPayload: {
        CategoryId: string;
        InitialMessage: ElectionAnomalyMessageEnvelopePayload;
      };
    };
    const message = decryptedPayload.ActionPayload.InitialMessage;

    expect(decryptedPayload.ActionType).toBe('submit_anomaly_thread');
    expect(decryptedPayload.ActionPayload.CategoryId).toBe(
      ELECTION_ANOMALY_CATEGORY_IDS.BALLOT_CASTING_OR_RECEIPT,
    );
    expect(message.MessageKindId).toBe('initial_submission');
    expect(message.PlaintextCharacterCount).toBe(52);
    expect(message.EncryptedBody).not.toContain('Receipt verification');
    expect(message.EncryptedBodyHash).toMatch(/^sha256:/);
    expect(message.PlaintextBodyHash).toMatch(/^sha256:/);
    expect(message.RecipientWraps).toHaveLength(2);

    const submitterWrap = message.RecipientWraps.find((wrap) =>
      wrap.RecipientRoleId === ELECTION_ANOMALY_RECIPIENT_ROLE_IDS.SUBMITTER
    )!;
    const ownerWrap = message.RecipientWraps.find((wrap) =>
      wrap.RecipientRoleId === ELECTION_ANOMALY_RECIPIENT_ROLE_IDS.ELECTION_OWNER
    )!;
    const submitterContentKey = await eciesDecrypt(
      submitterWrap.EncryptedContentKey,
      voterEncryptionPrivateKeyHex,
    );
    const ownerContentKey = await eciesDecrypt(
      ownerWrap.EncryptedContentKey,
      ownerEncryptionPrivateKeyHex,
    );

    await expect(aesDecrypt(message.EncryptedBody, submitterContentKey)).resolves.toBe(
      'Receipt verification did not match my ballot status.',
    );
    await expect(aesDecrypt(message.EncryptedBody, ownerContentKey)).resolves.toBe(
      'Receipt verification did not match my ballot status.',
    );
    await expect(decryptElectionAnomalyMessageBody({
      MessageId: message.MessageId,
      MessageKindId: message.MessageKindId,
      EncryptedBody: message.EncryptedBody,
      EncryptedBodyHash: message.EncryptedBodyHash,
      PlaintextCharacterCount: message.PlaintextCharacterCount,
      RecipientWraps: message.RecipientWraps,
      ClarificationRequestId: '',
      HasClarificationRequest: false,
      AttachmentManifestHash: '',
    } satisfies ElectionAnomalyMessageView, voterEncryptionPrivateKeyHex)).resolves.toBe(
      'Receipt verification did not match my ballot status.',
    );
    await expect(decryptElectionAnomalyRestrictedMessageBody({
      MessageId: message.MessageId,
      MessageKindId: message.MessageKindId,
      EncryptedBody: message.EncryptedBody,
      EncryptedBodyHash: message.EncryptedBodyHash,
      PlaintextCharacterCount: message.PlaintextCharacterCount,
      RecipientStatuses: [
        {
          RecipientRoleId: ELECTION_ANOMALY_RECIPIENT_ROLE_IDS.DESIGNATED_AUDITOR,
          WrapStatusId: ELECTION_ANOMALY_RECIPIENT_WRAP_STATUS_IDS.AVAILABLE,
        },
      ],
      HasCallerAuditorWrap: true,
      CallerAuditorWrap: {
        WrapStatusId: ELECTION_ANOMALY_RECIPIENT_WRAP_STATUS_IDS.AVAILABLE,
        RecipientKeyFingerprint: submitterWrap.RecipientKeyFingerprint,
        EncryptedContentKey: submitterWrap.EncryptedContentKey,
        WrapAlgorithm: submitterWrap.WrapAlgorithm,
      },
      ClarificationRequestId: '',
      HasClarificationRequest: false,
      AttachmentManifestHash: '',
    } satisfies ElectionAnomalyRestrictedMessageView, voterEncryptionPrivateKeyHex)).resolves.toBe(
      'Receipt verification did not match my ballot status.',
    );
  });

  it('validates anomaly category and body constraints before creating a thread transaction', async () => {
    const baseInput = {
      ElectionId: 'election-123',
      ActorPublicAddress: 'actor-address',
      ActorPublicEncryptAddress: 'actor-encrypt-address',
      ActorPrivateEncryptKeyHex: 'actor-private-key',
      OwnerPublicAddress: 'owner-address',
      CategoryId: ELECTION_ANOMALY_CATEGORY_IDS.ACCESS_OR_AUTHENTICATION,
      Body: 'valid report body',
      SigningPrivateKeyHex: 'signing-private-key',
    };

    await expect(createSubmitElectionAnomalyThreadTransaction({
      ...baseInput,
      CategoryId: 'unexpected_category',
    })).rejects.toThrow(ELECTION_ANOMALY_VALIDATION_CODES.CATEGORY_INVALID);
    await expect(createSubmitElectionAnomalyThreadTransaction({
      ...baseInput,
      Body: '   ',
    })).rejects.toThrow(ELECTION_ANOMALY_VALIDATION_CODES.BODY_REQUIRED);
    await expect(createSubmitElectionAnomalyThreadTransaction({
      ...baseInput,
      Body: 'x'.repeat(1001),
    })).rejects.toThrow(ELECTION_ANOMALY_VALIDATION_CODES.BODY_TOO_LONG);
  });

  it('creates an owner-authorized auditor anomaly recipient rewrap envelope', async () => {
    const ownerSigningPrivateKeyHex = '1111111111111111111111111111111111111111111111111111111111111111';
    const ownerEncryptionPrivateKeyHex = '2222222222222222222222222222222222222222222222222222222222222222';
    const auditorSigningPrivateKeyHex = '7777777777777777777777777777777777777777777777777777777777777777';
    const auditorEncryptionPrivateKeyHex = '8888888888888888888888888888888888888888888888888888888888888888';
    const nodeEncryptionPrivateKeyHex = '3333333333333333333333333333333333333333333333333333333333333333';
    const ownerSigningPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(ownerSigningPrivateKeyHex), true),
    );
    const ownerEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(ownerEncryptionPrivateKeyHex), true),
    );
    const auditorSigningPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(auditorSigningPrivateKeyHex), true),
    );
    const auditorEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(auditorEncryptionPrivateKeyHex), true),
    );
    const nodeEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(nodeEncryptionPrivateKeyHex), true),
    );
    blockchainServiceMock.getElectionEnvelopeContext.mockResolvedValue({
      NodePublicEncryptAddress: nodeEncryptionPublicKey,
      ElectionEnvelopeVersion: 'election-envelope-v2.1',
    });

    const { signedTransaction } =
      await createRecordElectionAnomalyAuditorRecipientRewrapTransaction({
        ElectionId: 'election-123',
        AnomalyThreadId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        MessageId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        ActorPublicAddress: ownerSigningPublicKey,
        ActorPublicEncryptAddress: ownerEncryptionPublicKey,
        ActorPrivateEncryptKeyHex: ownerEncryptionPrivateKeyHex,
        AuditorPublicAddress: auditorSigningPublicKey,
        AuditorPublicEncryptAddress: auditorEncryptionPublicKey,
        ContentKey: 'message-content-key',
        SigningPrivateKeyHex: ownerSigningPrivateKeyHex,
      });

    const parsedTransaction = JSON.parse(signedTransaction) as {
      Payload: {
        ActionType: string;
        ActorEncryptedElectionPrivateKey: string;
        EncryptedPayload: string;
      };
    };
    expect(parsedTransaction.Payload.ActionType).toBe(
      'record_anomaly_auditor_recipient_rewrap',
    );

    const actorElectionPrivateKey = await eciesDecrypt(
      parsedTransaction.Payload.ActorEncryptedElectionPrivateKey,
      ownerEncryptionPrivateKeyHex,
    );
    const decryptedPayloadJson = await eciesDecrypt(
      parsedTransaction.Payload.EncryptedPayload,
      actorElectionPrivateKey,
    );
    const decryptedPayload = JSON.parse(decryptedPayloadJson) as {
      ActionType: string;
      ActionPayload: RecordElectionAnomalyAuditorRecipientRewrapActionPayload;
    };

    expect(decryptedPayload.ActionType).toBe('record_anomaly_auditor_recipient_rewrap');
    expect(decryptedPayload.ActionPayload.AnomalyThreadId).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    expect(decryptedPayload.ActionPayload.MessageId).toBe('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    expect(decryptedPayload.ActionPayload.ActorPublicAddress).toBe(ownerSigningPublicKey);
    expect(decryptedPayload.ActionPayload.AuditorPublicAddress).toBe(auditorSigningPublicKey);
    expect(decryptedPayload.ActionPayload.RecipientKeyFingerprint).toMatch(/^sha256:/);
    expect(decryptedPayload.ActionPayload.WrapAlgorithm).toBe('x25519-aes-gcm');
    await expect(eciesDecrypt(
      decryptedPayload.ActionPayload.EncryptedContentKey,
      auditorEncryptionPrivateKeyHex,
    )).resolves.toBe('message-content-key');
    expect(electionsServiceMock.getElectionEnvelopeAccess).not.toHaveBeenCalled();
  });

  it('creates an owner clarification request with submitter, owner, and auditor wraps', async () => {
    const ownerSigningPrivateKeyHex = '1111111111111111111111111111111111111111111111111111111111111111';
    const ownerEncryptionPrivateKeyHex = '2222222222222222222222222222222222222222222222222222222222222222';
    const submitterEncryptionPrivateKeyHex = '8888888888888888888888888888888888888888888888888888888888888888';
    const auditorSigningPrivateKeyHex = '7777777777777777777777777777777777777777777777777777777777777777';
    const auditorEncryptionPrivateKeyHex = '9999999999999999999999999999999999999999999999999999999999999999';
    const nodeEncryptionPrivateKeyHex = '3333333333333333333333333333333333333333333333333333333333333333';
    const ownerSigningPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(ownerSigningPrivateKeyHex), true),
    );
    const ownerEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(ownerEncryptionPrivateKeyHex), true),
    );
    const submitterEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(submitterEncryptionPrivateKeyHex), true),
    );
    const auditorSigningPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(auditorSigningPrivateKeyHex), true),
    );
    const auditorEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(auditorEncryptionPrivateKeyHex), true),
    );
    const nodeEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(nodeEncryptionPrivateKeyHex), true),
    );
    blockchainServiceMock.getElectionEnvelopeContext.mockResolvedValue({
      NodePublicEncryptAddress: nodeEncryptionPublicKey,
      ElectionEnvelopeVersion: 'election-envelope-v2.1',
    });

    const { signedTransaction, clarificationRequestId } =
      await createRequestElectionAnomalyInformationTransaction({
        ElectionId: 'election-123',
        AnomalyThreadId: 'thread-123',
        ActorPublicAddress: ownerSigningPublicKey,
        ActorPublicEncryptAddress: ownerEncryptionPublicKey,
        ActorPrivateEncryptKeyHex: ownerEncryptionPrivateKeyHex,
        OriginalSubmitterPublicAddress: 'submitter-address',
        OriginalSubmitterPublicEncryptAddress: submitterEncryptionPublicKey,
        Body: 'Please confirm whether your trustee key is still available.',
        SigningPrivateKeyHex: ownerSigningPrivateKeyHex,
        AuditorRecipients: [
          {
            AuditorPublicAddress: auditorSigningPublicKey,
            AuditorPublicEncryptAddress: auditorEncryptionPublicKey,
          },
        ],
      });

    const parsedTransaction = JSON.parse(signedTransaction) as {
      Payload: {
        ActionType: string;
        ActionPayload: RequestElectionAnomalyInformationActionPayload;
        ActorEncryptedElectionPrivateKey: string;
        EncryptedPayload: string;
      };
    };

    expect(parsedTransaction.Payload.ActionType).toBe('request_anomaly_information');
    expect(parsedTransaction.Payload.ActionPayload.ClarificationRequestId)
      .toBe(clarificationRequestId);
    expect(parsedTransaction.Payload.ActionPayload.RequestMessage.EncryptedBody)
      .not.toContain('trustee key');
    expect(parsedTransaction.Payload.ActionPayload.RequestMessage.RecipientWraps)
      .toHaveLength(3);

    const actorElectionPrivateKey = await eciesDecrypt(
      parsedTransaction.Payload.ActorEncryptedElectionPrivateKey,
      ownerEncryptionPrivateKeyHex,
    );
    const decryptedPayload = JSON.parse(
      await eciesDecrypt(parsedTransaction.Payload.EncryptedPayload, actorElectionPrivateKey),
    ) as {
      ActionType: string;
      ActionPayload: RequestElectionAnomalyInformationActionPayload;
    };
    const message = decryptedPayload.ActionPayload.RequestMessage;
    const submitterWrap = message.RecipientWraps.find((wrap) =>
      wrap.RecipientRoleId === ELECTION_ANOMALY_RECIPIENT_ROLE_IDS.SUBMITTER
    )!;
    const ownerWrap = message.RecipientWraps.find((wrap) =>
      wrap.RecipientRoleId === ELECTION_ANOMALY_RECIPIENT_ROLE_IDS.ELECTION_OWNER
    )!;
    const auditorWrap = message.RecipientWraps.find((wrap) =>
      wrap.RecipientRoleId === ELECTION_ANOMALY_RECIPIENT_ROLE_IDS.DESIGNATED_AUDITOR
    )!;

    expect(decryptedPayload.ActionType).toBe('request_anomaly_information');
    expect(message.MessageKindId).toBe(ELECTION_ANOMALY_MESSAGE_KIND_IDS.AUTHORITY_INFORMATION_REQUEST);
    expect(message.PlaintextCharacterCount).toBe(59);
    await expect(eciesDecrypt(submitterWrap.EncryptedContentKey, submitterEncryptionPrivateKeyHex))
      .resolves
      .toBe(await eciesDecrypt(ownerWrap.EncryptedContentKey, ownerEncryptionPrivateKeyHex));
    await expect(eciesDecrypt(auditorWrap.EncryptedContentKey, auditorEncryptionPrivateKeyHex))
      .resolves
      .toBe(await eciesDecrypt(ownerWrap.EncryptedContentKey, ownerEncryptionPrivateKeyHex));
    await expect(decryptElectionAnomalyOwnerMessageBody({
      MessageId: message.MessageId,
      MessageKindId: message.MessageKindId,
      EncryptedBody: message.EncryptedBody,
      EncryptedBodyHash: message.EncryptedBodyHash,
      PlaintextCharacterCount: message.PlaintextCharacterCount,
      RecipientStatuses: [],
      HasCallerOwnerWrap: true,
      CallerOwnerWrap: {
        WrapStatusId: ownerWrap.WrapStatusId,
        RecipientKeyFingerprint: ownerWrap.RecipientKeyFingerprint,
        EncryptedContentKey: ownerWrap.EncryptedContentKey,
        WrapAlgorithm: ownerWrap.WrapAlgorithm,
      },
      ClarificationRequestId: clarificationRequestId,
      HasClarificationRequest: true,
      AttachmentManifestHash: '',
    } satisfies ElectionAnomalyOwnerMessageView, ownerEncryptionPrivateKeyHex)).resolves.toBe(
      'Please confirm whether your trustee key is still available.',
    );
    expect(electionsServiceMock.getElectionEnvelopeAccess).not.toHaveBeenCalled();
  });

  it('creates an owner authority response anomaly envelope', async () => {
    const ownerSigningPrivateKeyHex = '1111111111111111111111111111111111111111111111111111111111111111';
    const ownerEncryptionPrivateKeyHex = '2222222222222222222222222222222222222222222222222222222222222222';
    const submitterEncryptionPrivateKeyHex = '8888888888888888888888888888888888888888888888888888888888888888';
    const nodeEncryptionPrivateKeyHex = '3333333333333333333333333333333333333333333333333333333333333333';
    const ownerSigningPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(ownerSigningPrivateKeyHex), true),
    );
    const ownerEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(ownerEncryptionPrivateKeyHex), true),
    );
    const submitterEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(submitterEncryptionPrivateKeyHex), true),
    );
    const nodeEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(nodeEncryptionPrivateKeyHex), true),
    );
    blockchainServiceMock.getElectionEnvelopeContext.mockResolvedValue({
      NodePublicEncryptAddress: nodeEncryptionPublicKey,
      ElectionEnvelopeVersion: 'election-envelope-v2.1',
    });

    const { signedTransaction } = await createRecordElectionAnomalyAuthorityResponseTransaction({
      ElectionId: 'election-123',
      AnomalyThreadId: 'thread-123',
      ActorPublicAddress: ownerSigningPublicKey,
      ActorPublicEncryptAddress: ownerEncryptionPublicKey,
      ActorPrivateEncryptKeyHex: ownerEncryptionPrivateKeyHex,
      OriginalSubmitterPublicAddress: 'submitter-address',
      OriginalSubmitterPublicEncryptAddress: submitterEncryptionPublicKey,
      Body: 'The owner response is recorded as non-blocking evidence.',
      SigningPrivateKeyHex: ownerSigningPrivateKeyHex,
    });

    const parsedTransaction = JSON.parse(signedTransaction) as {
      Payload: {
        ActionType: string;
        ActorEncryptedElectionPrivateKey: string;
        EncryptedPayload: string;
      };
    };
    const actorElectionPrivateKey = await eciesDecrypt(
      parsedTransaction.Payload.ActorEncryptedElectionPrivateKey,
      ownerEncryptionPrivateKeyHex,
    );
    const decryptedPayload = JSON.parse(
      await eciesDecrypt(parsedTransaction.Payload.EncryptedPayload, actorElectionPrivateKey),
    ) as {
      ActionType: string;
      ActionPayload: RecordElectionAnomalyAuthorityResponseActionPayload;
    };

    expect(parsedTransaction.Payload.ActionType).toBe('record_anomaly_authority_response');
    expect(decryptedPayload.ActionType).toBe('record_anomaly_authority_response');
    expect(decryptedPayload.ActionPayload.AuthorityResponseMessage.MessageKindId)
      .toBe(ELECTION_ANOMALY_MESSAGE_KIND_IDS.AUTHORITY_RESPONSE);
    expect(JSON.stringify(parsedTransaction.Payload)).not.toContain('non-blocking evidence');
  });

  it('creates classification envelopes with stable severity candidates', async () => {
    const ownerSigningPrivateKeyHex = '1111111111111111111111111111111111111111111111111111111111111111';
    const ownerEncryptionPrivateKeyHex = '2222222222222222222222222222222222222222222222222222222222222222';
    const nodeEncryptionPrivateKeyHex = '3333333333333333333333333333333333333333333333333333333333333333';
    const ownerSigningPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(ownerSigningPrivateKeyHex), true),
    );
    const ownerEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(ownerEncryptionPrivateKeyHex), true),
    );
    const nodeEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(nodeEncryptionPrivateKeyHex), true),
    );
    blockchainServiceMock.getElectionEnvelopeContext.mockResolvedValue({
      NodePublicEncryptAddress: nodeEncryptionPublicKey,
      ElectionEnvelopeVersion: 'election-envelope-v2.1',
    });

    const { signedTransaction } = await createClassifyElectionAnomalyThreadTransaction({
      ElectionId: 'election-123',
      AnomalyThreadId: 'thread-123',
      ActorPublicAddress: ownerSigningPublicKey,
      ActorPublicEncryptAddress: ownerEncryptionPublicKey,
      ActorPrivateEncryptKeyHex: ownerEncryptionPrivateKeyHex,
      SigningPrivateKeyHex: ownerSigningPrivateKeyHex,
      CategoryId: ELECTION_ANOMALY_CATEGORY_IDS.TRUSTEE_CONTINUITY,
      CaseStateId: ELECTION_ANOMALY_CASE_STATE_IDS.ESCALATED_TO_GOVERNED_DECISION,
      SeverityCandidateId: ELECTION_ANOMALY_SEVERITY_CANDIDATE_IDS.POTENTIALLY_ELECTION_BLOCKING,
      GovernedDecisionRef: ' governed-decision-7 ',
    });

    const parsedTransaction = JSON.parse(signedTransaction) as {
      Payload: {
        ActionType: string;
        ActorEncryptedElectionPrivateKey: string;
        EncryptedPayload: string;
      };
    };
    const actorElectionPrivateKey = await eciesDecrypt(
      parsedTransaction.Payload.ActorEncryptedElectionPrivateKey,
      ownerEncryptionPrivateKeyHex,
    );
    const decryptedPayload = JSON.parse(
      await eciesDecrypt(parsedTransaction.Payload.EncryptedPayload, actorElectionPrivateKey),
    ) as {
      ActionType: string;
      ActionPayload: ClassifyElectionAnomalyThreadActionPayload;
    };

    expect(decryptedPayload.ActionType).toBe('classify_anomaly_thread');
    expect(decryptedPayload.ActionPayload.CaseStateId)
      .toBe(ELECTION_ANOMALY_CASE_STATE_IDS.ESCALATED_TO_GOVERNED_DECISION);
    expect(decryptedPayload.ActionPayload.SeverityCandidateId)
      .toBe(ELECTION_ANOMALY_SEVERITY_CANDIDATE_IDS.POTENTIALLY_ELECTION_BLOCKING);
    expect(decryptedPayload.ActionPayload.GovernedDecisionRef).toBe('governed-decision-7');

    await expect(createClassifyElectionAnomalyThreadTransaction({
      ElectionId: 'election-123',
      AnomalyThreadId: 'thread-123',
      ActorPublicAddress: ownerSigningPublicKey,
      ActorPublicEncryptAddress: ownerEncryptionPublicKey,
      ActorPrivateEncryptKeyHex: ownerEncryptionPrivateKeyHex,
      SigningPrivateKeyHex: ownerSigningPrivateKeyHex,
      SeverityCandidateId: 'critical-ish',
    })).rejects.toThrow(ELECTION_ANOMALY_VALIDATION_CODES.SEVERITY_CANDIDATE_INVALID);
  });

  it('registers external claimant anomalies with a hashed reference only', async () => {
    const ownerSigningPrivateKeyHex = '1111111111111111111111111111111111111111111111111111111111111111';
    const ownerEncryptionPrivateKeyHex = '2222222222222222222222222222222222222222222222222222222222222222';
    const nodeEncryptionPrivateKeyHex = '3333333333333333333333333333333333333333333333333333333333333333';
    const ownerSigningPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(ownerSigningPrivateKeyHex), true),
    );
    const ownerEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(ownerEncryptionPrivateKeyHex), true),
    );
    const nodeEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(nodeEncryptionPrivateKeyHex), true),
    );
    blockchainServiceMock.getElectionEnvelopeContext.mockResolvedValue({
      NodePublicEncryptAddress: nodeEncryptionPublicKey,
      ElectionEnvelopeVersion: 'election-envelope-v2.1',
    });
    const expectedHash = await hashExternalElectionAnomalyClaimantReference(
      'election-123',
      ' CASE-2026-007 ',
    );

    const { signedTransaction, anomalyThreadId, externalClaimantReferenceHash } =
      await createRegisterExternalElectionAnomalyClaimantTransaction({
        ElectionId: 'election-123',
        ActorPublicAddress: ownerSigningPublicKey,
        ActorPublicEncryptAddress: ownerEncryptionPublicKey,
        ActorPrivateEncryptKeyHex: ownerEncryptionPrivateKeyHex,
        ExternalClaimantReference: ' CASE-2026-007 ',
        CategoryId: ELECTION_ANOMALY_CATEGORY_IDS.EXTERNAL_OBJECTION_OR_COMPLAINT,
        Body: 'An external objection was received and stored out of band.',
        SigningPrivateKeyHex: ownerSigningPrivateKeyHex,
      });

    const parsedTransaction = JSON.parse(signedTransaction) as {
      Payload: {
        ActionType: string;
        ActionPayload: RegisterExternalElectionAnomalyClaimantActionPayload;
        ActorEncryptedElectionPrivateKey: string;
        EncryptedPayload: string;
      };
    };
    const actorElectionPrivateKey = await eciesDecrypt(
      parsedTransaction.Payload.ActorEncryptedElectionPrivateKey,
      ownerEncryptionPrivateKeyHex,
    );
    const decryptedPayload = JSON.parse(
      await eciesDecrypt(parsedTransaction.Payload.EncryptedPayload, actorElectionPrivateKey),
    ) as {
      ActionType: string;
      ActionPayload: RegisterExternalElectionAnomalyClaimantActionPayload;
    };

    expect(parsedTransaction.Payload.ActionType).toBe('register_external_anomaly_claimant');
    expect(parsedTransaction.Payload.ActionPayload.AnomalyThreadId).toBe(anomalyThreadId);
    expect(externalClaimantReferenceHash).toBe(expectedHash);
    expect(parsedTransaction.Payload.ActionPayload.ExternalClaimantReferenceHash)
      .toBe(expectedHash);
    expect(decryptedPayload.ActionPayload.ExternalClaimantReferenceHash).toBe(expectedHash);
    expect(decryptedPayload.ActionPayload.RegistrarRoleContextId)
      .toBe('external_claimant_registrar');
    expect(JSON.stringify(parsedTransaction.Payload.ActionPayload)).not.toContain('CASE-2026-007');
    expect(JSON.stringify(decryptedPayload.ActionPayload)).not.toContain('CASE-2026-007');
  });

  it('prepares anomaly attachment manifest hashes and restricted payload references', async () => {
    const payloadReference = createElectionAnomalyRestrictedPayloadReference(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    );
    const material = await prepareElectionAnomalyAttachmentManifestMaterial({
      Content: 'hello',
      EncryptedPayload: 'ciphertext',
      EncryptedPayloadReference: payloadReference,
    });

    expect(material.ContentHash).toBe(
      'sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
    expect(material.EncryptedPayloadHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(material.EncryptedPayloadReference).toBe(payloadReference);
    expect(material.EncryptedPayloadReference).toMatch(
      new RegExp(`^${ELECTION_ANOMALY_RESTRICTED_PAYLOAD_REFERENCE_PREFIX}`),
    );
    expect(material.SizeBytes).toBe(5);
    await expect(computeElectionAnomalyEvidenceHash(new Uint8Array([104, 101, 108, 108, 111])))
      .resolves
      .toBe(material.ContentHash);
  });

  it('creates decryptable restricted evidence payload content-key wraps', async () => {
    const submitterEncryptionPrivateKeyHex =
      '8888888888888888888888888888888888888888888888888888888888888888';
    const ownerEncryptionPrivateKeyHex =
      '9999999999999999999999999999999999999999999999999999999999999999';
    const auditorEncryptionPrivateKeyHex =
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const submitterEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(submitterEncryptionPrivateKeyHex), true),
    );
    const ownerEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(ownerEncryptionPrivateKeyHex), true),
    );
    const auditorEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(auditorEncryptionPrivateKeyHex), true),
    );
    identityServiceMock.getIdentity.mockResolvedValue({
      Successfull: true,
      PublicEncryptAddress: ownerEncryptionPublicKey,
    });

    const restrictedPayload = await createElectionAnomalyRestrictedEvidencePayload(
      new Uint8Array([7, 8, 9]),
    );
    const submitterWraps = await createElectionAnomalySubmitterAttachmentContentKeyWraps({
      ActorPublicAddress: 'submitter-address',
      ActorPublicEncryptAddress: submitterEncryptionPublicKey,
      OwnerPublicAddress: 'owner-address',
      ContentKey: restrictedPayload.ContentKey,
    });
    const ownerWraps = await createElectionAnomalyOwnerAttachmentContentKeyWraps({
      OwnerPublicAddress: 'owner-address',
      OwnerPublicEncryptAddress: ownerEncryptionPublicKey,
      AuditorRecipients: [
        {
          AuditorPublicAddress: 'auditor-address',
          AuditorPublicEncryptAddress: auditorEncryptionPublicKey,
        },
      ],
      ContentKey: restrictedPayload.ContentKey,
    });

    await expect(aesDecryptBytes(restrictedPayload.EncryptedPayload, restrictedPayload.ContentKey))
      .resolves
      .toEqual(new Uint8Array([7, 8, 9]));
    expect(submitterWraps).toHaveLength(2);
    expect(ownerWraps).toHaveLength(2);
    await expect(eciesDecrypt(
      submitterWraps[1].EncryptedContentKey,
      ownerEncryptionPrivateKeyHex,
    )).resolves.toBe(restrictedPayload.ContentKey);
    await expect(eciesDecrypt(
      ownerWraps[1].EncryptedContentKey,
      auditorEncryptionPrivateKeyHex,
    )).resolves.toBe(restrictedPayload.ContentKey);
    expect(submitterWraps.map((wrap) => wrap.RecipientPublicAddress))
      .toEqual(['submitter-address', 'owner-address']);
    expect(ownerWraps.map((wrap) => wrap.RecipientPublicAddress))
      .toEqual(['owner-address', 'auditor-address']);
  });

  it('decrypts restricted attachment payloads only when hashes and caller wrap match', async () => {
    const ownerEncryptionPrivateKeyHex =
      '9999999999999999999999999999999999999999999999999999999999999999';
    const ownerEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(ownerEncryptionPrivateKeyHex), true),
    );
    const content = new Uint8Array([4, 5, 6]);
    const restrictedPayload = await createElectionAnomalyRestrictedEvidencePayload(content);
    const callerWrap = await createElectionAnomalyAttachmentContentKeyWrap({
      RecipientRoleId: ELECTION_ANOMALY_RECIPIENT_ROLE_IDS.ELECTION_OWNER,
      RecipientPublicAddress: 'owner-address',
      RecipientPublicEncryptAddress: ownerEncryptionPublicKey,
      ContentKey: restrictedPayload.ContentKey,
    });
    const attachment: ElectionAnomalyAttachmentManifestView = {
      AttachmentManifestId: 'manifest-1',
      AnomalyThreadId: 'thread-1',
      EventId: 'event-1',
      EventHash: 'sha256:event',
      AttachmentKindId: ELECTION_ANOMALY_ATTACHMENT_KIND_IDS.AUTHORITY_EVIDENCE,
      EncryptedPayloadReference: createElectionAnomalyRestrictedPayloadReference(
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      ),
      EncryptedPayloadHash: await computeElectionAnomalyEvidenceHash(
        restrictedPayload.EncryptedPayload,
      ),
      ContentHash: await computeElectionAnomalyEvidenceHash(content),
      SizeBytes: content.byteLength,
      MimeType: ELECTION_ANOMALY_EVIDENCE_MIME_TYPES.IMAGE_PNG,
      ValidationStatusId: ELECTION_ANOMALY_ATTACHMENT_VALIDATION_STATUS_IDS.ACCEPTED,
      ScannerStatusId: 'clear',
      PayloadAvailabilityStatusId: 'available',
      ClarificationRequestId: '',
      HasClarificationRequest: false,
      ActorRoleId: ELECTION_ANOMALY_RECIPIENT_ROLE_IDS.ELECTION_OWNER,
      SourceTransactionId: 'tx-1',
      HasCallerContentKeyWrap: true,
      CallerContentKeyWrap: {
        WrapStatusId: callerWrap.WrapStatusId,
        RecipientKeyFingerprint: callerWrap.RecipientKeyFingerprint,
        EncryptedContentKey: callerWrap.EncryptedContentKey,
        WrapAlgorithm: callerWrap.WrapAlgorithm,
      },
    };

    await expect(decryptElectionAnomalyAttachmentPayload({
      Attachment: attachment,
      ActorPrivateEncryptKeyHex: ownerEncryptionPrivateKeyHex,
      EncryptedPayloadBase64: bytesToBase64(restrictedPayload.EncryptedPayload),
      EncryptedPayloadHash: attachment.EncryptedPayloadHash,
      ContentHash: attachment.ContentHash,
    })).resolves.toEqual(content);

    await expect(decryptElectionAnomalyAttachmentPayload({
      Attachment: attachment,
      ActorPrivateEncryptKeyHex: ownerEncryptionPrivateKeyHex,
      EncryptedPayloadBase64: bytesToBase64(restrictedPayload.EncryptedPayload),
      EncryptedPayloadHash: attachment.EncryptedPayloadHash,
      ContentHash: `sha256:${'0'.repeat(64)}`,
    })).rejects.toThrow(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_HASH_INVALID);
  });

  it('creates a signed submitter clarification attachment manifest envelope', async () => {
    const submitterSigningPrivateKeyHex = '7777777777777777777777777777777777777777777777777777777777777777';
    const submitterEncryptionPrivateKeyHex = '8888888888888888888888888888888888888888888888888888888888888888';
    const nodeEncryptionPrivateKeyHex = '3333333333333333333333333333333333333333333333333333333333333333';
    const submitterSigningPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(submitterSigningPrivateKeyHex), true),
    );
    const submitterEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(submitterEncryptionPrivateKeyHex), true),
    );
    const nodeEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(nodeEncryptionPrivateKeyHex), true),
    );
    const material = await prepareElectionAnomalyAttachmentManifestMaterial({
      Content: new Uint8Array([1, 2, 3]),
      EncryptedPayload: 'encrypted-payload',
      EncryptedPayloadReference: createElectionAnomalyRestrictedPayloadReference(
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      ),
    });
    const contentKeyWraps = [
      {
        RecipientRoleId: ELECTION_ANOMALY_RECIPIENT_ROLE_IDS.SUBMITTER,
        RecipientPublicAddress: submitterSigningPublicKey,
        RecipientKeyFingerprint: `sha256:${'a'.repeat(64)}`,
        EncryptedContentKey: 'submitter-wrapped-content-key',
        WrapAlgorithm: 'x25519-aes-gcm',
        WrapStatusId: ELECTION_ANOMALY_RECIPIENT_WRAP_STATUS_IDS.AVAILABLE,
      },
      {
        RecipientRoleId: ELECTION_ANOMALY_RECIPIENT_ROLE_IDS.ELECTION_OWNER,
        RecipientPublicAddress: 'owner-address',
        RecipientKeyFingerprint: `sha256:${'b'.repeat(64)}`,
        EncryptedContentKey: 'owner-wrapped-content-key',
        WrapAlgorithm: 'x25519-aes-gcm',
        WrapStatusId: ELECTION_ANOMALY_RECIPIENT_WRAP_STATUS_IDS.AVAILABLE,
      },
    ];
    blockchainServiceMock.getElectionEnvelopeContext.mockResolvedValue({
      NodePublicEncryptAddress: nodeEncryptionPublicKey,
      ElectionEnvelopeVersion: 'election-envelope-v2.1',
    });

    const { signedTransaction, attachmentManifestId } =
      await createRecordElectionAnomalyAttachmentManifestTransaction({
        ElectionId: 'election-123',
        AnomalyThreadId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        AttachmentManifestId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        ActorPublicAddress: submitterSigningPublicKey,
        ActorPublicEncryptAddress: submitterEncryptionPublicKey,
        ActorPrivateEncryptKeyHex: submitterEncryptionPrivateKeyHex,
        SigningPrivateKeyHex: submitterSigningPrivateKeyHex,
        AttachmentKindId: ELECTION_ANOMALY_ATTACHMENT_KIND_IDS.AUTHORITY_REQUESTED_EVIDENCE,
        EncryptedPayloadReference: material.EncryptedPayloadReference,
        EncryptedPayloadHash: material.EncryptedPayloadHash,
        ContentHash: material.ContentHash,
        SizeBytes: material.SizeBytes,
        MimeType: ELECTION_ANOMALY_EVIDENCE_MIME_TYPES.APPLICATION_JSON,
        ValidationStatusId: ELECTION_ANOMALY_ATTACHMENT_VALIDATION_STATUS_IDS.PENDING_SCAN,
        ClarificationRequestId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        ContentKeyWraps: contentKeyWraps,
        ExistingAttachmentManifestCount: 1,
        ExistingAttachmentManifestTotalBytes: 1024,
      });

    const parsedTransaction = JSON.parse(signedTransaction) as {
      Payload: {
        ActionType: string;
        ActionPayload: RecordElectionAnomalyAttachmentManifestActionPayload;
        ActorEncryptedElectionPrivateKey: string;
        EncryptedPayload: string;
      };
    };
    const actorElectionPrivateKey = await eciesDecrypt(
      parsedTransaction.Payload.ActorEncryptedElectionPrivateKey,
      submitterEncryptionPrivateKeyHex,
    );
    const decryptedPayload = JSON.parse(
      await eciesDecrypt(parsedTransaction.Payload.EncryptedPayload, actorElectionPrivateKey),
    ) as {
      ActionType: string;
      ActionPayload: RecordElectionAnomalyAttachmentManifestActionPayload;
    };

    expect(attachmentManifestId).toBe('cccccccc-cccc-cccc-cccc-cccccccccccc');
    expect(parsedTransaction.Payload.ActionType).toBe('record_anomaly_attachment_manifest');
    expect(parsedTransaction.Payload.ActionPayload.AttachmentManifestId)
      .toBe('cccccccc-cccc-cccc-cccc-cccccccccccc');
    expect(parsedTransaction.Payload.ActionPayload.AttachmentKindId)
      .toBe(ELECTION_ANOMALY_ATTACHMENT_KIND_IDS.AUTHORITY_REQUESTED_EVIDENCE);
    expect(parsedTransaction.Payload.ActionPayload.MimeType).toBe('application/json');
    expect(parsedTransaction.Payload.ActionPayload.ContentHash).toBe(material.ContentHash);
    expect(decryptedPayload.ActionType).toBe('record_anomaly_attachment_manifest');
    expect(decryptedPayload.ActionPayload.ClarificationRequestId)
      .toBe('dddddddd-dddd-dddd-dddd-dddddddddddd');
    expect(decryptedPayload.ActionPayload.ContentKeyWraps).toEqual(contentKeyWraps);
    expect(JSON.stringify(parsedTransaction.Payload)).not.toContain('encrypted-payload');
    expect(JSON.stringify(decryptedPayload.ActionPayload)).not.toContain('encrypted-payload');
    expect(JSON.stringify(decryptedPayload.ActionPayload)).not.toContain('content-key-plaintext');
    expect(electionsServiceMock.getElectionEnvelopeAccess).not.toHaveBeenCalled();
  });

  it('rejects unsupported anomaly attachment manifest inputs before signing', async () => {
    const baseInput = {
      ElectionId: 'election-123',
      AnomalyThreadId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      ActorPublicAddress: 'actor-address',
      ActorPublicEncryptAddress: 'actor-encrypt-address',
      ActorPrivateEncryptKeyHex: 'actor-private-key',
      SigningPrivateKeyHex: 'signing-private-key',
      AttachmentKindId: ELECTION_ANOMALY_ATTACHMENT_KIND_IDS.AUTHORITY_REQUESTED_EVIDENCE,
      EncryptedPayloadReference: createElectionAnomalyRestrictedPayloadReference(
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      ),
      EncryptedPayloadHash: `sha256:${'a'.repeat(64)}`,
      ContentHash: `sha256:${'b'.repeat(64)}`,
      SizeBytes: 256,
      MimeType: ELECTION_ANOMALY_EVIDENCE_MIME_TYPES.IMAGE_PNG,
      ClarificationRequestId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    };

    await expect(createRecordElectionAnomalyAttachmentManifestTransaction({
      ...baseInput,
      AttachmentKindId: ELECTION_ANOMALY_ATTACHMENT_KIND_IDS.SUBMITTER_EVIDENCE,
    })).rejects.toThrow(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_SUBMITTER_NOT_ALLOWED);
    await expect(createRecordElectionAnomalyAttachmentManifestTransaction({
      ...baseInput,
      MimeType: 'text/html',
    })).rejects.toThrow(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_MIME_TYPE_INVALID);
    await expect(createRecordElectionAnomalyAttachmentManifestTransaction({
      ...baseInput,
      SizeBytes: ELECTION_ANOMALY_SUBMITTER_CLARIFICATION_EVIDENCE_MAX_BYTES + 1,
    })).rejects.toThrow(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_SIZE_EXCEEDED);
    await expect(createRecordElectionAnomalyAttachmentManifestTransaction({
      ...baseInput,
      ExistingAttachmentManifestCount: 2,
    })).rejects.toThrow(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_COUNT_EXCEEDED);
    await expect(createRecordElectionAnomalyAttachmentManifestTransaction({
      ...baseInput,
      AttachmentKindId: ELECTION_ANOMALY_ATTACHMENT_KIND_IDS.AUTHORITY_EVIDENCE,
      ClarificationRequestId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    })).rejects.toThrow(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_REQUEST_MISMATCH);
    await expect(createRecordElectionAnomalyAttachmentManifestTransaction({
      ...baseInput,
      ContentKeyWraps: [
        {
          RecipientRoleId: ELECTION_ANOMALY_RECIPIENT_ROLE_IDS.ELECTION_OWNER,
          RecipientPublicAddress: 'owner-address',
          RecipientKeyFingerprint: `sha256:${'c'.repeat(64)}`,
          EncryptedContentKey: 'owner-wrapped-content-key',
          WrapAlgorithm: 'x25519-aes-gcm',
          WrapStatusId: ELECTION_ANOMALY_RECIPIENT_WRAP_STATUS_IDS.MISSING,
        },
      ],
    })).rejects.toThrow(ELECTION_ANOMALY_VALIDATION_CODES.RECIPIENT_WRAP_MISSING);
    await expect(prepareElectionAnomalyAttachmentManifestMaterial({
      Content: 'hello',
      EncryptedPayload: 'ciphertext',
      EncryptedPayloadReference: 'https://example.invalid/payload',
    })).rejects.toThrow(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_PAYLOAD_REFERENCE_INVALID);
    expect(blockchainServiceMock.getElectionEnvelopeContext).not.toHaveBeenCalled();
  });

  it('creates an owner evidence redaction envelope and validates redaction hashes', async () => {
    const ownerSigningPrivateKeyHex = '1111111111111111111111111111111111111111111111111111111111111111';
    const ownerEncryptionPrivateKeyHex = '2222222222222222222222222222222222222222222222222222222222222222';
    const nodeEncryptionPrivateKeyHex = '3333333333333333333333333333333333333333333333333333333333333333';
    const ownerSigningPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(ownerSigningPrivateKeyHex), true),
    );
    const ownerEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(ownerEncryptionPrivateKeyHex), true),
    );
    const nodeEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(nodeEncryptionPrivateKeyHex), true),
    );
    blockchainServiceMock.getElectionEnvelopeContext.mockResolvedValue({
      NodePublicEncryptAddress: nodeEncryptionPublicKey,
      ElectionEnvelopeVersion: 'election-envelope-v2.1',
    });

    const { signedTransaction, redactionEventId } =
      await createRecordElectionAnomalyEvidenceRedactionTransaction({
        ElectionId: 'election-123',
        AnomalyThreadId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        RedactionEventId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        ActorPublicAddress: ownerSigningPublicKey,
        ActorPublicEncryptAddress: ownerEncryptionPublicKey,
        ActorPrivateEncryptKeyHex: ownerEncryptionPrivateKeyHex,
        SigningPrivateKeyHex: ownerSigningPrivateKeyHex,
        TargetKindId: ELECTION_ANOMALY_REDACTION_TARGET_KIND_IDS.ATTACHMENT_MANIFEST,
        TargetId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        ReasonCodeId: ELECTION_ANOMALY_REDACTION_REASON_IDS.PERSONAL_DATA,
        OriginalHash: `sha256:${'c'.repeat(64)}`,
        ReplacementManifestHash: `sha256:${'d'.repeat(64)}`,
        TombstoneStatusId: 'redacted',
      });

    const parsedTransaction = JSON.parse(signedTransaction) as {
      Payload: {
        ActionType: string;
        ActorEncryptedElectionPrivateKey: string;
        EncryptedPayload: string;
      };
    };
    const actorElectionPrivateKey = await eciesDecrypt(
      parsedTransaction.Payload.ActorEncryptedElectionPrivateKey,
      ownerEncryptionPrivateKeyHex,
    );
    const decryptedPayload = JSON.parse(
      await eciesDecrypt(parsedTransaction.Payload.EncryptedPayload, actorElectionPrivateKey),
    ) as {
      ActionType: string;
      ActionPayload: RecordElectionAnomalyEvidenceRedactionActionPayload;
    };

    expect(redactionEventId).toBe('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');
    expect(parsedTransaction.Payload.ActionType).toBe('record_anomaly_evidence_redaction');
    expect(decryptedPayload.ActionType).toBe('record_anomaly_evidence_redaction');
    expect(decryptedPayload.ActionPayload.TargetKindId)
      .toBe(ELECTION_ANOMALY_REDACTION_TARGET_KIND_IDS.ATTACHMENT_MANIFEST);
    expect(decryptedPayload.ActionPayload.ReasonCodeId)
      .toBe(ELECTION_ANOMALY_REDACTION_REASON_IDS.PERSONAL_DATA);
    expect(decryptedPayload.ActionPayload.OriginalHash).toBe(`sha256:${'c'.repeat(64)}`);
    expect(decryptedPayload.ActionPayload.ReplacementManifestHash)
      .toBe(`sha256:${'d'.repeat(64)}`);

    await expect(createRecordElectionAnomalyEvidenceRedactionTransaction({
      ElectionId: 'election-123',
      AnomalyThreadId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      ActorPublicAddress: ownerSigningPublicKey,
      ActorPublicEncryptAddress: ownerEncryptionPublicKey,
      ActorPrivateEncryptKeyHex: ownerEncryptionPrivateKeyHex,
      SigningPrivateKeyHex: ownerSigningPrivateKeyHex,
      TargetKindId: ELECTION_ANOMALY_REDACTION_TARGET_KIND_IDS.ATTACHMENT_MANIFEST,
      TargetId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      ReasonCodeId: 'privacy-ish',
      OriginalHash: `sha256:${'c'.repeat(64)}`,
    })).rejects.toThrow(ELECTION_ANOMALY_VALIDATION_CODES.REDACTION_REASON_INVALID);
    await expect(createRecordElectionAnomalyEvidenceRedactionTransaction({
      ElectionId: 'election-123',
      AnomalyThreadId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      ActorPublicAddress: ownerSigningPublicKey,
      ActorPublicEncryptAddress: ownerEncryptionPublicKey,
      ActorPrivateEncryptKeyHex: ownerEncryptionPrivateKeyHex,
      SigningPrivateKeyHex: ownerSigningPrivateKeyHex,
      TargetKindId: ELECTION_ANOMALY_REDACTION_TARGET_KIND_IDS.ATTACHMENT_MANIFEST,
      TargetId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      ReasonCodeId: ELECTION_ANOMALY_REDACTION_REASON_IDS.PERSONAL_DATA,
      OriginalHash: 'sha256:not-valid',
    })).rejects.toThrow(ELECTION_ANOMALY_VALIDATION_CODES.REDACTION_ORIGINAL_HASH_INVALID);
  });

  it('creates a bounded clarification response anomaly envelope', async () => {
    const voterSigningPrivateKeyHex = '7777777777777777777777777777777777777777777777777777777777777777';
    const voterEncryptionPrivateKeyHex = '8888888888888888888888888888888888888888888888888888888888888888';
    const ownerSigningPrivateKeyHex = '1111111111111111111111111111111111111111111111111111111111111111';
    const ownerEncryptionPrivateKeyHex = '2222222222222222222222222222222222222222222222222222222222222222';
    const nodeEncryptionPrivateKeyHex = '3333333333333333333333333333333333333333333333333333333333333333';
    const voterSigningPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(voterSigningPrivateKeyHex), true),
    );
    const voterEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(voterEncryptionPrivateKeyHex), true),
    );
    const ownerSigningPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(ownerSigningPrivateKeyHex), true),
    );
    const ownerEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(ownerEncryptionPrivateKeyHex), true),
    );
    const nodeEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(nodeEncryptionPrivateKeyHex), true),
    );
    blockchainServiceMock.getElectionEnvelopeContext.mockResolvedValue({
      NodePublicEncryptAddress: nodeEncryptionPublicKey,
      ElectionEnvelopeVersion: 'election-envelope-v2.1',
    });
    identityServiceMock.getIdentity.mockResolvedValue({
      Successfull: true,
      Message: '',
      ProfileName: 'Election Owner',
      PublicSigningAddress: ownerSigningPublicKey,
      PublicEncryptAddress: ownerEncryptionPublicKey,
      IsPublic: false,
    });

    const { signedTransaction } = await createSubmitElectionAnomalyInformationTransaction({
      ElectionId: 'election-123',
      AnomalyThreadId: 'thread-123',
      ClarificationRequestId: 'clarification-123',
      ActorPublicAddress: voterSigningPublicKey,
      ActorPublicEncryptAddress: voterEncryptionPublicKey,
      ActorPrivateEncryptKeyHex: voterEncryptionPrivateKeyHex,
      OwnerPublicAddress: ownerSigningPublicKey,
      Body: 'The receipt mismatch appeared after refresh.',
      SigningPrivateKeyHex: voterSigningPrivateKeyHex,
    });

    const parsedTransaction = JSON.parse(signedTransaction) as {
      Payload: {
        ActorEncryptedElectionPrivateKey: string;
        EncryptedPayload: string;
      };
    };
    const actorElectionPrivateKey = await eciesDecrypt(
      parsedTransaction.Payload.ActorEncryptedElectionPrivateKey,
      voterEncryptionPrivateKeyHex,
    );
    const decryptedPayload = JSON.parse(
      await eciesDecrypt(parsedTransaction.Payload.EncryptedPayload, actorElectionPrivateKey),
    ) as {
      ActionType: string;
      ActionPayload: {
        AnomalyThreadId: string;
        ClarificationRequestId: string;
        ResponseMessage: ElectionAnomalyMessageEnvelopePayload;
      };
    };

    expect(decryptedPayload.ActionType).toBe('submit_anomaly_information');
    expect(decryptedPayload.ActionPayload.AnomalyThreadId).toBe('thread-123');
    expect(decryptedPayload.ActionPayload.ClarificationRequestId).toBe('clarification-123');
    expect(decryptedPayload.ActionPayload.ResponseMessage.MessageKindId).toBe(
      'submitter_information_response',
    );
    expect(JSON.stringify(decryptedPayload.ActionPayload)).not.toContain('submitterPersonScopeId');

    await expect(createSubmitElectionAnomalyInformationTransaction({
      ElectionId: 'election-123',
      AnomalyThreadId: 'thread-123',
      ClarificationRequestId: '',
      ActorPublicAddress: voterSigningPublicKey,
      ActorPublicEncryptAddress: voterEncryptionPublicKey,
      ActorPrivateEncryptKeyHex: voterEncryptionPrivateKeyHex,
      OwnerPublicAddress: ownerSigningPublicKey,
      Body: 'The receipt mismatch appeared after refresh.',
      SigningPrivateKeyHex: voterSigningPrivateKeyHex,
    })).rejects.toThrow(ELECTION_ANOMALY_VALIDATION_CODES.CLARIFICATION_REQUEST_NOT_OPEN);
  });

  it('detects duplicate anomaly validation responses for route-to-thread recovery', () => {
    expect(hasElectionAnomalyDuplicateThreadValidation({
      Successfull: false,
      Message: 'Rejected with anomaly_duplicate_thread',
    })).toBe(true);
    expect(hasElectionAnomalyDuplicateThreadValidation({
      ValidationErrors: ['anomaly_body_required'],
    })).toBe(false);
  });

  it('creates an encrypted aggregate-only finalization share envelope for a trustee actor', async () => {
    const trusteeSigningPrivateKeyHex = '6666666666666666666666666666666666666666666666666666666666666666';
    const trusteeEncryptionPrivateKeyHex = '4444444444444444444444444444444444444444444444444444444444444444';
    const nodeEncryptionPrivateKeyHex = '3333333333333333333333333333333333333333333333333333333333333333';
    const electionPrivateKeyHex = '5555555555555555555555555555555555555555555555555555555555555555';
    const executorSessionPrivateKeyHex = '7777777777777777777777777777777777777777777777777777777777777777';
    const trusteeSigningPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(trusteeSigningPrivateKeyHex), true),
    );
    const trusteeEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(trusteeEncryptionPrivateKeyHex), true),
    );
    const nodeEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(nodeEncryptionPrivateKeyHex), true),
    );
    const executorSessionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(executorSessionPrivateKeyHex), true),
    );
    const actorEncryptedElectionPrivateKey = await eciesEncrypt(
      electionPrivateKeyHex,
      trusteeEncryptionPublicKey,
    );

    blockchainServiceMock.getElectionEnvelopeContext.mockResolvedValue({
      NodePublicEncryptAddress: nodeEncryptionPublicKey,
      ElectionEnvelopeVersion: 'election-envelope-v2.1',
    });
    electionsServiceMock.getElectionEnvelopeAccess.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      ActorEncryptedElectionPrivateKey: actorEncryptedElectionPrivateKey,
    });

    const request: SubmitElectionFinalizationShareRequest = {
      ElectionId: 'election-123',
      FinalizationSessionId: 'finalization-session-7',
      ActorPublicAddress: trusteeSigningPublicKey,
      ShareIndex: 2,
      ShareVersion: 'share-v2',
      TargetType: ElectionFinalizationTargetTypeProto.FinalizationTargetAggregateTally,
      ClaimedCloseArtifactId: 'close-artifact-3',
      ClaimedAcceptedBallotSetHash: 'accepted-ballots-hash',
      ClaimedFinalEncryptedTallyHash: 'final-encrypted-tally-hash',
      ClaimedTargetTallyId: 'aggregate-tally-1',
      ClaimedCeremonyVersionId: 'ceremony-version-5',
      ClaimedTallyPublicKeyFingerprint: 'tally-fingerprint-9',
      CloseCountingJobId: 'job-close-counting-1',
      ExecutorSessionPublicKey: executorSessionPublicKey,
      ExecutorKeyAlgorithm: 'ecies-secp256k1-v1',
      ShareMaterial: 'aggregate-share-material',
    };

    const { signedTransaction } = await createSubmitElectionFinalizationShareTransaction(
      request,
      trusteeEncryptionPublicKey,
      trusteeEncryptionPrivateKeyHex,
      trusteeSigningPrivateKeyHex,
    );

    const parsedTransaction = JSON.parse(signedTransaction) as {
      PayloadKind: string;
      Payload: {
        ActorEncryptedElectionPrivateKey: string;
        EncryptedPayload: string;
      };
    };

    expect(parsedTransaction.PayloadKind).toBe(ENCRYPTED_ELECTION_ENVELOPE_PAYLOAD_KIND);

    const actorElectionPrivateKey = await eciesDecrypt(
      parsedTransaction.Payload.ActorEncryptedElectionPrivateKey,
      trusteeEncryptionPrivateKeyHex,
    );
    const decryptedPayloadJson = await eciesDecrypt(
      parsedTransaction.Payload.EncryptedPayload,
      actorElectionPrivateKey,
    );
    const decryptedPayload = JSON.parse(decryptedPayloadJson) as {
      ActionType: string;
      ActionPayload: {
        FinalizationSessionId: string;
        ActorPublicAddress: string;
        ShareIndex: number;
        ShareVersion: string;
        TargetType: number;
        ClaimedCloseArtifactId: string;
        ClaimedAcceptedBallotSetHash: string | null;
        ClaimedFinalEncryptedTallyHash: string | null;
        ClaimedTargetTallyId: string;
        ClaimedCeremonyVersionId: string | null;
        ClaimedTallyPublicKeyFingerprint: string | null;
        ShareMaterial?: string | null;
        CloseCountingJobId?: string | null;
        ExecutorKeyAlgorithm?: string | null;
        EncryptedExecutorSubmission?: string | null;
      };
    };
    const decryptedExecutorSubmissionJson = await eciesDecrypt(
      decryptedPayload.ActionPayload.EncryptedExecutorSubmission!,
      executorSessionPrivateKeyHex,
    );
    const decryptedExecutorSubmission = JSON.parse(
      decryptedExecutorSubmissionJson,
    ) as CloseCountingExecutorSubmissionPayload;

    expect(decryptedPayload.ActionType).toBe('submit_finalization_share');
    expect(decryptedPayload.ActionPayload.FinalizationSessionId).toBe('finalization-session-7');
    expect(decryptedPayload.ActionPayload.ActorPublicAddress).toBe(trusteeSigningPublicKey);
    expect(decryptedPayload.ActionPayload.ShareIndex).toBe(2);
    expect(decryptedPayload.ActionPayload.ShareVersion).toBe('share-v2');
    expect(decryptedPayload.ActionPayload.TargetType).toBe(
      ElectionFinalizationTargetTypeProto.FinalizationTargetAggregateTally
    );
    expect(decryptedPayload.ActionPayload.ClaimedCloseArtifactId).toBe('close-artifact-3');
    expect(decryptedPayload.ActionPayload.ClaimedAcceptedBallotSetHash).toBe(
      'accepted-ballots-hash'
    );
    expect(decryptedPayload.ActionPayload.ClaimedFinalEncryptedTallyHash).toBe(
      'final-encrypted-tally-hash'
    );
    expect(decryptedPayload.ActionPayload.ClaimedTargetTallyId).toBe('aggregate-tally-1');
    expect(decryptedPayload.ActionPayload.ClaimedCeremonyVersionId).toBe('ceremony-version-5');
    expect(decryptedPayload.ActionPayload.ClaimedTallyPublicKeyFingerprint).toBe(
      'tally-fingerprint-9'
    );
    expect(decryptedPayload.ActionPayload.CloseCountingJobId).toBe('job-close-counting-1');
    expect(decryptedPayload.ActionPayload.ExecutorKeyAlgorithm).toBe('ecies-secp256k1-v1');
    expect(decryptedPayload.ActionPayload.ShareMaterial).toBeNull();
    expect(decryptedExecutorSubmission.CloseCountingJobId).toBe('job-close-counting-1');
    expect(decryptedExecutorSubmission.ElectionId).toBe('election-123');
    expect(decryptedExecutorSubmission.FinalizationSessionId).toBe('finalization-session-7');
    expect(decryptedExecutorSubmission.ActorPublicAddress).toBe(trusteeSigningPublicKey);
    expect(decryptedExecutorSubmission.ShareIndex).toBe(2);
    expect(decryptedExecutorSubmission.ShareVersion).toBe('share-v2');
    expect(decryptedExecutorSubmission.TargetType).toBe(
      ElectionFinalizationTargetTypeProto.FinalizationTargetAggregateTally
    );
    expect(decryptedExecutorSubmission.ShareMaterial).toBe('aggregate-share-material');
  });

  it('rejects trustee finalization-share envelopes without executor binding', async () => {
    const trusteeSigningPrivateKeyHex = '6666666666666666666666666666666666666666666666666666666666666666';
    const trusteeEncryptionPrivateKeyHex = '4444444444444444444444444444444444444444444444444444444444444444';
    const trusteeEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(trusteeEncryptionPrivateKeyHex), true),
    );

    const request: SubmitElectionFinalizationShareRequest = {
      ElectionId: 'election-123',
      FinalizationSessionId: 'finalization-session-7',
      ActorPublicAddress: 'trustee-address',
      ShareIndex: 2,
      ShareVersion: 'share-v2',
      TargetType: ElectionFinalizationTargetTypeProto.FinalizationTargetAggregateTally,
      ClaimedCloseArtifactId: 'close-artifact-3',
      ClaimedAcceptedBallotSetHash: 'accepted-ballots-hash',
      ClaimedFinalEncryptedTallyHash: 'final-encrypted-tally-hash',
      ClaimedTargetTallyId: 'aggregate-tally-1',
      ClaimedCeremonyVersionId: 'ceremony-version-5',
      ClaimedTallyPublicKeyFingerprint: 'tally-fingerprint-9',
      ShareMaterial: 'aggregate-share-material',
    };

    await expect(
      createSubmitElectionFinalizationShareTransaction(
        request,
        trusteeEncryptionPublicKey,
        trusteeEncryptionPrivateKeyHex,
        trusteeSigningPrivateKeyHex,
      ),
    ).rejects.toThrow(
      'Executor-encrypted trustee share submission requires CloseCountingJobId, ExecutorSessionPublicKey, and ExecutorKeyAlgorithm.',
    );
  });

  it('normalizes protobuf bytes fields before building the trustee finalization-share envelope', async () => {
    const trusteeSigningPrivateKeyHex = '6666666666666666666666666666666666666666666666666666666666666666';
    const trusteeEncryptionPrivateKeyHex = '4444444444444444444444444444444444444444444444444444444444444444';
    const nodeEncryptionPrivateKeyHex = '3333333333333333333333333333333333333333333333333333333333333333';
    const electionPrivateKeyHex = '5555555555555555555555555555555555555555555555555555555555555555';
    const executorSessionPrivateKeyHex = '7777777777777777777777777777777777777777777777777777777777777777';
    const trusteeSigningPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(trusteeSigningPrivateKeyHex), true),
    );
    const trusteeEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(trusteeEncryptionPrivateKeyHex), true),
    );
    const nodeEncryptionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(nodeEncryptionPrivateKeyHex), true),
    );
    const executorSessionPublicKey = bytesToHex(
      secp256k1.getPublicKey(hexToBytes(executorSessionPrivateKeyHex), true),
    );
    const actorEncryptedElectionPrivateKey = await eciesEncrypt(
      electionPrivateKeyHex,
      trusteeEncryptionPublicKey,
    );

    blockchainServiceMock.getElectionEnvelopeContext.mockResolvedValue({
      NodePublicEncryptAddress: nodeEncryptionPublicKey,
      ElectionEnvelopeVersion: 'election-envelope-v2.1',
    });
    electionsServiceMock.getElectionEnvelopeAccess.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      ActorEncryptedElectionPrivateKey: actorEncryptedElectionPrivateKey,
    });

    const request: SubmitElectionFinalizationShareRequest = {
      ElectionId: 'election-456',
      FinalizationSessionId: 'finalization-session-9',
      ActorPublicAddress: trusteeSigningPublicKey,
      ShareIndex: 3,
      ShareVersion: 'share-v3',
      TargetType: ElectionFinalizationTargetTypeProto.FinalizationTargetAggregateTally,
      ClaimedCloseArtifactId: 'close-artifact-9',
      ClaimedAcceptedBallotSetHash: {
        type: 'Buffer',
        data: [1, 2, 3, 4],
      } as unknown as string,
      ClaimedFinalEncryptedTallyHash: new Uint8Array([5, 6, 7, 8]) as unknown as string,
      ClaimedTargetTallyId: 'aggregate-tally-9',
      ClaimedCeremonyVersionId: 'ceremony-version-9',
      ClaimedTallyPublicKeyFingerprint: 'tally-fingerprint-11',
      CloseCountingJobId: 'job-close-counting-9',
      ExecutorSessionPublicKey: executorSessionPublicKey,
      ExecutorKeyAlgorithm: 'ecies-secp256k1-v1',
      ShareMaterial: 'aggregate-share-material-v3',
    };

    const { signedTransaction } = await createSubmitElectionFinalizationShareTransaction(
      request,
      trusteeEncryptionPublicKey,
      trusteeEncryptionPrivateKeyHex,
      trusteeSigningPrivateKeyHex,
    );

    const parsedTransaction = JSON.parse(signedTransaction) as {
      Payload: {
        ActorEncryptedElectionPrivateKey: string;
        EncryptedPayload: string;
      };
    };
    const actorElectionPrivateKey = await eciesDecrypt(
      parsedTransaction.Payload.ActorEncryptedElectionPrivateKey,
      trusteeEncryptionPrivateKeyHex,
    );
    const decryptedPayloadJson = await eciesDecrypt(
      parsedTransaction.Payload.EncryptedPayload,
      actorElectionPrivateKey,
    );
    const decryptedPayload = JSON.parse(decryptedPayloadJson) as {
      ActionPayload: {
        EncryptedExecutorSubmission: string | null;
      };
    };
    const decryptedExecutorSubmissionJson = await eciesDecrypt(
      decryptedPayload.ActionPayload.EncryptedExecutorSubmission!,
      executorSessionPrivateKeyHex,
    );
    const decryptedExecutorSubmission = JSON.parse(
      decryptedExecutorSubmissionJson,
    ) as CloseCountingExecutorSubmissionPayload;

    expect(decryptedExecutorSubmission.ClaimedAcceptedBallotSetHash).toBe(
      bytesToBase64(Uint8Array.from([1, 2, 3, 4]))
    );
    expect(decryptedExecutorSubmission.ClaimedFinalEncryptedTallyHash).toBe(
      bytesToBase64(Uint8Array.from([5, 6, 7, 8]))
    );
  });
});
