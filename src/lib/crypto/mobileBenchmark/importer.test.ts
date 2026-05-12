import { describe, expect, it } from 'vitest';
import {
  MOBILE_BENCHMARK_REPORT_SCHEMA_VERSION,
  encodeEnvironmentCsvRow,
  encodeMetricCsvRow,
  type MobileBenchmarkReport,
} from './contracts.ts';
import {
  buildMobileBenchmarkAggregatorOutput,
  coarsenEnvironmentRowsForSummary,
  importMobileBenchmarkReports,
} from './importer.ts';

function createReport(overrides?: Partial<MobileBenchmarkReport>): MobileBenchmarkReport {
  return {
    schemaVersion: MOBILE_BENCHMARK_REPORT_SCHEMA_VERSION,
    reportId: 'report-import-1',
    generatedAt: '2026-05-12T08:30:00.000Z',
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
      packageId: 'protocol-omega-hushvoting-v1',
      version: 'v1.1.12',
      manifestHash: 'a'.repeat(64),
      spCoverage: [
        {
          spId: 'SP-05',
          status: 'covered',
          packageVersion: 'v1.1.12',
          packageHash: 'a'.repeat(64),
          fixtureRef: 'sp05-synthetic-eligibility-checkoff-v1',
        },
      ],
    },
    environment: [
      {
        fieldPath: 'benchmark.profile_id',
        value: 'phase5-scenarios-01-14',
        source: 'fixture',
        confidence: 'high',
      },
      {
        fieldPath: 'runtime.os_family',
        value: 'android',
        source: 'measured',
        confidence: 'high',
      },
    ],
    scenarios: [
      {
        scenarioId: 'scenario-02',
        title: 'Secret commitment baseline',
        status: 'passed',
        implementationPath: 'browser_fallback_wasm',
        pathStatus: 'measured',
        warnings: ['thermal API unavailable'],
        operations: [
          {
            operationId: 'op-1',
            scenarioId: 'scenario-02',
            operationKind: 'commitment',
            status: 'passed',
            startedAt: '2026-05-12T08:30:01.000Z',
            durationMs: 1000,
            resultCode: 'benchmark_operation_completed',
            metrics: [
              {
                name: 'duration_ms',
                value: 1,
                unit: 's',
                source: 'measured',
                confidence: 'high',
              },
              {
                name: 'thermal_state',
                value: null,
                unit: 'state',
                source: 'unavailable',
                confidence: 'unavailable',
                unavailableReason: 'not exposed',
              },
            ],
            publicOutput: {
              commitmentHash: 'sha256:commitment',
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
      warnings: ['This benchmark does not complete legal validation.'],
    },
    ...overrides,
  };
}

function csv(columns: readonly string[], rows: Array<Record<string, string>>): string {
  return [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => row[column] ?? '').join(',')),
  ].join('\n');
}

describe('FEAT-121 local importer and aggregator', () => {
  it('accepts loose report files and derives CSV rows when loose CSV files are absent', () => {
    const result = importMobileBenchmarkReports([
      {
        kind: 'loose_files',
        sourceName: 'report.json',
        reportJson: JSON.stringify(createReport()),
      },
    ]);

    expect(result.rejectedReports).toHaveLength(0);
    expect(result.acceptedReports).toHaveLength(1);
    expect(result.acceptedReports[0].metrics).toHaveLength(2);
    expect(result.acceptedReports[0].operations).toHaveLength(1);
    expect(result.acceptedReports[0].environment).toHaveLength(2);
  });

  it('rejects unsupported schema versions, duplicate report ids, and zip bundles clearly', () => {
    const result = importMobileBenchmarkReports([
      {
        kind: 'zip_bundle',
        sourceName: 'bundle.zip',
        content: new Uint8Array(),
      },
      {
        kind: 'loose_files',
        sourceName: 'old-report.json',
        reportJson: JSON.stringify({
          ...createReport({ reportId: 'old-report' }),
          schemaVersion: 'old-schema',
        }),
      },
      {
        kind: 'loose_files',
        sourceName: 'one.json',
        reportJson: createReport({ reportId: 'duplicate-report' }),
      },
      {
        kind: 'loose_files',
        sourceName: 'two.json',
        reportJson: createReport({ reportId: 'duplicate-report' }),
      },
    ]);

    expect(result.acceptedReports).toHaveLength(1);
    expect(result.duplicateReportIds).toEqual(['duplicate-report']);
    expect(result.rejectedReports.map((reject) => reject.code)).toEqual([
      'unsupported_bundle_reader',
      'unsupported_schema_version',
      'duplicate_report_id',
    ]);
  });

  it('re-scans imported reports and rejects forbidden private output', () => {
    const result = importMobileBenchmarkReports([
      {
        kind: 'loose_files',
        sourceName: 'bad-private.json',
        reportJson: createReport({
          scenarios: [
            {
              scenarioId: 'scenario-02',
              title: 'Bad private output',
              status: 'passed',
              implementationPath: 'browser_fallback_wasm',
              pathStatus: 'measured',
              warnings: [],
              operations: [
                {
                  operationId: 'op-private',
                  scenarioId: 'scenario-02',
                  operationKind: 'commitment',
                  status: 'passed',
                  startedAt: '2026-05-12T08:30:01.000Z',
                  durationMs: 1,
                  resultCode: 'bad_fixture',
                  metrics: [],
                  publicOutput: {
                    privateWitness: 'not allowed',
                  },
                },
              ],
            },
          ],
        }),
      },
    ]);

    expect(result.acceptedReports).toHaveLength(0);
    expect(result.rejectedReports[0]).toMatchObject({
      code: 'privacy_validation_failed',
      reportId: 'report-import-1',
    });
  });

  it('accepts loose CSV files, normalizes units, and preserves unavailable null metrics', () => {
    const metricRow = encodeMetricCsvRow({
      reportId: 'csv-report',
      scenarioId: 'scenario-02',
      operationId: 'op-1',
      metricName: 'duration_ms',
      value: 2,
      unit: 's',
      source: 'measured',
      confidence: 'high',
    });
    const unavailableMetricRow = encodeMetricCsvRow({
      reportId: 'csv-report',
      scenarioId: 'scenario-02',
      operationId: 'op-1',
      metricName: 'gpu_model',
      value: null,
      unit: 'model',
      source: 'unavailable',
      confidence: 'unavailable',
      unavailableReason: 'not exposed',
    });
    const environmentRow = encodeEnvironmentCsvRow({
      reportId: 'csv-report',
      fieldPath: 'runtime.os_family',
      value: 'android',
      source: 'measured',
      confidence: 'high',
    });
    const result = importMobileBenchmarkReports([
      {
        kind: 'loose_files',
        sourceName: 'csv-report',
        reportJson: createReport({ reportId: 'csv-report' }),
        metricsCsv: csv(
          [
            'report_id',
            'scenario_id',
            'operation_id',
            'metric_name',
            'value_kind',
            'value',
            'unit',
            'source',
            'confidence',
            'unavailable_reason',
          ],
          [metricRow, unavailableMetricRow]
        ),
        environmentCsv: csv(
          [
            'report_id',
            'field_path',
            'value_kind',
            'value',
            'source',
            'confidence',
            'declared_by',
            'unavailable_reason',
          ],
          [environmentRow]
        ),
      },
    ]);

    expect(result.acceptedReports[0].metrics).toContainEqual(
      expect.objectContaining({
        metricName: 'duration_ms',
        value: 2000,
        unit: 'ms',
      })
    );
    expect(result.acceptedReports[0].metrics).toContainEqual(
      expect.objectContaining({
        metricName: 'gpu_model',
        value: null,
        unavailableReason: 'not exposed',
      })
    );
  });

  it('computes grouped aggregates and emits merged CSV plus claim-safe markdown', () => {
    const result = importMobileBenchmarkReports([
      {
        kind: 'loose_files',
        sourceName: 'one.json',
        reportJson: createReport({ reportId: 'group-one' }),
      },
      {
        kind: 'loose_files',
        sourceName: 'two.json',
        reportJson: createReport({
          reportId: 'group-two',
          scenarios: [
            {
              ...createReport().scenarios[0],
              operations: [
                {
                  ...createReport().scenarios[0].operations[0],
                  operationId: 'op-2',
                  durationMs: 3000,
                  status: 'failed',
                  resultCode: 'operation_crash_detected',
                  errorCode: 'crash',
                },
              ],
            },
          ],
        }),
      },
    ]);
    const output = buildMobileBenchmarkAggregatorOutput(result);

    expect(output.groups).toHaveLength(1);
    expect(output.groups[0]).toMatchObject({
      protocolCircuitProfile: 'v1.1.12/phase5-scenarios-01-14',
      sampleCount: 2,
      p50DurationMs: 1000,
      p95DurationMs: 3000,
      minDurationMs: 1000,
      maxDurationMs: 3000,
      successRate: 0.5,
      crashRate: 0.5,
      failureCount: 1,
    });
    expect(output.mergedCsv['all_metrics.csv']).toContain('metric_name');
    expect(output.mergedCsv['all_operations.csv']).toContain('operation_crash_detected');
    expect(output.mergedCsv['all_environments.csv']).toContain('runtime.os_family');
    expect(output.comparisonSummaryMd).toContain('Blocked claims');
    expect(output.comparisonSummaryMd).toContain('Protocol/circuit profile');
    expect(output.comparisonSummaryMd).toContain('Unavailable metrics: 2');
    expect(output.comparisonSummaryMd).toContain(
      'v1.1.12/phase5-scenarios-01-14'
    );
    expect(output.comparisonSummaryMd.toLowerCase()).not.toContain('mobile ready');
    expect(output.comparisonSummaryMd.toLowerCase()).not.toContain('certified');
  });

  it('coarsens environment rows before HushDocuments-style summary export', () => {
    const rows = coarsenEnvironmentRowsForSummary([
      {
        reportId: 'report',
        fieldPath: 'hardware.device_id',
        value: 'raw-device-id',
        source: 'measured',
        confidence: 'high',
      },
      {
        reportId: 'report',
        fieldPath: 'runtime.os_family',
        value: 'android',
        source: 'measured',
        confidence: 'high',
      },
    ]);

    expect(rows).toEqual([
      expect.objectContaining({
        fieldPath: 'runtime.os_family',
      }),
    ]);
  });
});
