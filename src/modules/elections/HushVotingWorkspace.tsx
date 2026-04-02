"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Files,
  Loader2,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
  Vote,
} from 'lucide-react';
import type {
  ElectionGovernedProposal,
  ElectionHubEntryView,
  GetElectionResponse,
} from '@/lib/grpc';
import { ElectionLifecycleStateProto } from '@/lib/grpc';
import { ClosedProgressBanner } from './ClosedProgressBanner';
import { DesignatedAuditorGrantManager } from './DesignatedAuditorGrantManager';
import { ElectionAccessBoundaryNotice } from './ElectionAccessBoundaryNotice';
import { ElectionHubList } from './ElectionHubList';
import { ElectionWorkspaceHeader } from './ElectionWorkspaceHeader';
import { ReadOnlyGovernedActionSummary } from './ReadOnlyGovernedActionSummary';
import {
  formatTimestamp,
  getActiveCeremonyVersion,
  getElectionHubSuggestedActionLabel,
  getElectionWorkspaceSectionOrder,
  getFinalizationSessionPurposeLabel,
  getFinalizationSessionStatusLabel,
  getGovernedActionLabel,
  getGovernedProposalExecutionStatusLabel,
  getLatestFinalizationSession,
  getLifecycleLabel,
  getSummaryBadge,
} from './contracts';
import { useElectionsStore } from './useElectionsStore';

type HushVotingWorkspaceProps = {
  actorPublicAddress: string;
  actorEncryptionPublicKey: string;
  actorEncryptionPrivateKey: string;
  actorSigningPrivateKey: string;
  initialElectionId?: string;
};

const sectionClass =
  'rounded-3xl bg-hush-bg-element/95 p-5 shadow-lg shadow-black/10';

function timestampToMillis(timestamp?: { seconds?: number; nanos?: number }): number {
  if (!timestamp) {
    return 0;
  }

  return (timestamp.seconds ?? 0) * 1000 + Math.floor((timestamp.nanos ?? 0) / 1_000_000);
}

function getLatestProposal(detail: GetElectionResponse | null): ElectionGovernedProposal | null {
  const proposals = (detail?.GovernedProposals ?? [])
    .slice()
    .sort((left, right) => timestampToMillis(right.CreatedAt) - timestampToMillis(left.CreatedAt));

  return proposals[0] ?? null;
}

function AvailabilityCard({
  label,
  value,
  accentClass,
}: {
  label: string;
  value: string;
  accentClass?: string;
}) {
  return (
    <div className="rounded-2xl bg-hush-bg-dark/70 p-4 shadow-sm shadow-black/10">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
        {label}
      </div>
      <div className={`mt-2 text-sm font-medium ${accentClass ?? 'text-hush-text-primary'}`}>
        {value}
      </div>
    </div>
  );
}

function VoterWorkspaceSummary({ entry }: { entry: ElectionHubEntryView }) {
  const isOpenElection = entry.Election.LifecycleState === ElectionLifecycleStateProto.Open;
  const primaryHref = entry.CanClaimIdentity
    ? `/elections/${entry.Election.ElectionId}/eligibility`
    : `/elections/${entry.Election.ElectionId}/voter`;
  const primaryLabel = entry.CanClaimIdentity
    ? 'Open identity and eligibility'
    : isOpenElection
      ? 'Open ballot workflow'
      : 'Voter Details';

  return (
    <section className="space-y-4 pt-4 md:pt-6" data-testid="hush-voting-section-voter">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-base font-semibold uppercase tracking-[0.28em] text-hush-text-primary md:text-lg">
            Voter Surface
          </h2>
          <h3 className="mt-3 text-lg font-semibold text-hush-text-accent md:text-xl">
            Participation and result review
          </h3>
          <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
            {entry.CanClaimIdentity
              ? 'This election still needs a voter identity or eligibility review before the ballot surface can open.'
              : isOpenElection
                ? 'The election is open for this voter. Jump into the preserved ballot workflow to register commitment and cast.'
                : 'Voting controls are no longer active, but this actor can still review the voter detail surface for election-specific context.'}
          </p>
        </div>

        <Link
          href={primaryHref}
          className="inline-flex self-start items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-hush-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark lg:ml-6"
        >
          <Vote className="h-4 w-4" />
          <span>{primaryLabel}</span>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <AvailabilityCard label="Lifecycle" value={getLifecycleLabel(entry.Election.LifecycleState)} />
        <AvailabilityCard
          label="Eligibility"
          value={entry.CanClaimIdentity ? 'Needs identity claim' : 'Ready or already linked'}
          accentClass={entry.CanClaimIdentity ? 'text-amber-100' : 'text-green-100'}
        />
        <AvailabilityCard
          label="Results"
          value={
            entry.HasOfficialResult
              ? 'Official result available'
              : entry.HasUnofficialResult
                ? 'Participant result available'
                : 'No result artifact yet'
          }
          accentClass={entry.HasOfficialResult || entry.HasUnofficialResult ? 'text-green-100' : undefined}
        />
      </div>
    </section>
  );
}

