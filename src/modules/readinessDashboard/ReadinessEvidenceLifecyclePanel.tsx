import type {
  ReadinessDashboardViewModel,
  ReadinessEvidenceStatus,
} from '@/lib/readinessDashboard';

const lifecycleOrder: ReadinessEvidenceStatus[] = [
  'missing',
  'placeholder',
  'draft',
  'observed',
  'accepted',
  'blocked',
  'rejected',
  'superseded',
];

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

export function ReadinessEvidenceLifecyclePanel({
  dashboard,
}: {
  dashboard: ReadinessDashboardViewModel;
}) {
  return (
    <section className="grid gap-3 lg:grid-cols-3" aria-label="Evidence lifecycle status">
      <div className="rounded-xl bg-hush-bg-element/95 p-4 shadow-sm shadow-black/15">
        <h2 className="text-lg font-semibold">Evidence Lifecycle</h2>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {lifecycleOrder.map((status) => (
            <div key={status} className="rounded-lg bg-hush-bg-dark/60 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-hush-text-accent">
                {formatLabel(status)}
              </p>
              <p className="mt-1 text-xl font-semibold">
                {dashboard.evidenceLifecycleCounts[status]}
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl bg-hush-bg-element/95 p-4 shadow-sm shadow-black/15">
        <h2 className="text-lg font-semibold">Stale / Superseded</h2>
        {dashboard.staleEvidence.length === 0 ? (
          <p className="mt-4 rounded-lg bg-hush-bg-dark/60 px-3 py-3 text-sm text-hush-text-accent">
            No stale or superseded evidence in the promoted register.
          </p>
        ) : (
          <div className="mt-4 grid gap-2">
            {dashboard.staleEvidence.map((evidence) => (
              <div key={evidence.evidenceId} className="rounded-lg bg-amber-300/14 px-3 py-3 text-sm text-amber-100">
                <p className="font-semibold">{evidence.evidenceId}</p>
                <p className="mt-1">{evidence.staleReason || evidence.invalidationRule}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="rounded-xl bg-hush-bg-element/95 p-4 shadow-sm shadow-black/15">
        <h2 className="text-lg font-semibold">Exceptions</h2>
        {dashboard.exceptions.length === 0 ? (
          <p className="mt-4 rounded-lg bg-hush-bg-dark/60 px-3 py-3 text-sm text-hush-text-accent">
            No exceptions are present in the promoted register.
          </p>
        ) : (
          <div className="mt-4 grid gap-2">
            {dashboard.exceptions.map((exception) => (
              <div key={exception.exceptionId} className="rounded-lg bg-amber-300/14 px-3 py-3 text-sm text-amber-100">
                <p className="font-semibold">{exception.exceptionId}</p>
                <p className="mt-1">{exception.reason}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
