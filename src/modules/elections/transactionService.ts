import type {
  ECPoint,
  ElectionAnomalyAttachmentManifestView,
  ElectionAnomalyMessageView,
  ElectionAnomalyOwnerMessageView,
  ElectionAnomalyRestrictedMessageView,
  ElectionDraftInput,
  SubmitElectionFinalizationShareRequest,
} from '@/lib/grpc';
import * as secp256k1 from '@noble/secp256k1';
import {
  aesDecrypt,
  aesDecryptBytes,
  aesEncrypt,
  aesEncryptBytes,
  base64ToBytes,
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
export const ELECTION_ANOMALY_SUBMITTER_CLARIFICATION_EVIDENCE_MAX_COUNT = 2;
export const ELECTION_ANOMALY_SUBMITTER_CLARIFICATION_EVIDENCE_MAX_BYTES = 5 * 1024 * 1024;
export const ELECTION_ANOMALY_SUBMITTER_CLARIFICATION_EVIDENCE_MAX_TOTAL_BYTES =
  10 * 1024 * 1024;
export const ELECTION_ANOMALY_AUTHORITY_EVIDENCE_MAX_COUNT = 5;
export const ELECTION_ANOMALY_AUTHORITY_EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;
export const ELECTION_ANOMALY_AUTHORITY_EVIDENCE_MAX_TOTAL_BYTES = 25 * 1024 * 1024;
export const ELECTION_ANOMALY_WRAP_ALGORITHM = 'x25519-aes-gcm';
export const ELECTION_ANOMALY_RESTRICTED_PAYLOAD_REFERENCE_PREFIX =
  'hush-election-anomaly-payload-v1:';

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
  DESIGNATED_AUDITOR: 'designated_auditor',
} as const;

export const ELECTION_ANOMALY_RECIPIENT_WRAP_STATUS_IDS = {
  AVAILABLE: 'available',
  MISSING: 'missing',
  PENDING_BACKFILL: 'pending_backfill',
  NOT_APPLICABLE: 'not_applicable',
} as const;

export const ELECTION_ANOMALY_SEVERITY_CANDIDATE_IDS = {
  NOT_ASSESSED: 'not_assessed',
  LOW_OPERATIONAL_IMPACT: 'low_operational_impact',
  REQUIRES_AUTHORITY_REVIEW: 'requires_authority_review',
  POTENTIALLY_ELECTION_BLOCKING: 'potentially_election_blocking',
  SECURITY_INTEGRITY_CRITICAL: 'security_integrity_critical',
} as const;

export const ELECTION_ANOMALY_SEVERITY_CANDIDATE_ID_VALUES =
  Object.values(ELECTION_ANOMALY_SEVERITY_CANDIDATE_IDS);

export type ElectionAnomalySeverityCandidateId =
  typeof ELECTION_ANOMALY_SEVERITY_CANDIDATE_ID_VALUES[number];

export const ELECTION_ANOMALY_CASE_STATE_IDS = {
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  AUTHORITY_REQUESTED_INFORMATION: 'authority_requested_information',
  SUBMITTER_INFORMATION_PROVIDED: 'submitter_information_provided',
  OWNER_RESPONDED: 'owner_responded',
  ESCALATED_TO_GOVERNED_DECISION: 'escalated_to_governed_decision',
  RESOLVED_NON_BLOCKING: 'resolved_non_blocking',
  CLOSED_DUPLICATE_FOLLOWUP: 'closed_duplicate_followup',
  CLOSED_NO_FURTHER_SUBMITTER_INPUT: 'closed_no_further_submitter_input',
} as const;

export const ELECTION_ANOMALY_ACTOR_ROLE_CONTEXT_IDS = {
  VOTER: 'voter',
  TRUSTEE: 'trustee',
  DESIGNATED_AUDITOR: 'designated_auditor',
  ELECTION_OWNER: 'election_owner',
  AUTHORITY_OPERATOR: 'authority_operator',
  EXTERNAL_CLAIMANT_REGISTRAR: 'external_claimant_registrar',
} as const;

export const ELECTION_ANOMALY_VALIDATION_CODES = {
  DUPLICATE_THREAD: 'anomaly_duplicate_thread',
  BODY_REQUIRED: 'anomaly_body_required',
  BODY_TOO_LONG: 'anomaly_body_too_long',
  CATEGORY_INVALID: 'anomaly_category_invalid',
  FOLLOWUP_NOT_REQUESTED: 'anomaly_followup_not_requested',
  CLARIFICATION_REQUEST_NOT_OPEN: 'anomaly_clarification_request_not_open',
  RECIPIENT_WRAP_MISSING: 'anomaly_recipient_wrap_missing',
  SEVERITY_CANDIDATE_INVALID: 'anomaly_severity_candidate_invalid',
  ATTACHMENT_KIND_INVALID: 'anomaly_attachment_kind_invalid',
  ATTACHMENT_MIME_TYPE_INVALID: 'anomaly_attachment_mime_type_invalid',
  ATTACHMENT_SIZE_EXCEEDED: 'anomaly_attachment_size_exceeded',
  ATTACHMENT_COUNT_EXCEEDED: 'anomaly_attachment_count_exceeded',
  ATTACHMENT_HASH_INVALID: 'anomaly_attachment_hash_invalid',
  ATTACHMENT_PAYLOAD_REFERENCE_INVALID: 'anomaly_attachment_payload_reference_invalid',
  ATTACHMENT_REQUEST_MISMATCH: 'anomaly_attachment_request_mismatch',
  ATTACHMENT_SUBMITTER_NOT_ALLOWED: 'anomaly_attachment_submitter_not_allowed',
  ATTACHMENT_OPERATIONAL_EVIDENCE_DISABLED:
    'anomaly_attachment_operational_evidence_disabled',
  ATTACHMENT_SCANNER_STATUS_INVALID: 'anomaly_attachment_scanner_status_invalid',
  REDACTION_REASON_INVALID: 'anomaly_redaction_reason_invalid',
  REDACTION_TARGET_INVALID: 'anomaly_redaction_target_invalid',
  REDACTION_ORIGINAL_HASH_INVALID: 'anomaly_redaction_original_hash_invalid',
} as const;

export const ELECTION_ANOMALY_ATTACHMENT_KIND_IDS = {
  SUBMITTER_EVIDENCE: 'submitter_evidence',
  AUTHORITY_REQUESTED_EVIDENCE: 'authority_requested_evidence',
  AUTHORITY_EVIDENCE: 'authority_evidence',
  RESTRICTED_OPERATIONAL_EVIDENCE: 'restricted_operational_evidence',
} as const;

export const ELECTION_ANOMALY_ATTACHMENT_KIND_ID_VALUES =
  Object.values(ELECTION_ANOMALY_ATTACHMENT_KIND_IDS);

export type ElectionAnomalyAttachmentKindId =
  typeof ELECTION_ANOMALY_ATTACHMENT_KIND_ID_VALUES[number];

export const ELECTION_ANOMALY_ATTACHMENT_VALIDATION_STATUS_IDS = {
  MANIFEST_ONLY: 'manifest_only',
  PENDING_SCAN: 'pending_scan',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
} as const;

