"use client";

import {
  BarChart3,
  Clock3,
  Eye,
  FileDigit,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';
import type {
  ElectionRecordView,
  ElectionResultArtifact,
  GetElectionResultViewResponse,
} from '@/lib/grpc';
import {
  ElectionClosedProgressStatusProto,
  ElectionLifecycleStateProto,
  ElectionResultArtifactVisibilityProto,
} from '@/lib/grpc';
import {
  formatArtifactValue,
  formatTimestamp,
  getClosedProgressStatusLabel,
  getOfficialResultVisibilityLabel,
} from './contracts';

type ElectionResultArtifactsSectionProps = {
  election?: ElectionRecordView;
  resultView: GetElectionResultViewResponse | null;
};

const sectionClass =
  'rounded-2xl border border-hush-bg-light bg-hush-bg-element/95 p-5 shadow-sm shadow-black/10';

function getVisibilityCopy(artifact: ElectionResultArtifact): string {
  return artifact.Visibility ===
    ElectionResultArtifactVisibilityProto.ElectionResultArtifactPublicPlaintext
    ? 'Public plaintext'
    : 'Participant encrypted';
}

function renderProgressCopy(
  status: ElectionClosedProgressStatusProto
): { title: string; body: string } {
  switch (status) {
    case ElectionClosedProgressStatusProto.ClosedProgressWaitingForTrusteeShares:
      return {
        title: 'Close recorded',
        body:
          'Voting is already frozen. Trustees still need to submit the close-counting shares before tally calculation can begin.',
      };
    case ElectionClosedProgressStatusProto.ClosedProgressTallyCalculationInProgress:
      return {
        title: 'Tally calculation in progress',
        body:
          'The election is closed and the result workflow is running. No partial numbers are released before tally readiness is sealed.',
      };
    default:
      return {
        title: 'Result publication pending',
        body:
          'The election is closed, but the unofficial result artifact is not available yet.',
      };
  }
}

function ResultArtifactCard({
  artifact,
  label,
  description,
}: {
  artifact: ElectionResultArtifact;
  label: string;
  description: string;
}) {
  return (
    <section className={sectionClass}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            {label}
          </div>
          <h2 className="mt-2 text-xl font-semibold text-hush-text-primary">
            {artifact.Title}
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">{description}</p>
        </div>
        <div className="rounded-xl border border-hush-purple/30 bg-hush-purple/10 px-3 py-2 text-xs text-hush-text-primary">
          {getVisibilityCopy(artifact)}
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            <BarChart3 className="h-4 w-4" />
            <span>Total voted</span>
          </div>
          <div className="mt-3 text-2xl font-semibold text-hush-text-primary">
            {artifact.TotalVotedCount}
          </div>
        </div>
        <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            <ShieldCheck className="h-4 w-4" />
            <span>Eligible</span>
          </div>
          <div className="mt-3 text-2xl font-semibold text-hush-text-primary">
            {artifact.EligibleToVoteCount}
          </div>
        </div>
        <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            <Clock3 className="h-4 w-4" />
            <span>Did not vote</span>
          </div>
          <div className="mt-3 text-2xl font-semibold text-hush-text-primary">
            {artifact.DidNotVoteCount}
          </div>
        </div>
        <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            <FileDigit className="h-4 w-4" />
            <span>Blank votes</span>
          </div>
          <div className="mt-3 text-2xl font-semibold text-hush-text-primary">
            {artifact.BlankCount}
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-hush-bg-light bg-hush-bg-dark/70">
        <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3 border-b border-hush-bg-light/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
          <div>Named options</div>
          <div className="text-right">Votes</div>
        </div>
        <div className="divide-y divide-hush-bg-light/60">
          {artifact.NamedOptionResults.map((option) => (
            <div
              key={`${artifact.Id}:${option.OptionId}`}
              className="grid grid-cols-[minmax(0,1fr)_120px] gap-3 px-4 py-4"
            >
              <div>
                <div className="flex items-center gap-3 text-hush-text-primary">
                  <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-hush-bg-light px-2 text-xs font-semibold text-hush-text-accent">
                    {option.Rank}
                  </span>
                  <span className="font-medium">{option.DisplayLabel}</span>
                </div>
                {option.ShortDescription ? (
                  <div className="mt-2 text-sm text-hush-text-accent">
                    {option.ShortDescription}
                  </div>
                ) : null}
              </div>
              <div className="flex items-center justify-end text-xl font-semibold text-hush-text-primary">
                {option.VoteCount}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            Artifact id
          </div>
          <div className="mt-2 font-mono text-sm text-hush-text-primary">
            {formatArtifactValue(artifact.Id)}
          </div>
          <div className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            Recorded
          </div>
          <div className="mt-2 text-sm text-hush-text-primary">
            {formatTimestamp(artifact.RecordedAt)}
          </div>
        </div>
        <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            Result lineage
          </div>
          <div className="mt-2 space-y-2 text-sm text-hush-text-primary">
            <div>
              Tally ready: <span className="font-mono">{formatArtifactValue(artifact.TallyReadyArtifactId)}</span>
            </div>
            <div>
              Source result: <span className="font-mono">{formatArtifactValue(artifact.SourceResultArtifactId)}</span>
            </div>
            <div>
              Denominator evidence:{' '}
              <span className="font-mono">
                {formatArtifactValue(artifact.DenominatorEvidence?.EligibilitySnapshotId)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ElectionResultArtifactsSection({
  election,
  resultView,
}: ElectionResultArtifactsSectionProps) {
  if (!election) {
    return null;
  }

  const unofficialResult = resultView?.UnofficialResult;
  const officialResult = resultView?.OfficialResult;
  const hasArtifacts = Boolean(unofficialResult || officialResult);
  const shouldShowClosedProgress =
    election.LifecycleState === ElectionLifecycleStateProto.Closed && !unofficialResult;

  if (!hasArtifacts && !shouldShowClosedProgress) {
    return null;
  }

  return (
    <div className="space-y-5" data-testid="election-results-section">
      {shouldShowClosedProgress ? (
        <section
          className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5 text-blue-100"
          data-testid="election-results-progress"
        >
          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 h-5 w-5" />
            <div>
              <div className="font-semibold">
                {renderProgressCopy(
                  resultView?.ClosedProgressStatus ??
                    ElectionClosedProgressStatusProto.ClosedProgressNone
                ).title}
              </div>
              <div className="mt-2 text-sm">
                {
                  renderProgressCopy(
                    resultView?.ClosedProgressStatus ??
                      ElectionClosedProgressStatusProto.ClosedProgressNone
                  ).body
                }
              </div>
              <div className="mt-3 text-xs uppercase tracking-[0.2em] text-blue-100/80">
                {getClosedProgressStatusLabel(
                  resultView?.ClosedProgressStatus ??
                    ElectionClosedProgressStatusProto.ClosedProgressNone
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {unofficialResult ? (
        <div data-testid="election-unofficial-result">
          <ResultArtifactCard
            artifact={unofficialResult}
            label="Unofficial result"
            description="This participant-visible result is produced after close-time drain, tally replay, and aggregate release. It is not yet the official finalized result."
          />
        </div>
      ) : null}

      {officialResult ? (
        <div data-testid="election-official-result" className="space-y-4">
          <section className="rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-100">
            <div className="flex items-start gap-3">
              <Eye className="mt-0.5 h-5 w-5" />
              <div>
                <div className="font-semibold">Official result visibility</div>
                <div className="mt-2">
                  {getOfficialResultVisibilityLabel(
                    resultView?.OfficialResultVisibilityPolicy ??
                      election.OfficialResultVisibilityPolicy
                  )}
                </div>
              </div>
            </div>
          </section>
          <ResultArtifactCard
            artifact={officialResult}
            label="Official result"
            description="This artifact is created at finalization by copying the unofficial result into the election's official visibility mode."
          />
        </div>
      ) : null}

      {resultView?.CanViewParticipantEncryptedResults ? (
        <section className="rounded-2xl border border-hush-bg-light bg-hush-bg-dark/70 p-4 text-sm text-hush-text-accent">
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 h-5 w-5 text-hush-purple" />
            <div>
              Participant-encrypted artifacts are readable in this view because your actor is part
              of the election. Public readers only see official plaintext results when the election
              policy allows it.
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
