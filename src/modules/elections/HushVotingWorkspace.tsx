"use client";

import Link from 'next/link';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Files,
  Loader2,
  LockKeyhole,
  Search,
  ShieldAlert,
  ShieldCheck,
  Vote,
} from 'lucide-react';
import type {
  ElectionGovernedProposal,
  ElectionHubEntryView,
  ElectionSummary,
  GetElectionResponse,
  Identity,
} from '@/lib/grpc';
import { ElectionLifecycleStateProto } from '@/lib/grpc';
import { electionsService } from '@/lib/grpc/services/elections';
import { identityService } from '@/lib/grpc/services/identity';
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
  'rounded-3xl border border-hush-bg-light bg-hush-bg-element/95 p-5 shadow-sm shadow-black/10';

type ElectionDiscoveryResult = {
  election: ElectionSummary;
  ownerDisplayName: string;
};

function timestampToMillis(timestamp?: { seconds?: number; nanos?: number }): number {
  if (!timestamp) {
    return 0;
  }

  return (timestamp.seconds ?? 0) * 1000 + Math.floor((timestamp.nanos ?? 0) / 1_000_000);
}

function abbreviateAddress(address: string): string {
  if (address.length <= 18) {
    return address;
  }

  return `${address.slice(0, 10)}...${address.slice(-6)}`;
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
    <div className="rounded-2xl border border-hush-bg-light bg-hush-bg-dark/70 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
        {label}
      </div>
      <div className={`mt-2 text-sm font-medium ${accentClass ?? 'text-hush-text-primary'}`}>
        {value}
      </div>
    </div>
  );
}

