import type { ElectionDraftInput } from '@/lib/grpc';
import * as secp256k1 from '@noble/secp256k1';
import { bytesToHex, createUnsignedTransaction, eciesDecrypt, eciesEncrypt, generateGuid, hexToBytes, signByUser } from '@/lib/crypto';
import { blockchainService } from '@/lib/grpc/services/blockchain';
import { electionsService } from '@/lib/grpc/services/elections';
import { identityService } from '@/lib/grpc/services/identity';

export const CREATE_ELECTION_DRAFT_PAYLOAD_KIND = '8d3b2f41-5e1f-4c7f-b08d-1a7c6f524001';
export const ENCRYPTED_ELECTION_ENVELOPE_PAYLOAD_KIND = 'e839953b-dc29-4d81-a44e-9694f6614943';
export const UPDATE_ELECTION_DRAFT_PAYLOAD_KIND = '3ff677e5-9d53-45e6-bd03-16d494dff27b';
export const INVITE_ELECTION_TRUSTEE_PAYLOAD_KIND = 'e78e2be3-b507-41ef-bef2-5f9427ed763f';
export const REVOKE_ELECTION_TRUSTEE_INVITATION_PAYLOAD_KIND = '5161830b-5d77-42ef-9f30-fa140eb71559';
export const START_ELECTION_GOVERNED_PROPOSAL_PAYLOAD_KIND = '5fb28a3a-bf04-44e1-aa18-aa75319f6e0f';
export const APPROVE_ELECTION_GOVERNED_PROPOSAL_PAYLOAD_KIND = 'b3467772-6e53-4c85-a03c-b945f452f6de';
export const RETRY_ELECTION_GOVERNED_PROPOSAL_EXECUTION_PAYLOAD_KIND = '47da657b-30b9-4d06-bae0-157048ff8cb4';
export const OPEN_ELECTION_PAYLOAD_KIND = '7f4e60ef-2a88-4794-9705-63f4721a0f7b';
export const CLOSE_ELECTION_PAYLOAD_KIND = '16d0401b-41b5-4d7f-8603-119e28fb53b0';
export const FINALIZE_ELECTION_PAYLOAD_KIND = 'ca90e62d-8bcb-4764-9386-70d74fb75627';

export interface CreateElectionDraftPayload {
  ElectionId: string;
  OwnerPublicAddress: string;
  SnapshotReason: string;
  Draft: ElectionDraftInput;
}

export interface EncryptedElectionEnvelopePayload {
  ElectionId: string;
  EnvelopeVersion: string;
  NodeEncryptedElectionPrivateKey: string;
  ActorEncryptedElectionPrivateKey: string;
  EncryptedPayload: string;
}

export interface EncryptedElectionActionEnvelope<TActionPayload> {
  ActionType: string;
  ActionPayload: TActionPayload;
}

export interface CreateElectionDraftActionPayload {
  OwnerPublicAddress: string;
  SnapshotReason: string;
  Draft: ElectionDraftInput;
}

export interface InviteElectionTrusteeActionPayload {
  InvitationId: string;
  ActorPublicAddress: string;
  TrusteeUserAddress: string;
  TrusteeEncryptedElectionPrivateKey: string;
  TrusteeDisplayName: string;
}

export interface InviteElectionTrusteePayload {
  ElectionId: string;
  InvitationId: string;
  ActorPublicAddress: string;
  TrusteeUserAddress: string;
  TrusteeDisplayName: string;
}

export interface UpdateElectionDraftActionPayload {
  ActorPublicAddress: string;
  SnapshotReason: string;
  Draft: ElectionDraftInput;
}

export interface UpdateElectionDraftPayload {
  ElectionId: string;
  ActorPublicAddress: string;
  SnapshotReason: string;
  Draft: ElectionDraftInput;
}

export interface RevokeElectionTrusteeInvitationPayload {
  ElectionId: string;
  InvitationId: string;
  ActorPublicAddress: string;
}

export interface StartElectionGovernedProposalPayload {
  ElectionId: string;
  ProposalId: string;
  ActionType: number;
  ActorPublicAddress: string;
}

export interface ApproveElectionGovernedProposalPayload {
  ElectionId: string;
  ProposalId: string;
  ActorPublicAddress: string;
  ApprovalNote: string;
}

export interface RetryElectionGovernedProposalExecutionPayload {
  ElectionId: string;
  ProposalId: string;
  ActorPublicAddress: string;
}

