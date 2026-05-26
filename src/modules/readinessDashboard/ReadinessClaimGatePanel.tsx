import { CheckCircle2, CircleAlert, XCircle } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { ReadinessClaimGateView } from '@/lib/readinessDashboard';

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

function getTone(severity: ReadinessClaimGateView['severity']) {
  if (severity === 'green') {
    return {
      className: 'text-emerald-100',
      icon: CheckCircle2,
    };
  }

  if (severity === 'amber') {
    return {
      className: 'text-amber-100',
      icon: CircleAlert,
    };
  }

  return {
    className: 'text-red-50',
    icon: XCircle,
  };
}

function claimStyle(severity: ReadinessClaimGateView['severity']): CSSProperties {
  if (severity === 'red') {
    return {
      backgroundColor: 'rgba(127, 29, 29, 0.92)',
      boxShadow: 'inset 4px 0 0 rgba(248, 113, 113, 1)',
    };
  }

  if (severity === 'amber') {
    return {
      backgroundColor: 'rgba(252, 211, 77, 0.14)',
    };
  }

  return {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
  };
}

function claimBadgeStyle(severity: ReadinessClaimGateView['severity']): CSSProperties | undefined {
  if (severity !== 'red') {
    return undefined;
  }

  return {
    backgroundColor: 'rgb(185, 28, 28)',
  };
}

export function ReadinessClaimGatePanel({ claims }: { claims: ReadinessClaimGateView[] }) {
  return (
    <section
      className="rounded-xl bg-hush-bg-element/95 p-4 shadow-sm shadow-black/15"
      data-testid="readiness-claim-gates"
      aria-labelledby="readiness-claim-gates-heading"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="readiness-claim-gates-heading" className="text-lg font-semibold">
          Claim Gates
        </h2>
        <span className="rounded-full bg-hush-bg-dark/70 px-3 py-1 text-xs font-semibold text-hush-text-accent">
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
            <article
              key={claim.claimLevel}
              className={`rounded-lg px-3 py-3 ${tone.className}`}
              style={claimStyle(claim.severity)}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-2">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <div>
                    <h3 className="font-semibold">{formatLabel(claim.claimLevel)}</h3>
                    <p className="mt-1 text-sm opacity-90">{wording}</p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${
                    claim.severity === 'red'
                      ? 'text-white'
                      : 'bg-hush-bg-dark/55'
                  }`}
                  style={claimBadgeStyle(claim.severity)}
                >
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
