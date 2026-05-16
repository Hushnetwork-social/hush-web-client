"use client";

import {
  Archive,
  BarChart3,
  Clock3,
  Download,
  EyeOff,
  FileDigit,
  FileWarning,
  KeyRound,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type {
  ElectionRecordView,
  ElectionAnomalyPublicSummaryBucketView,
  ElectionAnomalyPublicSummaryView,
  ElectionAnomalyReportReadinessView,
  ElectionAnomalyRetentionEvidenceStatusView,
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
  ElectionResultArtifactKindProto,
  ElectionResultArtifactVisibilityProto,
} from '@/lib/grpc';
import {
  formatArtifactValue,
  formatTimestamp,
  getBindingLabel,
  getClosedProgressStatusLabel,
  getCustodyBoundaryCopy,
  getGovernanceLabel,
  getGovernancePathLabel,
  getModeProfileFamilyLabel,
  getOfficialResultVisibilityLabel,
  getSelectedProfileFamilyLabel,
  getSecrecyBoundaryCopy,
} from './contracts';
import { ProtocolPackageBindingPanel } from './ProtocolPackageBindingPanel';

type ElectionResultArtifactsSectionProps = {
  election?: ElectionRecordView;
  resultView: GetElectionResultViewResponse | null;
  showReportPackage?: boolean;
  showResults?: boolean;
};

const sectionClass =
  'rounded-[28px] bg-hush-bg-element/95 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.24)]';

function getVisibilityCopy(artifact: ElectionResultArtifact): string {
  return artifact.Visibility ===
    ElectionResultArtifactVisibilityProto.ElectionResultArtifactPublicPlaintext
    ? 'Public plaintext'
    : 'Participant encrypted';
}

function getTallyReadyLineageCopy(artifact: ElectionResultArtifact): string {
  if (artifact.TallyReadyArtifactId) {
    return formatArtifactValue(artifact.TallyReadyArtifactId);
  }

  if (
    artifact.ArtifactKind === ElectionResultArtifactKindProto.ElectionResultArtifactOfficial &&
    artifact.SourceResultArtifactId
  ) {
    return 'Inherited via source result';
  }

  return 'Not recorded';
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
        title: 'Close result recovery pending',
        body:
          'Voting is already locked. The server is still preparing or recovering the unofficial result artifact for this closed election.',
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

function formatCode(value?: string): string {
  if (!value) {
    return 'Not recorded';
  }

  return value
    .split('_')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function getCountModeLabel(mode: string): string {
  switch (mode) {
    case 'exact':
      return 'Exact';
    case 'aggregated':
      return 'Aggregated';
    case 'suppressed':
      return 'Suppressed';
    default:
      return formatCode(mode);
  }
}

function getPublicCountLabel(bucket: ElectionAnomalyPublicSummaryBucketView): string {
  if (bucket.HasPublicCount) {
    return String(bucket.PublicCount);
  }

  return 'Withheld';
}

function getTotalThreadCountLabel(summary: ElectionAnomalyPublicSummaryView): string {
  if (summary.HasTotalThreadCount) {
    return String(summary.TotalThreadCount);
  }

  return getCountModeLabel(summary.TotalThreadCountMode);
}

function isNoAnomalySummary(summary: ElectionAnomalyPublicSummaryView): boolean {
  return summary.HasTotalThreadCount &&
    summary.TotalThreadCount === 0 &&
    summary.VisibleBuckets.length === 0;
}

function isAllSuppressedSummary(summary: ElectionAnomalyPublicSummaryView): boolean {
  return !isNoAnomalySummary(summary) &&
    summary.VisibleBuckets.length > 0 &&
    summary.VisibleBuckets.every((bucket) => !bucket.HasPublicCount);
}

function SuppressionReasonList({ reasonIds }: { reasonIds: string[] }) {
  if (reasonIds.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2 text-xs text-hush-text-accent">
      {reasonIds.map((reasonId) => (
        <span key={reasonId} className="rounded-full bg-black/20 px-2 py-1">
          {formatCode(reasonId)}
        </span>
      ))}
    </div>
  );
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
    case ElectionReportArtifactKindProto.ReportArtifactMachineRestrictedAnomalyIntakeManifest:
      return 'Restricted anomaly intake manifest';
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

function isRestrictedAnomalyReportArtifact(artifact: ElectionReportArtifactView): boolean {
  return artifact.ArtifactKind ===
    ElectionReportArtifactKindProto.ReportArtifactMachineRestrictedAnomalyIntakeManifest;
}

function PublicAnomalySummaryPanel({ summary }: { summary: ElectionAnomalyPublicSummaryView }) {
  const noAnomaly = isNoAnomalySummary(summary);
  const allSuppressed = isAllSuppressedSummary(summary);

  return (
    <section
      className="rounded-[24px] bg-[#17203a] p-4 shadow-sm shadow-black/10"
      data-testid="public-anomaly-summary-panel"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            Public anomaly summary
          </div>
          <h3 className="mt-2 text-lg font-semibold text-hush-text-primary">
            Privacy-safe anomaly reporting
          </h3>
          <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
            Counts are published only when the category remains safe to show. Suppressed buckets keep
            the report honest without exposing submitter identity or private case context.
          </p>
        </div>
        <div className="rounded-xl bg-cyan-500/14 px-3 py-2 text-xs font-medium text-hush-text-primary">
          {summary.SuppressionPolicyId}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-cyan-500/12 p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            Total threads
          </div>
          <div className="mt-3 flex h-16 items-center rounded-xl bg-[#11182c] px-4 text-2xl font-semibold text-hush-text-primary">
            {getTotalThreadCountLabel(summary)}
          </div>
        </div>
        <div className="rounded-2xl bg-emerald-500/12 p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            Visible buckets
          </div>
          <div className="mt-3 flex h-16 items-center rounded-xl bg-[#11182c] px-4 text-2xl font-semibold text-hush-text-primary">
            {summary.VisibleBuckets.length}
          </div>
        </div>
        <div className="rounded-2xl bg-amber-500/12 p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            Suppressed threads
          </div>
          <div className="mt-3 flex h-16 items-center rounded-xl bg-[#11182c] px-4 text-2xl font-semibold text-hush-text-primary">
            {summary.SuppressedThreadCount}
          </div>
        </div>
        <div className="rounded-2xl bg-violet-500/12 p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            Count mode
          </div>
          <div className="mt-3 flex h-16 items-center rounded-xl bg-[#11182c] px-4 text-sm font-semibold text-hush-text-primary">
            {getCountModeLabel(summary.TotalThreadCountMode)}
          </div>
        </div>
      </div>

      {noAnomaly ? (
        <div className="mt-4 rounded-2xl bg-emerald-500/12 p-4 text-sm text-emerald-100">
          No anomaly threads are included in the sealed report package.
        </div>
      ) : null}

      {allSuppressed ? (
        <div className="mt-4 rounded-2xl bg-amber-500/12 p-4 text-sm text-amber-100">
          All anomaly counts are withheld by the public suppression policy.
        </div>
      ) : null}

      {summary.VisibleBuckets.length > 0 ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {summary.VisibleBuckets.map((bucket) => (
            <div
              key={`${bucket.CategoryId}:${bucket.CountMode}`}
              className="rounded-2xl bg-[#202946] p-4 shadow-sm shadow-black/10"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    {getCountModeLabel(bucket.CountMode)}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-hush-text-primary">
                    {formatCode(bucket.CategoryId)}
                  </div>
                </div>
                <div className="rounded-xl bg-black/25 px-3 py-2 text-lg font-semibold text-hush-text-primary">
                  {getPublicCountLabel(bucket)}
                </div>
              </div>
              {bucket.SourceCategoryIds.length > 1 ? (
                <div className="mt-3 text-xs text-hush-text-accent">
                  Aggregates {bucket.SourceCategoryIds.length} source categories.
                </div>
              ) : null}
              <SuppressionReasonList reasonIds={bucket.SuppressionReasonIds} />
            </div>
          ))}
        </div>
      ) : null}

      <SuppressionReasonList reasonIds={summary.SuppressionReasonIds} />
    </section>
  );
}

function RetentionEvidenceStatus({
  status,
}: {
  status?: ElectionAnomalyRetentionEvidenceStatusView;
}) {
  if (!status) {
    return null;
  }

  const toneClass = status.ReadinessBlocksValidationClaims
    ? 'bg-amber-500/12 text-amber-100 ring-1 ring-amber-300/20'
    : 'bg-emerald-500/12 text-emerald-100';

  return (
    <div className={`rounded-2xl p-4 text-sm ${toneClass}`} data-testid="anomaly-retention-status">
      <div className="flex items-start gap-3">
        <Archive className="mt-0.5 h-5 w-5" />
        <div>
          <div className="font-semibold">{formatCode(status.StatusId)}</div>
          <div className="mt-2">{status.Message}</div>
          <div className="mt-3 grid gap-2 text-xs text-hush-text-accent md:grid-cols-3">
            <span>Open: {status.OpenCaseCount}</span>
            <span>Escalated: {status.EscalatedCaseCount}</span>
            <span>Redaction holds: {status.RedactionHoldReferenceCount}</span>
          </div>
          {status.GovernedDecisionRefs.length > 0 ? (
            <div className="mt-3 text-xs text-hush-text-accent">
              Governed refs: {status.GovernedDecisionRefs.join(', ')}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AnomalyReportReadinessStrip({
  readiness,
}: {
  readiness: ElectionAnomalyReportReadinessView;
}) {
  const blocked = readiness.PackageReadinessStatusId === 'blocked' ||
    readiness.RetentionEvidenceStatus?.ReadinessBlocksValidationClaims;

  return (
    <section
      className={`rounded-[24px] bg-[#18213c] p-4 shadow-sm shadow-black/10 ${
        blocked ? 'ring-1 ring-amber-300/20' : ''
      }`}
      data-testid="anomaly-report-readiness-strip"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            Readiness and retention
          </div>
          <h3 className="mt-2 text-lg font-semibold text-hush-text-primary">
            Anomaly package status
          </h3>
        </div>
        <div className="rounded-xl bg-black/20 px-3 py-2 text-xs font-medium text-hush-text-primary">
          {readiness.ReportGenerationReadOnlyStatusId}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-cyan-500/12 p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            Package readiness
          </div>
          <div className="mt-3 rounded-xl bg-[#11182c] px-4 py-3 text-sm font-semibold text-hush-text-primary">
            {formatCode(readiness.PackageReadinessStatusId)}
          </div>
        </div>
        <div className="rounded-2xl bg-emerald-500/12 p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            Public scan
          </div>
          <div className="mt-3 rounded-xl bg-[#11182c] px-4 py-3 text-sm font-semibold text-hush-text-primary">
            {formatCode(readiness.ForbiddenFieldScanStatusId)}
          </div>
        </div>
        <div className="rounded-2xl bg-violet-500/12 p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            Open cases
          </div>
          <div className="mt-3 rounded-xl bg-[#11182c] px-4 py-3 text-sm font-semibold text-hush-text-primary">
            {readiness.OpenCaseCount}
          </div>
        </div>
        <div className="rounded-2xl bg-amber-500/12 p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            Escalated
          </div>
          <div className="mt-3 rounded-xl bg-[#11182c] px-4 py-3 text-sm font-semibold text-hush-text-primary">
            {readiness.EscalatedCaseCount}
          </div>
        </div>
      </div>

      {readiness.PackageReadinessBlockerIds.length > 0 ? (
        <div className="mt-4 rounded-2xl bg-amber-500/12 p-4 text-sm text-amber-100">
          <div className="font-semibold">Readiness blockers</div>
          <SuppressionReasonList reasonIds={readiness.PackageReadinessBlockerIds} />
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl bg-black/20 p-4 text-sm text-hush-text-accent">
          <div className="text-xs font-semibold uppercase tracking-[0.2em]">
            Restricted manifest ref
          </div>
          <div className="mt-2 font-mono text-hush-text-primary">
            {formatArtifactValue(readiness.RestrictedManifestArtifactId)}
          </div>
          <div className="mt-2 font-mono">
            {formatArtifactValue(readiness.RestrictedManifestHash)}
          </div>
        </div>
        <RetentionEvidenceStatus status={readiness.RetentionEvidenceStatus} />
      </div>
    </section>
  );
}

function RestrictedAnomalyArtifactRow({
  artifact,
  summary,
  readiness,
}: {
  artifact?: ElectionReportArtifactView;
  summary?: ElectionAnomalyPublicSummaryView;
  readiness?: ElectionAnomalyReportReadinessView;
}) {
  const expectedArtifactId = summary?.RestrictedManifestArtifactId ||
    readiness?.RestrictedManifestArtifactId ||
    '';
  const expectedHash = summary?.RestrictedManifestHash || readiness?.RestrictedManifestHash || '';
  const hasExpectedReference = Boolean(
    summary?.HasRestrictedManifestArtifactId ||
      readiness?.HasRestrictedManifestArtifactId ||
      expectedArtifactId
  );
  const mismatch = Boolean(artifact && expectedArtifactId && artifact.Id !== expectedArtifactId);

  if (!artifact && !hasExpectedReference && !readiness?.PackageReadinessBlockerIds.length) {
    return null;
  }

  return (
    <section
      className={`rounded-[24px] bg-[#1a2240] p-4 shadow-sm shadow-black/10 ${
        mismatch ? 'ring-1 ring-red-300/30' : ''
      }`}
      data-testid="restricted-anomaly-artifact-row"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            <LockKeyhole className="h-4 w-4" />
            <span>Restricted anomaly manifest</span>
          </div>
          <h3 className="mt-2 text-lg font-semibold text-hush-text-primary">
            {artifact?.Title ?? 'Restricted artifact reference'}
          </h3>
          <div className="mt-2 text-sm text-hush-text-accent">
            {artifact
              ? 'Download is available for the current report-package role.'
              : 'The sealed report records a restricted manifest reference, but no downloadable artifact is visible in this view.'}
          </div>
        </div>
        {artifact ? (
          <button
            type="button"
            onClick={() => downloadReportArtifact(artifact)}
            className="inline-flex items-center gap-2 rounded-xl bg-hush-purple/20 px-3 py-2 text-sm text-hush-text-primary transition-colors hover:bg-hush-purple/28"
            data-testid="restricted-anomaly-artifact-download"
          >
            <Download className="h-4 w-4" />
            <span>Download</span>
          </button>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-xl bg-amber-500/12 px-3 py-2 text-sm text-amber-100">
            <EyeOff className="h-4 w-4" />
            <span>Not visible</span>
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-violet-500/12 p-3 text-sm text-hush-text-primary">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            Expected id
          </div>
          <div className="mt-2 font-mono">{formatArtifactValue(expectedArtifactId)}</div>
        </div>
        <div className="rounded-2xl bg-cyan-500/12 p-3 text-sm text-hush-text-primary">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            Expected hash
          </div>
          <div className="mt-2 font-mono">{formatArtifactValue(expectedHash)}</div>
        </div>
        <div className="rounded-2xl bg-emerald-500/12 p-3 text-sm text-hush-text-primary">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            Visible file
          </div>
          <div className="mt-2">{artifact?.FileName ?? 'None'}</div>
        </div>
      </div>

      {mismatch ? (
        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-red-500/12 p-4 text-sm text-red-100">
          <FileWarning className="mt-0.5 h-5 w-5" />
          <div>Restricted manifest artifact id does not match the public report reference.</div>
        </div>
      ) : null}
    </section>
  );
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
                <span className="font-mono">{getTallyReadyLineageCopy(artifact)}</span>
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
  const restrictedAnomalyArtifact = isRestrictedAnomalyReportArtifact(artifact);

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

      {restrictedAnomalyArtifact ? (
        <div className="mt-4 rounded-2xl bg-amber-500/12 p-3 text-sm text-amber-100">
          Restricted manifest content is available by download only.
        </div>
      ) : (
        <details className="mt-4 rounded-2xl bg-black/20 p-3">
          <summary className="cursor-pointer text-sm font-medium text-hush-text-primary">
            Open content
          </summary>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-hush-text-accent">
            {artifact.Content}
          </pre>
        </details>
      )}
    </section>
  );
}

export function ElectionResultArtifactsSection({
  election,
  resultView,
  showReportPackage = true,
  showResults = true,
}: ElectionResultArtifactsSectionProps) {
  if (!election) {
    return null;
  }

  const officialResult = showResults ? resultView?.OfficialResult : null;
  const unofficialResult = showResults && !officialResult ? resultView?.UnofficialResult : null;
  const latestReportPackage = resultView?.LatestReportPackage;
  const visibleReportArtifacts = resultView?.VisibleReportArtifacts ?? [];
  const publicAnomalySummary = resultView?.PublicAnomalySummary;
  const anomalyReportReadiness = resultView?.AnomalyReportReadiness;
  const restrictedAnomalyArtifact = visibleReportArtifacts.find(isRestrictedAnomalyReportArtifact);
  const catalogReportArtifacts = visibleReportArtifacts.filter(
    (artifact) => !isRestrictedAnomalyReportArtifact(artifact)
  );
  const ceremonySnapshot = resultView?.CeremonySnapshot;
  const closedProgressStatus =
    resultView?.ClosedProgressStatus ?? election.ClosedProgressStatus;
  const officialVisibilityPolicy =
    resultView?.OfficialResultVisibilityPolicy ?? election.OfficialResultVisibilityPolicy;
  const hasResultArtifacts = Boolean(unofficialResult || officialResult);
  const hasReportPackage = Boolean(
    showReportPackage && resultView?.CanViewReportPackage && latestReportPackage
  );
  const reportPackageStatusCopy = latestReportPackage
    ? getPackageStatusCopy(latestReportPackage.Status)
    : null;
  const ReportPackageStatusIcon =
    latestReportPackage?.Status === ElectionReportPackageStatusProto.ReportPackageSealed
      ? ShieldCheck
      : ShieldAlert;
  const shouldShowClosedProgress =
    showResults &&
    election.LifecycleState === ElectionLifecycleStateProto.Closed &&
    !unofficialResult;

  if (!hasResultArtifacts && !shouldShowClosedProgress && !hasReportPackage) {
    return null;
  }

  return (
    <div className="space-y-5" data-testid="election-results-section">
      <section className={sectionClass} data-testid="election-artifact-context">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
              Artifact context
            </div>
            <h2 className="mt-2 text-xl font-semibold text-hush-text-primary">
              Mode and circuit truth
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
              Later artifacts must keep the election mode, bound profile context, and secrecy
              boundary explicit so auditors and operators do not have to reconstruct that contract
              externally.
            </p>
          </div>
          <div className="rounded-xl bg-hush-purple/20 px-3 py-2 text-xs text-hush-text-primary shadow-sm shadow-black/10">
            {getBindingLabel(election.BindingStatus)}
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-7">
          <div className="rounded-2xl bg-violet-500/12 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
              Election mode
            </div>
            <div className="mt-2 text-sm font-medium text-hush-text-primary">
              {getBindingLabel(election.BindingStatus)}
            </div>
          </div>
          <div className="rounded-2xl bg-sky-500/12 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
              Governance path
            </div>
            <div className="mt-2 text-sm font-medium text-hush-text-primary">
              {getGovernancePathLabel(election.GovernanceMode)}
            </div>
            <div className="mt-2 text-xs text-hush-text-accent">
              {getGovernanceLabel(election.GovernanceMode)}
            </div>
          </div>
          <div className="rounded-2xl bg-sky-500/12 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
              Allowed circuit families
            </div>
            <div className="mt-2 text-sm font-medium text-hush-text-primary">
              {getModeProfileFamilyLabel(election.BindingStatus)}
            </div>
          </div>
          <div className="rounded-2xl bg-indigo-500/12 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
              Selected circuit family
            </div>
            <div className="mt-2 text-sm font-medium text-hush-text-primary">
              {getSelectedProfileFamilyLabel(election.SelectedProfileDevOnly)}
            </div>
          </div>
          <div className="rounded-2xl bg-emerald-500/12 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
              Bound ceremony profile
            </div>
            <div className="mt-2 text-sm font-medium text-hush-text-primary">
              {ceremonySnapshot?.ProfileId || 'Not recorded'}
            </div>
            {ceremonySnapshot ? (
              <div className="mt-2 text-xs text-hush-text-accent">
                Threshold {ceremonySnapshot.RequiredApprovalCount} of {ceremonySnapshot.TrusteeCount}
              </div>
            ) : null}
          </div>
          <div className="rounded-2xl bg-amber-500/12 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
              Tally key fingerprint
            </div>
            <div className="mt-2 font-mono text-sm text-hush-text-primary">
              {formatArtifactValue(ceremonySnapshot?.TallyPublicKeyFingerprint)}
            </div>
          </div>
          <div className="rounded-2xl bg-cyan-500/12 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
              Official visibility
            </div>
            <div className="mt-2 text-sm font-medium text-hush-text-primary">
              {getOfficialResultVisibilityLabel(officialVisibilityPolicy)}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-2xl bg-black/20 p-4 text-sm text-hush-text-accent">
            {getSecrecyBoundaryCopy(election.SelectedProfileDevOnly)}
          </div>
          <div className="rounded-2xl bg-sky-500/10 p-4 text-sm text-hush-text-accent">
            {getCustodyBoundaryCopy(election.GovernanceMode)}
          </div>
        </div>
      </section>

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
              <div
                className="mt-2 text-xs text-hush-text-accent"
                title={latestReportPackage.FrozenEvidenceFingerprint}
              >
                {formatArtifactValue(latestReportPackage.FrozenEvidenceFingerprint)}
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

          <div
            className="rounded-2xl bg-black/20 p-4 text-sm text-hush-text-accent"
            data-testid="report-package-boundary-context"
          >
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
              Package boundary truth
            </div>
            <div className="mt-2 text-hush-text-primary">
              {getBindingLabel(election.BindingStatus)} · {getGovernancePathLabel(election.GovernanceMode)}
            </div>
            <div className="mt-2">
              Allowed circuit families: {getModeProfileFamilyLabel(election.BindingStatus)}.
              {' '}Selected circuit family: {getSelectedProfileFamilyLabel(election.SelectedProfileDevOnly)}.
              {ceremonySnapshot?.ProfileId
                ? ` Bound ceremony profile: ${ceremonySnapshot.ProfileId}.`
                : ' Bound ceremony profile is not recorded on this surface.'}
            </div>
            <div className="mt-2">{getSecrecyBoundaryCopy(election.SelectedProfileDevOnly)}</div>
            <div className="mt-2">{getCustodyBoundaryCopy(election.GovernanceMode)}</div>
          </div>

          {resultView?.ProtocolPackageBinding ? (
            <ProtocolPackageBindingPanel
              binding={resultView.ProtocolPackageBinding}
              mode="evidence"
              testId="report-package-protocol-package-refs"
            />
          ) : null}

          {publicAnomalySummary ? (
            <PublicAnomalySummaryPanel summary={publicAnomalySummary} />
          ) : null}

          {anomalyReportReadiness ? (
            <AnomalyReportReadinessStrip readiness={anomalyReportReadiness} />
          ) : null}

          {publicAnomalySummary || anomalyReportReadiness || restrictedAnomalyArtifact ? (
            <RestrictedAnomalyArtifactRow
              artifact={restrictedAnomalyArtifact}
              summary={publicAnomalySummary}
              readiness={anomalyReportReadiness}
            />
          ) : null}

          {latestReportPackage.FailureReason ? (
            <div className="rounded-xl bg-red-500/12 p-4 text-sm text-red-100">
              {latestReportPackage.FailureReason}
            </div>
          ) : null}

          {catalogReportArtifacts.length > 0 ? (
            <div className="space-y-4" data-testid="report-package-catalog">
              {catalogReportArtifacts.map((artifact) => (
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
                  closedProgressStatus
                ).title}
              </div>
              <div className="mt-2 text-sm">
                {
                  renderProgressCopy(
                    closedProgressStatus
                  ).body
                }
              </div>
              <div className="mt-3 text-xs uppercase tracking-[0.2em] text-blue-100/80">
                {closedProgressStatus ===
                ElectionClosedProgressStatusProto.ClosedProgressNone
                  ? 'Close recovery pending'
                  : getClosedProgressStatusLabel(closedProgressStatus)}
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
          className="scroll-mt-24"
        >
          <ResultArtifactCard
            artifact={officialResult}
            label="Official result"
            description="This artifact is created at finalization by copying the unofficial result into the election's official visibility mode."
          />
        </div>
      ) : null}

      {showResults && resultView?.CanViewParticipantEncryptedResults ? (
        <section className="rounded-2xl bg-hush-purple/10 p-4 text-sm text-hush-text-accent">
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 h-5 w-5 text-hush-purple" />
            <div>
              {election.SelectedProfileDevOnly
                ? 'You can inspect these artifacts because your actor is part of the election. The selected open-audit circuit remains intentionally readable where artifact visibility allows it.'
                : 'Participant-encrypted artifacts are readable in this view because your actor is part of the election. Public readers only see official plaintext results when the election policy allows it.'}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