function OwnerAdminWorkspaceSummary({
  entry,
  detail,
  actorEncryptionPublicKey,
  actorEncryptionPrivateKey,
  actorSigningPrivateKey,
}: {
  entry: ElectionHubEntryView;
  detail: GetElectionResponse | null;
  actorEncryptionPublicKey: string;
  actorEncryptionPrivateKey: string;
  actorSigningPrivateKey: string;
}) {
  const latestProposal = useMemo(() => getLatestProposal(detail), [detail]);

  return (
    <section className="space-y-4 pt-4 md:pt-6" data-testid="hush-voting-section-owner-admin">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-base font-semibold uppercase tracking-[0.28em] text-hush-text-primary md:text-lg">
            Owner / Admin Surface
          </h2>
          <h3 className="mt-3 text-lg font-semibold text-hush-text-primary md:text-xl">
            Election lifecycle management
          </h3>
          <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
            The shared shell keeps the selected election in view while the full owner lifecycle
            workspace stays inside HushVoting!.
          </p>
        </div>

        <Link
          href="/elections/owner"
          className="inline-flex self-start items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-hush-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark lg:ml-6"
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Owner Workspace</span>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <AvailabilityCard label="Summary" value={getSummaryBadge(entry.Election)} />
        <AvailabilityCard
          label="Draft revision"
          value={
            detail?.Election
              ? `${detail.Election.CurrentDraftRevision}`
              : `${entry.Election.CurrentDraftRevision}`
          }
        />
        <AvailabilityCard
          label="Suggested action"
          value={getElectionHubSuggestedActionLabel(entry.SuggestedAction)}
        />
        <AvailabilityCard
          label="Last updated"
          value={formatTimestamp(detail?.Election?.LastUpdatedAt ?? entry.Election.LastUpdatedAt)}
        />
      </div>

      {latestProposal ? (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-hush-text-accent">Latest governed proposal</div>
          <div className="text-sm text-hush-text-accent">
            {getGovernedActionLabel(latestProposal.ActionType)} proposal is{' '}
            <span className="text-hush-text-primary">
              {getGovernedProposalExecutionStatusLabel(latestProposal.ExecutionStatus)}
            </span>
            .
          </div>
        </div>
      ) : null}

      {detail ? (
        <div className="pt-4 md:pt-6">
          <DesignatedAuditorGrantManager
            detail={detail}
            actorEncryptionPublicKey={actorEncryptionPublicKey}
            actorEncryptionPrivateKey={actorEncryptionPrivateKey}
            actorSigningPrivateKey={actorSigningPrivateKey}
          />
        </div>
      ) : null}
    </section>
  );
}

