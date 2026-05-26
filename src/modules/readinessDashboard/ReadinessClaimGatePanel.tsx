import { CheckCircle2, CircleAlert, XCircle } from 'lucide-react';
import type { ReadinessClaimGateView } from '@/lib/readinessDashboard';

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

function getTone(severity: ReadinessClaimGateView['severity']) {
  if (severity === 'green') {
    return {
      className: 'bg-emerald-400/12 text-emerald-100',
      icon: CheckCircle2,
    };
  }

  if (severity === 'amber') {
    return {
      className: 'bg-amber-300/14 text-amber-100',
      icon: CircleAlert,
    };
  }

  return {
    className: 'bg-red-400/14 text-red-100',
    icon: XCircle,
  };
}

export function ReadinessClaimGatePanel({ claims }: { claims: ReadinessClaimGateView[] }) {
  return (
    <section
      className="rounded-lg bg-hush-bg-light/55 p-4"
      data-testid="readiness-claim-gates"
      aria-labelledby="readiness-claim-gates-heading"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="readiness-claim-gates-heading" className="text-lg font-semibold">
          Claim Gates
        </h2>
        <span className="rounded-full bg-hush-bg-dark/60 px-3 py-1 text-xs font-semibold text-hush-text-accent">
          Score cannot bypass blockers
        </span>
      </div>
      <div className="mt-4 grid gap-2">
        {claims.map((claim) => {
          const tone = getTone(claim.severity);
          const Icon = tone.icon;
          const wording =
            claim.blockedWording || claim.limitationWording || claim.allowedWording || claim.status;

          return (
            <article key={claim.claimLevel} className={`rounded-md px-3 py-3 ${tone.className}`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-2">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <div>
                    <h3 className="font-semibold">{formatLabel(claim.claimLevel)}</h3>
                    <p className="mt-1 text-sm opacity-90">{wording}</p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-hush-bg-dark/45 px-2 py-1 text-xs font-semibold">
                  {claim.severity} / {claim.status}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
