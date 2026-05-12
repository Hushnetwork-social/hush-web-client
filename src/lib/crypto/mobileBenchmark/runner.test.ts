import { describe, expect, it } from 'vitest';
import { toOperationCsvRows } from './contracts.ts';
import {
  MOBILE_BENCHMARK_PHASE4_SCENARIO_IDS,
  MOBILE_BENCHMARK_SP_SCENARIO_IDS,
  createDefaultMobileBenchmarkRunnerSetup,
  createSyntheticMobileElectionCrypto,
  getMobileBenchmarkPathAvailability,
  isMobileBenchmarkRunnerSetupComplete,
  runMobileBenchmarkScenarios,
} from './runner.ts';
import { createUnavailableMobileBenchmarkNativeProbe } from './nativeProbes.ts';
import { createUnavailableNativeMobileElectionCrypto } from './nativeCryptoAdapter.ts';

function readySetup(
  overrides: Partial<ReturnType<typeof createDefaultMobileBenchmarkRunnerSetup>> = {}
) {
  const setup = createDefaultMobileBenchmarkRunnerSetup();

  return {
    ...setup,
    ...overrides,
    declarations: {
      controlledFixturePackSelected: true,
      deviceKeptForegrounded: true,
      lowPowerModeDisabled: true,
      unrelatedAppsClosed: true,
      noRealElectionData: true,
      ...overrides.declarations,
    },
  };
}

