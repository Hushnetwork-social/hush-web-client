"use client";

import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { buildApiUrl } from '@/lib/api-config';
import {
  READINESS_DASHBOARD_API_ROUTE,
  READINESS_DASHBOARD_PUBLIC_KEY_HEADER,
  READINESS_DASHBOARD_ROUTE,
  getReadinessDashboardClientRouteGate,
  type ReadinessDashboardApiResponse,
  type ReadinessDashboardClientGate,
} from '@/lib/readinessDashboard';
import { useAppStore } from '@/stores/useAppStore';
import { ReadinessBlockerPanel } from './ReadinessBlockerPanel';
import { ReadinessChildFeatureTable } from './ReadinessChildFeatureTable';
import { ReadinessClaimGatePanel } from './ReadinessClaimGatePanel';
import { ReadinessDashboardState } from './ReadinessDashboardState';
import { ReadinessDashboardSummary } from './ReadinessDashboardSummary';
import { ReadinessDimensionTable } from './ReadinessDimensionTable';
import { ReadinessEvidenceLifecyclePanel } from './ReadinessEvidenceLifecyclePanel';
import { ReadinessPublicSafePreview } from './ReadinessPublicSafePreview';

async function defaultFetchReadinessDashboard(
  publicKey?: string | null
): Promise<ReadinessDashboardApiResponse> {
  const response = await fetch(buildApiUrl(READINESS_DASHBOARD_API_ROUTE), {
    headers: publicKey
      ? {
          [READINESS_DASHBOARD_PUBLIC_KEY_HEADER]: publicKey,
        }
      : undefined,
  });

  return (await response.json()) as ReadinessDashboardApiResponse;
}

export function ReadinessDashboardPage({
  gate,
  initialResponse,
  credentialsPublicKey,
  fetchReadinessDashboard = defaultFetchReadinessDashboard,
}: {
  gate?: ReadinessDashboardClientGate;
  initialResponse?: ReadinessDashboardApiResponse;
  credentialsPublicKey?: string | null;
  fetchReadinessDashboard?: (
    publicKey?: string | null
  ) => Promise<ReadinessDashboardApiResponse>;
}) {
  const routeGate = gate ?? getReadinessDashboardClientRouteGate();
  const credentials = useAppStore((state) => state.credentials);
  const currentUser = useAppStore((state) => state.currentUser);
  const publicKey = useMemo(
    () => credentialsPublicKey ?? credentials?.signingPublicKey ?? currentUser?.publicKey ?? null,
    [credentials?.signingPublicKey, credentialsPublicKey, currentUser?.publicKey]
  );
  const [response, setResponse] = useState<ReadinessDashboardApiResponse | null>(
    initialResponse ?? null
  );
  const [loading, setLoading] = useState(routeGate.enabled && !initialResponse);

  useEffect(() => {
    let active = true;

    if (!routeGate.enabled || initialResponse) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    fetchReadinessDashboard(publicKey)
      .then((nextResponse) => {
        if (active) {
          setResponse(nextResponse);
        }
      })
      .catch((error) => {
        if (active) {
          const message = error instanceof Error ? error.message : String(error);
          setResponse({
            success: false,
            state: 'load_error',
            code: 'readiness_dashboard_fetch_failed',
            message,
          });
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [fetchReadinessDashboard, initialResponse, publicKey, routeGate.enabled]);

  if (!routeGate.enabled) {
    return <ReadinessDashboardState gate={routeGate} />;
  }

  if (loading || !response) {
    return <ReadinessDashboardState gate={routeGate} loading />;
  }

  if (!response.success) {
    return <ReadinessDashboardState gate={routeGate} response={response} />;
  }

  const { dashboard } = response;

  return (
    <section className="h-full overflow-y-auto bg-hush-bg-dark px-4 py-5 text-hush-text-primary sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="rounded-xl bg-hush-bg-element/95 p-5 shadow-sm shadow-black/20">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-hush-text-accent">
                Internal HushVoting workspace
              </p>
              <h1 className="mt-1 text-2xl font-semibold">Internal Readiness Dashboard</h1>
              <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
                Promoted FEAT-130 projection. Read-only. Not for publication.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-hush-text-accent">
              <span className="rounded-full bg-hush-bg-dark/70 px-3 py-1 font-semibold">
                {dashboard.register.registerVersionId}
              </span>
              <span className="rounded-full bg-hush-bg-dark/70 px-3 py-1 font-semibold">
                {dashboard.register.status}
              </span>
              <span>{READINESS_DASHBOARD_ROUTE}</span>
            </div>
          </div>
        </header>

        {dashboard.register.warnings.length > 0 ? (
          <section
            className="rounded-xl bg-amber-300/14 p-4 text-amber-100 shadow-sm shadow-black/10"
            role="alert"
            data-testid="readiness-warning"
          >
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5" aria-hidden="true" />
              <div>
                <h2 className="font-semibold">Claim limits remain active</h2>
                <ul className="mt-2 grid gap-1 text-sm">
                  {dashboard.register.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ) : null}

        <ReadinessDashboardSummary dashboard={dashboard} />

        <section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <ReadinessClaimGatePanel
            claims={dashboard.claims}
            claimProfiles={dashboard.claimProfiles}
          />
          <ReadinessBlockerPanel blockers={dashboard.blockers} />
        </section>

        <ReadinessDimensionTable dimensions={dashboard.dimensions} />
        <ReadinessEvidenceLifecyclePanel dashboard={dashboard} />
        <ReadinessChildFeatureTable features={dashboard.childFeatures} />
        <ReadinessPublicSafePreview dashboard={dashboard} />
      </div>
    </section>
  );
}
