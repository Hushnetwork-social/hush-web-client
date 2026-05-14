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
  type ElectionAnomalyTrusteeCountsView,
  type ElectionAnomalyTrusteeContinuitySummaryView,
  type GetElectionAnomalyTrusteeCountsResponse,
} from '@/lib/grpc';
import { electionsService } from '@/lib/grpc/services/elections';
import { ElectionAnomalyPanel } from './ElectionAnomalyPanel';
import { getLifecycleLabel } from './contracts';
import { sectionClass } from './HushVotingWorkspaceShared';
import {
  ELECTION_ANOMALY_CATEGORY_IDS,
} from './transactionService';
import { useElectionsStore } from './useElectionsStore';

type TrusteeAnomalyWorkspacePanelProps = {
  electionId: string;
  actorPublicAddress: string;
  actorEncryptionPublicKey: string;
  actorEncryptionPrivateKey: string;
  actorSigningPrivateKey: string;
};

const CLOSED_CASE_STATE_IDS = new Set([
  'resolved_non_blocking',
  'closed_duplicate_followup',
  'closed_no_further_submitter_input',
]);

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
  [ELECTION_ANOMALY_CATEGORY_IDS.ACCESS_OR_AUTHENTICATION, 'Access/auth'],
  [ELECTION_ANOMALY_CATEGORY_IDS.BALLOT_CASTING_OR_RECEIPT, 'Ballot/receipt'],
  [ELECTION_ANOMALY_CATEGORY_IDS.TRUSTEE_CONTINUITY, 'Trustee continuity'],
  [ELECTION_ANOMALY_CATEGORY_IDS.COUNTING_OR_TALLY, 'Counting/tally'],
  [ELECTION_ANOMALY_CATEGORY_IDS.REPORTING_OR_AUDIT_PACKAGE, 'Reporting/audit'],
  [ELECTION_ANOMALY_CATEGORY_IDS.SECURITY_OR_INTEGRITY, 'Security/integrity'],
  [ELECTION_ANOMALY_CATEGORY_IDS.EXTERNAL_OBJECTION_OR_COMPLAINT, 'External complaint'],
  [ELECTION_ANOMALY_CATEGORY_IDS.OTHER_PROCESS, 'Other process'],
]);

function getCaseStateCount(
  counts: ElectionAnomalyTrusteeCountsView | null,
  caseStateId: string,
): number {
  return counts?.CaseStateCounts.find((entry) => entry.CaseStateId === caseStateId)?.Count ?? 0;
}

function getClosedCaseCount(counts: ElectionAnomalyTrusteeCountsView | null): number {
  return counts?.CaseStateCounts
    .filter((entry) => CLOSED_CASE_STATE_IDS.has(entry.CaseStateId))
    .reduce((total, entry) => total + entry.Count, 0) ?? 0;
}

