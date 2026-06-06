import { CheckCircle2, CircleAlert, Clock3, Landmark, XCircle } from 'lucide-react';
import type { CSSProperties } from 'react';
import type {
  ReadinessClaimGateView,
  ReadinessClaimProfileGateView,
} from '@/lib/readinessDashboard';

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

function formatClaimLevelLabel(value: string): string {
  switch (value) {
    case 'internal_development':
      return 'internal development boundary';
    case 'internal_non_binding_rehearsal':
      return 'internal audit rehearsal boundary';
    case 'friendly_organization_pilot':
      return 'friendly organization pilot boundary';
    case 'production_organizational_rollout':
      return 'production rollout boundary';
    case 'public_or_state_election':
      return 'public/state election boundary';
    default:
      return formatLabel(value);
  }
}

const profileOwnedClaimLevels = new Set([
  'internal_non_binding_rehearsal',
  'friendly_organization_pilot',
]);

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

function getProfileTone(profile: ReadinessClaimProfileGateView) {
  const displayState = getProfileDisplayState(profile);

  if (displayState.severity === 'green') {
    return {
      className: 'text-emerald-100',
      icon: CheckCircle2,
    };
  }

  if (displayState.severity === 'amber') {
    return {
      className: 'text-amber-100',
      icon: displayState.status === 'future_gated' ? Clock3 : CircleAlert,
    };
  }

  return {
    className: 'text-red-50',
    icon: XCircle,
  };
}

function getProfileDisplayState(profile: ReadinessClaimProfileGateView) {
  if (profile.gateStatus === 'with_warnings' || profile.verifierWarningCount > 0) {
    return {
      severity: 'amber' as const,
      status: 'with_warnings',
    };
  }

  return {
    severity: profile.severity,
    status: profile.gateStatus,
  };
}

function profileBadgeStyle(severity: ReadinessClaimProfileGateView['severity']): CSSProperties {
  if (severity === 'green') {
    return {
      backgroundColor: 'rgba(6, 78, 59, 0.72)',
      color: 'rgb(209, 250, 229)',
    };
  }

  if (severity === 'amber') {
    return {
      backgroundColor: 'rgba(69, 26, 3, 0.76)',
      color: 'rgb(254, 243, 199)',
    };
  }

  return {
    backgroundColor: 'rgba(127, 29, 29, 0.82)',
    color: 'rgb(254, 226, 226)',
  };
}

function getProfileWarningTooltip(profile: ReadinessClaimProfileGateView): string {
  if (profile.verifierWarnings.length === 0) {
    return `${profile.verifierWarningCount} verifier warning(s). See evidence refs for details.`;
  }

  return profile.verifierWarnings
    .map((warning) => `${warning.checkCode}: ${warning.resultCode} - ${warning.message}`)
    .join('\n');
}

export function ReadinessClaimGatePanel({
  claims,
  claimProfiles = [],
}: {
  claims: ReadinessClaimGateView[];
  claimProfiles?: ReadinessClaimProfileGateView[];
}) {
  const visibleClaims =
    claimProfiles.length > 0
      ? claims.filter((claim) => !profileOwnedClaimLevels.has(claim.claimLevel))
      : claims;

  return (
    <section
      className="rounded-xl bg-hush-bg-element/95 p-4 shadow-sm shadow-black/15"
      data-testid="readiness-claim-gates"
      aria-labelledby="readiness-claim-gates-heading"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="readiness-claim-gates-heading" className="text-lg font-semibold">
          Claim Boundaries
        </h2>
        <span className="rounded-full bg-hush-bg-dark/70 px-3 py-1 text-xs font-semibold text-hush-text-accent">
          Score cannot bypass blockers
        </span>
      </div>
      <p className="mt-1 text-sm text-hush-text-accent">
        Broad readiness claim levels. Product-mode profile gates are listed separately.
      </p>
      <div className="mt-4 grid gap-2">
        {visibleClaims.map((claim) => {
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
                    <h3 className="font-semibold">{formatClaimLevelLabel(claim.claimLevel)}</h3>
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
      {claimProfiles.length > 0 ? (
        <div className="mt-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <h3 className="text-sm font-semibold text-hush-text-primary">
              HushVoting profile gates
            </h3>
            <span className="text-xs text-hush-text-accent">
              Product mode, binding status, and threshold profile gates
            </span>
          </div>
          <div className="mt-2 grid gap-2">
            {claimProfiles.map((profile) => {
              const tone = getProfileTone(profile);
              const Icon = tone.icon;
              const displayState = getProfileDisplayState(profile);
              const hasVerifierWarnings = profile.verifierWarningCount > 0;
              const warningsId = `readiness-profile-warnings-${profile.profileId.replace(
                /[^a-zA-Z0-9_-]/g,
                '-'
              )}`;
              const warningTooltip = hasVerifierWarnings
                ? getProfileWarningTooltip(profile)
                : undefined;

              return (
                <article
                  key={profile.profileId}
                  className={`rounded-lg bg-hush-bg-dark/45 px-3 py-3 ${tone.className}`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-2">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <div>
                        <h4 className="font-semibold">{profile.label}</h4>
                        <p className="mt-1 text-sm opacity-90">{profile.claimWording}</p>
                        {profile.limitationWording ? (
                          <p className="mt-1 text-xs text-hush-text-accent">
                            {profile.limitationWording}
                          </p>
                        ) : null}
                        <p className="mt-2 text-xs text-hush-text-accent">
                          {`${profile.productMode} / ${profile.bindingStatus} / isNonBindingElection: ${String(
                            profile.isNonBindingElection
                          )} / ${profile.thresholdProfile}`}
                        </p>
                      </div>
                    </div>
                    {hasVerifierWarnings ? (
                      <span className="group relative shrink-0 self-start">
                        <span
                          className="inline-flex rounded-full px-2 py-1 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
                          style={profileBadgeStyle(displayState.severity)}
                          tabIndex={0}
                          title={warningTooltip}
                          aria-describedby={warningsId}
                        >
                          {displayState.severity} / {displayState.status}
                        </span>
                        <span
                          id={warningsId}
                          role="tooltip"
                          className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-[min(22rem,calc(100vw-3rem))] rounded-lg bg-hush-bg-dark/95 p-3 text-left text-xs text-amber-50 opacity-0 shadow-xl shadow-black/30 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                        >
                          <span className="block font-semibold">
                            {profile.verifierWarningCount} verifier warnings
                          </span>
                          <span className="mt-2 grid gap-2">
                            {profile.verifierWarnings.map((warning) => (
                              <span
                                key={`${warning.checkCode}-${warning.resultCode}`}
                                className="block break-words"
                              >
                                <span className="font-semibold">{warning.checkCode}</span>
                                {`: ${warning.resultCode}`}
                                <span className="block text-amber-100/85">{warning.message}</span>
                              </span>
                            ))}
                          </span>
                        </span>
                      </span>
                    ) : (
                      <span
                        className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold"
                        style={profileBadgeStyle(displayState.severity)}
                      >
                        {displayState.severity} / {displayState.status}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