export interface OpenElectionPayload {
  ElectionId: string;
  ActorPublicAddress: string;
  RequiredWarningCodes: number[];
  FrozenEligibleVoterSetHash: string | null;
  TrusteePolicyExecutionReference: string;
  ReportingPolicyExecutionReference: string;
  ReviewWindowExecutionReference: string;
}

export interface CloseElectionPayload {
  ElectionId: string;
  ActorPublicAddress: string;
  AcceptedBallotSetHash: string | null;
  FinalEncryptedTallyHash: string | null;
}

export interface FinalizeElectionPayload {
  ElectionId: string;
  ActorPublicAddress: string;
  AcceptedBallotSetHash: string | null;
  FinalEncryptedTallyHash: string | null;
}

const ENCRYPTED_ELECTION_ACTION_TYPES = {
  CREATE_DRAFT: 'create_draft',
  UPDATE_DRAFT: 'update_draft',
  INVITE_TRUSTEE: 'invite_trustee',
} as const;

async function resolveElectionEnvelopePrivateKey(
  electionId: string | undefined,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string | undefined
): Promise<{ electionId: string; electionPrivateEncryptKeyHex: string; electionPublicEncryptKeyHex: string }> {
  const resolvedElectionId = electionId ?? generateGuid();

  let electionPrivateEncryptKeyHex: string;
  if (!electionId) {
    const generatedPrivateKey = secp256k1.utils.randomSecretKey();
    electionPrivateEncryptKeyHex = bytesToHex(generatedPrivateKey);
  } else {
    if (!actorPrivateEncryptKeyHex) {
      throw new Error('Actor encryption private key is required to reuse the election envelope.');
    }

    const accessResponse = await electionsService.getElectionEnvelopeAccess({
      ElectionId: electionId,
      ActorPublicAddress: actorPublicAddress,
    });
    if (!accessResponse.Success || !accessResponse.ActorEncryptedElectionPrivateKey) {
      throw new Error(accessResponse.ErrorMessage || 'Election envelope access is not available for this actor.');
    }

    electionPrivateEncryptKeyHex = await eciesDecrypt(
      accessResponse.ActorEncryptedElectionPrivateKey,
      actorPrivateEncryptKeyHex
    );
  }

  const electionPublicEncryptKeyHex = bytesToHex(
    secp256k1.getPublicKey(hexToBytes(electionPrivateEncryptKeyHex), false)
  );

  if (!actorPublicEncryptAddress) {
    throw new Error('Actor encryption public key is required to wrap the election envelope.');
  }

  return {
    electionId: resolvedElectionId,
    electionPrivateEncryptKeyHex,
    electionPublicEncryptKeyHex,
  };
}

async function createEncryptedElectionEnvelopeTransaction<TActionPayload>(
  electionId: string | undefined,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string | undefined,
  actionType: string,
  actionPayload: TActionPayload,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string; electionId: string }> {
  const envelopeContext = await blockchainService.getElectionEnvelopeContext();
  const envelopeKeys = await resolveElectionEnvelopePrivateKey(
    electionId,
    actorPublicAddress,
    actorPublicEncryptAddress,
    actorPrivateEncryptKeyHex
  );

  const nodeEncryptedElectionPrivateKey = await eciesEncrypt(
    envelopeKeys.electionPrivateEncryptKeyHex,
    envelopeContext.NodePublicEncryptAddress,
  );
  const actorEncryptedElectionPrivateKey = await eciesEncrypt(
    envelopeKeys.electionPrivateEncryptKeyHex,
    actorPublicEncryptAddress,
  );
  const encryptedActionPayload = await eciesEncrypt(
    JSON.stringify({
      ActionType: actionType,
      ActionPayload: actionPayload,
    } satisfies EncryptedElectionActionEnvelope<TActionPayload>),
    envelopeKeys.electionPublicEncryptKeyHex,
  );

  const unsignedTx = createUnsignedTransaction<EncryptedElectionEnvelopePayload>(
    ENCRYPTED_ELECTION_ENVELOPE_PAYLOAD_KIND,
    {
      ElectionId: envelopeKeys.electionId,
      EnvelopeVersion: envelopeContext.ElectionEnvelopeVersion,
      NodeEncryptedElectionPrivateKey: nodeEncryptedElectionPrivateKey,
      ActorEncryptedElectionPrivateKey: actorEncryptedElectionPrivateKey,
      EncryptedPayload: encryptedActionPayload,
    },
  );

  const signedTx = await signByUser(unsignedTx, {
    privateKey: hexToBytes(signingPrivateKeyHex),
    publicSigningAddress: actorPublicAddress,
  });

  return {
    signedTransaction: JSON.stringify(signedTx),
    electionId: envelopeKeys.electionId,
  };
}

