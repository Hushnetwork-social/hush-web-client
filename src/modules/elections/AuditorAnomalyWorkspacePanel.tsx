"use client";

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  FileWarning,
  Loader2,
  RefreshCcw,
  ShieldAlert,
} from 'lucide-react';
import {
  type ElectionAnomalyAuditorRestrictedThreadView,
  type ElectionAnomalyRestrictedMessageView,
  type GetElectionAnomalyAuditorRestrictedReviewResponse,
  type GrpcTimestamp,
} from '@/lib/grpc';
import { electionsService } from '@/lib/grpc/services/elections';
import { AnomalyEvidenceManifestStatusPanel } from './AnomalyEvidenceManifestStatusPanel';
import { ElectionAnomalyPanel } from './ElectionAnomalyPanel';
import { getLifecycleLabel } from './contracts';
import { sectionClass } from './HushVotingWorkspaceShared';
import {
  ELECTION_ANOMALY_CATEGORY_IDS,
  ELECTION_ANOMALY_MESSAGE_KIND_IDS,
  ELECTION_ANOMALY_RECIPIENT_WRAP_STATUS_IDS,
  decryptElectionAnomalyRestrictedMessageBody,
} from './transactionService';
import { useElectionsStore } from './useElectionsStore';

type AuditorAnomalyWorkspacePanelProps = {
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

const CASE_STATE_LABELS = new Map<string, string>([
  ['submitted', 'Submitted'],
  ['under_review', 'Under review'],
  ['authority_requested_information', 'Awaiting information'],
  ['submitter_information_provided', 'Information provided'],
  ['owner_responded', 'Owner responded'],
  ['escalated_to_governed_decision', 'Governed decision'],
  ['resolved_non_blocking', 'Resolved non-blocking'],
  ['closed_duplicate_followup', 'Closed duplicate'],
  ['closed_no_further_submitter_input', 'Closed no response'],
]);

const CATEGORY_LABELS = new Map<string, string>([
  [ELECTION_ANOMALY_CATEGORY_IDS.ACCESS_OR_AUTHENTICATION, 'Access or authentication'],
  [ELECTION_ANOMALY_CATEGORY_IDS.BALLOT_CASTING_OR_RECEIPT, 'Ballot casting or receipt'],
  [ELECTION_ANOMALY_CATEGORY_IDS.TRUSTEE_CONTINUITY, 'Trustee continuity'],
  [ELECTION_ANOMALY_CATEGORY_IDS.COUNTING_OR_TALLY, 'Counting or tally'],
  [ELECTION_ANOMALY_CATEGORY_IDS.REPORTING_OR_AUDIT_PACKAGE, 'Reporting or audit package'],
  [ELECTION_ANOMALY_CATEGORY_IDS.SECURITY_OR_INTEGRITY, 'Security or integrity'],
  [ELECTION_ANOMALY_CATEGORY_IDS.EXTERNAL_OBJECTION_OR_COMPLAINT, 'External objection or complaint'],
  [ELECTION_ANOMALY_CATEGORY_IDS.OTHER_PROCESS, 'Other process'],
]);

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

function getDecryptabilityLabel(message: ElectionAnomalyRestrictedMessageView): string {
  if (
    message.HasCallerAuditorWrap &&
    message.CallerAuditorWrap?.WrapStatusId === ELECTION_ANOMALY_RECIPIENT_WRAP_STATUS_IDS.AVAILABLE &&
    message.CallerAuditorWrap.EncryptedContentKey
  ) {
    return 'Decryptable';
  }

  if (message.CallerAuditorWrap?.WrapStatusId === ELECTION_ANOMALY_RECIPIENT_WRAP_STATUS_IDS.PENDING_BACKFILL) {
    return 'Pending rewrap';
  }

  return 'Wrap missing';
}

function RestrictedMessageCard({
  message,
  decrypted,
}: {
  message: ElectionAnomalyRestrictedMessageView;
  decrypted?: DecryptedMessage;
}) {
  const decryptabilityLabel = getDecryptabilityLabel(message);

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
          {decrypted.error || 'This message is not decryptable from this device yet.'}
        </div>
      ) : decryptabilityLabel === 'Decryptable' ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-hush-text-accent">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Decrypting restricted message...</span>
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-hush-bg-dark/72 px-4 py-3 text-sm text-hush-text-accent">
          Restricted ciphertext is present. The caller auditor wrap is not available for this
          message yet.
        </div>
      )}

      <div className="mt-4 break-all text-xs text-hush-text-accent">
        Body hash: {message.EncryptedBodyHash}
      </div>
    </div>
  );
}

