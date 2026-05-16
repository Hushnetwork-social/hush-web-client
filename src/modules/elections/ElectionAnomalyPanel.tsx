"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  FileWarning,
  FileUp,
  Loader2,
  LockKeyhole,
  Paperclip,
  RefreshCcw,
  Send,
  X,
} from 'lucide-react';
import {
  ElectionLifecycleStateProto,
  TransactionStatus,
  type ElectionAnomalyMessageView,
  type ElectionAnomalyOwnerMessageView,
  type ElectionAnomalyOwnerTriageThreadView,
  type GetElectionAnomalyOwnThreadResponse,
  type GrpcTimestamp,
} from '@/lib/grpc';
import { electionsService } from '@/lib/grpc/services/elections';
import { bytesToBase64 } from '@/lib/crypto';
import { submitTransaction } from '@/modules/blockchain/BlockchainService';
import {
  ELECTION_ANOMALY_ATTACHMENT_KIND_IDS,
  ELECTION_ANOMALY_ATTACHMENT_VALIDATION_STATUS_IDS,
  ELECTION_ANOMALY_BODY_MAX_CHARACTERS,
  ELECTION_ANOMALY_ACTOR_ROLE_CONTEXT_IDS,
  ELECTION_ANOMALY_CASE_STATE_IDS,
  ELECTION_ANOMALY_CATEGORY_IDS,
  ELECTION_ANOMALY_EVIDENCE_MIME_TYPE_VALUES,
  ELECTION_ANOMALY_MESSAGE_KIND_IDS,
  ELECTION_ANOMALY_SUBMITTER_CLARIFICATION_EVIDENCE_MAX_BYTES,
  ELECTION_ANOMALY_SUBMITTER_CLARIFICATION_EVIDENCE_MAX_COUNT,
  ELECTION_ANOMALY_SUBMITTER_CLARIFICATION_EVIDENCE_MAX_TOTAL_BYTES,
  ELECTION_ANOMALY_VALIDATION_CODES,
  createElectionAnomalyRestrictedEvidencePayload,
  createElectionAnomalySubmitterAttachmentContentKeyWraps,
  createRecordElectionAnomalyAttachmentManifestTransaction,
  createSubmitElectionAnomalyInformationTransaction,
  createSubmitElectionAnomalyThreadTransaction,
  decryptElectionAnomalyMessageBody,
  decryptElectionAnomalyOwnerMessageBody,
  hasElectionAnomalyDuplicateThreadValidation,
  prepareElectionAnomalyAttachmentManifestMaterial,
  type ElectionAnomalyAttachmentContentKeyWrapPayload,
  type PreparedElectionAnomalyAttachmentManifestMaterial,
} from './transactionService';

type ElectionAnomalyPanelProps = {
  electionId: string;
  actorPublicAddress: string;
  actorEncryptionPublicKey: string;
  actorEncryptionPrivateKey: string;
  actorSigningPrivateKey: string;
  ownerPublicAddress: string;
  isLinkedVoter?: boolean;
  surface?: 'voter' | 'trustee' | 'auditor' | 'owner' | 'account';
  canReadOwnThread?: boolean;
  canCreateThread?: boolean;
  unavailableTitle?: string;
  unavailableDescription?: string;
  unavailableActionHref?: string;
  unavailableActionLabel?: string;
  lifecycleState?: ElectionLifecycleStateProto;
  anomalySubmissionWindowClosesAt?: GrpcTimestamp;
  hasAnomalySubmissionWindowClosesAt?: boolean;
};

type PanelFeedback = {
  tone: 'success' | 'warning' | 'error';
  message: string;
};

type DecryptedMessage = {
  status: 'decrypted' | 'failed';
  body?: string;
  error?: string;
};

type ElectionAnomalyPanelSurface = NonNullable<ElectionAnomalyPanelProps['surface']>;

type ClarificationEvidenceStatus =
  | 'ready'
  | 'encrypting'
  | 'staging'
  | 'staged'
  | 'submitting'
  | 'scanner_pending'
  | 'accepted'
  | 'quarantined'
  | 'validation_rejected';

type ClarificationEvidenceFile = {
  id: string;
  file: File;
  status: ClarificationEvidenceStatus;
  material?: PreparedElectionAnomalyAttachmentManifestMaterial;
  contentKeyWraps?: ElectionAnomalyAttachmentContentKeyWrapPayload[];
  validationCode?: string;
};

type PendingAnomalySubmissionState = {
  anomalyThreadId: string;
  categoryId: string;
  submittedAt: string;
};

const ANOMALY_CATEGORY_OPTIONS = [
  {
    id: ELECTION_ANOMALY_CATEGORY_IDS.ACCESS_OR_AUTHENTICATION,
    label: 'Access or authentication',
  },
  {
    id: ELECTION_ANOMALY_CATEGORY_IDS.BALLOT_CASTING_OR_RECEIPT,
    label: 'Ballot casting or receipt',
  },
  {
    id: ELECTION_ANOMALY_CATEGORY_IDS.TRUSTEE_CONTINUITY,
    label: 'Trustee continuity',
  },
  {
    id: ELECTION_ANOMALY_CATEGORY_IDS.COUNTING_OR_TALLY,
    label: 'Counting or tally',
  },
  {
    id: ELECTION_ANOMALY_CATEGORY_IDS.REPORTING_OR_AUDIT_PACKAGE,
    label: 'Reporting or audit package',
  },
  {
    id: ELECTION_ANOMALY_CATEGORY_IDS.SECURITY_OR_INTEGRITY,
    label: 'Security or integrity',
  },
  {
    id: ELECTION_ANOMALY_CATEGORY_IDS.EXTERNAL_OBJECTION_OR_COMPLAINT,
    label: 'External objection or complaint',
  },
  {
    id: ELECTION_ANOMALY_CATEGORY_IDS.OTHER_PROCESS,
    label: 'Other process anomaly',
  },
] as const;

const ANOMALY_CASE_STATE_OPTIONS = [
  [ELECTION_ANOMALY_CASE_STATE_IDS.SUBMITTED, 'Submitted'],
  [ELECTION_ANOMALY_CASE_STATE_IDS.UNDER_REVIEW, 'Under review'],
  [ELECTION_ANOMALY_CASE_STATE_IDS.AUTHORITY_REQUESTED_INFORMATION, 'Awaiting information'],
  [ELECTION_ANOMALY_CASE_STATE_IDS.SUBMITTER_INFORMATION_PROVIDED, 'Information provided'],
  [ELECTION_ANOMALY_CASE_STATE_IDS.OWNER_RESPONDED, 'Owner responded'],
  [ELECTION_ANOMALY_CASE_STATE_IDS.ESCALATED_TO_GOVERNED_DECISION, 'Governed decision reference'],
  [ELECTION_ANOMALY_CASE_STATE_IDS.RESOLVED_NON_BLOCKING, 'Resolved non-blocking'],
  [ELECTION_ANOMALY_CASE_STATE_IDS.CLOSED_DUPLICATE_FOLLOWUP, 'Closed duplicate'],
  [ELECTION_ANOMALY_CASE_STATE_IDS.CLOSED_NO_FURTHER_SUBMITTER_INPUT, 'Closed no response'],
] as const;

const ANOMALY_PENDING_STORAGE_PREFIX = 'feat123:anomaly-pending';
const CLARIFICATION_RESPONSE_STORAGE_PREFIX = 'feat123:anomaly-clarification-response';
const ANOMALY_TEXTAREA_CLASS =
  'w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-4 py-3 text-sm leading-6 text-hush-text-primary placeholder:text-hush-text-accent/60 outline-none transition-colors focus:border-hush-purple disabled:cursor-not-allowed disabled:opacity-60';

function pendingAnomalySubmissionStorageKey(
  electionId: string,
  actorPublicAddress: string,
): string {
  return `${ANOMALY_PENDING_STORAGE_PREFIX}:${electionId}:${actorPublicAddress.trim()}`;
}

function loadPendingAnomalySubmission(
  electionId: string,
  actorPublicAddress: string,
): PendingAnomalySubmissionState | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const storageKey = pendingAnomalySubmissionStorageKey(electionId, actorPublicAddress);
  const rawValue = window.sessionStorage.getItem(storageKey);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as PendingAnomalySubmissionState;
  } catch {
    window.sessionStorage.removeItem(storageKey);
    return null;
  }
}

function savePendingAnomalySubmission(
  electionId: string,
  actorPublicAddress: string,
  pendingSubmission: PendingAnomalySubmissionState,
): void {
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(
      pendingAnomalySubmissionStorageKey(electionId, actorPublicAddress),
      JSON.stringify(pendingSubmission),
    );
  }
}

function clearPendingAnomalySubmission(
  electionId: string,
  actorPublicAddress: string,
): void {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(
      pendingAnomalySubmissionStorageKey(electionId, actorPublicAddress),
    );
  }
}

function clarificationResponseStorageKey(
  electionId: string,
  actorPublicAddress: string,
): string {
  return `${CLARIFICATION_RESPONSE_STORAGE_PREFIX}:${electionId}:${actorPublicAddress.trim()}`;
}

function clarificationResponseKey(
  anomalyThreadId: string,
  clarificationRequestId: string,
): string {
  return `${anomalyThreadId.trim()}:${clarificationRequestId.trim()}`;
}

function loadSubmittedClarificationResponses(
  electionId: string,
  actorPublicAddress: string,
): Set<string> {
  if (typeof window === 'undefined') {
    return new Set();
  }

  const storageKey = clarificationResponseStorageKey(electionId, actorPublicAddress);
  const rawValue = window.sessionStorage.getItem(storageKey);
  if (!rawValue) {
    return new Set();
  }

  try {
    const parsedValue = JSON.parse(rawValue) as unknown;
    return new Set(Array.isArray(parsedValue) ? parsedValue.filter((item) => typeof item === 'string') : []);
  } catch {
    window.sessionStorage.removeItem(storageKey);
    return new Set();
  }
}

