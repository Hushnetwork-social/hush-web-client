"use client";

import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileWarning,
  Info,
  Loader2,
  RefreshCcw,
  Send,
  ShieldAlert,
  TriangleAlert,
  X,
} from 'lucide-react';
import type {
  ElectionAnomalyAttachmentManifestView,
  ElectionAnomalyEvidenceManifestThreadView,
  ElectionAnomalyEvidenceManifestView,
  ElectionAnomalyEvidenceRedactionView,
  GetElectionAnomalyEvidenceManifestResponse,
} from '@/lib/grpc';
import { electionsService } from '@/lib/grpc/services/elections';
import { formatArtifactValue, formatTimestamp } from './contracts';
import { decryptElectionAnomalyAttachmentPayload } from './transactionService';

type ManifestScopeId = 'owner' | 'auditor' | 'package';

export type AnomalyEvidenceRedactionSubmitInput = {
  anomalyThreadId: string;
  attachmentManifestId: string;
  originalHash: string;
  reasonCodeId: string;
  replacementManifestHash?: string;
  tombstoneStatusId?: string;
  holdReference?: string;
};

type AnomalyEvidenceRedactionControls = {
  enabled: boolean;
  isSubmitting?: boolean;
  onSubmit: (input: AnomalyEvidenceRedactionSubmitInput) => Promise<void> | void;
};

type AnomalyEvidenceManifestStatusPanelProps = {
  electionId: string;
  actorPublicAddress: string;
  scopeId: ManifestScopeId;
  focusThreadId?: string;
  title?: string;
  description?: string;
  testId?: string;
  redactionControls?: AnomalyEvidenceRedactionControls;
  actorPrivateEncryptKeyHex?: string;
};

type StatusTone = 'success' | 'warning' | 'error' | 'neutral';
type RedactionOutcomeId = 'restricted_tombstone' | 'replacement_payload';

type RedactionFormState = {
  attachmentManifestId: string | null;
  reasonCodeId: string;
  outcomeId: RedactionOutcomeId;
  replacementManifestHash: string;
  holdReference: string;
};

type RedactionFeedback = {
  tone: 'success' | 'error';
  message: string;
};

type AttachmentPayloadFeedback = {
  tone: 'success' | 'error';
  message: string;
};

type RecipientStatusCount = {
  key: string;
  recipientRoleId: string;
  wrapStatusId: string;
  count: number;
};

const MAX_THREAD_ROWS = 4;
const NUMBER_FORMATTER = new Intl.NumberFormat();
const REDACTION_TOMBSTONE_STATUS_ID = 'restricted_tombstone';
const REDACTION_REASON_OPTIONS = [
  ['personal_data', 'Personal data'],
  ['legal_hold', 'Legal hold'],
  ['malware_or_quarantine', 'Malware/quarantine'],
  ['operational_safety', 'Operational safety'],
  ['duplicate_or_irrelevant', 'Duplicate or irrelevant'],
  ['other', 'Other'],
] as const;
const REDACTION_OUTCOME_OPTIONS: readonly (readonly [RedactionOutcomeId, string])[] = [
  ['restricted_tombstone', 'Restricted tombstone'],
  ['replacement_payload', 'Replacement payload'],
];

function createDefaultRedactionFormState(
  attachmentManifestId: string | null = null,
): RedactionFormState {
  return {
    attachmentManifestId,
    reasonCodeId: REDACTION_REASON_OPTIONS[0][0],
    outcomeId: 'restricted_tombstone',
    replacementManifestHash: '',
    holdReference: '',
  };
}

function formatCode(value?: string): string {
  if (!value?.trim()) {
    return 'Not recorded';
  }

  return value.replaceAll('_', ' ');
}

function formatSize(bytes?: number): string {
  if (!bytes || bytes <= 0) {
    return 'Not recorded';
  }

  if (bytes < 1024) {
    return `${NUMBER_FORMATTER.format(bytes)} B`;
  }

  const kib = bytes / 1024;
  if (kib < 1024) {
    return `${NUMBER_FORMATTER.format(Math.round(kib))} KB`;
  }

  return `${NUMBER_FORMATTER.format(Math.round((kib / 1024) * 10) / 10)} MB`;
}

function getAttachmentDownloadExtension(mimeType?: string): string {
  switch (mimeType?.split(';')[0]?.trim().toLowerCase()) {
    case 'application/pdf':
      return 'pdf';
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'text/plain':
      return 'txt';
    case 'text/csv':
      return 'csv';
    case 'application/json':
      return 'json';
    default:
      return 'bin';
  }
}