function RestrictedThreadCard({
  thread,
  decryptedMessages,
}: {
  thread: ElectionAnomalyAuditorRestrictedThreadView;
  decryptedMessages: Record<string, DecryptedMessage>;
}) {
  return (
    <article className="rounded-2xl bg-hush-bg-dark/72 px-5 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-sm font-semibold text-hush-text-primary">
            {CATEGORY_LABELS.get(thread.CategoryId) ?? thread.CategoryId}
          </div>
          <div className="mt-1 text-sm text-hush-text-accent">
            {CASE_STATE_LABELS.get(thread.CaseStateId) ?? thread.CaseStateId}
          </div>
        </div>
        <div className="text-sm text-hush-text-accent">
          Updated {formatTimestamp(thread.UpdatedAt)}
        </div>
      </div>
      <div className="mt-3 grid gap-3 text-xs text-hush-text-accent md:grid-cols-2">
        <div className="break-all">Case id: {thread.AnomalyThreadId}</div>
        <div className="break-all">Thread hash: {thread.CurrentThreadHash}</div>
      </div>
      {thread.GovernedDecisionRef ? (
        <div className="mt-3 rounded-xl bg-hush-bg-element/70 px-4 py-3 text-sm text-hush-text-accent">
          Governed decision reference: {thread.GovernedDecisionRef}
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {thread.Messages.map((message) => (
          <RestrictedMessageCard
            key={message.MessageId}
            message={message}
            decrypted={decryptedMessages[message.MessageId]}
          />
        ))}
      </div>
    </article>
  );
}

export function AuditorAnomalyWorkspacePanel({
  electionId,
  actorPublicAddress,
  actorEncryptionPublicKey,
  actorEncryptionPrivateKey,
  actorSigningPrivateKey,
}: AuditorAnomalyWorkspacePanelProps) {
  const {
    isLoadingDetail,
    loadElection,
    reset,
    selectedElection,
  } = useElectionsStore();
  const [reviewResponse, setReviewResponse] =
    useState<GetElectionAnomalyAuditorRestrictedReviewResponse | null>(null);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [decryptedMessages, setDecryptedMessages] = useState<Record<string, DecryptedMessage>>({});

  useEffect(() => {
    void loadElection(electionId);
  }, [electionId, loadElection]);

  useEffect(() => () => reset(), [reset]);

  const refreshReview = useCallback(async () => {
    setIsLoadingReview(true);
    setReviewError(null);

    try {
      const response = await electionsService.getElectionAnomalyAuditorRestrictedReview({
        ElectionId: electionId,
        ActorPublicAddress: actorPublicAddress,
      });
      setReviewResponse(response);
    } catch (error) {
      setReviewResponse(null);
      setReviewError(
        error instanceof Error
          ? error.message
          : 'Auditor restricted anomaly review could not be loaded.',
      );
    } finally {
      setIsLoadingReview(false);
    }
  }, [actorPublicAddress, electionId]);

  useEffect(() => {
    void refreshReview();
  }, [refreshReview]);

  const election =
    selectedElection?.Election?.ElectionId === electionId ? selectedElection.Election : null;
  const review = reviewResponse?.Success && reviewResponse.HasReview
    ? reviewResponse.Review ?? null
    : null;
  const canCreateThread = Boolean(review && election?.OwnerPublicAddress);
  const reviewThreads = useMemo(
    () => [...(review?.Threads ?? [])].sort(
      (left, right) => (timestampToMillis(right.UpdatedAt) ?? 0) - (timestampToMillis(left.UpdatedAt) ?? 0)
    ),
    [review?.Threads]
  );

  useEffect(() => {
    let isActive = true;
    const messages = reviewThreads.flatMap((thread) => thread.Messages);
    if (messages.length === 0) {
      setDecryptedMessages({});
      return undefined;
    }

    async function decryptMessages(): Promise<void> {
      const next: Record<string, DecryptedMessage> = {};
      await Promise.all(
        messages.map(async (message) => {
          if (getDecryptabilityLabel(message) !== 'Decryptable') {
            return;
          }

          try {
            next[message.MessageId] = {
              status: 'decrypted',
              body: await decryptElectionAnomalyRestrictedMessageBody(
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
        setDecryptedMessages(next);
      }
    }

    void decryptMessages();

    return () => {
      isActive = false;
    };
  }, [actorEncryptionPrivateKey, reviewThreads]);

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
                <span>Auditor anomaly workspace</span>
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-hush-text-primary">
                {election?.Title || 'Auditor anomaly workspace'}
              </h1>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-hush-text-accent">
                Designated auditors can review restricted anomaly cases by case id, thread hash,
                status, and encrypted evidence. Submitter actor references and recipient public
                addresses are not exposed in this view.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refreshReview()}
              disabled={isLoadingReview}
              className="inline-flex self-start items-center gap-2 rounded-xl bg-hush-purple px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="auditor-anomaly-refresh-review"
            >
              {isLoadingReview ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              <span>Refresh review</span>
            </button>
          </div>
        </header>

        <section className={sectionClass} data-testid="auditor-anomaly-review">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-hush-text-accent">
                Restricted anomaly evidence
              </div>
              <h2 className="mt-2 text-xl font-semibold text-hush-text-primary">
                Auditor-visible case review
              </h2>
              <p className="mt-2 max-w-4xl text-sm leading-7 text-hush-text-accent">
                Message bodies decrypt only when this auditor has an available caller wrap. Pending
                backfill rows are visible as operational status, not as usable plaintext access.
              </p>
            </div>
            <div className="rounded-full bg-hush-bg-dark/72 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
              {election ? getLifecycleLabel(election.LifecycleState) : 'Loading'}
            </div>
          </div>

          {isLoadingReview && !reviewResponse ? (
            <div className="mt-5 flex items-center gap-3 rounded-2xl bg-hush-bg-dark/72 px-5 py-5 text-sm text-hush-text-accent">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading auditor restricted review...</span>
            </div>
          ) : null}

          {reviewError ? (
            <div className="mt-5 rounded-2xl bg-red-500/10 px-5 py-4 text-sm text-red-100">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{reviewError}</span>
              </div>
            </div>
          ) : null}

          {reviewResponse && !review ? (
            <div className="mt-5 rounded-2xl bg-amber-500/10 px-5 py-4 text-sm leading-7 text-amber-100">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-1 h-4 w-4 shrink-0" />
                <span>
                  {reviewResponse.ErrorMessage ||
                    'Auditor restricted anomaly review is unavailable for this account.'}
                </span>
              </div>
            </div>
          ) : null}

          {review ? (
            <>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Cases" value={review.TotalThreadCount} />
                <MetricCard
                  label="Decryptable messages"
                  value={review.DecryptableMessageCount}
                  tone={review.DecryptableMessageCount > 0 ? 'success' : 'neutral'}
                />
                <MetricCard
                  label="Pending rewrap"
                  value={review.PendingRewrapMessageCount}
                  tone={review.PendingRewrapMessageCount > 0 ? 'warning' : 'neutral'}
                />
                <MetricCard
                  label="Missing wraps"
                  value={review.MissingWrapMessageCount}
                  tone={review.MissingWrapMessageCount > 0 ? 'warning' : 'neutral'}
                />
              </div>

              <div className="mt-5 space-y-4">
                <AnomalyEvidenceManifestStatusPanel
                  electionId={electionId}
                  actorPublicAddress={actorPublicAddress}
                  actorPrivateEncryptKeyHex={actorEncryptionPrivateKey}
                  scopeId="auditor"
                  title="Auditor evidence manifest"
                  description="Auditor review uses case/thread ids, manifest hashes, recipient wrap status, scanner status, and redaction history without submitter actor references."
                  testId="auditor-anomaly-evidence-manifest"
                />

                {reviewThreads.length > 0 ? (
                  reviewThreads.map((thread) => (
                    <RestrictedThreadCard
                      key={thread.AnomalyThreadId}
                      thread={thread}
                      decryptedMessages={decryptedMessages}
                    />
                  ))
                ) : (
                  <div className="rounded-2xl bg-hush-bg-dark/72 px-5 py-5 text-sm text-hush-text-accent">
                    No anomaly cases are recorded for this election.
                  </div>
                )}
              </div>
            </>
          ) : null}
        </section>

        {isLoadingDetail && !election ? (
          <div className={`${sectionClass} flex items-center gap-3`}>
            <Loader2 className="h-5 w-5 animate-spin text-hush-purple" />
            <span className="text-sm text-hush-text-accent">Loading election details...</span>
          </div>
        ) : null}

        <ElectionAnomalyPanel
          electionId={electionId}
          actorPublicAddress={actorPublicAddress}
          actorEncryptionPublicKey={actorEncryptionPublicKey}
          actorEncryptionPrivateKey={actorEncryptionPrivateKey}
          actorSigningPrivateKey={actorSigningPrivateKey}
          ownerPublicAddress={election?.OwnerPublicAddress ?? ''}
          surface="auditor"
          canReadOwnThread
          canCreateThread={canCreateThread}
          unavailableTitle="Designated auditor access is required to create an auditor anomaly."
          unavailableDescription="Current designated-auditor access is required for new auditor anomaly submission and restricted review. If this account already submitted a thread, own-thread review remains available here."
          lifecycleState={election?.LifecycleState}
          anomalySubmissionWindowClosesAt={election?.AnomalySubmissionWindowClosesAt}
          hasAnomalySubmissionWindowClosesAt={election?.HasAnomalySubmissionWindowClosesAt}
        />
      </div>
    </div>
  );
}
