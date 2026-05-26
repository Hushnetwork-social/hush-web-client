import type { ReadinessBlockerView } from '@/lib/readinessDashboard';

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

function blockerClass(severity: ReadinessBlockerView['severity']) {
  if (severity === 'red') {
    return 'bg-red-400/14 text-red-100';
  }

  if (severity === 'amber') {
    return 'bg-amber-300/14 text-amber-100';
  }

  return 'bg-emerald-400/12 text-emerald-100';
}

export function ReadinessBlockerPanel({ blockers }: { blockers: ReadinessBlockerView[] }) {
  return (
    <section
      className="rounded-lg bg-hush-bg-light/55 p-4"
      data-testid="readiness-blockers"
      aria-labelledby="readiness-blockers-heading"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="readiness-blockers-heading" className="text-lg font-semibold">
          Active Blockers
        </h2>
        <span className="rounded-full bg-hush-bg-dark/60 px-3 py-1 text-xs font-semibold text-hush-text-accent">
          {blockers.filter((blocker) => blocker.status !== 'resolved').length} open
        </span>
      </div>
      <div className="mt-4 grid gap-2">
        {blockers.map((blocker) => (
          <article
            key={blocker.blockerId}
            className={`rounded-md px-3 py-3 ${blockerClass(blocker.severity)}`}
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
              <span className="shrink-0 rounded-full bg-hush-bg-dark/45 px-2 py-1 text-xs font-semibold">
                {blocker.severity} / {blocker.status}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
