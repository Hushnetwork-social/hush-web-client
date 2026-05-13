import type {
  ECPoint,
  ElectionAnomalyMessageView,
  ElectionDraftInput,
  SubmitElectionFinalizationShareRequest,
} from '@/lib/grpc';
import * as secp256k1 from '@noble/secp256k1';
import {
  aesDecrypt,
  aesEncrypt,
  bytesToBase64,
  bytesToHex,
  createUnsignedTransaction,
  eciesDecrypt,
  eciesEncrypt,
  generateAesKey,
  generateGuid,
  hexToBytes,
  signByUser,
} from '@/lib/crypto';
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

export const ELECTION_ANOMALY_BODY_MAX_CHARACTERS = 1000;
export const ELECTION_ANOMALY_CLARIFICATION_BODY_MAX_CHARACTERS = 1000;
export const ELECTION_ANOMALY_WRAP_ALGORITHM = 'x25519-aes-gcm';

export const ELECTION_ANOMALY_CATEGORY_IDS = {
  ACCESS_OR_AUTHENTICATION: 'access_or_authentication_anomaly',
  BALLOT_CASTING_OR_RECEIPT: 'ballot_casting_or_receipt_anomaly',
  TRUSTEE_CONTINUITY: 'trustee_continuity_anomaly',
  COUNTING_OR_TALLY: 'counting_or_tally_anomaly',
  REPORTING_OR_AUDIT_PACKAGE: 'reporting_or_audit_package_anomaly',
  SECURITY_OR_INTEGRITY: 'security_or_integrity_concern',
  EXTERNAL_OBJECTION_OR_COMPLAINT: 'external_objection_or_complaint',
  OTHER_PROCESS: 'other_process_anomaly',
} as const;

export const ELECTION_ANOMALY_CATEGORY_ID_VALUES = Object.values(ELECTION_ANOMALY_CATEGORY_IDS);

export type ElectionAnomalyCategoryId = typeof ELECTION_ANOMALY_CATEGORY_ID_VALUES[number];

export const ELECTION_ANOMALY_MESSAGE_KIND_IDS = {
  INITIAL_SUBMISSION: 'initial_submission',
  AUTHORITY_INFORMATION_REQUEST: 'authority_information_request',
  SUBMITTER_INFORMATION_RESPONSE: 'submitter_information_response',
  AUTHORITY_RESPONSE: 'authority_response',
} as const;

export const ELECTION_ANOMALY_RECIPIENT_ROLE_IDS = {
  SUBMITTER: 'submitter',
  ELECTION_OWNER: 'election_owner',
} as const;

export const ELECTION_ANOMALY_RECIPIENT_WRAP_STATUS_IDS = {
  AVAILABLE: 'available',
} as const;

export const ELECTION_ANOMALY_VALIDATION_CODES = {
  DUPLICATE_THREAD: 'anomaly_duplicate_thread',
  BODY_REQUIRED: 'anomaly_body_required',
  BODY_TOO_LONG: 'anomaly_body_too_long',
  CATEGORY_INVALID: 'anomaly_category_invalid',
  FOLLOWUP_NOT_REQUESTED: 'anomaly_followup_not_requested',
  CLARIFICATION_REQUEST_NOT_OPEN: 'anomaly_clarification_request_not_open',
} as const;

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
  ElectionPublicEncryptKey: string;
  EncryptedPayload: string;
  ActionType: string;
  ActionPayload: unknown;
  ActionArtifacts?: unknown;
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

export interface InviteElectionTrusteeActionArtifacts {
  TrusteeEncryptedElectionPrivateKey: string;
}

