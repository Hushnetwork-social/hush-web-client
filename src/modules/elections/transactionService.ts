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

export interface ResolveElectionTrusteeInvitationActionPayload {
  InvitationId: string;
  ActorPublicAddress: string;
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

export interface StartElectionCeremonyActionPayload {
  ActorPublicAddress: string;
  ProfileId: string;
}

export interface RestartElectionCeremonyActionPayload {
  ActorPublicAddress: string;
  ProfileId: string;
  RestartReason: string;
}

export interface PublishElectionCeremonyTransportKeyActionPayload {
  CeremonyVersionId: string;
  ActorPublicAddress: string;
  TransportPublicKeyFingerprint: string;
}

export interface JoinElectionCeremonyActionPayload {
  CeremonyVersionId: string;
  ActorPublicAddress: string;
}

export interface RecordElectionCeremonySelfTestActionPayload {
  CeremonyVersionId: string;
  ActorPublicAddress: string;
}

export interface SubmitElectionCeremonyMaterialActionPayload {
  CeremonyVersionId: string;
  ActorPublicAddress: string;
  RecipientTrusteeUserAddress?: string | null;
  MessageType: string;
  PayloadVersion: string;
  EncryptedPayload: string;
  PayloadFingerprint: string;
}

export interface RecordElectionCeremonyValidationFailureActionPayload {
  CeremonyVersionId: string;
  ActorPublicAddress: string;
  TrusteeUserAddress: string;
  ValidationFailureReason: string;
  EvidenceReference?: string | null;
}

export interface CompleteElectionCeremonyTrusteeActionPayload {
  CeremonyVersionId: string;
  ActorPublicAddress: string;
  TrusteeUserAddress: string;
  ShareVersion: string;
  TallyPublicKeyFingerprint?: string | null;
}

export interface RecordElectionCeremonyShareExportActionPayload {
  CeremonyVersionId: string;
  ActorPublicAddress: string;
  ShareVersion: string;
}

export interface RecordElectionCeremonyShareImportActionPayload {
  CeremonyVersionId: string;
  ActorPublicAddress: string;
  ImportedElectionId: string;
  ImportedCeremonyVersionId: string;
  ImportedTrusteeUserAddress: string;
  ImportedShareVersion: string;
}

export interface RevokeElectionTrusteeInvitationActionPayload {
  InvitationId: string;
  ActorPublicAddress: string;
}

export interface StartElectionGovernedProposalActionPayload {
  ProposalId: string;
  ActionType: number;
  ActorPublicAddress: string;
}

export interface ApproveElectionGovernedProposalActionPayload {
  ProposalId: string;
  ActorPublicAddress: string;
  ApprovalNote: string;
}

export interface RetryElectionGovernedProposalExecutionActionPayload {
  ProposalId: string;
  ActorPublicAddress: string;
}

export interface OpenElectionActionPayload {
  ActorPublicAddress: string;
  RequiredWarningCodes: number[];
  FrozenEligibleVoterSetHash: string | null;
  TrusteePolicyExecutionReference: string;
  ReportingPolicyExecutionReference: string;
  ReviewWindowExecutionReference: string;
}

export interface CloseElectionActionPayload {
  ActorPublicAddress: string;
  AcceptedBallotSetHash: string | null;
  FinalEncryptedTallyHash: string | null;
}

export interface FinalizeElectionActionPayload {
  ActorPublicAddress: string;
  AcceptedBallotSetHash: string | null;
  FinalEncryptedTallyHash: string | null;
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
  ACCEPT_TRUSTEE_INVITATION: 'accept_trustee_invitation',
  REJECT_TRUSTEE_INVITATION: 'reject_trustee_invitation',
  REVOKE_TRUSTEE_INVITATION: 'revoke_trustee_invitation',
  START_GOVERNED_PROPOSAL: 'start_governed_proposal',
  APPROVE_GOVERNED_PROPOSAL: 'approve_governed_proposal',
  RETRY_GOVERNED_PROPOSAL_EXECUTION: 'retry_governed_proposal_execution',
  OPEN_ELECTION: 'open_election',
  CLOSE_ELECTION: 'close_election',
  FINALIZE_ELECTION: 'finalize_election',
  START_CEREMONY: 'start_ceremony',
  RESTART_CEREMONY: 'restart_ceremony',
  PUBLISH_CEREMONY_TRANSPORT_KEY: 'publish_ceremony_transport_key',
  JOIN_CEREMONY: 'join_ceremony',
  RECORD_CEREMONY_SELF_TEST_SUCCESS: 'record_ceremony_self_test_success',
  SUBMIT_CEREMONY_MATERIAL: 'submit_ceremony_material',
  RECORD_CEREMONY_VALIDATION_FAILURE: 'record_ceremony_validation_failure',
  COMPLETE_CEREMONY_TRUSTEE: 'complete_ceremony_trustee',
  RECORD_CEREMONY_SHARE_EXPORT: 'record_ceremony_share_export',
  RECORD_CEREMONY_SHARE_IMPORT: 'record_ceremony_share_import',
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

async function createResolveElectionTrusteeInvitationTransaction(
  actionType:
    | typeof ENCRYPTED_ELECTION_ACTION_TYPES.ACCEPT_TRUSTEE_INVITATION
    | typeof ENCRYPTED_ELECTION_ACTION_TYPES.REJECT_TRUSTEE_INVITATION,
  electionId: string,
  invitationId: string,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<ResolveElectionTrusteeInvitationActionPayload>(
      electionId,
      actorPublicAddress,
      actorPublicEncryptAddress,
      actorPrivateEncryptKeyHex,
      actionType,
      {
        InvitationId: invitationId,
        ActorPublicAddress: actorPublicAddress,
      },
      signingPrivateKeyHex,
    );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
  };
}

export async function createAcceptElectionTrusteeInvitationTransaction(
  electionId: string,
  invitationId: string,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  return createResolveElectionTrusteeInvitationTransaction(
    ENCRYPTED_ELECTION_ACTION_TYPES.ACCEPT_TRUSTEE_INVITATION,
    electionId,
    invitationId,
    actorPublicAddress,
    actorPublicEncryptAddress,
    actorPrivateEncryptKeyHex,
    signingPrivateKeyHex,
  );
}

export async function createRejectElectionTrusteeInvitationTransaction(
  electionId: string,
  invitationId: string,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  return createResolveElectionTrusteeInvitationTransaction(
    ENCRYPTED_ELECTION_ACTION_TYPES.REJECT_TRUSTEE_INVITATION,
    electionId,
    invitationId,
    actorPublicAddress,
    actorPublicEncryptAddress,
    actorPrivateEncryptKeyHex,
    signingPrivateKeyHex,
  );
}

export async function createStartElectionCeremonyTransaction(
  electionId: string,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string,
  profileId: string,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<StartElectionCeremonyActionPayload>(
      electionId,
      actorPublicAddress,
      actorPublicEncryptAddress,
      actorPrivateEncryptKeyHex,
      ENCRYPTED_ELECTION_ACTION_TYPES.START_CEREMONY,
      {
        ActorPublicAddress: actorPublicAddress,
        ProfileId: profileId,
      },
      signingPrivateKeyHex,
    );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
  };
}