function saveSubmittedClarificationResponses(
  electionId: string,
  actorPublicAddress: string,
  submittedResponses: Set<string>,
): void {
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(
      clarificationResponseStorageKey(electionId, actorPublicAddress),
      JSON.stringify([...submittedResponses]),
    );
  }
}

const CLARIFICATION_EVIDENCE_ACCEPTED_MIME_LABELS = 'PDF, PNG, JPG, TXT, CSV, JSON';

function categoryLabel(categoryId: string): string {
  return ANOMALY_CATEGORY_OPTIONS.find((option) => option.id === categoryId)?.label ?? categoryId;
}

function caseStateLabel(caseStateId: string): string {
  return ANOMALY_CASE_STATE_OPTIONS.find(([id]) => id === caseStateId)?.[1] ?? caseStateId;
}

function resolvedThreadStateLabel(
  caseStateId: string,
  hasOpenClarificationRequest: boolean,
  hasAuthorityInformationRequest: boolean,
  hasSubmitterInformationResponse: boolean,
  hasAuthorityResponse: boolean,
): string {
  if (hasOpenClarificationRequest) {
    return 'Waiting for response';
  }

  if (caseStateId !== ELECTION_ANOMALY_CASE_STATE_IDS.AUTHORITY_REQUESTED_INFORMATION) {
    return caseStateLabel(caseStateId);
  }

  if (hasSubmitterInformationResponse) {
    return 'Information provided';
  }

  if (hasAuthorityResponse) {
    return 'Authority response recorded';
  }

  if (hasAuthorityInformationRequest) {
    return 'Clarification closed';
  }

  return 'Under review';
}

function isSameAddress(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function isRegisteredByCurrentAccountThread(
  thread: ElectionAnomalyOwnerTriageThreadView,
  actorPublicAddress: string,
): boolean {
  return (
    isSameAddress(thread.SubmitterActorPublicAddress, actorPublicAddress) &&
    thread.SubmitterRoleContextId ===
      ELECTION_ANOMALY_ACTOR_ROLE_CONTEXT_IDS.EXTERNAL_CLAIMANT_REGISTRAR
  );
}

function formatEvidenceSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kib = bytes / 1024;
  if (kib < 1024) {
    return `${Math.round(kib)} KB`;
  }

  return `${Math.round((kib / 1024) * 10) / 10} MB`;
}

function evidenceStatusLabel(status: ClarificationEvidenceStatus): string {
  switch (status) {
    case 'encrypting':
      return 'Encrypting and deriving hashes';
    case 'staging':
      return 'Staging restricted payload';
    case 'staged':
      return 'Payload staged';
    case 'submitting':
      return 'Signing manifest';
    case 'scanner_pending':
      return 'Scanner pending';
    case 'accepted':
      return 'Accepted';
    case 'quarantined':
      return 'Quarantined';
    case 'validation_rejected':
      return 'Validation rejected';
    case 'ready':
    default:
      return 'Ready';
  }
}

function evidenceStatusClass(status: ClarificationEvidenceStatus): string {
  switch (status) {
    case 'staged':
    case 'scanner_pending':
    case 'staging':
      return 'bg-amber-500/10 text-amber-100';
    case 'accepted':
      return 'bg-green-500/10 text-green-100';
    case 'quarantined':
    case 'validation_rejected':
      return 'bg-red-500/10 text-red-100';
    default:
      return 'bg-hush-bg-element/80 text-hush-text-primary';
  }
}

function isAllowedClarificationEvidenceMimeType(mimeType: string): boolean {
  return ELECTION_ANOMALY_EVIDENCE_MIME_TYPE_VALUES.includes(
    mimeType as typeof ELECTION_ANOMALY_EVIDENCE_MIME_TYPE_VALUES[number],
  );
}

async function readFileBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') {
    return new Uint8Array(await file.arrayBuffer());
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (result instanceof ArrayBuffer) {
        resolve(new Uint8Array(result));
        return;
      }

      reject(new Error(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_HASH_INVALID));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_HASH_INVALID));
    reader.readAsArrayBuffer(file);
  });
}

function timestampToMillis(timestamp?: GrpcTimestamp): number | null {
  if (!timestamp?.seconds) {
    return null;
  }

  return timestamp.seconds * 1000 + Math.floor((timestamp.nanos ?? 0) / 1_000_000);
}

function formatTimestamp(timestamp?: GrpcTimestamp): string {
  const millis = timestampToMillis(timestamp);
  return millis ? new Date(millis).toLocaleString() : 'Not yet available';
}

function formatIsoTimestamp(value: string): string {
  const millis = Date.parse(value);
  return Number.isNaN(millis) ? 'Not yet available' : new Date(millis).toLocaleString();
}

function messageKindLabel(
  messageKindId: string,
  surface: ElectionAnomalyPanelSurface,
): string {
  switch (messageKindId) {
    case ELECTION_ANOMALY_MESSAGE_KIND_IDS.INITIAL_SUBMISSION:
      return surface === 'trustee'
        ? 'Trustee report'
        : surface === 'auditor'
          ? 'Auditor report'
          : surface === 'owner'
            ? 'Owner report'
            : surface === 'account'
              ? 'Account report'
              : 'Voter report';
    case ELECTION_ANOMALY_MESSAGE_KIND_IDS.AUTHORITY_INFORMATION_REQUEST:
      return 'Clarification request';
    case ELECTION_ANOMALY_MESSAGE_KIND_IDS.SUBMITTER_INFORMATION_RESPONSE:
      return surface === 'trustee'
        ? 'Trustee clarification'
        : surface === 'auditor'
          ? 'Auditor clarification'
          : surface === 'owner'
            ? 'Owner clarification'
            : surface === 'account'
              ? 'Account clarification'
              : 'Voter clarification';
    case ELECTION_ANOMALY_MESSAGE_KIND_IDS.AUTHORITY_RESPONSE:
      return 'Authority response';
    default:
      return 'Thread message';
  }
}

function threadMessageContainerClass(messageKindId: string): string {
  const isSubmitterMessage =
    messageKindId === ELECTION_ANOMALY_MESSAGE_KIND_IDS.INITIAL_SUBMISSION ||
    messageKindId === ELECTION_ANOMALY_MESSAGE_KIND_IDS.SUBMITTER_INFORMATION_RESPONSE;

  return isSubmitterMessage
    ? 'rounded-2xl bg-hush-purple/10 px-5 py-4 shadow-[inset_4px_0_0_rgba(167,139,250,0.85)]'
    : 'rounded-2xl bg-hush-bg-dark/72 px-5 py-4';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForOwnThread(
  electionId: string,
  actorPublicAddress: string,
  maxAttempts: number = 8,
): Promise<GetElectionAnomalyOwnThreadResponse | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await electionsService.getElectionAnomalyOwnThread({
      ElectionId: electionId,
      ActorPublicAddress: actorPublicAddress,
    });
    if (response.Success && response.HasThread) {
      return response;
    }

    if (attempt < maxAttempts - 1) {
      await delay(500);
    }
  }

  return null;
}

