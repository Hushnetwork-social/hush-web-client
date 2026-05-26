import type { ReadinessDashboardViewModel } from '@/lib/readinessDashboard';

export function ReadinessPublicSafePreview({
  dashboard,
}: {
  dashboard: ReadinessDashboardViewModel;
}) {
  return (
    <section
      className="rounded-lg bg-hush-bg-light/55 p-4"
      aria-labelledby="readiness-public-preview-heading"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="readiness-public-preview-heading" className="text-lg font-semibold">
            Public-Safe Preview
          </h2>
          <p className="mt-1 text-sm text-hush-text-accent">
            Generated wording preview only. FEAT-130 artifacts remain the source of truth.
          </p>
        </div>
        <span className="rounded-full bg-hush-bg-dark/60 px-3 py-1 text-xs font-semibold text-hush-text-accent">
          {dashboard.publicSafePreview.publicationStatus} / {dashboard.publicSafePreview.redactionStatus}
        </span>
      </div>
      {dashboard.publicSafePreview.redactionWarnings.length > 0 ? (
        <div className="mt-4 rounded-md bg-red-400/14 px-3 py-3 text-sm text-red-100" role="alert">
          {dashboard.publicSafePreview.redactionWarnings.join(' ')}
        </div>
      ) : null}
      <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-hush-bg-dark/65 p-4 text-sm leading-6 text-hush-text-primary">
        {dashboard.publicSafePreview.generatedMarkdown}
      </pre>
    </section>
  );
}
