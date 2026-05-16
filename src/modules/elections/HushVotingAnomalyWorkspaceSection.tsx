"use client";

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { FileWarning, Loader2, RefreshCcw } from 'lucide-react';
import {
  type ElectionAnomalyOwnerTriageThreadView,
  type ElectionAnomalyOwnThreadView,
  type ElectionHubEntryView,
  type GetElectionAnomalyOwnThreadResponse,
} from '@/lib/grpc';
import { electionsService } from '@/lib/grpc/services/elections';
import { formatTimestamp } from './contracts';
import {
  ELECTION_ANOMALY_CASE_STATE_IDS,
  ELECTION_ANOMALY_ACTOR_ROLE_CONTEXT_IDS,
  ELECTION_ANOMALY_CATEGORY_IDS,
  ELECTION_ANOMALY_MESSAGE_KIND_IDS,
} from './transactionService';
import { AvailabilityCard, CollapsibleSurfaceSection } from './HushVotingWorkspaceShared';

type HushVotingAnomalyWorkspaceSectionProps = {
  entry: ElectionHubEntryView;
  actorPublicAddress: string;
};

const CATEGORY_LABELS = new Map<string, string>([
  [ELECTION_ANOMALY_CATEGORY_IDS.ACCESS_OR_AUTHENTICATION, 'Access or authentication'],
  [ELECTION_ANOMALY_CATEGORY_IDS.BALLOT_CASTING_OR_RECEIPT, 'Ballot casting or receipt'],
  [ELECTION_ANOMALY_CATEGORY_IDS.TRUSTEE_CONTINUITY, 'Trustee continuity'],
  [ELECTION_ANOMALY_CATEGORY_IDS.COUNTING_OR_TALLY, 'Counting or tally'],
  [ELECTION_ANOMALY_CATEGORY_IDS.REPORTING_OR_AUDIT_PACKAGE, 'Reporting or audit package'],
  [ELECTION_ANOMALY_CATEGORY_IDS.SECURITY_OR_INTEGRITY, 'Security or integrity'],
  [ELECTION_ANOMALY_CATEGORY_IDS.EXTERNAL_OBJECTION_OR_COMPLAINT, 'External objection or complaint'],
  [ELECTION_ANOMALY_CATEGORY_IDS.OTHER_PROCESS, 'Other process anomaly'],
]);

const CASE_STATE_LABELS = new Map<string, string>([
  [ELECTION_ANOMALY_CASE_STATE_IDS.SUBMITTED, 'Submitted'],
  [ELECTION_ANOMALY_CASE_STATE_IDS.UNDER_REVIEW, 'Under review'],
  [ELECTION_ANOMALY_CASE_STATE_IDS.AUTHORITY_REQUESTED_INFORMATION, 'Awaiting information'],
  [ELECTION_ANOMALY_CASE_STATE_IDS.SUBMITTER_INFORMATION_PROVIDED, 'Information provided'],
  [ELECTION_ANOMALY_CASE_STATE_IDS.OWNER_RESPONDED, 'Authority responded'],
  [ELECTION_ANOMALY_CASE_STATE_IDS.ESCALATED_TO_GOVERNED_DECISION, 'Governed decision reference'],
  [ELECTION_ANOMALY_CASE_STATE_IDS.RESOLVED_NON_BLOCKING, 'Resolved non-blocking'],
  [ELECTION_ANOMALY_CASE_STATE_IDS.CLOSED_DUPLICATE_FOLLOWUP, 'Closed duplicate'],
  [ELECTION_ANOMALY_CASE_STATE_IDS.CLOSED_NO_FURTHER_SUBMITTER_INPUT, 'Closed no response'],
]);
const ANOMALY_WORKSPACE_SEEN_STORAGE_PREFIX = 'feat123:anomaly-workspace-seen-authority';
const CLARIFICATION_RESPONSE_STORAGE_PREFIX = 'feat123:anomaly-clarification-response';

function hasElectionRole(entry: ElectionHubEntryView): boolean {
  return (
    entry.ActorRoles.IsOwnerAdmin ||
    entry.ActorRoles.IsTrustee ||
    entry.ActorRoles.IsVoter ||
    entry.ActorRoles.IsDesignatedAuditor
  );
}

