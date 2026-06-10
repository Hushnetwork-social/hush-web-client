"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Archive,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  Database,
  Download,
  Fingerprint,
  FileCheck2,
  GitBranch,
  ListChecks,
  Loader2,
  PackageCheck,
  ShieldCheck,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { buildApiUrl } from '@/lib/api-config';
import {
  READINESS_DASHBOARD_PUBLIC_KEY_HEADER,
  READINESS_DASHBOARD_ROUTE,
  buildReadinessProfileApiRoute,
  type ReadinessDashboardClientGate,
  type ReadinessProfileApiResponse,
  type ReadinessProfileAssessmentView,
  type ReadinessProfileEvidenceItemView,
  type ReadinessProfileEvidenceCheckView,
} from '@/lib/readinessDashboard';
import { useAppStore } from '@/stores/useAppStore';

async function defaultFetchReadinessProfile(
  profileId: string,
  publicKey?: string | null
): Promise<ReadinessProfileApiResponse> {
  const response = await fetch(buildApiUrl(buildReadinessProfileApiRoute(profileId)), {
    headers: publicKey
      ? {
          [READINESS_DASHBOARD_PUBLIC_KEY_HEADER]: publicKey,
        }
      : undefined,
  });

  return (await response.json()) as ReadinessProfileApiResponse;
}

function formatStatus(value: string): string {
  return value.replace(/_/g, ' ');
}

