import { describe, expect, it } from 'vitest';
import {
  MOBILE_BENCHMARK_ENVIRONMENT_CSV_COLUMNS,
  MOBILE_BENCHMARK_IMPLEMENTATION_PATHS,
  MOBILE_BENCHMARK_METRIC_CSV_COLUMNS,
  MOBILE_BENCHMARK_OPERATION_CSV_COLUMNS,
  MOBILE_BENCHMARK_ROLES,
  MOBILE_BENCHMARK_SCENARIO_STATUSES,
  MOBILE_BENCHMARK_REPORT_SCHEMA_VERSION,
  createUnavailableMetric,
  decodeEnvironmentCsvRow,
  decodeMetricCsvRow,
  encodeEnvironmentCsvRow,
  encodeMetricCsvRow,
  toEnvironmentCsvRows,
  toMetricCsvRows,
  toOperationCsvRows,
  validateMobileBenchmarkReportShape,
  type MobileBenchmarkReport,
} from './contracts.ts';

function createReport(overrides?: Partial<MobileBenchmarkReport>): MobileBenchmarkReport {
  return {
    schemaVersion: MOBILE_BENCHMARK_REPORT_SCHEMA_VERSION,
    reportId: 'report-1',
    generatedAt: '2026-05-12T07:30:00.000Z',
    benchmarkRole: 'voter',
    implementationPath: 'browser_fallback_wasm',
    pathStatus: 'measured',
    deviceClass: 'mid_range_android',
    benchmarkApp: {
      name: 'HushVoting mobile benchmark',
      version: '0.1.0',
      buildId: 'local-dev',
      releaseIntegrityMode: 'development_placeholder',
      notForReleaseIntegrityClaims: true,
    },
    protocolPackage: {
      packageId: 'omega-hushvoting-v1',
      version: 'v1.1.12',
      manifestHash: 'a'.repeat(64),
      spCoverage: [
        {
          spId: 'SP-08',
          status: 'covered',
          packageVersion: 'v1.1.12',
          packageHash: 'a'.repeat(64),
          fixtureRef: 'synthetic-sp08-release-fixture',
        },
      ],
    },
    environment: [
      {
        fieldPath: 'runtime.user_agent_family',
        value: 'chromium-webview',
        source: 'measured',
        confidence: 'high',
      },
      {
        fieldPath: 'hardware.gpu_model',
        value: null,
        source: 'unavailable',
        confidence: 'unavailable',
        unavailableReason: 'browser API did not expose GPU model',
      },
    ],
    scenarios: [
      {
        scenarioId: 'scenario-01',
        title: 'Runtime baseline',
        status: 'passed',
        implementationPath: 'browser_fallback_wasm',
        pathStatus: 'measured',
        warnings: [],
        operations: [
          {
            operationId: 'op-1',
            scenarioId: 'scenario-01',
            operationKind: 'proof_generation',
            status: 'passed',
            startedAt: '2026-05-12T07:30:01.000Z',
            durationMs: 152.4,
            resultCode: 'benchmark_operation_completed',
            metrics: [
              {
                name: 'duration_ms',
                value: 152.4,
                unit: 'ms',
                source: 'measured',
                confidence: 'high',
              },
              createUnavailableMetric('gpu_memory_mb', 'MB', 'not exposed in browser'),
            ],
            publicOutput: {
              proofHash: 'sha256:proof',
            },
          },
        ],
      },
    ],
    maturityGapStatus: {
      externalReview: 'planned',
      operationalEvidence: 'referenced_with_limitations',
      regulatoryTracking: 'referenced_with_limitations',
      feat106Readiness: 'not_complete',
      legalValidation: 'not_available',
      certification: 'not_available',
      publicElectionParity: 'not_claimed',
    },
    summary: {
      assurancePositioning:
        'Synthetic local benchmark evidence for architecture comparison only.',
      warnings: [],
    },
    ...overrides,
  };
}