function categoryLabel(categoryId: string): string {
  return CATEGORY_LABELS.get(categoryId) ?? categoryId;
}

type AnomalyThreadSummary = Pick<
  ElectionAnomalyOwnThreadView | ElectionAnomalyOwnerTriageThreadView,
  'CaseStateId' | 'HasOpenClarificationRequest' | 'Messages'
>;

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

function caseStateLabel(
  thread: AnomalyThreadSummary,
  hasActionableClarificationRequest = thread.HasOpenClarificationRequest,
): string {
  if (hasActionableClarificationRequest) {
    return 'Waiting for my reply';
  }

  if (thread.CaseStateId === ELECTION_ANOMALY_CASE_STATE_IDS.AUTHORITY_REQUESTED_INFORMATION) {
    const hasAuthorityRequest = thread.Messages.some((message) =>
      message.MessageKindId === ELECTION_ANOMALY_MESSAGE_KIND_IDS.AUTHORITY_INFORMATION_REQUEST);
    const hasSubmitterReply = thread.Messages.some((message) =>
      message.MessageKindId === ELECTION_ANOMALY_MESSAGE_KIND_IDS.SUBMITTER_INFORMATION_RESPONSE);
    const hasAuthorityResponse = thread.Messages.some((message) =>
      message.MessageKindId === ELECTION_ANOMALY_MESSAGE_KIND_IDS.AUTHORITY_RESPONSE);

    if (hasSubmitterReply) {
      return 'Information provided';
    }

    if (hasAuthorityResponse) {
      return 'Authority response recorded';
    }

    if (hasAuthorityRequest) {
      return 'Clarification closed';
    }

    return 'Under review';
  }

  return CASE_STATE_LABELS.get(thread.CaseStateId) ?? thread.CaseStateId;
}

function latestAuthorityMessageLabel(thread: AnomalyThreadSummary): string {
  const latestAuthorityMessage = getLatestAuthorityMessage(thread);

  if (!latestAuthorityMessage) {
    return 'No authority message yet';
  }

  return latestAuthorityMessage.MessageKindId === ELECTION_ANOMALY_MESSAGE_KIND_IDS.AUTHORITY_RESPONSE
    ? 'Authority response recorded'
    : 'Clarification requested';
}

function getLatestAuthorityMessage(thread: AnomalyThreadSummary) {
  return thread.Messages
    .slice()
    .reverse()
    .find((message) =>
      message.MessageKindId === ELECTION_ANOMALY_MESSAGE_KIND_IDS.AUTHORITY_INFORMATION_REQUEST ||
      message.MessageKindId === ELECTION_ANOMALY_MESSAGE_KIND_IDS.AUTHORITY_RESPONSE);
}

function getLatestOpenClarificationRequestId(thread: AnomalyThreadSummary): string {
  if (!thread.HasOpenClarificationRequest) {
    return '';
  }

  const latestRequestIndex = thread.Messages
    .map((message, index) => ({ message, index }))
    .reverse()
    .find(({ message }) =>
      message.MessageKindId === ELECTION_ANOMALY_MESSAGE_KIND_IDS.AUTHORITY_INFORMATION_REQUEST &&
      message.ClarificationRequestId)?.index ?? -1;

  if (latestRequestIndex < 0) {
    return '';
  }

  const requestMessage = thread.Messages[latestRequestIndex];
  const hasSubmitterReplyAfterRequest = thread.Messages
    .slice(latestRequestIndex + 1)
    .some((message) =>
      message.MessageKindId === ELECTION_ANOMALY_MESSAGE_KIND_IDS.SUBMITTER_INFORMATION_RESPONSE &&
      (!requestMessage.ClarificationRequestId ||
        message.ClarificationRequestId === requestMessage.ClarificationRequestId));

  return hasSubmitterReplyAfterRequest ? '' : requestMessage.ClarificationRequestId;
}

function authorityMessageSeenStorageKey(
  electionId: string,
  actorPublicAddress: string,
  anomalyThreadId: string,
): string {
  return `${ANOMALY_WORKSPACE_SEEN_STORAGE_PREFIX}:${electionId}:${actorPublicAddress.trim()}:${anomalyThreadId}`;
}

function loadSeenAuthorityMessageKey(
  electionId: string,
  actorPublicAddress: string,
  anomalyThreadId: string,
): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.localStorage.getItem(
    authorityMessageSeenStorageKey(electionId, actorPublicAddress, anomalyThreadId),
  ) ?? '';
}

