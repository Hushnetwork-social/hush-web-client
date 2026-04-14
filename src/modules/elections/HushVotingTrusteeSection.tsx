"use client";

import Link from 'next/link';
import { useMemo } from 'react';
import { ArrowRight, Files, ShieldCheck } from 'lucide-react';
import type { ElectionHubEntryView, GetElectionResponse } from '@/lib/grpc';
import {
  ElectionCeremonyVersionStatusProto,
  ElectionFinalizationSessionPurposeProto,
  ElectionHubNextActionHintProto,
  ElectionGovernedActionTypeProto,
  ElectionGovernedProposalExecutionStatusProto,
} from '@/lib/grpc';
import {
  formatTimestamp,
  getActiveCeremonyVersion,
  getFinalizationSessionPurposeLabel,
  getFinalizationSessionStatusLabel,
  getGovernedActionLabel,
  getGovernedProposalExecutionStatusLabel,
} from './contracts';
import {
  AvailabilityCard,
  CollapsibleSurfaceSection,
  getLatestProposal,
} from './HushVotingWorkspaceShared';

type TrusteeWorkspaceSummaryProps = {
  entry: ElectionHubEntryView;
  detail: GetElectionResponse | null;
};

export function TrusteeWorkspaceSummary({
  entry,
  detail,
}: TrusteeWorkspaceSummaryProps) {
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
  const needsTrusteeResultReview =
    entry.SuggestedAction === ElectionHubNextActionHintProto.ElectionHubActionTrusteeReviewResult;
  const needsCeremonyFollowUp =
    entry.SuggestedAction === ElectionHubNextActionHintProto.ElectionHubActionNone &&
    normalizedReason.startsWith('continue the trustee ceremony.');
  const waitingForCloseThreshold =
    latestCloseProposal &&
    latestCloseProposal.ExecutionStatus ===
      ElectionGovernedProposalExecutionStatusProto.WaitingForApprovals &&
    !latestCloseCountingSession;
  const shareWorkspaceEnabled = Boolean(latestCloseCountingSession);
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

    if (latestCloseCountingSession) {
      return (
        <>
          <span className="font-semibold text-hush-text-primary">Close-counting share active.</span>{' '}
          The bound tally-release session is ready in the share workspace.
        </>
      );
    }

    if (waitingForCloseThreshold) {
      return (
        <>
          <span className="font-semibold text-hush-text-primary">Waiting for close threshold.</span>{' '}
          The share workspace remains disabled until the governed close reaches threshold and the
          bound close-counting session is created.
        </>
      );
    }

    if (needsTrusteeResultReview) {
      return (
        <>
          <span className="font-semibold text-hush-text-primary">Trustee result available.</span> Trustee-specific result
          or finalization follow-up is ready for review.
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
    needsTrusteeResultReview,
    waitingForCloseThreshold,
  ]);

  return (
    <CollapsibleSurfaceSection
      testId="hush-voting-section-trustee"
      toggleTestId="hush-voting-trustee-toggle"
      eyebrow="Trustee Surface"
      title="Governed action, ceremony, and share follow-up"
      description="Trustee actions stay on their explicit pages. This shell keeps the election-specific ceremony and approval context visible before you jump into the bound action route."
      summary={trusteeSurfaceSummary}
      defaultExpanded={needsGovernedReview || needsCeremonyFollowUp || needsTrusteeResultReview}
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
                ? 'Open the trustee share workspace.'
                : 'Share submission unlocks only after close reaches threshold and the close-counting session exists.'
            }
            data-testid="trustee-share-workspace-action"
          >
            <Files className="h-4 w-4" />
            <span>Share workspace</span>
          </Link>
          {latestProposal ? (
            <Link
              href={`/elections/${entry.Election.ElectionId}/trustee/proposal/${latestProposal.Id}`}
              className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
            >
              <ArrowRight className="h-4 w-4" />
              <span>Open latest trustee proposal</span>
            </Link>
          ) : null}
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <AvailabilityCard
          label="Latest proposal"
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
              ? `${getFinalizationSessionPurposeLabel(latestCloseCountingSession.SessionPurpose)} | ${getFinalizationSessionStatusLabel(latestCloseCountingSession.Status)}`
              : waitingForCloseThreshold
                ? 'Waiting for close threshold'
                : 'No close-counting session recorded'
          }
        />
      </div>
    </CollapsibleSurfaceSection>
  );
}
