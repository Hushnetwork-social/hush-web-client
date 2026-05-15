"use client";

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  FileWarning,
  FileUp,
  Filter,
  KeyRound,
  Loader2,
  Paperclip,
  RefreshCcw,
  Send,
  ShieldAlert,
  X,
} from 'lucide-react';
import {
  ElectionReportAccessGrantRoleProto,
  TransactionStatus,
  type ElectionAnomalyOwnerMessageView,
  type ElectionAnomalyOwnerTriageThreadView,
  type ElectionReportAccessGrantView,
  type GetElectionAnomalyOwnerTriageResponse,
  type GrpcTimestamp,
} from '@/lib/grpc';
import { bytesToBase64 } from '@/lib/crypto';
import { electionsService } from '@/lib/grpc/services/elections';
import { identityService } from '@/lib/grpc/services/identity';
import { submitTransaction } from '@/modules/blockchain/BlockchainService';
import {
  AnomalyEvidenceManifestStatusPanel,
  type AnomalyEvidenceRedactionSubmitInput,
} from './AnomalyEvidenceManifestStatusPanel';
import { getLifecycleLabel } from './contracts';
import { sectionClass } from './HushVotingWorkspaceShared';
import {
  ELECTION_ANOMALY_ATTACHMENT_KIND_IDS,
  ELECTION_ANOMALY_ATTACHMENT_VALIDATION_STATUS_IDS,
  ELECTION_ANOMALY_AUTHORITY_EVIDENCE_MAX_BYTES,
  ELECTION_ANOMALY_AUTHORITY_EVIDENCE_MAX_COUNT,
  ELECTION_ANOMALY_AUTHORITY_EVIDENCE_MAX_TOTAL_BYTES,
  ELECTION_ANOMALY_CASE_STATE_IDS,
  ELECTION_ANOMALY_CATEGORY_IDS,
  ELECTION_ANOMALY_CLARIFICATION_BODY_MAX_CHARACTERS,
  ELECTION_ANOMALY_EVIDENCE_MIME_TYPE_VALUES,
  ELECTION_ANOMALY_MESSAGE_KIND_IDS,
  ELECTION_ANOMALY_RECIPIENT_ROLE_IDS,
  ELECTION_ANOMALY_RECIPIENT_WRAP_STATUS_IDS,
  ELECTION_ANOMALY_REDACTION_TARGET_KIND_IDS,
  ELECTION_ANOMALY_SEVERITY_CANDIDATE_IDS,
  ELECTION_ANOMALY_VALIDATION_CODES,
  createClassifyElectionAnomalyThreadTransaction,
  createElectionAnomalyOwnerAttachmentContentKeyWraps,
  createElectionAnomalyRestrictedEvidencePayload,
  createRecordElectionAnomalyAttachmentManifestTransaction,
  createRecordElectionAnomalyAuthorityResponseTransaction,
  createRecordElectionAnomalyAuditorRecipientRewrapTransaction,
  createRecordElectionAnomalyEvidenceRedactionTransaction,
  createRegisterExternalElectionAnomalyClaimantTransaction,
  createRequestElectionAnomalyInformationTransaction,
  decryptElectionAnomalyOwnerMessageContentKey,
  decryptElectionAnomalyOwnerMessageBody,
  hasElectionAnomalyDuplicateThreadValidation,
  hashExternalElectionAnomalyClaimantReference,
  prepareElectionAnomalyAttachmentManifestMaterial,
  type ElectionAnomalyAttachmentContentKeyWrapPayload,
  type PreparedElectionAnomalyAttachmentManifestMaterial,
} from './transactionService';
import { useElectionsStore } from './useElectionsStore';

type OwnerAnomalyWorkspacePanelProps = {
  electionId: string;
  actorPublicAddress: string;
  actorEncryptionPublicKey: string;
  actorEncryptionPrivateKey: string;
  actorSigningPrivateKey: string;
};

type DecryptedMessage = {
  status: 'decrypted' | 'failed';
  body?: string;
  error?: string;
};

type Feedback = {
  tone: 'success' | 'error' | 'warning';
  message: string;
};

type AuthorityEvidenceStatus =
  | 'ready'
  | 'encrypting'
  | 'staging'
  | 'staged'
  | 'submitting'
  | 'scanner_pending'
  | 'accepted'
  | 'quarantined'
  | 'validation_rejected';

type AuthorityEvidenceFile = {
  id: string;
  file: File;
  status: AuthorityEvidenceStatus;
  material?: PreparedElectionAnomalyAttachmentManifestMaterial;
  contentKeyWraps?: ElectionAnomalyAttachmentContentKeyWrapPayload[];
  validationCode?: string;
};