function getFileNameFromContentDisposition(value: string | null, fallback: string): string {
  if (!value) {
    return fallback;
  }

  const encodedMatch = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch?.[1]) {
    try {
      return decodeURIComponent(encodedMatch[1].replace(/"/g, ''));
    } catch {
      return encodedMatch[1].replace(/"/g, '');
    }
  }

  const simpleMatch = value.match(/filename="?([^";]+)"?/i);
  return simpleMatch?.[1] ?? fallback;
}

function shortenMiddle(value: string, visibleStart = 18, visibleEnd = 12): string {
  if (value.length <= visibleStart + visibleEnd + 3) {
    return value;
  }

  return `${value.slice(0, visibleStart)}...${value.slice(-visibleEnd)}`;
}

function formatDate(value: string): string {
  if (!value) {
    return 'Not recorded';
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(parsed);
}

function getCategoryAccent(category: string): {
  label: string;
  chip: string;
  icon: LucideIcon;
} {
  switch (category) {
    case 'protocol':
      return {
        label: 'Protocol',
        chip: 'bg-cyan-950/70 text-cyan-100',
        icon: Fingerprint,
      };
    case 'deployment':
      return {
        label: 'Deployment',
        chip: 'bg-sky-950/70 text-sky-100',
        icon: PackageCheck,
      };
    case 'lifecycle':
      return {
        label: 'Lifecycle',
        chip: 'bg-sky-950/70 text-sky-100',
        icon: GitBranch,
      };
    case 'verification':
      return {
        label: 'Verification',
        chip: 'bg-emerald-950/70 text-emerald-100',
        icon: ShieldCheck,
      };
    case 'privacy':
      return {
        label: 'Privacy',
        chip: 'bg-teal-950/70 text-teal-100',
        icon: Archive,
      };
    case 'trustee':
      return {
        label: 'Trustee',
        chip: 'bg-amber-950/70 text-amber-100',
        icon: ClipboardCheck,
      };
    default:
      return {
        label: 'Profile',
        chip: 'bg-hush-bg-dark/72 text-hush-text-accent',
        icon: FileCheck2,
      };
  }
}

function getCheckVisualState(check: ReadinessProfileEvidenceCheckView): {
  surface: string;
  rail: string;
  header: string;
  badge: string;
  label: string;
  icon: LucideIcon;
} {
  switch (check.status) {
    case 'passed':
      return {
        surface: 'bg-slate-800/30',
        rail: 'bg-emerald-300',
        header: 'bg-slate-800/42',
        badge: 'bg-emerald-950/85 text-emerald-100',
        label: 'passed',
        icon: CheckCircle2,
      };
    case 'developer_adjusted':
      return {
        surface: 'bg-slate-800/30',
        rail: 'bg-amber-300',
        header: 'bg-slate-800/42',
        badge: 'bg-amber-950/85 text-amber-100',
        label: 'developer adjusted',
        icon: CircleAlert,
      };
    case 'disabled':
    case 'not_applicable':
      return {
        surface: 'bg-slate-800/30',
        rail: 'bg-slate-400',
        header: 'bg-slate-800/42',
        badge: 'bg-slate-700/90 text-slate-100',
        label: check.status === 'disabled' ? 'disabled' : 'not applicable',
        icon: Clock3,
      };
    case 'failed':
      return {
        surface: 'bg-slate-800/30',
        rail: 'bg-red-400',
        header: 'bg-slate-800/42',
        badge: 'bg-red-900/90 text-red-50',
        label: 'failed',
        icon: XCircle,
      };
    default:
      return {
        surface: 'bg-slate-800/30',
        rail: 'bg-amber-300',
        header: 'bg-slate-800/42',
        badge: 'bg-amber-950/80 text-amber-100',
        label: formatStatus(check.status),
        icon: CircleAlert,
      };
  }
}

function getAssessmentBadgeClass(assessment: ReadinessProfileAssessmentView): string {
  if (assessment.severity === 'red') {
    return 'bg-red-900/90 text-red-50';
  }

  if (assessment.severity === 'amber') {
    return 'bg-amber-950/85 text-amber-100';
  }

  return 'bg-emerald-950/85 text-emerald-100';
}

function MetadataPill({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  const displayValue = compact ? shortenMiddle(value, 16, 10) : value;

  return (
    <div className="rounded-lg bg-hush-bg-dark/55 px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase text-hush-text-accent">{label}</dt>
      <dd
        className="mt-1 break-words text-sm font-semibold text-hush-text-primary"
        title={compact ? value : undefined}
      >
        {displayValue}
      </dd>
    </div>
  );
}

function DetailList({
  values,
  empty,
  compact = false,
}: {
  values: string[];
  empty: string;
  compact?: boolean;
}) {
  if (values.length === 0) {
    return (
      <p className="rounded-md bg-hush-bg-element/80 px-3 py-2 text-xs text-hush-text-accent">
        {empty}
      </p>
    );
  }

  return (
    <ul className="flex flex-wrap gap-2 text-xs text-hush-text-accent">
      {values.map((value) => (
        <li
          key={value}
          className={`rounded-md bg-hush-bg-element/80 px-2.5 py-1.5 text-hush-text-accent ${
            compact ? 'max-w-full truncate' : 'break-words'
          }`}
          title={compact ? value : undefined}
        >
          {compact ? shortenMiddle(value, 48, 18) : value}
        </li>
      ))}
    </ul>
  );
}

function SummaryStat({
  label,
  value,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: 'green' | 'amber' | 'gray' | 'cyan' | 'blue' | 'default';
}) {
  const accentClass =
    tone === 'green'
      ? 'text-emerald-100'
      : tone === 'amber'
        ? 'text-amber-100'
        : tone === 'gray'
          ? 'text-slate-100'
          : tone === 'cyan'
            ? 'text-cyan-100'
            : tone === 'blue'
              ? 'text-sky-100'
              : 'text-hush-text-primary';

  return (
    <div className="flex min-h-20 items-center gap-3 rounded-lg bg-hush-bg-element/95 px-4 py-3 shadow-sm shadow-black/20">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md bg-hush-bg-dark/72 ${accentClass}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div>
        <dt className="text-[11px] font-semibold uppercase text-hush-text-accent">{label}</dt>
        <dd className={`mt-1 text-lg font-semibold ${accentClass}`}>{value}</dd>
      </div>
    </div>
  );
}

function InspectionTile({
  label,
  value,
  icon: Icon,
  tone = 'cyan',
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: 'cyan' | 'blue' | 'emerald' | 'amber' | 'slate';
}) {
  const iconClass =
    tone === 'cyan'
      ? 'text-cyan-200'
      : tone === 'blue'
        ? 'text-sky-200'
        : tone === 'emerald'
          ? 'text-emerald-200'
          : tone === 'amber'
            ? 'text-amber-200'
            : 'text-slate-200';

  return (
    <div className="min-h-28 rounded-lg bg-hush-bg-element/95 px-3 py-3 shadow-sm shadow-black/20">
      <div className="flex items-center gap-2 text-xs font-semibold text-hush-text-primary">
        <Icon className={`h-4 w-4 ${iconClass}`} aria-hidden="true" />
        {label}
      </div>
      <p className="mt-2 text-sm leading-6 text-hush-text-accent">{value}</p>
    </div>
  );
}

function ProofChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-hush-bg-element/95 px-3 py-2.5 shadow-sm shadow-black/15">
      <dt className="text-[11px] font-semibold uppercase text-hush-text-accent">{label}</dt>
      <dd className="mt-1 break-words text-xs font-semibold text-hush-text-primary">{value}</dd>
    </div>
  );
}

function sanitizeInternalReferenceText(value: string): string {
  return value
    .replace(/EPIC-\d+\s+and\s+FEAT-\d+\s+through\s+FEAT-\d+/gi, 'the promoted readiness evidence set')
    .replace(/FEAT-\d+\s+through\s+FEAT-\d+/gi, 'the promoted delivery evidence set')
    .replace(/EPIC-\d+/gi, 'the readiness program')
    .replace(/FEAT-\d+/gi, 'delivery evidence')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function getEvidencePurpose(item: ReadinessProfileEvidenceItemView): {
  title: string;
  description: string;
} {
  const sourceGap = item.sourceGapRow.toLowerCase();

  if (sourceGap.includes('protocol/evidence architecture')) {
    return {
      title: 'Protocol and evidence architecture traceability',
      description:
        'Verifies that the active readiness package links the protocol baseline, evidence register, proof-package artifacts, and manifest context for this readiness version.',
    };
  }

  if (sourceGap.includes('publication/counting')) {
    return {
      title: 'Publication, count, and tally proof binding',
      description:
        'Verifies that publication and counting evidence remain bound to the active protocol package, verifier contract, and promoted readiness version.',
    };
  }

  if (sourceGap.includes('trusted deployment ceremony')) {
    return {
      title: 'Deployment ceremony and release artifact binding',
      description:
        'Verifies that deployment ceremony evidence, release artifact identity, package manifests, and downstream handoff records are traceable.',
    };
  }

  if (sourceGap.includes('kms custody') || sourceGap.includes('custody lifecycle')) {
    return {
      title: 'Per-election custody lifecycle controls',
      description:
        'Verifies that election custody, key-management lifecycle, finalization cleanup, reconciliation, and redaction controls are recorded for the readiness claim.',
    };
  }

  if (sourceGap.includes('verifier') || sourceGap.includes('tamper')) {
    return {
      title: 'Verifier corpus and tamper-sample coverage',
      description:
        'Verifies that verifier package samples, tamper cases, and reproducible validation records are bound to the readiness package.',
    };
  }

  if (sourceGap.includes('receipt') || sourceGap.includes('inclusion')) {
    return {
      title: 'Receipt and inclusion verification coverage',
      description:
        'Verifies receipt export/import, inclusion proof handling, and package-bound verifier output used by the readiness claim.',
    };
  }

  if (sourceGap.includes('retention') || sourceGap.includes('privacy')) {
    return {
      title: 'Retention, log privacy, and public/restricted boundary',
      description:
        'Verifies retention behavior, log privacy proof evidence, public-safe boundaries, and restricted-reviewer artifact handling.',
    };
  }

  if (sourceGap.includes('void') || sourceGap.includes('publication replacement')) {
    return {
      title: 'Void decision and publication replacement evidence',
      description:
        'Verifies owner void-decision handling, replacement publication evidence, public/verifier status, and focused validation records.',
    };
  }

  if (sourceGap.includes('governed') || sourceGap.includes('continuity')) {
    return {
      title: 'Governed outcome and continuity evidence',
      description:
        'Verifies governed-outcome handoff records, abnormal finalization handling, and continuity evidence for the readiness package.',
    };
  }

  if (sourceGap.includes('pilot') || sourceGap.includes('legal') || sourceGap.includes('governance')) {
    return {
      title: 'Pilot, governance, and external-boundary wrapper',
      description:
        'Verifies pilot-scope readiness, governance boundary wording, support readiness, and external-boundary limitations.',
    };
  }

  if (item.sourceGapRow) {
    return {
      title: item.sourceGapRow,
      description:
        'Verifies that this readiness evidence row has accepted status, current freshness, traceable artifacts, and recorded check results.',
    };
  }

  return {
    title: 'Readiness evidence traceability',
    description:
      'Verifies that this readiness evidence row is traceable to the active register, supporting artifacts, and recorded check results.',
  };
}

function getEvidenceItemVisualState(item: ReadinessProfileEvidenceItemView): {
  icon: LucideIcon;
  iconShell: string;
  rail: string;
  statusBadge: string;
  freshnessBadge: string;
  warningReason: string;
} {
  const staleFreshness = item.freshnessState === 'stale' || item.staleReason.trim().length > 0;

  if (item.status === 'rejected') {
    return {
      icon: XCircle,
      iconShell: 'bg-red-950/70 text-red-100',
      rail: 'bg-red-400',
      statusBadge: 'bg-red-900/80 text-red-50',
      freshnessBadge: 'bg-hush-bg-element/75 text-hush-text-accent',
      warningReason: sanitizeInternalReferenceText(
        item.residualRisk || 'Evidence row is rejected and cannot satisfy this readiness check.'
      ),
    };
  }

  if (item.status !== 'accepted' || staleFreshness) {
    const statusReason =
      item.status === 'observed'
        ? 'Evidence is observed but not accepted.'
        : `Evidence status is ${formatStatus(item.status)}, not accepted.`;
    const freshnessReason = staleFreshness
      ? `Freshness is ${formatStatus(item.freshnessState)}${
          item.staleReason ? `: ${item.staleReason}` : '.'
        }`
      : '';
    const residualReason = item.residualRisk ? sanitizeInternalReferenceText(item.residualRisk) : '';
    const warningReason = [statusReason, freshnessReason, residualReason]
      .filter((value) => value.trim().length > 0)
      .join(' ');

    return {
      icon: CircleAlert,
      iconShell: 'bg-amber-950/70 text-amber-100',
      rail: 'bg-amber-300',
      statusBadge: 'bg-amber-950/85 text-amber-100',
      freshnessBadge: staleFreshness
        ? 'bg-amber-950/72 text-amber-100'
        : 'bg-hush-bg-element/75 text-hush-text-accent',
      warningReason,
    };
  }

  return {
    icon: CheckCircle2,
    iconShell: 'bg-hush-bg-element/80 text-emerald-100',
    rail: 'bg-emerald-300/80',
    statusBadge: 'bg-emerald-950/68 text-emerald-100',
    freshnessBadge: 'bg-hush-bg-element/75 text-hush-text-accent',
    warningReason: '',
  };
}

function getEvidenceWarningExplanation(item: ReadinessProfileEvidenceItemView): {
  why: string;
  meaning?: string;
  resolution: string;
} | null {
  const sourceGap = item.sourceGapRow.toLowerCase();
  const checkSummary = item.checkResults
    .map((result) => result.summary)
    .join(' ')
    .toLowerCase();
  const rowContext = `${sourceGap} ${checkSummary} ${item.residualRisk}`.toLowerCase();

  if (item.status === 'accepted' && item.freshnessState !== 'stale' && !item.staleReason) {
    return null;
  }

  if (rowContext.includes('verifier') || rowContext.includes('tamper')) {
    return {
      why:
        'The active readiness register sees verifier evidence, but this row is still recorded as observed instead of accepted. That means the report cannot count it as passed until the runnable public sample corpus and fail-closed tamper corpus are accepted or this baseline row is superseded.',
      meaning:
        'A tamper corpus is a controlled set of deliberately modified verifier packages used to prove that the public verifier rejects bad evidence. Examples include changed artifact hashes, stale package references, mismatched manifests, altered proof/result files, or wrong election/package identifiers. It is test evidence, not evidence that someone attacked an election.',
      resolution:
        'Promote the accepted verifier-corpus evidence into the active readiness register, or mark this observed baseline row as superseded by that accepted evidence. Then regenerate the readiness register and ZIP report; rerunning the same report without changing the register will keep this warning.',
    };
  }

  if (rowContext.includes('operational') || rowContext.includes('support')) {
    return {
      why:
        'The active readiness register sees partial operational/support evidence, but this row is still recorded as observed instead of accepted. That keeps the check at warning level because the report cannot prove a complete repeatable operational evidence package from this row.',
      resolution:
        'Promote the accepted operational evidence package into the active readiness register, or supersede this observed row with the accepted operational-readiness fragment. Then regenerate the readiness register and ZIP report; rerunning the same report without changing the register will keep this warning.',
    };
  }

  return {
    why:
      'Observed means evidence exists, but the active readiness register has not accepted it as sufficient proof for this readiness claim.',
    resolution:
      'Accept the evidence row, replace it with accepted evidence, or mark it as superseded in the active register. Then regenerate the readiness register and ZIP report so the readiness page can reflect the corrected state.',
  };
}

function getCheckResultBadgeClass(status: string): string {
  const normalized = status.toLowerCase();

  if (normalized === 'pass' || normalized === 'passed') {
    return 'bg-emerald-950/72 text-emerald-100';
  }

  if (normalized === 'warn' || normalized === 'warning') {
    return 'bg-amber-950/85 text-amber-100';
  }

  if (normalized === 'fail' || normalized === 'failed' || normalized === 'error') {
    return 'bg-red-900/80 text-red-50';
  }

  return 'bg-slate-700/85 text-slate-100';
}

function EvidenceWarningExplanation({
  explanation,
}: {
  explanation: NonNullable<ReturnType<typeof getEvidenceWarningExplanation>>;
}) {
  return (
    <div className="mt-3 grid gap-2 rounded-lg bg-amber-950/35 px-3 py-3 text-xs leading-5 text-amber-50">
      <div>
        <p className="font-semibold text-amber-100">Why this is warning-level</p>
        <p className="mt-1 text-amber-50/90">{explanation.why}</p>
      </div>
      {explanation.meaning ? (
        <div>
          <p className="font-semibold text-amber-100">What tamper corpus means</p>
          <p className="mt-1 text-amber-50/90">{explanation.meaning}</p>
        </div>
      ) : null}
      <div>
        <p className="font-semibold text-amber-100">Proposed resolution</p>
        <p className="mt-1 text-amber-50/90">{explanation.resolution}</p>
      </div>
    </div>
  );
}

function EvidenceTraceItem({ item }: { item: ReadinessProfileEvidenceItemView }) {
  const [expanded, setExpanded] = useState(false);
  const purpose = getEvidencePurpose(item);
  const visual = getEvidenceItemVisualState(item);
  const warningExplanation = getEvidenceWarningExplanation(item);
  const EvidenceStatusIcon = visual.icon;

  return (
    <article className="relative mx-1 overflow-hidden rounded-xl bg-hush-bg-dark px-4 py-4 shadow-md shadow-black/30">
      <div className={`absolute left-0 top-0 h-full w-1 ${visual.rail}`} aria-hidden="true" />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-md ${visual.iconShell}`}>
            <EvidenceStatusIcon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md px-2 py-1 text-xs font-semibold ${visual.statusBadge}`}>
                {formatStatus(item.status)}
              </span>
              <span className={`rounded-md px-2 py-1 text-xs font-semibold ${visual.freshnessBadge}`}>
                freshness {formatStatus(item.freshnessState)}
              </span>
            </div>
            <h4 className="mt-2 break-words text-sm font-semibold text-hush-text-primary">
              {purpose.title}
            </h4>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-hush-text-accent">
              {purpose.description}
            </p>
            <p className="mt-2 break-words text-xs font-semibold text-hush-text-primary">
              {item.evidenceId}
            </p>
            {visual.warningReason ? (
              <div className="mt-2 rounded-lg bg-amber-950/55 px-3 py-2.5">
                <p className="text-xs font-semibold leading-5 text-amber-100">
                  {visual.warningReason}
                </p>
                {warningExplanation ? (
                  <EvidenceWarningExplanation explanation={warningExplanation} />
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <time className="inline-flex items-center gap-2 rounded-md bg-hush-bg-element/80 px-2.5 py-1.5 text-xs font-semibold text-hush-text-primary">
            <CalendarClock className="h-3.5 w-3.5 text-sky-200" aria-hidden="true" />
            {formatDate(item.producedAt)}
          </time>
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${purpose.title}`}
            className="grid h-8 w-8 place-items-center rounded-md bg-hush-bg-element/80 text-hush-text-primary transition hover:bg-hush-bg-element focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {expanded ? (
        <>
      <dl className="mt-4 grid gap-2 md:grid-cols-4">
        <ProofChip label="Gates" value={item.acceptanceGateIds.join(', ') || 'none'} />
        <ProofChip label="Dimensions" value={item.dimensionIds.join(', ') || 'none'} />
        <ProofChip label="Release scope" value={item.releaseScope || 'not recorded'} />
        <ProofChip label="Visibility" value={item.visibility || 'not recorded'} />
      </dl>

      {item.artifactRefs.length > 0 ? (
        <section className="mt-4 rounded-lg bg-hush-bg-dark/55 px-3 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-hush-text-primary">
            <Archive className="h-4 w-4 text-cyan-200" aria-hidden="true" />
            Artifact proofs
          </div>
          <ul className="mt-2 grid gap-2">
            {item.artifactRefs.map((artifact) => (
              <li
                key={`${item.evidenceId}-${artifact.artifactId}`}
                className="rounded-md bg-hush-bg-element/80 px-3 py-2"
              >
                <div className="flex flex-col gap-1 lg:flex-row lg:items-start lg:justify-between">
                  <span className="text-xs font-semibold text-hush-text-primary">
                    {artifact.artifactId}
                  </span>
                  <span
                    className="text-xs font-semibold text-cyan-100"
                    title={artifact.sha256Hash}
                  >
                    {artifact.hashAlgorithm} {shortenMiddle(artifact.sha256Hash, 12, 10)}
                  </span>
                </div>
                <p className="mt-1 break-words text-xs leading-5 text-hush-text-accent">
                  {artifact.relativePath}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {item.checkResults.length > 0 ? (
        <section className="mt-4 rounded-lg bg-hush-bg-dark/55 px-3 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-hush-text-primary">
            <ClipboardCheck className="h-4 w-4 text-emerald-200" aria-hidden="true" />
            Check results
          </div>
          <ul className="mt-2 grid gap-2">
            {item.checkResults.map((result) => (
              <li
                key={`${item.evidenceId}-${result.checkId}`}
                className="rounded-md bg-hush-bg-element/80 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-hush-text-primary">
                    {result.checkId}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getCheckResultBadgeClass(
                      result.status
                    )}`}
                  >
                    {formatStatus(result.status)}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-hush-text-accent">
                  {sanitizeInternalReferenceText(result.summary)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
        </>
      ) : null}
    </article>
  );
}

function EvidenceTrace({ check }: { check: ReadinessProfileEvidenceCheckView }) {
  if (check.evidenceItems.length === 0) {
    const emptyIconClass =
      check.status === 'passed'
        ? 'text-emerald-200'
        : check.status === 'disabled' || check.status === 'not_applicable'
          ? 'text-slate-200'
          : 'text-amber-200';

    return (
      <div className="mt-2 flex items-start gap-2 rounded-lg bg-hush-bg-element/80 px-3 py-3 text-sm leading-6 text-hush-text-accent">
        <FileCheck2 className={`mt-0.5 h-4 w-4 shrink-0 ${emptyIconClass}`} aria-hidden="true" />
        <p>
          This check is satisfied from the profile fields and profile evidence references above; no
          separate register evidence row is bound to it.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 grid gap-4 px-1 py-1">
      {check.evidenceItems.map((item) => (
        <EvidenceTraceItem key={item.evidenceId} item={item} />
      ))}
    </div>
  );
}

function EvidenceCheckCard({ check }: { check: ReadinessProfileEvidenceCheckView }) {
  const [expanded, setExpanded] = useState(false);
  const category = getCategoryAccent(check.category);
  const CategoryIcon = category.icon;
  const visual = getCheckVisualState(check);
  const StatusIcon = visual.icon;
  const noteLabel = check.status === 'disabled' ? 'Disabled in this profile' : 'Development adjustment';

  return (
    <article className={`relative overflow-hidden rounded-xl p-4 shadow-sm shadow-black/14 ${visual.surface}`}>
      <div className={`absolute left-0 top-0 h-full w-1.5 ${visual.rail}`} aria-hidden="true" />
      <div className={`rounded-lg px-4 py-4 ${visual.header}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-hush-bg-dark/44 text-hush-text-primary">
              <StatusIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold ${category.chip}`}>
                  <CategoryIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  {category.label}
                </span>
                <span className="rounded-full bg-hush-bg-dark/52 px-2 py-1 text-[11px] font-semibold text-hush-text-accent">
                  {check.evidenceItems.length} evidence rows
                </span>
              </div>
              <h2 className="mt-2 text-base font-semibold text-hush-text-primary">{check.title}</h2>
              <p className="mt-1 text-xs text-hush-text-accent">{check.applicability}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${visual.badge}`}>
              {visual.label}
            </span>
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              aria-expanded={expanded}
              aria-label={`${expanded ? 'Collapse' : 'Expand'} ${check.title}`}
              className="grid h-8 w-8 place-items-center rounded-md bg-hush-bg-dark/70 text-hush-text-primary transition hover:bg-hush-bg-element focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple"
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {expanded ? (
        <>
          <dl className="mt-4 grid gap-3 xl:grid-cols-[1.1fr_0.75fr_1.1fr]">
            <InspectionTile
              label="What was tested"
              value={check.whatWasTested}
              icon={ListChecks}
              tone="cyan"
            />
            <InspectionTile
              label="When tested"
              value={formatDate(check.whenWasTested)}
              icon={CalendarClock}
              tone="blue"
            />
            <InspectionTile
              label="Check"
              value={check.check}
              icon={ClipboardCheck}
              tone={check.status === 'disabled' ? 'slate' : 'emerald'}
            />
          </dl>

          {check.developmentAdjustment ? (
            <div className="mt-4 rounded-lg bg-hush-bg-element/72 px-3 py-3">
              <p className="text-xs font-semibold uppercase text-hush-text-accent">{noteLabel}</p>
              <p className="mt-1 text-sm leading-6 text-hush-text-primary">
                {check.developmentAdjustment}
              </p>
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="rounded-lg bg-hush-bg-dark/55 px-3 py-3 shadow-sm shadow-black/10">
              <h3 className="flex items-center gap-2 text-xs font-semibold text-hush-text-primary">
                <ClipboardCheck className="h-4 w-4 text-emerald-200" aria-hidden="true" />
                Required evidence
              </h3>
              <div className="mt-2">
                <DetailList
                  values={check.requiredEvidence}
                  empty="No required evidence recorded."
                />
              </div>
            </section>
            <section className="rounded-lg bg-hush-bg-dark/55 px-3 py-3 shadow-sm shadow-black/10">
              <h3 className="flex items-center gap-2 text-xs font-semibold text-hush-text-primary">
                <Database className="h-4 w-4 text-sky-200" aria-hidden="true" />
                Profile evidence refs
              </h3>
              <div className="mt-2">
                <DetailList
                  values={check.evidenceRefs}
                  empty="No profile-specific refs recorded."
                  compact
                />
              </div>
            </section>
          </div>

          <div className="mt-4 rounded-lg bg-hush-bg-element/80 px-4 py-4 shadow-sm shadow-black/10">
            <h3 className="flex items-center gap-2 text-xs font-semibold text-hush-text-primary">
              <Database className="h-4 w-4 text-cyan-200" aria-hidden="true" />
              Readiness evidence trace
            </h3>
            <EvidenceTrace check={check} />
          </div>
        </>
      ) : null}
    </article>
  );
}

export function ReadinessProfileCheckPage({
  profileId,
  gate,
  initialResponse,
  credentialsPublicKey,
  fetchReadinessProfile = defaultFetchReadinessProfile,
}: {
  profileId: string;
  gate: ReadinessDashboardClientGate;
  initialResponse?: ReadinessProfileApiResponse;
  credentialsPublicKey?: string | null;
  fetchReadinessProfile?: (
    profileId: string,
    publicKey?: string | null
  ) => Promise<ReadinessProfileApiResponse>;
}) {
  const credentials = useAppStore((state) => state.credentials);
  const currentUser = useAppStore((state) => state.currentUser);
  const publicKey = useMemo(
    () => credentialsPublicKey ?? credentials?.signingPublicKey ?? currentUser?.publicKey ?? null,
    [credentials?.signingPublicKey, credentialsPublicKey, currentUser?.publicKey]
  );
  const [response, setResponse] = useState<ReadinessProfileApiResponse | null>(
    initialResponse ?? null
  );
  const [loading, setLoading] = useState(gate.enabled && !initialResponse);
  const [downloadState, setDownloadState] = useState<'idle' | 'downloading' | 'failed'>('idle');
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    let active = true;

    if (!gate.enabled || initialResponse) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    fetchReadinessProfile(profileId, publicKey)
      .then((nextResponse) => {
        if (active) {
          setResponse(nextResponse);
        }
      })
      .catch((error) => {
        if (active) {
          const message = error instanceof Error ? error.message : String(error);
          setResponse({
            success: false,
            state: 'load_error',
            code: 'readiness_profile_fetch_failed',
            message,
          });
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [fetchReadinessProfile, gate.enabled, initialResponse, profileId, publicKey]);

  const handleDownload = useCallback(async () => {
    if (!response?.success) {
      return;
    }

    setDownloadState('downloading');
    setDownloadError('');

    try {
      const downloadResponse = await fetch(buildApiUrl(response.detail.download.apiRoute), {
        headers: publicKey
          ? {
              [READINESS_DASHBOARD_PUBLIC_KEY_HEADER]: publicKey,
            }
          : undefined,
      });

      if (!downloadResponse.ok) {
        throw new Error(`Download failed with HTTP ${downloadResponse.status}.`);
      }

      const blob = await downloadResponse.blob();
      const fileName = getFileNameFromContentDisposition(
        downloadResponse.headers.get('content-disposition'),
        response.detail.download.fileName
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setDownloadState('idle');
    } catch (error) {
      setDownloadState('failed');
      setDownloadError(error instanceof Error ? error.message : String(error));
    }
  }, [publicKey, response]);

  if (!gate.enabled) {
    return (
      <section
        className="flex h-full items-center justify-center bg-hush-bg-dark px-4 text-hush-text-primary"
        data-testid="readiness-profile-state-disabled"
      >
        <div className="max-w-xl rounded-lg bg-hush-bg-element/95 p-5">
          <h1 className="text-lg font-semibold">Readiness profile unavailable</h1>
          <p className="mt-2 text-sm text-hush-text-accent">
            The internal readiness dashboard route is currently closed.
          </p>
        </div>
      </section>
    );
  }

  if (loading || !response) {
    return (
      <section className="flex h-full items-center justify-center bg-hush-bg-dark text-hush-text-primary">
        <Loader2 className="h-7 w-7 animate-spin text-hush-purple" aria-hidden="true" />
      </section>
    );
  }

  if (!response.success) {
    return (
      <section
        className="flex h-full items-center justify-center bg-hush-bg-dark px-4 text-hush-text-primary"
        data-testid={`readiness-profile-state-${response.state}`}
      >
        <div className="max-w-xl rounded-lg bg-hush-bg-element/95 p-5">
          <h1 className="text-lg font-semibold">Readiness profile unavailable</h1>
          <p className="mt-2 text-sm text-hush-text-accent">{response.message}</p>
          <Link
            href={READINESS_DASHBOARD_ROUTE}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-hush-bg-dark/70 px-3 py-2 text-sm font-semibold text-hush-text-primary hover:bg-hush-purple/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to readiness
          </Link>
        </div>
      </section>
    );
  }

  const { detail } = response;
  const assessmentBadgeClass = getAssessmentBadgeClass(detail.assessment);
  const proofSummary = detail.checks.reduce(
    (summary, check) => ({
      passed:
        summary.passed + (check.status === 'passed' || check.status === 'developer_adjusted' ? 1 : 0),
      warnings: summary.warnings + (check.status === 'with_warnings' ? 1 : 0),
      adjusted: summary.adjusted + (check.status === 'developer_adjusted' ? 1 : 0),
      disabled:
        summary.disabled + (check.status === 'disabled' || check.status === 'not_applicable' ? 1 : 0),
      evidenceRows: summary.evidenceRows + check.evidenceItems.length,
      artifacts:
        summary.artifacts +
        check.evidenceItems.reduce((count, item) => count + item.artifactRefs.length, 0),
    }),
    {
      passed: 0,
      warnings: 0,
      adjusted: 0,
      disabled: 0,
      evidenceRows: 0,
      artifacts: 0,
    }
  );

  return (
    <section className="h-full overflow-y-auto bg-hush-bg-dark px-4 py-5 text-hush-text-primary sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="rounded-xl bg-hush-bg-element/95 p-5 shadow-sm shadow-black/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Link
                href={READINESS_DASHBOARD_ROUTE}
                className="inline-flex items-center gap-2 text-sm font-semibold text-hush-text-accent hover:text-hush-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Readiness dashboard
              </Link>
              <div className="mt-4 flex items-start gap-3">
                <FileCheck2 className="mt-1 h-6 w-6 shrink-0 text-hush-purple" aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-hush-text-accent">
                    Profile evidence checks
                  </p>
                  <h1 className="mt-1 text-2xl font-semibold">{detail.profile.label}</h1>
                  <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
                    {detail.profile.claimWording}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap lg:justify-end">
              <span className="whitespace-nowrap rounded-full bg-hush-bg-dark/70 px-3 py-1 text-sm font-semibold text-hush-text-accent">
                {detail.register.registerVersionId}
              </span>
              <span
                className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-semibold ${assessmentBadgeClass}`}
                title={detail.assessment.summary}
              >
                {detail.assessment.severity} / {detail.assessment.label}
              </span>
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloadState === 'downloading'}
                className="inline-flex min-h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-md bg-hush-purple px-3 py-2 text-sm font-semibold text-white shadow-sm shadow-black/15 transition hover:bg-hush-purple/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple disabled:cursor-not-allowed disabled:opacity-70"
              >
                {downloadState === 'downloading' ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="h-4 w-4" aria-hidden="true" />
                )}
                Download ZIP
              </button>
            </div>
          </div>
          {downloadState === 'failed' ? (
            <p className="mt-3 text-sm text-amber-100" role="alert">
              {downloadError || 'Download failed.'}
            </p>
          ) : null}
        </header>

        <section className="rounded-xl bg-hush-bg-element/90 p-4 shadow-sm shadow-black/15">
          <dl className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetadataPill label="Product mode" value={detail.profile.productMode} />
            <MetadataPill label="Binding status" value={detail.profile.bindingStatus} />
            <MetadataPill
              label="Non-binding election"
              value={String(detail.profile.isNonBindingElection)}
            />
            <MetadataPill label="Threshold" value={detail.profile.thresholdProfile} />
            <MetadataPill label="Manifest hash" value={detail.register.manifestHash} compact />
            <MetadataPill
              label="Archive hash"
              value={detail.register.archiveSha256Hash || 'not recorded'}
              compact
            />
            <MetadataPill label="Generated" value={formatDate(detail.register.generatedAt)} />
            <MetadataPill label="Source commit" value={detail.register.sourceCommit} />
          </dl>
        </section>

        <section>
          <dl className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <SummaryStat
              label="Passed checks"
              value={`${proofSummary.passed} / ${detail.checks.length}`}
              icon={CheckCircle2}
              tone="green"
            />
            <SummaryStat
              label="Warning checks"
              value={String(proofSummary.warnings)}
              icon={CircleAlert}
              tone="amber"
            />
            <SummaryStat
              label="Developer adjusted"
              value={String(proofSummary.adjusted)}
              icon={CircleAlert}
              tone="amber"
            />
            <SummaryStat
              label="Disabled / N/A"
              value={String(proofSummary.disabled)}
              icon={Clock3}
              tone="gray"
            />
            <SummaryStat
              label="Evidence rows"
              value={String(proofSummary.evidenceRows)}
              icon={Database}
              tone="cyan"
            />
            <SummaryStat
              label="Artifact proofs"
              value={String(proofSummary.artifacts)}
              icon={Archive}
              tone="blue"
            />
          </dl>
        </section>

        <section className="grid gap-4" data-testid="readiness-profile-checks">
          {detail.checks.map((check) => (
            <EvidenceCheckCard key={check.checkId} check={check} />
          ))}
        </section>
      </div>
    </section>
  );
}