export async function createElectionDraftTransaction(
  ownerPublicAddress: string,
  ownerPublicEncryptAddress: string,
  snapshotReason: string,
  draft: ElectionDraftInput,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string; electionId: string }> {
  return createEncryptedElectionEnvelopeTransaction<CreateElectionDraftActionPayload>(
    undefined,
    ownerPublicAddress,
    ownerPublicEncryptAddress,
    undefined,
    ENCRYPTED_ELECTION_ACTION_TYPES.CREATE_DRAFT,
    {
      OwnerPublicAddress: ownerPublicAddress,
      SnapshotReason: snapshotReason,
      Draft: draft,
    },
    signingPrivateKeyHex,
  );
}

export async function createUpdateElectionDraftTransaction(
  electionId: string,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string,
  snapshotReason: string,
  draft: ElectionDraftInput,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  const encryptedEnvelope = await createEncryptedElectionEnvelopeTransaction<UpdateElectionDraftActionPayload>(
    electionId,
    actorPublicAddress,
    actorPublicEncryptAddress,
    actorPrivateEncryptKeyHex,
    ENCRYPTED_ELECTION_ACTION_TYPES.UPDATE_DRAFT,
    {
      ActorPublicAddress: actorPublicAddress,
      SnapshotReason: snapshotReason,
      Draft: draft,
    },
    signingPrivateKeyHex,
  );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
  };
}

export async function createElectionTrusteeInvitationTransaction(
  electionId: string,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string,
  trusteeUserAddress: string,
  trusteeDisplayName: string,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string; invitationId: string }> {
  const invitationId = generateGuid();
  const envelopeKeys = await resolveElectionEnvelopePrivateKey(
    electionId,
    actorPublicAddress,
    actorPublicEncryptAddress,
    actorPrivateEncryptKeyHex,
  );
  const trusteeIdentity = await identityService.getIdentity(trusteeUserAddress);
  if (!trusteeIdentity.Successfull || !trusteeIdentity.PublicEncryptAddress) {
    throw new Error(`Trustee encryption key was not found for ${trusteeUserAddress}.`);
  }

  const trusteeEncryptedElectionPrivateKey = await eciesEncrypt(
    envelopeKeys.electionPrivateEncryptKeyHex,
    trusteeIdentity.PublicEncryptAddress,
  );
  const encryptedEnvelope = await createEncryptedElectionEnvelopeTransaction<InviteElectionTrusteeActionPayload>(
    electionId,
    actorPublicAddress,
    actorPublicEncryptAddress,
    actorPrivateEncryptKeyHex,
    ENCRYPTED_ELECTION_ACTION_TYPES.INVITE_TRUSTEE,
    {
      InvitationId: invitationId,
      ActorPublicAddress: actorPublicAddress,
      TrusteeUserAddress: trusteeUserAddress,
      TrusteeEncryptedElectionPrivateKey: trusteeEncryptedElectionPrivateKey,
      TrusteeDisplayName: trusteeDisplayName,
    },
    signingPrivateKeyHex,
  );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
    invitationId,
  };
}

export async function createRevokeElectionTrusteeInvitationTransaction(
  electionId: string,
  invitationId: string,
  actorPublicAddress: string,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  const unsignedTx = createUnsignedTransaction<RevokeElectionTrusteeInvitationPayload>(
    REVOKE_ELECTION_TRUSTEE_INVITATION_PAYLOAD_KIND,
    {
      ElectionId: electionId,
      InvitationId: invitationId,
      ActorPublicAddress: actorPublicAddress,
    },
  );

  const signedTx = await signByUser(unsignedTx, {
    privateKey: hexToBytes(signingPrivateKeyHex),
    publicSigningAddress: actorPublicAddress,
  });

  return {
    signedTransaction: JSON.stringify(signedTx),
  };
}

export async function createStartElectionGovernedProposalTransaction(
  electionId: string,
  actionType: number,
  actorPublicAddress: string,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string; proposalId: string }> {
  const proposalId = generateGuid();
  const unsignedTx = createUnsignedTransaction<StartElectionGovernedProposalPayload>(
    START_ELECTION_GOVERNED_PROPOSAL_PAYLOAD_KIND,
    {
      ElectionId: electionId,
      ProposalId: proposalId,
      ActionType: actionType,
      ActorPublicAddress: actorPublicAddress,
    },
  );

  const signedTx = await signByUser(unsignedTx, {
    privateKey: hexToBytes(signingPrivateKeyHex),
    publicSigningAddress: actorPublicAddress,
  });

  return {
    signedTransaction: JSON.stringify(signedTx),
    proposalId,
  };
}

