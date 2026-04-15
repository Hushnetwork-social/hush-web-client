"use client";

import { useMemo } from 'react';
import type {
  ElectionHubEntryView,
  GetElectionResponse,
  GetElectionResultViewResponse,
} from '@/lib/grpc';
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
};

export function AuditorWorkspaceSummary({
  entry,
  detail,
  resultView,
  isLoadingResultView,
}: AuditorWorkspaceSummaryProps) {
  const hasReportPackage = Boolean(resultView?.CanViewReportPackage && resultView?.LatestReportPackage);
  const publishedResultState = useMemo(
    () => getPublishedResultNarrative(entry, 'auditor'),
    [entry]
  );
  const closedAuditorState = useMemo(
    () => getClosedProgressNarrative(entry, 'auditor'),
    [entry]
  );
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
    >
      <div className="grid gap-4 md:grid-cols-3">
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