describe('FEAT-121 mobile benchmark contracts', () => {
  it('locks report, role, path, status, and CSV contract values', () => {
    expect(MOBILE_BENCHMARK_ROLES).toEqual([
      'voter',
      'trustee',
      'organizer',
      'auditor',
      'developer',
      'unknown',
    ]);
    expect(MOBILE_BENCHMARK_IMPLEMENTATION_PATHS).toContain('tauri_native_crypto');
    expect(MOBILE_BENCHMARK_IMPLEMENTATION_PATHS).toContain('fully_native_android');
    expect(MOBILE_BENCHMARK_SCENARIO_STATUSES).toEqual(
      expect.arrayContaining([
        'not_run',
        'running',
        'passed',
        'warning',
        'failed',
        'unsupported_path',
        'fixture_gap',
        'schema_gap',
      ])
    );
    expect(MOBILE_BENCHMARK_METRIC_CSV_COLUMNS).toContain('value_kind');
    expect(MOBILE_BENCHMARK_OPERATION_CSV_COLUMNS).toContain('path_status');
    expect(MOBILE_BENCHMARK_ENVIRONMENT_CSV_COLUMNS).toContain('declared_by');
  });

  it('round-trips metric and environment CSV rows while preserving unavailable nulls', () => {
    const report = createReport();
    const unavailableMetric = toMetricCsvRows(report).find(
      (metric) => metric.metricName === 'gpu_memory_mb'
    );
    const unavailableEnvironment = toEnvironmentCsvRows(report).find(
      (fact) => fact.fieldPath === 'hardware.gpu_model'
    );

    expect(unavailableMetric).toBeDefined();
    expect(unavailableEnvironment).toBeDefined();

    const encodedMetric = encodeMetricCsvRow(unavailableMetric!);
    const decodedMetric = decodeMetricCsvRow(encodedMetric);
    const encodedEnvironment = encodeEnvironmentCsvRow(unavailableEnvironment!);
    const decodedEnvironment = decodeEnvironmentCsvRow(encodedEnvironment);

    expect(encodedMetric.value_kind).toBe('null');
    expect(encodedMetric.value).toBe('');
    expect(decodedMetric.value).toBeNull();
    expect(decodedMetric.unavailableReason).toBe('not exposed in browser');
    expect(decodedEnvironment.value).toBeNull();
    expect(decodedEnvironment.unavailableReason).toBe(
      'browser API did not expose GPU model'
    );
  });

  it('rejects unknown scenario ids when decoding metric CSV rows', () => {
    const encodedMetric = encodeMetricCsvRow(toMetricCsvRows(createReport())[0]);

    expect(() =>
      decodeMetricCsvRow({
        ...encodedMetric,
        scenario_id: 'scenario-99',
      })
    ).toThrow('Invalid mobile benchmark scenario id');
  });

  it('derives operation CSV rows from report scenarios without losing path state', () => {
    const [operation] = toOperationCsvRows(createReport());

    expect(operation).toMatchObject({
      reportId: 'report-1',
      scenarioId: 'scenario-01',
      operationId: 'op-1',
      operationKind: 'proof_generation',
      pathId: 'browser_fallback_wasm',
      pathStatus: 'measured',
      durationMs: 152.4,
    });
  });

  it('keeps development placeholder release evidence blocked for release-integrity claims', () => {
    const issues = validateMobileBenchmarkReportShape(
      createReport({
        benchmarkApp: {
          name: 'HushVoting mobile benchmark',
          version: '0.1.0',
          buildId: 'local-dev',
          releaseIntegrityMode: 'development_placeholder',
          notForReleaseIntegrityClaims: false,
        },
      })
    );

    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'placeholder_release_claim_not_blocked',
      })
    );
  });

  it('does not count unavailable native paths as benchmark failures', () => {
    const issues = validateMobileBenchmarkReportShape(
      createReport({
        implementationPath: 'tauri_native_crypto',
        pathStatus: 'not_available',
        scenarios: [
          {
            scenarioId: 'scenario-native',
            title: 'Native proof adapter',
            status: 'failed',
            implementationPath: 'tauri_native_crypto',
            pathStatus: 'not_available',
            warnings: ['native module not compiled'],
            operations: [],
          },
        ],
      })
    );

    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'unavailable_path_counted_as_failure',
      })
    );
  });
});
