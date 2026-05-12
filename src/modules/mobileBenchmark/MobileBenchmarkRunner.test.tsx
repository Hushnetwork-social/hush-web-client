import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  MOBILE_BENCHMARK_ENV_FLAG,
  MOBILE_BENCHMARK_ROUTE,
  createUnavailableMobileBenchmarkNativeProbe,
  type MobileBenchmarkRouteGate,
} from '@/lib/crypto/mobileBenchmark';
import { MobileBenchmarkRunner } from './MobileBenchmarkRunner';

const enabledGate: MobileBenchmarkRouteGate = {
  route: MOBILE_BENCHMARK_ROUTE,
  envFlag: MOBILE_BENCHMARK_ENV_FLAG,
  enabled: true,
  hiddenFromOrdinaryHushVotingNavigation: true,
  reason: 'enabled',
};

const disabledGate: MobileBenchmarkRouteGate = {
  ...enabledGate,
  enabled: false,
  reason: 'missing_flag',
};

const declarationLabels = [
  'Controlled synthetic fixture pack selected',
  'Device will stay foregrounded for the run',
  'Low-power or battery-saver mode disabled',
  'Unrelated apps closed before sampling',
  'No real election data will be loaded',
];

function completeChecklist() {
  declarationLabels.forEach((label) => {
    fireEvent.click(screen.getByLabelText(label));
  });
}

const unavailableNativeProbeReader = () =>
  Promise.resolve(createUnavailableMobileBenchmarkNativeProbe('component_test_no_native_bridge'));

describe('MobileBenchmarkRunner', () => {
  it('shows an explicit disabled route state when the internal gate is closed', () => {
    render(<MobileBenchmarkRunner gate={disabledGate} />);

    expect(screen.getByTestId('mobile-benchmark-disabled')).toHaveTextContent(
      'Mobile benchmark unavailable'
    );
    expect(screen.queryByTestId('mobile-benchmark-start')).not.toBeInTheDocument();
  });

  it('requires setup declarations before running and privacy-scans export metadata', async () => {
    render(
      <MobileBenchmarkRunner
        gate={enabledGate}
        nativeProbeReader={unavailableNativeProbeReader}
        environment={{
          userAgent: 'Mozilla/5.0 Chrome/124.0',
          language: 'en-US',
          hardwareConcurrency: 8,
          deviceMemoryGb: 4,
        }}
      />
    );

    expect(screen.getByTestId('mobile-benchmark-start')).toBeDisabled();

    completeChecklist();

    expect(screen.getByTestId('mobile-benchmark-start')).not.toBeDisabled();

    fireEvent.click(screen.getByTestId('mobile-benchmark-start'));

    expect(await screen.findByText(/Overall progress 14 of 14/)).toBeInTheDocument();
    expect(screen.getByText(/Report id: feat121-phase5-/)).toBeInTheDocument();
    expect(screen.getByText(/Schema: hushvoting-mobile-benchmark-report-v1/)).toBeInTheDocument();
    expect(screen.getByText('report.json')).toBeInTheDocument();
    expect(screen.getByText(/not_for_release_integrity_claims: true/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /run privacy scan/i }));

    expect(screen.getByTestId('mobile-benchmark-export-status')).toHaveTextContent(
      'Privacy scan passed'
    );
  });

  it('keeps unavailable implementation paths visible without enabling a performance run', () => {
    render(
      <MobileBenchmarkRunner
        gate={enabledGate}
        nativeProbeReader={unavailableNativeProbeReader}
      />
    );

    completeChecklist();
    fireEvent.change(screen.getByLabelText('Implementation path'), {
      target: { value: 'fully_native_ios' },
    });

    expect(screen.getByTestId('mobile-benchmark-unsupported-path')).toHaveTextContent(
      'not counted as a performance failure'
    );
    expect(screen.getByTestId('mobile-benchmark-start')).toBeDisabled();
  });

  it('surfaces preserved interruption samples after a retry', async () => {
    render(
      <MobileBenchmarkRunner
        gate={enabledGate}
        interruptionScenarioId="scenario-04"
        nativeProbeReader={unavailableNativeProbeReader}
      />
    );

    completeChecklist();
    fireEvent.click(screen.getByTestId('mobile-benchmark-start'));

    expect(await screen.findByTestId('mobile-benchmark-interruption')).toHaveTextContent(
      'Interruption sample preserved'
    );
  });

  it('shows the explicit failure-state vocabulary and concrete failed sample', async () => {
    render(
      <MobileBenchmarkRunner
        gate={enabledGate}
        failureScenarioId="scenario-07"
        failureResultCode="verifier_mismatch"
        nativeProbeReader={unavailableNativeProbeReader}
      />
    );

    expect(screen.getByTestId('mobile-benchmark-failure-taxonomy')).toHaveTextContent(
      'operation_timeout'
    );

    completeChecklist();
    fireEvent.click(screen.getByTestId('mobile-benchmark-start'));

    expect(await screen.findByTestId('mobile-benchmark-failure')).toHaveTextContent(
      'verifier_mismatch'
    );
  });

  it('exposes SP artifact scenarios in the internal runner catalog', () => {
    render(<MobileBenchmarkRunner gate={enabledGate} />);

    expect(screen.getByText('scenario-09')).toBeInTheDocument();
    expect(screen.getByText('SP-04 challenge/spoil ceremony')).toBeInTheDocument();
    expect(screen.getByText('scenario-14')).toBeInTheDocument();
    expect(screen.getByText('SP-06 trustee resilience profile')).toBeInTheDocument();
  });

  it('shows native probe status after a run', async () => {
    render(
      <MobileBenchmarkRunner
        gate={enabledGate}
        nativeProbeReader={unavailableNativeProbeReader}
      />
    );

    completeChecklist();
    fireEvent.click(screen.getByTestId('mobile-benchmark-start'));

    expect(await screen.findByText('Native probe: unavailable')).toBeInTheDocument();
  });
});
