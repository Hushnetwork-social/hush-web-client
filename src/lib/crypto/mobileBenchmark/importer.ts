import {
  MOBILE_BENCHMARK_ENVIRONMENT_CSV_COLUMNS,
  MOBILE_BENCHMARK_METRIC_CSV_COLUMNS,
  MOBILE_BENCHMARK_OPERATION_CSV_COLUMNS,
  MOBILE_BENCHMARK_REPORT_SCHEMA_VERSION,
  decodeEnvironmentCsvRow,
  decodeMetricCsvRow,
  encodeEnvironmentCsvRow,
  encodeMetricCsvRow,
  toEnvironmentCsvRows,
  toMetricCsvRows,
  toOperationCsvRows,
  validateMobileBenchmarkReportShape,
  type MobileBenchmarkEnvironmentCsvRow,
  type MobileBenchmarkMetricCsvRow,
  type MobileBenchmarkOperationCsvColumn,
  type MobileBenchmarkOperationCsvRow,
  type MobileBenchmarkReport,
  type MobileBenchmarkScenarioId,
} from './contracts.ts';
import { validateMobileBenchmarkReportForExport } from './privacy.ts';

export interface MobileBenchmarkLooseImportFiles {
  kind: 'loose_files';
  sourceName: string;
  reportJson: string | MobileBenchmarkReport;
  metricsCsv?: string;
  operationsCsv?: string;
  environmentCsv?: string;
}

export interface MobileBenchmarkZipImportBundle {
  kind: 'zip_bundle';
  sourceName: string;
  content: Uint8Array;
}

export type MobileBenchmarkImportSource =
  | MobileBenchmarkLooseImportFiles
  | MobileBenchmarkZipImportBundle;

export interface MobileBenchmarkImportedReport {
  sourceName: string;
  report: MobileBenchmarkReport;
  metrics: MobileBenchmarkMetricCsvRow[];
  operations: MobileBenchmarkOperationCsvRow[];
  environment: MobileBenchmarkEnvironmentCsvRow[];
  warnings: string[];
}

export interface MobileBenchmarkImportReject {
  sourceName: string;
  reportId?: string;
  code:
    | 'unsupported_bundle_reader'
    | 'invalid_json'
    | 'unsupported_schema_version'
    | 'schema_validation_failed'
    | 'privacy_validation_failed'
    | 'duplicate_report_id'
    | 'invalid_csv';
  message: string;
}

export interface MobileBenchmarkImportResult {
  acceptedReports: MobileBenchmarkImportedReport[];
  rejectedReports: MobileBenchmarkImportReject[];
  duplicateReportIds: string[];
}

export interface MobileBenchmarkAggregateGroup {
  key: string;
  benchmarkRole: string;
  deviceClass: string;
  implementationPath: string;
  protocolCircuitProfile: string;
  scenarioId: MobileBenchmarkScenarioId;
  spCoverage: string;
  sampleCount: number;
  unavailableMetricCount: number;
  p50DurationMs: number | null;
  p95DurationMs: number | null;
  minDurationMs: number | null;
  maxDurationMs: number | null;
  successRate: number;
  crashRate: number;
  warningCount: number;
  failureCount: number;
}

export interface MobileBenchmarkAggregatorOutput {
  groups: MobileBenchmarkAggregateGroup[];
  mergedCsv: {
    'all_metrics.csv': string;
    'all_operations.csv': string;
    'all_environments.csv': string;
  };
  comparisonSummaryMd: string;
}

type CsvRecord<TColumn extends string> = Record<TColumn, string>;

function parseReportJson(source: MobileBenchmarkLooseImportFiles): MobileBenchmarkReport {
  if (typeof source.reportJson !== 'string') {
    return source.reportJson;
  }

  try {
    return JSON.parse(source.reportJson) as MobileBenchmarkReport;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Invalid JSON');
  }
}

