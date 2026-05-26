import type { CSSProperties } from 'react';
import type { ReadinessBlockerView } from '@/lib/readinessDashboard';

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

function blockerClass(severity: ReadinessBlockerView['severity']) {
  if (severity === 'red') {
    return 'text-red-50';
  }

  if (severity === 'amber') {
    return 'text-amber-100';
  }

  return 'text-emerald-100';
}

function blockerStyle(severity: ReadinessBlockerView['severity']): CSSProperties {
  if (severity === 'red') {
    return {
      backgroundColor: 'rgba(127, 29, 29, 0.92)',
      boxShadow: 'inset 4px 0 0 rgba(248, 113, 113, 1)',
    };
  }

  if (severity === 'amber') {
    return {
      backgroundColor: 'rgba(252, 211, 77, 0.14)',
      boxShadow: 'inset 3px 0 0 rgba(252, 211, 77, 0.54)',
    };
  }

  return {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    boxShadow: 'inset 3px 0 0 rgba(52, 211, 153, 0.44)',
  };
}

function blockerBadgeClass(severity: ReadinessBlockerView['severity']) {
  if (severity === 'red') {
    return 'text-white';
  }

  if (severity === 'amber') {
    return 'bg-amber-950/55 text-amber-100';
  }

  return 'bg-emerald-950/55 text-emerald-100';
}

function blockerBadgeStyle(severity: ReadinessBlockerView['severity']): CSSProperties | undefined {
  if (severity !== 'red') {
    return undefined;
  }

  return {
    backgroundColor: 'rgb(185, 28, 28)',
  };
}

export function ReadinessBlockerPanel({ blockers }: { blockers: ReadinessBlockerView[] }) {
  return (
    <section
      className="rounded-xl bg-hush-bg-element/95 p-4 shadow-sm shadow-black/15"
      data-testid="readiness-blockers"
      aria-labelledby="readiness-blockers-heading"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="readiness-blockers-heading" className="text-lg font-semibold">
          Active Blockers
        </h2>
        <span className="rounded-full bg-hush-bg-dark/70 px-3 py-1 text-xs font-semibold text-hush-text-accent">
          {blockers.filter((blocker) => blocker.status !== 'resolved').length} open
        </span>
      </div>
      <div className="mt-4 grid gap-2">
        {blockers.map((blocker) => (
          <article
            key={blocker.blockerId}
            className={`rounded-lg px-3 py-3 ${blockerClass(blocker.severity)}`}
            style={blockerStyle(blocker.severity)}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="break-words text-sm font-semibold">{blocker.blockerId}</h3>
                <p className="mt-1 text-sm opacity-90">{blocker.description}</p>
                <p className="mt-2 text-xs opacity-80">
                  {blocker.featureId} / {formatLabel(blocker.claimLevel)} /{' '}
                  {blocker.acceptanceGateIds.join(', ')}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${blockerBadgeClass(blocker.severity)}`}
                style={blockerBadgeStyle(blocker.severity)}
              >
                {blocker.severity} / {blocker.status}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
