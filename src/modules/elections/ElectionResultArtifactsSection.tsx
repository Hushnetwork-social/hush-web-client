"use client";

import {
  BarChart3,
  Clock3,
  Download,
  Eye,
  FileDigit,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type {
  ElectionRecordView,
  ElectionReportArtifactView,
  ElectionResultArtifact,
  GetElectionResultViewResponse,
} from '@/lib/grpc';
import {
  ElectionClosedProgressStatusProto,
  ElectionLifecycleStateProto,
  ElectionReportArtifactAccessScopeProto,
  ElectionReportArtifactFormatProto,
  ElectionReportArtifactKindProto,
  ElectionReportPackageStatusProto,
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
  'rounded-[28px] bg-hush-bg-element/95 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.24)]';

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

function formatHash(value?: Uint8Array): string {
  if (!value || value.length === 0) {
    return 'Not recorded';
  }

  const hex = Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return hex.length <= 24 ? hex : `${hex.slice(0, 12)}...${hex.slice(-8)}`;
}

function getPackageStatusCopy(
  status: ElectionReportPackageStatusProto
): { title: string; body: string; className: string } {
  switch (status) {
    case ElectionReportPackageStatusProto.ReportPackageSealed:
      return {
        title: 'Sealed package available',
        body: 'Machine and human canonical artifacts were generated together from the frozen evidence set.',
        className: 'bg-green-500/12 text-green-100',
      };
    default:
      return {
        title: 'Finalization incomplete',
        body: 'Report package generation failed. Retry from the owner finalization workflow to seal a new attempt from the same frozen evidence.',
        className: 'bg-red-500/12 text-red-100',
      };
  }
}

function getReportArtifactKindLabel(kind: ElectionReportArtifactKindProto): string {
  switch (kind) {
    case ElectionReportArtifactKindProto.ReportArtifactHumanManifest:
      return 'Manifest';
    case ElectionReportArtifactKindProto.ReportArtifactHumanResultReport:
      return 'Result report';
    case ElectionReportArtifactKindProto.ReportArtifactHumanNamedParticipationRoster:
      return 'Named roster';
    case ElectionReportArtifactKindProto.ReportArtifactHumanAuditProvenanceReport:
      return 'Audit report';
    case ElectionReportArtifactKindProto.ReportArtifactHumanOutcomeDetermination:
      return 'Outcome';
    case ElectionReportArtifactKindProto.ReportArtifactHumanDisputeReviewIndex:
      return 'Dispute index';
    case ElectionReportArtifactKindProto.ReportArtifactMachineManifest:
      return 'Machine manifest';
    case ElectionReportArtifactKindProto.ReportArtifactMachineEvidenceGraph:
      return 'Evidence graph';
    case ElectionReportArtifactKindProto.ReportArtifactMachineResultReportProjection:
      return 'Result projection';
    case ElectionReportArtifactKindProto.ReportArtifactMachineNamedParticipationRosterProjection:
      return 'Roster projection';
    case ElectionReportArtifactKindProto.ReportArtifactMachineAuditProvenanceReportProjection:
      return 'Audit projection';
    case ElectionReportArtifactKindProto.ReportArtifactMachineOutcomeDeterminationProjection:
      return 'Outcome projection';
    case ElectionReportArtifactKindProto.ReportArtifactMachineDisputeReviewIndexProjection:
      return 'Dispute projection';
    default:
      return 'Artifact';
  }
}

function getAccessScopeLabel(scope: ElectionReportArtifactAccessScopeProto): string {
  return scope === ElectionReportArtifactAccessScopeProto.ReportArtifactOwnerAuditorOnly
    ? 'Owner + auditor'
    : 'Owner + auditor + trustee';
}

function getFormatLabel(format: ElectionReportArtifactFormatProto): string {
  return format === ElectionReportArtifactFormatProto.ReportArtifactJson ? 'JSON' : 'Markdown';
}

function downloadReportArtifact(artifact: ElectionReportArtifactView) {
  const blob = new Blob([artifact.Content], { type: artifact.MediaType || 'text/plain;charset=utf-8' });
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = artifact.FileName || `${artifact.Title}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
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
        <div className="rounded-xl bg-hush-purple/20 px-3 py-2 text-xs text-hush-text-primary shadow-sm shadow-black/10">
          {getVisibilityCopy(artifact)}
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[28px] bg-hush-bg-element/92 px-5 py-4 shadow-sm shadow-black/10">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            <BarChart3 className="h-4 w-4" />
            <span>Total voted</span>
          </div>
          <div className="mt-4 flex h-20 items-center rounded-2xl bg-[#151c33] px-6 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_12px_24px_rgba(0,0,0,0.14)]">
            <div className="text-2xl font-semibold text-hush-text-primary">
              {artifact.TotalVotedCount}
            </div>
          </div>
        </div>
        <div className="rounded-[28px] bg-hush-bg-element/92 px-5 py-4 shadow-sm shadow-black/10">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            <ShieldCheck className="h-4 w-4" />
            <span>Eligible</span>
          </div>
          <div className="mt-4 flex h-20 items-center rounded-2xl bg-[#151c33] px-6 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_12px_24px_rgba(0,0,0,0.14)]">
            <div className="text-2xl font-semibold text-hush-text-primary">
              {artifact.EligibleToVoteCount}
            </div>
          </div>
        </div>
        <div className="rounded-[28px] bg-hush-bg-element/92 px-5 py-4 shadow-sm shadow-black/10">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            <Clock3 className="h-4 w-4" />
            <span>Did not vote</span>
          </div>
          <div className="mt-4 flex h-20 items-center rounded-2xl bg-[#151c33] px-6 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_12px_24px_rgba(0,0,0,0.14)]">
            <div className="text-2xl font-semibold text-hush-text-primary">
              {artifact.DidNotVoteCount}
            </div>
          </div>
        </div>
        <div className="rounded-[28px] bg-hush-bg-element/92 px-5 py-4 shadow-sm shadow-black/10">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            <FileDigit className="h-4 w-4" />
            <span>Blank votes</span>
          </div>
          <div className="mt-4 flex h-20 items-center rounded-2xl bg-[#151c33] px-6 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_12px_24px_rgba(0,0,0,0.14)]">
            <div className="text-2xl font-semibold text-hush-text-primary">
              {artifact.BlankCount}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-[24px] bg-[#18203a] p-3 shadow-inner shadow-black/10">
        <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3 rounded-2xl bg-[#232d4f] px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
          <div>Named options</div>
          <div className="text-right">Votes</div>
        </div>
        <div className="mt-3 space-y-3">
          {artifact.NamedOptionResults.map((option) => (
            <div
              key={`${artifact.Id}:${option.OptionId}`}
              className="grid grid-cols-[minmax(0,1fr)_120px] gap-3 rounded-2xl bg-[#1f2848] px-4 py-4 shadow-sm shadow-black/10"
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-hush-purple/22 px-2 text-xs font-semibold text-hush-text-primary">
                  {option.Rank}
                </span>
                <div className="min-w-0">
                  <div className="font-medium text-hush-text-primary">{option.DisplayLabel}</div>
                  {option.ShortDescription ? (
                    <div className="mt-2 text-sm text-hush-text-accent">
                      {option.ShortDescription}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center justify-end text-xl font-semibold text-hush-text-primary">
                {option.VoteCount}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-[24px] bg-[#18203a] p-3 shadow-inner shadow-black/10">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-violet-500/12 p-4">
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
          <div className="rounded-2xl bg-cyan-500/12 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
              Result lineage
            </div>
            <div className="mt-2 space-y-2 text-sm text-hush-text-primary">
              <div>
                Tally ready:{' '}
                <span className="font-mono">{formatArtifactValue(artifact.TallyReadyArtifactId)}</span>
              </div>
              <div>
                Source result:{' '}
                <span className="font-mono">{formatArtifactValue(artifact.SourceResultArtifactId)}</span>
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
      </div>
    </section>
  );
}

function ReportArtifactCatalogCard({ artifact }: { artifact: ElectionReportArtifactView }) {
  return (
    <section
      className="rounded-[24px] bg-[#1a2240] p-4 shadow-sm shadow-black/10"
      data-testid={`report-artifact-${artifact.Id}`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            {getReportArtifactKindLabel(artifact.ArtifactKind)}
          </div>
          <h3 className="mt-2 text-lg font-semibold text-hush-text-primary">{artifact.Title}</h3>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-hush-text-accent">
            <span className="rounded-full bg-hush-purple/16 px-2 py-1 text-hush-text-primary">
              {getFormatLabel(artifact.Format)}
            </span>
            <span className="rounded-full bg-cyan-500/14 px-2 py-1 text-hush-text-primary">
              {getAccessScopeLabel(artifact.AccessScope)}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => downloadReportArtifact(artifact)}
          className="inline-flex items-center gap-2 rounded-xl bg-hush-purple/20 px-3 py-2 text-sm text-hush-text-primary transition-colors hover:bg-hush-purple/28"
          data-testid={`report-artifact-download-${artifact.Id}`}
        >
          <Download className="h-4 w-4" />
          <span>Download</span>
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl bg-violet-500/12 p-3 text-sm text-hush-text-primary">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            Artifact id
          </div>
          <div className="mt-2 font-mono">{formatArtifactValue(artifact.Id)}</div>
          <div className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            Content hash
          </div>
          <div className="mt-2 font-mono">{formatHash(artifact.ContentHash)}</div>
        </div>
        <div className="rounded-2xl bg-emerald-500/12 p-3 text-sm text-hush-text-primary">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            File
          </div>
          <div className="mt-2">{artifact.FileName}</div>
          <div className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            Paired artifact
          </div>
          <div className="mt-2 font-mono">{formatArtifactValue(artifact.PairedArtifactId)}</div>
        </div>
      </div>

      <details className="mt-4 rounded-2xl bg-black/20 p-3">
        <summary className="cursor-pointer text-sm font-medium text-hush-text-primary">
          Open content
        </summary>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-hush-text-accent">
          {artifact.Content}
        </pre>
      </details>
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
  const latestReportPackage = resultView?.LatestReportPackage;
  const visibleReportArtifacts = resultView?.VisibleReportArtifacts ?? [];
  const hasArtifacts = Boolean(unofficialResult || officialResult);
  const hasReportPackage = Boolean(resultView?.CanViewReportPackage && latestReportPackage);
  const reportPackageStatusCopy = latestReportPackage
    ? getPackageStatusCopy(latestReportPackage.Status)
    : null;
  const ReportPackageStatusIcon =
    latestReportPackage?.Status === ElectionReportPackageStatusProto.ReportPackageSealed
      ? ShieldCheck
      : ShieldAlert;
  const shouldShowClosedProgress =
    election.LifecycleState === ElectionLifecycleStateProto.Closed && !unofficialResult;

  if (!hasArtifacts && !shouldShowClosedProgress && !hasReportPackage) {
    return null;
  }

  return (
    <div className="space-y-5" data-testid="election-results-section">
      {hasReportPackage && latestReportPackage ? (
        <section
          id="hush-voting-report-package"
          className={`${sectionClass} space-y-4 scroll-mt-24`}
          data-testid="report-package-summary"
        >
          <div
            className={`rounded-2xl p-4 text-sm ${reportPackageStatusCopy?.className ?? ''}`}
          >
            <div className="flex items-start gap-3">
              <ReportPackageStatusIcon className="mt-0.5 h-5 w-5" />
              <div>
                <div className="font-semibold">
                  {reportPackageStatusCopy?.title}
                </div>
                <div className="mt-2">{reportPackageStatusCopy?.body}</div>
                {resultView?.CanRetryFailedPackageFinalization ? (
                  <div className="mt-3 text-xs uppercase tracking-[0.2em] text-red-100/80">
                    Retry available from owner finalization controls
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-violet-500/12 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                Package id
              </div>
              <div className="mt-2 font-mono text-sm text-hush-text-primary">
                {formatArtifactValue(latestReportPackage.Id)}
              </div>
            </div>
            <div className="rounded-2xl bg-sky-500/12 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                Attempt
              </div>
              <div className="mt-2 text-sm text-hush-text-primary">
                #{latestReportPackage.AttemptNumber}
              </div>
              <div className="mt-2 text-xs text-hush-text-accent">
                Previous: {formatArtifactValue(latestReportPackage.PreviousAttemptId)}
              </div>
            </div>
            <div className="rounded-2xl bg-emerald-500/12 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                Frozen evidence
              </div>
              <div className="mt-2 font-mono text-sm text-hush-text-primary">
                {formatHash(latestReportPackage.FrozenEvidenceHash)}
              </div>
              <div className="mt-2 text-xs text-hush-text-accent">
                {latestReportPackage.FrozenEvidenceFingerprint}
              </div>
            </div>
            <div className="rounded-2xl bg-amber-500/12 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                Sealed / artifacts
              </div>
              <div className="mt-2 text-sm text-hush-text-primary">
                {latestReportPackage.HasSealedAt
                  ? formatTimestamp(latestReportPackage.SealedAt)
                  : 'Not sealed'}
              </div>
              <div className="mt-2 text-xs text-hush-text-accent">
                {latestReportPackage.ArtifactCount} stored artifacts
              </div>
            </div>
          </div>

          {latestReportPackage.FailureReason ? (
            <div className="rounded-xl bg-red-500/12 p-4 text-sm text-red-100">
              {latestReportPackage.FailureReason}
            </div>
          ) : null}

          {visibleReportArtifacts.length > 0 ? (
            <div className="space-y-4" data-testid="report-package-catalog">
              {visibleReportArtifacts.map((artifact) => (
                <ReportArtifactCatalogCard key={artifact.Id} artifact={artifact} />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {shouldShowClosedProgress ? (
        <section
          className="rounded-2xl bg-blue-500/12 p-5 text-blue-100"
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
        <div
          id="hush-voting-unofficial-result"
          className="scroll-mt-24"
          data-testid="election-unofficial-result"
        >
          <ResultArtifactCard
            artifact={unofficialResult}
            label="Unofficial result"
            description="This participant-visible result is produced after close-time drain, tally replay, and aggregate release. It is not yet the official finalized result."
          />
        </div>
      ) : null}

      {officialResult ? (
        <div
          id="hush-voting-official-result"
          data-testid="election-official-result"
          className="space-y-4 scroll-mt-24"
        >
          <section className="rounded-2xl bg-green-500/12 p-4 text-sm text-green-100">
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
        <section className="rounded-2xl bg-hush-purple/10 p-4 text-sm text-hush-text-accent">
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