export interface CreateElectionReportAccessGrantActionPayload {
  ActorPublicAddress: string;
  DesignatedAuditorPublicAddress: string;
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

export interface RefreshProtocolPackageBindingActionPayload {
  ActorPublicAddress: string;
}

export interface ElectionRosterImportItemPayload {
  OrganizationVoterId: string;
  ContactType: number;
  ContactValue: string;
  IsInitiallyActive: boolean;
}

export interface ImportElectionRosterActionPayload {
  ActorPublicAddress: string;
  RosterEntries: ElectionRosterImportItemPayload[];
}

export interface ClaimElectionRosterEntryActionPayload {
  ActorPublicAddress: string;
  OrganizationVoterId: string;
  VerificationCode: string;
}

export interface ActivateElectionRosterEntryActionPayload {
  ActorPublicAddress: string;
  OrganizationVoterId: string;
}

export interface RegisterElectionVotingCommitmentActionPayload {
  ActorPublicAddress: string;
  CommitmentHash: string;
}

export interface RegisterPreparedBallotCommitmentActionPayload {
  ActorPublicAddress: string;
  PreparedBallotId: string;
  PreparedBallotHash: string;
  BallotDefinitionVersion: number;
  BallotDefinitionHash: string;
  CeremonyProfileId: string;
  ProofStatementId: string;
}

export interface SpoilPreparedBallotActionPayload {
  ActorPublicAddress: string;
  PreparedBallotId: string;
  PreparedBallotHash: string;
  SpoiledTranscriptHash: string;
  SpoilRecordHash: string;
  LocalVerifierVersion: string;
}

export interface AcceptElectionBallotCastActionPayload {
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
  PreparedBallotId?: string;
  PreparedBallotHash?: string;
  ReceiptCommitment?: string;
  ReceiptCommitmentScheme?: string;
  BallotDefinitionVersion?: number;
  BallotDefinitionHash?: string;
}

export interface ElectionAnomalyRecipientWrapPayload {
  RecipientRoleId: string;
  RecipientPublicAddress: string;
  RecipientKeyFingerprint: string;
  EncryptedContentKey: string;
  WrapAlgorithm: string;
  WrapStatusId: string;
}

export interface ElectionAnomalyMessageEnvelopePayload {
  MessageId: string;
  MessageKindId: string;
  EncryptedBody: string;
  EncryptedBodyHash: string;
  PlaintextCharacterCount: number;
  RecipientWraps: ElectionAnomalyRecipientWrapPayload[];
  PlaintextBodyHash?: string | null;
  EncryptionAlgorithm?: string | null;
}

export interface SubmitElectionAnomalyThreadActionPayload {
  AnomalyThreadId: string;
  ActionNonce: string;
  ActorPublicAddress: string;
  CategoryId: string;
  InitialMessage: ElectionAnomalyMessageEnvelopePayload;
  ActorRoleContextId?: string | null;
}

export interface SubmitElectionAnomalyInformationActionPayload {
  AnomalyThreadId: string;
  ClarificationRequestId: string;
  ActionNonce: string;
  ActorPublicAddress: string;
  ResponseMessage: ElectionAnomalyMessageEnvelopePayload;
}

export interface CreateSubmitElectionAnomalyThreadTransactionInput {
  ElectionId: string;
  ActorPublicAddress: string;
  ActorPublicEncryptAddress: string;
  ActorPrivateEncryptKeyHex: string;
  OwnerPublicAddress: string;
  CategoryId: string;
  Body: string;
  SigningPrivateKeyHex: string;
  ActorRoleContextId?: string | null;
}

export interface CreateSubmitElectionAnomalyInformationTransactionInput {
  ElectionId: string;
  AnomalyThreadId: string;
  ClarificationRequestId: string;
  ActorPublicAddress: string;
  ActorPublicEncryptAddress: string;
  ActorPrivateEncryptKeyHex: string;
  OwnerPublicAddress: string;
  Body: string;
  SigningPrivateKeyHex: string;
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
  ShareVersion: string;
  CloseCountingPublicCommitment?: ECPoint | null;
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

export interface CloseCountingExecutorSubmissionPayload {
  CloseCountingJobId: string;
  ElectionId: string;
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
  ShareMaterial: string;
}

export interface SubmitElectionFinalizationShareActionPayload {
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

function isByteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 255;
}

function normalizeOptionalBinaryClaim(value: unknown, fieldName: string): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Uint8Array) {
    return bytesToBase64(value);
  }

  if (Array.isArray(value) && value.every(isByteNumber)) {
    return bytesToBase64(Uint8Array.from(value));
  }

  if (typeof value === 'object') {
    const bufferLike = value as {
      data?: unknown;
    };

    if (Array.isArray(bufferLike.data) && bufferLike.data.every(isByteNumber)) {
      return bytesToBase64(Uint8Array.from(bufferLike.data));
    }
  }

  throw new Error(`${fieldName} must be a base64 string or byte array.`);
}

function countUnicodeCharacters(value: string): number {
  return Array.from(value).length;
}

function normalizeAnomalyBody(body: string, maxCharacters: number): string {
  const normalized = body.trim();
  if (!normalized) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.BODY_REQUIRED);
  }

  if (countUnicodeCharacters(normalized) > maxCharacters) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.BODY_TOO_LONG);
  }

  return normalized;
}

