import { AlertTriangle, ShieldAlert, ShieldCheck } from 'lucide-react';
import type {
  ReadinessDashboardApiResponse,
  ReadinessDashboardApiState,
  ReadinessDashboardClientGate,
} from '@/lib/readinessDashboard';

const stateCopy: Record<ReadinessDashboardApiState, { title: string; body: string }> = {
  disabled: {
    title: 'Readiness dashboard disabled',
    body: 'The internal dashboard is disabled by configuration and no private readiness data was loaded.',
  },
  production_blocked: {
    title: 'Production access blocked',
    body: 'Production/customer deployments require an explicit internal override before the dashboard can load.',
  },
  unauthorized: {
    title: 'Internal collaborator access required',
    body: 'The API requires an allowlisted collaborator public key before reading private readiness files.',
  },
  missing_catalog: {
    title: 'Readiness catalog unavailable',
    body: 'The promoted FEAT-130 catalog could not be loaded, so this screen cannot show readiness approval.',
  },
  missing_register: {
    title: 'Current register unavailable',
    body: 'The catalog current pointer could not be resolved to a promoted readiness register.',
  },
  invalid_register: {
    title: 'Readiness register invalid',
    body: 'The catalog, register, or manifest did not validate. Treat readiness status as unknown.',
  },
  superseded_or_blocked_register: {
    title: 'Register is not current approval evidence',
    body: 'The loaded register is superseded or blocked. Review the warning before using this view.',
  },
  load_error: {
    title: 'Readiness data load failed',
    body: 'The dashboard could not load a redacted readiness view model.',
  },
  ready: {
    title: 'Readiness dashboard ready',
    body: 'The promoted FEAT-130 register projection loaded successfully.',
  },
};

export function ReadinessDashboardState({
  gate,
  response,
  loading = false,
}: {
  gate?: ReadinessDashboardClientGate;
  response?: ReadinessDashboardApiResponse | null;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <section className="h-full overflow-y-auto bg-hush-bg-dark px-4 py-6 text-hush-text-primary sm:px-6">
        <section className="mx-auto grid max-w-7xl gap-4" data-testid="readiness-loading">
          <div className="h-28 rounded-xl bg-hush-bg-element/80" />
          <div className="grid gap-3 md:grid-cols-4">
            <div className="h-28 rounded-xl bg-hush-bg-element/65" />
            <div className="h-28 rounded-xl bg-hush-bg-element/65" />
            <div className="h-28 rounded-xl bg-hush-bg-element/65" />
            <div className="h-28 rounded-xl bg-hush-bg-element/65" />
          </div>
          <div className="h-80 rounded-xl bg-hush-bg-element/55" />
        </section>
      </section>
    );
  }

  const state = response?.state ?? (gate?.reason === 'production_blocked' ? 'production_blocked' : 'disabled');
  const copy = stateCopy[state];
  const Icon = state === 'unauthorized' ? ShieldAlert : state === 'ready' ? ShieldCheck : AlertTriangle;

  return (
    <section className="h-full overflow-y-auto bg-hush-bg-dark px-4 py-6 text-hush-text-primary sm:px-6">
      <section
        className="mx-auto max-w-5xl rounded-xl bg-hush-bg-element/95 p-5 shadow-sm shadow-black/15"
        data-testid={`readiness-state-${state}`}
        role={state === 'ready' ? undefined : 'alert'}
      >
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 h-5 w-5 text-amber-200" aria-hidden="true" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-hush-text-accent">
              Internal HushVoting readiness
            </p>
            <h1 className="mt-1 text-xl font-semibold">{copy.title}</h1>
            <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">{copy.body}</p>
            {!response?.success && response?.message ? (
              <p className="mt-3 rounded-md bg-hush-bg-dark/70 px-3 py-2 text-sm text-amber-100">
                {response.code}: {response.message}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </section>
  );
}
