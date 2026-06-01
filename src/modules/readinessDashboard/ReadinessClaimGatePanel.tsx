import { CheckCircle2, CircleAlert, Clock3, Landmark, XCircle } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { ReadinessClaimGateView } from '@/lib/readinessDashboard';

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

function getTone(claim: ReadinessClaimGateView) {
  if (claim.status === 'future_gated') {
    return {
      className: 'text-sky-100',
      icon: Clock3,
    };
  }

  if (claim.status === 'external_boundary') {
    return {
      className: 'text-slate-100',
      icon: Landmark,
    };
  }

  if (claim.severity === 'green') {
    return {
      className: 'text-emerald-100',
      icon: CheckCircle2,
    };
  }

  if (claim.severity === 'amber') {
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

function claimStyle(claim: ReadinessClaimGateView): CSSProperties {
  if (claim.status === 'future_gated') {
    return {
      backgroundColor: 'rgba(14, 116, 144, 0.22)',
    };
  }

  if (claim.status === 'external_boundary') {
    return {
      backgroundColor: 'rgba(100, 116, 139, 0.24)',
    };
  }

  if (claim.severity === 'red') {
    return {
      backgroundColor: 'rgba(127, 29, 29, 0.92)',
      boxShadow: 'inset 4px 0 0 rgba(248, 113, 113, 1)',
    };
  }

  if (claim.severity === 'amber') {
    return {
      backgroundColor: 'rgba(252, 211, 77, 0.14)',
    };
  }

  return {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
  };
}

function claimBadgeStyle(claim: ReadinessClaimGateView): CSSProperties | undefined {
  if (claim.status === 'future_gated') {
    return {
      backgroundColor: 'rgba(8, 47, 73, 0.72)',
    };
  }

  if (claim.status === 'external_boundary') {
    return {
      backgroundColor: 'rgba(15, 23, 42, 0.72)',
    };
  }

  if (claim.severity !== 'red') {
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
          const tone = getTone(claim);
          const Icon = tone.icon;
          const wording =
            claim.blockedWording || claim.limitationWording || claim.allowedWording || claim.status;

          return (
            <article
              key={claim.claimLevel}
              className={`rounded-lg px-3 py-3 ${tone.className}`}
              style={claimStyle(claim)}
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
                    claim.severity === 'red' ||
                    claim.status === 'future_gated' ||
                    claim.status === 'external_boundary'
                      ? 'text-white'
                      : 'bg-hush-bg-dark/55'
                  }`}
                  style={claimBadgeStyle(claim)}
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
