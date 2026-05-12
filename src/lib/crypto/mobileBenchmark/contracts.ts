export const MOBILE_BENCHMARK_REPORT_SCHEMA_VERSION =
  'hushvoting-mobile-benchmark-report-v1';

export const MOBILE_BENCHMARK_REPORT_BUNDLE_FILES = [
  'report.json',
  'summary.md',
  'metrics.csv',
  'operations.csv',
  'environment.csv',
  'README.txt',
] as const;

export const MOBILE_BENCHMARK_SCENARIO_IDS = [
  'scenario-01',
  'scenario-02',
  'scenario-03',
  'scenario-04',
  'scenario-05',
  'scenario-06',
  'scenario-07',
  'scenario-08',
  'scenario-09',
  'scenario-10',
  'scenario-11',
  'scenario-12',
  'scenario-13',
  'scenario-14',
] as const;

export type MobileBenchmarkScenarioId = (typeof MOBILE_BENCHMARK_SCENARIO_IDS)[number];

export const MOBILE_BENCHMARK_ROLES = [
  'voter',
  'trustee',
  'organizer',
  'auditor',
  'developer',
  'unknown',
] as const;

export type MobileBenchmarkRole = (typeof MOBILE_BENCHMARK_ROLES)[number];

export const MOBILE_BENCHMARK_IMPLEMENTATION_PATHS = [
  'browser_fallback_wasm',
  'tauri_webview_wasm',
  'tauri_native_crypto',
  'fully_native_ios',
  'fully_native_android',
] as const;

export type MobileBenchmarkImplementationPathId =
  (typeof MOBILE_BENCHMARK_IMPLEMENTATION_PATHS)[number];

export const MOBILE_BENCHMARK_PATH_STATUSES = [
  'measured',
  'available_not_run',
  'not_available',
  'failed_to_start',
  'not_in_scope_for_profile',
] as const;

export type MobileBenchmarkPathStatus =
  (typeof MOBILE_BENCHMARK_PATH_STATUSES)[number];

export const MOBILE_BENCHMARK_SCENARIO_STATUSES = [
  'not_run',
  'running',
  'passed',
  'warning',
  'failed',
  'unsupported_path',
  'fixture_gap',
  'schema_gap',
  'not_available',
] as const;

export type MobileBenchmarkScenarioStatus =
  (typeof MOBILE_BENCHMARK_SCENARIO_STATUSES)[number];

export const MOBILE_BENCHMARK_METRIC_SOURCES = [
  'measured',
  'tester_declared',
  'derived',
  'fixture',
  'unavailable',
] as const;

export type MobileBenchmarkMetricSource =
  (typeof MOBILE_BENCHMARK_METRIC_SOURCES)[number];

export const MOBILE_BENCHMARK_METRIC_CONFIDENCE = [
  'high',
  'medium',
  'low',
  'unavailable',
] as const;

export type MobileBenchmarkMetricConfidence =
  (typeof MOBILE_BENCHMARK_METRIC_CONFIDENCE)[number];

export const MOBILE_BENCHMARK_SP_IDS = [
  'SP-03',
  'SP-04',
  'SP-05',
  'SP-06',
  'SP-07',
  'SP-08',
  'SP-09',
  'SP-10',
  'SP-11',
] as const;

export type MobileBenchmarkSpId = (typeof MOBILE_BENCHMARK_SP_IDS)[number];

export const MOBILE_BENCHMARK_SP_COVERAGE_STATUSES = [
  'covered',
  'fixture_gap',
  'schema_gap',
  'not_applicable',
  'not_run',
] as const;

export type MobileBenchmarkSpCoverageStatus =
  (typeof MOBILE_BENCHMARK_SP_COVERAGE_STATUSES)[number];

export const MOBILE_BENCHMARK_RELEASE_INTEGRITY_MODES = [
  'development_placeholder',
  'official_sp08',
] as const;

export type MobileBenchmarkReleaseIntegrityMode =
  (typeof MOBILE_BENCHMARK_RELEASE_INTEGRITY_MODES)[number];

export const MOBILE_BENCHMARK_METRIC_CSV_COLUMNS = [
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
] as const;