export function ElectionAnomalyPanel({
  electionId,
  actorPublicAddress,
  actorEncryptionPublicKey,
  actorEncryptionPrivateKey,
  actorSigningPrivateKey,
  ownerPublicAddress,
  isLinkedVoter = false,
  surface = 'voter',
  canReadOwnThread,
  canCreateThread,
  unavailableTitle,
  unavailableDescription,
  unavailableActionHref,
  unavailableActionLabel,
  lifecycleState,
  anomalySubmissionWindowClosesAt,
  hasAnomalySubmissionWindowClosesAt,
}: ElectionAnomalyPanelProps) {
  const [ownThread, setOwnThread] = useState<GetElectionAnomalyOwnThreadResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingClarification, setIsSubmittingClarification] = useState(false);
  const [feedback, setFeedback] = useState<PanelFeedback | null>(null);
  const [ownerRegisteredClarificationFeedback, setOwnerRegisteredClarificationFeedback] =
    useState<PanelFeedback | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    ELECTION_ANOMALY_CATEGORY_IDS.BALLOT_CASTING_OR_RECEIPT,
  );
  const [body, setBody] = useState('');
  const [clarificationBody, setClarificationBody] = useState('');
  const [decryptedMessages, setDecryptedMessages] = useState<Record<string, DecryptedMessage>>({});
  const [clarificationEvidenceFiles, setClarificationEvidenceFiles] = useState<
    ClarificationEvidenceFile[]
  >([]);
  const [evidenceFeedback, setEvidenceFeedback] = useState<PanelFeedback | null>(null);
  const [pendingAnomalySubmission, setPendingAnomalySubmission] =
    useState<PendingAnomalySubmissionState | null>(null);
  const [ownerRegisteredThread, setOwnerRegisteredThread] =
    useState<ElectionAnomalyOwnerTriageThreadView | null>(null);
  const [isLoadingOwnerRegisteredThread, setIsLoadingOwnerRegisteredThread] = useState(false);
  const [ownerRegisteredDecryptedMessages, setOwnerRegisteredDecryptedMessages] =
    useState<Record<string, DecryptedMessage>>({});
  const [submittedClarificationResponses, setSubmittedClarificationResponses] = useState<Set<string>>(
    () => new Set(),
  );

  const submissionWindowMillis = timestampToMillis(anomalySubmissionWindowClosesAt);
  const isSubmissionWindowOpen =
    !hasAnomalySubmissionWindowClosesAt ||
    !submissionWindowMillis ||
    submissionWindowMillis > Date.now();
  const isTrusteeSurface = surface === 'trustee';
  const isAuditorSurface = surface === 'auditor';
  const isOwnerSurface = surface === 'owner';
  const isAccountSurface = surface === 'account';
  const canReadThread = canReadOwnThread ?? isLinkedVoter;
  const canCreateNewThreadForActor = canCreateThread ?? isLinkedVoter;
  const thread = ownThread?.Thread;
  const hasThread = Boolean(ownThread?.Success && ownThread.HasThread && thread);
  const hasOwnerRegisteredThread = Boolean(!hasThread && ownerRegisteredThread);
  const hasPendingAnomalySubmission = Boolean(pendingAnomalySubmission && !hasThread);
  const threadMessages = thread?.Messages ?? [];
  const ownerRegisteredMessages = ownerRegisteredThread?.Messages ?? [];
  const hasAuthorityInformationRequest = threadMessages.some(
    (message) =>
      message.MessageKindId === ELECTION_ANOMALY_MESSAGE_KIND_IDS.AUTHORITY_INFORMATION_REQUEST,
  );
  const hasSubmitterInformationResponse = threadMessages.some(
    (message) =>
      message.MessageKindId === ELECTION_ANOMALY_MESSAGE_KIND_IDS.SUBMITTER_INFORMATION_RESPONSE,
  );
  const hasAuthorityResponse = threadMessages.some(
    (message) => message.MessageKindId === ELECTION_ANOMALY_MESSAGE_KIND_IDS.AUTHORITY_RESPONSE,
  );
  const ownerRegisteredHasAuthorityInformationRequest = ownerRegisteredMessages.some(
    (message) =>
      message.MessageKindId === ELECTION_ANOMALY_MESSAGE_KIND_IDS.AUTHORITY_INFORMATION_REQUEST,
  );
  const ownerRegisteredHasSubmitterInformationResponse = ownerRegisteredMessages.some(
    (message) =>
      message.MessageKindId === ELECTION_ANOMALY_MESSAGE_KIND_IDS.SUBMITTER_INFORMATION_RESPONSE,
  );
  const ownerRegisteredHasAuthorityResponse = ownerRegisteredMessages.some(
    (message) => message.MessageKindId === ELECTION_ANOMALY_MESSAGE_KIND_IDS.AUTHORITY_RESPONSE,
  );
  const ownerRegisteredHasAwaitingStateWithoutRequest = Boolean(
    ownerRegisteredThread &&
    ownerRegisteredThread.CaseStateId === ELECTION_ANOMALY_CASE_STATE_IDS.AUTHORITY_REQUESTED_INFORMATION &&
    !ownerRegisteredThread.HasOpenClarificationRequest,
  );
  const hasAwaitingStateWithoutRequest = Boolean(
    thread &&
    thread.CaseStateId === ELECTION_ANOMALY_CASE_STATE_IDS.AUTHORITY_REQUESTED_INFORMATION &&
    !thread.HasOpenClarificationRequest,
  );
  const bodyCharacterCount = Array.from(body.trim()).length;
  const clarificationCharacterCount = Array.from(clarificationBody.trim()).length;
  const currentClarificationRequestId = useMemo(() => {
    if (!thread?.HasOpenClarificationRequest) {
      return '';
    }

    return [...thread.Messages]
      .reverse()
      .find((message) =>
        message.HasClarificationRequest &&
        message.MessageKindId === ELECTION_ANOMALY_MESSAGE_KIND_IDS.AUTHORITY_INFORMATION_REQUEST &&
        message.ClarificationRequestId
      )?.ClarificationRequestId ?? '';
  }, [thread]);
  const ownerRegisteredCurrentClarificationRequestId = useMemo(() => {
    if (!ownerRegisteredThread?.HasOpenClarificationRequest) {
      return '';
    }

    const messageRequestId = [...ownerRegisteredThread.Messages]
      .reverse()
      .find((message) =>
        message.HasClarificationRequest &&
        message.MessageKindId === ELECTION_ANOMALY_MESSAGE_KIND_IDS.AUTHORITY_INFORMATION_REQUEST &&
        message.ClarificationRequestId
      )?.ClarificationRequestId;

    return messageRequestId || ownerRegisteredThread.OpenClarificationRequestId || '';
  }, [ownerRegisteredThread]);
  const currentClarificationResponseKey = thread && currentClarificationRequestId
    ? clarificationResponseKey(thread.AnomalyThreadId, currentClarificationRequestId)
    : '';
  const ownerRegisteredClarificationResponseKey =
    ownerRegisteredThread && ownerRegisteredCurrentClarificationRequestId
      ? clarificationResponseKey(
          ownerRegisteredThread.AnomalyThreadId,
          ownerRegisteredCurrentClarificationRequestId,
        )
      : '';
  const hasSubmittedClarificationResponse = Boolean(
    currentClarificationResponseKey &&
    submittedClarificationResponses.has(currentClarificationResponseKey),
  );
  const ownerRegisteredHasSubmittedClarificationResponse = Boolean(
    ownerRegisteredClarificationResponseKey &&
    submittedClarificationResponses.has(ownerRegisteredClarificationResponseKey),
  );
  const canSubmitNewThread =
    canCreateNewThreadForActor &&
    !hasThread &&
    !hasOwnerRegisteredThread &&
    !hasPendingAnomalySubmission &&
    isSubmissionWindowOpen;
  const canSubmitClarification = Boolean(
    hasThread && currentClarificationRequestId && !hasSubmittedClarificationResponse,
  );
  const canSubmitOwnerRegisteredClarification = Boolean(
    hasOwnerRegisteredThread &&
    ownerRegisteredCurrentClarificationRequestId &&
    !ownerRegisteredHasSubmittedClarificationResponse,
  );
  const stagedClarificationEvidence = clarificationEvidenceFiles.filter(
    (item) => item.status === 'staged' && item.material,
  );
  const clarificationEvidenceTotalBytes = clarificationEvidenceFiles.reduce(
    (total, item) => total + item.file.size,
    0,
  );
  const hasEvidenceInProgress = clarificationEvidenceFiles.some((item) =>
    item.status === 'encrypting' || item.status === 'staging' || item.status === 'submitting'
  );
  const hasRejectedEvidence = clarificationEvidenceFiles.some((item) =>
    item.status === 'validation_rejected' || item.status === 'quarantined'
  );
  const noAccessTitle =
    unavailableTitle ??
    (isAuditorSurface
      ? 'Designated auditor access is required.'
      : isAccountSurface
        ? 'An election role is required.'
        : isOwnerSurface
          ? 'Owner access is required.'
          : isTrusteeSurface
            ? 'Accepted trustee access is required.'
            : 'Link voter identity before reporting an anomaly.');
  const noAccessDescription =
    unavailableDescription ??
    (isAuditorSurface
      ? 'Auditor anomaly creation and restricted review require a current designated-auditor grant. Own-thread review remains available when the thread belongs to this account.'
      : isAccountSurface
        ? 'This account needs a current election role to create a new anomaly. If it already submitted one, own-thread review remains available here.'
        : isOwnerSurface
          ? 'Owner anomaly creation requires the current election owner account. Own-thread review remains available when the thread belongs to this account.'
          : isTrusteeSurface
            ? 'Trustee anomaly creation and aggregate visibility require current accepted trustee status. Own-thread review remains available when the thread belongs to this account.'
            : 'The report is bound to the same election voter account that can access the ballot flow.');
  const noAccessActionHref =
    unavailableActionHref ??
    (isTrusteeSurface || isAuditorSurface || isOwnerSurface || isAccountSurface
      ? ''
      : `/elections/${electionId}/eligibility`);
  const noAccessActionLabel =
    unavailableActionLabel ??
    (isTrusteeSurface || isAuditorSurface || isOwnerSurface || isAccountSurface
      ? ''
      : 'Open eligibility');
  const introCopy = hasThread
    ? isAuditorSurface
      ? 'Review your auditor anomaly thread here. The history includes your submitted report and any authority messages or replies for this account.'
      : isTrusteeSurface
        ? 'Review your trustee anomaly thread here. The history includes your submitted report and any authority messages or replies for this account.'
        : isOwnerSurface
          ? 'Review your owner anomaly thread here. The history includes your submitted report and any authority messages or replies for this account.'
          : isAccountSurface
            ? 'Review your submitted anomaly thread here. The history includes your original report and any authority messages or replies for this account.'
            : 'Review your submitted election anomaly thread here. The history includes your original report and any authority messages or replies for this voter account.'
    : hasOwnerRegisteredThread
      ? 'This account registered an external claimant report. The thread below shows the submitted report plus authority history; if the authority opens a clarification request, reply here.'
    : hasPendingAnomalySubmission
      ? 'Your anomaly submission is being reconciled into the thread projection. This account cannot submit another anomaly while that is pending.'
      : isAuditorSurface
        ? 'Submit one election-workflow anomaly for this auditor account, then review the same thread here. This own-thread view stays separate from restricted review of all anomaly cases.'
        : isTrusteeSurface
          ? 'Submit one election-workflow anomaly for this trustee account, then review the same thread here. Anomaly intake does not mark KeyLost, block approvals, submit shares, or void the election.'
          : isOwnerSurface
            ? 'Submit one election-workflow anomaly for this owner account, then review the same thread here. This submitter view stays separate from owner authority triage and external claimant bridge handling.'
            : isAccountSurface
              ? 'Submit one election-workflow anomaly for this account, then review the same thread here. This is the submitter workspace, separate from authority triage.'
              : 'Submit one election-workflow anomaly for this voter account, then review the same thread here. Submitting an anomaly does not change, revoke, or void a ballot.';
  const newReportsLabel = hasThread
    ? 'Already submitted'
    : hasOwnerRegisteredThread
      ? 'Already registered'
    : hasPendingAnomalySubmission
      ? 'Blocked while indexing'
      : isSubmissionWindowOpen
        ? 'Open'
        : 'Closed';
  const newReportsClass = hasThread || hasOwnerRegisteredThread
    ? 'text-hush-text-primary'
    : hasPendingAnomalySubmission
      ? 'text-amber-100'
      : isSubmissionWindowOpen
        ? 'text-green-100'
        : 'text-amber-100';
  const panelTitle = isAuditorSurface
    ? hasThread ? 'My auditor anomaly thread' : 'Report an auditor anomaly'
    : isTrusteeSurface
      ? hasThread ? 'My trustee anomaly thread' : 'Report a trustee anomaly'
      : isOwnerSurface
        ? hasThread ? 'My owner anomaly thread' : 'Report an owner anomaly'
        : isAccountSurface
          ? hasThread
            ? 'My anomaly thread'
            : hasOwnerRegisteredThread
              ? 'Registered anomaly thread'
              : 'Report an anomaly'
          : hasThread ? 'My election anomaly thread' : 'Report an election anomaly';

  async function refreshOwnerRegisteredThread(): Promise<ElectionAnomalyOwnerTriageThreadView | null> {
    if (!isAccountSurface || !canReadThread) {
      setOwnerRegisteredThread(null);
      return null;
    }

    setIsLoadingOwnerRegisteredThread(true);
    try {
      const response = await electionsService.getElectionAnomalyOwnerTriage({
        ElectionId: electionId,
        ActorPublicAddress: actorPublicAddress,
      });
      const registeredThread =
        response.Success && response.HasTriage && response.Triage
          ? response.Triage.Threads.find((candidate) =>
            isRegisteredByCurrentAccountThread(candidate, actorPublicAddress)) ?? null
          : null;
      setOwnerRegisteredThread(registeredThread);
      return registeredThread;
    } catch {
      setOwnerRegisteredThread(null);
      return null;
    } finally {
      setIsLoadingOwnerRegisteredThread(false);
    }
  }

  async function refreshOwnThread(): Promise<void> {
    if (!canReadThread) {
      setOwnThread(null);
      setOwnerRegisteredThread(null);
      return;
    }

    setIsLoading(true);
    try {
      const response = await electionsService.getElectionAnomalyOwnThread({
        ElectionId: electionId,
        ActorPublicAddress: actorPublicAddress,
      });
      setOwnThread(response);
      if (response.Success) {
        setFeedback(null);
        if (response.HasThread) {
          clearPendingAnomalySubmission(electionId, actorPublicAddress);
          setPendingAnomalySubmission(null);
          setOwnerRegisteredThread(null);
        } else {
          await refreshOwnerRegisteredThread();
        }
      } else {
        setFeedback({
          tone: 'error',
          message: response.ErrorMessage || 'The anomaly thread could not be loaded.',
        });
      }
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'The anomaly thread could not be loaded.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    setPendingAnomalySubmission(loadPendingAnomalySubmission(electionId, actorPublicAddress));
    setSubmittedClarificationResponses(
      loadSubmittedClarificationResponses(electionId, actorPublicAddress),
    );
  }, [actorPublicAddress, electionId]);

  function markClarificationResponseSubmitted(responseKey: string): void {
    if (!responseKey) {
      return;
    }

    setSubmittedClarificationResponses((current) => {
      const next = new Set(current);
      next.add(responseKey);
      saveSubmittedClarificationResponses(electionId, actorPublicAddress, next);
      return next;
    });
  }

  useEffect(() => {
    void refreshOwnThread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorPublicAddress, canReadThread, electionId]);

  useEffect(() => {
    if (!hasThread) {
      return;
    }

    clearPendingAnomalySubmission(electionId, actorPublicAddress);
    setPendingAnomalySubmission(null);
  }, [actorPublicAddress, electionId, hasThread]);

  useEffect(() => {
    let isActive = true;

    async function decryptMessages(messages: ElectionAnomalyMessageView[]): Promise<void> {
      const next: Record<string, DecryptedMessage> = {};
      await Promise.all(
        messages.map(async (message) => {
          try {
            next[message.MessageId] = {
              status: 'decrypted',
              body: await decryptElectionAnomalyMessageBody(message, actorEncryptionPrivateKey),
            };
          } catch (error) {
            next[message.MessageId] = {
              status: 'failed',
              error:
                error instanceof Error
                  ? error.message
                  : 'This device does not have the key material needed to decrypt this message.',
            };
          }
        }),
      );

      if (isActive) {
        setDecryptedMessages(next);
      }
    }

    if (!thread?.Messages.length) {
      setDecryptedMessages({});
      return undefined;
    }

    void decryptMessages(thread.Messages);

    return () => {
      isActive = false;
    };
  }, [actorEncryptionPrivateKey, thread]);

  useEffect(() => {
    let isActive = true;

    async function decryptMessages(messages: ElectionAnomalyOwnerMessageView[]): Promise<void> {
      const next: Record<string, DecryptedMessage> = {};
      await Promise.all(
        messages.map(async (message) => {
          try {
            next[message.MessageId] = {
              status: 'decrypted',
              body: await decryptElectionAnomalyOwnerMessageBody(
                message,
                actorEncryptionPrivateKey,
              ),
            };
          } catch (error) {
            next[message.MessageId] = {
              status: 'failed',
              error:
                error instanceof Error
                  ? error.message
                  : 'This device does not have the key material needed to decrypt this message.',
            };
          }
        }),
      );

      if (isActive) {
        setOwnerRegisteredDecryptedMessages(next);
      }
    }

    if (!ownerRegisteredThread?.Messages.length) {
      setOwnerRegisteredDecryptedMessages({});
      return undefined;
    }

    void decryptMessages(ownerRegisteredThread.Messages);

    return () => {
      isActive = false;
    };
  }, [actorEncryptionPrivateKey, ownerRegisteredThread]);

  useEffect(() => {
    setClarificationEvidenceFiles([]);
    setEvidenceFeedback(null);
  }, [currentClarificationRequestId]);

  async function stageClarificationEvidenceFiles(files: File[]): Promise<void> {
    if (!currentClarificationRequestId || !thread?.AnomalyThreadId) {
      setEvidenceFeedback({
        tone: 'error',
        message: ELECTION_ANOMALY_VALIDATION_CODES.CLARIFICATION_REQUEST_NOT_OPEN,
      });
      return;
    }

    const remainingSlots =
      ELECTION_ANOMALY_SUBMITTER_CLARIFICATION_EVIDENCE_MAX_COUNT -
      clarificationEvidenceFiles.length;
    if (files.length > remainingSlots) {
      setEvidenceFeedback({
        tone: 'error',
        message: ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_COUNT_EXCEEDED,
      });
      return;
    }

    const totalBytes = clarificationEvidenceTotalBytes + files.reduce(
      (total, file) => total + file.size,
      0,
    );
    if (totalBytes > ELECTION_ANOMALY_SUBMITTER_CLARIFICATION_EVIDENCE_MAX_TOTAL_BYTES) {
      setEvidenceFeedback({
        tone: 'error',
        message: ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_SIZE_EXCEEDED,
      });
      return;
    }

    const nextItems = files.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
      file,
      status: 'encrypting' as const,
    }));
    setClarificationEvidenceFiles((current) => [...current, ...nextItems]);
    setEvidenceFeedback(null);

    await Promise.all(
      nextItems.map(async (item) => {
        try {
          if (!isAllowedClarificationEvidenceMimeType(item.file.type)) {
            throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_MIME_TYPE_INVALID);
          }

          if (
            item.file.size <= 0 ||
            item.file.size > ELECTION_ANOMALY_SUBMITTER_CLARIFICATION_EVIDENCE_MAX_BYTES
          ) {
            throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_SIZE_EXCEEDED);
          }

          const fileBytes = await readFileBytes(item.file);
          const restrictedPayload = await createElectionAnomalyRestrictedEvidencePayload(fileBytes);
          const encryptedPayload = restrictedPayload.EncryptedPayload;
          const contentKeyWraps = await createElectionAnomalySubmitterAttachmentContentKeyWraps({
            ActorPublicAddress: actorPublicAddress,
            ActorPublicEncryptAddress: actorEncryptionPublicKey,
            OwnerPublicAddress: ownerPublicAddress,
            ContentKey: restrictedPayload.ContentKey,
          });
          const draftMaterial = await prepareElectionAnomalyAttachmentManifestMaterial({
            Content: fileBytes,
            EncryptedPayload: encryptedPayload,
          });
          setClarificationEvidenceFiles((current) =>
            current.map((candidate) =>
              candidate.id === item.id
                ? {
                    ...candidate,
                    status: 'staging',
                  }
                : candidate,
            ),
          );

          const stageResponse = await electionsService.stageElectionAnomalyRestrictedPayload({
            ElectionId: electionId,
            ActorPublicAddress: actorPublicAddress,
            AnomalyThreadId: thread.AnomalyThreadId,
            AttachmentKindId: ELECTION_ANOMALY_ATTACHMENT_KIND_IDS.AUTHORITY_REQUESTED_EVIDENCE,
            EncryptedPayloadBase64: bytesToBase64(encryptedPayload),
            EncryptedPayloadHash: draftMaterial.EncryptedPayloadHash,
            ContentHash: draftMaterial.ContentHash,
            SizeBytes: draftMaterial.SizeBytes,
            MimeType: item.file.type,
            ClarificationRequestId: currentClarificationRequestId,
          });
          if (!stageResponse.Success) {
            throw new Error(
              stageResponse.ValidationCode ||
              stageResponse.ErrorMessage ||
              ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_PAYLOAD_REFERENCE_INVALID,
            );
          }

          if (
            !stageResponse.PayloadReference ||
            stageResponse.EncryptedPayloadHash !== draftMaterial.EncryptedPayloadHash ||
            stageResponse.ContentHash !== draftMaterial.ContentHash
          ) {
            throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_HASH_INVALID);
          }

          const material = await prepareElectionAnomalyAttachmentManifestMaterial({
            Content: fileBytes,
            EncryptedPayload: encryptedPayload,
            EncryptedPayloadReference: stageResponse.PayloadReference,
          });

          setClarificationEvidenceFiles((current) =>
            current.map((candidate) =>
              candidate.id === item.id
                ? {
                  ...candidate,
                  status: 'staged',
                  material,
                  contentKeyWraps,
                }
              : candidate,
            ),
          );
        } catch (error) {
          setClarificationEvidenceFiles((current) =>
            current.map((candidate) =>
              candidate.id === item.id
                ? {
                    ...candidate,
                    status: 'validation_rejected',
                    validationCode:
                      error instanceof Error
                        ? error.message
                        : ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_HASH_INVALID,
                  }
                : candidate,
            ),
          );
        }
      }),
    );
  }

  function handleClarificationEvidenceFileChange(files: FileList | null): void {
    const selectedFiles = Array.from(files ?? []);
    if (selectedFiles.length === 0) {
      return;
    }

    void stageClarificationEvidenceFiles(selectedFiles);
  }

  function removeClarificationEvidenceFile(fileId: string): void {
    setClarificationEvidenceFiles((current) =>
      current.filter((item) => item.id !== fileId),
    );
  }

  function clearClarificationEvidenceFiles(): void {
    setClarificationEvidenceFiles([]);
    setEvidenceFeedback(null);
  }

  async function handleSubmitThread(): Promise<void> {
    setFeedback(null);
    setIsSubmitting(true);
    try {
      const { signedTransaction, anomalyThreadId } = await createSubmitElectionAnomalyThreadTransaction({
        ElectionId: electionId,
        ActorPublicAddress: actorPublicAddress,
        ActorPublicEncryptAddress: actorEncryptionPublicKey,
        ActorPrivateEncryptKeyHex: actorEncryptionPrivateKey,
        OwnerPublicAddress: ownerPublicAddress,
        CategoryId: selectedCategoryId,
        Body: body,
        SigningPrivateKeyHex: actorSigningPrivateKey,
        ActorRoleContextId: isAuditorSurface
          ? ELECTION_ANOMALY_ACTOR_ROLE_CONTEXT_IDS.DESIGNATED_AUDITOR
          : isOwnerSurface
            ? ELECTION_ANOMALY_ACTOR_ROLE_CONTEXT_IDS.ELECTION_OWNER
            : isTrusteeSurface
              ? ELECTION_ANOMALY_ACTOR_ROLE_CONTEXT_IDS.TRUSTEE
              : undefined,
      });
      const submitResult = await submitTransaction(signedTransaction);
      if (
        !submitResult.successful &&
        submitResult.status !== TransactionStatus.ACCEPTED &&
        submitResult.status !== TransactionStatus.PENDING
      ) {
        if (hasElectionAnomalyDuplicateThreadValidation(submitResult)) {
          const refreshed = await waitForOwnThread(electionId, actorPublicAddress);
          if (refreshed) {
            setOwnThread(refreshed);
            clearPendingAnomalySubmission(electionId, actorPublicAddress);
            setPendingAnomalySubmission(null);
            setBody('');
            setFeedback({
              tone: 'warning',
              message: 'A report already exists for this account. Opening your thread.',
            });
            return;
          }

          const pendingSubmission = {
            anomalyThreadId: '',
            categoryId: selectedCategoryId,
            submittedAt: new Date().toISOString(),
          };
          savePendingAnomalySubmission(electionId, actorPublicAddress, pendingSubmission);
          setPendingAnomalySubmission(pendingSubmission);
          setBody('');
          setFeedback({
            tone: 'warning',
            message:
              'A report already exists or is still indexing for this account. This screen is blocking another anomaly until the thread loads.',
          });
          return;
        }

        throw new Error(submitResult.message || 'The anomaly report transaction was rejected.');
      }

      const pendingSubmission = {
        anomalyThreadId,
        categoryId: selectedCategoryId,
        submittedAt: new Date().toISOString(),
      };
      savePendingAnomalySubmission(electionId, actorPublicAddress, pendingSubmission);
      setPendingAnomalySubmission(pendingSubmission);

      const refreshed = await waitForOwnThread(electionId, actorPublicAddress);
      const didLoadThread = Boolean(refreshed);
      if (refreshed) {
        setOwnThread(refreshed);
        clearPendingAnomalySubmission(electionId, actorPublicAddress);
        setPendingAnomalySubmission(null);
      } else {
        await refreshOwnThread();
      }

      setBody('');
      setFeedback({
        tone: 'success',
        message: didLoadThread
          ? 'Anomaly report accepted. Opening your thread.'
          : 'Anomaly report accepted. The thread is still indexing, so another anomaly is blocked on this device.',
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'The anomaly report could not be submitted.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitClarification(): Promise<void> {
    if (!thread || !currentClarificationRequestId) {
      return;
    }

    const submittedResponseKey = currentClarificationResponseKey;
    setFeedback(null);
    setEvidenceFeedback(null);
    setIsSubmittingClarification(true);
    try {
      for (let index = 0; index < stagedClarificationEvidence.length; index += 1) {
        const evidence = stagedClarificationEvidence[index];
        if (!evidence.material) {
          continue;
        }

        setClarificationEvidenceFiles((current) =>
          current.map((item) =>
            item.id === evidence.id
              ? {
                  ...item,
                  status: 'submitting',
                }
              : item,
          ),
        );

        const { signedTransaction } = await createRecordElectionAnomalyAttachmentManifestTransaction({
          ElectionId: electionId,
          AnomalyThreadId: thread.AnomalyThreadId,
          ActorPublicAddress: actorPublicAddress,
          ActorPublicEncryptAddress: actorEncryptionPublicKey,
          ActorPrivateEncryptKeyHex: actorEncryptionPrivateKey,
          SigningPrivateKeyHex: actorSigningPrivateKey,
          AttachmentKindId: ELECTION_ANOMALY_ATTACHMENT_KIND_IDS.AUTHORITY_REQUESTED_EVIDENCE,
          EncryptedPayloadReference: evidence.material.EncryptedPayloadReference,
          EncryptedPayloadHash: evidence.material.EncryptedPayloadHash,
          ContentHash: evidence.material.ContentHash,
          SizeBytes: evidence.material.SizeBytes,
          MimeType: evidence.file.type,
          ValidationStatusId: ELECTION_ANOMALY_ATTACHMENT_VALIDATION_STATUS_IDS.PENDING_SCAN,
          ClarificationRequestId: currentClarificationRequestId,
          ContentKeyWraps: evidence.contentKeyWraps,
          ExistingAttachmentManifestCount: index,
          ExistingAttachmentManifestTotalBytes: stagedClarificationEvidence
            .slice(0, index)
            .reduce((total, item) => total + (item.material?.SizeBytes ?? item.file.size), 0),
        });
        const manifestResult = await submitTransaction(signedTransaction);
        if (
          !manifestResult.successful &&
          manifestResult.status !== TransactionStatus.ACCEPTED &&
          manifestResult.status !== TransactionStatus.PENDING
        ) {
          const rejectedAsQuarantined = /quarantin/i.test(manifestResult.message ?? '');
          setClarificationEvidenceFiles((current) =>
            current.map((item) =>
              item.id === evidence.id
                ? {
                    ...item,
                    status: rejectedAsQuarantined ? 'quarantined' : 'validation_rejected',
                    validationCode: manifestResult.message || 'The evidence manifest was rejected.',
                  }
                : item,
            ),
          );
          throw new Error(manifestResult.message || 'The evidence manifest was rejected.');
        }

        setClarificationEvidenceFiles((current) =>
          current.map((item) =>
            item.id === evidence.id
              ? {
                  ...item,
                  status: manifestResult.status === TransactionStatus.PENDING
                    ? 'scanner_pending'
                    : 'accepted',
                }
              : item,
          ),
        );
      }

      const { signedTransaction } = await createSubmitElectionAnomalyInformationTransaction({
        ElectionId: electionId,
        AnomalyThreadId: thread.AnomalyThreadId,
        ClarificationRequestId: currentClarificationRequestId,
        ActorPublicAddress: actorPublicAddress,
        ActorPublicEncryptAddress: actorEncryptionPublicKey,
        ActorPrivateEncryptKeyHex: actorEncryptionPrivateKey,
        OwnerPublicAddress: ownerPublicAddress,
        Body: clarificationBody,
        SigningPrivateKeyHex: actorSigningPrivateKey,
      });
      const submitResult = await submitTransaction(signedTransaction);
      if (
        !submitResult.successful &&
        submitResult.status !== TransactionStatus.ACCEPTED &&
        submitResult.status !== TransactionStatus.PENDING
      ) {
        throw new Error(submitResult.message || 'The clarification response was rejected.');
      }

      markClarificationResponseSubmitted(submittedResponseKey);
      await refreshOwnThread();
      setClarificationBody('');
      setClarificationEvidenceFiles((current) =>
        current.map((item) => ({
          ...item,
          status: item.status === 'accepted' ? 'scanner_pending' : item.status,
        })),
      );
      setFeedback({
        tone: 'success',
        message: stagedClarificationEvidence.length > 0
          ? 'Clarification response and evidence manifests accepted. Scanner status remains pending until restricted evidence checks finish.'
          : 'Clarification response accepted. The thread has been refreshed.',
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error ? error.message : 'The clarification response could not be submitted.',
      });
    } finally {
      setIsSubmittingClarification(false);
    }
  }

  async function handleSubmitOwnerRegisteredClarification(): Promise<void> {
    if (!ownerRegisteredThread || !ownerRegisteredCurrentClarificationRequestId) {
      return;
    }

    const submittedResponseKey = ownerRegisteredClarificationResponseKey;
    setFeedback(null);
    setOwnerRegisteredClarificationFeedback(null);
    setEvidenceFeedback(null);
    setIsSubmittingClarification(true);
    try {
      const { signedTransaction } = await createSubmitElectionAnomalyInformationTransaction({
        ElectionId: electionId,
        AnomalyThreadId: ownerRegisteredThread.AnomalyThreadId,
        ClarificationRequestId: ownerRegisteredCurrentClarificationRequestId,
        ActorPublicAddress: actorPublicAddress,
        ActorPublicEncryptAddress: actorEncryptionPublicKey,
        ActorPrivateEncryptKeyHex: actorEncryptionPrivateKey,
        OwnerPublicAddress: ownerPublicAddress,
        Body: clarificationBody,
        SigningPrivateKeyHex: actorSigningPrivateKey,
      });
      const submitResult = await submitTransaction(signedTransaction);
      if (
        !submitResult.successful &&
        submitResult.status !== TransactionStatus.ACCEPTED &&
        submitResult.status !== TransactionStatus.PENDING
      ) {
        throw new Error(submitResult.message || 'The clarification response was rejected.');
      }

      markClarificationResponseSubmitted(submittedResponseKey);
      await refreshOwnThread();
      setClarificationBody('');
      setOwnerRegisteredClarificationFeedback({
        tone: 'success',
        message: 'Clarification response accepted. The registered report thread has been refreshed.',
      });
      setFeedback({
        tone: 'success',
        message: 'Clarification response accepted. The registered report thread has been refreshed.',
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'The clarification response could not be submitted.';
      setOwnerRegisteredClarificationFeedback({
        tone: 'error',
        message,
      });
      setFeedback({
        tone: 'error',
        message,
      });
    } finally {
      setIsSubmittingClarification(false);
    }
  }

  return (
    <section className="rounded-3xl bg-hush-bg-element/90 px-6 py-5 shadow-lg shadow-black/10" data-testid="election-anomaly-panel">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-4xl">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            <FileWarning className="h-4 w-4" />
            <span>Anomaly reporting</span>
          </div>
          <h2 className="mt-3 text-xl font-semibold text-hush-text-primary">
            {panelTitle}
          </h2>
          <p className="mt-3 text-sm leading-7 text-hush-text-accent">
            {introCopy}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshOwnThread()}
          disabled={isLoading || !canReadThread}
          className="inline-flex self-start items-center gap-2 rounded-xl bg-hush-bg-dark/80 px-4 py-2.5 text-sm font-medium text-hush-text-primary transition-colors hover:bg-hush-bg-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="election-anomaly-refresh"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          <span>Refresh</span>
        </button>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl bg-hush-bg-dark/72 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
            Thread
          </div>
          <div className="mt-2 text-sm font-semibold text-hush-text-primary">
            {hasThread
              ? 'Existing report'
              : hasOwnerRegisteredThread
                ? 'Registered report'
              : hasPendingAnomalySubmission
                ? 'Submission pending'
                : 'No report yet'}
          </div>
        </div>
        <div className="rounded-2xl bg-hush-bg-dark/72 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
            New reports
          </div>
          <div className={`mt-2 text-sm font-semibold ${newReportsClass}`}>
            {newReportsLabel}
          </div>
        </div>
        <div className="rounded-2xl bg-hush-bg-dark/72 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
            Lifecycle
          </div>
          <div className="mt-2 text-sm font-semibold text-hush-text-primary">
            {lifecycleState === ElectionLifecycleStateProto.Open
              ? isTrusteeSurface || isOwnerSurface || isAccountSurface
                ? 'Election open'
                : 'Voting open'
              : 'Review available'}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl bg-amber-500/10 px-4 py-4 text-sm leading-7 text-amber-100">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-1 h-4 w-4 shrink-0" />
          <div>
            Owner and restricted auditors can read the anomaly body. Free text can identify you.
            Auditor views in v1 do not intentionally expose actor names or direct actor references.
          </div>
        </div>
      </div>

      {feedback ? (
        <div
          className={`mt-5 rounded-2xl px-4 py-3 text-sm ${
            feedback.tone === 'success'
              ? 'bg-green-500/10 text-green-100'
              : feedback.tone === 'warning'
                ? 'bg-amber-500/10 text-amber-100'
                : 'bg-red-500/10 text-red-100'
          }`}
          data-testid="election-anomaly-feedback"
        >
          {feedback.message}
        </div>
      ) : null}

      {!canReadThread ? (
        <div className="mt-5 rounded-2xl bg-hush-bg-dark/72 px-5 py-5">
          <div className="text-sm font-semibold text-hush-text-primary">
            {noAccessTitle}
          </div>
          <p className="mt-2 text-sm leading-7 text-hush-text-accent">
            {noAccessDescription}
          </p>
          {noAccessActionHref && noAccessActionLabel ? (
            <Link
              href={noAccessActionHref}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple"
            >
              <LockKeyhole className="h-4 w-4" />
              <span>{noAccessActionLabel}</span>
            </Link>
          ) : null}
        </div>
      ) : null}

      {canReadThread && isLoading && !ownThread ? (
        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-hush-bg-dark/72 px-5 py-5 text-sm text-hush-text-accent">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading anomaly thread...</span>
        </div>
      ) : null}

      {canReadThread && !hasThread && isLoadingOwnerRegisteredThread ? (
        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-hush-bg-dark/72 px-5 py-5 text-sm text-hush-text-accent">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Checking registered claimant reports...</span>
        </div>
      ) : null}

      {canReadThread && !canCreateNewThreadForActor && !hasThread && !hasOwnerRegisteredThread && !isLoading ? (
        <div className="mt-5 rounded-2xl bg-hush-bg-dark/72 px-5 py-5" data-testid="election-anomaly-create-unavailable">
          <div className="text-sm font-semibold text-hush-text-primary">{noAccessTitle}</div>
          <p className="mt-2 text-sm leading-7 text-hush-text-accent">{noAccessDescription}</p>
        </div>
      ) : null}

      {canReadThread && hasPendingAnomalySubmission && !hasThread ? (
        <div
          className="mt-5 rounded-2xl bg-hush-bg-dark/72 px-5 py-5"
          data-testid="election-anomaly-pending"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-sm font-semibold text-hush-text-primary">
                Report submitted from this device
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-hush-text-accent">
                The transaction is accepted or pending, but the own-thread projection has not loaded yet.
                This account cannot submit a second anomaly while it reconciles.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refreshOwnThread()}
              disabled={isLoading}
              className="inline-flex self-start items-center gap-2 rounded-xl bg-hush-bg-element/80 px-4 py-2.5 text-sm font-medium text-hush-text-primary transition-colors hover:bg-hush-bg-element focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              <span>Check status</span>
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-hush-bg-element/70 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                Category
              </div>
              <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                {categoryLabel(pendingAnomalySubmission?.categoryId ?? '')}
              </div>
            </div>
            <div className="rounded-xl bg-hush-bg-element/70 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                Submitted
              </div>
              <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                {formatIsoTimestamp(pendingAnomalySubmission?.submittedAt ?? '')}
              </div>
            </div>
            <div className="rounded-xl bg-hush-bg-element/70 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                Thread
              </div>
              <div className="mt-2 break-all text-sm font-semibold text-hush-text-primary">
                {pendingAnomalySubmission?.anomalyThreadId || 'Indexing'}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {canReadThread && canSubmitNewThread ? (
        <div className="mt-5 rounded-2xl bg-hush-bg-dark/72 px-5 py-5" data-testid="election-anomaly-create">
          <div className="text-sm font-semibold text-hush-text-primary">Submit one anomaly report</div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {ANOMALY_CATEGORY_OPTIONS.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategoryId(category.id)}
                className={`min-h-12 rounded-2xl px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple ${
                  selectedCategoryId === category.id
                    ? 'bg-hush-purple text-white'
                    : 'bg-hush-bg-element/80 text-hush-text-primary hover:bg-hush-bg-element'
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>

          <label className="mt-5 block text-sm font-medium text-hush-text-primary" htmlFor="election-anomaly-body">
            What happened?
          </label>
          <textarea
            id="election-anomaly-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={ELECTION_ANOMALY_BODY_MAX_CHARACTERS}
            rows={6}
            className={`mt-2 ${ANOMALY_TEXTAREA_CLASS}`}
            placeholder="Describe the election-workflow issue. Do not include secrets or unnecessary personal details."
          />
          <div className="mt-2 flex flex-col gap-3 text-sm text-hush-text-accent sm:flex-row sm:items-center sm:justify-between">
            <span>{bodyCharacterCount}/{ELECTION_ANOMALY_BODY_MAX_CHARACTERS} characters</span>
            <button
              type="button"
              onClick={() => void handleSubmitThread()}
              disabled={isSubmitting || bodyCharacterCount === 0 || bodyCharacterCount > ELECTION_ANOMALY_BODY_MAX_CHARACTERS}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-hush-purple px-4 py-2.5 font-medium text-white transition-colors hover:bg-hush-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="election-anomaly-submit"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span>Submit anomaly</span>
            </button>
          </div>
        </div>
      ) : null}

      {canReadThread && !hasThread && !hasOwnerRegisteredThread && !isSubmissionWindowOpen ? (
        <div className="mt-5 rounded-2xl bg-hush-bg-dark/72 px-5 py-5 text-sm leading-7 text-hush-text-accent" data-testid="election-anomaly-window-closed">
          New anomaly reports are closed for this election. Existing own-thread review remains
          available after submission closes.
          {submissionWindowMillis ? (
            <span> Closed at {formatTimestamp(anomalySubmissionWindowClosesAt)}.</span>
          ) : null}
        </div>
      ) : null}

      {hasOwnerRegisteredThread && ownerRegisteredThread ? (
        <div
          className="mt-5 space-y-4"
          data-testid="election-anomaly-owner-registered-thread"
        >
          <div className="rounded-2xl bg-hush-bg-dark/72 px-5 py-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-sm font-semibold text-hush-text-primary">
                  External claimant report registered by this account
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-hush-text-accent">
                  This report was registered through the external claimant intake. It is not a
                  separate personal account anomaly, but this account registered it and can read or
                  answer its thread here without authority classification controls.
                </p>
              </div>
              <div className="text-sm text-hush-text-accent">
                Updated {formatTimestamp(ownerRegisteredThread.UpdatedAt)}
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl bg-hush-bg-element/70 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Category
                </div>
                <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                  {categoryLabel(ownerRegisteredThread.CategoryId)}
                </div>
              </div>
              <div className="rounded-xl bg-hush-bg-element/70 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  State
                </div>
                <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                  {resolvedThreadStateLabel(
                    ownerRegisteredThread.CaseStateId,
                    ownerRegisteredThread.HasOpenClarificationRequest,
                    ownerRegisteredHasAuthorityInformationRequest,
                    ownerRegisteredHasSubmitterInformationResponse,
                    ownerRegisteredHasAuthorityResponse,
                  )}
                </div>
              </div>
              <div className="rounded-xl bg-hush-bg-element/70 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Thread
                </div>
                <div className="mt-2 break-all text-sm font-semibold text-hush-text-primary">
                  {ownerRegisteredThread.AnomalyThreadId}
                </div>
              </div>
            </div>
            <div
              className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
              data-testid="election-anomaly-owner-registered-state-timeline"
            >
              <div className="rounded-xl bg-hush-bg-element/70 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Initial report
                </div>
                <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                  Submitted
                </div>
              </div>
              <div className="rounded-xl bg-hush-bg-element/70 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Authority request
                </div>
                <div className={`mt-2 text-sm font-semibold ${
                  ownerRegisteredThread.HasOpenClarificationRequest
                    ? 'text-amber-100'
                    : 'text-hush-text-primary'
                }`}
                >
                  {ownerRegisteredThread.HasOpenClarificationRequest
                    ? 'Open in authority handling'
                    : ownerRegisteredHasAuthorityInformationRequest
                      ? 'Answered or closed'
                      : 'Not requested'}
                </div>
              </div>
              <div className="rounded-xl bg-hush-bg-element/70 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Submitter reply
                </div>
                <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                  {ownerRegisteredHasSubmitterInformationResponse ? 'Provided' : 'Not yet'}
                </div>
              </div>
              <div className="rounded-xl bg-hush-bg-element/70 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Authority response
                </div>
                <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                  {ownerRegisteredHasAuthorityResponse ? 'Recorded' : 'Not yet'}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1 px-1">
            <div className="text-sm font-semibold text-hush-text-primary">Thread history</div>
            <div className="text-sm leading-6 text-hush-text-accent">
              {ownerRegisteredThread.Messages.length === 1
                ? '1 thread message is available.'
                : `${ownerRegisteredThread.Messages.length} thread messages are available.`}
            </div>
          </div>

          {ownerRegisteredThread.Messages.map((message) => {
            const decrypted = ownerRegisteredDecryptedMessages[message.MessageId];
            return (
              <div key={message.MessageId} className={threadMessageContainerClass(message.MessageKindId)}>
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-hush-text-primary">
                      {messageKindLabel(message.MessageKindId, surface)}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-hush-text-accent">
                      {formatTimestamp(message.RecordedAt)}
                    </div>
                  </div>
                  {message.HasClarificationRequest ? (
                    <div className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-100">
                      Clarification linked
                    </div>
                  ) : null}
                </div>
                {decrypted?.status === 'decrypted' ? (
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-hush-text-primary">
                    {decrypted.body}
                  </p>
                ) : decrypted?.status === 'failed' ? (
                  <div className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-100">
                    This device does not have the key material needed to decrypt this message.
                  </div>
                ) : (
                  <div className="mt-4 flex items-center gap-2 text-sm text-hush-text-accent">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Decrypting message...</span>
                  </div>
                )}
              </div>
            );
          })}

          {canSubmitOwnerRegisteredClarification ? (
            <div
              className="rounded-2xl bg-hush-bg-dark/72 px-5 py-5"
              data-testid="election-anomaly-owner-registered-clarification"
            >
              <div className="text-sm font-semibold text-hush-text-primary">Clarification requested</div>
              <p className="mt-2 text-sm leading-7 text-hush-text-accent">
                Reply only to the open authority request for this registered report. This is not a
                general chat composer.
              </p>
              <textarea
                value={clarificationBody}
                onChange={(event) => setClarificationBody(event.target.value)}
                maxLength={ELECTION_ANOMALY_BODY_MAX_CHARACTERS}
                rows={5}
                className={`mt-4 ${ANOMALY_TEXTAREA_CLASS}`}
                placeholder="Answer the specific clarification request."
                aria-label="Registered claimant clarification response body"
              />
              <div className="mt-2 flex flex-col gap-3 text-sm text-hush-text-accent sm:flex-row sm:items-center sm:justify-between">
                <span>{clarificationCharacterCount}/{ELECTION_ANOMALY_BODY_MAX_CHARACTERS} characters</span>
                <button
                  type="button"
                  onClick={() => void handleSubmitOwnerRegisteredClarification()}
                  disabled={
                    isSubmittingClarification ||
                    clarificationCharacterCount === 0 ||
                    clarificationCharacterCount > ELECTION_ANOMALY_BODY_MAX_CHARACTERS
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-hush-purple px-4 py-2.5 font-medium text-white transition-colors hover:bg-hush-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="election-anomaly-owner-registered-submit-clarification"
                >
                  {isSubmittingClarification ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span>{isSubmittingClarification ? 'Submitting...' : 'Submit clarification'}</span>
                </button>
              </div>
              {ownerRegisteredClarificationFeedback ? (
                <div
                  className={`mt-3 rounded-xl px-4 py-3 text-sm ${
                    ownerRegisteredClarificationFeedback.tone === 'success'
                      ? 'bg-green-500/10 text-green-100'
                      : ownerRegisteredClarificationFeedback.tone === 'warning'
                        ? 'bg-amber-500/10 text-amber-100'
                        : 'bg-red-500/10 text-red-100'
                  }`}
                  data-testid="election-anomaly-owner-registered-clarification-feedback"
                >
                  {ownerRegisteredClarificationFeedback.message}
                </div>
              ) : null}
            </div>
          ) : ownerRegisteredHasSubmittedClarificationResponse ? (
            <div
              className="rounded-2xl bg-green-500/10 px-5 py-4 text-sm text-green-100"
              data-testid="election-anomaly-owner-registered-clarification-submitted"
            >
              <div className="font-semibold">Clarification response submitted</div>
              <p className="mt-2 leading-7">
                The response was accepted by the blockchain. This request is now closed for this
                device while the registered report thread refreshes.
              </p>
            </div>
          ) : ownerRegisteredThread.HasOpenClarificationRequest ? (
            <div className="rounded-2xl bg-red-500/10 px-5 py-4 text-sm text-red-100">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>The open clarification request is missing a usable request id on this device.</span>
              </div>
            </div>
          ) : (
            <div
              className="rounded-2xl bg-hush-bg-dark/72 px-5 py-4 text-sm text-hush-text-accent"
              data-testid="election-anomaly-owner-registered-no-action"
            >
              <div className="font-semibold text-hush-text-primary">No open clarification request</div>
              <p className="mt-2 leading-7">
                {ownerRegisteredHasAwaitingStateWithoutRequest
                  ? 'This thread was marked as awaiting information without a clarification request transaction. Authority responses are read-only here; the authority must use Request clarification in owner triage to open a reply box.'
                  : 'Authority classification and official handling stay in owner triage; this workspace shows the registered report and thread history.'}
              </p>
            </div>
          )}
        </div>
      ) : null}

      {hasThread && thread ? (
        <div className="mt-5 space-y-4" data-testid="election-anomaly-thread">
          <div className="rounded-2xl bg-hush-bg-dark/72 px-5 py-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-sm font-semibold text-hush-text-primary">
                  Your anomaly is registered
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-hush-text-accent">
                  This is the anomaly thread for this account. It starts with your submitted report
                  and then lists any authority messages and replies in order. A response box appears
                  only if the authority opens a clarification request.
                </p>
              </div>
              <div className="text-sm text-hush-text-accent">
                Updated {formatTimestamp(thread.UpdatedAt)}
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl bg-hush-bg-element/70 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Category
                </div>
                <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                  {categoryLabel(thread.CategoryId)}
                </div>
              </div>
              <div className="rounded-xl bg-hush-bg-element/70 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  State
                </div>
                <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                  {resolvedThreadStateLabel(
                    thread.CaseStateId,
                    thread.HasOpenClarificationRequest,
                    hasAuthorityInformationRequest,
                    hasSubmitterInformationResponse,
                    hasAuthorityResponse,
                  )}
                </div>
              </div>
              <div className="rounded-xl bg-hush-bg-element/70 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Thread
                </div>
                <div className="mt-2 break-all text-sm font-semibold text-hush-text-primary">
                  {thread.AnomalyThreadId}
                </div>
              </div>
            </div>
            <div
              className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
              data-testid="election-anomaly-state-timeline"
            >
              <div className="rounded-xl bg-hush-bg-element/70 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Initial report
                </div>
                <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                  Submitted
                </div>
              </div>
              <div className="rounded-xl bg-hush-bg-element/70 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Authority request
                </div>
                <div className={`mt-2 text-sm font-semibold ${
                  thread.HasOpenClarificationRequest ? 'text-amber-100' : 'text-hush-text-primary'
                }`}
                >
                  {thread.HasOpenClarificationRequest
                    ? 'Waiting for my reply'
                    : hasAuthorityInformationRequest
                      ? 'Answered or closed'
                      : 'Not requested'}
                </div>
              </div>
              <div className="rounded-xl bg-hush-bg-element/70 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  My reply
                </div>
                <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                  {hasSubmitterInformationResponse ? 'Provided' : 'Not yet'}
                </div>
              </div>
              <div className="rounded-xl bg-hush-bg-element/70 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                  Authority response
                </div>
                <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                  {hasAuthorityResponse ? 'Recorded' : 'Not yet'}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1 px-1">
            <div className="text-sm font-semibold text-hush-text-primary">Thread history</div>
            <div className="text-sm leading-6 text-hush-text-accent">
              {thread.Messages.length === 1
                ? '1 thread message is available.'
                : `${thread.Messages.length} thread messages are available.`}
            </div>
          </div>

          {thread.Messages.map((message) => {
            const decrypted = decryptedMessages[message.MessageId];
            return (
              <div key={message.MessageId} className={threadMessageContainerClass(message.MessageKindId)}>
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-hush-text-primary">
                      {messageKindLabel(message.MessageKindId, surface)}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-hush-text-accent">
                      {formatTimestamp(message.RecordedAt)}
                    </div>
                  </div>
                  {message.HasClarificationRequest ? (
                    <div className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-100">
                      Clarification linked
                    </div>
                  ) : null}
                </div>
                {decrypted?.status === 'decrypted' ? (
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-hush-text-primary">
                    {decrypted.body}
                  </p>
                ) : decrypted?.status === 'failed' ? (
                  <div className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-100">
                    This device does not have the key material needed to decrypt this message.
                  </div>
                ) : (
                  <div className="mt-4 flex items-center gap-2 text-sm text-hush-text-accent">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Decrypting message...</span>
                  </div>
                )}
              </div>
            );
          })}

          {canSubmitClarification ? (
            <div className="rounded-2xl bg-hush-bg-dark/72 px-5 py-5" data-testid="election-anomaly-clarification">
              <div className="text-sm font-semibold text-hush-text-primary">Clarification requested</div>
              <p className="mt-2 text-sm leading-7 text-hush-text-accent">
                Reply only to the open authority request. This is not a general chat composer.
              </p>
              <textarea
                value={clarificationBody}
                onChange={(event) => setClarificationBody(event.target.value)}
                maxLength={ELECTION_ANOMALY_BODY_MAX_CHARACTERS}
                rows={5}
                className={`mt-4 ${ANOMALY_TEXTAREA_CLASS}`}
                placeholder="Answer the specific clarification request."
                aria-label="Clarification response body"
              />
              <div
                className="mt-4 rounded-2xl bg-hush-bg-element/60 px-4 py-4"
                data-testid="election-anomaly-clarification-evidence"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-hush-text-primary">
                      <Paperclip className="h-4 w-4 text-hush-text-accent" />
                      <span>Restricted evidence</span>
                    </div>
                    <p className="mt-2 max-w-3xl text-sm leading-7 text-hush-text-accent">
                      Attachments are encrypted restricted evidence for this authority request.
                      Owner and restricted auditors may be able to read evidence where wraps are available.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearClarificationEvidenceFiles}
                    disabled={isSubmittingClarification || clarificationEvidenceFiles.length === 0}
                    className="inline-flex self-start items-center gap-2 rounded-xl bg-hush-bg-dark/72 px-3 py-2 text-xs font-medium text-hush-text-primary transition-colors hover:bg-hush-bg-dark disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    <span>Clear</span>
                  </button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl bg-hush-bg-dark/72 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                      Policy
                    </div>
                    <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                      Request-bound
                    </div>
                  </div>
                  <div className="rounded-2xl bg-hush-bg-dark/72 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                      Remaining
                    </div>
                    <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                      {clarificationEvidenceFiles.length} of{' '}
                      {ELECTION_ANOMALY_SUBMITTER_CLARIFICATION_EVIDENCE_MAX_COUNT} attached
                    </div>
                  </div>
                  <div className="rounded-2xl bg-hush-bg-dark/72 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                      Accepted types
                    </div>
                    <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                      {CLARIFICATION_EVIDENCE_ACCEPTED_MIME_LABELS}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-hush-bg-dark/72 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                      Scanner
                    </div>
                    <div className="mt-2 text-sm font-semibold text-amber-100">
                      Required
                    </div>
                  </div>
                </div>

                <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-hush-bg-dark/72 px-4 py-2.5 text-sm font-medium text-hush-text-primary transition-colors hover:bg-hush-bg-dark focus-within:ring-2 focus-within:ring-hush-purple">
                  <FileUp className="h-4 w-4" />
                  <span>Choose files</span>
                  <input
                    type="file"
                    multiple
                    className="sr-only"
                    accept={ELECTION_ANOMALY_EVIDENCE_MIME_TYPE_VALUES.join(',')}
                    disabled={isSubmittingClarification || hasEvidenceInProgress}
                    aria-label="Choose clarification evidence files"
                    onChange={(event) => {
                      handleClarificationEvidenceFileChange(event.target.files);
                      event.target.value = '';
                    }}
                  />
                </label>

                {evidenceFeedback ? (
                  <div
                    className={`mt-4 rounded-xl px-4 py-3 text-sm ${
                      evidenceFeedback.tone === 'success'
                        ? 'bg-green-500/10 text-green-100'
                        : evidenceFeedback.tone === 'warning'
                          ? 'bg-amber-500/10 text-amber-100'
                          : 'bg-red-500/10 text-red-100'
                    }`}
                    data-testid="election-anomaly-evidence-feedback"
                  >
                    {evidenceFeedback.message}
                  </div>
                ) : null}

                {clarificationEvidenceFiles.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {clarificationEvidenceFiles.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col gap-3 rounded-xl bg-hush-bg-dark/72 px-4 py-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="break-all text-sm font-medium text-hush-text-primary">
                            {item.file.name}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-hush-text-accent">
                            <span>{formatEvidenceSize(item.file.size)}</span>
                            <span>{item.file.type || 'application/octet-stream'}</span>
                            {item.material?.ContentHash ? (
                              <span className="break-all font-mono">
                                {item.material.ContentHash}
                              </span>
                            ) : null}
                          </div>
                          {item.validationCode ? (
                            <div className="mt-2 text-xs text-red-100">
                              {item.validationCode}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${evidenceStatusClass(item.status)}`}
                          >
                            {evidenceStatusLabel(item.status)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeClarificationEvidenceFile(item.id)}
                            disabled={isSubmittingClarification || item.status === 'submitting'}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-hush-bg-element text-hush-text-primary transition-colors hover:bg-hush-bg-element/80 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Remove ${item.file.name}`}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl bg-hush-bg-dark/72 px-4 py-3 text-sm text-hush-text-accent">
                    No evidence files selected.
                  </div>
                )}
              </div>
              <div className="mt-2 flex flex-col gap-3 text-sm text-hush-text-accent sm:flex-row sm:items-center sm:justify-between">
                <span>{clarificationCharacterCount}/{ELECTION_ANOMALY_BODY_MAX_CHARACTERS} characters</span>
                <button
                  type="button"
                  onClick={() => void handleSubmitClarification()}
                  disabled={
                    isSubmittingClarification ||
                    hasEvidenceInProgress ||
                    hasRejectedEvidence ||
                    clarificationCharacterCount === 0 ||
                    clarificationCharacterCount > ELECTION_ANOMALY_BODY_MAX_CHARACTERS
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-hush-purple px-4 py-2.5 font-medium text-white transition-colors hover:bg-hush-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="election-anomaly-submit-clarification"
                >
                  {isSubmittingClarification ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span>Submit clarification</span>
                </button>
              </div>
            </div>
          ) : hasSubmittedClarificationResponse ? (
            <div
              className="rounded-2xl bg-green-500/10 px-5 py-4 text-sm text-green-100"
              data-testid="election-anomaly-clarification-submitted"
            >
              <div className="font-semibold">Clarification response submitted</div>
              <p className="mt-2 leading-7">
                The response was accepted by the blockchain. This request is now closed for this
                device while the anomaly thread refreshes.
              </p>
            </div>
          ) : thread.HasOpenClarificationRequest ? (
            <div className="rounded-2xl bg-red-500/10 px-5 py-4 text-sm text-red-100">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>The open clarification request is missing a usable request id on this device.</span>
              </div>
            </div>
          ) : (
            <div
              className="rounded-2xl bg-hush-bg-dark/72 px-5 py-4 text-sm text-hush-text-accent"
              data-testid="election-anomaly-no-action"
            >
              <div className="font-semibold text-hush-text-primary">No open clarification request</div>
              <p className="mt-2 leading-7">
                {hasAwaitingStateWithoutRequest
                  ? 'This thread was marked as awaiting information without a clarification request transaction. Authority responses are read-only here; the authority must use Request clarification to open a reply box.'
                  : 'The thread above is the complete history currently available to this account.'}
              </p>
            </div>
          )}
        </div>
      ) : null}

      {ownThread && !ownThread.Success ? (
        <div className="mt-5 rounded-2xl bg-red-500/10 px-5 py-4 text-sm text-red-100">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{ownThread.ErrorMessage || 'Anomaly thread access was denied or unavailable.'}</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
