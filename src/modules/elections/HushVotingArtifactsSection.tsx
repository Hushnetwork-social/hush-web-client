"use client";

import { Files } from 'lucide-react';
import type {
  ElectionHubEntryView,
  GetElectionResponse,
  GetElectionResultViewResponse,
} from '@/lib/grpc';
import { ElectionResultArtifactsSection } from './ElectionResultArtifactsSection';
import {
  AvailabilityCard,
  CollapsibleSurfaceSection,
} from './HushVotingWorkspaceShared';
import { VerificationPackageStatusSection } from './VerificationPackageStatusSection';

type ArtifactsWorkspaceSummaryProps = {
  entry: ElectionHubEntryView;
  detail: GetElectionResponse | null;
  resultView: GetElectionResultViewResponse | null;
  isLoadingResultView: boolean;
};

export function ArtifactsWorkspaceSummary({
  entry,
  detail,
  resultView,
  isLoadingResultView,
}: ArtifactsWorkspaceSummaryProps) {
  const hasPublishedResult =
    entry.HasUnofficialResult ||
    entry.HasOfficialResult ||
    Boolean(resultView?.UnofficialResult || resultView?.OfficialResult);
  const hasReportPackage = Boolean(
    resultView?.CanViewReportPackage && resultView?.LatestReportPackage
  );
  const hasArtifactAccess =
    entry.CanViewReportPackage || entry.CanViewNamedParticipationRoster || hasReportPackage;
  const artifactsSummary = hasReportPackage ? (
    <>
      <span className="font-semibold text-hush-text-primary">Report package available.</span>{' '}
      Package access is now available as a separate surface from the published election result.
    </>
  ) : hasArtifactAccess ? (
    <>
      <span className="font-semibold text-hush-text-primary">Artifact access recorded.</span>{' '}
      Package and boundary access remain separate from the published result surface.
    </>
  ) : (
    <>
      <span className="font-semibold text-hush-text-primary">No artifact package yet.</span> Keep
      this section collapsed until a report package or boundary artifact is available.
    </>
  );

  return (
    <CollapsibleSurfaceSection
      testId="hush-voting-section-artifacts"
      toggleTestId="hush-voting-artifacts-toggle"
      eyebrow="Boundary Artifacts"
      title="Artifact and package availability"
      description="Package access, named roster boundaries, and report artifacts remain separate from the election result review surface."
      summary={artifactsSummary}
      defaultExpanded={!hasPublishedResult && hasReportPackage}
      actions={
        hasReportPackage ? (
          <a
            href="#hush-voting-report-package"
            className="inline-flex self-start items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-hush-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
            data-testid="hush-voting-artifacts-open-report-package"
          >
            <Files className="h-4 w-4" />
            <span>Open report package</span>
          </a>
        ) : null
      }
    >
      <div className="space-y-4">
        <div className="text-sm text-hush-text-accent">
          This section stays focused on package and artifact boundaries so published results can stay
          in their own dedicated review step.
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <AvailabilityCard
            label="Report package"
            value={hasReportPackage ? 'Published' : entry.CanViewReportPackage ? 'Allowed' : 'Not allowed'}
            accentClass={
              hasReportPackage
                ? 'text-green-100'
                : entry.CanViewReportPackage
                  ? 'text-hush-text-primary'
                  : undefined
            }
          />
          <AvailabilityCard
            label="Named participation roster"
            value={entry.CanViewNamedParticipationRoster ? 'Allowed' : 'Not allowed'}
            accentClass={entry.CanViewNamedParticipationRoster ? 'text-green-100' : undefined}
          />
        </div>

        {isLoadingResultView ? (
          <div className="rounded-2xl bg-hush-bg-dark/60 px-4 py-3 text-sm text-hush-text-accent">
            Loading artifact and report-package details for this actor.
          </div>
        ) : null}

        {resultView?.VerificationPackageStatus?.IsVisible ? (
          <VerificationPackageStatusSection
            electionId={entry.Election.ElectionId}
            actorPublicAddress={resultView.ActorPublicAddress}
            status={resultView.VerificationPackageStatus}
          />
        ) : null}

        {detail?.Election ? (
          <ElectionResultArtifactsSection
            election={detail.Election}
            resultView={resultView}
            showReportPackage
            showResults={false}
          />
        ) : null}
      </div>
    </CollapsibleSurfaceSection>
  );
}