describe('FEAT-121 Phase 4 mobile benchmark runner', () => {
  it('runs Scenario 1-8 browser fallback samples with witness and proof separated', async () => {
    const setup = readySetup({
      selectedScenarioIds: [...MOBILE_BENCHMARK_PHASE4_SCENARIO_IDS],
    });
    const result = await runMobileBenchmarkScenarios(setup, {
      generatedAt: '2026-05-12T09:30:00.000Z',
      env: {
        userAgent: 'Mozilla/5.0 Chrome/124.0',
        language: 'en-US',
        hardwareConcurrency: 8,
        deviceMemoryGb: 4,
      },
    });

    expect(result.report.schemaVersion).toBe('hushvoting-mobile-benchmark-report-v1');
    expect(result.report.pathStatus).toBe('measured');
    expect(result.report.scenarios).toHaveLength(8);
    expect(result.report.scenarios.map((scenario) => scenario.scenarioId)).toEqual([
      'scenario-01',
      'scenario-02',
      'scenario-03',
      'scenario-04',
      'scenario-05',
      'scenario-06',
      'scenario-07',
      'scenario-08',
    ]);
    expect(
      result.report.scenarios.find((scenario) => scenario.scenarioId === 'scenario-05')
        ?.operations[0].operationKind
    ).toBe('witness_generation');
    expect(
      result.report.scenarios.find((scenario) => scenario.scenarioId === 'scenario-06')
        ?.operations[0].operationKind
    ).toBe('proof_generation');
    expect(result.exportValidation.exportable).toBe(true);
  });

  it('keeps setup blocked until declarations and an available path are selected', () => {
    const setup = createDefaultMobileBenchmarkRunnerSetup();
    const availability = getMobileBenchmarkPathAvailability({
      isTauriWebView: false,
    });

    expect(isMobileBenchmarkRunnerSetupComplete(setup, availability)).toBe(false);
    expect(isMobileBenchmarkRunnerSetupComplete(readySetup(), availability)).toBe(true);
    expect(
      isMobileBenchmarkRunnerSetupComplete(
        readySetup({ implementationPath: 'tauri_native_crypto' }),
        availability
      )
    ).toBe(false);
  });

  it('records unavailable native paths as unsupported instead of performance failures', async () => {
    const result = await runMobileBenchmarkScenarios(
      readySetup({
        implementationPath: 'fully_native_ios',
        selectedScenarioIds: ['scenario-06'],
      }),
      {
        generatedAt: '2026-05-12T09:40:00.000Z',
      }
    );

    expect(result.report.pathStatus).toBe('not_available');
    expect(result.report.scenarios[0]).toMatchObject({
      status: 'unsupported_path',
      pathStatus: 'not_available',
    });
    expect(result.report.scenarios[0].operations[0]).toMatchObject({
      status: 'unsupported_path',
      resultCode: 'implementation_path_not_available',
    });
    expect(result.exportValidation.exportable).toBe(true);
  });

  it('keeps the native crypto adapter path unavailable when no native module is bound', async () => {
    const result = await runMobileBenchmarkScenarios(
      readySetup({
        implementationPath: 'tauri_native_crypto',
        selectedScenarioIds: ['scenario-06'],
      }),
      {
        generatedAt: '2026-05-12T09:41:00.000Z',
        adapter: createUnavailableNativeMobileElectionCrypto(),
      }
    );

    expect(result.report.pathStatus).toBe('not_available');
    expect(result.report.scenarios[0]).toMatchObject({
      status: 'unsupported_path',
      pathStatus: 'not_available',
    });
    expect(result.exportValidation.exportable).toBe(true);
  });

  it('runs a native crypto path only when an explicit compatible adapter is supplied', async () => {
    const result = await runMobileBenchmarkScenarios(
      readySetup({
        implementationPath: 'tauri_native_crypto',
        selectedScenarioIds: ['scenario-06'],
      }),
      {
        generatedAt: '2026-05-12T09:42:00.000Z',
        adapter: createSyntheticMobileElectionCrypto('tauri_native_crypto'),
      }
    );

    expect(result.report.pathStatus).toBe('measured');
    expect(result.report.scenarios[0]).toMatchObject({
      status: 'passed',
      pathStatus: 'measured',
    });
    expect(result.report.scenarios[0].operations[0]).toMatchObject({
      operationKind: 'proof_generation',
      status: 'passed',
    });
    expect(result.exportValidation.exportable).toBe(true);
  });

  it('preserves app interruption samples in operations CSV before retrying', async () => {
    const result = await runMobileBenchmarkScenarios(
      readySetup({ selectedScenarioIds: ['scenario-04'] }),
      {
        generatedAt: '2026-05-12T09:45:00.000Z',
        interruptionScenarioId: 'scenario-04',
      }
    );
    const csvRows = toOperationCsvRows(result.report);

    expect(result.report.scenarios[0].status).toBe('warning');
    expect(csvRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scenarioId: 'scenario-04',
          status: 'failed',
          resultCode: 'app_interrupted',
          errorCode: 'app_interrupted',
        }),
      ])
    );
    expect(csvRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scenarioId: 'scenario-04',
          status: 'passed',
        }),
      ])
    );
  });

  it('records explicit failure states without rewriting them as unsupported paths', async () => {
    const result = await runMobileBenchmarkScenarios(
      readySetup({ selectedScenarioIds: ['scenario-07'] }),
      {
        generatedAt: '2026-05-12T09:46:00.000Z',
        forcedFailure: {
          scenarioId: 'scenario-07',
          operationKind: 'proof_verification',
          resultCode: 'verifier_mismatch',
        },
      }
    );

    expect(result.report.scenarios[0]).toMatchObject({
      status: 'failed',
      pathStatus: 'measured',
    });
    expect(toOperationCsvRows(result.report)[0]).toMatchObject({
      status: 'failed',
      resultCode: 'verifier_mismatch',
      errorCode: 'verifier_mismatch',
    });
  });

  it('runs Scenario 9-14 SP artifact profiles with SP coverage and privacy-safe outputs', async () => {
    const result = await runMobileBenchmarkScenarios(
      readySetup({ selectedScenarioIds: [...MOBILE_BENCHMARK_SP_SCENARIO_IDS] }),
      {
        generatedAt: '2026-05-12T10:15:00.000Z',
      }
    );

    expect(result.report.scenarios.map((scenario) => scenario.scenarioId)).toEqual([
      'scenario-09',
      'scenario-10',
      'scenario-11',
      'scenario-12',
      'scenario-13',
      'scenario-14',
    ]);
    expect(result.report.scenarios.every((scenario) => scenario.status === 'passed')).toBe(true);
    expect(result.report.protocolPackage.spCoverage.map((item) => item.spId)).toEqual(
      expect.arrayContaining(['SP-03', 'SP-04', 'SP-05', 'SP-06', 'SP-07', 'SP-08'])
    );
    expect(result.report.protocolPackage.spCoverage.map((item) => item.spId)).not.toEqual(
      expect.arrayContaining(['SP-09', 'SP-10', 'SP-11'])
    );
    expect(result.exportValidation.exportable).toBe(true);
    expect(JSON.stringify(result.report).toLowerCase()).not.toContain('vote_secret');
    expect(JSON.stringify(result.report).toLowerCase()).not.toContain('trustee_private_material');
  });

  it('keeps Phase 5 artifact operations separated by protocol responsibility', async () => {
    const result = await runMobileBenchmarkScenarios(
      readySetup({ selectedScenarioIds: [...MOBILE_BENCHMARK_SP_SCENARIO_IDS] }),
      {
        generatedAt: '2026-05-12T10:20:00.000Z',
      }
    );
    const operationsByScenario = Object.fromEntries(
      result.report.scenarios.map((scenario) => [
        scenario.scenarioId,
        scenario.operations.map((operation) => operation.operationKind),
      ])
    );

    expect(operationsByScenario['scenario-09']).toEqual([
      'challenge_spoil_prepare',
      'challenge_spoil_verify',
      'challenge_spoil_receipt_verify',
    ]);
    expect(operationsByScenario['scenario-12']).toEqual([
      'publication_transcript_generation',
      'publication_transcript_verification',
    ]);
    expect(operationsByScenario['scenario-14']).toEqual([
      'trustee_threshold_finalize',
      'trustee_missing_nonrequired_finalize',
      'trustee_below_threshold_fail_closed',
      'trustee_artifact_rejection',
    ]);
  });

  it('represents release-integrity modes and mismatch checks without clearing the claim block', async () => {
    const result = await runMobileBenchmarkScenarios(
      readySetup({
        selectedScenarioIds: ['scenario-13'],
        releaseIntegrityMode: 'official_sp08',
      }),
      {
        generatedAt: '2026-05-12T10:25:00.000Z',
      }
    );

    expect(result.report.benchmarkApp).toMatchObject({
      releaseIntegrityMode: 'official_sp08',
      notForReleaseIntegrityClaims: true,
    });
    expect(toOperationCsvRows(result.report)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operationKind: 'release_integrity_manifest_check',
          resultCode: 'release_integrity_evidence_valid',
        }),
        expect.objectContaining({
          operationKind: 'release_integrity_mismatch_check',
          resultCode: 'release_integrity_mismatch_rejected',
        }),
      ])
    );
  });

  it('records trustee resilience threshold success and below-threshold fail-closed evidence', async () => {
    const result = await runMobileBenchmarkScenarios(
      readySetup({ selectedScenarioIds: ['scenario-14'] }),
      {
        generatedAt: '2026-05-12T10:30:00.000Z',
      }
    );

    expect(toOperationCsvRows(result.report)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operationKind: 'trustee_threshold_finalize',
          resultCode: 'threshold_finalization_valid',
        }),
        expect.objectContaining({
          operationKind: 'trustee_missing_nonrequired_finalize',
          resultCode: 'nonrequired_missing_trustee_finalization_valid',
        }),
        expect.objectContaining({
          operationKind: 'trustee_below_threshold_fail_closed',
          resultCode: 'below_threshold_fail_closed',
        }),
        expect.objectContaining({
          operationKind: 'trustee_artifact_rejection',
          resultCode: 'invalid_trustee_artifacts_rejected',
        }),
      ])
    );
    expect(result.report.scenarios[0].status).toBe('passed');
    expect(JSON.stringify(result.report).toLowerCase()).not.toContain('raw trustee');
  });

  it('adds native probe environment facts with unavailable metrics preserved', async () => {
    const result = await runMobileBenchmarkScenarios(
      readySetup({ selectedScenarioIds: ['scenario-01'] }),
      {
        generatedAt: '2026-05-12T10:35:00.000Z',
        nativeProbe: createUnavailableMobileBenchmarkNativeProbe('unit_test_no_native_bridge'),
      }
    );

    expect(result.report.environment).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldPath: 'native.platform.kind',
          value: 'browser',
        }),
        expect.objectContaining({
          fieldPath: 'native.metrics.battery_level_percent',
          value: null,
          source: 'unavailable',
          unavailableReason: 'unit_test_no_native_bridge',
        }),
      ])
    );
    expect(result.exportValidation.exportable).toBe(true);
  });
});