export const MOBILE_BENCHMARK_OPERATION_CSV_COLUMNS = [
  'report_id',
  'scenario_id',
  'operation_id',
  'operation_kind',
  'status',
  'started_at',
  'duration_ms',
  'path_id',
  'path_status',
  'result_code',
  'error_code',
] as const;

export const MOBILE_BENCHMARK_ENVIRONMENT_CSV_COLUMNS = [
  'report_id',
  'field_path',
  'value_kind',
  'value',
  'source',
  'confidence',
  'declared_by',
  'unavailable_reason',
] as const;

export type MobileBenchmarkMetricCsvColumn =
  (typeof MOBILE_BENCHMARK_METRIC_CSV_COLUMNS)[number];
export type MobileBenchmarkOperationCsvColumn =
  (typeof MOBILE_BENCHMARK_OPERATION_CSV_COLUMNS)[number];
export type MobileBenchmarkEnvironmentCsvColumn =
  (typeof MOBILE_BENCHMARK_ENVIRONMENT_CSV_COLUMNS)[number];

export type MobileBenchmarkCsvValueKind = 'string' | 'number' | 'boolean' | 'null';
export type MobileBenchmarkMetricValue = string | number | boolean | null;

export interface MobileBenchmarkMetric {
  name: string;
  value: MobileBenchmarkMetricValue;
  unit: string;
  source: MobileBenchmarkMetricSource;
  confidence: MobileBenchmarkMetricConfidence;
  collectionMethod?: string;
  unavailableReason?: string;
}

export interface MobileBenchmarkSpCoverage {
  spId: MobileBenchmarkSpId;
  status: MobileBenchmarkSpCoverageStatus;
  packageVersion: string;
  packageHash: string;
  fixtureRef: string;
  notes?: string;
}

export interface MobileBenchmarkReportOperation {
  operationId: string;
  scenarioId: MobileBenchmarkScenarioId;
  operationKind: MobileElectionCryptoOperationKind;
  status: MobileBenchmarkScenarioStatus;
  startedAt: string;
  durationMs: number | null;
  resultCode: string;
  errorCode?: string;
  metrics: MobileBenchmarkMetric[];
  publicOutput?: Record<string, unknown>;
}

export interface MobileBenchmarkScenarioResult {
  scenarioId: MobileBenchmarkScenarioId;
  title: string;
  status: MobileBenchmarkScenarioStatus;
  implementationPath: MobileBenchmarkImplementationPathId;
  pathStatus: MobileBenchmarkPathStatus;
  operations: MobileBenchmarkReportOperation[];
  warnings: string[];
}

export interface MobileBenchmarkEnvironmentFact {
  fieldPath: string;
  value: MobileBenchmarkMetricValue;
  source: MobileBenchmarkMetricSource;
  confidence: MobileBenchmarkMetricConfidence;
  collectionMethod?: string;
  declaredBy?: MobileBenchmarkRole | 'tester';
  unavailableReason?: string;
}

export interface MobileBenchmarkMaturityGapStatus {
  externalReview: 'not_available' | 'planned' | 'available';
  operationalEvidence: 'not_referenced' | 'referenced_with_limitations';
  regulatoryTracking: 'not_referenced' | 'referenced_with_limitations';
  feat106Readiness: 'not_complete';
  legalValidation: 'not_available';
  certification: 'not_available';
  publicElectionParity: 'not_claimed';
}

export interface MobileBenchmarkReport {
  schemaVersion: typeof MOBILE_BENCHMARK_REPORT_SCHEMA_VERSION;
  reportId: string;
  generatedAt: string;
  benchmarkRole: MobileBenchmarkRole;
  implementationPath: MobileBenchmarkImplementationPathId;
  pathStatus: MobileBenchmarkPathStatus;
  deviceClass: string;
  benchmarkApp: {
    name: string;
    version: string;
    buildId: string;
    releaseIntegrityMode: MobileBenchmarkReleaseIntegrityMode;
    notForReleaseIntegrityClaims: boolean;
  };
  protocolPackage: {
    packageId: string;
    version: string;
    manifestHash: string;
    spCoverage: MobileBenchmarkSpCoverage[];
  };
  environment: MobileBenchmarkEnvironmentFact[];
  scenarios: MobileBenchmarkScenarioResult[];
  maturityGapStatus: MobileBenchmarkMaturityGapStatus;
  summary: {
    assurancePositioning: string;
    warnings: string[];
  };
}