function parseCsvRows<TColumn extends string>(
  csv: string,
  expectedColumns: readonly TColumn[]
): CsvRecord<TColumn>[] {
  const rows = csv.trim().length === 0 ? [] : csv.trim().split(/\r?\n/);

  if (rows.length === 0) {
    return [];
  }

  const header = parseCsvLine(rows[0]);
  if (header.join(',') !== expectedColumns.join(',')) {
    throw new Error(`Unexpected CSV header: ${header.join(',')}`);
  }

  return rows.slice(1).map((row) => {
    const cells = parseCsvLine(row);
    if (cells.length !== expectedColumns.length) {
      throw new Error(`CSV row has ${cells.length} cells; expected ${expectedColumns.length}`);
    }

    return Object.fromEntries(
      expectedColumns.map((column, index) => [column, cells[index]])
    ) as CsvRecord<TColumn>;
  });
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function csvEscape(value: string): string {
  if (!/[",\r\n]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}

function serializeCsvRows<TColumn extends string>(
  columns: readonly TColumn[],
  rows: Array<CsvRecord<TColumn>>
): string {
  return [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(',')),
  ].join('\n');
}

function decodeMetricRows(csv?: string, report?: MobileBenchmarkReport): MobileBenchmarkMetricCsvRow[] {
  if (!csv) {
    return report ? toMetricCsvRows(report) : [];
  }

  return parseCsvRows(csv, MOBILE_BENCHMARK_METRIC_CSV_COLUMNS).map(decodeMetricCsvRow);
}

function decodeEnvironmentRows(
  csv?: string,
  report?: MobileBenchmarkReport
): MobileBenchmarkEnvironmentCsvRow[] {
  if (!csv) {
    return report ? toEnvironmentCsvRows(report) : [];
  }

  return parseCsvRows(csv, MOBILE_BENCHMARK_ENVIRONMENT_CSV_COLUMNS).map(
    decodeEnvironmentCsvRow
  );
}

function decodeOperationRows(
  csv?: string,
  report?: MobileBenchmarkReport
): MobileBenchmarkOperationCsvRow[] {
  if (!csv) {
    return report ? toOperationCsvRows(report) : [];
  }

  return parseCsvRows(csv, MOBILE_BENCHMARK_OPERATION_CSV_COLUMNS).map((row) => ({
    reportId: row.report_id,
    scenarioId: row.scenario_id as MobileBenchmarkScenarioId,
    operationId: row.operation_id,
    operationKind: row.operation_kind as MobileBenchmarkOperationCsvRow['operationKind'],
    status: row.status as MobileBenchmarkOperationCsvRow['status'],
    startedAt: row.started_at,
    durationMs: row.duration_ms ? Number(row.duration_ms) : null,
    pathId: row.path_id as MobileBenchmarkOperationCsvRow['pathId'],
    pathStatus: row.path_status as MobileBenchmarkOperationCsvRow['pathStatus'],
    resultCode: row.result_code,
    errorCode: row.error_code || undefined,
  }));
}

function encodeOperationCsvRow(
  row: MobileBenchmarkOperationCsvRow
): Record<MobileBenchmarkOperationCsvColumn, string> {
  return {
    report_id: row.reportId,
    scenario_id: row.scenarioId,
    operation_id: row.operationId,
    operation_kind: row.operationKind,
    status: row.status,
    started_at: row.startedAt,
    duration_ms: row.durationMs === null ? '' : String(row.durationMs),
    path_id: row.pathId,
    path_status: row.pathStatus,
    result_code: row.resultCode,
    error_code: row.errorCode ?? '',
  };
}

function warningCount(report: MobileBenchmarkReport): number {
  return (
    report.summary.warnings.length +
    report.scenarios.reduce((total, scenario) => total + scenario.warnings.length, 0)
  );
}

function spCoverageKey(report: MobileBenchmarkReport, scenarioId: MobileBenchmarkScenarioId): string {
  const scenarioCoverage = report.protocolPackage.spCoverage.filter((coverage) =>
    report.scenarios.some((scenario) => scenario.scenarioId === scenarioId)
      ? true
      : coverage.status === 'not_applicable'
  );

  if (scenarioCoverage.length === 0) {
    return 'not_recorded';
  }

  return scenarioCoverage
    .map((coverage) => `${coverage.spId}:${coverage.status}`)
    .sort()
    .join('|');
}

function environmentStringValue(report: MobileBenchmarkReport, fieldPath: string): string | null {
  const value = report.environment.find((fact) => fact.fieldPath === fieldPath)?.value;

  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function protocolCircuitProfile(report: MobileBenchmarkReport): string {
  return [
    report.protocolPackage.version,
    environmentStringValue(report, 'benchmark.profile_id') ?? 'profile_not_recorded',
  ].join('/');
}

function percentile(values: number[], percentileRank: number): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil((percentileRank / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

function normalizeMetricUnit(row: MobileBenchmarkMetricCsvRow): MobileBenchmarkMetricCsvRow {
  if (row.value === null || typeof row.value !== 'number') {
    return row;
  }

  if (row.unit === 's') {
    return {
      ...row,
      value: row.value * 1000,
      unit: 'ms',
    };
  }

  if (row.unit === 'KB') {
    return {
      ...row,
      value: row.value / 1024,
      unit: 'MB',
    };
  }

  if (row.unit === 'bytes') {
    return {
      ...row,
      value: row.value / 1024 / 1024,
      unit: 'MB',
    };
  }

  return row;
}

export function importMobileBenchmarkReports(
  sources: MobileBenchmarkImportSource[]
): MobileBenchmarkImportResult {
  const acceptedReports: MobileBenchmarkImportedReport[] = [];
  const rejectedReports: MobileBenchmarkImportReject[] = [];
  const seenReportIds = new Set<string>();
  const duplicateReportIds: string[] = [];

  for (const source of sources) {
    if (source.kind === 'zip_bundle') {
      rejectedReports.push({
        sourceName: source.sourceName,
        code: 'unsupported_bundle_reader',
        message: 'Zip bundle reading is not enabled in the local importer library yet.',
      });
      continue;
    }

    let report: MobileBenchmarkReport;
    try {
      report = parseReportJson(source);
    } catch (error) {
      rejectedReports.push({
        sourceName: source.sourceName,
        code: 'invalid_json',
        message: error instanceof Error ? error.message : 'Invalid report JSON.',
      });
      continue;
    }

    if (report.schemaVersion !== MOBILE_BENCHMARK_REPORT_SCHEMA_VERSION) {
      rejectedReports.push({
        sourceName: source.sourceName,
        reportId: report.reportId,
        code: 'unsupported_schema_version',
        message: `Unsupported schema version: ${report.schemaVersion}`,
      });
      continue;
    }

    if (seenReportIds.has(report.reportId)) {
      duplicateReportIds.push(report.reportId);
      rejectedReports.push({
        sourceName: source.sourceName,
        reportId: report.reportId,
        code: 'duplicate_report_id',
        message: `Duplicate report id: ${report.reportId}`,
      });
      continue;
    }

    const exportValidation = validateMobileBenchmarkReportForExport(report);
    const shapeIssues = validateMobileBenchmarkReportShape(report);
    if (shapeIssues.length > 0) {
      rejectedReports.push({
        sourceName: source.sourceName,
        reportId: report.reportId,
        code: 'schema_validation_failed',
        message: shapeIssues.map((issue) => issue.code).join(', '),
      });
      continue;
    }

    if (!exportValidation.exportable) {
      rejectedReports.push({
        sourceName: source.sourceName,
        reportId: report.reportId,
        code: 'privacy_validation_failed',
        message: [
          ...exportValidation.privacy.findings.map((finding) => finding.path),
          ...exportValidation.claimFindings.map((finding) => finding.path),
        ].join(', '),
      });
      continue;
    }

    try {
      acceptedReports.push({
        sourceName: source.sourceName,
        report,
        metrics: decodeMetricRows(source.metricsCsv, report).map(normalizeMetricUnit),
        operations: decodeOperationRows(source.operationsCsv, report),
        environment: decodeEnvironmentRows(source.environmentCsv, report),
        warnings: report.summary.warnings,
      });
      seenReportIds.add(report.reportId);
    } catch (error) {
      rejectedReports.push({
        sourceName: source.sourceName,
        reportId: report.reportId,
        code: 'invalid_csv',
        message: error instanceof Error ? error.message : 'Invalid CSV input.',
      });
    }
  }

  return {
    acceptedReports,
    rejectedReports,
    duplicateReportIds,
  };
}

export function aggregateMobileBenchmarkReports(
  acceptedReports: MobileBenchmarkImportedReport[]
): MobileBenchmarkAggregateGroup[] {
  const groupMap = new Map<string, {
    report: MobileBenchmarkReport;
    scenarioId: MobileBenchmarkScenarioId;
    operations: MobileBenchmarkOperationCsvRow[];
    metrics: MobileBenchmarkMetricCsvRow[];
    warningCount: number;
  }>();

  for (const imported of acceptedReports) {
    for (const scenario of imported.report.scenarios) {
      const key = [
        imported.report.benchmarkRole,
        imported.report.deviceClass,
        imported.report.implementationPath,
        protocolCircuitProfile(imported.report),
        scenario.scenarioId,
        spCoverageKey(imported.report, scenario.scenarioId),
      ].join('::');
      const existing = groupMap.get(key);
      const scenarioOperations = imported.operations.filter(
        (operation) => operation.scenarioId === scenario.scenarioId
      );
      const operationIds = new Set(scenarioOperations.map((operation) => operation.operationId));
      const scenarioMetrics = imported.metrics.filter((metric) =>
        operationIds.has(metric.operationId)
      );

      if (existing) {
        existing.operations.push(...scenarioOperations);
        existing.metrics.push(...scenarioMetrics);
        existing.warningCount += warningCount(imported.report);
      } else {
        groupMap.set(key, {
          report: imported.report,
          scenarioId: scenario.scenarioId,
          operations: [...scenarioOperations],
          metrics: [...scenarioMetrics],
          warningCount: warningCount(imported.report),
        });
      }
    }
  }

  return [...groupMap.entries()].map(([key, group]) => {
    const durations = group.operations
      .map((operation) => operation.durationMs)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const failures = group.operations.filter((operation) => operation.status === 'failed');
    const crashes = group.operations.filter((operation) =>
      `${operation.resultCode} ${operation.errorCode ?? ''}`.toLowerCase().includes('crash')
    );
    const successes = group.operations.filter((operation) => operation.status === 'passed');

    return {
      key,
      benchmarkRole: group.report.benchmarkRole,
      deviceClass: group.report.deviceClass,
      implementationPath: group.report.implementationPath,
      protocolCircuitProfile: protocolCircuitProfile(group.report),
      scenarioId: group.scenarioId,
      spCoverage: spCoverageKey(group.report, group.scenarioId),
      sampleCount: group.operations.length,
      unavailableMetricCount: group.metrics.filter((metric) => metric.value === null).length,
      p50DurationMs: percentile(durations, 50),
      p95DurationMs: percentile(durations, 95),
      minDurationMs: durations.length === 0 ? null : Math.min(...durations),
      maxDurationMs: durations.length === 0 ? null : Math.max(...durations),
      successRate: group.operations.length === 0 ? 0 : successes.length / group.operations.length,
      crashRate: group.operations.length === 0 ? 0 : crashes.length / group.operations.length,
      warningCount: group.warningCount,
      failureCount: failures.length,
    };
  });
}

export function coarsenEnvironmentRowsForSummary(
  rows: MobileBenchmarkEnvironmentCsvRow[]
): MobileBenchmarkEnvironmentCsvRow[] {
  return rows.filter(
    (row) =>
      !row.fieldPath.toLowerCase().includes('device_id') &&
      !row.fieldPath.toLowerCase().includes('serial') &&
      !row.fieldPath.toLowerCase().includes('ip_address')
  );
}

export function buildMobileBenchmarkAggregatorOutput(
  importResult: MobileBenchmarkImportResult
): MobileBenchmarkAggregatorOutput {
  const groups = aggregateMobileBenchmarkReports(importResult.acceptedReports);
  const metricRows = importResult.acceptedReports.flatMap((report) => report.metrics);
  const operationRows = importResult.acceptedReports.flatMap((report) => report.operations);
  const environmentRows = importResult.acceptedReports.flatMap((report) =>
    coarsenEnvironmentRowsForSummary(report.environment)
  );

  return {
    groups,
    mergedCsv: {
      'all_metrics.csv': serializeCsvRows(
        MOBILE_BENCHMARK_METRIC_CSV_COLUMNS,
        metricRows.map(encodeMetricCsvRow)
      ),
      'all_operations.csv': serializeCsvRows(
        MOBILE_BENCHMARK_OPERATION_CSV_COLUMNS,
        operationRows.map(encodeOperationCsvRow)
      ),
      'all_environments.csv': serializeCsvRows(
        MOBILE_BENCHMARK_ENVIRONMENT_CSV_COLUMNS,
        environmentRows.map(encodeEnvironmentCsvRow)
      ),
    },
    comparisonSummaryMd: buildComparisonSummaryMarkdown(groups, importResult),
  };
}

export function buildComparisonSummaryMarkdown(
  groups: MobileBenchmarkAggregateGroup[],
  importResult: MobileBenchmarkImportResult
): string {
  const unavailableMetricCount = groups.reduce(
    (total, group) => total + group.unavailableMetricCount,
    0
  );
  const warningCount = groups.reduce((total, group) => total + group.warningCount, 0);
  const unavailablePathCount = groups.filter(
    (group) => group.sampleCount > 0 && group.successRate === 0 && group.p50DurationMs === null
  ).length;
  const lines = [
    '# HushVoting Mobile Benchmark Comparison Summary',
    '',
    'This local summary compares synthetic benchmark reports by role, device class, implementation path, protocol/circuit profile, scenario, and SP coverage.',
    '',
    'Blocked claims: no mobile security audit conclusion, legal clearance, public-election readiness, production rollout approval, or FEAT-106 completion is implied by this benchmark.',
    '',
    `Imported reports: ${importResult.acceptedReports.length}`,
    `Rejected reports: ${importResult.rejectedReports.length}`,
    `Duplicate report ids: ${importResult.duplicateReportIds.length}`,
    `Unavailable metrics: ${unavailableMetricCount}`,
    `Warning observations: ${warningCount}`,
    `Unavailable path groups: ${unavailablePathCount}`,
    '',
    'Maturity gaps remain separate from performance evidence: external review, operational rollout, regulatory tracking, legal validation, and FEAT-106 readiness are not completed by this summary.',
    '',
    '| Role | Device class | Path | Protocol/circuit profile | Scenario | SP coverage | Samples | p50 ms | p95 ms | Success rate | Crash rate | Warnings | Failures |',
    '|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|',
    ...groups.map((group) =>
      [
        group.benchmarkRole,
        group.deviceClass,
        group.implementationPath,
        group.protocolCircuitProfile,
        group.scenarioId,
        group.spCoverage,
        String(group.sampleCount),
        group.p50DurationMs === null ? 'n/a' : group.p50DurationMs.toFixed(2),
        group.p95DurationMs === null ? 'n/a' : group.p95DurationMs.toFixed(2),
        group.successRate.toFixed(2),
        group.crashRate.toFixed(2),
        String(group.warningCount),
        String(group.failureCount),
      ].join(' | ')
    ),
  ];

  return `${lines.join('\n')}\n`;
}