export const ELECTION_ANOMALY_ATTACHMENT_VALIDATION_STATUS_ID_VALUES =
  Object.values(ELECTION_ANOMALY_ATTACHMENT_VALIDATION_STATUS_IDS);

export type ElectionAnomalyAttachmentValidationStatusId =
  typeof ELECTION_ANOMALY_ATTACHMENT_VALIDATION_STATUS_ID_VALUES[number];

export const ELECTION_ANOMALY_EVIDENCE_MIME_TYPES = {
  APPLICATION_PDF: 'application/pdf',
  IMAGE_PNG: 'image/png',
  IMAGE_JPEG: 'image/jpeg',
  TEXT_PLAIN: 'text/plain',
  TEXT_CSV: 'text/csv',
  APPLICATION_JSON: 'application/json',
} as const;

export const ELECTION_ANOMALY_EVIDENCE_MIME_TYPE_VALUES =
  Object.values(ELECTION_ANOMALY_EVIDENCE_MIME_TYPES);

export type ElectionAnomalyEvidenceMimeType =
  typeof ELECTION_ANOMALY_EVIDENCE_MIME_TYPE_VALUES[number];

export const ELECTION_ANOMALY_REDACTION_REASON_IDS = {
  PERSONAL_DATA: 'personal_data',
  LEGAL_HOLD: 'legal_hold',
  MALWARE_OR_QUARANTINE: 'malware_or_quarantine',
  OPERATIONAL_SAFETY: 'operational_safety',
  DUPLICATE_OR_IRRELEVANT: 'duplicate_or_irrelevant',
  OTHER: 'other',
} as const;

export const ELECTION_ANOMALY_REDACTION_REASON_ID_VALUES =
  Object.values(ELECTION_ANOMALY_REDACTION_REASON_IDS);

export type ElectionAnomalyRedactionReasonId =
  typeof ELECTION_ANOMALY_REDACTION_REASON_ID_VALUES[number];

export const ELECTION_ANOMALY_REDACTION_TARGET_KIND_IDS = {
  ATTACHMENT_MANIFEST: 'attachment_manifest',
} as const;

export const ELECTION_ANOMALY_REDACTION_TARGET_KIND_ID_VALUES =
  Object.values(ELECTION_ANOMALY_REDACTION_TARGET_KIND_IDS);

export type ElectionAnomalyRedactionTargetKindId =
  typeof ELECTION_ANOMALY_REDACTION_TARGET_KIND_ID_VALUES[number];

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

