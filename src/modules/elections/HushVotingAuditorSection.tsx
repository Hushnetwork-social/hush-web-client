"use client";

import { Files, Vote } from 'lucide-react';
import type {
  ElectionHubEntryView,
  GetElectionResponse,
  GetElectionResultViewResponse,
} from '@/lib/grpc';
import { ReadOnlyGovernedActionSummary } from './ReadOnlyGovernedActionSummary';
import { AvailabilityCard } from './HushVotingWorkspaceShared';

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
  const resultTargetId = resultView?.OfficialResult
    ? 'hush-voting-official-result'
    : resultView?.UnofficialResult
      ? 'hush-voting-unofficial-result'
      : null;

  return (
    <section className="space-y-5 pt-4 md:pt-6" data-testid="hush-voting-section-auditor">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-hush-text-accent">
          Auditor Surface
        </div>
        <h2 className="mt-2 text-xl font-semibold text-hush-text-primary">
          Read-only governance and package access
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
          Designated-auditor access stays read-only here. The shell mirrors server-approved
          package and governance visibility without introducing any auditor-only mutation path.
        </p>
      </div>

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
      ) : hasReportPackage || resultTargetId ? (
        <div className="flex flex-wrap gap-3">
          {hasReportPackage ? (
            <a
              href="#hush-voting-report-package"
              className="inline-flex items-center gap-2 rounded-full bg-[#1b2544] px-4 py-2 text-sm font-medium text-hush-text-primary transition-colors hover:bg-[#243158]"
              data-testid="hush-voting-open-report-package"
            >
              <Files className="h-4 w-4" />
              <span>Open report package</span>
            </a>
          ) : null}
          {resultTargetId ? (
            <a
              href={`#${resultTargetId}`}
              className="inline-flex items-center gap-2 rounded-full bg-[#1b2544] px-4 py-2 text-sm font-medium text-hush-text-primary transition-colors hover:bg-[#243158]"
              data-testid="hush-voting-open-auditor-result"
            >
              <Vote className="h-4 w-4" />
              <span>{resultView?.OfficialResult ? 'Open official result' : 'Open unofficial result'}</span>
            </a>
          ) : null}
        </div>
      ) : null}

      {detail ? (
        <ReadOnlyGovernedActionSummary detail={detail} />
      ) : null}
    </section>
  );
}
