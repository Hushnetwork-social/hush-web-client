"use client";

import { AlertTriangle, CheckCircle2, Play, ShieldCheck, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  MOBILE_BENCHMARK_REPORT_BUNDLE_FILES,
  MOBILE_BENCHMARK_ROUTE,
  MOBILE_BENCHMARK_RUNNER_SCENARIOS,
  createDefaultMobileBenchmarkRunnerSetup,
  getMobileBenchmarkPathAvailability,
  getMobileBenchmarkRouteGate,
  isMobileBenchmarkRunnerSetupComplete,
  readMobileBenchmarkNativeProbe,
  runMobileBenchmarkScenarios,
  type MobileBenchmarkEnvironmentInput,
  type MobileBenchmarkFailureResultCode,
  type MobileBenchmarkImplementationPathId,
  type MobileBenchmarkNativeProbeResult,
  type MobileBenchmarkRouteGate,
  type MobileBenchmarkRunnerScenarioId,
  type MobileBenchmarkRunResult,
  type MobileBenchmarkRunnerSetup,
} from '@/lib/crypto/mobileBenchmark';

interface MobileBenchmarkRunnerProps {
  gate?: MobileBenchmarkRouteGate;
  environment?: MobileBenchmarkEnvironmentInput;
  interruptionScenarioId?: MobileBenchmarkRunnerScenarioId;
  failureScenarioId?: MobileBenchmarkRunnerScenarioId;
  failureResultCode?: MobileBenchmarkFailureResultCode;
  nativeProbeReader?: () => Promise<MobileBenchmarkNativeProbeResult>;
}

const declarationLabels: Array<{
  key: keyof MobileBenchmarkRunnerSetup['declarations'];
  label: string;
}> = [
  {
    key: 'controlledFixturePackSelected',
    label: 'Controlled synthetic fixture pack selected',
  },
  {
    key: 'deviceKeptForegrounded',
    label: 'Device will stay foregrounded for the run',
  },
  {
    key: 'lowPowerModeDisabled',
    label: 'Low-power or battery-saver mode disabled',
  },
  {
    key: 'unrelatedAppsClosed',
    label: 'Unrelated apps closed before sampling',
  },
  {
    key: 'noRealElectionData',
    label: 'No real election data will be loaded',
  },
];

const pathLabels: Record<MobileBenchmarkImplementationPathId, string> = {
  browser_fallback_wasm: 'Browser fallback WASM',
  tauri_webview_wasm: 'Tauri WebView WASM',
  tauri_native_crypto: 'Tauri native crypto',
  fully_native_ios: 'Fully native iOS',
  fully_native_android: 'Fully native Android',
};

const fieldClassName =
  'w-full rounded-md bg-hush-bg-dark px-3 py-2 text-sm text-hush-text-primary outline-none ring-1 ring-hush-bg-light/40 transition focus:ring-hush-purple';

