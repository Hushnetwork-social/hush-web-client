import { Activity, Gauge, ShieldCheck, Target } from 'lucide-react';
import type { ReadinessDashboardViewModel } from '@/lib/readinessDashboard';

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

function MetricTile({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  detail: string;
  tone?: 'neutral' | 'amber' | 'red' | 'green';
}) {
  const toneClass =
    tone === 'green'
      ? 'bg-emerald-400/14 text-emerald-100'
      : tone === 'amber'
        ? 'bg-amber-300/16 text-amber-100'
        : tone === 'red'
          ? 'bg-red-400/14 text-red-100'
          : 'bg-sky-300/14 text-sky-100';

  return (
    <section className="rounded-xl bg-hush-bg-element/95 p-4 shadow-sm shadow-black/15">
      <p className="text-xs font-semibold uppercase tracking-wide text-hush-text-accent">
        {label}
      </p>
      <div className={`mt-3 rounded-lg px-3 py-3 ${toneClass}`}>
        <p className="break-words text-xl font-semibold">{value}</p>
      </div>
      <p className="mt-2 text-sm text-hush-text-accent">{detail}</p>
    </section>
  );
}

export function ReadinessDashboardSummary({
  dashboard,
}: {
  dashboard: ReadinessDashboardViewModel;
}) {
  const currentClaim = [...dashboard.claims]
    .reverse()
    .find((claim) => claim.status !== 'blocked' && claim.severity !== 'red');
  const dataTone =
    dashboard.register.dataHealth === 'current'
      ? 'green'
      : dashboard.register.dataHealth === 'stale'
        ? 'amber'
        : 'red';

  return (
    <div className="grid gap-3 lg:grid-cols-4" data-testid="readiness-summary">
      <MetricTile
        label="Score"
        value={`${dashboard.score.total} / 100`}
        detail={`Target: ${dashboard.score.strongerTargetScore}+ (${formatLabel(dashboard.score.thresholdBand)})`}
        tone={dashboard.score.thresholdBand === 'below_minimum' ? 'amber' : 'green'}
      />
      <MetricTile
        label="Current Claim"
        value={formatLabel(currentClaim?.claimLevel ?? 'none')}
        detail={currentClaim?.limitationWording || currentClaim?.allowedWording || 'No claim allowed'}
        tone={currentClaim?.severity ?? 'red'}
      />
      <MetricTile
        label="V1 Ceiling"
        value={formatLabel(
          dashboard.catalog.entries.find((entry) => entry.current)
            ?.strongestAllowedV1PolicyCeiling ?? 'unknown'
        )}
        detail="Policy ceiling from the promoted catalog pointer"
        tone="amber"
      />
      <MetricTile
        label="Data Health"
        value={formatLabel(dashboard.register.dataHealth)}
        detail={`${dashboard.register.status} at ${dashboard.register.registerVersionId}`}
        tone={dataTone}
      />
      <div className="sr-only" aria-hidden="true">
        <Gauge />
        <ShieldCheck />
        <Target />
        <Activity />
      </div>
    </div>
  );
}