export type MobileElectionCryptoOperationKind =
  | 'device_runtime_baseline'
  | 'commitment'
  | 'nullifier'
  | 'merkle_proof'
  | 'encryption'
  | 'witness_generation'
  | 'proof_generation'
  | 'proof_verification'
  | 'secure_storage_probe'
  | 'release_integrity_probe'
  | 'challenge_spoil_prepare'
  | 'challenge_spoil_verify'
  | 'challenge_spoil_receipt_verify'
  | 'eligibility_checkoff_boundary'
  | 'anonymous_artifact_boundary_check'
  | 'election_record_package_load'
  | 'standalone_verifier_replay'
  | 'publication_transcript_generation'
  | 'publication_transcript_verification'
  | 'release_integrity_manifest_check'
  | 'release_integrity_mismatch_check'
  | 'trustee_resilience_probe'
  | 'trustee_threshold_finalize'
  | 'trustee_missing_nonrequired_finalize'
  | 'trustee_below_threshold_fail_closed'
  | 'trustee_artifact_rejection';

export interface MobileElectionCryptoCapabilities {
  adapterId: string;
  implementationPath: MobileBenchmarkImplementationPathId;
  pathStatus: MobileBenchmarkPathStatus;
  supportedOperations: MobileElectionCryptoOperationKind[];
  unavailableReasons: Partial<Record<MobileElectionCryptoOperationKind, string>>;
  secureStorageAvailable: boolean;
  appIntegrityProbeAvailable: boolean;
  nativeCryptoAvailable: boolean;
}

export interface MobileElectionSensitiveInputHandle {
  handleId: string;
  materialKind:
    | 'vote_secret'
    | 'private_witness'
    | 'trustee_private_material'
    | 'raw_attestation_token';
}

export interface MobileElectionCommitmentInput {
  scenarioId: MobileBenchmarkScenarioId;
  fixtureRef: string;
  commitmentSeedHandle: MobileElectionSensitiveInputHandle;
}

export interface MobileElectionProofInput {
  scenarioId: MobileBenchmarkScenarioId;
  fixtureRef: string;
  statementId: string;
  witnessHandle: MobileElectionSensitiveInputHandle;
}

export interface MobileElectionVerificationInput {
  scenarioId: MobileBenchmarkScenarioId;
  fixtureRef: string;
  statementId: string;
  proofHash: string;
  publicInputsHash: string;
}

export interface MobileElectionSecureStorageProbeInput {
  scenarioId: MobileBenchmarkScenarioId;
  storageProfileId: string;
}

export interface MobileElectionCryptoOperationResult<TPublicOutput extends Record<string, unknown>> {
  operationId: string;
  operationKind: MobileElectionCryptoOperationKind;
  status: MobileBenchmarkScenarioStatus;
  startedAt: string;
  durationMs: number | null;
  resultCode: string;
  errorCode?: string;
  metrics: MobileBenchmarkMetric[];
  publicOutput: TPublicOutput;
}

export interface MobileElectionCrypto {
  discoverCapabilities(): Promise<MobileElectionCryptoCapabilities>;
  createCommitment(
    input: MobileElectionCommitmentInput
  ): Promise<MobileElectionCryptoOperationResult<Record<string, unknown>>>;
  generateProof(
    input: MobileElectionProofInput
  ): Promise<MobileElectionCryptoOperationResult<Record<string, unknown>>>;
  verifyProof(
    input: MobileElectionVerificationInput
  ): Promise<MobileElectionCryptoOperationResult<Record<string, unknown>>>;
  probeSecureStorage(
    input: MobileElectionSecureStorageProbeInput
  ): Promise<MobileElectionCryptoOperationResult<Record<string, unknown>>>;
}

export interface MobileBenchmarkMetricCsvRow {
  reportId: string;
  scenarioId: MobileBenchmarkScenarioId;
  operationId: string;
  metricName: string;
  value: MobileBenchmarkMetricValue;
  unit: string;
  source: MobileBenchmarkMetricSource;
  confidence: MobileBenchmarkMetricConfidence;
  unavailableReason?: string;
}