export interface ElectionAnomalyAttachmentContentKeyWrapPayload {
  RecipientRoleId: string;
  RecipientPublicAddress: string;
  RecipientKeyFingerprint: string;
  EncryptedContentKey: string;
  WrapAlgorithm: string;
  WrapStatusId: string;
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

export interface RequestElectionAnomalyInformationActionPayload {
  AnomalyThreadId: string;
  ClarificationRequestId: string;
  ActionNonce: string;
  ActorPublicAddress: string;
  RequestMessage: ElectionAnomalyMessageEnvelopePayload;
  MaxResponseCharacters: number;
}

export interface RecordElectionAnomalyAuthorityResponseActionPayload {
  AnomalyThreadId: string;
  ActionNonce: string;
  ActorPublicAddress: string;
  AuthorityResponseMessage: ElectionAnomalyMessageEnvelopePayload;
}

export interface ClassifyElectionAnomalyThreadActionPayload {
  AnomalyThreadId: string;
  ActionNonce: string;
  ActorPublicAddress: string;
  CategoryId?: string | null;
  CaseStateId?: string | null;
  SeverityCandidateId?: string | null;
  GovernedDecisionRef?: string | null;
}

export interface RegisterExternalElectionAnomalyClaimantActionPayload {
  AnomalyThreadId: string;
  ActionNonce: string;
  ActorPublicAddress: string;
  ExternalClaimantReferenceHash: string;
  CategoryId: string;
  InitialMessage: ElectionAnomalyMessageEnvelopePayload;
  RegistrarRoleContextId?: string | null;
}

export interface RecordElectionAnomalyAttachmentManifestActionPayload {
  AnomalyThreadId: string;
  AttachmentManifestId: string;
  ActionNonce: string;
  ActorPublicAddress: string;
  AttachmentKindId: string;
  EncryptedPayloadReference: string;
  EncryptedPayloadHash: string;
  ContentHash: string;
  SizeBytes: number;
  MimeType: string;
  ValidationStatusId: string;
  ClarificationRequestId?: string | null;
  ContentKeyWraps?: ElectionAnomalyAttachmentContentKeyWrapPayload[];
}

export interface RecordElectionAnomalyEvidenceRedactionActionPayload {
  AnomalyThreadId: string;
  RedactionEventId: string;
  ActionNonce: string;
  ActorPublicAddress: string;
  TargetKindId: string;
  TargetId: string;
  ReasonCodeId: string;
  OriginalHash: string;
  ReplacementManifestHash?: string | null;
  TombstoneStatusId?: string | null;
  HoldReference?: string | null;
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

export type ElectionAnomalyAuthorityAuditorRecipientInput = {
  AuditorPublicAddress: string;
  AuditorPublicEncryptAddress: string;
};

export interface CreateElectionAnomalyAuthorityMessageEnvelopeInput {
  MessageKindId: string;
  Body: string;
  OwnerPublicAddress: string;
  OwnerPublicEncryptAddress: string;
  OriginalSubmitterPublicAddress: string;
  OriginalSubmitterPublicEncryptAddress?: string | null;
  AuditorRecipients?: ElectionAnomalyAuthorityAuditorRecipientInput[];
  MaxCharacters?: number;
}

export interface CreateRequestElectionAnomalyInformationTransactionInput {
  ElectionId: string;
  AnomalyThreadId: string;
  ActorPublicAddress: string;
  ActorPublicEncryptAddress: string;
  ActorPrivateEncryptKeyHex: string;
  OriginalSubmitterPublicAddress: string;
  OriginalSubmitterPublicEncryptAddress?: string | null;
  Body: string;
  SigningPrivateKeyHex: string;
  AuditorRecipients?: ElectionAnomalyAuthorityAuditorRecipientInput[];
}

export interface CreateRecordElectionAnomalyAuthorityResponseTransactionInput {
  ElectionId: string;
  AnomalyThreadId: string;
  ActorPublicAddress: string;
  ActorPublicEncryptAddress: string;
  ActorPrivateEncryptKeyHex: string;
  OriginalSubmitterPublicAddress: string;
  OriginalSubmitterPublicEncryptAddress?: string | null;
  Body: string;
  SigningPrivateKeyHex: string;
  AuditorRecipients?: ElectionAnomalyAuthorityAuditorRecipientInput[];
}

export interface CreateClassifyElectionAnomalyThreadTransactionInput {
  ElectionId: string;
  AnomalyThreadId: string;
  ActorPublicAddress: string;
  ActorPublicEncryptAddress: string;
  ActorPrivateEncryptKeyHex: string;
  SigningPrivateKeyHex: string;
  CategoryId?: string | null;
  CaseStateId?: string | null;
  SeverityCandidateId?: string | null;
  GovernedDecisionRef?: string | null;
}

export interface CreateRegisterExternalElectionAnomalyClaimantTransactionInput {
  ElectionId: string;
  ActorPublicAddress: string;
  ActorPublicEncryptAddress: string;
  ActorPrivateEncryptKeyHex: string;
  ExternalClaimantReference: string;
  CategoryId: string;
  Body: string;
  SigningPrivateKeyHex: string;
  AuditorRecipients?: ElectionAnomalyAuthorityAuditorRecipientInput[];
}

export type ElectionAnomalyEvidenceBinary = string | ArrayBuffer | ArrayBufferView | Blob;

export interface PrepareElectionAnomalyAttachmentManifestMaterialInput {
  Content: ElectionAnomalyEvidenceBinary;
  EncryptedPayload: ElectionAnomalyEvidenceBinary;
  EncryptedPayloadReference?: string;
}

export interface PreparedElectionAnomalyAttachmentManifestMaterial {
  EncryptedPayloadReference: string;
  EncryptedPayloadHash: string;
  ContentHash: string;
  SizeBytes: number;
}

export interface CreatedElectionAnomalyRestrictedEvidencePayload {
  EncryptedPayload: Uint8Array;
  ContentKey: string;
}

export interface DecryptElectionAnomalyAttachmentPayloadInput {
  Attachment: ElectionAnomalyAttachmentManifestView;
  ActorPrivateEncryptKeyHex: string;
  EncryptedPayloadBase64: string;
  EncryptedPayloadHash: string;
  ContentHash: string;
}

export interface CreateElectionAnomalyAttachmentContentKeyWrapInput {
  RecipientRoleId: string;
  RecipientPublicAddress: string;
  RecipientPublicEncryptAddress: string;
  ContentKey: string;
}

export interface CreateElectionAnomalySubmitterAttachmentContentKeyWrapsInput {
  ActorPublicAddress: string;
  ActorPublicEncryptAddress: string;
  OwnerPublicAddress: string;
  ContentKey: string;
}

export interface CreateElectionAnomalyOwnerAttachmentContentKeyWrapsInput {
  OwnerPublicAddress: string;
  OwnerPublicEncryptAddress: string;
  AuditorRecipients?: ElectionAnomalyAuthorityAuditorRecipientInput[];
  ContentKey: string;
}

export interface CreateRecordElectionAnomalyAttachmentManifestTransactionInput {
  ElectionId: string;
  AnomalyThreadId: string;
  ActorPublicAddress: string;
  ActorPublicEncryptAddress: string;
  ActorPrivateEncryptKeyHex: string;
  SigningPrivateKeyHex: string;
  AttachmentKindId: string;
  EncryptedPayloadReference: string;
  EncryptedPayloadHash: string;
  ContentHash: string;
  SizeBytes: number;
  MimeType: string;
  ValidationStatusId?: string;
  AttachmentManifestId?: string;
  ClarificationRequestId?: string | null;
  ExistingAttachmentManifestCount?: number;
  ExistingAttachmentManifestTotalBytes?: number;
  ContentKeyWraps?: ElectionAnomalyAttachmentContentKeyWrapPayload[];
}

export interface CreateRecordElectionAnomalyEvidenceRedactionTransactionInput {
  ElectionId: string;
  AnomalyThreadId: string;
  ActorPublicAddress: string;
  ActorPublicEncryptAddress: string;
  ActorPrivateEncryptKeyHex: string;
  SigningPrivateKeyHex: string;
  TargetKindId: string;
  TargetId: string;
  ReasonCodeId: string;
  OriginalHash: string;
  RedactionEventId?: string;
  ReplacementManifestHash?: string | null;
  TombstoneStatusId?: string | null;
  HoldReference?: string | null;
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

export interface RecordElectionAnomalyAuditorRecipientRewrapActionPayload {
  AnomalyThreadId: string;
  MessageId: string;
  ActionNonce: string;
  ActorPublicAddress: string;
  AuditorPublicAddress: string;
  RecipientKeyFingerprint: string;
  EncryptedContentKey: string;
  WrapAlgorithm: string;
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

export interface CreateRecordElectionAnomalyAuditorRecipientRewrapTransactionInput {
  ElectionId: string;
  AnomalyThreadId: string;
  MessageId: string;
  ActorPublicAddress: string;
  ActorPublicEncryptAddress: string;
  ActorPrivateEncryptKeyHex: string;
  AuditorPublicAddress: string;
  AuditorPublicEncryptAddress: string;
  ContentKey: string;
  SigningPrivateKeyHex: string;
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

async function toEvidenceBytes(value: ElectionAnomalyEvidenceBinary): Promise<Uint8Array> {
  if (typeof value === 'string') {
    return new TextEncoder().encode(value);
  }

  if (value instanceof Uint8Array) {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }

  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    return new Uint8Array(await value.arrayBuffer());
  }

  throw new Error('Unsupported anomaly evidence bytes.');
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

export function isElectionAnomalyAttachmentKindId(
  value: string,
): value is ElectionAnomalyAttachmentKindId {
  return ELECTION_ANOMALY_ATTACHMENT_KIND_ID_VALUES
    .includes(value as ElectionAnomalyAttachmentKindId);
}

export function isElectionAnomalyAttachmentValidationStatusId(
  value: string,
): value is ElectionAnomalyAttachmentValidationStatusId {
  return ELECTION_ANOMALY_ATTACHMENT_VALIDATION_STATUS_ID_VALUES
    .includes(value as ElectionAnomalyAttachmentValidationStatusId);
}

export function isElectionAnomalyEvidenceMimeType(
  value: string,
): value is ElectionAnomalyEvidenceMimeType {
  return ELECTION_ANOMALY_EVIDENCE_MIME_TYPE_VALUES
    .includes(value.toLowerCase() as ElectionAnomalyEvidenceMimeType);
}

export function isElectionAnomalyRedactionReasonId(
  value: string,
): value is ElectionAnomalyRedactionReasonId {
  return ELECTION_ANOMALY_REDACTION_REASON_ID_VALUES
    .includes(value as ElectionAnomalyRedactionReasonId);
}

export function isElectionAnomalyRedactionTargetKindId(
  value: string,
): value is ElectionAnomalyRedactionTargetKindId {
  return ELECTION_ANOMALY_REDACTION_TARGET_KIND_ID_VALUES
    .includes(value as ElectionAnomalyRedactionTargetKindId);
}

export function isElectionAnomalySeverityCandidateId(
  value: string,
): value is ElectionAnomalySeverityCandidateId {
  return ELECTION_ANOMALY_SEVERITY_CANDIDATE_ID_VALUES
    .includes(value as ElectionAnomalySeverityCandidateId);
}

export function isElectionAnomalySha256Reference(value: string): boolean {
  return /^sha256:[a-f0-9]{64}$/.test(value);
}

export function isElectionAnomalyRestrictedPayloadReference(value: string): boolean {
  const suffix = value.startsWith(ELECTION_ANOMALY_RESTRICTED_PAYLOAD_REFERENCE_PREFIX)
    ? value.slice(ELECTION_ANOMALY_RESTRICTED_PAYLOAD_REFERENCE_PREFIX.length)
    : '';

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    .test(suffix);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return `sha256:${bytesToHex(new Uint8Array(digest))}`;
}

export async function computeElectionAnomalyEvidenceHash(
  value: ElectionAnomalyEvidenceBinary,
): Promise<string> {
  const bytes = await toEvidenceBytes(value);
  const digestInput = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest('SHA-256', digestInput);
  return `sha256:${bytesToHex(new Uint8Array(digest))}`;
}

export function createElectionAnomalyRestrictedPayloadReference(payloadId = generateGuid()): string {
  return `${ELECTION_ANOMALY_RESTRICTED_PAYLOAD_REFERENCE_PREFIX}${payloadId}`;
}

export async function prepareElectionAnomalyAttachmentManifestMaterial(
  input: PrepareElectionAnomalyAttachmentManifestMaterialInput,
): Promise<PreparedElectionAnomalyAttachmentManifestMaterial> {
  const contentBytes = await toEvidenceBytes(input.Content);
  const encryptedPayloadReference =
    input.EncryptedPayloadReference?.trim() ||
    createElectionAnomalyRestrictedPayloadReference();

  if (!isElectionAnomalyRestrictedPayloadReference(encryptedPayloadReference)) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_PAYLOAD_REFERENCE_INVALID);
  }

