import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as secp256k1 from '@noble/secp256k1';
import { bytesToHex, eciesDecrypt, eciesEncrypt, hexToBytes } from '@/lib/crypto';
import type { ElectionDraftInput } from '@/lib/grpc';
import {
  ENCRYPTED_ELECTION_ENVELOPE_PAYLOAD_KIND,
  createElectionDraftTransaction,
  createElectionTrusteeInvitationTransaction,
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

  it('creates an encrypted election envelope with node and actor key wrappers', async () => {
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
      ElectionEnvelopeVersion: 'election-envelope-v1',
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
        EncryptedPayload: string;
      };
    };

    expect(parsedTransaction.PayloadKind).toBe(ENCRYPTED_ELECTION_ENVELOPE_PAYLOAD_KIND);
    expect(parsedTransaction.UserSignature.Signatory).toBe(ownerSigningPublicKey);
    expect(parsedTransaction.Payload.ElectionId).toBe(electionId);
    expect(parsedTransaction.Payload.EnvelopeVersion).toBe('election-envelope-v1');

    const nodeElectionPrivateKey = await eciesDecrypt(
      parsedTransaction.Payload.NodeEncryptedElectionPrivateKey,
      nodeEncryptionPrivateKeyHex,
    );
    const actorElectionPrivateKey = await eciesDecrypt(
      parsedTransaction.Payload.ActorEncryptedElectionPrivateKey,
      ownerEncryptionPrivateKeyHex,
    );

    expect(actorElectionPrivateKey).toBe(nodeElectionPrivateKey);

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
      ElectionEnvelopeVersion: 'election-envelope-v1',
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
      decryptedPayload.ActionPayload.TrusteeEncryptedElectionPrivateKey,
      trusteeEncryptionPrivateKeyHex,
    );

    expect(decryptedPayload.ActionType).toBe('invite_trustee');
    expect(decryptedPayload.ActionPayload.TrusteeUserAddress).toBe('trustee-address');
    expect(trusteeElectionPrivateKey).toBe(electionPrivateKeyHex);
  });
});