function getOpenCaseCount(counts: ElectionAnomalyTrusteeCountsView | null): number {
  if (!counts) {
    return 0;
  }

  return Math.max(0, counts.TotalThreadCount - getClosedCaseCount(counts));
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

function ContinuitySummary({
  summary,
}: {
  summary?: ElectionAnomalyTrusteeContinuitySummaryView;
}) {
  if (!summary?.HasContinuityIssue) {
    return (
      <div className="rounded-2xl bg-green-500/10 px-5 py-4 text-sm leading-7 text-green-100">
        No trustee-continuity anomaly is recorded in the trustee aggregate projection.
      </div>
    );
  }

  const openContinuityLabel =
    summary.OpenContinuityThreadCount === 1 ? 'anomaly is' : 'anomalies are';

  return (
    <div className="rounded-2xl bg-amber-500/10 px-5 py-4 text-sm leading-7 text-amber-100">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-1 h-4 w-4 shrink-0" />
        <div>
          {summary.OpenContinuityThreadCount} open trustee-continuity {openContinuityLabel}
          recorded. This is intake evidence only; a governed decision is required before trustee
          status, approvals, or close-counting behavior changes.
        </div>
      </div>
    </div>
  );
}

export function TrusteeAnomalyWorkspacePanel({
  electionId,
  actorPublicAddress,
  actorEncryptionPublicKey,
  actorEncryptionPrivateKey,
  actorSigningPrivateKey,
}: TrusteeAnomalyWorkspacePanelProps) {
  const {
    isLoadingDetail,
    loadElection,
    reset,
    selectedElection,
  } = useElectionsStore();
  const [countsResponse, setCountsResponse] =
    useState<GetElectionAnomalyTrusteeCountsResponse | null>(null);
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);
  const [countsError, setCountsError] = useState<string | null>(null);

  useEffect(() => {
    void loadElection(electionId);
  }, [electionId, loadElection]);

  useEffect(() => () => reset(), [reset]);

  const refreshCounts = useCallback(async () => {
    setIsLoadingCounts(true);
    setCountsError(null);

    try {
      const response = await electionsService.getElectionAnomalyTrusteeCounts({
        ElectionId: electionId,
        ActorPublicAddress: actorPublicAddress,
      });
      setCountsResponse(response);
    } catch (error) {
      setCountsResponse(null);
      setCountsError(
        error instanceof Error
          ? error.message
          : 'Trustee anomaly aggregate counts could not be loaded.',
      );
    } finally {
      setIsLoadingCounts(false);
    }
  }, [actorPublicAddress, electionId]);

  useEffect(() => {
    void refreshCounts();
  }, [refreshCounts]);

  const election =
    selectedElection?.Election?.ElectionId === electionId ? selectedElection.Election : null;
  const counts = countsResponse?.Success && countsResponse.HasCounts
    ? countsResponse.Counts ?? null
    : null;
  const aggregateAvailable = Boolean(counts);
  const closedCaseCount = useMemo(() => getClosedCaseCount(counts), [counts]);
  const canCreateThread = aggregateAvailable && Boolean(election?.OwnerPublicAddress);

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
                <span>Trustee anomaly workspace</span>
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-hush-text-primary">
                {election?.Title || 'Trustee anomaly workspace'}
              </h1>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-hush-text-accent">
                Trustees can submit one anomaly, review their own thread, and read body-free
                category and continuity counts. Aggregate counts do not include private bodies,
                submitter names, public addresses, or person-scope ids.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refreshCounts()}
              disabled={isLoadingCounts}
              className="inline-flex self-start items-center gap-2 rounded-xl bg-hush-purple px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="trustee-anomaly-refresh-counts"
            >
              {isLoadingCounts ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              <span>Refresh counts</span>
            </button>
          </div>
        </header>

        <section className={sectionClass} data-testid="trustee-anomaly-aggregate">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-hush-text-accent">
                Body-free anomaly visibility
              </div>
              <h2 className="mt-2 text-xl font-semibold text-hush-text-primary">
                Aggregate counts for accepted trustees
              </h2>
              <p className="mt-2 max-w-4xl text-sm leading-7 text-hush-text-accent">
                This projection is operational visibility only. It stays separate from owner
                triage, governed decisions, approvals, and tally-share submission.
              </p>
            </div>
            <div className="rounded-full bg-hush-bg-dark/72 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
              {election ? getLifecycleLabel(election.LifecycleState) : 'Loading'}
            </div>
          </div>

          {isLoadingCounts && !countsResponse ? (
            <div className="mt-5 flex items-center gap-3 rounded-2xl bg-hush-bg-dark/72 px-5 py-5 text-sm text-hush-text-accent">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading trustee aggregate counts...</span>
            </div>
          ) : null}

          {countsError ? (
            <div className="mt-5 rounded-2xl bg-red-500/10 px-5 py-4 text-sm text-red-100">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{countsError}</span>
              </div>
            </div>
          ) : null}

          {countsResponse && !aggregateAvailable ? (
            <div className="mt-5 rounded-2xl bg-amber-500/10 px-5 py-4 text-sm leading-7 text-amber-100">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-1 h-4 w-4 shrink-0" />
                <span>
                  {countsResponse.ErrorMessage ||
                    'Trustee aggregate visibility is unavailable for this account.'}
                </span>
              </div>
            </div>
          ) : null}

          {counts ? (
            <>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Total anomaly threads" value={counts.TotalThreadCount} />
                <MetricCard label="Open cases" value={getOpenCaseCount(counts)} />
                <MetricCard
                  label="Awaiting info"
                  value={getCaseStateCount(counts, 'authority_requested_information')}
                  tone={getCaseStateCount(counts, 'authority_requested_information') > 0 ? 'warning' : 'neutral'}
                />
                <MetricCard label="Closed cases" value={closedCaseCount} tone="success" />
              </div>

              <div className="mt-5">
                <div className="text-sm font-semibold text-hush-text-primary">
                  Trustee continuity
                </div>
                <div className="mt-3">
                  <ContinuitySummary summary={counts.ContinuitySummary} />
                </div>
                {counts.ContinuitySummary ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard
                      label="Continuity total"
                      value={counts.ContinuitySummary.TrusteeContinuityThreadCount}
                    />
                    <MetricCard
                      label="Open continuity"
                      value={counts.ContinuitySummary.OpenContinuityThreadCount}
                      tone={counts.ContinuitySummary.OpenContinuityThreadCount > 0 ? 'warning' : 'neutral'}
                    />
                    <MetricCard
                      label="Awaiting continuity"
                      value={counts.ContinuitySummary.AwaitingInformationContinuityThreadCount}
                    />
                    <MetricCard
                      label="Governed links"
                      value={counts.ContinuitySummary.GovernedDecisionLinkedCount}
                    />
                  </div>
                ) : null}
              </div>

              <div className="mt-5">
                <div className="text-sm font-semibold text-hush-text-primary">Category counts</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {counts.CategoryCounts.map((entry) => (
                    <div
                      key={entry.CategoryId}
                      className="rounded-full bg-hush-bg-dark/72 px-3 py-1.5 text-sm text-hush-text-primary"
                    >
                      <span className="text-hush-text-accent">
                        {CATEGORY_LABELS.get(entry.CategoryId) ?? entry.CategoryId}
                      </span>{' '}
                      <span className="font-semibold">{entry.Count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {counts.CaseStateCounts.length > 0 ? (
                <div className="mt-5">
                  <div className="text-sm font-semibold text-hush-text-primary">Case states</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {counts.CaseStateCounts.map((entry) => (
                      <div
                        key={entry.CaseStateId}
                        className="rounded-full bg-hush-bg-dark/72 px-3 py-1.5 text-sm text-hush-text-primary"
                      >
                        <span className="text-hush-text-accent">
                          {CASE_STATE_LABELS.get(entry.CaseStateId) ?? entry.CaseStateId}
                        </span>{' '}
                        <span className="font-semibold">{entry.Count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
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
          surface="trustee"
          canReadOwnThread
          canCreateThread={canCreateThread}
          unavailableTitle="Accepted trustee access is required to create a trustee anomaly."
          unavailableDescription="Current accepted trustee status is required for new trustee anomaly submission and aggregate visibility. If this account already submitted a thread, own-thread review remains available here."
          lifecycleState={election?.LifecycleState}
          anomalySubmissionWindowClosesAt={election?.AnomalySubmissionWindowClosesAt}
          hasAnomalySubmissionWindowClosesAt={election?.HasAnomalySubmissionWindowClosesAt}
        />
      </div>
    </div>
  );
}