export function isElectionAnomalyCategoryId(value: string): value is ElectionAnomalyCategoryId {
  return ELECTION_ANOMALY_CATEGORY_ID_VALUES.includes(value as ElectionAnomalyCategoryId);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return `sha256:${bytesToHex(new Uint8Array(digest))}`;
}

async function resolveAnomalyOwnerEncryptAddress(
  ownerPublicAddress: string,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
): Promise<string> {
  if (ownerPublicAddress === actorPublicAddress) {
    return actorPublicEncryptAddress;
  }

  const ownerIdentity = await identityService.getIdentity(ownerPublicAddress);
  if (!ownerIdentity.Successfull || !ownerIdentity.PublicEncryptAddress) {
    throw new Error(`Election owner encryption key was not found for ${ownerPublicAddress}.`);
  }

  return ownerIdentity.PublicEncryptAddress;
}

async function createAnomalyRecipientWrap(
  recipientRoleId: string,
  recipientPublicAddress: string,
  recipientPublicEncryptAddress: string,
  contentKey: string,
): Promise<ElectionAnomalyRecipientWrapPayload> {
  return {
    RecipientRoleId: recipientRoleId,
    RecipientPublicAddress: recipientPublicAddress,
    RecipientKeyFingerprint: await sha256Hex(recipientPublicEncryptAddress),
    EncryptedContentKey: await eciesEncrypt(contentKey, recipientPublicEncryptAddress),
    WrapAlgorithm: ELECTION_ANOMALY_WRAP_ALGORITHM,
    WrapStatusId: ELECTION_ANOMALY_RECIPIENT_WRAP_STATUS_IDS.AVAILABLE,
  };
}

export async function createElectionAnomalyMessageEnvelope(input: {
  MessageKindId: string;
  Body: string;
  ActorPublicAddress: string;
  ActorPublicEncryptAddress: string;
  OwnerPublicAddress: string;
  MaxCharacters?: number;
}): Promise<ElectionAnomalyMessageEnvelopePayload> {
  const body = normalizeAnomalyBody(
    input.Body,
    input.MaxCharacters ?? ELECTION_ANOMALY_BODY_MAX_CHARACTERS,
  );
  const ownerPublicEncryptAddress = await resolveAnomalyOwnerEncryptAddress(
    input.OwnerPublicAddress,
    input.ActorPublicAddress,
    input.ActorPublicEncryptAddress,
  );
  const contentKey = generateAesKey();
  const encryptedBody = await aesEncrypt(body, contentKey);

  return {
    MessageId: generateGuid(),
    MessageKindId: input.MessageKindId,
    EncryptedBody: encryptedBody,
    EncryptedBodyHash: await sha256Hex(encryptedBody),
    PlaintextCharacterCount: countUnicodeCharacters(body),
    RecipientWraps: [
      await createAnomalyRecipientWrap(
        ELECTION_ANOMALY_RECIPIENT_ROLE_IDS.SUBMITTER,
        input.ActorPublicAddress,
        input.ActorPublicEncryptAddress,
        contentKey,
      ),
      await createAnomalyRecipientWrap(
        ELECTION_ANOMALY_RECIPIENT_ROLE_IDS.ELECTION_OWNER,
        input.OwnerPublicAddress,
        ownerPublicEncryptAddress,
        contentKey,
      ),
    ],
    PlaintextBodyHash: await sha256Hex(body),
    EncryptionAlgorithm: ELECTION_ANOMALY_WRAP_ALGORITHM,
  };
}

export async function decryptElectionAnomalyMessageBody(
  message: ElectionAnomalyMessageView,
  actorPrivateEncryptKeyHex: string,
): Promise<string> {
  const callerWrap = message.RecipientWraps.find((wrap) =>
    Boolean(wrap.EncryptedContentKey?.trim()) &&
    wrap.WrapStatusId === ELECTION_ANOMALY_RECIPIENT_WRAP_STATUS_IDS.AVAILABLE
  );

  if (!callerWrap) {
    throw new Error('anomaly_message_key_unavailable');
  }

  const contentKey = await eciesDecrypt(callerWrap.EncryptedContentKey, actorPrivateEncryptKeyHex);
  return aesDecrypt(message.EncryptedBody, contentKey);
}