  return {
    EncryptedPayloadReference: encryptedPayloadReference,
    EncryptedPayloadHash: await computeElectionAnomalyEvidenceHash(input.EncryptedPayload),
    ContentHash: await computeElectionAnomalyEvidenceHash(contentBytes),
    SizeBytes: contentBytes.byteLength,
  };
}

export async function createElectionAnomalyRestrictedEvidencePayload(
  content: ElectionAnomalyEvidenceBinary,
): Promise<CreatedElectionAnomalyRestrictedEvidencePayload> {
  const contentBytes = await toEvidenceBytes(content);
  const contentKey = generateAesKey();
  return {
    EncryptedPayload: await aesEncryptBytes(contentBytes, contentKey),
    ContentKey: contentKey,
  };
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

export async function createElectionAnomalyAttachmentContentKeyWrap(
  input: CreateElectionAnomalyAttachmentContentKeyWrapInput,
): Promise<ElectionAnomalyAttachmentContentKeyWrapPayload> {
  if (
    !input.RecipientRoleId.trim() ||
    !input.RecipientPublicAddress.trim() ||
    !input.RecipientPublicEncryptAddress.trim() ||
    !input.ContentKey.trim()
  ) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.RECIPIENT_WRAP_MISSING);
  }

  return {
    RecipientRoleId: input.RecipientRoleId,
    RecipientPublicAddress: input.RecipientPublicAddress,
    RecipientKeyFingerprint: await sha256Hex(input.RecipientPublicEncryptAddress),
    EncryptedContentKey: await eciesEncrypt(input.ContentKey, input.RecipientPublicEncryptAddress),
    WrapAlgorithm: ELECTION_ANOMALY_WRAP_ALGORITHM,
    WrapStatusId: ELECTION_ANOMALY_RECIPIENT_WRAP_STATUS_IDS.AVAILABLE,
  };
}

export async function createElectionAnomalySubmitterAttachmentContentKeyWraps(
  input: CreateElectionAnomalySubmitterAttachmentContentKeyWrapsInput,
): Promise<ElectionAnomalyAttachmentContentKeyWrapPayload[]> {
  const ownerPublicEncryptAddress = await resolveAnomalyOwnerEncryptAddress(
    input.OwnerPublicAddress,
    input.ActorPublicAddress,
    input.ActorPublicEncryptAddress,
  );

  return Promise.all([
    createElectionAnomalyAttachmentContentKeyWrap({
      RecipientRoleId: ELECTION_ANOMALY_RECIPIENT_ROLE_IDS.SUBMITTER,
      RecipientPublicAddress: input.ActorPublicAddress,
      RecipientPublicEncryptAddress: input.ActorPublicEncryptAddress,
      ContentKey: input.ContentKey,
    }),
    createElectionAnomalyAttachmentContentKeyWrap({
      RecipientRoleId: ELECTION_ANOMALY_RECIPIENT_ROLE_IDS.ELECTION_OWNER,
      RecipientPublicAddress: input.OwnerPublicAddress,
      RecipientPublicEncryptAddress: ownerPublicEncryptAddress,
      ContentKey: input.ContentKey,
    }),
  ]);
}

export async function createElectionAnomalyOwnerAttachmentContentKeyWraps(
  input: CreateElectionAnomalyOwnerAttachmentContentKeyWrapsInput,
): Promise<ElectionAnomalyAttachmentContentKeyWrapPayload[]> {
  const auditorRecipients = input.AuditorRecipients ?? [];
  return Promise.all([
    createElectionAnomalyAttachmentContentKeyWrap({
      RecipientRoleId: ELECTION_ANOMALY_RECIPIENT_ROLE_IDS.ELECTION_OWNER,
      RecipientPublicAddress: input.OwnerPublicAddress,
      RecipientPublicEncryptAddress: input.OwnerPublicEncryptAddress,
      ContentKey: input.ContentKey,
    }),
    ...auditorRecipients.map((auditor) =>
      createElectionAnomalyAttachmentContentKeyWrap({
        RecipientRoleId: ELECTION_ANOMALY_RECIPIENT_ROLE_IDS.DESIGNATED_AUDITOR,
        RecipientPublicAddress: auditor.AuditorPublicAddress,
        RecipientPublicEncryptAddress: auditor.AuditorPublicEncryptAddress,
        ContentKey: input.ContentKey,
      })
    ),
  ]);
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

async function resolveIdentityEncryptAddress(
  publicAddress: string,
  roleLabel: string,
): Promise<string> {
  const identity = await identityService.getIdentity(publicAddress);
  if (!identity.Successfull || !identity.PublicEncryptAddress) {
    throw new Error(`${roleLabel} encryption key was not found for ${publicAddress}.`);
  }

  return identity.PublicEncryptAddress;
}

export async function createElectionAnomalyAuthorityMessageEnvelope(
  input: CreateElectionAnomalyAuthorityMessageEnvelopeInput,
): Promise<ElectionAnomalyMessageEnvelopePayload> {
  const body = normalizeAnomalyBody(
    input.Body,
    input.MaxCharacters ?? ELECTION_ANOMALY_CLARIFICATION_BODY_MAX_CHARACTERS,
  );
  const submitterPublicEncryptAddress = input.OriginalSubmitterPublicEncryptAddress?.trim()
    || (input.OriginalSubmitterPublicAddress === input.OwnerPublicAddress
      ? input.OwnerPublicEncryptAddress
      : await resolveIdentityEncryptAddress(
        input.OriginalSubmitterPublicAddress,
        'Anomaly submitter',
      ));
  const contentKey = generateAesKey();
  const encryptedBody = await aesEncrypt(body, contentKey);
  const auditorRecipients = input.AuditorRecipients ?? [];

  return {
    MessageId: generateGuid(),
    MessageKindId: input.MessageKindId,
    EncryptedBody: encryptedBody,
    EncryptedBodyHash: await sha256Hex(encryptedBody),
    PlaintextCharacterCount: countUnicodeCharacters(body),
    RecipientWraps: [
      await createAnomalyRecipientWrap(
        ELECTION_ANOMALY_RECIPIENT_ROLE_IDS.SUBMITTER,
        input.OriginalSubmitterPublicAddress,
        submitterPublicEncryptAddress,
        contentKey,
      ),
      await createAnomalyRecipientWrap(
        ELECTION_ANOMALY_RECIPIENT_ROLE_IDS.ELECTION_OWNER,
        input.OwnerPublicAddress,
        input.OwnerPublicEncryptAddress,
        contentKey,
      ),
      ...(await Promise.all(auditorRecipients.map((auditor) =>
        createAnomalyRecipientWrap(
          ELECTION_ANOMALY_RECIPIENT_ROLE_IDS.DESIGNATED_AUDITOR,
          auditor.AuditorPublicAddress,
          auditor.AuditorPublicEncryptAddress,
          contentKey,
        )
      ))),
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

export async function decryptElectionAnomalyOwnerMessageBody(
  message: ElectionAnomalyOwnerMessageView,
  actorPrivateEncryptKeyHex: string,
): Promise<string> {
  const contentKey = await decryptElectionAnomalyOwnerMessageContentKey(
    message,
    actorPrivateEncryptKeyHex,
  );
  return aesDecrypt(message.EncryptedBody, contentKey);
}

export async function decryptElectionAnomalyOwnerMessageContentKey(
  message: ElectionAnomalyOwnerMessageView,
  actorPrivateEncryptKeyHex: string,
): Promise<string> {
  const callerWrap = message.CallerOwnerWrap;
  if (
    !message.HasCallerOwnerWrap ||
    !callerWrap ||
    callerWrap.WrapStatusId !== ELECTION_ANOMALY_RECIPIENT_WRAP_STATUS_IDS.AVAILABLE ||
    !callerWrap.EncryptedContentKey?.trim()
  ) {
    throw new Error('anomaly_message_key_unavailable');
  }

  return eciesDecrypt(callerWrap.EncryptedContentKey, actorPrivateEncryptKeyHex);
}

export async function decryptElectionAnomalyRestrictedMessageBody(
  message: ElectionAnomalyRestrictedMessageView,
  actorPrivateEncryptKeyHex: string,
): Promise<string> {
  const callerWrap = message.CallerAuditorWrap;
  if (
    !message.HasCallerAuditorWrap ||
    !callerWrap ||
    callerWrap.WrapStatusId !== ELECTION_ANOMALY_RECIPIENT_WRAP_STATUS_IDS.AVAILABLE ||
    !callerWrap.EncryptedContentKey?.trim()
  ) {
    throw new Error('anomaly_message_key_unavailable');
  }

  const contentKey = await eciesDecrypt(callerWrap.EncryptedContentKey, actorPrivateEncryptKeyHex);
  return aesDecrypt(message.EncryptedBody, contentKey);
}

export async function decryptElectionAnomalyAttachmentPayload(
  input: DecryptElectionAnomalyAttachmentPayloadInput,
): Promise<Uint8Array> {
  const callerWrap = input.Attachment.CallerContentKeyWrap;
  if (
    !input.Attachment.HasCallerContentKeyWrap ||
    !callerWrap ||
    callerWrap.WrapStatusId !== ELECTION_ANOMALY_RECIPIENT_WRAP_STATUS_IDS.AVAILABLE ||
    !callerWrap.EncryptedContentKey?.trim()
  ) {
    throw new Error('anomaly_attachment_key_unavailable');
  }

  if (
    input.EncryptedPayloadHash !== input.Attachment.EncryptedPayloadHash ||
    input.ContentHash !== input.Attachment.ContentHash
  ) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_HASH_INVALID);
  }

  const encryptedPayload = base64ToBytes(input.EncryptedPayloadBase64);
  const encryptedPayloadHash = await computeElectionAnomalyEvidenceHash(encryptedPayload);
  if (encryptedPayloadHash !== input.Attachment.EncryptedPayloadHash) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_HASH_INVALID);
  }

  const contentKey = await eciesDecrypt(
    callerWrap.EncryptedContentKey,
    input.ActorPrivateEncryptKeyHex,
  );
  const decryptedPayload = await aesDecryptBytes(encryptedPayload, contentKey);
  const contentHash = await computeElectionAnomalyEvidenceHash(decryptedPayload);
  if (contentHash !== input.Attachment.ContentHash) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_HASH_INVALID);
  }

