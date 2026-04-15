import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as secp256k1 from '@noble/secp256k1';
import { bytesToBase64, bytesToHex, eciesDecrypt, eciesEncrypt, hexToBytes } from '@/lib/crypto';
import {
  ElectionFinalizationTargetTypeProto,
  type ElectionDraftInput,
  type SubmitElectionFinalizationShareRequest,
} from '@/lib/grpc';
import {
  ENCRYPTED_ELECTION_ENVELOPE_PAYLOAD_KIND,
  type CloseCountingExecutorSubmissionPayload,
  createAcceptElectionBallotCastTransaction,
  createAcceptElectionTrusteeInvitationTransaction,
  createRegisterElectionVotingCommitmentTransaction,
  createApproveElectionGovernedProposalTransaction,
  createClaimElectionRosterEntryTransaction,
  createElectionDraftTransaction,
  createElectionReportAccessGrantTransaction,
  createElectionTrusteeInvitationTransaction,
  createOpenElectionTransaction,
  createRejectElectionTrusteeInvitationTransaction,
  createSubmitElectionFinalizationShareTransaction,
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