export function hasElectionAnomalyDuplicateThreadValidation(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.includes(ELECTION_ANOMALY_VALIDATION_CODES.DUPLICATE_THREAD);
  }

  if (Array.isArray(value)) {
    return value.some((entry) => hasElectionAnomalyDuplicateThreadValidation(entry));
  }

  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .some((entry) => hasElectionAnomalyDuplicateThreadValidation(entry));
  }

  return false;
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
  REFRESH_PROTOCOL_PACKAGE_BINDING: 'refresh_protocol_package_binding',
  IMPORT_ROSTER: 'import_roster',
  CLAIM_ROSTER_ENTRY: 'claim_roster_entry',
  ACTIVATE_ROSTER_ENTRY: 'activate_roster_entry',
  REGISTER_VOTING_COMMITMENT: 'register_voting_commitment',
  REGISTER_PREPARED_BALLOT_COMMITMENT: 'register_prepared_ballot_commitment',
  SPOIL_PREPARED_BALLOT: 'spoil_prepared_ballot',
  ACCEPT_BALLOT_CAST: 'accept_ballot_cast',
  INVITE_TRUSTEE: 'invite_trustee',
  CREATE_REPORT_ACCESS_GRANT: 'create_report_access_grant',
  ACCEPT_TRUSTEE_INVITATION: 'accept_trustee_invitation',
  REJECT_TRUSTEE_INVITATION: 'reject_trustee_invitation',
  REVOKE_TRUSTEE_INVITATION: 'revoke_trustee_invitation',
  START_GOVERNED_PROPOSAL: 'start_governed_proposal',
  APPROVE_GOVERNED_PROPOSAL: 'approve_governed_proposal',
  RETRY_GOVERNED_PROPOSAL_EXECUTION: 'retry_governed_proposal_execution',
  OPEN_ELECTION: 'open_election',
  CLOSE_ELECTION: 'close_election',
  FINALIZE_ELECTION: 'finalize_election',
  SUBMIT_ANOMALY_THREAD: 'submit_anomaly_thread',
  SUBMIT_ANOMALY_INFORMATION: 'submit_anomaly_information',
  SUBMIT_FINALIZATION_SHARE: 'submit_finalization_share',
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

const ENCRYPTED_ELECTION_ENVELOPE_VERSIONS = {
  V2: 'election-envelope-v2',
  V21: 'election-envelope-v2.1',
} as const;

function buildElectionEnvelopeSurface<TActionPayload>(
  envelopeVersion: string,
  actionType: string,
  actionPayload: TActionPayload,
): {
  publicActionPayload: unknown;
  actionArtifacts?: unknown;
} {
  if (envelopeVersion !== ENCRYPTED_ELECTION_ENVELOPE_VERSIONS.V21) {
    return {
      publicActionPayload: actionPayload,
    };
  }

  switch (actionType) {
    case ENCRYPTED_ELECTION_ACTION_TYPES.CLAIM_ROSTER_ENTRY: {
      const publicActionPayload = {
        ...(actionPayload as ClaimElectionRosterEntryActionPayload),
      };
      delete (
        publicActionPayload as Partial<ClaimElectionRosterEntryActionPayload>
      ).VerificationCode;
      return {
        publicActionPayload,
      };
    }
    case ENCRYPTED_ELECTION_ACTION_TYPES.INVITE_TRUSTEE: {
      const { TrusteeEncryptedElectionPrivateKey, ...publicActionPayload } =
        actionPayload as InviteElectionTrusteeActionPayload;
      return {
        publicActionPayload,
        actionArtifacts: {
          TrusteeEncryptedElectionPrivateKey,
        } satisfies InviteElectionTrusteeActionArtifacts,
      };
    }
    default:
      return {
        publicActionPayload: actionPayload,
      };
  }
}