export async function createApproveElectionGovernedProposalTransaction(
  electionId: string,
  proposalId: string,
  actorPublicAddress: string,
  approvalNote: string,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  const unsignedTx = createUnsignedTransaction<ApproveElectionGovernedProposalPayload>(
    APPROVE_ELECTION_GOVERNED_PROPOSAL_PAYLOAD_KIND,
    {
      ElectionId: electionId,
      ProposalId: proposalId,
      ActorPublicAddress: actorPublicAddress,
      ApprovalNote: approvalNote,
    },
  );

  const signedTx = await signByUser(unsignedTx, {
    privateKey: hexToBytes(signingPrivateKeyHex),
    publicSigningAddress: actorPublicAddress,
  });

  return {
    signedTransaction: JSON.stringify(signedTx),
  };
}

export async function createRetryElectionGovernedProposalExecutionTransaction(
  electionId: string,
  proposalId: string,
  actorPublicAddress: string,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  const unsignedTx = createUnsignedTransaction<RetryElectionGovernedProposalExecutionPayload>(
    RETRY_ELECTION_GOVERNED_PROPOSAL_EXECUTION_PAYLOAD_KIND,
    {
      ElectionId: electionId,
      ProposalId: proposalId,
      ActorPublicAddress: actorPublicAddress,
    },
  );

  const signedTx = await signByUser(unsignedTx, {
    privateKey: hexToBytes(signingPrivateKeyHex),
    publicSigningAddress: actorPublicAddress,
  });

  return {
    signedTransaction: JSON.stringify(signedTx),
  };
}

export async function createOpenElectionTransaction(
  electionId: string,
  actorPublicAddress: string,
  requiredWarningCodes: number[],
  frozenEligibleVoterSetHash: string | null,
  trusteePolicyExecutionReference: string,
  reportingPolicyExecutionReference: string,
  reviewWindowExecutionReference: string,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  const unsignedTx = createUnsignedTransaction<OpenElectionPayload>(OPEN_ELECTION_PAYLOAD_KIND, {
    ElectionId: electionId,
    ActorPublicAddress: actorPublicAddress,
    RequiredWarningCodes: requiredWarningCodes,
    FrozenEligibleVoterSetHash: frozenEligibleVoterSetHash,
    TrusteePolicyExecutionReference: trusteePolicyExecutionReference,
    ReportingPolicyExecutionReference: reportingPolicyExecutionReference,
    ReviewWindowExecutionReference: reviewWindowExecutionReference,
  });

  const signedTx = await signByUser(unsignedTx, {
    privateKey: hexToBytes(signingPrivateKeyHex),
    publicSigningAddress: actorPublicAddress,
  });

  return {
    signedTransaction: JSON.stringify(signedTx),
  };
}

export async function createCloseElectionTransaction(
  electionId: string,
  actorPublicAddress: string,
  acceptedBallotSetHash: string | null,
  finalEncryptedTallyHash: string | null,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  const unsignedTx = createUnsignedTransaction<CloseElectionPayload>(CLOSE_ELECTION_PAYLOAD_KIND, {
    ElectionId: electionId,
    ActorPublicAddress: actorPublicAddress,
    AcceptedBallotSetHash: acceptedBallotSetHash,
    FinalEncryptedTallyHash: finalEncryptedTallyHash,
  });

  const signedTx = await signByUser(unsignedTx, {
    privateKey: hexToBytes(signingPrivateKeyHex),
    publicSigningAddress: actorPublicAddress,
  });

  return {
    signedTransaction: JSON.stringify(signedTx),
  };
}

export async function createFinalizeElectionTransaction(
  electionId: string,
  actorPublicAddress: string,
  acceptedBallotSetHash: string | null,
  finalEncryptedTallyHash: string | null,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  const unsignedTx = createUnsignedTransaction<FinalizeElectionPayload>(
    FINALIZE_ELECTION_PAYLOAD_KIND,
    {
      ElectionId: electionId,
      ActorPublicAddress: actorPublicAddress,
      AcceptedBallotSetHash: acceptedBallotSetHash,
      FinalEncryptedTallyHash: finalEncryptedTallyHash,
    },
  );

  const signedTx = await signByUser(unsignedTx, {
    privateKey: hexToBytes(signingPrivateKeyHex),
    publicSigningAddress: actorPublicAddress,
  });

  return {
    signedTransaction: JSON.stringify(signedTx),
  };
}