function ElectionDiscoveryPanel({
  onOpenEligibility,
}: {
  onOpenEligibility: (electionId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ElectionDiscoveryResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      setResults([]);
      setHasSearched(false);
      setError('Enter an election title or owner alias to search.');
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const ownerLookup = new Map<string, Identity>();
      try {
        const identityResponse = await identityService.searchByDisplayName(normalizedQuery);
        for (const identity of identityResponse.Identities ?? []) {
          if (!ownerLookup.has(identity.PublicSigningAddress)) {
            ownerLookup.set(identity.PublicSigningAddress, identity);
          }
        }
      } catch {
        // Title search should remain available even when alias lookup is unavailable.
      }

      const directoryResponse = await electionsService.searchElectionDirectory({
        SearchTerm: normalizedQuery,
        OwnerPublicAddresses: Array.from(ownerLookup.keys()),
        Limit: 12,
      });

      if (!directoryResponse.Success) {
        throw new Error(directoryResponse.ErrorMessage || 'Failed to search elections.');
      }

      const dedupedResults = new Map<string, ElectionDiscoveryResult>();
      for (const election of directoryResponse.Elections ?? []) {
        dedupedResults.set(election.ElectionId, {
          election,
          ownerDisplayName: ownerLookup.get(election.OwnerPublicAddress)?.DisplayName ?? '',
        });
      }

      setResults(Array.from(dedupedResults.values()));
      setHasSearched(true);
    } catch (searchError) {
      setResults([]);
      setHasSearched(true);
      setError(searchError instanceof Error ? searchError.message : 'Failed to search elections.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <section className={sectionClass} data-testid="election-discovery-panel">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-hush-text-accent">
            Election Discovery
          </div>
          <h2 className="mt-2 text-xl font-semibold text-hush-text-primary">
            Search before claim-linking
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
            The hub only lists elections already linked to this Hush account. Search by election
            title or owner alias, then open the eligibility route to claim-link an organization
            voter identifier with the temporary code.
          </p>
        </div>

        <div className="rounded-2xl border border-hush-bg-light bg-hush-bg-dark/70 px-4 py-3 text-xs text-hush-text-accent">
          Temporary code: <span className="font-mono text-hush-text-primary">1111</span>
        </div>
      </div>

      <form className="mt-5" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-hush-text-primary" htmlFor="election-search-input">
          Find an election
        </label>
        <div className="mt-2 flex flex-col gap-3 md:flex-row">
          <input
            id="election-search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Election title or owner alias"
            className="min-w-0 flex-1 rounded-2xl border border-hush-bg-light bg-hush-bg-dark/80 px-4 py-3 text-sm text-hush-text-primary outline-none transition-colors placeholder:text-hush-text-accent focus:border-hush-purple"
            aria-label="Search elections"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-hush-purple px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 disabled:cursor-not-allowed disabled:bg-hush-purple/60"
          >
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span>{isSearching ? 'Searching...' : 'Search elections'}</span>
          </button>
        </div>
      </form>

      <div className="mt-3 text-xs text-hush-text-accent">
        Open a result to enter the organization voter ID, confirm with <span className="font-mono text-hush-text-primary">1111</span>, and attach that election to this hub.
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100" role="alert">
          {error}
        </div>
      ) : null}

      {isSearching ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-hush-bg-light bg-hush-bg-dark/70 px-4 py-3 text-sm text-hush-text-accent">
          <Loader2 className="h-4 w-4 animate-spin text-hush-purple" />
          <span>Searching the election directory...</span>
        </div>
      ) : null}

      {!isSearching && results.length > 0 ? (
        <div className="mt-4 space-y-3">
          {results.map((result) => (
            <button
              key={result.election.ElectionId}
              type="button"
              className="flex w-full items-start justify-between gap-4 rounded-2xl border border-hush-bg-light bg-hush-bg-dark/70 px-4 py-4 text-left transition-colors hover:border-hush-purple"
              onClick={() => onOpenEligibility(result.election.ElectionId)}
            >
              <div>
                <div className="text-sm font-semibold text-hush-text-primary">
                  {result.election.Title || result.election.ElectionId}
                </div>
                <div className="mt-1 text-xs uppercase tracking-[0.2em] text-hush-text-accent">
                  {getLifecycleLabel(result.election.LifecycleState)}
                </div>
                <div className="mt-2 text-sm text-hush-text-accent">
                  Owner:{' '}
                  <span className="text-hush-text-primary">
                    {result.ownerDisplayName || abbreviateAddress(result.election.OwnerPublicAddress)}
                  </span>
                </div>
              </div>
              <div className="inline-flex items-center gap-2 text-sm font-medium text-hush-purple">
                <span>Open eligibility</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {!isSearching && hasSearched && results.length === 0 && !error ? (
        <div className="mt-4 rounded-2xl border border-hush-bg-light bg-hush-bg-dark/70 px-4 py-3 text-sm text-hush-text-accent">
          No elections matched that title or owner alias.
        </div>
      ) : null}
    </section>
  );
}

function VoterWorkspaceSummary({ entry }: { entry: ElectionHubEntryView }) {
  const isOpenElection = entry.Election.LifecycleState === ElectionLifecycleStateProto.Open;
  const primaryHref = entry.CanClaimIdentity
    ? `/account/elections/${entry.Election.ElectionId}/eligibility`
    : `/account/elections/voter/${entry.Election.ElectionId}`;
  const primaryLabel = entry.CanClaimIdentity
    ? 'Open identity and eligibility'
    : isOpenElection
      ? 'Open ballot workflow'
      : 'Open voter detail';

  return (
    <section className={sectionClass} data-testid="hush-voting-section-voter">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-hush-text-accent">
            Voter Surface
          </div>
          <h2 className="mt-2 text-xl font-semibold text-hush-text-primary">
            Participation and result review
          </h2>
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
          className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90"
        >
          <Vote className="h-4 w-4" />
          <span>{primaryLabel}</span>
        </Link>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
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
    <section className={sectionClass} data-testid="hush-voting-section-owner-admin">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-hush-text-accent">
            Owner / Admin Surface
          </div>
          <h2 className="mt-2 text-xl font-semibold text-hush-text-primary">
            Election lifecycle management
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
            The shared shell keeps the selected election in view, while the preserved owner route
            still holds the full draft, trustee, governance, and lifecycle controls.
          </p>
        </div>

        <Link
          href="/account/elections/owner"
          className="inline-flex items-center gap-2 rounded-xl border border-hush-bg-light px-4 py-2 text-sm font-medium text-hush-text-primary transition-colors hover:border-hush-purple hover:text-hush-purple"
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Open detailed owner workspace</span>
        </Link>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-4">
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
        <div className="mt-4 rounded-2xl border border-hush-bg-light bg-hush-bg-dark/70 p-4">
          <div className="text-sm font-semibold text-hush-text-primary">Latest governed proposal</div>
          <div className="mt-2 text-sm text-hush-text-accent">
            {getGovernedActionLabel(latestProposal.ActionType)} proposal is{' '}
            <span className="text-hush-text-primary">
              {getGovernedProposalExecutionStatusLabel(latestProposal.ExecutionStatus)}
            </span>
            .
          </div>
        </div>
      ) : null}

      {detail ? (
        <div className="mt-4">
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
            className="inline-flex items-center gap-2 rounded-xl border border-hush-bg-light px-4 py-2 text-sm font-medium text-hush-text-primary transition-colors hover:border-hush-purple hover:text-hush-purple"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Open ceremony workspace</span>
          </Link>
          <Link
            href={`/account/elections/trustee/${entry.Election.ElectionId}/finalization`}
            className="inline-flex items-center gap-2 rounded-xl border border-hush-bg-light px-4 py-2 text-sm font-medium text-hush-text-primary transition-colors hover:border-hush-purple hover:text-hush-purple"
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
            className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90"
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
  return (
    <section className={sectionClass} data-testid="hush-voting-section-results">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-hush-text-accent">
            Results and Boundary Artifacts
          </div>
          <h2 className="mt-2 text-xl font-semibold text-hush-text-primary">
            Result and package availability
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
            These indicators come directly from the actor-scoped hub response so the client does not
            overstate result, roster, or report-package access.
          </p>
        </div>

        {entry.ActorRoles.IsVoter ? (
          <Link
            href={`/account/elections/voter/${entry.Election.ElectionId}`}
            className="inline-flex items-center gap-2 rounded-xl border border-hush-bg-light px-4 py-2 text-sm font-medium text-hush-text-primary transition-colors hover:border-hush-purple hover:text-hush-purple"
          >
            <Vote className="h-4 w-4" />
            <span>Open voter result detail</span>
          </Link>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-4">
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
        <div className="mt-4 rounded-2xl border border-hush-bg-light bg-hush-bg-dark/70 p-4">
          <div className="text-sm font-semibold text-hush-text-primary">Persisted result artifacts</div>
          <div className="mt-2 text-sm text-hush-text-accent">
            {detail.ResultArtifacts.length} artifact
            {detail.ResultArtifacts.length === 1 ? '' : 's'} currently visible on the election
            detail record.
          </div>
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

  const handleSelectElection = (electionId: string) => {
    if (initialElectionId) {
      if (electionId !== initialElectionId) {
        router.push(`/account/elections/${electionId}`);
      }
      return;
    }

    if (electionId === selectedElectionId) {
      return;
    }

    void selectHubElection(actorPublicAddress, electionId);
  };

  const emptyStateReason =
    error ||
    hubView?.EmptyStateReason ||
    'This account does not currently hold any FEAT-103 election role.';
  const handleOpenEligibility = (electionId: string) => {
    router.push(`/account/elections/${electionId}/eligibility`);
  };

  return (
    <div className="min-h-screen bg-hush-bg-dark text-hush-text-primary">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-hush-text-accent">
              Protocol Omega
            </div>
            <h1 className="mt-2 text-3xl font-semibold text-hush-text-primary">HushVoting Hub</h1>
            <p className="mt-3 max-w-4xl text-sm text-hush-text-accent">
              FEAT-103 groups elections by lifecycle, keeps the selected role surface in one place,
              and sends deeper owner, voter, trustee, and auditor work to the preserved routes.
            </p>
          </div>

          <div className="rounded-2xl border border-hush-bg-light bg-hush-bg-element/95 px-4 py-3 text-xs text-hush-text-accent">
            Actor address:{' '}
            <span className="font-mono text-hush-text-primary">{actorPublicAddress}</span>
          </div>
        </div>

        {feedback ? (
          <div
            className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
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
          <div className="space-y-5">
            <ElectionDiscoveryPanel onOpenEligibility={handleOpenEligibility} />
            <ElectionAccessBoundaryNotice
              title="No linked election surfaces available"
              message={emptyStateReason}
              details={[
                'Search above to find an election before claim-linking your organization voter identifier.',
                'After the eligibility claim succeeds, the election will appear in this hub.',
              ]}
            />
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="space-y-4">
              <ElectionDiscoveryPanel onOpenEligibility={handleOpenEligibility} />

              <div className={`${sectionClass} p-4`}>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-hush-text-accent">
                  Election Hub
                </div>
                <p className="mt-2 text-sm text-hush-text-accent">
                  One row per linked election, grouped by lifecycle and filtered to this actor&apos;s
                  allowed surfaces.
                </p>
              </div>

              <ElectionHubList
                entries={hubEntries}
                selectedElectionId={initialElectionId ?? selectedElectionId}
                onSelect={handleSelectElection}
              />
            </aside>

            <main className="space-y-5">
              {requestedEntryMissing ? (
                <ElectionAccessBoundaryNotice
                  title="Requested election is not available here"
                  message={`The route for election ${initialElectionId} does not resolve to an actor-visible FEAT-103 workspace.`}
                  details={[
                    'The hub still lists other elections that this actor can access.',
                    'Use the hub selection or return to the main HushVoting route to continue.',
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
                      primaryLabel="Back to HushVoting Hub"
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
                        <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3 text-blue-100">
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
                        <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-3 text-green-100">
                          <ShieldAlert className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-hush-text-primary">
                            Official result exists
                          </div>
                          <p className="mt-2 text-sm text-hush-text-accent">
                            The election record already carries an official result, but this actor
                            does not currently have an FEAT-103 result-review surface for it.
                          </p>
                        </div>
                      </div>
                    </section>
                  ) : null}
                </>
              )}
            </main>
          </div>
        )}
      </div>
    </div>
  );
}