async function resolveElectionEnvelopePrivateKey(
  electionId: string | undefined,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string | undefined,
  options?: {
    allowBootstrapEnvelopeAccess?: boolean;
    forceFreshEnvelopeAccess?: boolean;
  }
): Promise<{ electionId: string; electionPrivateEncryptKeyHex: string; electionPublicEncryptKeyHex: string }> {
  const resolvedElectionId = electionId ?? generateGuid();

  let electionPrivateEncryptKeyHex: string;
  if (!electionId || options?.forceFreshEnvelopeAccess) {
    const generatedPrivateKey = secp256k1.utils.randomSecretKey();
    electionPrivateEncryptKeyHex = bytesToHex(generatedPrivateKey);
  } else {
    const accessResponse = await electionsService.getElectionEnvelopeAccess({
      ElectionId: electionId,
      ActorPublicAddress: actorPublicAddress,
    });

    if (accessResponse.Success && accessResponse.ActorEncryptedElectionPrivateKey) {
      if (!actorPrivateEncryptKeyHex) {
        throw new Error('Actor encryption private key is required to reuse the election envelope.');
      }

      electionPrivateEncryptKeyHex = await eciesDecrypt(
        accessResponse.ActorEncryptedElectionPrivateKey,
        actorPrivateEncryptKeyHex
      );
    } else if (options?.allowBootstrapEnvelopeAccess) {
      const generatedPrivateKey = secp256k1.utils.randomSecretKey();
      electionPrivateEncryptKeyHex = bytesToHex(generatedPrivateKey);
    } else {
      throw new Error(accessResponse.ErrorMessage || 'Election envelope access is not available for this actor.');
    }
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
  options?: {
    allowBootstrapEnvelopeAccess?: boolean;
    forceFreshEnvelopeAccess?: boolean;
  }
): Promise<{ signedTransaction: string; electionId: string }> {
  const envelopeContext = await blockchainService.getElectionEnvelopeContext();
  const envelopeKeys = await resolveElectionEnvelopePrivateKey(
    electionId,
    actorPublicAddress,
    actorPublicEncryptAddress,
    actorPrivateEncryptKeyHex,
    options
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
  const { publicActionPayload, actionArtifacts } = buildElectionEnvelopeSurface(
    envelopeContext.ElectionEnvelopeVersion,
    actionType,
    actionPayload,
  );

  const unsignedTx = createUnsignedTransaction<EncryptedElectionEnvelopePayload>(
    ENCRYPTED_ELECTION_ENVELOPE_PAYLOAD_KIND,
    {
      ElectionId: envelopeKeys.electionId,
      EnvelopeVersion: envelopeContext.ElectionEnvelopeVersion,
      NodeEncryptedElectionPrivateKey: '',
      ActorEncryptedElectionPrivateKey: actorEncryptedElectionPrivateKey,
      ElectionPublicEncryptKey: envelopeKeys.electionPublicEncryptKeyHex,
      EncryptedPayload: encryptedActionPayload,
      ActionType: actionType,
      ActionPayload: publicActionPayload,
      ActionArtifacts: actionArtifacts,
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

export async function createRefreshProtocolPackageBindingTransaction(
  electionId: string,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  const encryptedEnvelope = await createEncryptedElectionEnvelopeTransaction<RefreshProtocolPackageBindingActionPayload>(
    electionId,
    actorPublicAddress,
    actorPublicEncryptAddress,
    actorPrivateEncryptKeyHex,
    ENCRYPTED_ELECTION_ACTION_TYPES.REFRESH_PROTOCOL_PACKAGE_BINDING,
    {
      ActorPublicAddress: actorPublicAddress,
    },
    signingPrivateKeyHex,
  );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
  };
}

export async function createImportElectionRosterTransaction(
  electionId: string,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string,
  rosterEntries: ElectionRosterImportItemPayload[],
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  const encryptedEnvelope = await createEncryptedElectionEnvelopeTransaction<ImportElectionRosterActionPayload>(
    electionId,
    actorPublicAddress,
    actorPublicEncryptAddress,
    actorPrivateEncryptKeyHex,
    ENCRYPTED_ELECTION_ACTION_TYPES.IMPORT_ROSTER,
    {
      ActorPublicAddress: actorPublicAddress,
      RosterEntries: rosterEntries,
    },
    signingPrivateKeyHex,
  );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
  };
}

export async function createClaimElectionRosterEntryTransaction(
  electionId: string,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  organizationVoterId: string,
  verificationCode: string,
  signingPrivateKeyHex: string,
  actorPrivateEncryptKeyHex?: string,
): Promise<{ signedTransaction: string }> {
  const encryptedEnvelope = await createEncryptedElectionEnvelopeTransaction<ClaimElectionRosterEntryActionPayload>(
    electionId,
    actorPublicAddress,
    actorPublicEncryptAddress,
    actorPrivateEncryptKeyHex,
    ENCRYPTED_ELECTION_ACTION_TYPES.CLAIM_ROSTER_ENTRY,
    {
      ActorPublicAddress: actorPublicAddress,
      OrganizationVoterId: organizationVoterId,
      VerificationCode: verificationCode,
    },
    signingPrivateKeyHex,
    {
      forceFreshEnvelopeAccess: true,
    }
  );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
  };
}

export async function createActivateElectionRosterEntryTransaction(
  electionId: string,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string,
  organizationVoterId: string,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<ActivateElectionRosterEntryActionPayload>(
      electionId,
      actorPublicAddress,
      actorPublicEncryptAddress,
      actorPrivateEncryptKeyHex,
      ENCRYPTED_ELECTION_ACTION_TYPES.ACTIVATE_ROSTER_ENTRY,
      {
        ActorPublicAddress: actorPublicAddress,
        OrganizationVoterId: organizationVoterId,
      },
      signingPrivateKeyHex,
    );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
  };
}

export async function createRegisterElectionVotingCommitmentTransaction(
  electionId: string,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string,
  commitmentHash: string,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<RegisterElectionVotingCommitmentActionPayload>(
      electionId,
      actorPublicAddress,
      actorPublicEncryptAddress,
      actorPrivateEncryptKeyHex,
      ENCRYPTED_ELECTION_ACTION_TYPES.REGISTER_VOTING_COMMITMENT,
      {
        ActorPublicAddress: actorPublicAddress,
        CommitmentHash: commitmentHash,
      },
      signingPrivateKeyHex,
      {
        forceFreshEnvelopeAccess: true,
      }
    );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
  };
}