export interface MobileBenchmarkOperationCsvRow {
  reportId: string;
  scenarioId: MobileBenchmarkScenarioId;
  operationId: string;
  operationKind: MobileElectionCryptoOperationKind;
  status: MobileBenchmarkScenarioStatus;
  startedAt: string;
  durationMs: number | null;
  pathId: MobileBenchmarkImplementationPathId;
  pathStatus: MobileBenchmarkPathStatus;
  resultCode: string;
  errorCode?: string;
}

export interface MobileBenchmarkEnvironmentCsvRow {
  reportId: string;
  fieldPath: string;
  value: MobileBenchmarkMetricValue;
  source: MobileBenchmarkMetricSource;
  confidence: MobileBenchmarkMetricConfidence;
  declaredBy?: MobileBenchmarkRole | 'tester';
  unavailableReason?: string;
}

export interface MobileBenchmarkValidationIssue {
  path: string;
  code: string;
  message: string;
}

export function getCsvValueKind(value: MobileBenchmarkMetricValue): MobileBenchmarkCsvValueKind {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'number') {
    return 'number';
  }

  if (typeof value === 'boolean') {
    return 'boolean';
  }

  return 'string';
}

export function encodeCsvValue(value: MobileBenchmarkMetricValue): string {
  if (value === null) {
    return '';
  }

  return String(value);
}

export function decodeCsvValue(
  valueKind: MobileBenchmarkCsvValueKind,
  value: string
): MobileBenchmarkMetricValue {
  if (valueKind === 'null') {
    return null;
  }

  if (valueKind === 'number') {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error(`Invalid numeric CSV value: ${value}`);
    }
    return parsed;
  }

  if (valueKind === 'boolean') {
    return value === 'true';
  }

  return value;
}

export function parseMobileBenchmarkScenarioId(value: string): MobileBenchmarkScenarioId {
  if ((MOBILE_BENCHMARK_SCENARIO_IDS as readonly string[]).includes(value)) {
    return value as MobileBenchmarkScenarioId;
  }

  throw new Error(`Invalid mobile benchmark scenario id: ${value}`);
}

export function encodeMetricCsvRow(
  row: MobileBenchmarkMetricCsvRow
): Record<MobileBenchmarkMetricCsvColumn, string> {
  return {
    report_id: row.reportId,
    scenario_id: row.scenarioId,
    operation_id: row.operationId,
    metric_name: row.metricName,
    value_kind: getCsvValueKind(row.value),
    value: encodeCsvValue(row.value),
    unit: row.unit,
    source: row.source,
    confidence: row.confidence,
    unavailable_reason: row.unavailableReason ?? '',
  };
}

export function decodeMetricCsvRow(
  row: Record<MobileBenchmarkMetricCsvColumn, string>
): MobileBenchmarkMetricCsvRow {
  return {
    reportId: row.report_id,
    scenarioId: parseMobileBenchmarkScenarioId(row.scenario_id),
    operationId: row.operation_id,
    metricName: row.metric_name,
    value: decodeCsvValue(row.value_kind as MobileBenchmarkCsvValueKind, row.value),
    unit: row.unit,
    source: row.source as MobileBenchmarkMetricSource,
    confidence: row.confidence as MobileBenchmarkMetricConfidence,
    unavailableReason: row.unavailable_reason || undefined,
  };
}

export function encodeEnvironmentCsvRow(
  row: MobileBenchmarkEnvironmentCsvRow
): Record<MobileBenchmarkEnvironmentCsvColumn, string> {
  return {
    report_id: row.reportId,
    field_path: row.fieldPath,
    value_kind: getCsvValueKind(row.value),
    value: encodeCsvValue(row.value),
    source: row.source,
    confidence: row.confidence,
    declared_by: row.declaredBy ?? '',
    unavailable_reason: row.unavailableReason ?? '',
  };
}

export function decodeEnvironmentCsvRow(
  row: Record<MobileBenchmarkEnvironmentCsvColumn, string>
): MobileBenchmarkEnvironmentCsvRow {
  return {
    reportId: row.report_id,
    fieldPath: row.field_path,
    value: decodeCsvValue(row.value_kind as MobileBenchmarkCsvValueKind, row.value),
    source: row.source as MobileBenchmarkMetricSource,
    confidence: row.confidence as MobileBenchmarkMetricConfidence,
    declaredBy: (row.declared_by || undefined) as MobileBenchmarkEnvironmentCsvRow['declaredBy'],
    unavailableReason: row.unavailable_reason || undefined,
  };
}

