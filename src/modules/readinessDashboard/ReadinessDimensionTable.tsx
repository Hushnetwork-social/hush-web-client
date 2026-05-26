import type { ReadinessDimensionView } from '@/lib/readinessDashboard';

export function ReadinessDimensionTable({
  dimensions,
}: {
  dimensions: ReadinessDimensionView[];
}) {
  return (
    <section
      className="rounded-lg bg-hush-bg-light/55 p-4"
      data-testid="readiness-dimensions"
      aria-labelledby="readiness-dimensions-heading"
    >
      <h2 id="readiness-dimensions-heading" className="text-lg font-semibold">
        Score Dimensions
      </h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-hush-text-accent">
            <tr>
              <th scope="col" className="px-3 py-2">ID</th>
              <th scope="col" className="px-3 py-2">Dimension</th>
              <th scope="col" className="px-3 py-2">Score</th>
              <th scope="col" className="px-3 py-2">Target</th>
              <th scope="col" className="px-3 py-2">Gates</th>
              <th scope="col" className="px-3 py-2">Residual Risk</th>
            </tr>
          </thead>
          <tbody>
            {dimensions.map((dimension) => (
              <tr key={dimension.dimensionId} className="odd:bg-hush-bg-dark/35">
                <td className="whitespace-nowrap px-3 py-3 font-semibold">{dimension.dimensionId}</td>
                <td className="min-w-56 px-3 py-3">{dimension.name}</td>
                <td className="px-3 py-3 font-semibold">{dimension.currentScore}/10</td>
                <td className="px-3 py-3">{dimension.targetScore}/10</td>
                <td className="min-w-36 px-3 py-3 text-hush-text-accent">
                  {dimension.acceptanceGateIds.join(', ')}
                </td>
                <td className="min-w-72 px-3 py-3 text-hush-text-accent">
                  {dimension.residualRisk}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