  return decryptedPayload;
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

export async function hashExternalElectionAnomalyClaimantReference(
  electionId: string,
  reference: string,
): Promise<string> {
  const normalizedReference = reference.trim();
  if (!normalizedReference) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.BODY_REQUIRED);
  }

  return sha256Hex(JSON.stringify({
    version: 'external-claimant-reference-v1',
    electionId,
    reference: normalizedReference,
  }));
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
  REQUEST_ANOMALY_INFORMATION: 'request_anomaly_information',
  SUBMIT_ANOMALY_INFORMATION: 'submit_anomaly_information',
  RECORD_ANOMALY_AUTHORITY_RESPONSE: 'record_anomaly_authority_response',
  CLASSIFY_ANOMALY_THREAD: 'classify_anomaly_thread',
  REGISTER_EXTERNAL_ANOMALY_CLAIMANT: 'register_external_anomaly_claimant',
  RECORD_ANOMALY_ATTACHMENT_MANIFEST: 'record_anomaly_attachment_manifest',
  RECORD_ANOMALY_EVIDENCE_REDACTION: 'record_anomaly_evidence_redaction',
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
  RECORD_ANOMALY_AUDITOR_RECIPIENT_REWRAP: 'record_anomaly_auditor_recipient_rewrap',
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

export async function createRequestElectionAnomalyInformationTransaction(
  input: CreateRequestElectionAnomalyInformationTransactionInput,
): Promise<{ signedTransaction: string; clarificationRequestId: string }> {
  if (!input.AnomalyThreadId.trim()) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.CLARIFICATION_REQUEST_NOT_OPEN);
  }

  const clarificationRequestId = generateGuid();
  const requestMessage = await createElectionAnomalyAuthorityMessageEnvelope({
    MessageKindId: ELECTION_ANOMALY_MESSAGE_KIND_IDS.AUTHORITY_INFORMATION_REQUEST,
    Body: input.Body,
    OwnerPublicAddress: input.ActorPublicAddress,
    OwnerPublicEncryptAddress: input.ActorPublicEncryptAddress,
    OriginalSubmitterPublicAddress: input.OriginalSubmitterPublicAddress,
    OriginalSubmitterPublicEncryptAddress: input.OriginalSubmitterPublicEncryptAddress,
    AuditorRecipients: input.AuditorRecipients,
    MaxCharacters: ELECTION_ANOMALY_CLARIFICATION_BODY_MAX_CHARACTERS,
  });
  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<RequestElectionAnomalyInformationActionPayload>(
      input.ElectionId,
      input.ActorPublicAddress,
      input.ActorPublicEncryptAddress,
      input.ActorPrivateEncryptKeyHex,
      ENCRYPTED_ELECTION_ACTION_TYPES.REQUEST_ANOMALY_INFORMATION,
      {
        AnomalyThreadId: input.AnomalyThreadId,
        ClarificationRequestId: clarificationRequestId,
        ActionNonce: generateGuid(),
        ActorPublicAddress: input.ActorPublicAddress,
        RequestMessage: requestMessage,
        MaxResponseCharacters: ELECTION_ANOMALY_CLARIFICATION_BODY_MAX_CHARACTERS,
      },
      input.SigningPrivateKeyHex,
      {
        forceFreshEnvelopeAccess: true,
      },
    );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
    clarificationRequestId,
  };
}