function TrusteeWorkspaceSummary({
  entry,
  detail,
}: {
  entry: ElectionHubEntryView;
  detail: GetElectionResponse | null;
}) {
  const latestProposal = useMemo(() => getLatestProposal(detail), [detail]);
  const activeCeremonyVersion = useMemo(() => getActiveCeremonyVersion(detail), [detail]);
  const latestFinalizationSession = useMemo(() => getLatestFinalizationSession(detail), [detail]);

  return (
    <section className={sectionClass} data-testid="hush-voting-section-trustee">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-hush-text-accent">
            Trustee Surface
          </div>
          <h2 className="mt-2 text-xl font-semibold text-hush-text-primary">
            Governed action, ceremony, and share follow-up
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
            Trustee actions stay on their explicit pages. This shell keeps the election-specific
            ceremony and approval context visible before you jump into the bound action route.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/account/elections/trustee/${entry.Election.ElectionId}/ceremony`}
            className="inline-flex items-center gap-2 rounded-xl border border-hush-bg-light px-4 py-2 text-sm font-medium text-hush-text-primary transition-colors hover:border-hush-purple hover:text-hush-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Open ceremony workspace</span>
          </Link>
          <Link
            href={`/account/elections/trustee/${entry.Election.ElectionId}/finalization`}
            className="inline-flex items-center gap-2 rounded-xl border border-hush-bg-light px-4 py-2 text-sm font-medium text-hush-text-primary transition-colors hover:border-hush-purple hover:text-hush-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
          >
            <Files className="h-4 w-4" />
            <span>Open share workspace</span>
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
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
            latestFinalizationSession
              ? `${getFinalizationSessionPurposeLabel(latestFinalizationSession.SessionPurpose)} | ${getFinalizationSessionStatusLabel(latestFinalizationSession.Status)}`
              : 'No finalization session recorded'
          }
        />
      </div>

      {latestProposal ? (
        <div className="mt-4">
          <Link
            href={`/account/elections/trustee/${entry.Election.ElectionId}/proposal/${latestProposal.Id}`}
            className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
          >
            <ArrowRight className="h-4 w-4" />
            <span>Open latest trustee proposal</span>
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function AuditorWorkspaceSummary({
  entry,
  detail,
}: {
  entry: ElectionHubEntryView;
  detail: GetElectionResponse | null;
}) {
  return (
    <section className={sectionClass} data-testid="hush-voting-section-auditor">
      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-hush-text-accent">
        Auditor Surface
      </div>
      <h2 className="mt-2 text-xl font-semibold text-hush-text-primary">
        Read-only governance and package access
      </h2>
      <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
        Designated-auditor access stays read-only here. The shell only mirrors server-approved
        package and governance visibility for the selected election.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
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

      {detail ? (
        <div className="mt-4">
          <ReadOnlyGovernedActionSummary detail={detail} />
        </div>
      ) : null}
    </section>
  );
}

function ResultsWorkspaceSummary({
  entry,
  detail,
}: {
  entry: ElectionHubEntryView;
  detail: GetElectionResponse | null;
}) {
  const hasAnyResults = entry.HasUnofficialResult || entry.HasOfficialResult;
  const canOpenResultDetail = entry.ActorRoles.IsVoter && hasAnyResults;
  const [isExpanded, setIsExpanded] = useState(hasAnyResults);

  useEffect(() => {
    if (hasAnyResults) {
      setIsExpanded(true);
    }
  }, [hasAnyResults]);

  return (
    <section className="space-y-4 pt-4 md:pt-6" data-testid="hush-voting-section-results">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold uppercase tracking-[0.28em] text-hush-text-primary md:text-lg">
            Results and Boundary Artifacts
          </h2>
          <h3 className="mt-3 text-lg font-semibold text-hush-text-accent md:text-xl">
            Result and package availability
          </h3>
          <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
            {hasAnyResults
              ? 'Unofficial or official result access is available for this election.'
              : 'No unofficial or official result is available yet. Expand this section only if you need the access boundaries.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
          aria-expanded={isExpanded}
          data-testid="hush-voting-results-toggle"
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {isExpanded ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="text-sm text-hush-text-accent">
              These indicators come directly from the actor-scoped hub response so the client does not
              overstate result, roster, or report-package access.
            </div>

            {entry.ActorRoles.IsVoter ? (
              canOpenResultDetail ? (
              <Link
                href={`/elections/${entry.Election.ElectionId}/voter`}
                className="inline-flex self-start items-center gap-2 rounded-xl border border-hush-bg-light px-4 py-2 text-sm font-medium whitespace-nowrap text-hush-text-primary transition-colors hover:border-hush-purple hover:text-hush-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark lg:ml-6"
              >
                <Vote className="h-4 w-4" />
                <span>Result details</span>
              </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex self-start items-center gap-2 rounded-xl border border-hush-bg-light/70 px-4 py-2 text-sm font-medium whitespace-nowrap text-hush-text-accent/80 opacity-60 cursor-not-allowed lg:ml-6"
                >
                  <Vote className="h-4 w-4" />
                  <span>Result details</span>
                </button>
              )
            ) : null}
          </div>

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
        </div>
      ) : null}
    </section>
  );
}

export function HushVotingWorkspace({
  actorPublicAddress,
  actorEncryptionPublicKey,
  actorEncryptionPrivateKey,
  actorSigningPrivateKey,
  initialElectionId,
}: HushVotingWorkspaceProps) {
  const router = useRouter();
  const {
    canManageReportAccessGrants,
    clearGrantCandidateSearch,
    feedback,
    error,
    hubEntries,
    hubView,
    isLoadingDetail,
    isLoadingHub,
    loadElectionHub,
    reset,
    selectedElection,
    selectedElectionId,
    selectedHubEntry,
    selectHubElection,
  } = useElectionsStore();

  useEffect(() => {
    void loadElectionHub(actorPublicAddress);
  }, [actorPublicAddress, loadElectionHub]);

  useEffect(() => () => reset(), [reset]);

  useEffect(() => {
    if (!selectedElectionId) {
      return;
    }

    clearGrantCandidateSearch();
  }, [clearGrantCandidateSearch, selectedElectionId]);

  const requestedEntry = useMemo(
    () =>
      initialElectionId
        ? hubEntries.find((entry) => entry.Election.ElectionId === initialElectionId) ?? null
        : null,
    [hubEntries, initialElectionId]
  );

  useEffect(() => {
    if (!initialElectionId || !requestedEntry || selectedElectionId === initialElectionId) {
      return;
    }

    void selectHubElection(actorPublicAddress, initialElectionId);
  }, [
    actorPublicAddress,
    initialElectionId,
    requestedEntry,
    selectedElectionId,
    selectHubElection,
  ]);

  const activeEntry = useMemo(() => {
    if (initialElectionId) {
      return requestedEntry;
    }

    if (selectedHubEntry) {
      return selectedHubEntry;
    }

    return (
      hubEntries.find((entry) => entry.Election.ElectionId === selectedElectionId) ??
      hubEntries[0] ??
      null
    );
  }, [hubEntries, initialElectionId, requestedEntry, selectedElectionId, selectedHubEntry]);

  const activeDetail = useMemo(
    () =>
      activeEntry && selectedElection?.Election?.ElectionId === activeEntry.Election.ElectionId
        ? selectedElection
        : null,
    [activeEntry, selectedElection]
  );

  const requestedEntryMissing = Boolean(initialElectionId && !isLoadingHub && hubView && !requestedEntry);
  const sectionOrder = getElectionWorkspaceSectionOrder(activeEntry);
  const hasVisibleSections = sectionOrder.length > 0 || canManageReportAccessGrants;
  const isDetailRoute = Boolean(initialElectionId);

  const handleSelectElection = (electionId: string) => {
    if (electionId !== initialElectionId) {
      router.push(`/elections/${electionId}`);
    }
  };

  const emptyStateReason =
    error ||
    hubView?.EmptyStateReason ||
    'This account does not currently hold any FEAT-103 election role.';

  if (!isDetailRoute) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto text-hush-text-primary">
        <div className="flex w-full min-w-0 flex-col gap-5 p-4 md:p-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-hush-text-accent">
              Protocol Omega
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-hush-text-primary">HushVoting! Hub</h1>
            <p className="mt-2 max-w-4xl text-sm text-hush-text-accent">
              Open a linked election card to continue into its dedicated HushVoting! detail view.
            </p>
          </div>

          {feedback ? (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                feedback.tone === 'success'
                  ? 'border-green-500/40 bg-green-500/10 text-green-100'
                  : 'border-red-500/40 bg-red-500/10 text-red-100'
              }`}
              role="status"
            >
              <div className="flex items-center gap-2 font-medium">
                {feedback.tone === 'success' ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <span>{feedback.message}</span>
              </div>
              {feedback.details.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {feedback.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {hubEntries.length === 0 && isLoadingHub ? (
            <div className={`${sectionClass} flex items-center gap-3`}>
              <Loader2 className="h-5 w-5 animate-spin text-hush-purple" />
              <span className="text-sm text-hush-text-accent">Loading actor-scoped election hub...</span>
            </div>
          ) : hubEntries.length === 0 ? (
            <ElectionAccessBoundaryNotice
              title="No linked election surfaces available"
              message={emptyStateReason}
              details={[
                'Use Search Election from the left menu to find an election before claim-linking your organization voter identifier.',
                'Use Create Election from the left menu to start a new owner draft.',
                'After the eligibility claim succeeds, the election will appear in this hub.',
              ]}
              primaryHref={null}
              primaryLabel={null}
            />
          ) : (
            <div className="pt-2 md:pt-3">
              <ElectionHubList
                entries={hubEntries}
                selectedElectionId={null}
                onSelect={handleSelectElection}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto text-hush-text-primary">
      <div className="flex w-full min-w-0 flex-col gap-5 p-4 md:p-5">
        {feedback ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              feedback.tone === 'success'
                ? 'border-green-500/40 bg-green-500/10 text-green-100'
                : 'border-red-500/40 bg-red-500/10 text-red-100'
            }`}
            role="status"
          >
            <div className="flex items-center gap-2 font-medium">
              {feedback.tone === 'success' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <span>{feedback.message}</span>
            </div>
            {feedback.details.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {feedback.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {requestedEntryMissing ? (
          <ElectionAccessBoundaryNotice
            title="Requested election is not available here"
            message={`The route for election ${initialElectionId} does not resolve to an actor-visible FEAT-103 workspace.`}
            details={[
              'Return to HushVoting! Hub to choose another linked election.',
              'This route only opens elections that the current actor can access.',
            ]}
          />
        ) : !activeEntry ? (
          <div className={`${sectionClass} flex items-center gap-3`}>
            <Loader2 className="h-5 w-5 animate-spin text-hush-purple" />
            <span className="text-sm text-hush-text-accent">Preparing election workspace...</span>
          </div>
        ) : (
          <>
            <ElectionWorkspaceHeader entry={activeEntry} />
            <ClosedProgressBanner entry={activeEntry} />

            {!hasVisibleSections ? (
              <ElectionAccessBoundaryNotice
                title="No FEAT-103 workspace surface is available"
                message={
                  activeEntry.SuggestedActionReason ||
                  'This actor does not currently have an owner, trustee, voter, auditor, or result-review surface for the selected election.'
                }
                primaryLabel="Back to HushVoting! Hub"
              />
            ) : null}

            {isLoadingDetail && !activeDetail ? (
              <div className={`${sectionClass} flex items-center gap-3`}>
                <Loader2 className="h-5 w-5 animate-spin text-hush-purple" />
                <span className="text-sm text-hush-text-accent">
                  Loading detailed context for {activeEntry.Election.Title || activeEntry.Election.ElectionId}...
                </span>
              </div>
            ) : null}

            {sectionOrder.includes('voter') ? <VoterWorkspaceSummary entry={activeEntry} /> : null}

            {sectionOrder.includes('owner-admin') ? (
              <OwnerAdminWorkspaceSummary
                entry={activeEntry}
                detail={activeDetail}
                actorEncryptionPublicKey={actorEncryptionPublicKey}
                actorEncryptionPrivateKey={actorEncryptionPrivateKey}
                actorSigningPrivateKey={actorSigningPrivateKey}
              />
            ) : null}

            {sectionOrder.includes('trustee') ? (
              <TrusteeWorkspaceSummary entry={activeEntry} detail={activeDetail} />
            ) : null}

            {sectionOrder.includes('auditor') ? (
              <AuditorWorkspaceSummary entry={activeEntry} detail={activeDetail} />
            ) : null}

            {sectionOrder.includes('results') ? (
              <ResultsWorkspaceSummary entry={activeEntry} detail={activeDetail} />
            ) : null}

            {activeEntry.CanViewReportPackage && !sectionOrder.includes('auditor') ? (
              <section className={sectionClass}>
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-blue-500/10 p-3 text-blue-100">
                    <LockKeyhole className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-hush-text-primary">
                      Report package visibility granted
                    </div>
                    <p className="mt-2 text-sm text-hush-text-accent">
                      The server marks this actor as report-package eligible for the selected
                      election. Phase 5 keeps that boundary visible here without inventing any
                      package action the server did not authorize.
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            {!sectionOrder.includes('results') && activeEntry.HasOfficialResult ? (
              <section className={sectionClass}>
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-green-500/10 p-3 text-green-100">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-hush-text-primary">
                      Official result exists
                    </div>
                    <p className="mt-2 text-sm text-hush-text-accent">
                      The election record already carries an official result, but this actor does
                      not currently have an FEAT-103 result-review surface for it.
                    </p>
                  </div>
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