export async function createRegisterPreparedBallotCommitmentTransaction(
  electionId: string,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string,
  preparedBallotId: string,
  preparedBallotHash: string,
  ballotDefinitionVersion: number,
  ballotDefinitionHash: string,
  ceremonyProfileId: string,
  proofStatementId: string,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<RegisterPreparedBallotCommitmentActionPayload>(
      electionId,
      actorPublicAddress,
      actorPublicEncryptAddress,
      actorPrivateEncryptKeyHex,
      ENCRYPTED_ELECTION_ACTION_TYPES.REGISTER_PREPARED_BALLOT_COMMITMENT,
      {
        ActorPublicAddress: actorPublicAddress,
        PreparedBallotId: preparedBallotId,
        PreparedBallotHash: preparedBallotHash,
        BallotDefinitionVersion: ballotDefinitionVersion,
        BallotDefinitionHash: ballotDefinitionHash,
        CeremonyProfileId: ceremonyProfileId,
        ProofStatementId: proofStatementId,
      },
      signingPrivateKeyHex,
      {
        forceFreshEnvelopeAccess: true,
      }
    );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
  };
}

export async function createSpoilPreparedBallotTransaction(
  electionId: string,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string,
  preparedBallotId: string,
  preparedBallotHash: string,
  spoiledTranscriptHash: string,
  spoilRecordHash: string,
  localVerifierVersion: string,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<SpoilPreparedBallotActionPayload>(
      electionId,
      actorPublicAddress,
      actorPublicEncryptAddress,
      actorPrivateEncryptKeyHex,
      ENCRYPTED_ELECTION_ACTION_TYPES.SPOIL_PREPARED_BALLOT,
      {
        ActorPublicAddress: actorPublicAddress,
        PreparedBallotId: preparedBallotId,
        PreparedBallotHash: preparedBallotHash,
        SpoiledTranscriptHash: spoiledTranscriptHash,
        SpoilRecordHash: spoilRecordHash,
        LocalVerifierVersion: localVerifierVersion,
      },
      signingPrivateKeyHex,
      {
        forceFreshEnvelopeAccess: true,
      }
    );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
  };
}

export async function createAcceptElectionBallotCastTransaction(
  electionId: string,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string,
  idempotencyKey: string,
  encryptedBallotPackage: string,
  proofBundle: string,
  ballotNullifier: string,
  openArtifactId: string,
  eligibleSetHash: string,
  ceremonyVersionId: string,
  dkgProfileId: string,
  tallyPublicKeyFingerprint: string,
  signingPrivateKeyHex: string,
  sp04?: {
    preparedBallotId: string;
    preparedBallotHash: string;
    receiptCommitment: string;
    receiptCommitmentScheme: string;
    ballotDefinitionVersion: number;
    ballotDefinitionHash: string;
  },
): Promise<{ signedTransaction: string }> {
  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<AcceptElectionBallotCastActionPayload>(
      electionId,
      actorPublicAddress,
      actorPublicEncryptAddress,
      actorPrivateEncryptKeyHex,
      ENCRYPTED_ELECTION_ACTION_TYPES.ACCEPT_BALLOT_CAST,
      {
        ActorPublicAddress: actorPublicAddress,
        IdempotencyKey: idempotencyKey,
        EncryptedBallotPackage: encryptedBallotPackage,
        ProofBundle: proofBundle,
        BallotNullifier: ballotNullifier,
        OpenArtifactId: openArtifactId,
        EligibleSetHash: eligibleSetHash,
        CeremonyVersionId: ceremonyVersionId,
        DkgProfileId: dkgProfileId,
        TallyPublicKeyFingerprint: tallyPublicKeyFingerprint,
        PreparedBallotId: sp04?.preparedBallotId,
        PreparedBallotHash: sp04?.preparedBallotHash,
        ReceiptCommitment: sp04?.receiptCommitment,
        ReceiptCommitmentScheme: sp04?.receiptCommitmentScheme,
        BallotDefinitionVersion: sp04?.ballotDefinitionVersion,
        BallotDefinitionHash: sp04?.ballotDefinitionHash,
      },
      signingPrivateKeyHex,
      {
        forceFreshEnvelopeAccess: true,
      }
    );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
  };
}