function saveSeenAuthorityMessageKey(
  electionId: string,
  actorPublicAddress: string,
  anomalyThreadId: string,
  authorityMessageKey: string,
): void {
  if (typeof window !== 'undefined' && authorityMessageKey) {
    window.localStorage.setItem(
      authorityMessageSeenStorageKey(electionId, actorPublicAddress, anomalyThreadId),
      authorityMessageKey,
    );
  }
}

function loadSubmittedClarificationResponses(
  electionId: string,
  actorPublicAddress: string,
): Set<string> {
  if (typeof window === 'undefined') {
    return new Set();
  }

  const rawValue = window.sessionStorage.getItem(
    `${CLARIFICATION_RESPONSE_STORAGE_PREFIX}:${electionId}:${actorPublicAddress.trim()}`,
  );
  if (!rawValue) {
    return new Set();
  }

  try {
    const parsedValue = JSON.parse(rawValue) as unknown;
    return new Set(Array.isArray(parsedValue) ? parsedValue.filter((item) => typeof item === 'string') : []);
  } catch {
    return new Set();
  }
}

export function HushVotingAnomalyWorkspaceSection({
  entry,
  actorPublicAddress,
}: HushVotingAnomalyWorkspaceSectionProps) {
  const [ownThreadResponse, setOwnThreadResponse] =
    useState<GetElectionAnomalyOwnThreadResponse | null>(null);
  const [ownerRegisteredThread, setOwnerRegisteredThread] =
    useState<ElectionAnomalyOwnerTriageThreadView | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [seenAuthorityMessageKeyOverrides, setSeenAuthorityMessageKeyOverrides] =
    useState<Record<string, string>>({});

  const canOpenOwnWorkspace = !entry.CanClaimIdentity && hasElectionRole(entry);
  const electionId = entry.Election.ElectionId;

  const loadOwnerRegisteredThread = useCallback(async (): Promise<ElectionAnomalyOwnerTriageThreadView | null> => {
    try {
      const response = await electionsService.getElectionAnomalyOwnerTriage({
        ElectionId: electionId,
        ActorPublicAddress: actorPublicAddress,
      });
      return response.Success && response.HasTriage && response.Triage
        ? response.Triage.Threads.find((thread) =>
          isRegisteredByCurrentAccountThread(thread, actorPublicAddress)) ?? null
        : null;
    } catch {
      return null;
    }
  }, [actorPublicAddress, electionId]);

  async function loadOwnThread(): Promise<void> {
    if (!canOpenOwnWorkspace) {
      setOwnThreadResponse(null);
      setOwnerRegisteredThread(null);
      return;
    }

    setIsLoading(true);
    try {
      const response = await electionsService.getElectionAnomalyOwnThread({
        ElectionId: electionId,
        ActorPublicAddress: actorPublicAddress,
      });
      setOwnThreadResponse(response);
      if (response.Success && !response.HasThread) {
        setOwnerRegisteredThread(await loadOwnerRegisteredThread());
      } else {
        setOwnerRegisteredThread(null);
      }
    } catch {
      setOwnThreadResponse({
        Success: false,
        ErrorMessage: 'My anomaly thread could not be loaded.',
        ActorPublicAddress: actorPublicAddress,
        HasThread: false,
      });
      setOwnerRegisteredThread(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isActive = true;

    if (!canOpenOwnWorkspace) {
      setOwnThreadResponse(null);
      setOwnerRegisteredThread(null);
      setIsLoading(false);
      return () => {
        isActive = false;
      };
    }

    setIsLoading(true);
    void electionsService.getElectionAnomalyOwnThread({
      ElectionId: electionId,
      ActorPublicAddress: actorPublicAddress,
    }).then(async (response) => {
        if (isActive) {
          setOwnThreadResponse(response);
          if (response.Success && !response.HasThread) {
            setOwnerRegisteredThread(await loadOwnerRegisteredThread());
          } else {
            setOwnerRegisteredThread(null);
          }
          setIsLoading(false);
        }
      },
      () => {
        if (isActive) {
          setOwnThreadResponse({
            Success: false,
            ErrorMessage: 'My anomaly thread could not be loaded.',
            ActorPublicAddress: actorPublicAddress,
            HasThread: false,
          });
          setOwnerRegisteredThread(null);
          setIsLoading(false);
        }
      },
    );

    return () => {
      isActive = false;
    };
  }, [actorPublicAddress, canOpenOwnWorkspace, electionId, loadOwnerRegisteredThread]);

  const thread =
    ownThreadResponse?.Success && ownThreadResponse.HasThread
      ? ownThreadResponse.Thread ?? null
      : null;
  const visibleThread = thread ?? ownerRegisteredThread;
  const hasThread = Boolean(visibleThread);
  const hasOwnerRegisteredThread = Boolean(!thread && ownerRegisteredThread);
  const latestAuthorityThreadMessage = visibleThread ? getLatestAuthorityMessage(visibleThread) : null;
  const latestAuthorityMessageKey = visibleThread && latestAuthorityThreadMessage
    ? `${visibleThread.AnomalyThreadId}:${latestAuthorityThreadMessage.MessageId}`
    : '';
  const latestOpenClarificationRequestId = visibleThread
    ? getLatestOpenClarificationRequestId(visibleThread)
    : '';
  const submittedClarificationResponseKey = visibleThread && latestOpenClarificationRequestId
    ? `${visibleThread.AnomalyThreadId}:${latestOpenClarificationRequestId}`
    : '';
  const hasLocallySubmittedClarificationResponse = Boolean(
    submittedClarificationResponseKey &&
    loadSubmittedClarificationResponses(electionId, actorPublicAddress)
      .has(submittedClarificationResponseKey),
  );
  const hasActionableClarificationRequest = Boolean(
    latestOpenClarificationRequestId && !hasLocallySubmittedClarificationResponse,
  );
  const seenStorageKey = visibleThread
    ? authorityMessageSeenStorageKey(electionId, actorPublicAddress, visibleThread.AnomalyThreadId)
    : '';
  const seenAuthorityMessageKey = visibleThread
    ? seenAuthorityMessageKeyOverrides[seenStorageKey] ||
      loadSeenAuthorityMessageKey(electionId, actorPublicAddress, visibleThread.AnomalyThreadId)
    : '';
  const hasSeenAuthorityMessageMarker = Boolean(seenAuthorityMessageKey);
  const latestAuthorityRequestWasLocallyAnswered = Boolean(
    latestAuthorityThreadMessage?.MessageKindId ===
      ELECTION_ANOMALY_MESSAGE_KIND_IDS.AUTHORITY_INFORMATION_REQUEST &&
    hasLocallySubmittedClarificationResponse,
  );
  const hasUnseenAuthorityMessage = Boolean(
    latestAuthorityMessageKey &&
    hasSeenAuthorityMessageMarker &&
    latestAuthorityMessageKey !== seenAuthorityMessageKey &&
    !latestAuthorityRequestWasLocallyAnswered,
  );
  const needsSubmitterAttention = Boolean(
    hasActionableClarificationRequest || hasUnseenAuthorityMessage,
  );
  const statusTitle = isLoading && !ownThreadResponse
    ? 'Checking my anomaly thread'
    : !ownThreadResponse
      ? 'Thread status not loaded'
      : !ownThreadResponse.Success
        ? 'Thread unavailable'
        : hasOwnerRegisteredThread
          ? 'Registered external claimant report'
        : thread
          ? caseStateLabel(thread, hasActionableClarificationRequest)
          : 'No anomaly submitted';
  const statusDetail = !ownThreadResponse
    ? 'The workspace will show the current account anomaly thread when it loads.'
    : !ownThreadResponse.Success
      ? ownThreadResponse.ErrorMessage || 'The anomaly thread could not be loaded for this account.'
      : hasOwnerRegisteredThread
        ? 'This account registered an external claimant report. Open the workspace to read the submitted body and authority history for that registered report.'
      : hasThread
        ? 'Open the workspace to read the submitted report, authority messages, and any clarification replies for this account.'
        : 'Open the workspace to submit one anomaly report for this account.';
  const summary = hasActionableClarificationRequest
    ? 'Clarification is requested. Expand this section or open the workspace to answer the authority request.'
    : hasUnseenAuthorityMessage
      ? 'New authority activity is available on this anomaly thread.'
      : statusDetail;

  useEffect(() => {
    if (
      !canOpenOwnWorkspace ||
      !visibleThread ||
      !latestAuthorityMessageKey ||
      hasActionableClarificationRequest ||
      hasSeenAuthorityMessageMarker
    ) {
      return;
    }

    saveSeenAuthorityMessageKey(
      electionId,
      actorPublicAddress,
      visibleThread.AnomalyThreadId,
      latestAuthorityMessageKey,
    );
    setSeenAuthorityMessageKeyOverrides((current) => ({
      ...current,
      [seenStorageKey]: latestAuthorityMessageKey,
    }));
  }, [
    actorPublicAddress,
    canOpenOwnWorkspace,
    electionId,
    hasActionableClarificationRequest,
    hasSeenAuthorityMessageMarker,
    latestAuthorityMessageKey,
    seenStorageKey,
    visibleThread,
  ]);

  if (!canOpenOwnWorkspace) {
    return null;
  }

  function markLatestAuthorityMessageSeen(): void {
    if (!visibleThread || !latestAuthorityMessageKey || hasActionableClarificationRequest) {
      return;
    }

    saveSeenAuthorityMessageKey(
      electionId,
      actorPublicAddress,
      visibleThread.AnomalyThreadId,
      latestAuthorityMessageKey,
    );
    setSeenAuthorityMessageKeyOverrides((current) => ({
      ...current,
      [seenStorageKey]: latestAuthorityMessageKey,
    }));
  }

  return (
    <CollapsibleSurfaceSection
      testId="hush-voting-my-anomaly-workspace"
      toggleTestId="hush-voting-my-anomaly-workspace-toggle"
      eyebrow="My anomaly workspace"
      title="My anomaly thread"
      description="This is only the current account's own anomaly thread. Other people's anomaly cases stay in authority triage and restricted auditor review."
      summary={
        <>
          <span className="font-semibold text-hush-text-primary">{statusTitle}.</span>{' '}
          <span>{summary}</span>
        </>
      }
      defaultExpanded={needsSubmitterAttention}
      actions={
        <>
          <button
            type="button"
            onClick={() => void loadOwnThread()}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-hush-bg-dark/80 px-4 py-2 text-sm font-medium text-hush-text-primary transition-colors hover:bg-hush-bg-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            <span>Refresh status</span>
          </button>
          <Link
            href={`/elections/${electionId}/anomaly`}
            onClick={markLatestAuthorityMessageSeen}
            className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple"
          >
            <FileWarning className="h-4 w-4" />
            <span>Open my anomaly workspace</span>
          </Link>
        </>
      }
      onExpansionChange={(isExpanded) => {
        if (!isExpanded) {
          markLatestAuthorityMessageSeen();
        }
      }}
    >

      <div className="rounded-2xl bg-hush-bg-dark/70 p-4">
        <div className="text-sm font-semibold text-hush-text-primary">
          {statusTitle}
        </div>
        <p className="mt-2 max-w-4xl text-sm leading-7 text-hush-text-accent">
          {statusDetail}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AvailabilityCard
          label="Report"
          value={hasThread ? 'Submitted' : 'Not submitted'}
          accentClass={hasThread ? 'text-hush-text-primary' : 'text-hush-text-accent'}
        />
        <AvailabilityCard
          label="Category"
          value={visibleThread ? categoryLabel(visibleThread.CategoryId) : 'Not selected'}
        />
        <AvailabilityCard
          label="Messages"
          value={visibleThread ? `${visibleThread.Messages.length}` : '0'}
        />
        <AvailabilityCard
          label="Latest authority message"
          value={visibleThread ? latestAuthorityMessageLabel(visibleThread) : 'None'}
        />
      </div>

      {visibleThread ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-hush-bg-dark/70 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
              Thread
            </div>
            <div className="mt-2 break-all text-sm font-medium text-hush-text-primary">
              {visibleThread.AnomalyThreadId}
            </div>
          </div>
          <div className="rounded-2xl bg-hush-bg-dark/70 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
              Updated
            </div>
            <div className="mt-2 text-sm font-medium text-hush-text-primary">
              {formatTimestamp(visibleThread.UpdatedAt)}
            </div>
          </div>
        </div>
      ) : null}
    </CollapsibleSurfaceSection>
  );
}