export async function createRestartElectionCeremonyTransaction(
  electionId: string,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string,
  profileId: string,
  restartReason: string,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<RestartElectionCeremonyActionPayload>(
      electionId,
      actorPublicAddress,
      actorPublicEncryptAddress,
      actorPrivateEncryptKeyHex,
      ENCRYPTED_ELECTION_ACTION_TYPES.RESTART_CEREMONY,
      {
        ActorPublicAddress: actorPublicAddress,
        ProfileId: profileId,
        RestartReason: restartReason,
      },
      signingPrivateKeyHex,
    );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
  };
}

export async function createPublishElectionCeremonyTransportKeyTransaction(
  electionId: string,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string,
  ceremonyVersionId: string,
  transportPublicKeyFingerprint: string,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<PublishElectionCeremonyTransportKeyActionPayload>(
      electionId,
      actorPublicAddress,
      actorPublicEncryptAddress,
      actorPrivateEncryptKeyHex,
      ENCRYPTED_ELECTION_ACTION_TYPES.PUBLISH_CEREMONY_TRANSPORT_KEY,
      {
        CeremonyVersionId: ceremonyVersionId,
        ActorPublicAddress: actorPublicAddress,
        TransportPublicKeyFingerprint: transportPublicKeyFingerprint,
      },
      signingPrivateKeyHex,
    );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
  };
}

export async function createJoinElectionCeremonyTransaction(
  electionId: string,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string,
  ceremonyVersionId: string,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<JoinElectionCeremonyActionPayload>(
      electionId,
      actorPublicAddress,
      actorPublicEncryptAddress,
      actorPrivateEncryptKeyHex,
      ENCRYPTED_ELECTION_ACTION_TYPES.JOIN_CEREMONY,
      {
        CeremonyVersionId: ceremonyVersionId,
        ActorPublicAddress: actorPublicAddress,
      },
      signingPrivateKeyHex,
    );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
  };
}

export async function createRecordElectionCeremonySelfTestSuccessTransaction(
  electionId: string,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string,
  ceremonyVersionId: string,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<RecordElectionCeremonySelfTestActionPayload>(
      electionId,
      actorPublicAddress,
      actorPublicEncryptAddress,
      actorPrivateEncryptKeyHex,
      ENCRYPTED_ELECTION_ACTION_TYPES.RECORD_CEREMONY_SELF_TEST_SUCCESS,
      {
        CeremonyVersionId: ceremonyVersionId,
        ActorPublicAddress: actorPublicAddress,
      },
      signingPrivateKeyHex,
    );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
  };
}