function downloadDecryptedAttachment(
  payload: Uint8Array,
  mimeType: string | undefined,
  attachmentManifestId: string,
): void {
  if (typeof window === 'undefined') {
    return;
  }

  const extension = getAttachmentDownloadExtension(mimeType);
  const stableId = attachmentManifestId.replace(/[^a-z0-9-]/gi, '').slice(0, 8) || 'evidence';
  const payloadBuffer = new ArrayBuffer(payload.byteLength);
  new Uint8Array(payloadBuffer).set(payload);
  const blob = new Blob([payloadBuffer], {
    type: mimeType || 'application/octet-stream',
  });
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `anomaly-evidence-${stableId}.${extension}`;
  link.click();
  window.URL.revokeObjectURL(objectUrl);
}

function getReadinessTone(statusId?: string, blockerCount = 0): StatusTone {
  if (statusId === 'ready' && blockerCount === 0) {
    return 'success';
  }

  if (statusId === 'warning') {
    return 'warning';
  }

  if (statusId === 'blocked' || blockerCount > 0) {
    return 'error';
  }

  return 'neutral';
}

function getStatusTone(statusId?: string): StatusTone {
  switch (statusId) {
    case 'accepted':
    case 'clear':
    case 'available':
    case 'not_required':
      return 'success';
    case 'pending_scan':
    case 'pending':
    case 'manifest_only':
    case 'scanner_unavailable':
    case 'missing':
      return 'warning';
    case 'rejected':
    case 'quarantined':
    case 'payload_missing':
    case 'manifest_hash_mismatch':
      return 'error';
    default:
      return 'neutral';
  }
}

function getToneClasses(tone: StatusTone): string {
  switch (tone) {
    case 'success':
      return 'bg-green-500/10 text-green-100';
    case 'warning':
      return 'bg-amber-500/10 text-amber-100';
    case 'error':
      return 'bg-red-500/10 text-red-100';
    case 'neutral':
    default:
      return 'bg-hush-bg-element/70 text-hush-text-primary';
  }
}

function getToneIcon(tone: StatusTone) {
  switch (tone) {
    case 'success':
      return CheckCircle2;
    case 'warning':
      return TriangleAlert;
    case 'error':
      return AlertCircle;
    case 'neutral':
    default:
      return Info;
  }
}

function getScopeCopy(scopeId: ManifestScopeId): {
  eyebrow: string;
  title: string;
  description: string;
} {
  switch (scopeId) {
    case 'auditor':
      return {
        eyebrow: 'Restricted evidence manifest',
        title: 'Auditor manifest review',
        description:
          'Auditor review uses case/thread ids, evidence hashes, recipient status, scanner status, and redaction history without submitter actor references.',
      };
    case 'package':
      return {
        eyebrow: 'Restricted anomaly manifest',
        title: 'Package evidence readiness',
        description:
          'Package readiness depends on scanner status, payload availability, recipient wraps, and manifest hash alignment.',
      };
    case 'owner':
    default:
      return {
        eyebrow: 'Evidence manifest',
        title: 'Selected case evidence history',
        description:
          'Attachments are encrypted restricted evidence. Owner and restricted auditors may be able to read evidence where wraps are available.',
      };
  }
}

function countRecipientStatuses(
  threads: ElectionAnomalyEvidenceManifestThreadView[],
): RecipientStatusCount[] {
  const counts = new Map<string, RecipientStatusCount>();

  threads.forEach((thread) => {
    thread.RecipientStatuses.forEach((status) => {
      const key = `${status.RecipientRoleId}:${status.WrapStatusId}`;
      const current = counts.get(key);
      if (current) {
        current.count += 1;
      } else {
        counts.set(key, {
          key,
          recipientRoleId: status.RecipientRoleId,
          wrapStatusId: status.WrapStatusId,
          count: 1,
        });
      }
    });
  });

  return Array.from(counts.values()).sort((left, right) =>
    left.recipientRoleId.localeCompare(right.recipientRoleId) ||
    left.wrapStatusId.localeCompare(right.wrapStatusId)
  );
}