export async function createRecordElectionAnomalyAuthorityResponseTransaction(
  input: CreateRecordElectionAnomalyAuthorityResponseTransactionInput,
): Promise<{ signedTransaction: string }> {
  if (!input.AnomalyThreadId.trim()) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.CLARIFICATION_REQUEST_NOT_OPEN);
  }

  const authorityResponseMessage = await createElectionAnomalyAuthorityMessageEnvelope({
    MessageKindId: ELECTION_ANOMALY_MESSAGE_KIND_IDS.AUTHORITY_RESPONSE,
    Body: input.Body,
    OwnerPublicAddress: input.ActorPublicAddress,
    OwnerPublicEncryptAddress: input.ActorPublicEncryptAddress,
    OriginalSubmitterPublicAddress: input.OriginalSubmitterPublicAddress,
    OriginalSubmitterPublicEncryptAddress: input.OriginalSubmitterPublicEncryptAddress,
    AuditorRecipients: input.AuditorRecipients,
    MaxCharacters: ELECTION_ANOMALY_CLARIFICATION_BODY_MAX_CHARACTERS,
  });
  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<RecordElectionAnomalyAuthorityResponseActionPayload>(
      input.ElectionId,
      input.ActorPublicAddress,
      input.ActorPublicEncryptAddress,
      input.ActorPrivateEncryptKeyHex,
      ENCRYPTED_ELECTION_ACTION_TYPES.RECORD_ANOMALY_AUTHORITY_RESPONSE,
      {
        AnomalyThreadId: input.AnomalyThreadId,
        ActionNonce: generateGuid(),
        ActorPublicAddress: input.ActorPublicAddress,
        AuthorityResponseMessage: authorityResponseMessage,
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

export async function createClassifyElectionAnomalyThreadTransaction(
  input: CreateClassifyElectionAnomalyThreadTransactionInput,
): Promise<{ signedTransaction: string }> {
  if (!input.AnomalyThreadId.trim()) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.CLARIFICATION_REQUEST_NOT_OPEN);
  }

  if (input.CategoryId && !isElectionAnomalyCategoryId(input.CategoryId)) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.CATEGORY_INVALID);
  }

  if (input.SeverityCandidateId && !isElectionAnomalySeverityCandidateId(input.SeverityCandidateId)) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.SEVERITY_CANDIDATE_INVALID);
  }

  const hasAnyChange = Boolean(
    input.CategoryId?.trim() ||
    input.CaseStateId?.trim() ||
    input.SeverityCandidateId?.trim() ||
    input.GovernedDecisionRef?.trim(),
  );
  if (!hasAnyChange) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.BODY_REQUIRED);
  }

  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<ClassifyElectionAnomalyThreadActionPayload>(
      input.ElectionId,
      input.ActorPublicAddress,
      input.ActorPublicEncryptAddress,
      input.ActorPrivateEncryptKeyHex,
      ENCRYPTED_ELECTION_ACTION_TYPES.CLASSIFY_ANOMALY_THREAD,
      {
        AnomalyThreadId: input.AnomalyThreadId,
        ActionNonce: generateGuid(),
        ActorPublicAddress: input.ActorPublicAddress,
        CategoryId: input.CategoryId?.trim() || undefined,
        CaseStateId: input.CaseStateId?.trim() || undefined,
        SeverityCandidateId: input.SeverityCandidateId?.trim() || undefined,
        GovernedDecisionRef: input.GovernedDecisionRef?.trim() || undefined,
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

export async function createRegisterExternalElectionAnomalyClaimantTransaction(
  input: CreateRegisterExternalElectionAnomalyClaimantTransactionInput,
): Promise<{ signedTransaction: string; anomalyThreadId: string; externalClaimantReferenceHash: string }> {
  if (!isElectionAnomalyCategoryId(input.CategoryId)) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.CATEGORY_INVALID);
  }

  const anomalyThreadId = generateGuid();
  const externalClaimantReferenceHash = await hashExternalElectionAnomalyClaimantReference(
    input.ElectionId,
    input.ExternalClaimantReference,
  );
  const initialMessage = await createElectionAnomalyAuthorityMessageEnvelope({
    MessageKindId: ELECTION_ANOMALY_MESSAGE_KIND_IDS.INITIAL_SUBMISSION,
    Body: input.Body,
    OwnerPublicAddress: input.ActorPublicAddress,
    OwnerPublicEncryptAddress: input.ActorPublicEncryptAddress,
    OriginalSubmitterPublicAddress: input.ActorPublicAddress,
    OriginalSubmitterPublicEncryptAddress: input.ActorPublicEncryptAddress,
    AuditorRecipients: input.AuditorRecipients,
    MaxCharacters: ELECTION_ANOMALY_BODY_MAX_CHARACTERS,
  });
  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<RegisterExternalElectionAnomalyClaimantActionPayload>(
      input.ElectionId,
      input.ActorPublicAddress,
      input.ActorPublicEncryptAddress,
      input.ActorPrivateEncryptKeyHex,
      ENCRYPTED_ELECTION_ACTION_TYPES.REGISTER_EXTERNAL_ANOMALY_CLAIMANT,
      {
        AnomalyThreadId: anomalyThreadId,
        ActionNonce: generateGuid(),
        ActorPublicAddress: input.ActorPublicAddress,
        ExternalClaimantReferenceHash: externalClaimantReferenceHash,
        CategoryId: input.CategoryId,
        InitialMessage: initialMessage,
        RegistrarRoleContextId: ELECTION_ANOMALY_ACTOR_ROLE_CONTEXT_IDS.EXTERNAL_CLAIMANT_REGISTRAR,
      },
      input.SigningPrivateKeyHex,
      {
        forceFreshEnvelopeAccess: true,
      },
    );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
    anomalyThreadId,
    externalClaimantReferenceHash,
  };
}

function requireTrimmed(value: string | null | undefined, validationCode: string): string {
  const normalized = value?.trim() ?? '';
  if (!normalized) {
    throw new Error(validationCode);
  }

  return normalized;
}

function validateOptionalExistingEvidenceState(
  existingCount: number | undefined,
  existingTotalSizeBytes: number | undefined,
): void {
  if (
    existingCount !== undefined &&
    (!Number.isInteger(existingCount) || existingCount < 0)
  ) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_COUNT_EXCEEDED);
  }

  if (
    existingTotalSizeBytes !== undefined &&
    (!Number.isFinite(existingTotalSizeBytes) || existingTotalSizeBytes < 0)
  ) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_SIZE_EXCEEDED);
  }
}