export async function createSubmitElectionAnomalyThreadTransaction(
  input: CreateSubmitElectionAnomalyThreadTransactionInput,
): Promise<{ signedTransaction: string; anomalyThreadId: string }> {
  if (!isElectionAnomalyCategoryId(input.CategoryId)) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.CATEGORY_INVALID);
  }

  const anomalyThreadId = generateGuid();
  const initialMessage = await createElectionAnomalyMessageEnvelope({
    MessageKindId: ELECTION_ANOMALY_MESSAGE_KIND_IDS.INITIAL_SUBMISSION,
    Body: input.Body,
    ActorPublicAddress: input.ActorPublicAddress,
    ActorPublicEncryptAddress: input.ActorPublicEncryptAddress,
    OwnerPublicAddress: input.OwnerPublicAddress,
    MaxCharacters: ELECTION_ANOMALY_BODY_MAX_CHARACTERS,
  });
  const actionPayload: SubmitElectionAnomalyThreadActionPayload = {
    AnomalyThreadId: anomalyThreadId,
    ActionNonce: generateGuid(),
    ActorPublicAddress: input.ActorPublicAddress,
    CategoryId: input.CategoryId,
    InitialMessage: initialMessage,
    ActorRoleContextId: input.ActorRoleContextId ?? undefined,
  };
  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<SubmitElectionAnomalyThreadActionPayload>(
      input.ElectionId,
      input.ActorPublicAddress,
      input.ActorPublicEncryptAddress,
      input.ActorPrivateEncryptKeyHex,
      ENCRYPTED_ELECTION_ACTION_TYPES.SUBMIT_ANOMALY_THREAD,
      actionPayload,
      input.SigningPrivateKeyHex,
      {
        forceFreshEnvelopeAccess: true,
      },
    );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
    anomalyThreadId,
  };
}

