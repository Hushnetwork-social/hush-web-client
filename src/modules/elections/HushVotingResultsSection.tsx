"use client";

import Link from 'next/link';
import { Files, Vote } from 'lucide-react';
import type {
  ElectionHubEntryView,
  GetElectionResponse,
  GetElectionResultViewResponse,
} from '@/lib/grpc';
import { ElectionHubNextActionHintProto } from '@/lib/grpc';
import { ElectionResultArtifactsSection } from './ElectionResultArtifactsSection';
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
  const hasReportPackage = Boolean(resultView?.CanViewReportPackage && resultView?.LatestReportPackage);
  const keepsResultsInsideVoterDetails = entry.ActorRoles.IsVoter || entry.CanClaimIdentity;
  const showsWorkspaceResults = !keepsResultsInsideVoterDetails;
  const hasWorkspaceResults = showsWorkspaceResults && hasAnyResults;
  const hasWorkspaceArtifacts =
    entry.CanViewReportPackage || entry.CanViewNamedParticipationRoster || hasReportPackage;
  const canOpenResultDetail = entry.ActorRoles.IsVoter && hasAnyResults;
  const usesAuditorPrimaryActions = entry.ActorRoles.IsDesignatedAuditor;
  const resultTargetId = resultView?.OfficialResult
    ? '#hush-voting-official-result'
    : resultView?.UnofficialResult
      ? '#hush-voting-unofficial-result'
      : null;
  const shouldExpandResults =
    hasAnyResults ||
    hasReportPackage ||
    entry.SuggestedAction === ElectionHubNextActionHintProto.ElectionHubActionAuditorReviewPackage;

  const sectionTitle = showsWorkspaceResults ? 'Results and Boundary Artifacts' : 'Boundary Artifacts';
  const sectionSubtitle = showsWorkspaceResults
    ? 'Result and package availability'
    : 'Artifact and package availability';
  const sectionDescription = showsWorkspaceResults
    ? hasWorkspaceResults || hasReportPackage
      ? 'Result or report-package access is available for this election.'
      : 'No unofficial result, official result, or report package is available yet. Expand this section only if you need the access boundaries.'
    : hasWorkspaceArtifacts
      ? 'Admin or auditor-only boundary artifacts remain available in this workspace.'
      : 'No owner or auditor artifact package is available yet.';
  const resultsSummary = hasAnyResults
    ? (
        <>
          <span className="font-semibold text-hush-text-primary">
            {entry.HasOfficialResult ? 'Official result available.' : 'Unofficial result available.'}
          </span>{' '}
          This election now has result data worth reviewing from the hub workspace.
        </>
      )
    : hasReportPackage
      ? (
          <>
            <span className="font-semibold text-hush-text-primary">Report package available.</span> A report package is now
            visible for this actor in the workspace.
          </>
        )
      : hasWorkspaceArtifacts
        ? (
            <>
              <span className="font-semibold text-hush-text-primary">Boundary access recorded.</span> Artifact boundaries
              exist, but no result or report package needs immediate review.
            </>
          )
        : (
            <>
              <span className="font-semibold text-hush-text-primary">No artifacts or results yet.</span> Keep this section
              collapsed until results or package artifacts are published.
            </>
          );

  return (
    <CollapsibleSurfaceSection
      testId="hush-voting-section-results"
      toggleTestId="hush-voting-results-toggle"
      eyebrow={sectionTitle}
      title={sectionSubtitle}
      description={sectionDescription}
      summary={resultsSummary}
      defaultExpanded={shouldExpandResults}
      actions={
        <>
          {showsWorkspaceResults && entry.ActorRoles.IsVoter ? (
            canOpenResultDetail ? (
              <Link
                href={`/elections/${entry.Election.ElectionId}/voter`}
                className="inline-flex self-start items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-hush-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
              >
                <Vote className="h-4 w-4" />
                <span>Result details</span>
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex self-start items-center gap-2 rounded-xl bg-hush-purple/60 px-4 py-2 text-sm font-medium whitespace-nowrap text-white/80 opacity-60 cursor-not-allowed"
              >
                <Vote className="h-4 w-4" />
                <span>Result details</span>
              </button>
            )
          ) : null}

          {hasReportPackage && !usesAuditorPrimaryActions ? (
            <a
              href="#hush-voting-report-package"
              className="inline-flex self-start items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-hush-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
              data-testid="hush-voting-results-open-report-package"
            >
              <Files className="h-4 w-4" />
              <span>Open report package</span>
            </a>
          ) : null}

          {showsWorkspaceResults && resultTargetId && !usesAuditorPrimaryActions ? (
            <a
              href={resultTargetId}
              className="inline-flex self-start items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-hush-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
              data-testid="hush-voting-results-open-result"
            >
              <Vote className="h-4 w-4" />
              <span>{resultView?.OfficialResult ? 'Open official result' : 'Open unofficial result'}</span>
            </a>
          ) : null}
        </>
      }
    >
      <div className="space-y-4">
        <div className="text-sm text-hush-text-accent">
          {showsWorkspaceResults
            ? 'These indicators come directly from the actor-scoped hub response so the client does not overstate result, roster, or report-package access.'
            : 'These artifact indicators stay in the workspace so admin and auditor-only package boundaries remain visible without duplicating the voter result surface.'}
        </div>

        {showsWorkspaceResults ? (
          <div className="grid gap-4 md:grid-cols-4">
            <AvailabilityCard
              label="Unofficial result"
              value={entry.HasUnofficialResult ? 'Available' : 'Pending'}
              accentClass={entry.HasUnofficialResult ? 'text-green-100' : undefined}
            />
            <AvailabilityCard
              label="Official result"
              value={entry.HasOfficialResult ? 'Available' : 'Pending'}
              accentClass={entry.HasOfficialResult ? 'text-green-100' : undefined}
            />
            <AvailabilityCard
              label="Report package"
              value={entry.CanViewReportPackage ? 'Allowed' : 'Not allowed'}
              accentClass={entry.CanViewReportPackage ? 'text-green-100' : undefined}
            />
            <AvailabilityCard
              label="Named participation roster"
              value={entry.CanViewNamedParticipationRoster ? 'Allowed' : 'Not allowed'}
              accentClass={entry.CanViewNamedParticipationRoster ? 'text-green-100' : undefined}
            />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <AvailabilityCard
              label="Report package"
              value={entry.CanViewReportPackage ? 'Allowed' : 'Not allowed'}
              accentClass={entry.CanViewReportPackage ? 'text-green-100' : undefined}
            />
            <AvailabilityCard
              label="Named participation roster"
              value={entry.CanViewNamedParticipationRoster ? 'Allowed' : 'Not allowed'}
              accentClass={entry.CanViewNamedParticipationRoster ? 'text-green-100' : undefined}
            />
          </div>
        )}

        {showsWorkspaceResults && detail?.ResultArtifacts?.length ? (
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
            {showsWorkspaceResults
              ? 'Loading result and report-package details for this actor.'
              : 'Loading report-package details for this actor.'}
          </div>
        ) : null}

        {detail?.Election ? (
          <ElectionResultArtifactsSection
            election={detail.Election}
            resultView={resultView}
            showResults={showsWorkspaceResults}
          />
        ) : null}
      </div>
    </CollapsibleSurfaceSection>
  );
}