function StatTile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  tone?: StatusTone;
}) {
  return (
    <div className="rounded-2xl bg-black/20 p-3">
      <div className="text-xs font-semibold uppercase text-hush-text-accent">{label}</div>
      <div
        className={`mt-2 break-words text-sm font-semibold ${
          tone === 'success'
            ? 'text-green-100'
            : tone === 'warning'
              ? 'text-amber-100'
              : tone === 'error'
                ? 'text-red-100'
                : 'text-hush-text-primary'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function StatusPill({ label, statusId }: { label: string; statusId?: string }) {
  const tone = getStatusTone(statusId);
  const Icon = getToneIcon(tone);

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${getToneClasses(tone)}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}: {formatCode(statusId)}
    </span>
  );
}

function AttachmentManifestCard({
  attachment,
  canRecordRedaction,
  isRedactionBusy,
  canDecrypt,
  isDecrypting,
  payloadFeedback,
  onOpenRedactionForm,
  onDecrypt,
  children,
}: {
  attachment: ElectionAnomalyAttachmentManifestView;
  canRecordRedaction?: boolean;
  isRedactionBusy?: boolean;
  canDecrypt?: boolean;
  isDecrypting?: boolean;
  payloadFeedback?: AttachmentPayloadFeedback;
  onOpenRedactionForm?: () => void;
  onDecrypt?: () => void;
  children?: ReactNode;
}) {
  return (
    <article
      className="rounded-2xl bg-hush-bg-element/70 p-4"
      data-testid={`anomaly-evidence-attachment-${attachment.AttachmentManifestId}`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-hush-text-primary">
            {formatCode(attachment.AttachmentKindId)}
          </div>
          <div className="mt-1 text-xs text-hush-text-accent">
            Recorded {formatTimestamp(attachment.RecordedAt)}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill label="Validation" statusId={attachment.ValidationStatusId} />
          <StatusPill label="Scanner" statusId={attachment.ScannerStatusId} />
          <StatusPill label="Payload" statusId={attachment.PayloadAvailabilityStatusId} />
          <StatusPill
            label="Key"
            statusId={
              attachment.HasCallerContentKeyWrap &&
              attachment.CallerContentKeyWrap?.EncryptedContentKey
                ? 'available'
              : 'missing'
            }
          />
          {canDecrypt ? (
            <button
              type="button"
              onClick={onDecrypt}
              disabled={isDecrypting}
              className="inline-flex items-center gap-2 rounded-full bg-hush-purple/20 px-3 py-1 text-xs font-semibold text-hush-text-primary transition-colors hover:bg-hush-purple/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple disabled:cursor-not-allowed disabled:opacity-60"
              data-testid={`anomaly-evidence-decrypt-${attachment.AttachmentManifestId}`}
            >
              {isDecrypting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              <span>Decrypt evidence</span>
            </button>
          ) : null}
          {canRecordRedaction ? (
            <button
              type="button"
              onClick={onOpenRedactionForm}
              disabled={isRedactionBusy}
              className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRedactionBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ShieldAlert className="h-3.5 w-3.5" />
              )}
              <span>Record redaction</span>
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Size" value={formatSize(attachment.SizeBytes)} />
        <StatTile label="MIME" value={attachment.MimeType || 'Not recorded'} />
        <StatTile label="Content hash" value={formatArtifactValue(attachment.ContentHash)} />
        <StatTile
          label="Encrypted payload hash"
          value={formatArtifactValue(attachment.EncryptedPayloadHash)}
        />
      </div>

      <div className="mt-4 grid gap-3 text-xs text-hush-text-accent md:grid-cols-2">
        <div className="break-all">Manifest id: {attachment.AttachmentManifestId}</div>
        <div className="break-all">Event hash: {attachment.EventHash}</div>
        <div className="break-all">Source transaction: {attachment.SourceTransactionId}</div>
        <div className="break-all">
          Clarification:{' '}
          {attachment.HasClarificationRequest
            ? attachment.ClarificationRequestId
          : 'Not linked'}
        </div>
      </div>

      {payloadFeedback ? (
        <div
          className={`mt-4 rounded-xl px-4 py-3 text-sm ${
            payloadFeedback.tone === 'success'
              ? 'bg-green-500/10 text-green-100'
              : 'bg-red-500/10 text-red-100'
          }`}
          data-testid={`anomaly-evidence-payload-feedback-${attachment.AttachmentManifestId}`}
        >
          {payloadFeedback.message}
        </div>
      ) : null}

      {children}
    </article>
  );
}

function RedactionEventForm({
  attachment,
  formState,
  feedback,
  isSubmitting,
  onChange,
  onCancel,
  onSubmit,
}: {
  attachment: ElectionAnomalyAttachmentManifestView;
  formState: RedactionFormState;
  feedback: RedactionFeedback | null;
  isSubmitting: boolean;
  onChange: (updates: Partial<Omit<RedactionFormState, 'attachmentManifestId'>>) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 rounded-2xl bg-black/25 p-4"
      data-testid={`anomaly-evidence-redaction-form-${attachment.AttachmentManifestId}`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-100">
            <ShieldAlert className="h-4 w-4" />
            <span>Record redaction event</span>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-hush-text-accent">
            A redaction records a new event; it does not erase the original restricted hash.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="inline-flex self-start items-center gap-2 rounded-xl bg-hush-bg-element px-3 py-2 text-xs font-medium text-hush-text-primary transition-colors hover:bg-hush-bg-element/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple disabled:cursor-not-allowed disabled:opacity-60"
        >
          <X className="h-4 w-4" />
          <span>Cancel</span>
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm text-hush-text-accent">
          Redaction reason
          <select
            value={formState.reasonCodeId}
            onChange={(event) => onChange({ reasonCodeId: event.target.value })}
            disabled={isSubmitting}
            className="mt-2 w-full rounded-xl bg-hush-bg-dark/72 px-3 py-2 text-hush-text-primary disabled:opacity-60"
            aria-label="Redaction reason"
          >
            {REDACTION_REASON_OPTIONS.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-hush-text-accent">
          Redaction outcome
          <select
            value={formState.outcomeId}
            onChange={(event) =>
              onChange({ outcomeId: event.target.value as RedactionOutcomeId })
            }
            disabled={isSubmitting}
            className="mt-2 w-full rounded-xl bg-hush-bg-dark/72 px-3 py-2 text-hush-text-primary disabled:opacity-60"
            aria-label="Redaction outcome"
          >
            {REDACTION_OUTCOME_OPTIONS.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-hush-text-accent">
          Replacement manifest hash
          <input
            value={formState.replacementManifestHash}
            onChange={(event) => onChange({ replacementManifestHash: event.target.value })}
            disabled={isSubmitting}
            className="mt-2 w-full rounded-xl bg-hush-bg-dark/72 px-3 py-2 font-mono text-sm text-hush-text-primary disabled:opacity-60"
            placeholder="sha256:..."
            aria-label="Replacement manifest hash"
          />
        </label>
        <label className="text-sm text-hush-text-accent">
          Operational or legal hold reference
          <input
            value={formState.holdReference}
            onChange={(event) => onChange({ holdReference: event.target.value })}
            disabled={isSubmitting}
            className="mt-2 w-full rounded-xl bg-hush-bg-dark/72 px-3 py-2 text-hush-text-primary disabled:opacity-60"
            placeholder="Optional restricted reference"
            aria-label="Operational or legal hold reference"
          />
        </label>
      </div>

      <div className="mt-4 rounded-xl bg-hush-bg-dark/72 px-4 py-3 text-xs text-hush-text-accent">
        Original restricted hash:{' '}
        <span className="break-all font-mono text-hush-text-primary">{attachment.ContentHash}</span>
      </div>

      {feedback?.tone === 'error' ? (
        <div className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {feedback.message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        <span>Submit signed redaction event</span>
      </button>
    </form>
  );
}

function RedactionCard({ redaction }: { redaction: ElectionAnomalyEvidenceRedactionView }) {
  return (
    <article
      className="rounded-2xl bg-amber-500/10 p-4 text-amber-100"
      data-testid={`anomaly-evidence-redaction-${redaction.RedactionEventId}`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-sm font-semibold">
            {formatCode(redaction.ReasonCodeId)}
          </div>
          <div className="mt-1 text-xs text-amber-100/80">
            Recorded {formatTimestamp(redaction.RecordedAt)}
          </div>
        </div>
        <span className="self-start rounded-full bg-black/20 px-3 py-1 text-xs font-semibold">
          {formatCode(redaction.TargetKindId)}
        </span>
      </div>

      <div className="mt-3 text-sm">
        A redaction records a new event; it does not erase the original restricted hash.
      </div>

      <div className="mt-4 grid gap-3 text-xs md:grid-cols-2">
        <div className="break-all">Target id: {redaction.TargetId}</div>
        <div className="break-all">Original hash: {redaction.OriginalHash}</div>
        <div className="break-all">
          Replacement hash:{' '}
          {redaction.HasReplacementManifestHash
            ? redaction.ReplacementManifestHash
            : 'Not recorded'}
        </div>
        <div>Tombstone: {redaction.HasTombstoneStatus ? formatCode(redaction.TombstoneStatusId) : 'Not recorded'}</div>
      </div>
    </article>
  );
}

function ManifestThreadCard({
  thread,
  redactionControls,
  redactionForm,
  redactionFeedback,
  submittingRedactionAttachmentId,
  canDecryptAttachments,
  decryptingAttachmentId,
  attachmentPayloadFeedback,
  onOpenRedactionForm,
  onCancelRedactionForm,
  onRedactionFormChange,
  onDecryptAttachment,
  onSubmitRedactionForm,
}: {
  thread: ElectionAnomalyEvidenceManifestThreadView;
  redactionControls?: AnomalyEvidenceRedactionControls;
  redactionForm: RedactionFormState;
  redactionFeedback: RedactionFeedback | null;
  submittingRedactionAttachmentId: string | null;
  canDecryptAttachments: boolean;
  decryptingAttachmentId: string | null;
  attachmentPayloadFeedback: Record<string, AttachmentPayloadFeedback>;
  onOpenRedactionForm: (attachmentManifestId: string) => void;
  onCancelRedactionForm: () => void;
  onRedactionFormChange: (
    updates: Partial<Omit<RedactionFormState, 'attachmentManifestId'>>,
  ) => void;
  onDecryptAttachment: (attachment: ElectionAnomalyAttachmentManifestView) => void;
  onSubmitRedactionForm: (
    thread: ElectionAnomalyEvidenceManifestThreadView,
    attachment: ElectionAnomalyAttachmentManifestView,
  ) => void;
}) {
  return (
    <article
      className="rounded-2xl bg-black/20 p-4"
      data-testid={`anomaly-evidence-thread-${thread.AnomalyThreadId}`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-hush-text-primary">
            {formatCode(thread.CategoryId)}
          </div>
          <div className="mt-1 text-sm text-hush-text-accent">
            {formatCode(thread.CaseStateId)}
          </div>
        </div>
        <div className="text-sm text-hush-text-accent">
          Updated {formatTimestamp(thread.UpdatedAt)}
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-xs text-hush-text-accent md:grid-cols-2">
        <div className="break-all">Case id: {thread.AnomalyThreadId}</div>
        <div className="break-all">Thread hash: {thread.CurrentThreadHash}</div>
        <div>
          Attachments: {thread.AttachmentManifests.length} / Redactions: {thread.Redactions.length}
        </div>
        <div>
          Open clarification:{' '}
          {thread.HasOpenClarificationRequest
            ? thread.OpenClarificationRequestId || 'Yes'
            : 'No'}
        </div>
      </div>

      {thread.GovernedDecisionRef ? (
        <div className="mt-4 rounded-xl bg-hush-bg-element/70 px-4 py-3 text-sm text-hush-text-accent">
          Governed decision reference: {thread.GovernedDecisionRef}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {thread.RecipientStatuses.length > 0 ? (
          thread.RecipientStatuses.map((status, index) => (
            <span
              key={`${status.RecipientRoleId}-${status.WrapStatusId}-${index}`}
              className="rounded-full bg-hush-bg-element/70 px-3 py-1 text-xs text-hush-text-accent"
            >
              {formatCode(status.RecipientRoleId)}: {formatCode(status.WrapStatusId)}
            </span>
          ))
        ) : (
          <span className="rounded-full bg-hush-bg-element/70 px-3 py-1 text-xs text-hush-text-accent">
            No recipient wrap status rows
          </span>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {thread.AttachmentManifests.length > 0 ? (
          thread.AttachmentManifests.map((attachment) => {
            const isRedactionFormOpen =
              redactionForm.attachmentManifestId === attachment.AttachmentManifestId;
            const isSubmittingRedaction =
              submittingRedactionAttachmentId === attachment.AttachmentManifestId ||
              Boolean(redactionControls?.isSubmitting);
            const hasCallerPayloadKey = Boolean(
              attachment.HasCallerContentKeyWrap &&
              attachment.CallerContentKeyWrap?.EncryptedContentKey?.trim() &&
              attachment.CallerContentKeyWrap.WrapStatusId === 'available',
            );

            return (
              <AttachmentManifestCard
                key={attachment.AttachmentManifestId}
                attachment={attachment}
                canRecordRedaction={redactionControls?.enabled}
                isRedactionBusy={isSubmittingRedaction}
                canDecrypt={canDecryptAttachments && hasCallerPayloadKey}
                isDecrypting={decryptingAttachmentId === attachment.AttachmentManifestId}
                payloadFeedback={attachmentPayloadFeedback[attachment.AttachmentManifestId]}
                onOpenRedactionForm={() =>
                  onOpenRedactionForm(attachment.AttachmentManifestId)
                }
                onDecrypt={() => onDecryptAttachment(attachment)}
              >
                {isRedactionFormOpen ? (
                  <RedactionEventForm
                    attachment={attachment}
                    formState={redactionForm}
                    feedback={redactionFeedback}
                    isSubmitting={isSubmittingRedaction}
                    onChange={onRedactionFormChange}
                    onCancel={onCancelRedactionForm}
                    onSubmit={() => onSubmitRedactionForm(thread, attachment)}
                  />
                ) : null}
              </AttachmentManifestCard>
            );
          })
        ) : (
          <div className="rounded-2xl bg-hush-bg-element/70 px-4 py-3 text-sm text-hush-text-accent">
            No attachment manifest rows are recorded for this case.
          </div>
        )}
      </div>

      {thread.Redactions.length > 0 ? (
        <div className="mt-4 space-y-3">
          {thread.Redactions.map((redaction) => (
            <RedactionCard key={redaction.RedactionEventId} redaction={redaction} />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function getVisibleThreads(
  manifest: ElectionAnomalyEvidenceManifestView,
  focusThreadId?: string,
): {
  threads: ElectionAnomalyEvidenceManifestThreadView[];
  isFocused: boolean;
  focusMissing: boolean;
} {
  if (focusThreadId) {
    const focusedThread = manifest.Threads.find(
      (thread) => thread.AnomalyThreadId === focusThreadId,
    );
    return {
      threads: focusedThread ? [focusedThread] : [],
      isFocused: Boolean(focusedThread),
      focusMissing: !focusedThread,
    };
  }

  return {
    threads: manifest.Threads.slice(0, MAX_THREAD_ROWS),
    isFocused: false,
    focusMissing: false,
  };
}

export function AnomalyEvidenceManifestStatusPanel({
  electionId,
  actorPublicAddress,
  scopeId,
  focusThreadId,
  title,
  description,
  testId = 'anomaly-evidence-manifest-status',
  redactionControls,
  actorPrivateEncryptKeyHex,
}: AnomalyEvidenceManifestStatusPanelProps) {
  const scopeCopy = getScopeCopy(scopeId);
  const [response, setResponse] = useState<GetElectionAnomalyEvidenceManifestResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redactionForm, setRedactionForm] = useState<RedactionFormState>(
    createDefaultRedactionFormState(),
  );
  const [redactionFeedback, setRedactionFeedback] = useState<RedactionFeedback | null>(null);
  const [submittingRedactionAttachmentId, setSubmittingRedactionAttachmentId] =
    useState<string | null>(null);
  const [decryptingAttachmentId, setDecryptingAttachmentId] = useState<string | null>(null);
  const [attachmentPayloadFeedback, setAttachmentPayloadFeedback] = useState<
    Record<string, AttachmentPayloadFeedback>
  >({});

  const refreshManifest = useCallback(async () => {
    if (!electionId || !actorPublicAddress) {
      setResponse(null);
      setError('Manifest status requires an election and actor address.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const next = await electionsService.getElectionAnomalyEvidenceManifest({
        ElectionId: electionId,
        ActorPublicAddress: actorPublicAddress,
        ScopeId: scopeId,
      });
      setResponse(next);
    } catch (requestError) {
      setResponse(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Anomaly evidence manifest could not be loaded.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [actorPublicAddress, electionId, scopeId]);

  useEffect(() => {
    void refreshManifest();
  }, [refreshManifest]);

  useEffect(() => {
    setRedactionForm(createDefaultRedactionFormState());
    setRedactionFeedback(null);
    setSubmittingRedactionAttachmentId(null);
    setDecryptingAttachmentId(null);
    setAttachmentPayloadFeedback({});
  }, [electionId, focusThreadId, scopeId]);

  const manifest = response?.Success && response.HasManifest ? response.Manifest ?? null : null;
  const manifestThreads = useMemo(() => manifest?.Threads ?? [], [manifest]);
  const visibleThreadState = useMemo(
    () => (manifest ? getVisibleThreads(manifest, focusThreadId) : null),
    [focusThreadId, manifest],
  );
  const recipientStatusCounts = useMemo(
    () => countRecipientStatuses(manifestThreads),
    [manifestThreads],
  );
  const readinessTone = getReadinessTone(
    manifest?.PackageReadinessStatusId,
    manifest?.PackageReadinessBlockerIds.length ?? 0,
  );
  const ReadinessIcon = getToneIcon(readinessTone);

  function openRedactionForm(attachmentManifestId: string): void {
    setRedactionForm(createDefaultRedactionFormState(attachmentManifestId));
    setRedactionFeedback(null);
  }

  function cancelRedactionForm(): void {
    setRedactionForm(createDefaultRedactionFormState());
    setRedactionFeedback(null);
  }

  function updateRedactionForm(
    updates: Partial<Omit<RedactionFormState, 'attachmentManifestId'>>,
  ): void {
    setRedactionForm((current) => ({
      ...current,
      ...updates,
    }));
  }

  async function submitRedactionForm(
    thread: ElectionAnomalyEvidenceManifestThreadView,
    attachment: ElectionAnomalyAttachmentManifestView,
  ): Promise<void> {
    if (!redactionControls?.enabled || !redactionControls.onSubmit) {
      return;
    }

    setRedactionFeedback(null);
    setSubmittingRedactionAttachmentId(attachment.AttachmentManifestId);

    try {
      await redactionControls.onSubmit({
        anomalyThreadId: thread.AnomalyThreadId,
        attachmentManifestId: attachment.AttachmentManifestId,
        originalHash: attachment.ContentHash,
        reasonCodeId: redactionForm.reasonCodeId,
        replacementManifestHash: redactionForm.replacementManifestHash.trim() || undefined,
        tombstoneStatusId:
          redactionForm.outcomeId === 'restricted_tombstone'
            ? REDACTION_TOMBSTONE_STATUS_ID
            : undefined,
        holdReference: redactionForm.holdReference.trim() || undefined,
      });
      setRedactionFeedback({
        tone: 'success',
        message: 'Redaction event submitted. Manifest history is refreshing.',
      });
      setRedactionForm(createDefaultRedactionFormState());
      await refreshManifest();
    } catch (submitError) {
      setRedactionFeedback({
        tone: 'error',
        message:
          submitError instanceof Error
            ? submitError.message
            : 'Evidence redaction could not be submitted.',
      });
    } finally {
      setSubmittingRedactionAttachmentId(null);
    }
  }

  async function handleDecryptAttachment(
    attachment: ElectionAnomalyAttachmentManifestView,
  ): Promise<void> {
    if (!actorPrivateEncryptKeyHex?.trim()) {
      setAttachmentPayloadFeedback((current) => ({
        ...current,
        [attachment.AttachmentManifestId]: {
          tone: 'error',
          message: 'Restricted evidence decryption requires the local private encryption key.',
        },
      }));
      return;
    }

    setDecryptingAttachmentId(attachment.AttachmentManifestId);
    setAttachmentPayloadFeedback((current) => {
      const next = { ...current };
      delete next[attachment.AttachmentManifestId];
      return next;
    });

    try {
      const payloadResponse = await electionsService.getElectionAnomalyRestrictedPayload({
        ElectionId: electionId,
        ActorPublicAddress: actorPublicAddress,
        PayloadReference: attachment.EncryptedPayloadReference,
      });

      if (!payloadResponse.Success) {
        throw new Error(
          payloadResponse.ValidationCode ||
          payloadResponse.ErrorMessage ||
          'Restricted evidence payload could not be retrieved.',
        );
      }

      if (payloadResponse.PayloadReference !== attachment.EncryptedPayloadReference) {
        throw new Error('Restricted evidence payload reference mismatch.');
      }

      const decryptedPayload = await decryptElectionAnomalyAttachmentPayload({
        Attachment: attachment,
        ActorPrivateEncryptKeyHex: actorPrivateEncryptKeyHex,
        EncryptedPayloadBase64: payloadResponse.EncryptedPayloadBase64,
        EncryptedPayloadHash: payloadResponse.EncryptedPayloadHash,
        ContentHash: payloadResponse.ContentHash,
      });

      downloadDecryptedAttachment(
        decryptedPayload,
        payloadResponse.MimeType || attachment.MimeType,
        attachment.AttachmentManifestId,
      );
      setAttachmentPayloadFeedback((current) => ({
        ...current,
        [attachment.AttachmentManifestId]: {
          tone: 'success',
          message: 'Restricted evidence decrypted locally. Content hash verified.',
        },
      }));
    } catch (payloadError) {
      setAttachmentPayloadFeedback((current) => ({
        ...current,
        [attachment.AttachmentManifestId]: {
          tone: 'error',
          message:
            payloadError instanceof Error
              ? payloadError.message
              : 'Restricted evidence payload could not be decrypted.',
        },
      }));
    } finally {
      setDecryptingAttachmentId((current) =>
        current === attachment.AttachmentManifestId ? null : current,
      );
    }
  }

  const canDecryptAttachments = Boolean(actorPrivateEncryptKeyHex?.trim());

  return (
    <section
      className="rounded-2xl bg-hush-bg-dark/72 p-4"
      data-testid={testId}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-hush-text-accent">
            <FileWarning className="h-4 w-4" />
            <span>{scopeCopy.eyebrow}</span>
          </div>
          <h3 className="mt-2 text-lg font-semibold text-hush-text-primary">
            {title ?? scopeCopy.title}
          </h3>
          <p className="mt-2 max-w-4xl text-sm leading-7 text-hush-text-accent">
            {description ?? scopeCopy.description}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshManifest()}
          disabled={isLoading}
          className="inline-flex self-start items-center gap-2 rounded-xl bg-hush-bg-element px-3 py-2 text-sm font-medium text-hush-text-primary transition-colors hover:bg-hush-bg-element/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple disabled:cursor-not-allowed disabled:opacity-60"
          data-testid={`${testId}-refresh`}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="h-4 w-4" />
          )}
          <span>Refresh manifest</span>
        </button>
      </div>

      {isLoading && !response ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-black/20 px-4 py-4 text-sm text-hush-text-accent">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading anomaly evidence manifest...</span>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-100">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      ) : null}

      {redactionFeedback ? (
        <div
          className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
            redactionFeedback.tone === 'success'
              ? 'bg-green-500/10 text-green-100'
              : 'bg-red-500/10 text-red-100'
          }`}
          data-testid={`${testId}-redaction-feedback`}
        >
          {redactionFeedback.message}
        </div>
      ) : null}

      {response && !manifest ? (
        <div className="mt-4 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm leading-7 text-amber-100">
          {response.ErrorMessage ||
            'Anomaly evidence manifest is unavailable for this role and scope.'}
        </div>
      ) : null}

      {manifest ? (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${getToneClasses(readinessTone)}`}>
              <ReadinessIcon className="h-4 w-4" />
              Package readiness: {formatCode(manifest.PackageReadinessStatusId)}
            </span>
            <span className="rounded-full bg-hush-bg-element/70 px-3 py-1 text-xs font-semibold text-hush-text-accent">
              Canonicalization: {manifest.CanonicalizationId}
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Threads" value={manifest.TotalThreadCount} />
            <StatTile label="Attachments" value={manifest.AttachmentManifestCount} />
            <StatTile label="Redactions" value={manifest.RedactionCount} />
            <StatTile
              label="Manifest hash"
              value={formatArtifactValue(manifest.ManifestHash)}
              tone={readinessTone}
            />
          </div>

          {manifest.PackageReadinessBlockerIds.length > 0 ? (
            <div
              className="mt-4 rounded-2xl bg-red-500/10 p-4 text-sm text-red-100"
              data-testid={`${testId}-blockers`}
            >
              <div className="font-semibold">
                Package readiness is blocked by restricted evidence status.
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {manifest.PackageReadinessBlockerIds.map((blocker) => (
                  <span
                    key={blocker}
                    className="rounded-full bg-black/20 px-3 py-1 font-mono text-xs"
                  >
                    {blocker}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {recipientStatusCounts.length > 0 ? (
            <div className="mt-4 rounded-2xl bg-black/20 p-4">
              <div className="text-xs font-semibold uppercase text-hush-text-accent">
                Recipient wrap status
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {recipientStatusCounts.map((status) => (
                  <span
                    key={status.key}
                    className="rounded-full bg-hush-bg-element/70 px-3 py-1 text-xs text-hush-text-accent"
                  >
                    {formatCode(status.recipientRoleId)} / {formatCode(status.wrapStatusId)}:{' '}
                    <span className="font-semibold text-hush-text-primary">{status.count}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {visibleThreadState?.focusMissing ? (
            <div className="mt-4 rounded-2xl bg-hush-bg-element/70 px-4 py-3 text-sm text-hush-text-accent">
              No evidence manifest rows are recorded for the selected case yet.
            </div>
          ) : null}

          {visibleThreadState && visibleThreadState.threads.length > 0 ? (
            <div className="mt-4 space-y-4">
              {visibleThreadState.threads.map((thread) => (
                <ManifestThreadCard
                  key={thread.AnomalyThreadId}
                  thread={thread}
                  redactionControls={redactionControls}
                  redactionForm={redactionForm}
                  redactionFeedback={redactionFeedback}
                  submittingRedactionAttachmentId={submittingRedactionAttachmentId}
                  canDecryptAttachments={canDecryptAttachments}
                  decryptingAttachmentId={decryptingAttachmentId}
                  attachmentPayloadFeedback={attachmentPayloadFeedback}
                  onOpenRedactionForm={openRedactionForm}
                  onCancelRedactionForm={cancelRedactionForm}
                  onRedactionFormChange={updateRedactionForm}
                  onDecryptAttachment={(attachment) => {
                    void handleDecryptAttachment(attachment);
                  }}
                  onSubmitRedactionForm={(redactionThread, attachment) => {
                    void submitRedactionForm(redactionThread, attachment);
                  }}
                />
              ))}
              {!visibleThreadState.isFocused && manifest.Threads.length > MAX_THREAD_ROWS ? (
                <div className="rounded-2xl bg-hush-bg-element/70 px-4 py-3 text-sm text-hush-text-accent">
                  Showing {MAX_THREAD_ROWS} of {manifest.Threads.length} manifest case rows.
                </div>
              ) : null}
            </div>
          ) : manifest.Threads.length === 0 ? (
            <div className="mt-4 rounded-2xl bg-hush-bg-element/70 px-4 py-3 text-sm text-hush-text-accent">
              No anomaly evidence history is recorded for this election.
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