export async function createSubmitElectionAnomalyInformationTransaction(
  input: CreateSubmitElectionAnomalyInformationTransactionInput,
): Promise<{ signedTransaction: string }> {
  if (!input.AnomalyThreadId.trim() || !input.ClarificationRequestId.trim()) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.CLARIFICATION_REQUEST_NOT_OPEN);
  }

  const responseMessage = await createElectionAnomalyMessageEnvelope({
    MessageKindId: ELECTION_ANOMALY_MESSAGE_KIND_IDS.SUBMITTER_INFORMATION_RESPONSE,
    Body: input.Body,
    ActorPublicAddress: input.ActorPublicAddress,
    ActorPublicEncryptAddress: input.ActorPublicEncryptAddress,
    OwnerPublicAddress: input.OwnerPublicAddress,
    MaxCharacters: ELECTION_ANOMALY_CLARIFICATION_BODY_MAX_CHARACTERS,
  });
  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<SubmitElectionAnomalyInformationActionPayload>(
      input.ElectionId,
      input.ActorPublicAddress,
      input.ActorPublicEncryptAddress,
      input.ActorPrivateEncryptKeyHex,
      ENCRYPTED_ELECTION_ACTION_TYPES.SUBMIT_ANOMALY_INFORMATION,
      {
        AnomalyThreadId: input.AnomalyThreadId,
        ClarificationRequestId: input.ClarificationRequestId,
        ActionNonce: generateGuid(),
        ActorPublicAddress: input.ActorPublicAddress,
        ResponseMessage: responseMessage,
      },
      input.SigningPrivateKeyHex,
      {
        forceFreshEnvelopeAccess: true,
      },
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

export async function createElectionReportAccessGrantTransaction(
  electionId: string,
  actorPublicAddress: string,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string,
  designatedAuditorPublicAddress: string,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<CreateElectionReportAccessGrantActionPayload>(
      electionId,
      actorPublicAddress,
      actorPublicEncryptAddress,
      actorPrivateEncryptKeyHex,
      ENCRYPTED_ELECTION_ACTION_TYPES.CREATE_REPORT_ACCESS_GRANT,
      {
        ActorPublicAddress: actorPublicAddress,
        DesignatedAuditorPublicAddress: designatedAuditorPublicAddress,
      },
      signingPrivateKeyHex,
    );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
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
      {
        forceFreshEnvelopeAccess: true,
      }
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
  shareVersion: string,
  closeCountingPublicCommitment: ECPoint | null | undefined,
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
        ShareVersion: shareVersion,
        CloseCountingPublicCommitment: closeCountingPublicCommitment ?? null,
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

export async function createSubmitElectionFinalizationShareTransaction(
  request: SubmitElectionFinalizationShareRequest,
  actorPublicEncryptAddress: string,
  actorPrivateEncryptKeyHex: string,
  signingPrivateKeyHex: string,
): Promise<{ signedTransaction: string }> {
  const claimedAcceptedBallotSetHash = normalizeOptionalBinaryClaim(
    request.ClaimedAcceptedBallotSetHash,
    'ClaimedAcceptedBallotSetHash',
  );
  const claimedFinalEncryptedTallyHash = normalizeOptionalBinaryClaim(
    request.ClaimedFinalEncryptedTallyHash,
    'ClaimedFinalEncryptedTallyHash',
  );
  const hasExecutorBinding =
    Boolean(request.CloseCountingJobId?.trim()) &&
    Boolean(request.ExecutorSessionPublicKey?.trim()) &&
    Boolean(request.ExecutorKeyAlgorithm?.trim());
  if (!hasExecutorBinding) {
    throw new Error(
      'Executor-encrypted trustee share submission requires CloseCountingJobId, ExecutorSessionPublicKey, and ExecutorKeyAlgorithm.',
    );
  }

  const encryptedExecutorSubmission = hasExecutorBinding
    ? await eciesEncrypt(
        JSON.stringify({
          CloseCountingJobId: request.CloseCountingJobId!.trim(),
          ElectionId: request.ElectionId,
          FinalizationSessionId: request.FinalizationSessionId,
          ActorPublicAddress: request.ActorPublicAddress,
          ShareIndex: request.ShareIndex,
          ShareVersion: request.ShareVersion,
          TargetType: request.TargetType,
          ClaimedCloseArtifactId: request.ClaimedCloseArtifactId,
          ClaimedAcceptedBallotSetHash: claimedAcceptedBallotSetHash,
          ClaimedFinalEncryptedTallyHash: claimedFinalEncryptedTallyHash,
          ClaimedTargetTallyId: request.ClaimedTargetTallyId,
          ClaimedCeremonyVersionId: request.ClaimedCeremonyVersionId ?? null,
          ClaimedTallyPublicKeyFingerprint: request.ClaimedTallyPublicKeyFingerprint ?? null,
          ShareMaterial: request.ShareMaterial,
        } satisfies CloseCountingExecutorSubmissionPayload),
        request.ExecutorSessionPublicKey!.trim(),
      )
    : null;
  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<SubmitElectionFinalizationShareActionPayload>(
      request.ElectionId,
      request.ActorPublicAddress,
      actorPublicEncryptAddress,
      actorPrivateEncryptKeyHex,
      ENCRYPTED_ELECTION_ACTION_TYPES.SUBMIT_FINALIZATION_SHARE,
      {
        FinalizationSessionId: request.FinalizationSessionId,
        ActorPublicAddress: request.ActorPublicAddress,
        ShareIndex: request.ShareIndex,
        ShareVersion: request.ShareVersion,
        TargetType: request.TargetType,
        ClaimedCloseArtifactId: request.ClaimedCloseArtifactId,
        ClaimedAcceptedBallotSetHash: claimedAcceptedBallotSetHash,
        ClaimedFinalEncryptedTallyHash: claimedFinalEncryptedTallyHash,
        ClaimedTargetTallyId: request.ClaimedTargetTallyId,
        ClaimedCeremonyVersionId: request.ClaimedCeremonyVersionId ?? null,
        ClaimedTallyPublicKeyFingerprint: request.ClaimedTallyPublicKeyFingerprint ?? null,
        ShareMaterial: encryptedExecutorSubmission ? null : request.ShareMaterial,
        CloseCountingJobId: request.CloseCountingJobId ?? null,
        ExecutorKeyAlgorithm: request.ExecutorKeyAlgorithm ?? null,
        EncryptedExecutorSubmission: encryptedExecutorSubmission,
      },
      signingPrivateKeyHex,
    );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
  };
}