function normalizeAttachmentContentKeyWraps(
  wraps: ElectionAnomalyAttachmentContentKeyWrapPayload[] | undefined,
): ElectionAnomalyAttachmentContentKeyWrapPayload[] | undefined {
  if (!wraps?.length) {
    return undefined;
  }

  const uniqueRecipients = new Set<string>();
  return wraps.map((wrap) => {
    const recipientRoleId = requireTrimmed(
      wrap.RecipientRoleId,
      ELECTION_ANOMALY_VALIDATION_CODES.RECIPIENT_WRAP_MISSING,
    );
    const recipientPublicAddress = requireTrimmed(
      wrap.RecipientPublicAddress,
      ELECTION_ANOMALY_VALIDATION_CODES.RECIPIENT_WRAP_MISSING,
    );
    const recipientKeyFingerprint = requireTrimmed(
      wrap.RecipientKeyFingerprint,
      ELECTION_ANOMALY_VALIDATION_CODES.RECIPIENT_WRAP_MISSING,
    );
    const encryptedContentKey = requireTrimmed(
      wrap.EncryptedContentKey,
      ELECTION_ANOMALY_VALIDATION_CODES.RECIPIENT_WRAP_MISSING,
    );
    const wrapAlgorithm = requireTrimmed(
      wrap.WrapAlgorithm,
      ELECTION_ANOMALY_VALIDATION_CODES.RECIPIENT_WRAP_MISSING,
    );
    const wrapStatusId = requireTrimmed(
      wrap.WrapStatusId,
      ELECTION_ANOMALY_VALIDATION_CODES.RECIPIENT_WRAP_MISSING,
    );

    if (
      !Object.values(ELECTION_ANOMALY_RECIPIENT_ROLE_IDS).includes(
        recipientRoleId as typeof ELECTION_ANOMALY_RECIPIENT_ROLE_IDS[keyof typeof ELECTION_ANOMALY_RECIPIENT_ROLE_IDS],
      ) ||
      wrapStatusId !== ELECTION_ANOMALY_RECIPIENT_WRAP_STATUS_IDS.AVAILABLE ||
      !uniqueRecipients.add(`${recipientRoleId}\u001f${recipientPublicAddress}`)
    ) {
      throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.RECIPIENT_WRAP_MISSING);
    }

    return {
      RecipientRoleId: recipientRoleId,
      RecipientPublicAddress: recipientPublicAddress,
      RecipientKeyFingerprint: recipientKeyFingerprint,
      EncryptedContentKey: encryptedContentKey,
      WrapAlgorithm: wrapAlgorithm,
      WrapStatusId: wrapStatusId,
    };
  });
}

function normalizeAttachmentManifestAction(
  input: CreateRecordElectionAnomalyAttachmentManifestTransactionInput,
): Omit<RecordElectionAnomalyAttachmentManifestActionPayload, 'ActionNonce'> {
  const attachmentKindId = requireTrimmed(
    input.AttachmentKindId,
    ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_KIND_INVALID,
  );
  const validationStatusId =
    input.ValidationStatusId?.trim() ||
    ELECTION_ANOMALY_ATTACHMENT_VALIDATION_STATUS_IDS.PENDING_SCAN;
  const mimeType = requireTrimmed(
    input.MimeType,
    ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_MIME_TYPE_INVALID,
  ).toLowerCase();
  const encryptedPayloadReference = requireTrimmed(
    input.EncryptedPayloadReference,
    ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_PAYLOAD_REFERENCE_INVALID,
  );
  const encryptedPayloadHash = requireTrimmed(
    input.EncryptedPayloadHash,
    ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_HASH_INVALID,
  );
  const contentHash = requireTrimmed(
    input.ContentHash,
    ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_HASH_INVALID,
  );
  const clarificationRequestId = input.ClarificationRequestId?.trim() || undefined;

  if (!isElectionAnomalyAttachmentKindId(attachmentKindId)) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_KIND_INVALID);
  }

  if (attachmentKindId === ELECTION_ANOMALY_ATTACHMENT_KIND_IDS.SUBMITTER_EVIDENCE) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_SUBMITTER_NOT_ALLOWED);
  }

  if (attachmentKindId === ELECTION_ANOMALY_ATTACHMENT_KIND_IDS.RESTRICTED_OPERATIONAL_EVIDENCE) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_OPERATIONAL_EVIDENCE_DISABLED);
  }

  if (!isElectionAnomalyAttachmentValidationStatusId(validationStatusId)) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_SCANNER_STATUS_INVALID);
  }

  if (!isElectionAnomalyEvidenceMimeType(mimeType)) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_MIME_TYPE_INVALID);
  }

  if (
    !isElectionAnomalySha256Reference(encryptedPayloadHash) ||
    !isElectionAnomalySha256Reference(contentHash)
  ) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_HASH_INVALID);
  }

  if (!isElectionAnomalyRestrictedPayloadReference(encryptedPayloadReference)) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_PAYLOAD_REFERENCE_INVALID);
  }

  if (!Number.isFinite(input.SizeBytes) || input.SizeBytes <= 0) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_SIZE_EXCEEDED);
  }

  validateOptionalExistingEvidenceState(
    input.ExistingAttachmentManifestCount,
    input.ExistingAttachmentManifestTotalBytes,
  );

  const isSubmitterClarificationEvidence =
    attachmentKindId === ELECTION_ANOMALY_ATTACHMENT_KIND_IDS.AUTHORITY_REQUESTED_EVIDENCE;
  const perPayloadLimit = isSubmitterClarificationEvidence
    ? ELECTION_ANOMALY_SUBMITTER_CLARIFICATION_EVIDENCE_MAX_BYTES
    : ELECTION_ANOMALY_AUTHORITY_EVIDENCE_MAX_BYTES;
  const countLimit = isSubmitterClarificationEvidence
    ? ELECTION_ANOMALY_SUBMITTER_CLARIFICATION_EVIDENCE_MAX_COUNT
    : ELECTION_ANOMALY_AUTHORITY_EVIDENCE_MAX_COUNT;
  const totalSizeLimit = isSubmitterClarificationEvidence
    ? ELECTION_ANOMALY_SUBMITTER_CLARIFICATION_EVIDENCE_MAX_TOTAL_BYTES
    : ELECTION_ANOMALY_AUTHORITY_EVIDENCE_MAX_TOTAL_BYTES;

  if (input.SizeBytes > perPayloadLimit) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_SIZE_EXCEEDED);
  }

  if (
    input.ExistingAttachmentManifestCount !== undefined &&
    input.ExistingAttachmentManifestCount >= countLimit
  ) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_COUNT_EXCEEDED);
  }

  if (
    input.ExistingAttachmentManifestTotalBytes !== undefined &&
    input.ExistingAttachmentManifestTotalBytes + input.SizeBytes > totalSizeLimit
  ) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_SIZE_EXCEEDED);
  }

  if (isSubmitterClarificationEvidence && !clarificationRequestId) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.CLARIFICATION_REQUEST_NOT_OPEN);
  }

  if (
    attachmentKindId === ELECTION_ANOMALY_ATTACHMENT_KIND_IDS.AUTHORITY_EVIDENCE &&
    clarificationRequestId
  ) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_REQUEST_MISMATCH);
  }

  return {
    AnomalyThreadId: requireTrimmed(
      input.AnomalyThreadId,
      ELECTION_ANOMALY_VALIDATION_CODES.CLARIFICATION_REQUEST_NOT_OPEN,
    ),
    AttachmentManifestId: input.AttachmentManifestId?.trim() || generateGuid(),
    ActorPublicAddress: requireTrimmed(
      input.ActorPublicAddress,
      ELECTION_ANOMALY_VALIDATION_CODES.BODY_REQUIRED,
    ),
    AttachmentKindId: attachmentKindId,
    EncryptedPayloadReference: encryptedPayloadReference,
    EncryptedPayloadHash: encryptedPayloadHash,
    ContentHash: contentHash,
    SizeBytes: input.SizeBytes,
    MimeType: mimeType,
    ValidationStatusId: validationStatusId,
    ClarificationRequestId: clarificationRequestId,
    ContentKeyWraps: normalizeAttachmentContentKeyWraps(input.ContentKeyWraps),
  };
}