export async function createSubmitElectionCeremonyMaterialTransaction(
  electionId: string,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string,
  ceremonyVersionId: string,
  recipientTrusteeUserAddress: string | null | undefined,
  messageType: string,
  payloadVersion: string,
  encryptedPayload: string,
  payloadFingerprint: string,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<SubmitElectionCeremonyMaterialActionPayload>(
      electionId,
      actorPublicAddress,
      actorPublicEncryptAddress,
      actorPrivateEncryptKeyHex,
      ENCRYPTED_ELECTION_ACTION_TYPES.SUBMIT_CEREMONY_MATERIAL,
      {
        CeremonyVersionId: ceremonyVersionId,
        ActorPublicAddress: actorPublicAddress,
        RecipientTrusteeUserAddress: recipientTrusteeUserAddress,
        MessageType: messageType,
        PayloadVersion: payloadVersion,
        EncryptedPayload: encryptedPayload,
        PayloadFingerprint: payloadFingerprint,
      },
      signingPrivateKeyHex,
    );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
  };
}

export async function createRecordElectionCeremonyValidationFailureTransaction(
  electionId: string,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string,
  ceremonyVersionId: string,
  trusteeUserAddress: string,
  validationFailureReason: string,
  evidenceReference: string | null | undefined,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<RecordElectionCeremonyValidationFailureActionPayload>(
      electionId,
      actorPublicAddress,
      actorPublicEncryptAddress,
      actorPrivateEncryptKeyHex,
      ENCRYPTED_ELECTION_ACTION_TYPES.RECORD_CEREMONY_VALIDATION_FAILURE,
      {
        CeremonyVersionId: ceremonyVersionId,
        ActorPublicAddress: actorPublicAddress,
        TrusteeUserAddress: trusteeUserAddress,
        ValidationFailureReason: validationFailureReason,
        EvidenceReference: evidenceReference,
      },
      signingPrivateKeyHex,
    );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
  };
}

export async function createCompleteElectionCeremonyTrusteeTransaction(
  electionId: string,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string,
  ceremonyVersionId: string,
  trusteeUserAddress: string,
  shareVersion: string,
  tallyPublicKeyFingerprint: string | null | undefined,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<CompleteElectionCeremonyTrusteeActionPayload>(
      electionId,
      actorPublicAddress,
      actorPublicEncryptAddress,
      actorPrivateEncryptKeyHex,
      ENCRYPTED_ELECTION_ACTION_TYPES.COMPLETE_CEREMONY_TRUSTEE,
      {
        CeremonyVersionId: ceremonyVersionId,
        ActorPublicAddress: actorPublicAddress,
        TrusteeUserAddress: trusteeUserAddress,
        ShareVersion: shareVersion,
        TallyPublicKeyFingerprint: tallyPublicKeyFingerprint,
      },
      signingPrivateKeyHex,
    );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
  };
}

export async function createRecordElectionCeremonyShareExportTransaction(
  electionId: string,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string,
  ceremonyVersionId: string,
  shareVersion: string,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<RecordElectionCeremonyShareExportActionPayload>(
      electionId,
      actorPublicAddress,
      actorPublicEncryptAddress,
      actorPrivateEncryptKeyHex,
      ENCRYPTED_ELECTION_ACTION_TYPES.RECORD_CEREMONY_SHARE_EXPORT,
      {
        CeremonyVersionId: ceremonyVersionId,
        ActorPublicAddress: actorPublicAddress,
        ShareVersion: shareVersion,
      },
      signingPrivateKeyHex,
    );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
  };
}

export async function createRecordElectionCeremonyShareImportTransaction(
  electionId: string,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string,
  ceremonyVersionId: string,
  importedElectionId: string,
  importedCeremonyVersionId: string,
  importedTrusteeUserAddress: string,
  importedShareVersion: string,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<RecordElectionCeremonyShareImportActionPayload>(
      electionId,
      actorPublicAddress,
      actorPublicEncryptAddress,
      actorPrivateEncryptKeyHex,
      ENCRYPTED_ELECTION_ACTION_TYPES.RECORD_CEREMONY_SHARE_IMPORT,
      {
        CeremonyVersionId: ceremonyVersionId,
        ActorPublicAddress: actorPublicAddress,
        ImportedElectionId: importedElectionId,
        ImportedCeremonyVersionId: importedCeremonyVersionId,
        ImportedTrusteeUserAddress: importedTrusteeUserAddress,
        ImportedShareVersion: importedShareVersion,
      },
      signingPrivateKeyHex,
    );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
  };
}