const panelClassName = 'rounded-lg bg-hush-bg-light/55 p-4 shadow-sm';

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'measured' || status === 'passed'
      ? 'bg-emerald-400/15 text-emerald-100'
      : status === 'not_available' || status === 'unsupported_path'
        ? 'bg-amber-300/15 text-amber-100'
        : status === 'failed'
          ? 'bg-red-400/15 text-red-100'
          : 'bg-sky-300/15 text-sky-100';

  return (
    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${tone}`}>
      {status}
    </span>
  );
}

function countCompletedScenarios(result: MobileBenchmarkRunResult | null): number {
  return (
    result?.report.scenarios.filter((scenario) => scenario.status !== 'not_run').length ?? 0
  );
}

export function MobileBenchmarkRunner({
  gate,
  environment,
  interruptionScenarioId,
  failureScenarioId,
  failureResultCode = 'operation_timeout',
  nativeProbeReader = readMobileBenchmarkNativeProbe,
}: MobileBenchmarkRunnerProps) {
  const routeGate = gate ?? getMobileBenchmarkRouteGate();
  const [setup, setSetup] = useState<MobileBenchmarkRunnerSetup>(() =>
    createDefaultMobileBenchmarkRunnerSetup()
  );
  const [runState, setRunState] = useState<'idle' | 'running' | 'complete'>('idle');
  const [runResult, setRunResult] = useState<MobileBenchmarkRunResult | null>(null);
  const [exportReviewed, setExportReviewed] = useState(false);
  const [nativeProbeStatus, setNativeProbeStatus] = useState<
    'not_run' | 'measured' | 'unavailable'
  >('not_run');
  const pathAvailability = useMemo(
    () => getMobileBenchmarkPathAvailability(environment),
    [environment]
  );
  const selectedPath = pathAvailability.find(
    (item) => item.pathId === setup.implementationPath
  );
  const setupComplete = isMobileBenchmarkRunnerSetupComplete(setup, pathAvailability);
  const completedScenarios = countCompletedScenarios(runResult);
  const interrupted = runResult?.report.scenarios.some((scenario) =>
    scenario.operations.some((operation) => operation.resultCode === 'app_interrupted')
  );
  const failedOperations =
    runResult?.report.scenarios.flatMap((scenario) =>
      scenario.operations.filter(
        (operation) => operation.status === 'failed' && operation.resultCode !== 'app_interrupted'
      )
    ) ?? [];

  if (!routeGate.enabled) {
    return (
      <main className="min-h-screen bg-hush-bg-dark px-4 py-6 text-hush-text-primary sm:px-6">
        <section
          className="mx-auto max-w-6xl rounded-lg bg-hush-bg-light/55 p-5"
          data-testid="mobile-benchmark-disabled"
        >
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 text-amber-200" aria-hidden="true" />
            <div>
              <h1 className="text-lg font-semibold">Mobile benchmark unavailable</h1>
              <p className="mt-2 text-sm text-hush-text-accent">
                The internal route {MOBILE_BENCHMARK_ROUTE} is gated by{' '}
                {routeGate.envFlag}. Reason: {routeGate.reason}.
              </p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const toggleScenario = (scenarioId: MobileBenchmarkRunnerScenarioId) => {
    setSetup((current) => {
      const selected = current.selectedScenarioIds.includes(scenarioId)
        ? current.selectedScenarioIds.filter((id) => id !== scenarioId)
        : [...current.selectedScenarioIds, scenarioId];

      return {
        ...current,
        selectedScenarioIds: selected,
      };
    });
  };

  const toggleDeclaration = (key: keyof MobileBenchmarkRunnerSetup['declarations']) => {
    setSetup((current) => ({
      ...current,
      declarations: {
        ...current.declarations,
        [key]: !current.declarations[key],
      },
    }));
  };

  const handleStart = async () => {
    setRunState('running');
    setExportReviewed(false);
    const nativeProbe = await nativeProbeReader();
    const nativeProbeUnavailable =
      nativeProbe.metrics.every((metric) => metric.source === 'unavailable') &&
      nativeProbe.secureStorage.status === 'unavailable';
    setNativeProbeStatus(nativeProbeUnavailable ? 'unavailable' : 'measured');
    const result = await runMobileBenchmarkScenarios(setup, {
      env: environment,
      nativeProbe,
      interruptionScenarioId,
      forcedFailure: failureScenarioId
        ? {
            scenarioId: failureScenarioId,
            resultCode: failureResultCode,
          }
        : undefined,
      generatedAt: '2026-05-12T09:50:00.000Z',
    });
    setRunResult(result);
    setRunState('complete');
  };

  return (
    <main className="min-h-screen bg-hush-bg-dark px-4 py-5 text-hush-text-primary sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <header className="rounded-lg bg-hush-bg-light/60 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-hush-text-accent">
                Internal HushVoting workspace
              </p>
              <h1 className="mt-1 text-2xl font-semibold">FEAT-121 mobile crypto benchmark</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-hush-text-accent">
              <StatusPill status={routeGate.reason} />
              <span>{MOBILE_BENCHMARK_ROUTE}</span>
            </div>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="space-y-4">
            <div className={panelClassName}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">Setup</h2>
                <StatusPill status={setupComplete ? 'ready' : 'incomplete'} />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="text-hush-text-accent">Role</span>
                  <select
                    className={fieldClassName}
                    value={setup.benchmarkRole}
                    onChange={(event) =>
                      setSetup((current) => ({
                        ...current,
                        benchmarkRole: event.target.value as MobileBenchmarkRunnerSetup['benchmarkRole'],
                      }))
                    }
                  >
                    <option value="developer">Developer</option>
                    <option value="auditor">Auditor</option>
                    <option value="organizer">Organizer</option>
                    <option value="voter">Voter</option>
                    <option value="trustee">Trustee</option>
                  </select>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="text-hush-text-accent">Implementation path</span>
                  <select
                    aria-label="Implementation path"
                    className={fieldClassName}
                    value={setup.implementationPath}
                    onChange={(event) =>
                      setSetup((current) => ({
                        ...current,
                        implementationPath: event.target.value as MobileBenchmarkImplementationPathId,
                      }))
                    }
                  >
                    {pathAvailability.map((path) => (
                      <option key={path.pathId} value={path.pathId}>
                        {path.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="text-hush-text-accent">Profile</span>
                  <select
                    className={fieldClassName}
                    value={setup.profileId}
                    onChange={(event) =>
                      setSetup((current) => ({
                        ...current,
                        profileId: event.target.value,
                      }))
                    }
                  >
                    <option value="phase5-scenarios-01-14">Phase 5 scenarios 1-14</option>
                    <option value="phase4-scenarios-01-08">Phase 4 scenarios 1-8</option>
                    <option value="browser-smoke">Browser smoke subset</option>
                  </select>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="text-hush-text-accent">Device class</span>
                  <select
                    className={fieldClassName}
                    value={setup.deviceClass}
                    onChange={(event) =>
                      setSetup((current) => ({
                        ...current,
                        deviceClass: event.target.value as MobileBenchmarkRunnerSetup['deviceClass'],
                      }))
                    }
                  >
                    <option value="mobile_phone">Mobile phone</option>
                    <option value="tablet">Tablet</option>
                    <option value="desktop_laptop">Desktop or laptop</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </label>
              </div>
            </div>

            <div className={panelClassName}>
              <h2 className="text-base font-semibold">Path availability</h2>
              <div className="mt-3 space-y-2">
                {pathAvailability.map((path) => (
                  <div
                    className="flex flex-col gap-2 rounded-md bg-hush-bg-dark/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                    key={path.pathId}
                  >
                    <div>
                      <p className="text-sm font-semibold">{path.label}</p>
                      <p className="text-xs text-hush-text-accent">{path.reason}</p>
                    </div>
                    <StatusPill status={path.status} />
                  </div>
                ))}
              </div>
              {selectedPath?.status === 'not_available' ? (
                <div
                  className="mt-3 rounded-md bg-amber-300/15 p-3 text-sm text-amber-100"
                  data-testid="mobile-benchmark-unsupported-path"
                >
                  Selected path is unavailable in this runtime and is not counted as a
                  performance failure.
                </div>
              ) : null}
              <div
                className="mt-3 rounded-md bg-hush-bg-dark/55 p-3 text-sm text-hush-text-accent"
                data-testid="mobile-benchmark-native-probe-status"
              >
                Native probe: {nativeProbeStatus}
              </div>
            </div>

            <div className={panelClassName}>
              <h2 className="text-base font-semibold">Pre-run checklist</h2>
              <div className="mt-3 space-y-2">
                {declarationLabels.map((item) => (
                  <label
                    className="flex items-center gap-3 rounded-md bg-hush-bg-dark/55 px-3 py-2 text-sm"
                    key={item.key}
                  >
                    <input
                      checked={setup.declarations[item.key]}
                      className="h-4 w-4 accent-hush-purple"
                      onChange={() => toggleDeclaration(item.key)}
                      type="checkbox"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
              <button
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-hush-purple px-4 py-2 text-sm font-semibold text-hush-bg-dark transition disabled:cursor-not-allowed disabled:bg-hush-bg-dark disabled:text-hush-text-accent"
                data-testid="mobile-benchmark-start"
                disabled={!setupComplete || runState === 'running'}
                onClick={() => void handleStart()}
                type="button"
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                Start benchmark
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className={panelClassName}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">Scenario selection</h2>
                <span className="text-sm text-hush-text-accent">
                  {setup.selectedScenarioIds.length} selected
                </span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {MOBILE_BENCHMARK_RUNNER_SCENARIOS.map((scenario) => (
                  <label
                    className="rounded-md bg-hush-bg-dark/55 p-3 text-sm"
                    key={scenario.scenarioId}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        checked={setup.selectedScenarioIds.includes(scenario.scenarioId)}
                        className="h-4 w-4 accent-hush-purple"
                        onChange={() => toggleScenario(scenario.scenarioId)}
                        type="checkbox"
                      />
                      <span className="font-semibold">{scenario.scenarioId}</span>
                    </span>
                    <span className="mt-1 block text-hush-text-accent">{scenario.title}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className={panelClassName} data-testid="mobile-benchmark-progress">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">Run progress</h2>
                <StatusPill status={runState} />
              </div>
              <p className="mt-2 text-sm text-hush-text-accent">
                Overall progress {completedScenarios} of {setup.selectedScenarioIds.length}
              </p>
              <p
                className="mt-2 rounded-md bg-hush-bg-dark/55 p-3 text-xs text-hush-text-accent"
                data-testid="mobile-benchmark-failure-taxonomy"
              >
                Failure states tracked: operation_timeout, out_of_memory, app_crash,
                verifier_mismatch, unsupported_path, app_interrupted.
              </p>
              {runResult ? (
                <div className="mt-3 space-y-2">
                  {runResult.report.scenarios.map((scenario) => (
                    <div
                      className="rounded-md bg-hush-bg-dark/55 p-3"
                      key={scenario.scenarioId}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">
                          {scenario.scenarioId} - {scenario.title}
                        </p>
                        <StatusPill status={scenario.status} />
                      </div>
                      <p className="mt-1 text-xs text-hush-text-accent">
                        {scenario.operations.length} operation sample
                        {scenario.operations.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 rounded-md bg-hush-bg-dark/55 p-3 text-sm text-hush-text-accent">
                  No samples recorded yet.
                </p>
              )}
              {interrupted ? (
                <div
                  className="mt-3 flex items-start gap-3 rounded-md bg-amber-300/15 p-3 text-sm text-amber-100"
                  data-testid="mobile-benchmark-interruption"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4" aria-hidden="true" />
                  <span>Interruption sample preserved before retry.</span>
                </div>
              ) : null}
              {failedOperations.length > 0 ? (
                <div
                  className="mt-3 flex items-start gap-3 rounded-md bg-red-400/15 p-3 text-sm text-red-100"
                  data-testid="mobile-benchmark-failure"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4" aria-hidden="true" />
                  <span>
                    Failure sample recorded: {failedOperations[0].resultCode}.
                  </span>
                </div>
              ) : null}
            </div>

            <div className={panelClassName}>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-200" aria-hidden="true" />
                <h2 className="text-base font-semibold">Export review</h2>
              </div>
              {runResult ? (
                <div className="mt-3 space-y-3 text-sm">
                  <div className="grid gap-2 rounded-md bg-hush-bg-dark/55 p-3 sm:grid-cols-2">
                    <span>Report id: {runResult.report.reportId}</span>
                    <span>Schema: {runResult.report.schemaVersion}</span>
                    <span>Role: {runResult.report.benchmarkRole}</span>
                    <span>Path: {pathLabels[runResult.report.implementationPath]}</span>
                    <span>Profile: {setup.profileId}</span>
                    <span>
                      not_for_release_integrity_claims:{' '}
                      {String(runResult.report.benchmarkApp.notForReleaseIntegrityClaims)}
                    </span>
                  </div>
                  <div className="rounded-md bg-hush-bg-dark/55 p-3">
                    <p className="font-semibold">Bundle files</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {MOBILE_BENCHMARK_REPORT_BUNDLE_FILES.map((file) => (
                        <span
                          className="rounded-full bg-hush-bg-light px-2 py-1 text-xs text-hush-text-accent"
                          key={file}
                        >
                          {file}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    className="inline-flex items-center gap-2 rounded-md bg-emerald-300 px-3 py-2 text-sm font-semibold text-hush-bg-dark"
                    onClick={() => setExportReviewed(true)}
                    type="button"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Run privacy scan
                  </button>
                  {exportReviewed ? (
                    <div
                      className={
                        runResult.exportValidation.exportable
                          ? 'rounded-md bg-emerald-300/15 p-3 text-emerald-100'
                          : 'rounded-md bg-red-400/15 p-3 text-red-100'
                      }
                      data-testid="mobile-benchmark-export-status"
                    >
                      {runResult.exportValidation.exportable
                        ? 'Privacy scan passed. Export review is clear.'
                        : 'Export blocked by privacy or claim validation.'}
                    </div>
                  ) : (
                    <p className="rounded-md bg-hush-bg-dark/55 p-3 text-hush-text-accent">
                      Privacy scan pending before save.
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-3 rounded-md bg-hush-bg-dark/55 p-3 text-sm text-hush-text-accent">
                  Run the benchmark to review report metadata and bundle files.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