export function toOperationCsvRows(report: MobileBenchmarkReport): MobileBenchmarkOperationCsvRow[] {
  return report.scenarios.flatMap((scenario) =>
    scenario.operations.map((operation) => ({
      reportId: report.reportId,
      scenarioId: scenario.scenarioId,
      operationId: operation.operationId,
      operationKind: operation.operationKind,
      status: operation.status,
      startedAt: operation.startedAt,
      durationMs: operation.durationMs,
      pathId: scenario.implementationPath,
      pathStatus: scenario.pathStatus,
      resultCode: operation.resultCode,
      errorCode: operation.errorCode,
    }))
  );
}

export function toMetricCsvRows(report: MobileBenchmarkReport): MobileBenchmarkMetricCsvRow[] {
  return report.scenarios.flatMap((scenario) =>
    scenario.operations.flatMap((operation) =>
      operation.metrics.map((metric) => ({
        reportId: report.reportId,
        scenarioId: scenario.scenarioId,
        operationId: operation.operationId,
        metricName: metric.name,
        value: metric.value,
        unit: metric.unit,
        source: metric.source,
        confidence: metric.confidence,
        unavailableReason: metric.unavailableReason,
      }))
    )
  );
}

export function toEnvironmentCsvRows(
  report: MobileBenchmarkReport
): MobileBenchmarkEnvironmentCsvRow[] {
  return report.environment.map((fact) => ({
    reportId: report.reportId,
    fieldPath: fact.fieldPath,
    value: fact.value,
    source: fact.source,
    confidence: fact.confidence,
    declaredBy: fact.declaredBy,
    unavailableReason: fact.unavailableReason,
  }));
}

export function createUnavailableMetric(
  name: string,
  unit: string,
  unavailableReason: string
): MobileBenchmarkMetric {
  return {
    name,
    value: null,
    unit,
    source: 'unavailable',
    confidence: 'unavailable',
    unavailableReason,
  };
}

export function validateMobileBenchmarkReportShape(
  report: MobileBenchmarkReport
): MobileBenchmarkValidationIssue[] {
  const issues: MobileBenchmarkValidationIssue[] = [];

  if (report.schemaVersion !== MOBILE_BENCHMARK_REPORT_SCHEMA_VERSION) {
    issues.push({
      path: 'schemaVersion',
      code: 'invalid_schema_version',
      message: 'Mobile benchmark reports must use the v1 schema version.',
    });
  }

  if (!MOBILE_BENCHMARK_ROLES.includes(report.benchmarkRole)) {
    issues.push({
      path: 'benchmarkRole',
      code: 'invalid_benchmark_role',
      message: 'Benchmark role is not part of the locked FEAT-121 role set.',
    });
  }

  if (!MOBILE_BENCHMARK_IMPLEMENTATION_PATHS.includes(report.implementationPath)) {
    issues.push({
      path: 'implementationPath',
      code: 'invalid_implementation_path',
      message: 'Implementation path is not part of the locked FEAT-121 path set.',
    });
  }

  if (
    report.benchmarkApp.releaseIntegrityMode === 'development_placeholder' &&
    !report.benchmarkApp.notForReleaseIntegrityClaims
  ) {
    issues.push({
      path: 'benchmarkApp.notForReleaseIntegrityClaims',
      code: 'placeholder_release_claim_not_blocked',
      message: 'Development placeholder reports must remain blocked for release-integrity claims.',
    });
  }

  for (const [index, scenario] of report.scenarios.entries()) {
    if (!MOBILE_BENCHMARK_SCENARIO_STATUSES.includes(scenario.status)) {
      issues.push({
        path: `scenarios.${index}.status`,
        code: 'invalid_scenario_status',
        message: 'Scenario status is not part of the locked FEAT-121 status set.',
      });
    }

    if (scenario.pathStatus === 'not_available' && scenario.status === 'failed') {
      issues.push({
        path: `scenarios.${index}.status`,
        code: 'unavailable_path_counted_as_failure',
        message: 'Unavailable native paths must be reported as not_available, not as failures.',
      });
    }
  }

  return issues;
}