export async function createRevokeElectionTrusteeInvitationTransaction(
  electionId: string,
  invitationId: string,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<RevokeElectionTrusteeInvitationActionPayload>(
      electionId,
      actorPublicAddress,
      actorPublicEncryptAddress,
      actorPrivateEncryptKeyHex,
      ENCRYPTED_ELECTION_ACTION_TYPES.REVOKE_TRUSTEE_INVITATION,
      {
        InvitationId: invitationId,
        ActorPublicAddress: actorPublicAddress,
      },
      signingPrivateKeyHex,
    );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
  };
}

export async function createStartElectionGovernedProposalTransaction(
  electionId: string,
  actionType: number,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string; proposalId: string }> {
  const proposalId = generateGuid();
  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<StartElectionGovernedProposalActionPayload>(
      electionId,
      actorPublicAddress,
      actorPublicEncryptAddress,
      actorPrivateEncryptKeyHex,
      ENCRYPTED_ELECTION_ACTION_TYPES.START_GOVERNED_PROPOSAL,
      {
        ProposalId: proposalId,
        ActionType: actionType,
        ActorPublicAddress: actorPublicAddress,
      },
      signingPrivateKeyHex,
    );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
    proposalId,
  };
}

export async function createApproveElectionGovernedProposalTransaction(
  electionId: string,
  proposalId: string,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string,
  approvalNote: string,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<ApproveElectionGovernedProposalActionPayload>(
      electionId,
      actorPublicAddress,
      actorPublicEncryptAddress,
      actorPrivateEncryptKeyHex,
      ENCRYPTED_ELECTION_ACTION_TYPES.APPROVE_GOVERNED_PROPOSAL,
      {
        ProposalId: proposalId,
        ActorPublicAddress: actorPublicAddress,
        ApprovalNote: approvalNote,
      },
      signingPrivateKeyHex,
    );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
  };
}

export async function createRetryElectionGovernedProposalExecutionTransaction(
  electionId: string,
  proposalId: string,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<RetryElectionGovernedProposalExecutionActionPayload>(
      electionId,
      actorPublicAddress,
      actorPublicEncryptAddress,
      actorPrivateEncryptKeyHex,
      ENCRYPTED_ELECTION_ACTION_TYPES.RETRY_GOVERNED_PROPOSAL_EXECUTION,
      {
        ProposalId: proposalId,
        ActorPublicAddress: actorPublicAddress,
      },
      signingPrivateKeyHex,
    );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
  };
}

export async function createOpenElectionTransaction(
  electionId: string,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string,
  requiredWarningCodes: number[],
  frozenEligibleVoterSetHash: string | null,
  trusteePolicyExecutionReference: string,
  reportingPolicyExecutionReference: string,
  reviewWindowExecutionReference: string,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<OpenElectionActionPayload>(
      electionId,
      actorPublicAddress,
      actorPublicEncryptAddress,
      actorPrivateEncryptKeyHex,
      ENCRYPTED_ELECTION_ACTION_TYPES.OPEN_ELECTION,
      {
        ActorPublicAddress: actorPublicAddress,
        RequiredWarningCodes: requiredWarningCodes,
        FrozenEligibleVoterSetHash: frozenEligibleVoterSetHash,
        TrusteePolicyExecutionReference: trusteePolicyExecutionReference,
        ReportingPolicyExecutionReference: reportingPolicyExecutionReference,
        ReviewWindowExecutionReference: reviewWindowExecutionReference,
      },
      signingPrivateKeyHex,
    );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
  };
}

export async function createCloseElectionTransaction(
  electionId: string,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string,
  acceptedBallotSetHash: string | null,
  finalEncryptedTallyHash: string | null,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<CloseElectionActionPayload>(
      electionId,
      actorPublicAddress,
      actorPublicEncryptAddress,
      actorPrivateEncryptKeyHex,
      ENCRYPTED_ELECTION_ACTION_TYPES.CLOSE_ELECTION,
      {
        ActorPublicAddress: actorPublicAddress,
        AcceptedBallotSetHash: acceptedBallotSetHash,
        FinalEncryptedTallyHash: finalEncryptedTallyHash,
      },
      signingPrivateKeyHex,
    );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
  };
}

export async function createFinalizeElectionTransaction(
  electionId: string,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string,
  acceptedBallotSetHash: string | null,
  finalEncryptedTallyHash: string | null,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<FinalizeElectionActionPayload>(
      electionId,
      actorPublicAddress,
      actorPublicEncryptAddress,
      actorPrivateEncryptKeyHex,
      ENCRYPTED_ELECTION_ACTION_TYPES.FINALIZE_ELECTION,
      {
        ActorPublicAddress: actorPublicAddress,
        AcceptedBallotSetHash: acceptedBallotSetHash,
        FinalEncryptedTallyHash: finalEncryptedTallyHash,
      },
      signingPrivateKeyHex,
    );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
  };
}