const CASE_STATE_OPTIONS = [
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

const TERMINAL_CASE_STATES = new Set<string>([
  ELECTION_ANOMALY_CASE_STATE_IDS.ESCALATED_TO_GOVERNED_DECISION,
  ELECTION_ANOMALY_CASE_STATE_IDS.RESOLVED_NON_BLOCKING,
  ELECTION_ANOMALY_CASE_STATE_IDS.CLOSED_DUPLICATE_FOLLOWUP,
  ELECTION_ANOMALY_CASE_STATE_IDS.CLOSED_NO_FURTHER_SUBMITTER_INPUT,
]);

const CATEGORY_OPTIONS = [
  [ELECTION_ANOMALY_CATEGORY_IDS.ACCESS_OR_AUTHENTICATION, 'Access or authentication'],
  [ELECTION_ANOMALY_CATEGORY_IDS.BALLOT_CASTING_OR_RECEIPT, 'Ballot casting or receipt'],
  [ELECTION_ANOMALY_CATEGORY_IDS.TRUSTEE_CONTINUITY, 'Trustee continuity'],
  [ELECTION_ANOMALY_CATEGORY_IDS.COUNTING_OR_TALLY, 'Counting or tally'],
  [ELECTION_ANOMALY_CATEGORY_IDS.REPORTING_OR_AUDIT_PACKAGE, 'Reporting or audit package'],
  [ELECTION_ANOMALY_CATEGORY_IDS.SECURITY_OR_INTEGRITY, 'Security or integrity'],
  [ELECTION_ANOMALY_CATEGORY_IDS.EXTERNAL_OBJECTION_OR_COMPLAINT, 'External objection or complaint'],
  [ELECTION_ANOMALY_CATEGORY_IDS.OTHER_PROCESS, 'Other process'],
] as const;

const SEVERITY_OPTIONS = [
  [ELECTION_ANOMALY_SEVERITY_CANDIDATE_IDS.NOT_ASSESSED, 'Not assessed'],
  [ELECTION_ANOMALY_SEVERITY_CANDIDATE_IDS.LOW_OPERATIONAL_IMPACT, 'Low operational impact'],
  [ELECTION_ANOMALY_SEVERITY_CANDIDATE_IDS.REQUIRES_AUTHORITY_REVIEW, 'Requires authority review'],
  [ELECTION_ANOMALY_SEVERITY_CANDIDATE_IDS.POTENTIALLY_ELECTION_BLOCKING, 'Potentially election blocking'],
  [ELECTION_ANOMALY_SEVERITY_CANDIDATE_IDS.SECURITY_INTEGRITY_CRITICAL, 'Security/integrity critical'],
] as const;

const QUEUE_MODE_OPTIONS = [
  ['all', 'All'],
  ['awaiting', 'Awaiting info'],
  ['continuity', 'Continuity'],
  ['external', 'External'],
  ['rewrap', 'Rewrap'],
] as const;

type QueueMode = typeof QUEUE_MODE_OPTIONS[number][0];

const AUTHORITY_EVIDENCE_ACCEPTED_MIME_LABELS = 'PDF, PNG, JPG, TXT, CSV, JSON';

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

function evidenceStatusLabel(status: AuthorityEvidenceStatus): string {
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

function evidenceStatusClass(status: AuthorityEvidenceStatus): string {
  switch (status) {
    case 'staged':
    case 'staging':
    case 'scanner_pending':
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

function isAllowedAuthorityEvidenceMimeType(mimeType: string): boolean {
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

function labelFromOptions(options: readonly (readonly [string, string])[], value: string): string {
  return options.find(([id]) => id === value)?.[1] ?? value;
}

function messageKindLabel(messageKindId: string): string {
  switch (messageKindId) {
    case ELECTION_ANOMALY_MESSAGE_KIND_IDS.INITIAL_SUBMISSION:
      return 'Initial report';
    case ELECTION_ANOMALY_MESSAGE_KIND_IDS.AUTHORITY_INFORMATION_REQUEST:
      return 'Clarification request';
    case ELECTION_ANOMALY_MESSAGE_KIND_IDS.SUBMITTER_INFORMATION_RESPONSE:
      return 'Clarification response';
    case ELECTION_ANOMALY_MESSAGE_KIND_IDS.AUTHORITY_RESPONSE:
      return 'Authority response';
    default:
      return 'Thread message';
  }
}

function getOwnerDecryptabilityLabel(message: ElectionAnomalyOwnerMessageView): string {
  if (
    message.HasCallerOwnerWrap &&
    message.CallerOwnerWrap?.WrapStatusId === ELECTION_ANOMALY_RECIPIENT_WRAP_STATUS_IDS.AVAILABLE &&
    message.CallerOwnerWrap.EncryptedContentKey
  ) {
    return 'Decryptable';
  }

  return 'Owner wrap missing';
}

function hasPendingDesignatedAuditorWrap(message: ElectionAnomalyOwnerMessageView): boolean {
  return message.RecipientStatuses.some((status) =>
    status.RecipientRoleId === ELECTION_ANOMALY_RECIPIENT_ROLE_IDS.DESIGNATED_AUDITOR &&
    status.WrapStatusId !== ELECTION_ANOMALY_RECIPIENT_WRAP_STATUS_IDS.AVAILABLE
  );
}

function threadHasPendingAuditorRewrap(thread: ElectionAnomalyOwnerTriageThreadView): boolean {
  return thread.Messages.some(hasPendingDesignatedAuditorWrap);
}

function threadMatchesQueueMode(
  thread: ElectionAnomalyOwnerTriageThreadView,
  queueMode: QueueMode,
): boolean {
  switch (queueMode) {
    case 'awaiting':
      return thread.HasOpenClarificationRequest;
    case 'continuity':
      return thread.CategoryId === ELECTION_ANOMALY_CATEGORY_IDS.TRUSTEE_CONTINUITY;
    case 'external':
      return thread.CategoryId === ELECTION_ANOMALY_CATEGORY_IDS.EXTERNAL_OBJECTION_OR_COMPLAINT;
    case 'rewrap':
      return threadHasPendingAuditorRewrap(thread);
    default:
      return true;
  }
}

function getDesignatedAuditorGrants(
  grants: ElectionReportAccessGrantView[],
): ElectionReportAccessGrantView[] {
  return grants.filter(
    (grant) =>
      grant.GrantRole === ElectionReportAccessGrantRoleProto.ReportAccessGrantDesignatedAuditor &&
      Boolean(grant.ActorPublicAddress.trim()),
  );
}

function MetricCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  tone?: 'neutral' | 'warning' | 'success';
}) {
  const toneClass =
    tone === 'warning'
      ? 'text-amber-100'
      : tone === 'success'
        ? 'text-green-100'
        : 'text-hush-text-primary';

  return (
    <div className="rounded-2xl bg-hush-bg-dark/72 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
        {label}
      </div>
      <div className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function OwnerMessageCard({
  message,
  decrypted,
}: {
  message: ElectionAnomalyOwnerMessageView;
  decrypted?: DecryptedMessage;
}) {
  const decryptabilityLabel = getOwnerDecryptabilityLabel(message);

  return (
    <div className="rounded-2xl bg-hush-bg-element/70 px-4 py-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-sm font-semibold text-hush-text-primary">
            {messageKindLabel(message.MessageKindId)}
          </div>
          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-hush-text-accent">
            {formatTimestamp(message.RecordedAt)}
          </div>
        </div>
        <div
          className={`self-start rounded-full px-3 py-1 text-xs font-semibold ${
            decryptabilityLabel === 'Decryptable'
              ? 'bg-green-500/10 text-green-100'
              : 'bg-amber-500/10 text-amber-100'
          }`}
        >
          {decryptabilityLabel}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {message.RecipientStatuses.map((status, index) => (
          <span
            key={`${status.RecipientRoleId}-${status.WrapStatusId}-${index}`}
            className="rounded-full bg-hush-bg-dark/72 px-3 py-1 text-xs text-hush-text-accent"
          >
            {status.RecipientRoleId}: {status.WrapStatusId}
          </span>
        ))}
      </div>

      {decrypted?.status === 'decrypted' ? (
        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-hush-text-primary">
          {decrypted.body}
        </p>
      ) : decrypted?.status === 'failed' ? (
        <div className="mt-4 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {decrypted.error || 'This owner device cannot decrypt this message yet.'}
        </div>
      ) : decryptabilityLabel === 'Decryptable' ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-hush-text-accent">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Decrypting owner-readable message...</span>
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-hush-bg-dark/72 px-4 py-3 text-sm text-hush-text-accent">
          Restricted ciphertext is present. This owner caller wrap is not available on the current
          device.
        </div>
      )}

      <div className="mt-4 break-all text-xs text-hush-text-accent">
        Body hash: {message.EncryptedBodyHash}
      </div>
    </div>
  );
}

export function OwnerAnomalyWorkspacePanel({
  electionId,
  actorPublicAddress,
  actorEncryptionPublicKey,
  actorEncryptionPrivateKey,
  actorSigningPrivateKey,
}: OwnerAnomalyWorkspacePanelProps) {
  const {
    isLoadingDetail,
    loadElection,
    reset,
    selectedElection,
  } = useElectionsStore();
  const [triageResponse, setTriageResponse] =
    useState<GetElectionAnomalyOwnerTriageResponse | null>(null);
  const [isLoadingTriage, setIsLoadingTriage] = useState(false);
  const [triageError, setTriageError] = useState<string | null>(null);
  const [auditorGrants, setAuditorGrants] = useState<ElectionReportAccessGrantView[]>([]);
  const [isLoadingAuditorGrants, setIsLoadingAuditorGrants] = useState(false);
  const [auditorGrantError, setAuditorGrantError] = useState<string | null>(null);
  const [auditorEncryptAddresses, setAuditorEncryptAddresses] = useState<Record<string, string>>({});
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [decryptedMessages, setDecryptedMessages] = useState<Record<string, DecryptedMessage>>({});
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [categoryId, setCategoryId] = useState<string>(
    ELECTION_ANOMALY_CATEGORY_IDS.TRUSTEE_CONTINUITY,
  );
  const [caseStateId, setCaseStateId] = useState<string>(
    ELECTION_ANOMALY_CASE_STATE_IDS.UNDER_REVIEW,
  );
  const [severityCandidateId, setSeverityCandidateId] = useState<string>(
    ELECTION_ANOMALY_SEVERITY_CANDIDATE_IDS.NOT_ASSESSED,
  );
  const [governedDecisionRef, setGovernedDecisionRef] = useState('');
  const [clarificationBody, setClarificationBody] = useState('');
  const [responseBody, setResponseBody] = useState('');
  const [externalReference, setExternalReference] = useState('');
  const [externalBody, setExternalBody] = useState('');
  const [externalReferenceHash, setExternalReferenceHash] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [rewrapMessageId, setRewrapMessageId] = useState<string | null>(null);
  const [queueMode, setQueueMode] = useState<QueueMode>('all');
  const [queueCategoryFilter, setQueueCategoryFilter] = useState('all');
  const [queueCaseStateFilter, setQueueCaseStateFilter] = useState('all');
  const [authorityEvidenceFiles, setAuthorityEvidenceFiles] = useState<AuthorityEvidenceFile[]>([]);
  const [authorityEvidenceFeedback, setAuthorityEvidenceFeedback] = useState<Feedback | null>(null);
  const [manifestRefreshToken, setManifestRefreshToken] = useState(0);

  useEffect(() => {
    void loadElection(electionId);
  }, [electionId, loadElection]);

  useEffect(() => () => reset(), [reset]);

  const refreshTriage = useCallback(async () => {
    setIsLoadingTriage(true);
    setTriageError(null);

    try {
      const response = await electionsService.getElectionAnomalyOwnerTriage({
        ElectionId: electionId,
        ActorPublicAddress: actorPublicAddress,
      });
      setTriageResponse(response);
    } catch (error) {
      setTriageResponse(null);
      setTriageError(
        error instanceof Error
          ? error.message
          : 'Owner anomaly triage could not be loaded.',
      );
    } finally {
      setIsLoadingTriage(false);
    }
  }, [actorPublicAddress, electionId]);

  useEffect(() => {
    void refreshTriage();
  }, [refreshTriage]);

  const refreshAuditorGrants = useCallback(async () => {
    setIsLoadingAuditorGrants(true);
    setAuditorGrantError(null);

    try {
      const response = await electionsService.getElectionReportAccessGrants({
        ElectionId: electionId,
        ActorPublicAddress: actorPublicAddress,
      });

      if (!response.Success || !response.CanManageGrants) {
        setAuditorGrants([]);
        setAuditorGrantError(
          response.ErrorMessage ||
            response.DeniedReason ||
            'Designated-auditor grants are unavailable for this owner account.',
        );
        return;
      }

      setAuditorGrants(getDesignatedAuditorGrants(response.Grants));
    } catch (error) {
      setAuditorGrants([]);
      setAuditorGrantError(
        error instanceof Error
          ? error.message
          : 'Designated-auditor grants could not be loaded.',
      );
    } finally {
      setIsLoadingAuditorGrants(false);
    }
  }, [actorPublicAddress, electionId]);

  useEffect(() => {
    void refreshAuditorGrants();
  }, [refreshAuditorGrants]);

  useEffect(() => {
    let isActive = true;
    const auditorAddresses = auditorGrants.map((grant) => grant.ActorPublicAddress);

    if (auditorAddresses.length === 0) {
      setAuditorEncryptAddresses({});
      return () => {
        isActive = false;
      };
    }

    void (async () => {
      const resolvedEntries = await Promise.all(
        auditorAddresses.map(async (address) => {
          const identity = await identityService.getIdentity(address);
          return { address, identity };
        }),
      );

      if (!isActive) {
        return;
      }

      const next: Record<string, string> = {};
      resolvedEntries.forEach(({ address, identity }) => {
        if (identity.Successfull && identity.PublicEncryptAddress.trim()) {
          next[address] = identity.PublicEncryptAddress;
        }
      });
      setAuditorEncryptAddresses(next);
    })();

    return () => {
      isActive = false;
    };
  }, [auditorGrants]);

  useEffect(() => {
    let isActive = true;

    async function refreshHash(): Promise<void> {
      if (!externalReference.trim()) {
        setExternalReferenceHash('');
        return;
      }

      try {
        const hash = await hashExternalElectionAnomalyClaimantReference(electionId, externalReference);
        if (isActive) {
          setExternalReferenceHash(hash);
        }
      } catch {
        if (isActive) {
          setExternalReferenceHash('');
        }
      }
    }

    void refreshHash();
    return () => {
      isActive = false;
    };
  }, [electionId, externalReference]);

  const election =
    selectedElection?.Election?.ElectionId === electionId ? selectedElection.Election : null;
  const triage = triageResponse?.Success && triageResponse.HasTriage
    ? triageResponse.Triage ?? null
    : null;
  const triageThreads = useMemo(
    () => [...(triage?.Threads ?? [])].sort(
      (left, right) => (timestampToMillis(right.UpdatedAt) ?? 0) - (timestampToMillis(left.UpdatedAt) ?? 0)
    ),
    [triage?.Threads]
  );
  const filteredTriageThreads = useMemo(
    () => triageThreads.filter((thread) =>
      (queueCategoryFilter === 'all' || thread.CategoryId === queueCategoryFilter) &&
      (queueCaseStateFilter === 'all' || thread.CaseStateId === queueCaseStateFilter) &&
      threadMatchesQueueMode(thread, queueMode)
    ),
    [queueCaseStateFilter, queueCategoryFilter, queueMode, triageThreads],
  );
  const hasActiveQueueFilters = queueMode !== 'all' ||
    queueCategoryFilter !== 'all' ||
    queueCaseStateFilter !== 'all';
  const selectedThread = useMemo<ElectionAnomalyOwnerTriageThreadView | null>(() => {
    if (filteredTriageThreads.length === 0) {
      return null;
    }

    return filteredTriageThreads.find((thread) => thread.AnomalyThreadId === selectedThreadId)
      ?? filteredTriageThreads[0];
  }, [filteredTriageThreads, selectedThreadId]);
  const terminalStateDisabled = Boolean(
    selectedThread?.HasOpenClarificationRequest &&
    TERMINAL_CASE_STATES.has(caseStateId),
  );
  const selectedPendingAuditorMessages = useMemo(
    () => selectedThread?.Messages.filter(hasPendingDesignatedAuditorWrap) ?? [],
    [selectedThread],
  );
  const resolvedAuditorGrants = useMemo(
    () =>
      auditorGrants
        .map((grant) => ({
          grant,
          publicEncryptAddress: auditorEncryptAddresses[grant.ActorPublicAddress] ?? '',
        }))
        .filter((entry) => entry.publicEncryptAddress.trim()),
    [auditorEncryptAddresses, auditorGrants],
  );
  const stagedAuthorityEvidence = authorityEvidenceFiles.filter(
    (item) => item.status === 'staged' && item.material,
  );
  const authorityEvidenceTotalBytes = authorityEvidenceFiles.reduce(
    (total, item) => total + item.file.size,
    0,
  );
  const hasAuthorityEvidenceInProgress = authorityEvidenceFiles.some((item) =>
    item.status === 'encrypting' || item.status === 'staging' || item.status === 'submitting'
  );
  const hasRejectedAuthorityEvidence = authorityEvidenceFiles.some((item) =>
    item.status === 'validation_rejected' || item.status === 'quarantined'
  );

  useEffect(() => {
    if (!selectedThread) {
      return;
    }

    setCategoryId(selectedThread.CategoryId || ELECTION_ANOMALY_CATEGORY_IDS.TRUSTEE_CONTINUITY);
    setCaseStateId(selectedThread.CaseStateId || ELECTION_ANOMALY_CASE_STATE_IDS.UNDER_REVIEW);
    setSeverityCandidateId(
      selectedThread.SeverityCandidateId || ELECTION_ANOMALY_SEVERITY_CANDIDATE_IDS.NOT_ASSESSED,
    );
    setGovernedDecisionRef(selectedThread.GovernedDecisionRef || '');
  }, [selectedThread]);

  useEffect(() => {
    let isActive = true;
    const messages = selectedThread?.Messages ?? [];
    if (messages.length === 0) {
      setDecryptedMessages({});
      return undefined;
    }

    async function decryptMessages(): Promise<void> {
      const next: Record<string, DecryptedMessage> = {};
      await Promise.all(
        messages.map(async (message) => {
          if (getOwnerDecryptabilityLabel(message) !== 'Decryptable') {
            return;
          }

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
                  : 'This device does not have the owner key material needed to decrypt this message.',
            };
          }
        }),
      );

      if (isActive) {
        setDecryptedMessages(next);
      }
    }

    void decryptMessages();

    return () => {
      isActive = false;
    };
  }, [actorEncryptionPrivateKey, selectedThread]);

  useEffect(() => {
    setAuthorityEvidenceFiles([]);
    setAuthorityEvidenceFeedback(null);
  }, [selectedThread?.AnomalyThreadId]);

  async function submitOwnerAction(action: () => Promise<void>, successMessage: string): Promise<void> {
    setFeedback(null);
    setIsSubmittingAction(true);
    try {
      await action();
      await refreshTriage();
      setFeedback({ tone: 'success', message: successMessage });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Owner anomaly action could not be submitted.',
      });
    } finally {
      setIsSubmittingAction(false);
    }
  }

  async function submitSignedTransaction(signedTransaction: string, fallbackMessage: string): Promise<void> {
    const result = await submitTransaction(signedTransaction);
    if (
      !result.successful &&
      result.status !== TransactionStatus.ACCEPTED &&
      result.status !== TransactionStatus.PENDING
    ) {
      throw new Error(result.message || fallbackMessage);
    }
  }

  async function stageAuthorityEvidenceFiles(files: File[]): Promise<void> {
    if (!selectedThread?.AnomalyThreadId) {
      setAuthorityEvidenceFeedback({
        tone: 'error',
        message: ELECTION_ANOMALY_VALIDATION_CODES.CLARIFICATION_REQUEST_NOT_OPEN,
      });
      return;
    }

    const remainingSlots =
      ELECTION_ANOMALY_AUTHORITY_EVIDENCE_MAX_COUNT - authorityEvidenceFiles.length;
    if (files.length > remainingSlots) {
      setAuthorityEvidenceFeedback({
        tone: 'error',
        message: ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_COUNT_EXCEEDED,
      });
      return;
    }

    const totalBytes = authorityEvidenceTotalBytes + files.reduce(
      (total, file) => total + file.size,
      0,
    );
    if (totalBytes > ELECTION_ANOMALY_AUTHORITY_EVIDENCE_MAX_TOTAL_BYTES) {
      setAuthorityEvidenceFeedback({
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
    setAuthorityEvidenceFiles((current) => [...current, ...nextItems]);
    setAuthorityEvidenceFeedback(null);

    await Promise.all(
      nextItems.map(async (item) => {
        try {
          if (!isAllowedAuthorityEvidenceMimeType(item.file.type)) {
            throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_MIME_TYPE_INVALID);
          }

          if (
            item.file.size <= 0 ||
            item.file.size > ELECTION_ANOMALY_AUTHORITY_EVIDENCE_MAX_BYTES
          ) {
            throw new Error(ELECTION_ANOMALY_VALIDATION_CODES.ATTACHMENT_SIZE_EXCEEDED);
          }

          const fileBytes = await readFileBytes(item.file);
          const restrictedPayload = await createElectionAnomalyRestrictedEvidencePayload(fileBytes);
          const encryptedPayload = restrictedPayload.EncryptedPayload;
          const contentKeyWraps = await createElectionAnomalyOwnerAttachmentContentKeyWraps({
            OwnerPublicAddress: actorPublicAddress,
            OwnerPublicEncryptAddress: actorEncryptionPublicKey,
            AuditorRecipients: resolvedAuditorGrants.map((entry) => ({
              AuditorPublicAddress: entry.grant.ActorPublicAddress,
              AuditorPublicEncryptAddress: entry.publicEncryptAddress,
            })),
            ContentKey: restrictedPayload.ContentKey,
          });
          const draftMaterial = await prepareElectionAnomalyAttachmentManifestMaterial({
            Content: fileBytes,
            EncryptedPayload: encryptedPayload,
          });
          setAuthorityEvidenceFiles((current) =>
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
            AnomalyThreadId: selectedThread.AnomalyThreadId,
            AttachmentKindId: ELECTION_ANOMALY_ATTACHMENT_KIND_IDS.AUTHORITY_EVIDENCE,
            EncryptedPayloadBase64: bytesToBase64(encryptedPayload),
            EncryptedPayloadHash: draftMaterial.EncryptedPayloadHash,
            ContentHash: draftMaterial.ContentHash,
            SizeBytes: draftMaterial.SizeBytes,
            MimeType: item.file.type,
            ClarificationRequestId: '',
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

          setAuthorityEvidenceFiles((current) =>
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
          setAuthorityEvidenceFiles((current) =>
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

  function handleAuthorityEvidenceFileChange(files: FileList | null): void {
    const selectedFiles = Array.from(files ?? []);
    if (selectedFiles.length === 0) {
      return;
    }

    void stageAuthorityEvidenceFiles(selectedFiles);
  }

  function removeAuthorityEvidenceFile(fileId: string): void {
    setAuthorityEvidenceFiles((current) =>
      current.filter((item) => item.id !== fileId),
    );
  }

  function clearAuthorityEvidenceFiles(): void {
    setAuthorityEvidenceFiles([]);
    setAuthorityEvidenceFeedback(null);
  }

  async function handleAuthorityEvidenceSubmit(): Promise<void> {
    if (!selectedThread || stagedAuthorityEvidence.length === 0) {
      return;
    }

    setFeedback(null);
    setAuthorityEvidenceFeedback(null);
    setIsSubmittingAction(true);
    try {
      for (let index = 0; index < stagedAuthorityEvidence.length; index += 1) {
        const evidence = stagedAuthorityEvidence[index];
        if (!evidence.material) {
          continue;
        }

        setAuthorityEvidenceFiles((current) =>
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
          AnomalyThreadId: selectedThread.AnomalyThreadId,
          ActorPublicAddress: actorPublicAddress,
          ActorPublicEncryptAddress: actorEncryptionPublicKey,
          ActorPrivateEncryptKeyHex: actorEncryptionPrivateKey,
          SigningPrivateKeyHex: actorSigningPrivateKey,
          AttachmentKindId: ELECTION_ANOMALY_ATTACHMENT_KIND_IDS.AUTHORITY_EVIDENCE,
          EncryptedPayloadReference: evidence.material.EncryptedPayloadReference,
          EncryptedPayloadHash: evidence.material.EncryptedPayloadHash,
          ContentHash: evidence.material.ContentHash,
          SizeBytes: evidence.material.SizeBytes,
          MimeType: evidence.file.type,
          ValidationStatusId: ELECTION_ANOMALY_ATTACHMENT_VALIDATION_STATUS_IDS.PENDING_SCAN,
          ContentKeyWraps: evidence.contentKeyWraps,
          ExistingAttachmentManifestCount: index,
          ExistingAttachmentManifestTotalBytes: stagedAuthorityEvidence
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
          setAuthorityEvidenceFiles((current) =>
            current.map((item) =>
              item.id === evidence.id
                ? {
                    ...item,
                    status: rejectedAsQuarantined ? 'quarantined' : 'validation_rejected',
                    validationCode: manifestResult.message || 'The authority evidence manifest was rejected.',
                  }
                : item,
            ),
          );
          throw new Error(manifestResult.message || 'The authority evidence manifest was rejected.');
        }

        setAuthorityEvidenceFiles((current) =>
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

      await refreshTriage();
      setManifestRefreshToken((current) => current + 1);
      setFeedback({
        tone: 'success',
        message: 'Authority evidence manifest accepted. Scanner status remains pending until restricted evidence checks finish.',
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error
          ? error.message
          : 'Authority evidence could not be recorded.',
      });
    } finally {
      setIsSubmittingAction(false);
    }
  }

  async function handleClassificationSubmit(): Promise<void> {
    if (!selectedThread || terminalStateDisabled) {
      return;
    }

    await submitOwnerAction(async () => {
      const { signedTransaction } = await createClassifyElectionAnomalyThreadTransaction({
        ElectionId: electionId,
        AnomalyThreadId: selectedThread.AnomalyThreadId,
        ActorPublicAddress: actorPublicAddress,
        ActorPublicEncryptAddress: actorEncryptionPublicKey,
        ActorPrivateEncryptKeyHex: actorEncryptionPrivateKey,
        SigningPrivateKeyHex: actorSigningPrivateKey,
        CategoryId: categoryId,
        CaseStateId: caseStateId,
        SeverityCandidateId: severityCandidateId,
        GovernedDecisionRef: governedDecisionRef,
      });
      await submitSignedTransaction(signedTransaction, 'The classification transaction was rejected.');
    }, 'Classification transaction accepted. Refreshing owner triage.');
  }

  async function handleClarificationSubmit(): Promise<void> {
    if (!selectedThread || selectedThread.HasOpenClarificationRequest) {
      return;
    }

    await submitOwnerAction(async () => {
      const { signedTransaction } = await createRequestElectionAnomalyInformationTransaction({
        ElectionId: electionId,
        AnomalyThreadId: selectedThread.AnomalyThreadId,
        ActorPublicAddress: actorPublicAddress,
        ActorPublicEncryptAddress: actorEncryptionPublicKey,
        ActorPrivateEncryptKeyHex: actorEncryptionPrivateKey,
        OriginalSubmitterPublicAddress: selectedThread.SubmitterActorPublicAddress,
        Body: clarificationBody,
        SigningPrivateKeyHex: actorSigningPrivateKey,
      });
      await submitSignedTransaction(signedTransaction, 'The clarification request was rejected.');
      setClarificationBody('');
    }, 'Clarification request accepted. The submitter can now answer one bounded response.');
  }

  async function handleAuthorityResponseSubmit(): Promise<void> {
    if (!selectedThread) {
      return;
    }

    await submitOwnerAction(async () => {
      const { signedTransaction } = await createRecordElectionAnomalyAuthorityResponseTransaction({
        ElectionId: electionId,
        AnomalyThreadId: selectedThread.AnomalyThreadId,
        ActorPublicAddress: actorPublicAddress,
        ActorPublicEncryptAddress: actorEncryptionPublicKey,
        ActorPrivateEncryptKeyHex: actorEncryptionPrivateKey,
        OriginalSubmitterPublicAddress: selectedThread.SubmitterActorPublicAddress,
        Body: responseBody,
        SigningPrivateKeyHex: actorSigningPrivateKey,
      });
      await submitSignedTransaction(signedTransaction, 'The authority response was rejected.');
      setResponseBody('');
    }, 'Authority response accepted as anomaly evidence.');
  }

  async function handleExternalClaimantSubmit(): Promise<void> {
    setFeedback(null);
    setIsSubmittingAction(true);

    try {
      const { signedTransaction } = await createRegisterExternalElectionAnomalyClaimantTransaction({
        ElectionId: electionId,
        ActorPublicAddress: actorPublicAddress,
        ActorPublicEncryptAddress: actorEncryptionPublicKey,
        ActorPrivateEncryptKeyHex: actorEncryptionPrivateKey,
        ExternalClaimantReference: externalReference,
        CategoryId: ELECTION_ANOMALY_CATEGORY_IDS.EXTERNAL_OBJECTION_OR_COMPLAINT,
        Body: externalBody,
        SigningPrivateKeyHex: actorSigningPrivateKey,
      });

      const result = await submitTransaction(signedTransaction);
      if (
        !result.successful &&
        result.status !== TransactionStatus.ACCEPTED &&
        result.status !== TransactionStatus.PENDING
      ) {
        if (hasElectionAnomalyDuplicateThreadValidation(result)) {
          await refreshTriage();
          setExternalReference('');
          setExternalBody('');
          setFeedback({
            tone: 'warning',
            message:
              'An external claimant anomaly already exists for this reference. Triage has been refreshed.',
          });
          return;
        }

        throw new Error(result.message || 'The external claimant anomaly was rejected.');
      }

      await refreshTriage();
      setExternalReference('');
      setExternalBody('');
      setFeedback({
        tone: 'success',
        message: 'External claimant anomaly accepted. The raw reference stayed local before signing.',
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'External claimant anomaly could not be submitted.',
      });
    } finally {
      setIsSubmittingAction(false);
    }
  }

  async function handleAuditorRewrapSubmit(message: ElectionAnomalyOwnerMessageView): Promise<void> {
    if (!selectedThread || rewrapMessageId) {
      return;
    }

    setFeedback(null);
    setIsSubmittingAction(true);
    setRewrapMessageId(message.MessageId);

    try {
      if (resolvedAuditorGrants.length === 0) {
        throw new Error('No designated auditor encryption keys are available for rewrap.');
      }

      const contentKey = await decryptElectionAnomalyOwnerMessageContentKey(
        message,
        actorEncryptionPrivateKey,
      );

      for (const { grant, publicEncryptAddress } of resolvedAuditorGrants) {
        const { signedTransaction } =
          await createRecordElectionAnomalyAuditorRecipientRewrapTransaction({
            ElectionId: electionId,
            AnomalyThreadId: selectedThread.AnomalyThreadId,
            MessageId: message.MessageId,
            ActorPublicAddress: actorPublicAddress,
            ActorPublicEncryptAddress: actorEncryptionPublicKey,
            ActorPrivateEncryptKeyHex: actorEncryptionPrivateKey,
            AuditorPublicAddress: grant.ActorPublicAddress,
            AuditorPublicEncryptAddress: publicEncryptAddress,
            ContentKey: contentKey,
            SigningPrivateKeyHex: actorSigningPrivateKey,
          });
        await submitSignedTransaction(signedTransaction, 'The auditor rewrap transaction was rejected.');
      }

      await refreshTriage();
      setFeedback({
        tone: 'success',
        message: `Auditor rewrap accepted for ${resolvedAuditorGrants.length} designated auditor${
          resolvedAuditorGrants.length === 1 ? '' : 's'
        }.`,
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Auditor recipient rewrap could not be submitted.',
      });
    } finally {
      setRewrapMessageId(null);
      setIsSubmittingAction(false);
    }
  }

  async function handleEvidenceRedactionSubmit(
    input: AnomalyEvidenceRedactionSubmitInput,
  ): Promise<void> {
    setFeedback(null);
    setIsSubmittingAction(true);

    try {
      const { signedTransaction } =
        await createRecordElectionAnomalyEvidenceRedactionTransaction({
          ElectionId: electionId,
          AnomalyThreadId: input.anomalyThreadId,
          ActorPublicAddress: actorPublicAddress,
          ActorPublicEncryptAddress: actorEncryptionPublicKey,
          ActorPrivateEncryptKeyHex: actorEncryptionPrivateKey,
          SigningPrivateKeyHex: actorSigningPrivateKey,
          TargetKindId: ELECTION_ANOMALY_REDACTION_TARGET_KIND_IDS.ATTACHMENT_MANIFEST,
          TargetId: input.attachmentManifestId,
          ReasonCodeId: input.reasonCodeId,
          OriginalHash: input.originalHash,
          ReplacementManifestHash: input.replacementManifestHash,
          TombstoneStatusId: input.tombstoneStatusId,
          HoldReference: input.holdReference,
        });
      await submitSignedTransaction(signedTransaction, 'The evidence redaction transaction was rejected.');
      await refreshTriage();
      setFeedback({
        tone: 'success',
        message: 'Evidence redaction accepted as append-only anomaly history.',
      });
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Evidence redaction could not be submitted.';
      setFeedback({
        tone: 'error',
        message,
      });
      throw new Error(message);
    } finally {
      setIsSubmittingAction(false);
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto text-hush-text-primary">
      <div className="flex w-full min-w-0 flex-col gap-5 p-4 md:p-5">
        <header className={sectionClass}>
          <Link
            href={`/elections/${electionId}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-hush-text-accent transition-colors hover:text-hush-text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to election</span>
          </Link>
          <div className="mt-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-hush-text-accent">
                <FileWarning className="h-4 w-4" />
                <span>Owner anomaly triage</span>
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-hush-text-primary">
                {election?.Title || 'Owner anomaly triage'}
              </h1>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-hush-text-accent">
                Review restricted anomaly bodies, classify intake state, request one bounded
                clarification, register external claimant evidence, and keep continuity escalation
                as a separate governed handoff.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refreshTriage()}
              disabled={isLoadingTriage}
              className="inline-flex self-start items-center gap-2 rounded-xl bg-hush-purple px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="owner-anomaly-refresh-triage"
            >
              {isLoadingTriage ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              <span>Refresh triage</span>
            </button>
          </div>
        </header>

        <section className={sectionClass} data-testid="owner-anomaly-triage">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-hush-text-accent">
                Identity-visible authority review
              </div>
              <h2 className="mt-2 text-xl font-semibold text-hush-text-primary">
                Owner case queue
              </h2>
              <p className="mt-2 max-w-4xl text-sm leading-7 text-hush-text-accent">
                Owner triage can read restricted anomaly bodies for case handling. Severity is an
                intake candidate, and classification does not void, finalize, hold certification,
                or mark KeyLost.
              </p>
            </div>
            <div className="rounded-full bg-hush-bg-dark/72 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
              {election ? getLifecycleLabel(election.LifecycleState) : 'Loading'}
            </div>
          </div>

          {isLoadingTriage && !triageResponse ? (
            <div className="mt-5 flex items-center gap-3 rounded-2xl bg-hush-bg-dark/72 px-5 py-5 text-sm text-hush-text-accent">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading owner anomaly triage...</span>
            </div>
          ) : null}

          {triageError ? (
            <div className="mt-5 rounded-2xl bg-red-500/10 px-5 py-4 text-sm text-red-100">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{triageError}</span>
              </div>
            </div>
          ) : null}

          {triageResponse && !triage ? (
            <div className="mt-5 rounded-2xl bg-amber-500/10 px-5 py-4 text-sm leading-7 text-amber-100">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-1 h-4 w-4 shrink-0" />
                <span>
                  {triageResponse.ErrorMessage ||
                    'Owner anomaly triage is unavailable for this account.'}
                </span>
              </div>
            </div>
          ) : null}

          {triage ? (
            <>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <MetricCard label="Cases" value={triage.TotalThreadCount} />
                <MetricCard label="Awaiting info" value={triage.AwaitingInformationThreadCount} />
                <MetricCard
                  label="Decryptable messages"
                  value={triage.DecryptableMessageCount}
                  tone={triage.DecryptableMessageCount > 0 ? 'success' : 'neutral'}
                />
                <MetricCard
                  label="Pending rewrap"
                  value={triage.PendingRewrapMessageCount}
                  tone={triage.PendingRewrapMessageCount > 0 ? 'warning' : 'neutral'}
                />
                <MetricCard
                  label="Continuity"
                  value={triage.GovernedContinuityHandoffStatusId.replaceAll('_', ' ')}
                  tone={triage.ContinuitySummary?.HasContinuityIssue ? 'warning' : 'success'}
                />
              </div>

              <div className="mt-5 rounded-2xl bg-hush-bg-dark/72 px-4 py-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                      <Filter className="h-4 w-4" />
                      <span>Queue filters</span>
                    </div>
                    <div className="mt-2 text-sm text-hush-text-accent">
                      Showing {filteredTriageThreads.length} of {triageThreads.length} case
                      {triageThreads.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_auto] xl:min-w-[620px]">
                    <label className="text-sm text-hush-text-accent">
                      Category
                      <select
                        value={queueCategoryFilter}
                        onChange={(event) => setQueueCategoryFilter(event.target.value)}
                        className="mt-2 w-full rounded-xl bg-hush-bg-element px-3 py-2 text-hush-text-primary"
                        aria-label="Queue category filter"
                      >
                        <option value="all">All categories</option>
                        {CATEGORY_OPTIONS.map(([id, label]) => (
                          <option key={id} value={id}>{label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm text-hush-text-accent">
                      Case state
                      <select
                        value={queueCaseStateFilter}
                        onChange={(event) => setQueueCaseStateFilter(event.target.value)}
                        className="mt-2 w-full rounded-xl bg-hush-bg-element px-3 py-2 text-hush-text-primary"
                        aria-label="Queue case state filter"
                      >
                        <option value="all">All states</option>
                        {CASE_STATE_OPTIONS.map(([id, label]) => (
                          <option key={id} value={id}>{label}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setQueueMode('all');
                        setQueueCategoryFilter('all');
                        setQueueCaseStateFilter('all');
                      }}
                      disabled={!hasActiveQueueFilters}
                      className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-xl bg-hush-bg-element px-3 text-sm font-medium text-hush-text-primary transition-colors hover:bg-hush-bg-element/80 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                      <span>Clear filters</span>
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Queue mode filter">
                  {QUEUE_MODE_OPTIONS.map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setQueueMode(id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                        queueMode === id
                          ? 'bg-hush-purple text-white'
                          : 'bg-hush-bg-element text-hush-text-accent hover:text-hush-text-primary'
                      }`}
                      aria-pressed={queueMode === id}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.65fr)]">
                <div className="space-y-3">
                  {filteredTriageThreads.length > 0 ? (
                    filteredTriageThreads.map((thread) => (
                      <button
                        key={thread.AnomalyThreadId}
                        type="button"
                        onClick={() => setSelectedThreadId(thread.AnomalyThreadId)}
                        className={`w-full rounded-2xl px-4 py-3 text-left transition-colors ${
                          selectedThread?.AnomalyThreadId === thread.AnomalyThreadId
                            ? 'bg-hush-purple/20 ring-2 ring-hush-purple/70'
                            : 'bg-hush-bg-dark/72 hover:bg-hush-bg-dark'
                        }`}
                      >
                        <div className="text-sm font-semibold text-hush-text-primary">
                          {labelFromOptions(CATEGORY_OPTIONS, thread.CategoryId)}
                        </div>
                        <div className="mt-1 text-sm text-hush-text-accent">
                          {labelFromOptions(CASE_STATE_OPTIONS, thread.CaseStateId)}
                        </div>
                        <div className="mt-3 break-all text-xs text-hush-text-accent">
                          {thread.AnomalyThreadId}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-2xl bg-hush-bg-dark/72 px-5 py-5 text-sm text-hush-text-accent">
                      {triageThreads.length === 0
                        ? 'No anomaly cases are recorded for this election.'
                        : 'No anomaly cases match the current filters.'}
                    </div>
                  )}
                </div>

                {selectedThread ? (
                  <div className="space-y-4">
                    <article className="rounded-2xl bg-hush-bg-dark/72 px-5 py-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-hush-text-primary">
                            {labelFromOptions(CATEGORY_OPTIONS, selectedThread.CategoryId)}
                          </div>
                          <div className="mt-1 text-sm text-hush-text-accent">
                            {labelFromOptions(CASE_STATE_OPTIONS, selectedThread.CaseStateId)}
                          </div>
                        </div>
                        <div className="text-sm text-hush-text-accent">
                          Updated {formatTimestamp(selectedThread.UpdatedAt)}
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 text-xs text-hush-text-accent md:grid-cols-2">
                        <div className="break-all">Submitter: {selectedThread.SubmitterActorPublicAddress}</div>
                        <div>Role context: {selectedThread.SubmitterRoleContextId || 'Not recorded'}</div>
                        <div>Lifecycle at submission: {getLifecycleLabel(selectedThread.LifecycleStateAtSubmission)}</div>
                        <div className="break-all">Thread hash: {selectedThread.CurrentThreadHash}</div>
                      </div>
                      {selectedThread.HasOpenClarificationRequest ? (
                        <div className="mt-4 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                          One clarification request is already open. Terminal states are disabled
                          until the submitter response closes that request.
                        </div>
                      ) : null}
                    </article>

                    <AnomalyEvidenceManifestStatusPanel
                      key={`${selectedThread.AnomalyThreadId}-${manifestRefreshToken}`}
                      electionId={electionId}
                      actorPublicAddress={actorPublicAddress}
                      actorPrivateEncryptKeyHex={actorEncryptionPrivateKey}
                      scopeId="owner"
                      focusThreadId={selectedThread.AnomalyThreadId}
                      title="Selected case evidence manifest"
                      description="Attachments are encrypted restricted evidence. Owner and restricted auditors may be able to read evidence when recipient wraps are available."
                      testId="owner-anomaly-evidence-manifest"
                      redactionControls={{
                        enabled: true,
                        isSubmitting: isSubmittingAction,
                        onSubmit: handleEvidenceRedactionSubmit,
                      }}
                    />

                    <section
                      className="rounded-2xl bg-hush-bg-dark/72 px-5 py-4"
                      data-testid="owner-anomaly-authority-evidence"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold text-hush-text-primary">
                            <Paperclip className="h-4 w-4 text-hush-text-accent" />
                            <span>Authority evidence</span>
                          </div>
                          <p className="mt-2 max-w-3xl text-sm leading-7 text-hush-text-accent">
                            Attach owner-held restricted evidence to this case. Payloads are staged
                            in the anomaly namespace before the signed manifest is recorded.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={clearAuthorityEvidenceFiles}
                          disabled={isSubmittingAction || authorityEvidenceFiles.length === 0}
                          className="inline-flex self-start items-center gap-2 rounded-xl bg-hush-bg-element px-3 py-2 text-xs font-medium text-hush-text-primary transition-colors hover:bg-hush-bg-element/80 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <X className="h-4 w-4" />
                          <span>Clear</span>
                        </button>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-xl bg-hush-bg-element/70 px-4 py-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                            Kind
                          </div>
                          <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                            Authority evidence
                          </div>
                        </div>
                        <div className="rounded-xl bg-hush-bg-element/70 px-4 py-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                            Attached
                          </div>
                          <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                            {authorityEvidenceFiles.length} of {ELECTION_ANOMALY_AUTHORITY_EVIDENCE_MAX_COUNT}
                          </div>
                        </div>
                        <div className="rounded-xl bg-hush-bg-element/70 px-4 py-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                            Accepted types
                          </div>
                          <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                            {AUTHORITY_EVIDENCE_ACCEPTED_MIME_LABELS}
                          </div>
                        </div>
                        <div className="rounded-xl bg-hush-bg-element/70 px-4 py-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
                            Scanner
                          </div>
                          <div className="mt-2 text-sm font-semibold text-amber-100">
                            Required
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-hush-bg-element px-4 py-2.5 text-sm font-medium text-hush-text-primary transition-colors hover:bg-hush-bg-element/80 focus-within:ring-2 focus-within:ring-hush-purple">
                          <FileUp className="h-4 w-4" />
                          <span>Choose files</span>
                          <input
                            type="file"
                            multiple
                            className="sr-only"
                            accept={ELECTION_ANOMALY_EVIDENCE_MIME_TYPE_VALUES.join(',')}
                            disabled={isSubmittingAction || hasAuthorityEvidenceInProgress}
                            aria-label="Choose authority evidence files"
                            onChange={(event) => {
                              handleAuthorityEvidenceFileChange(event.target.files);
                              event.target.value = '';
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => void handleAuthorityEvidenceSubmit()}
                          disabled={
                            isSubmittingAction ||
                            hasAuthorityEvidenceInProgress ||
                            hasRejectedAuthorityEvidence ||
                            stagedAuthorityEvidence.length === 0
                          }
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-hush-purple px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isSubmittingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          <span>Record authority evidence</span>
                        </button>
                      </div>

                      {authorityEvidenceFeedback ? (
                        <div
                          className={`mt-4 rounded-xl px-4 py-3 text-sm ${
                            authorityEvidenceFeedback.tone === 'success'
                              ? 'bg-green-500/10 text-green-100'
                              : authorityEvidenceFeedback.tone === 'warning'
                                ? 'bg-amber-500/10 text-amber-100'
                                : 'bg-red-500/10 text-red-100'
                          }`}
                        >
                          {authorityEvidenceFeedback.message}
                        </div>
                      ) : null}

                      {authorityEvidenceFiles.length > 0 ? (
                        <div className="mt-4 space-y-3">
                          {authorityEvidenceFiles.map((item) => (
                            <div
                              key={item.id}
                              className="flex flex-col gap-3 rounded-xl bg-hush-bg-element/70 px-4 py-3 md:flex-row md:items-center md:justify-between"
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
                                  onClick={() => removeAuthorityEvidenceFile(item.id)}
                                  disabled={isSubmittingAction || item.status === 'submitting'}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-hush-bg-dark/72 text-hush-text-primary transition-colors hover:bg-hush-bg-dark disabled:cursor-not-allowed disabled:opacity-50"
                                  aria-label={`Remove ${item.file.name}`}
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-4 rounded-xl bg-hush-bg-element/70 px-4 py-3 text-sm text-hush-text-accent">
                          No authority evidence files selected.
                        </div>
                      )}
                    </section>

                    <div className="space-y-3">
                      {selectedThread.Messages.map((message) => (
                        <OwnerMessageCard
                          key={message.MessageId}
                          message={message}
                          decrypted={decryptedMessages[message.MessageId]}
                        />
                      ))}
                    </div>

                    {selectedPendingAuditorMessages.length > 0 ? (
                      <section
                        className="rounded-2xl bg-hush-bg-dark/72 px-5 py-4"
                        data-testid="owner-anomaly-auditor-rewrap"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex items-center gap-2 text-sm font-semibold text-hush-text-primary">
                              <KeyRound className="h-4 w-4 text-hush-text-accent" />
                              <span>Auditor recipient rewrap</span>
                            </div>
                            <div className="mt-2 text-sm text-hush-text-accent">
                              {resolvedAuditorGrants.length} designated auditor key
                              {resolvedAuditorGrants.length === 1 ? '' : 's'} available
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void refreshAuditorGrants()}
                            disabled={isLoadingAuditorGrants}
                            className="inline-flex self-start items-center gap-2 rounded-xl bg-hush-bg-element px-3 py-2 text-xs font-medium text-hush-text-primary transition-colors hover:bg-hush-bg-element/80 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isLoadingAuditorGrants ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCcw className="h-4 w-4" />
                            )}
                            <span>Refresh grants</span>
                          </button>
                        </div>

                        {auditorGrantError ? (
                          <div className="mt-3 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                            {auditorGrantError}
                          </div>
                        ) : null}

                        <div className="mt-4 space-y-3">
                          {selectedPendingAuditorMessages.map((message) => {
                            const canRewrap =
                              resolvedAuditorGrants.length > 0 &&
                              getOwnerDecryptabilityLabel(message) === 'Decryptable';
                            return (
                              <div
                                key={message.MessageId}
                                className="flex flex-col gap-3 rounded-xl bg-hush-bg-element/70 px-4 py-3 md:flex-row md:items-center md:justify-between"
                              >
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-hush-text-primary">
                                    {messageKindLabel(message.MessageKindId)}
                                  </div>
                                  <div className="mt-1 break-all text-xs text-hush-text-accent">
                                    {message.EncryptedBodyHash}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void handleAuditorRewrapSubmit(message)}
                                  disabled={isSubmittingAction || !canRewrap}
                                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                                  aria-label={`Rewrap message ${message.MessageId} for auditors`}
                                >
                                  {rewrapMessageId === message.MessageId ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <KeyRound className="h-4 w-4" />
                                  )}
                                  <span>Rewrap auditors</span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    ) : null}

                    <section className="rounded-2xl bg-hush-bg-dark/72 px-5 py-4">
                      <div className="text-sm font-semibold text-hush-text-primary">
                        Classification
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <label className="text-sm text-hush-text-accent">
                          Category
                          <select
                            value={categoryId}
                            onChange={(event) => setCategoryId(event.target.value)}
                            className="mt-2 w-full rounded-xl bg-hush-bg-element px-3 py-2 text-hush-text-primary"
                            aria-label="Anomaly category"
                          >
                            {CATEGORY_OPTIONS.map(([id, label]) => (
                              <option key={id} value={id}>{label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="text-sm text-hush-text-accent">
                          Case state
                          <select
                            value={caseStateId}
                            onChange={(event) => setCaseStateId(event.target.value)}
                            className="mt-2 w-full rounded-xl bg-hush-bg-element px-3 py-2 text-hush-text-primary"
                            aria-label="Anomaly case state"
                          >
                            {CASE_STATE_OPTIONS.map(([id, label]) => (
                              <option key={id} value={id}>{label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="text-sm text-hush-text-accent">
                          Severity candidate
                          <select
                            value={severityCandidateId}
                            onChange={(event) => setSeverityCandidateId(event.target.value)}
                            className="mt-2 w-full rounded-xl bg-hush-bg-element px-3 py-2 text-hush-text-primary"
                            aria-label="Anomaly severity candidate"
                          >
                            {SEVERITY_OPTIONS.map(([id, label]) => (
                              <option key={id} value={id}>{label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="text-sm text-hush-text-accent">
                          Governed decision ref
                          <input
                            value={governedDecisionRef}
                            onChange={(event) => setGovernedDecisionRef(event.target.value)}
                            className="mt-2 w-full rounded-xl bg-hush-bg-element px-3 py-2 text-hush-text-primary"
                            placeholder="Separate governed decision id"
                            aria-label="Governed decision reference"
                          />
                        </label>
                      </div>
                      {terminalStateDisabled ? (
                        <div className="mt-3 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                          Terminal classification requires the open clarification request to close first.
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void handleClassificationSubmit()}
                        disabled={isSubmittingAction || terminalStateDisabled}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSubmittingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        <span>Submit classification</span>
                      </button>
                    </section>

                    <section className="grid gap-4 xl:grid-cols-2">
                      <div className="rounded-2xl bg-hush-bg-dark/72 px-5 py-4">
                        <div className="text-sm font-semibold text-hush-text-primary">
                          Request information
                        </div>
                        <textarea
                          value={clarificationBody}
                          onChange={(event) => setClarificationBody(event.target.value)}
                          disabled={selectedThread.HasOpenClarificationRequest}
                          maxLength={ELECTION_ANOMALY_CLARIFICATION_BODY_MAX_CHARACTERS}
                          className="mt-3 min-h-28 w-full rounded-xl bg-hush-bg-element px-3 py-2 text-sm text-hush-text-primary disabled:opacity-60"
                          aria-label="Clarification request body"
                        />
                        <button
                          type="button"
                          onClick={() => void handleClarificationSubmit()}
                          disabled={
                            isSubmittingAction ||
                            selectedThread.HasOpenClarificationRequest ||
                            !clarificationBody.trim()
                          }
                          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Send className="h-4 w-4" />
                          <span>Request clarification</span>
                        </button>
                      </div>
                      <div className="rounded-2xl bg-hush-bg-dark/72 px-5 py-4">
                        <div className="text-sm font-semibold text-hush-text-primary">
                          Authority response
                        </div>
                        <textarea
                          value={responseBody}
                          onChange={(event) => setResponseBody(event.target.value)}
                          maxLength={ELECTION_ANOMALY_CLARIFICATION_BODY_MAX_CHARACTERS}
                          className="mt-3 min-h-28 w-full rounded-xl bg-hush-bg-element px-3 py-2 text-sm text-hush-text-primary"
                          aria-label="Authority response body"
                        />
                        <button
                          type="button"
                          onClick={() => void handleAuthorityResponseSubmit()}
                          disabled={isSubmittingAction || !responseBody.trim()}
                          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Send className="h-4 w-4" />
                          <span>Send response</span>
                        </button>
                      </div>
                    </section>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </section>

        <section className={sectionClass} data-testid="owner-anomaly-external-claimant">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-hush-text-accent">
            External claimant bridge
          </div>
          <h2 className="mt-2 text-xl font-semibold text-hush-text-primary">
            Register external objection
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-7 text-hush-text-accent">
            The claimant reference is hashed before signing. Put narrative detail in the encrypted
            anomaly body, not in the public reference field.
          </p>
          <div className="mt-4 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
            <label className="text-sm text-hush-text-accent">
              Local claimant reference
              <input
                value={externalReference}
                onChange={(event) => setExternalReference(event.target.value)}
                className="mt-2 w-full rounded-xl bg-hush-bg-dark/72 px-3 py-2 text-hush-text-primary"
                aria-label="External claimant reference"
              />
            </label>
            <div className="rounded-xl bg-hush-bg-dark/72 px-4 py-3 text-xs text-hush-text-accent">
              Hash preview: <span className="break-all text-hush-text-primary">{externalReferenceHash || 'Enter a reference'}</span>
            </div>
          </div>
          <textarea
            value={externalBody}
            onChange={(event) => setExternalBody(event.target.value)}
            maxLength={1000}
            className="mt-4 min-h-28 w-full rounded-xl bg-hush-bg-dark/72 px-3 py-2 text-sm text-hush-text-primary"
            aria-label="External claimant anomaly body"
          />
          <button
            type="button"
            onClick={() => void handleExternalClaimantSubmit()}
            disabled={isSubmittingAction || !externalReference.trim() || !externalBody.trim()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            <span>Register external anomaly</span>
          </button>
        </section>

        <section className={sectionClass} data-testid="owner-anomaly-continuity-handoff">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-hush-text-accent">
            Governed continuity handoff
          </div>
          <h2 className="mt-2 text-xl font-semibold text-hush-text-primary">
            Continuity evidence, not lifecycle mutation
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-7 text-hush-text-accent">
            A trustee lost-key report is intake evidence until a separate governed continuity
            decision acts. FEAT-127 does not void the election, mark KeyLost, hold certification, or
            finalize.
          </p>
          <div className="mt-4 rounded-2xl bg-hush-bg-dark/72 px-5 py-4 text-sm text-hush-text-accent">
            Current handoff state:{' '}
            <span className="font-semibold text-hush-text-primary">
              {triage?.GovernedContinuityHandoffStatusId.replaceAll('_', ' ') || 'loading'}
            </span>
          </div>
        </section>

        {feedback ? (
          <div
            className={`rounded-2xl px-5 py-4 text-sm ${
              feedback.tone === 'success'
                ? 'bg-green-500/10 text-green-100'
                : feedback.tone === 'warning'
                  ? 'bg-amber-500/10 text-amber-100'
                  : 'bg-red-500/10 text-red-100'
            }`}
          >
            {feedback.message}
          </div>
        ) : null}

        {isLoadingDetail && !election ? (
          <div className={`${sectionClass} flex items-center gap-3`}>
            <Loader2 className="h-5 w-5 animate-spin text-hush-purple" />
            <span className="text-sm text-hush-text-accent">Loading election details...</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