export async function createRecordElectionAnomalyAttachmentManifestTransaction(
  input: CreateRecordElectionAnomalyAttachmentManifestTransactionInput,
): Promise<{ signedTransaction: string; attachmentManifestId: string }> {
  const normalized = normalizeAttachmentManifestAction(input);
  const actionPayload: RecordElectionAnomalyAttachmentManifestActionPayload = {
    ...normalized,
    ActionNonce: generateGuid(),
  };
  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<RecordElectionAnomalyAttachmentManifestActionPayload>(
      input.ElectionId,
      actionPayload.ActorPublicAddress,
      input.ActorPublicEncryptAddress,
      input.ActorPrivateEncryptKeyHex,
      ENCRYPTED_ELECTION_ACTION_TYPES.RECORD_ANOMALY_ATTACHMENT_MANIFEST,
      actionPayload,
      input.SigningPrivateKeyHex,
      {
        forceFreshEnvelopeAccess: true,
      },
    );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
    attachmentManifestId: actionPayload.AttachmentManifestId,
  };
}

function normalizeRedactionAction(
  input: CreateRecordElectionAnomalyEvidenceRedactionTransactionInput,
): Omit<RecordElectionAnomalyEvidenceRedactionActionPayload, 'ActionNonce'> {
  const targetKindId = requireTrimmed(
    input.TargetKindId,
    ELECTION_ANOMALY_VALIDATION_CODES.REDACTION_TARGET_INVALID,
  );
  const reasonCodeId = requireTrimmed(
    input.ReasonCodeId,
    ELECTION_ANOMALY_VALIDATION_CODES.REDACTION_REASON_INVALID,
  );
  const originalHash = requireTrimmed(
    input.OriginalHash,
    ELECTION_ANOMALY_VALIDATION_CODES.REDACTION_ORIGINAL_HASH_INVALID,
  );
  const replacementManifestHash = input.ReplacementManifestHash?.trim() || undefined;

  if (!isElectionAnomalyRedactionTargetKindId(targetKindId)) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.REDACTION_TARGET_INVALID);
  }

  if (!isElectionAnomalyRedactionReasonId(reasonCodeId)) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.REDACTION_REASON_INVALID);
  }

  if (
    !isElectionAnomalySha256Reference(originalHash) ||
    (replacementManifestHash && !isElectionAnomalySha256Reference(replacementManifestHash))
  ) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.REDACTION_ORIGINAL_HASH_INVALID);
  }

  return {
    AnomalyThreadId: requireTrimmed(
      input.AnomalyThreadId,
      ELECTION_ANOMALY_VALIDATION_CODES.CLARIFICATION_REQUEST_NOT_OPEN,
    ),
    RedactionEventId: input.RedactionEventId?.trim() || generateGuid(),
    ActorPublicAddress: requireTrimmed(
      input.ActorPublicAddress,
      ELECTION_ANOMALY_VALIDATION_CODES.BODY_REQUIRED,
    ),
    TargetKindId: targetKindId,
    TargetId: requireTrimmed(
      input.TargetId,
      ELECTION_ANOMALY_VALIDATION_CODES.REDACTION_TARGET_INVALID,
    ),
    ReasonCodeId: reasonCodeId,
    OriginalHash: originalHash,
    ReplacementManifestHash: replacementManifestHash,
    TombstoneStatusId: input.TombstoneStatusId?.trim() || undefined,
    HoldReference: input.HoldReference?.trim() || undefined,
  };
}

export async function createRecordElectionAnomalyEvidenceRedactionTransaction(
  input: CreateRecordElectionAnomalyEvidenceRedactionTransactionInput,
): Promise<{ signedTransaction: string; redactionEventId: string }> {
  const normalized = normalizeRedactionAction(input);
  const actionPayload: RecordElectionAnomalyEvidenceRedactionActionPayload = {
    ...normalized,
    ActionNonce: generateGuid(),
  };
  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<RecordElectionAnomalyEvidenceRedactionActionPayload>(
      input.ElectionId,
      actionPayload.ActorPublicAddress,
      input.ActorPublicEncryptAddress,
      input.ActorPrivateEncryptKeyHex,
      ENCRYPTED_ELECTION_ACTION_TYPES.RECORD_ANOMALY_EVIDENCE_REDACTION,
      actionPayload,
      input.SigningPrivateKeyHex,
      {
        forceFreshEnvelopeAccess: true,
      },
    );

  return {
    signedTransaction: encryptedEnvelope.signedTransaction,
    redactionEventId: actionPayload.RedactionEventId,
  };
}

export async function createRecordElectionAnomalyAuditorRecipientRewrapTransaction(
  input: CreateRecordElectionAnomalyAuditorRecipientRewrapTransactionInput,
): Promise<{ signedTransaction: string }> {
  if (
    !input.AnomalyThreadId.trim() ||
    !input.MessageId.trim() ||
    !input.AuditorPublicAddress.trim() ||
    !input.AuditorPublicEncryptAddress.trim() ||
    !input.ContentKey.trim()
  ) {
    throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.RECIPIENT_WRAP_MISSING);
  }

  const actionPayload: RecordElectionAnomalyAuditorRecipientRewrapActionPayload = {
    AnomalyThreadId: input.AnomalyThreadId,
    MessageId: input.MessageId,
    ActionNonce: generateGuid(),
    ActorPublicAddress: input.ActorPublicAddress,
    AuditorPublicAddress: input.AuditorPublicAddress,
    RecipientKeyFingerprint: await sha256Hex(input.AuditorPublicEncryptAddress),
    EncryptedContentKey: await eciesEncrypt(input.ContentKey, input.AuditorPublicEncryptAddress),
    WrapAlgorithm: ELECTION_ANOMALY_WRAP_ALGORITHM,
  };
  const encryptedEnvelope =
    await createEncryptedElectionEnvelopeTransaction<RecordElectionAnomalyAuditorRecipientRewrapActionPayload>(
      input.ElectionId,
      input.ActorPublicAddress,
      input.ActorPublicEncryptAddress,
      input.ActorPrivateEncryptKeyHex,
      ENCRYPTED_ELECTION_ACTION_TYPES.RECORD_ANOMALY_AUDITOR_RECIPIENT_REWRAP,
      actionPayload,
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
