import type { ReadinessChildFeatureView } from '@/lib/readinessDashboard';

function statusClass(status: string) {
  if (status === 'accepted' || status === '04_COMPLETED') {
    return 'bg-emerald-400/12 text-emerald-100';
  }

  if (status.includes('not_promoted') || status === 'observed' || status === '03_IN_PROGRESS') {
    return 'bg-amber-300/14 text-amber-100';
  }

  if (status === 'blocked' || status === 'rejected') {
    return 'bg-red-400/14 text-red-100';
  }

  return 'bg-sky-300/12 text-sky-100';
}

export function ReadinessChildFeatureTable({
  features,
}: {
  features: ReadinessChildFeatureView[];
}) {
  return (
    <section
      className="rounded-lg bg-hush-bg-light/55 p-4"
      aria-labelledby="readiness-child-features-heading"
    >
      <h2 id="readiness-child-features-heading" className="text-lg font-semibold">
        EPIC-015 Child Feature Readiness
      </h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-hush-text-accent">
            <tr>
              <th scope="col" className="px-3 py-2">Feature</th>
              <th scope="col" className="px-3 py-2">Implementation</th>
              <th scope="col" className="px-3 py-2">Readiness Evidence</th>
              <th scope="col" className="px-3 py-2">Gates</th>
              <th scope="col" className="px-3 py-2">Claim Impact</th>
              <th scope="col" className="px-3 py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {features.map((feature) => (
              <tr key={feature.featureId} className="odd:bg-hush-bg-dark/35">
                <td className="min-w-60 px-3 py-3">
                  <p className="font-semibold">{feature.featureId}</p>
                  <p className="mt-1 text-hush-text-accent">{feature.title}</p>
                </td>
                <td className="px-3 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(feature.implementationStatus)}`}>
                    {feature.implementationStatus}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(feature.readinessEvidenceStatus)}`}>
                    {feature.readinessEvidenceStatus}
                  </span>
                </td>
                <td className="min-w-44 px-3 py-3 text-hush-text-accent">
                  {feature.gates.join(', ')}
                </td>
                <td className="px-3 py-3">{feature.claimImpact}</td>
                <td className="min-w-72 px-3 py-3 text-hush-text-accent">{feature.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
