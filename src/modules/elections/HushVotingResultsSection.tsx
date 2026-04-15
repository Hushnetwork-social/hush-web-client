"use client";

import Link from 'next/link';
import { Vote } from 'lucide-react';
import type {
  ElectionHubEntryView,
  GetElectionResponse,
  GetElectionResultViewResponse,
} from '@/lib/grpc';
import { ElectionResultArtifactsSection } from './ElectionResultArtifactsSection';
import { getPublishedResultNarrative } from './contracts';
import {
  AvailabilityCard,
  CollapsibleSurfaceSection,
} from './HushVotingWorkspaceShared';

type ResultsWorkspaceSummaryProps = {
  entry: ElectionHubEntryView;
  detail: GetElectionResponse | null;
  resultView: GetElectionResultViewResponse | null;
  isLoadingResultView: boolean;
};

export function ResultsWorkspaceSummary({
  entry,
  detail,
  resultView,
  isLoadingResultView,
}: ResultsWorkspaceSummaryProps) {
  const hasAnyResults =
    entry.HasUnofficialResult ||
    entry.HasOfficialResult ||
    Boolean(resultView?.UnofficialResult || resultView?.OfficialResult);
  const resultTargetId = resultView?.OfficialResult
    ? '#hush-voting-official-result'
    : resultView?.UnofficialResult
      ? '#hush-voting-unofficial-result'
      : null;
  const publishedResultState = getPublishedResultNarrative(entry);
  const resultsSummary = publishedResultState ? (
    <>
      <span className="font-semibold text-hush-text-primary">{publishedResultState.title}.</span>{' '}
      {publishedResultState.description}
    </>
  ) : (
    <>
      <span className="font-semibold text-hush-text-primary">No published result yet.</span> Keep
      this section collapsed until the unofficial or official result is available.
    </>
  );

  return (
    <CollapsibleSurfaceSection
      testId="hush-voting-section-results"
      toggleTestId="hush-voting-results-toggle"
      eyebrow="Published Results"
      title="Election result review"
      description="Published result review stays separate from package and boundary artifacts. The unofficial result appears here first, and the official result later replaces it after finalization."
      summary={resultsSummary}
      defaultExpanded={hasAnyResults}
      actions={
        resultTargetId ? (
          <a
            href={resultTargetId}
            className="inline-flex self-start items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-hush-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
            data-testid="hush-voting-results-open-result"
          >
            <Vote className="h-4 w-4" />
            <span>{resultView?.OfficialResult ? 'Open official result' : 'Open unofficial result'}</span>
          </a>
        ) : entry.ActorRoles.IsVoter && hasAnyResults ? (
          <Link
            href={`/elections/${entry.Election.ElectionId}/voter`}
            className="inline-flex self-start items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-hush-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
          >
            <Vote className="h-4 w-4" />
            <span>Open published result</span>
          </Link>
        ) : null
      }
    >
      <div className="space-y-4">
        <div className="text-sm text-hush-text-accent">
          These indicators come directly from the actor-scoped result view so the client does not
          overstate unofficial or official result access.
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <AvailabilityCard
            label="Unofficial result"
            value={entry.HasUnofficialResult ? 'Published' : 'Pending'}
            accentClass={entry.HasUnofficialResult ? 'text-green-100' : 'text-amber-100'}
          />
          <AvailabilityCard
            label="Official result"
            value={entry.HasOfficialResult ? 'Published' : 'Pending finalization'}
            accentClass={entry.HasOfficialResult ? 'text-green-100' : 'text-amber-100'}
          />
        </div>

        {detail?.ResultArtifacts?.length ? (
          <div className="rounded-2xl bg-hush-bg-dark/70 p-4 shadow-sm shadow-black/10">
            <div className="text-sm font-semibold text-hush-text-primary">Persisted result artifacts</div>
            <div className="mt-2 text-sm text-hush-text-accent">
              {detail.ResultArtifacts.length} artifact
              {detail.ResultArtifacts.length === 1 ? '' : 's'} currently visible on the election
              detail record.
            </div>
          </div>
        ) : null}

        {isLoadingResultView ? (
          <div className="rounded-2xl bg-hush-bg-dark/60 px-4 py-3 text-sm text-hush-text-accent">
            Loading published result details for this actor.
          </div>
        ) : null}

        {detail?.Election ? (
          <ElectionResultArtifactsSection
            election={detail.Election}
            resultView={resultView}
            showReportPackage={false}
          />
        ) : null}
      </div>
    </CollapsibleSurfaceSection>
  );
}
