"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, FileWarning, Files, ShieldCheck } from 'lucide-react';
import type {
  ElectionHubEntryView,
  GetElectionAnomalyTrusteeCountsResponse,
  GetElectionResponse,
} from '@/lib/grpc';
import {
  ElectionCeremonyVersionStatusProto,
  ElectionCloseCountingJobStatusProto,
  ElectionFinalizationSessionPurposeProto,
  ElectionHubNextActionHintProto,
  ElectionGovernedActionTypeProto,
  ElectionGovernedProposalExecutionStatusProto,
} from '@/lib/grpc';
import { electionsService } from '@/lib/grpc/services/elections';
import {
  formatTimestamp,
  getActiveCeremonyVersion,
  getClosedProgressNarrative,
  getCloseCountingJobStatusLabel,
  getFinalizationSessionPurposeLabel,
  getGovernedActionLabel,
  getGovernedProposalExecutionStatusLabel,
  getPublishedResultNarrative,
} from './contracts';
import {
  AvailabilityCard,
  CollapsibleSurfaceSection,
  getLatestProposal,
  timestampToMillis,
} from './HushVotingWorkspaceShared';

type TrusteeWorkspaceSummaryProps = {
  entry: ElectionHubEntryView;
  detail: GetElectionResponse | null;
  actorPublicAddress?: string;
};

