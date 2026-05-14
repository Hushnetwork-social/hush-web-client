"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { FileWarning } from 'lucide-react';
import type {
  ElectionHubEntryView,
  GetElectionAnomalyAuditorRestrictedReviewResponse,
  GetElectionResponse,
  GetElectionResultViewResponse,
} from '@/lib/grpc';
import { electionsService } from '@/lib/grpc/services/elections';
import {
  getClosedProgressNarrative,
  getPublishedResultNarrative,
} from './contracts';
import { ReadOnlyGovernedActionSummary } from './ReadOnlyGovernedActionSummary';
import {
  AvailabilityCard,
  CollapsibleSurfaceSection,
} from './HushVotingWorkspaceShared';

type AuditorWorkspaceSummaryProps = {
  entry: ElectionHubEntryView;
  detail: GetElectionResponse | null;
  resultView: GetElectionResultViewResponse | null;
  isLoadingResultView: boolean;
  actorPublicAddress?: string;
};

export function AuditorWorkspaceSummary({
  entry,
  detail,
  resultView,
  isLoadingResultView,
  actorPublicAddress,
}: AuditorWorkspaceSummaryProps) {
  const [reviewResponse, setReviewResponse] =
    useState<GetElectionAnomalyAuditorRestrictedReviewResponse | null>(null);
  const [hasOwnAnomalyThread, setHasOwnAnomalyThread] = useState<boolean | null>(null);
  const [isLoadingAnomalyPreview, setIsLoadingAnomalyPreview] = useState(false);
  const hasReportPackage = Boolean(resultView?.CanViewReportPackage && resultView?.LatestReportPackage);
  const publishedResultState = useMemo(
    () => getPublishedResultNarrative(entry, 'auditor'),
    [entry]
  );
  const closedAuditorState = useMemo(
    () => getClosedProgressNarrative(entry, 'auditor'),
    [entry]
  );
  const restrictedReview = reviewResponse?.Success && reviewResponse.HasReview
    ? reviewResponse.Review ?? null
    : null;
  const decryptableLabel = restrictedReview
    ? `${restrictedReview.DecryptableMessageCount} decryptable`
    : isLoadingAnomalyPreview
      ? 'Loading...'
      : reviewResponse && !reviewResponse.Success
        ? 'Unavailable'
        : 'Open workspace';
  const ownThreadLabel =
    hasOwnAnomalyThread === true
      ? 'Existing report'
      : hasOwnAnomalyThread === false
        ? 'No report yet'
        : isLoadingAnomalyPreview
          ? 'Loading...'
          : 'Open workspace';
  const pendingWrapLabel = restrictedReview
    ? `${restrictedReview.PendingRewrapMessageCount + restrictedReview.MissingWrapMessageCount} need wrap`
    : isLoadingAnomalyPreview
      ? 'Loading...'
      : 'Open workspace';

  useEffect(() => {
    if (!actorPublicAddress || !entry.ActorRoles.IsDesignatedAuditor) {
      setReviewResponse(null);
      setHasOwnAnomalyThread(null);
      setIsLoadingAnomalyPreview(false);
      return;
    }

    let isCancelled = false;
    setIsLoadingAnomalyPreview(true);

    void Promise.allSettled([
      electionsService.getElectionAnomalyAuditorRestrictedReview({
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

      const [reviewResult, ownThreadResult] = results;
      setReviewResponse(reviewResult.status === 'fulfilled' ? reviewResult.value : null);
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
  }, [actorPublicAddress, entry.ActorRoles.IsDesignatedAuditor, entry.Election.ElectionId]);

  const auditorSummary = publishedResultState ? (
    <>
      <span className="font-semibold text-hush-text-primary">{publishedResultState.title}.</span>{' '}
      {publishedResultState.description}
    </>
  ) : closedAuditorState ? (
    <>
      <span className="font-semibold text-hush-text-primary">{closedAuditorState.title}.</span>{' '}
      {closedAuditorState.description}
    </>
  ) : (
    <>
      <span className="font-semibold text-hush-text-primary">No auditor action right now.</span>{' '}
      This surface stays available for read-only governance and package context.
    </>
  );

  return (
    <CollapsibleSurfaceSection
      testId="hush-voting-section-auditor"
      toggleTestId="hush-voting-auditor-toggle"
      eyebrow="Auditor Surface"
      title="Read-only governance and package access"
      description="Designated-auditor access stays read-only here. Published results and report packages are exposed through their own dedicated sections, while this surface keeps governance context available."
      summary={auditorSummary}
      defaultExpanded={false}
      actions={
        <Link
          href={`/elections/${entry.Election.ElectionId}/auditor/anomaly`}
          className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
          data-testid="auditor-anomaly-workspace-action"
        >
          <FileWarning className="h-4 w-4" />
          <span>Anomaly workspace</span>
        </Link>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AvailabilityCard
          label="Report package"
          value={entry.CanViewReportPackage ? 'Granted' : 'Not granted'}
          accentClass={entry.CanViewReportPackage ? 'text-green-100' : undefined}
        />
        <AvailabilityCard
          label="Named roster"
          value={entry.CanViewNamedParticipationRoster ? 'Visible' : 'Restricted'}
          accentClass={entry.CanViewNamedParticipationRoster ? 'text-green-100' : undefined}
        />
        <AvailabilityCard
          label="Participant results"
          value={entry.CanViewParticipantResults ? 'Visible' : 'Restricted'}
          accentClass={entry.CanViewParticipantResults ? 'text-green-100' : undefined}
        />
        <AvailabilityCard
          label="Anomaly review"
          value={restrictedReview ? `${restrictedReview.TotalThreadCount} cases` : decryptableLabel}
          accentClass={restrictedReview ? 'text-green-100' : undefined}
        />
      </div>

      <div>
        <div className="mb-3 text-sm font-semibold text-hush-text-primary">
          Anomaly evidence access
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <AvailabilityCard
            label="Your thread"
            value={ownThreadLabel}
          />
          <AvailabilityCard
            label="Decryptable messages"
            value={decryptableLabel}
            accentClass={restrictedReview?.DecryptableMessageCount ? 'text-green-100' : undefined}
          />
          <AvailabilityCard
            label="Rewrap status"
            value={pendingWrapLabel}
            accentClass={
              restrictedReview &&
              restrictedReview.PendingRewrapMessageCount + restrictedReview.MissingWrapMessageCount > 0
                ? 'text-amber-100'
                : undefined
            }
          />
        </div>
      </div>

      {isLoadingResultView ? (
        <div className="rounded-2xl bg-hush-bg-dark/60 px-4 py-3 text-sm text-hush-text-accent">
          Loading the auditor-visible package and result surfaces for this election.
        </div>
      ) : null}

      {detail ? (
        <ReadOnlyGovernedActionSummary detail={detail} />
      ) : null}
      {hasReportPackage ? (
        <div className="rounded-2xl bg-hush-bg-dark/70 px-4 py-3 text-sm text-hush-text-accent shadow-sm shadow-black/10">
          Report package access is available through the separate artifact and package section.
        </div>
      ) : null}
    </CollapsibleSurfaceSection>
  );
}