export function TrusteeWorkspaceSummary({
  entry,
  detail,
  actorPublicAddress,
}: TrusteeWorkspaceSummaryProps) {
  const [anomalyCountsResponse, setAnomalyCountsResponse] =
    useState<GetElectionAnomalyTrusteeCountsResponse | null>(null);
  const [hasOwnAnomalyThread, setHasOwnAnomalyThread] = useState<boolean | null>(null);
  const [isLoadingAnomalyPreview, setIsLoadingAnomalyPreview] = useState(false);
  const latestProposal = useMemo(() => getLatestProposal(detail), [detail]);
  const activeCeremonyVersion = useMemo(() => getActiveCeremonyVersion(detail), [detail]);
  const latestCloseProposal = useMemo(
    () =>
      (detail?.GovernedProposals ?? [])
        .filter((proposal) => proposal.ActionType === ElectionGovernedActionTypeProto.Close)
        .sort(
          (left, right) =>
            (right.CreatedAt?.seconds ?? 0) - (left.CreatedAt?.seconds ?? 0) ||
            (right.CreatedAt?.nanos ?? 0) - (left.CreatedAt?.nanos ?? 0)
        )[0] ?? null,
    [detail?.GovernedProposals]
  );
  const latestCloseCountingSession = useMemo(
    () =>
      (detail?.FinalizationSessions ?? [])
        .filter(
          (session) =>
            session.SessionPurpose ===
            ElectionFinalizationSessionPurposeProto.FinalizationSessionPurposeCloseCounting
        )
        .sort(
          (left, right) =>
            (right.CreatedAt?.seconds ?? 0) - (left.CreatedAt?.seconds ?? 0) ||
            (right.CreatedAt?.nanos ?? 0) - (left.CreatedAt?.nanos ?? 0)
        )[0] ?? null,
    [detail?.FinalizationSessions]
  );
  const normalizedReason = entry.SuggestedActionReason.trim().toLowerCase();
  const needsGovernedReview =
    entry.SuggestedAction === ElectionHubNextActionHintProto.ElectionHubActionTrusteeApproveGovernedAction;
  const needsCeremonyFollowUp =
    entry.SuggestedAction === ElectionHubNextActionHintProto.ElectionHubActionNone &&
    normalizedReason.startsWith('continue the trustee ceremony.');
  const needsTallyShareFollowUp =
    normalizedReason.startsWith('submit the bound trustee tally share for close-counting.') ||
    normalizedReason.startsWith('resubmit the bound trustee tally share for close-counting.');
  const waitingForCloseThreshold =
    latestCloseProposal &&
    latestCloseProposal.ExecutionStatus ===
      ElectionGovernedProposalExecutionStatusProto.WaitingForApprovals &&
    !latestCloseCountingSession;
  const shareWorkspaceEnabled = Boolean(latestCloseCountingSession);
  const anomalyWindowMillis = timestampToMillis(entry.Election.AnomalySubmissionWindowClosesAt);
  const anomalyWindowOpen =
    !entry.Election.HasAnomalySubmissionWindowClosesAt ||
    !anomalyWindowMillis ||
    anomalyWindowMillis > Date.now();
  const trusteeAnomalyCounts = anomalyCountsResponse?.Success && anomalyCountsResponse.HasCounts
    ? anomalyCountsResponse.Counts ?? null
    : null;
  const continuitySummary = trusteeAnomalyCounts?.ContinuitySummary;
  const publishedResultState = useMemo(
    () => getPublishedResultNarrative(entry, 'trustee'),
    [entry]
  );

  useEffect(() => {
    if (!actorPublicAddress || !entry.ActorRoles.IsTrustee) {
      setAnomalyCountsResponse(null);
      setHasOwnAnomalyThread(null);
      setIsLoadingAnomalyPreview(false);
      return;
    }

    let isCancelled = false;
    setIsLoadingAnomalyPreview(true);

    void Promise.allSettled([
      electionsService.getElectionAnomalyTrusteeCounts({
        ElectionId: entry.Election.ElectionId,
        ActorPublicAddress: actorPublicAddress,
      }),
      electionsService.getElectionAnomalyOwnThread({
        ElectionId: entry.Election.ElectionId,
        ActorPublicAddress: actorPublicAddress,
      }),
    ]).then((results) => {
      if (isCancelled) {
        return;
      }

      const [countsResult, ownThreadResult] = results;
      setAnomalyCountsResponse(
        countsResult.status === 'fulfilled' ? countsResult.value : null
      );
      setHasOwnAnomalyThread(
        ownThreadResult.status === 'fulfilled' && ownThreadResult.value.Success
          ? ownThreadResult.value.HasThread
          : null
      );
      setIsLoadingAnomalyPreview(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [actorPublicAddress, entry.ActorRoles.IsTrustee, entry.Election.ElectionId]);

  const anomalyPreview = useMemo(() => {
    const ownThreadLabel =
      hasOwnAnomalyThread === true
        ? 'Existing report'
        : hasOwnAnomalyThread === false
          ? 'No report yet'
          : isLoadingAnomalyPreview
            ? 'Loading...'
            : 'Open workspace';
    const totalLabel = trusteeAnomalyCounts
      ? `${trusteeAnomalyCounts.TotalThreadCount} total`
      : isLoadingAnomalyPreview
        ? 'Loading...'
        : anomalyCountsResponse && !anomalyCountsResponse.Success
          ? 'Unavailable'
          : 'Open workspace';
    const continuityLabel = continuitySummary?.HasContinuityIssue
      ? `${continuitySummary.OpenContinuityThreadCount} open continuity`
      : trusteeAnomalyCounts
        ? 'None recorded'
        : isLoadingAnomalyPreview
          ? 'Loading...'
          : 'Open workspace';

    return {
      ownThreadLabel,
      totalLabel,
      continuityLabel,
      continuityAccent: continuitySummary?.HasContinuityIssue ? 'text-amber-100' : undefined,
    };
  }, [
    anomalyCountsResponse,
    continuitySummary,
    hasOwnAnomalyThread,
    isLoadingAnomalyPreview,
    trusteeAnomalyCounts,
  ]);
  const closeCountingJobSummary = useMemo(() => {
    if (!latestCloseCountingSession) {
      return null;
    }

    switch (latestCloseCountingSession.CloseCountingJobStatus) {
      case ElectionCloseCountingJobStatusProto.CloseCountingJobThresholdReached:
        return {
          title: 'Threshold reached',
          description:
            'The required trustee shares are recorded. The tally executor is about to start the bound release job.',
        };
      case ElectionCloseCountingJobStatusProto.CloseCountingJobRunning:
        return {
          title: 'Executor running',
          description:
            'The tally executor is validating the bound trustee submissions and combining the exact aggregate tally now.',
        };
      case ElectionCloseCountingJobStatusProto.CloseCountingJobPublishing:
        return {
          title: 'Publishing unofficial result',
          description:
            'Aggregate release succeeded. The tally executor is sealing tally-ready and unofficial-result artifacts now.',
        };
      case ElectionCloseCountingJobStatusProto.CloseCountingJobFailed:
        return {
          title: 'Executor failed',
          description:
            'The bound close-counting job failed. Review the latest failure evidence or retry path before expecting a result.',
        };
      default:
        return null;
    }
  }, [latestCloseCountingSession]);
  const closedTrusteeState = useMemo(
    () => getClosedProgressNarrative(entry, 'trustee'),
    [entry]
  );
  const trusteeSurfaceSummary = useMemo(() => {
    if (needsGovernedReview) {
      return (
        <>
          <span className="font-semibold text-hush-text-primary">Governed approval required.</span> The owner started a
          governed action that still needs this trustee approval.
        </>
      );
    }

    if (needsCeremonyFollowUp) {
      return (
        <>
          <span className="font-semibold text-hush-text-primary">Ceremony follow-up required.</span>{' '}
          {entry.SuggestedActionReason}
        </>
      );
    }

    if (publishedResultState) {
      return (
        <>
          <span className="font-semibold text-hush-text-primary">{publishedResultState.title}.</span>{' '}
          {publishedResultState.description}
        </>
      );
    }

    if (closeCountingJobSummary) {
      return (
        <>
          <span className="font-semibold text-hush-text-primary">{closeCountingJobSummary.title}.</span>{' '}
          {closeCountingJobSummary.description}
        </>
      );
    }

    if (latestCloseCountingSession) {
      return (
        <>
          <span className="font-semibold text-hush-text-primary">
            {closedTrusteeState?.title ?? 'Close-counting share active'}.
          </span>{' '}
          {closedTrusteeState?.description ??
            'The bound tally-release session is ready in the tally share workspace.'}
        </>
      );
    }

    if (waitingForCloseThreshold) {
      return (
        <>
          <span className="font-semibold text-hush-text-primary">Waiting for close threshold.</span>{' '}
          The tally share workspace remains disabled until the governed close reaches threshold and
          the bound close-counting session is created.
        </>
      );
    }

    if (activeCeremonyVersion?.Status === ElectionCeremonyVersionStatusProto.CeremonyVersionReady) {
      return (
        <>
          <span className="font-semibold text-hush-text-primary">Ceremony complete.</span> Key-ceremony work is complete
          for this trustee. This section stays collapsed until new trustee work appears.
        </>
      );
    }

    return (
      <>
        <span className="font-semibold text-hush-text-primary">No trustee action right now.</span> This trustee surface is
        available for context, but it does not currently need attention.
      </>
    );
  }, [
    activeCeremonyVersion?.Status,
    entry.SuggestedActionReason,
    latestCloseCountingSession,
    needsCeremonyFollowUp,
    needsGovernedReview,
    waitingForCloseThreshold,
    publishedResultState,
    closeCountingJobSummary,
    closedTrusteeState,
  ]);

  return (
    <CollapsibleSurfaceSection
      testId="hush-voting-section-trustee"
      toggleTestId="hush-voting-trustee-toggle"
      eyebrow="Trustee Surface"
      title="Governed action, ceremony, and share follow-up"
      description="Trustee actions stay on their explicit pages. This shell keeps the election-specific ceremony, governed-action, and tally-share context visible before you jump into the bound trustee routes."
      summary={trusteeSurfaceSummary}
      defaultExpanded={
        needsGovernedReview ||
        needsCeremonyFollowUp ||
        needsTallyShareFollowUp ||
        Boolean(closeCountingJobSummary)
      }
      actions={
        <>
          <Link
            href={`/elections/${entry.Election.ElectionId}/trustee/ceremony`}
            className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Ceremony workspace</span>
          </Link>
          <Link
            href={`/elections/${entry.Election.ElectionId}/trustee/finalization`}
            aria-disabled={!shareWorkspaceEnabled}
            tabIndex={shareWorkspaceEnabled ? undefined : -1}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark ${
              shareWorkspaceEnabled
                ? 'bg-hush-purple text-white hover:bg-hush-purple/90'
                : 'cursor-not-allowed bg-hush-bg-light text-hush-text-accent pointer-events-none'
            }`}
            title={
              shareWorkspaceEnabled
                ? 'Open the trustee tally share workspace.'
                : 'Tally-share submission unlocks only after close reaches threshold and the close-counting session exists.'
            }
            data-testid="trustee-share-workspace-action"
          >
            <Files className="h-4 w-4" />
            <span>Tally share workspace</span>
          </Link>
          <Link
            href={`/elections/${entry.Election.ElectionId}/trustee/governed`}
            className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
          >
            <ArrowRight className="h-4 w-4" />
            <span>Open governed actions</span>
          </Link>
          <Link
            href={`/elections/${entry.Election.ElectionId}/trustee/anomaly`}
            className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
            data-testid="trustee-anomaly-workspace-action"
          >
            <FileWarning className="h-4 w-4" />
            <span>Anomaly workspace</span>
          </Link>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <AvailabilityCard
          label="Latest governed action"
          value={
            latestProposal
              ? `${getGovernedActionLabel(latestProposal.ActionType)} | ${getGovernedProposalExecutionStatusLabel(latestProposal.ExecutionStatus)}`
              : 'No governed proposal recorded'
          }
        />
        <AvailabilityCard
          label="Ceremony"
          value={
            activeCeremonyVersion
              ? `Version ${activeCeremonyVersion.VersionNumber} | ${formatTimestamp(activeCeremonyVersion.StartedAt)}`
              : 'No active ceremony version'
          }
        />
        <AvailabilityCard
          label="Latest share session"
          value={
            latestCloseCountingSession
              ? `${getFinalizationSessionPurposeLabel(latestCloseCountingSession.SessionPurpose)} | ${getCloseCountingJobStatusLabel(latestCloseCountingSession.CloseCountingJobStatus)}`
              : waitingForCloseThreshold
                ? 'Waiting for close threshold'
                : 'No close-counting session recorded'
          }
        />
      </div>
      <div>
        <div className="mb-3 text-sm font-semibold text-hush-text-primary">
          Anomaly intake and counts
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AvailabilityCard
            label="Your thread"
            value={anomalyPreview.ownThreadLabel}
          />
          <AvailabilityCard
            label="Election anomalies"
            value={anomalyPreview.totalLabel}
          />
          <AvailabilityCard
            label="Trustee continuity"
            value={anomalyPreview.continuityLabel}
            accentClass={anomalyPreview.continuityAccent}
          />
          <AvailabilityCard
            label="New reports"
            value={anomalyWindowOpen ? 'Open' : 'Closed'}
            accentClass={anomalyWindowOpen ? 'text-green-100' : 'text-amber-100'}
          />
        </div>
      </div>
    </CollapsibleSurfaceSection>
  );
}
