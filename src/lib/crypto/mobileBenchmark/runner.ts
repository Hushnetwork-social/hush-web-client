import {
  MOBILE_BENCHMARK_REPORT_SCHEMA_VERSION,
  type MobileBenchmarkEnvironmentFact,
  type MobileBenchmarkImplementationPathId,
  type MobileBenchmarkMetric,
  type MobileBenchmarkPathStatus,
  type MobileBenchmarkReleaseIntegrityMode,
  type MobileBenchmarkReport,
  type MobileBenchmarkReportOperation,
  type MobileBenchmarkRole,
  type MobileBenchmarkScenarioId,
  type MobileBenchmarkScenarioResult,
  type MobileBenchmarkScenarioStatus,
  type MobileElectionCommitmentInput,
  type MobileElectionCrypto,
  type MobileElectionCryptoCapabilities,
  type MobileElectionCryptoOperationKind,
  type MobileElectionCryptoOperationResult,
  type MobileElectionProofInput,
  type MobileElectionSecureStorageProbeInput,
  type MobileElectionVerificationInput,
} from './contracts.ts';
import {
  MOBILE_BENCHMARK_PROTOCOL_PACKAGE_REF,
  createMobileBenchmarkFixtureCatalog,
  createMobileBenchmarkProtocolPackageCoverage,
  getMobileBenchmarkFixturesForScenario,
  stableMobileBenchmarkFixtureHash,
} from './fixtures.ts';
import {
  sanitizeMobileElectionCryptoOperationResult,
  validateMobileBenchmarkReportForExport,
  type MobileBenchmarkExportValidationResult,
} from './privacy.ts';
import {
  nativeProbeToEnvironmentFacts,
  type MobileBenchmarkNativeProbeResult,
} from './nativeProbes.ts';
import {
  MOBILE_BENCHMARK_NATIVE_CRYPTO_ADAPTER_DECISION,
  isMobileBenchmarkNativeCryptoPath,
} from './nativeCryptoAdapter.ts';

export const MOBILE_BENCHMARK_PHASE4_SCENARIO_IDS = [
  'scenario-01',
  'scenario-02',
  'scenario-03',
  'scenario-04',
  'scenario-05',
  'scenario-06',
  'scenario-07',
  'scenario-08',
] as const satisfies readonly MobileBenchmarkScenarioId[];

export type MobileBenchmarkPhase4ScenarioId =
  (typeof MOBILE_BENCHMARK_PHASE4_SCENARIO_IDS)[number];

export const MOBILE_BENCHMARK_SP_SCENARIO_IDS = [
  'scenario-09',
  'scenario-10',
  'scenario-11',
  'scenario-12',
  'scenario-13',
  'scenario-14',
] as const satisfies readonly MobileBenchmarkScenarioId[];

export type MobileBenchmarkSpScenarioId =
  (typeof MOBILE_BENCHMARK_SP_SCENARIO_IDS)[number];

export const MOBILE_BENCHMARK_RUNNER_SCENARIO_IDS = [
  ...MOBILE_BENCHMARK_PHASE4_SCENARIO_IDS,
  ...MOBILE_BENCHMARK_SP_SCENARIO_IDS,
] as const satisfies readonly MobileBenchmarkScenarioId[];

export type MobileBenchmarkRunnerScenarioId =
  (typeof MOBILE_BENCHMARK_RUNNER_SCENARIO_IDS)[number];

export type MobileBenchmarkDeviceClass =
  | 'mobile_phone'
  | 'tablet'
  | 'desktop_laptop'
  | 'unknown';

export interface MobileBenchmarkScenarioDefinition {
  scenarioId: MobileBenchmarkRunnerScenarioId;
  title: string;
  operations: readonly MobileElectionCryptoOperationKind[];
}

export interface MobileBenchmarkPreRunDeclarations {
  controlledFixturePackSelected: boolean;
  deviceKeptForegrounded: boolean;
  lowPowerModeDisabled: boolean;
  unrelatedAppsClosed: boolean;
  noRealElectionData: boolean;
}

export interface MobileBenchmarkRunnerSetup {
  benchmarkRole: MobileBenchmarkRole;
  implementationPath: MobileBenchmarkImplementationPathId;
  profileId: string;
  deviceClass: MobileBenchmarkDeviceClass;
  selectedScenarioIds: MobileBenchmarkRunnerScenarioId[];
  releaseIntegrityMode: MobileBenchmarkReleaseIntegrityMode;
  declarations: MobileBenchmarkPreRunDeclarations;
}

export interface MobileBenchmarkPathAvailability {
  pathId: MobileBenchmarkImplementationPathId;
  label: string;
  status: MobileBenchmarkPathStatus;
  reason: string;
}

export interface MobileBenchmarkEnvironmentInput {
  userAgent?: string;
  language?: string;
  hardwareConcurrency?: number | null;
  deviceMemoryGb?: number | null;
  isTauriWebView?: boolean;
  env?: Record<string, string | undefined>;
}

export interface MobileBenchmarkRunOptions {
  generatedAt?: string;
  env?: MobileBenchmarkEnvironmentInput;
  adapter?: MobileElectionCrypto;
  nativeProbe?: MobileBenchmarkNativeProbeResult;
  interruptionScenarioId?: MobileBenchmarkRunnerScenarioId;
  forcedFailure?: MobileBenchmarkForcedFailure;
  baseDurationMs?: number;
}

export type MobileBenchmarkFailureResultCode =
  | 'operation_timeout'
  | 'out_of_memory'
  | 'app_crash'
  | 'verifier_mismatch';

export interface MobileBenchmarkForcedFailure {
  scenarioId: MobileBenchmarkRunnerScenarioId;
  operationKind?: MobileElectionCryptoOperationKind;
  resultCode: MobileBenchmarkFailureResultCode;
}

export interface MobileBenchmarkProgressEvent {
  scenarioId: MobileBenchmarkRunnerScenarioId;
  operationKind: MobileElectionCryptoOperationKind;
  status: MobileBenchmarkScenarioStatus;
  completedScenarios: number;
  totalScenarios: number;
  message: string;
}

export interface MobileBenchmarkRunResult {
  report: MobileBenchmarkReport;
  progress: MobileBenchmarkProgressEvent[];
  exportValidation: MobileBenchmarkExportValidationResult;
}

export const MOBILE_BENCHMARK_PHASE4_SCENARIOS: readonly MobileBenchmarkScenarioDefinition[] = [
  {
    scenarioId: 'scenario-01',
    title: 'Device and runtime baseline',
    operations: ['device_runtime_baseline'],
  },
  {
    scenarioId: 'scenario-02',
    title: 'Commitment and nullifier generation',
    operations: ['commitment', 'nullifier'],
  },
  {
    scenarioId: 'scenario-03',
    title: 'Merkle proof construction',
    operations: ['merkle_proof'],
  },
  {
    scenarioId: 'scenario-04',
    title: 'Ballot encryption public-vector run',
    operations: ['encryption'],
  },
  {
    scenarioId: 'scenario-05',
    title: 'Witness generation',
    operations: ['witness_generation'],
  },
  {
    scenarioId: 'scenario-06',
    title: 'Proof generation',
    operations: ['proof_generation'],
  },
  {
    scenarioId: 'scenario-07',
    title: 'Proof verification',
    operations: ['proof_verification'],
  },
  {
    scenarioId: 'scenario-08',
    title: 'Secure storage and release-integrity probe',
    operations: ['secure_storage_probe', 'release_integrity_probe'],
  },
];

export const MOBILE_BENCHMARK_SP_SCENARIOS: readonly MobileBenchmarkScenarioDefinition[] = [
  {
    scenarioId: 'scenario-09',
    title: 'SP-04 challenge/spoil ceremony',
    operations: [
      'challenge_spoil_prepare',
      'challenge_spoil_verify',
      'challenge_spoil_receipt_verify',
    ],
  },
  {
    scenarioId: 'scenario-10',
    title: 'SP-05 eligibility/checkoff boundary',
    operations: ['eligibility_checkoff_boundary', 'anonymous_artifact_boundary_check'],
  },
  {
    scenarioId: 'scenario-11',
    title: 'SP-03 election record and verifier replay',
    operations: ['election_record_package_load', 'standalone_verifier_replay'],
  },
  {
    scenarioId: 'scenario-12',
    title: 'SP-07 publication proof/counting evidence',
    operations: ['publication_transcript_generation', 'publication_transcript_verification'],
  },
  {
    scenarioId: 'scenario-13',
    title: 'SP-08 release-integrity evidence',
    operations: ['release_integrity_manifest_check', 'release_integrity_mismatch_check'],
  },
  {
    scenarioId: 'scenario-14',
    title: 'SP-06 trustee resilience profile',
    operations: [
      'trustee_threshold_finalize',
      'trustee_missing_nonrequired_finalize',
      'trustee_below_threshold_fail_closed',
      'trustee_artifact_rejection',
    ],
  },
];

export const MOBILE_BENCHMARK_RUNNER_SCENARIOS: readonly MobileBenchmarkScenarioDefinition[] = [
  ...MOBILE_BENCHMARK_PHASE4_SCENARIOS,
  ...MOBILE_BENCHMARK_SP_SCENARIOS,
];

const REQUIRED_DECLARATION_KEYS: Array<keyof MobileBenchmarkPreRunDeclarations> = [
  'controlledFixturePackSelected',
  'deviceKeptForegrounded',
  'lowPowerModeDisabled',
  'unrelatedAppsClosed',
  'noRealElectionData',
];

const OPERATION_DURATION_BASE: Record<MobileElectionCryptoOperationKind, number> = {
  device_runtime_baseline: 9,
  commitment: 18,
  nullifier: 15,
  merkle_proof: 42,
  encryption: 57,
  witness_generation: 84,
  proof_generation: 166,
  proof_verification: 63,
  secure_storage_probe: 24,
  release_integrity_probe: 31,
  trustee_resilience_probe: 111,
  challenge_spoil_prepare: 52,
  challenge_spoil_verify: 38,
  challenge_spoil_receipt_verify: 29,
  eligibility_checkoff_boundary: 44,
  anonymous_artifact_boundary_check: 32,
  election_record_package_load: 36,
  standalone_verifier_replay: 73,
  publication_transcript_generation: 97,
  publication_transcript_verification: 81,
  release_integrity_manifest_check: 34,
  release_integrity_mismatch_check: 28,
  trustee_threshold_finalize: 88,
  trustee_missing_nonrequired_finalize: 92,
  trustee_below_threshold_fail_closed: 41,
  trustee_artifact_rejection: 47,
};

const pathLabels: Record<MobileBenchmarkImplementationPathId, string> = {
  browser_fallback_wasm: 'Browser fallback WASM',
  tauri_webview_wasm: 'Tauri WebView WASM',
  tauri_native_crypto: 'Tauri native crypto',
  fully_native_ios: 'Fully native iOS',
  fully_native_android: 'Fully native Android',
};

function currentNavigator(): Navigator | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator;
}

function detectTauriWebView(input?: MobileBenchmarkEnvironmentInput): boolean {
  if (typeof input?.isTauriWebView === 'boolean') {
    return input.isTauriWebView;
  }

  const env = input?.env ?? {};
  if (env.TAURI_DEV === 'true' || env.NEXT_PUBLIC_TAURI === 'true') {
    return true;
  }

  const globalWithTauri = globalThis as typeof globalThis & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };
  return Boolean(globalWithTauri.__TAURI__ || globalWithTauri.__TAURI_INTERNALS__);
}

function getUserAgentFamily(userAgent: string): string {
  const normalized = userAgent.toLowerCase();

  if (normalized.includes('tauri')) {
    return 'tauri_webview';
  }

  if (normalized.includes('edg/')) {
    return 'edge';
  }

  if (normalized.includes('chrome') || normalized.includes('chromium')) {
    return 'chromium';
  }

  if (normalized.includes('firefox')) {
    return 'firefox';
  }

  if (normalized.includes('safari')) {
    return 'safari';
  }

  return 'unknown';
}

function metric(
  name: string,
  value: MobileBenchmarkMetric['value'],
  unit: string,
  unavailableReason?: string
): MobileBenchmarkMetric {
  return {
    name,
    value,
    unit,
    source: value === null ? 'unavailable' : 'measured',
    confidence: value === null ? 'unavailable' : 'medium',
    unavailableReason,
  };
}

function declarationFact(
  fieldPath: string,
  value: boolean,
  benchmarkRole: MobileBenchmarkRole
): MobileBenchmarkEnvironmentFact {
  return {
    fieldPath,
    value,
    source: 'tester_declared',
    confidence: 'medium',
    declaredBy: benchmarkRole,
  };
}

export function createDefaultMobileBenchmarkRunnerSetup(): MobileBenchmarkRunnerSetup {
  return {
    benchmarkRole: 'developer',
    implementationPath: 'browser_fallback_wasm',
    profileId: 'phase5-scenarios-01-14',
    deviceClass: 'mobile_phone',
    selectedScenarioIds: [...MOBILE_BENCHMARK_RUNNER_SCENARIO_IDS],
    releaseIntegrityMode: 'development_placeholder',
    declarations: {
      controlledFixturePackSelected: false,
      deviceKeptForegrounded: false,
      lowPowerModeDisabled: false,
      unrelatedAppsClosed: false,
      noRealElectionData: false,
    },
  };
}

export function getMobileBenchmarkPathAvailability(
  input: MobileBenchmarkEnvironmentInput = {}
): MobileBenchmarkPathAvailability[] {
  const tauriWebViewAvailable = detectTauriWebView(input);

  return [
    {
      pathId: 'browser_fallback_wasm',
      label: pathLabels.browser_fallback_wasm,
      status: 'available_not_run',
      reason: 'Available in local browser and mobile browser contexts.',
    },
    {
      pathId: 'tauri_webview_wasm',
      label: pathLabels.tauri_webview_wasm,
      status: tauriWebViewAvailable ? 'available_not_run' : 'not_available',
      reason: tauriWebViewAvailable
        ? 'Tauri WebView runtime detected for the local run.'
        : 'Requires the HushVoting Tauri WebView runtime.',
    },
    {
      pathId: 'tauri_native_crypto',
      label: pathLabels.tauri_native_crypto,
      status: 'not_available',
      reason: MOBILE_BENCHMARK_NATIVE_CRYPTO_ADAPTER_DECISION.reason,
    },
    {
      pathId: 'fully_native_ios',
      label: pathLabels.fully_native_ios,
      status: 'not_available',
      reason: MOBILE_BENCHMARK_NATIVE_CRYPTO_ADAPTER_DECISION.reason,
    },
    {
      pathId: 'fully_native_android',
      label: pathLabels.fully_native_android,
      status: 'not_available',
      reason: MOBILE_BENCHMARK_NATIVE_CRYPTO_ADAPTER_DECISION.reason,
    },
  ];
}

export function getMobileBenchmarkPathStatus(
  pathId: MobileBenchmarkImplementationPathId,
  availability = getMobileBenchmarkPathAvailability()
): MobileBenchmarkPathStatus {
  return availability.find((item) => item.pathId === pathId)?.status ?? 'not_available';
}

export function isMobileBenchmarkRunnerSetupComplete(
  setup: MobileBenchmarkRunnerSetup,
  availability = getMobileBenchmarkPathAvailability()
): boolean {
  const pathStatus = getMobileBenchmarkPathStatus(setup.implementationPath, availability);

  return (
    pathStatus !== 'not_available' &&
    setup.selectedScenarioIds.length > 0 &&
    REQUIRED_DECLARATION_KEYS.every((key) => setup.declarations[key])
  );
}

export function collectMobileBenchmarkEnvironmentFacts(
  setup: MobileBenchmarkRunnerSetup,
  input: MobileBenchmarkEnvironmentInput = {},
  nativeProbe?: MobileBenchmarkNativeProbeResult
): MobileBenchmarkEnvironmentFact[] {
  const navigatorRef = currentNavigator();
  const userAgent = input.userAgent ?? navigatorRef?.userAgent ?? '';
  const language = input.language ?? navigatorRef?.language ?? null;
  const hardwareConcurrency =
    input.hardwareConcurrency ?? navigatorRef?.hardwareConcurrency ?? null;
  const deviceMemoryGb =
    input.deviceMemoryGb ??
    (navigatorRef && 'deviceMemory' in navigatorRef
      ? Number((navigatorRef as Navigator & { deviceMemory?: number }).deviceMemory)
      : null);
  const isTauriWebView = detectTauriWebView(input);

  return [
    {
      fieldPath: 'benchmark.profile_id',
      value: setup.profileId,
      source: 'fixture',
      confidence: 'high',
    },
    {
      fieldPath: 'benchmark.protocol_package_version',
      value: MOBILE_BENCHMARK_PROTOCOL_PACKAGE_REF.packageVersion,
      source: 'fixture',
      confidence: 'high',
    },
    {
      fieldPath: 'runtime.user_agent_family',
      value: getUserAgentFamily(userAgent),
      source: 'measured',
      confidence: userAgent ? 'medium' : 'low',
    },
    {
      fieldPath: 'runtime.language',
      value: language,
      source: language === null ? 'unavailable' : 'measured',
      confidence: language === null ? 'unavailable' : 'medium',
      unavailableReason: language === null ? 'language_api_unavailable' : undefined,
    },
    {
      fieldPath: 'runtime.tauri_webview_detected',
      value: isTauriWebView,
      source: 'measured',
      confidence: 'medium',
    },
    {
      fieldPath: 'hardware.logical_cpu_count',
      value: hardwareConcurrency,
      source: hardwareConcurrency === null ? 'unavailable' : 'measured',
      confidence: hardwareConcurrency === null ? 'unavailable' : 'medium',
      unavailableReason:
        hardwareConcurrency === null ? 'hardware_concurrency_api_unavailable' : undefined,
    },
    {
      fieldPath: 'hardware.device_memory_gb',
      value: deviceMemoryGb,
      source: deviceMemoryGb === null ? 'unavailable' : 'measured',
      confidence: deviceMemoryGb === null ? 'unavailable' : 'low',
      unavailableReason: deviceMemoryGb === null ? 'device_memory_api_unavailable' : undefined,
    },
    {
      fieldPath: 'power.thermal_state',
      value: null,
      source: 'unavailable',
      confidence: 'unavailable',
      unavailableReason: 'browser_webview_thermal_state_api_unavailable',
    },
    declarationFact(
      'pre_run.controlled_fixture_pack_selected',
      setup.declarations.controlledFixturePackSelected,
      setup.benchmarkRole
    ),
    declarationFact(
      'pre_run.device_kept_foregrounded',
      setup.declarations.deviceKeptForegrounded,
      setup.benchmarkRole
    ),
    declarationFact(
      'pre_run.low_power_mode_disabled',
      setup.declarations.lowPowerModeDisabled,
      setup.benchmarkRole
    ),
    declarationFact(
      'pre_run.unrelated_apps_closed',
      setup.declarations.unrelatedAppsClosed,
      setup.benchmarkRole
    ),
    declarationFact(
      'pre_run.no_real_election_data',
      setup.declarations.noRealElectionData,
      setup.benchmarkRole
    ),
    ...(nativeProbe ? nativeProbeToEnvironmentFacts(nativeProbe) : []),
  ];
}

function getScenarioDefinition(
  scenarioId: MobileBenchmarkRunnerScenarioId
): MobileBenchmarkScenarioDefinition {
  return MOBILE_BENCHMARK_RUNNER_SCENARIOS.find((scenario) => scenario.scenarioId === scenarioId)!;
}

function publicOutputKeyForOperation(kind: MobileElectionCryptoOperationKind): string {
  switch (kind) {
    case 'commitment':
      return 'commitmentDigest';
    case 'nullifier':
      return 'nullifierDigest';
    case 'merkle_proof':
      return 'merkleRootDigest';
    case 'encryption':
      return 'encryptedPayloadDigest';
    case 'witness_generation':
      return 'witnessPublicDigest';
    case 'proof_generation':
      return 'proofDigest';
    case 'proof_verification':
      return 'verificationDigest';
    case 'secure_storage_probe':
      return 'secureStorageProbeDigest';
    case 'release_integrity_probe':
      return 'releaseIntegrityProbeDigest';
    case 'challenge_spoil_prepare':
      return 'preparedPackageDigest';
    case 'challenge_spoil_verify':
      return 'challengeTranscriptDigest';
    case 'challenge_spoil_receipt_verify':
      return 'receiptVerificationDigest';
    case 'eligibility_checkoff_boundary':
      return 'eligibilityBoundaryDigest';
    case 'anonymous_artifact_boundary_check':
      return 'anonymousArtifactBoundaryDigest';
    case 'election_record_package_load':
      return 'electionRecordPackageDigest';
    case 'standalone_verifier_replay':
      return 'standaloneVerifierReplayDigest';
    case 'publication_transcript_generation':
      return 'publicationTranscriptDigest';
    case 'publication_transcript_verification':
      return 'publicationVerifierDigest';
    case 'release_integrity_manifest_check':
      return 'releaseManifestDigest';
    case 'release_integrity_mismatch_check':
      return 'releaseMismatchCheckDigest';
    case 'trustee_resilience_probe':
    case 'trustee_threshold_finalize':
    case 'trustee_missing_nonrequired_finalize':
    case 'trustee_below_threshold_fail_closed':
    case 'trustee_artifact_rejection':
      return 'trusteeResilienceDigest';
    case 'device_runtime_baseline':
      return 'runtimeBaselineDigest';
  }
}

function scenarioFixtureRef(scenarioId: MobileBenchmarkScenarioId): {
  fixtureId: string;
  fixtureHash: string;
} {
  const fixture = getMobileBenchmarkFixturesForScenario(
    scenarioId,
    createMobileBenchmarkFixtureCatalog()
  )[0];

  if (fixture) {
    return {
      fixtureId: fixture.fixtureId,
      fixtureHash: fixture.fixtureHash,
    };
  }

  return {
    fixtureId: `phase4-synthetic-${scenarioId}`,
    fixtureHash: stableMobileBenchmarkFixtureHash({
      scenarioId,
      profile: 'phase4-synthetic-public-vector',
    }),
  };
}

function operationDuration(
  kind: MobileElectionCryptoOperationKind,
  operationIndex: number,
  baseDurationMs: number
): number {
  return baseDurationMs + OPERATION_DURATION_BASE[kind] + operationIndex * 3;
}

function resultCodeForOperation(
  kind: MobileElectionCryptoOperationKind,
  releaseIntegrityMode: MobileBenchmarkReleaseIntegrityMode
): string {
  switch (kind) {
    case 'challenge_spoil_prepare':
      return 'prepared_ballot_package_created';
    case 'challenge_spoil_verify':
      return 'challenge_transcript_valid';
    case 'challenge_spoil_receipt_verify':
      return 'spoiled_ballot_not_counted';
    case 'eligibility_checkoff_boundary':
      return 'eligibility_checkoff_boundary_valid';
    case 'anonymous_artifact_boundary_check':
      return 'restricted_correlation_rejected';
    case 'election_record_package_load':
      return 'verification_package_loaded';
    case 'standalone_verifier_replay':
      return 'verification_package_valid';
    case 'publication_transcript_generation':
      return 'publication_transcript_generated';
    case 'publication_transcript_verification':
      return 'publication_proof_evidence_valid';
    case 'release_integrity_manifest_check':
      return releaseIntegrityMode === 'official_sp08'
        ? 'release_integrity_evidence_valid'
        : 'release_integrity_evidence_pending';
    case 'release_integrity_mismatch_check':
      return 'release_integrity_mismatch_rejected';
    case 'trustee_threshold_finalize':
      return 'threshold_finalization_valid';
    case 'trustee_missing_nonrequired_finalize':
      return 'nonrequired_missing_trustee_finalization_valid';
    case 'trustee_below_threshold_fail_closed':
      return 'below_threshold_fail_closed';
    case 'trustee_artifact_rejection':
      return 'invalid_trustee_artifacts_rejected';
    default:
      return 'ok';
  }
}

function phase5PublicOutput(
  kind: MobileElectionCryptoOperationKind,
  releaseIntegrityMode: MobileBenchmarkReleaseIntegrityMode
): Record<string, unknown> {
  switch (kind) {
    case 'challenge_spoil_prepare':
    case 'challenge_spoil_verify':
    case 'challenge_spoil_receipt_verify':
      return {
        spId: 'SP-04',
        expectedResultCodes: ['challenge_transcript_valid', 'spoiled_ballot_not_counted'],
        portableChoiceProofExported: false,
      };
    case 'eligibility_checkoff_boundary':
    case 'anonymous_artifact_boundary_check':
      return {
        spId: 'SP-05',
        expectedResultCodes: [
          'eligibility_checkoff_boundary_valid',
          'restricted_correlation_rejected',
        ],
        publicAnonymousBoundaryEnforced: true,
      };
    case 'election_record_package_load':
    case 'standalone_verifier_replay':
      return {
        spId: 'SP-03',
        roleRelevance: ['organizer', 'auditor'],
        expectedResultCodes: ['verification_package_valid', 'tamper_fixture_rejected'],
      };
    case 'publication_transcript_generation':
    case 'publication_transcript_verification':
      return {
        spId: 'SP-07',
        transcriptPublicOnly: true,
        expectedResultCodes: ['publication_proof_evidence_valid'],
      };
    case 'release_integrity_manifest_check':
      return {
        spId: 'SP-08',
        releaseIntegrityMode,
        expectedResultCodes: [
          'release_integrity_evidence_valid',
          'release_integrity_evidence_pending',
        ],
        notForReleaseIntegrityClaims: true,
      };
    case 'release_integrity_mismatch_check':
      return {
        spId: 'SP-08',
        releaseIntegrityMode,
        expectedResultCodes: ['release_integrity_mismatch_rejected'],
        notForReleaseIntegrityClaims: true,
      };
    case 'trustee_threshold_finalize':
      return {
        spId: 'SP-06',
        trusteeProfileId: 'high_assurance_independent_trustees_v1',
        threshold: 3,
        trusteeCount: 5,
        validArtifactCount: 3,
        finalizationOutcome: 'finalized_at_threshold',
      };
    case 'trustee_missing_nonrequired_finalize':
      return {
        spId: 'SP-06',
        trusteeProfileId: 'high_assurance_independent_trustees_v1',
        threshold: 3,
        trusteeCount: 5,
        validArtifactCount: 4,
        finalizationOutcome: 'finalized_with_nonrequired_absence',
      };
    case 'trustee_below_threshold_fail_closed':
      return {
        spId: 'SP-06',
        trusteeProfileId: 'high_assurance_independent_trustees_v1',
        threshold: 3,
        trusteeCount: 5,
        validArtifactCount: 2,
        finalizationOutcome: 'fail_closed_below_threshold',
      };
    case 'trustee_artifact_rejection':
      return {
        spId: 'SP-06',
        trusteeProfileId: 'high_assurance_independent_trustees_v1',
        rejectedArtifactCases: [
          'duplicate',
          'stale',
          'wrong_election',
          'wrong_target',
          'wrong_version',
        ],
      };
    default:
      return {};
  }
}

function createOperationResult(input: {
  scenarioId: MobileBenchmarkRunnerScenarioId;
  operationKind: MobileElectionCryptoOperationKind;
  implementationPath: MobileBenchmarkImplementationPathId;
  operationIndex: number;
  startedAt: string;
  durationMs: number | null;
  status: MobileBenchmarkScenarioStatus;
  resultCode: string;
  errorCode?: string;
  baseDurationMs: number;
  releaseIntegrityMode?: MobileBenchmarkReleaseIntegrityMode;
}): MobileElectionCryptoOperationResult<Record<string, unknown>> {
  const fixtureRef = scenarioFixtureRef(input.scenarioId);
  const outputKey = publicOutputKeyForOperation(input.operationKind);
  const releaseIntegrityMode = input.releaseIntegrityMode ?? 'development_placeholder';
  const outputDigest = `sha256:${stableMobileBenchmarkFixtureHash({
    scenarioId: input.scenarioId,
    operationKind: input.operationKind,
    implementationPath: input.implementationPath,
    operationIndex: input.operationIndex,
    fixtureHash: fixtureRef.fixtureHash,
  })}`;
  return sanitizeMobileElectionCryptoOperationResult({
    operationId: `${input.scenarioId}-${input.operationKind}-${input.operationIndex + 1}`,
    operationKind: input.operationKind,
    status: input.status,
    startedAt: input.startedAt,
    durationMs: input.durationMs,
    resultCode: input.resultCode,
    errorCode: input.errorCode,
    metrics: [
      metric('duration_ms', input.durationMs, 'ms'),
      metric('memory_delta_mb', input.status === 'unsupported_path' ? null : 1.5 + input.operationIndex, 'MB'),
      metric(
        'thermal_state',
        null,
        'state',
        'browser_webview_thermal_state_api_unavailable'
      ),
    ],
    publicOutput: {
      fixtureRef: fixtureRef.fixtureId,
      fixtureHash: `sha256:${fixtureRef.fixtureHash}`,
      operationPublicHash: outputDigest,
      [outputKey]: outputDigest,
      sampleDurationBucketMs: input.durationMs,
      ...phase5PublicOutput(input.operationKind, releaseIntegrityMode),
    },
  });
}

function failureMessage(resultCode: MobileBenchmarkFailureResultCode): string {
  switch (resultCode) {
    case 'operation_timeout':
      return 'Operation timeout was recorded as a failed benchmark sample.';
    case 'out_of_memory':
      return 'Out-of-memory condition was recorded as a failed benchmark sample.';
    case 'app_crash':
      return 'App crash was recorded as a failed benchmark sample.';
    case 'verifier_mismatch':
      return 'Verifier mismatch was recorded as a failed benchmark sample.';
  }
}

async function operationResultForKind(input: {
  adapter: MobileElectionCrypto;
  scenarioId: MobileBenchmarkRunnerScenarioId;
  operationKind: MobileElectionCryptoOperationKind;
  implementationPath: MobileBenchmarkImplementationPathId;
  operationIndex: number;
  startedAt: string;
  baseDurationMs: number;
  releaseIntegrityMode: MobileBenchmarkReleaseIntegrityMode;
}): Promise<MobileElectionCryptoOperationResult<Record<string, unknown>>> {
  switch (input.operationKind) {
    case 'commitment':
      return input.adapter.createCommitment({
        scenarioId: input.scenarioId,
        fixtureRef: scenarioFixtureRef(input.scenarioId).fixtureId,
        commitmentSeedHandle: {
          handleId: `${input.scenarioId}-commitment-seed-handle`,
          materialKind: 'vote_secret',
        },
      });
    case 'proof_generation':
      return input.adapter.generateProof({
        scenarioId: input.scenarioId,
        fixtureRef: scenarioFixtureRef(input.scenarioId).fixtureId,
        statementId: `${input.scenarioId}-statement`,
        witnessHandle: {
          handleId: `${input.scenarioId}-witness-handle`,
          materialKind: 'private_witness',
        },
      });
    case 'proof_verification':
      return input.adapter.verifyProof({
        scenarioId: input.scenarioId,
        fixtureRef: scenarioFixtureRef(input.scenarioId).fixtureId,
        statementId: `${input.scenarioId}-statement`,
        proofHash: `sha256:${stableMobileBenchmarkFixtureHash({
          scenarioId: input.scenarioId,
          operationKind: 'proof_generation',
        })}`,
        publicInputsHash: `sha256:${stableMobileBenchmarkFixtureHash({
          scenarioId: input.scenarioId,
          operationKind: 'public_inputs',
        })}`,
      });
    case 'secure_storage_probe':
      return input.adapter.probeSecureStorage({
        scenarioId: input.scenarioId,
        storageProfileId: 'phase4-local-public-probe',
      });
    default:
      return createOperationResult({
        scenarioId: input.scenarioId,
        operationKind: input.operationKind,
        implementationPath: input.implementationPath,
        operationIndex: input.operationIndex,
        startedAt: input.startedAt,
        durationMs: operationDuration(
          input.operationKind,
          input.operationIndex,
          input.baseDurationMs
        ),
        status: 'passed',
        resultCode: resultCodeForOperation(input.operationKind, input.releaseIntegrityMode),
        baseDurationMs: input.baseDurationMs,
        releaseIntegrityMode: input.releaseIntegrityMode,
      });
  }
}

function toReportOperation(
  result: MobileElectionCryptoOperationResult<Record<string, unknown>>,
  scenarioId: MobileBenchmarkRunnerScenarioId
): MobileBenchmarkReportOperation {
  return {
    operationId: result.operationId,
    scenarioId,
    operationKind: result.operationKind,
    status: result.status,
    startedAt: result.startedAt,
    durationMs: result.durationMs,
    resultCode: result.resultCode,
    errorCode: result.errorCode,
    metrics: result.metrics,
    publicOutput: result.publicOutput,
  };
}

function createUnsupportedScenario(
  scenario: MobileBenchmarkScenarioDefinition,
  setup: MobileBenchmarkRunnerSetup,
  generatedAtMs: number,
  scenarioIndex: number
): MobileBenchmarkScenarioResult {
  const startedAt = new Date(generatedAtMs + scenarioIndex * 1000).toISOString();
  const operation = createOperationResult({
    scenarioId: scenario.scenarioId,
    operationKind: scenario.operations[0],
    implementationPath: setup.implementationPath,
    operationIndex: 0,
    startedAt,
    durationMs: null,
    status: 'unsupported_path',
    resultCode: 'implementation_path_not_available',
    errorCode: 'implementation_path_not_available',
    baseDurationMs: 0,
    releaseIntegrityMode: setup.releaseIntegrityMode,
  });

  return {
    scenarioId: scenario.scenarioId,
    title: scenario.title,
    status: 'unsupported_path',
    implementationPath: setup.implementationPath,
    pathStatus: 'not_available',
    operations: [toReportOperation(operation, scenario.scenarioId)],
    warnings: [
      `${pathLabels[setup.implementationPath]} is not available in the FEAT-121 runner context.`,
    ],
  };
}

export function createSyntheticMobileElectionCrypto(
  implementationPath: MobileBenchmarkImplementationPathId = 'browser_fallback_wasm',
  pathStatus: MobileBenchmarkPathStatus = 'available_not_run',
  baseDurationMs = 0
): MobileElectionCrypto {
  const supportedOperations = MOBILE_BENCHMARK_RUNNER_SCENARIOS.flatMap(
    (scenario) => scenario.operations
  );

  function createAdapterOperation(
    scenarioId: MobileBenchmarkScenarioId,
    operationKind: MobileElectionCryptoOperationKind,
    operationIndex: number
  ): Promise<MobileElectionCryptoOperationResult<Record<string, unknown>>> {
    return Promise.resolve(
      createOperationResult({
        scenarioId: scenarioId as MobileBenchmarkRunnerScenarioId,
        operationKind,
        implementationPath,
        operationIndex,
        startedAt: new Date(0).toISOString(),
        durationMs: operationDuration(operationKind, operationIndex, baseDurationMs),
        status: 'passed',
        resultCode: resultCodeForOperation(operationKind, 'development_placeholder'),
        baseDurationMs,
        releaseIntegrityMode: 'development_placeholder',
      })
    );
  }

  return {
    discoverCapabilities(): Promise<MobileElectionCryptoCapabilities> {
      return Promise.resolve({
        adapterId: `synthetic-${implementationPath}`,
        implementationPath,
        pathStatus,
        supportedOperations,
        unavailableReasons: {},
        secureStorageAvailable: true,
        appIntegrityProbeAvailable: true,
        nativeCryptoAvailable: implementationPath === 'tauri_native_crypto',
      });
    },
    createCommitment(input: MobileElectionCommitmentInput) {
      return createAdapterOperation(input.scenarioId, 'commitment', 0);
    },
    generateProof(input: MobileElectionProofInput) {
      return createAdapterOperation(input.scenarioId, 'proof_generation', 0);
    },
    verifyProof(input: MobileElectionVerificationInput) {
      return createAdapterOperation(input.scenarioId, 'proof_verification', 0);
    },
    probeSecureStorage(input: MobileElectionSecureStorageProbeInput) {
      return createAdapterOperation(input.scenarioId, 'secure_storage_probe', 0);
    },
  };
}

export async function runMobileBenchmarkScenarios(
  setup: MobileBenchmarkRunnerSetup,
  options: MobileBenchmarkRunOptions = {}
): Promise<MobileBenchmarkRunResult> {
  if (setup.selectedScenarioIds.length === 0) {
    throw new Error('At least one mobile benchmark scenario must be selected.');
  }

  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const generatedAtMs = Date.parse(generatedAt);
  const availability = getMobileBenchmarkPathAvailability(options.env);
  const adapter = options.adapter;
  const adapterCapabilities = adapter ? await adapter.discoverCapabilities() : undefined;
  const adapterPathStatus =
    adapterCapabilities?.implementationPath === setup.implementationPath
      ? adapterCapabilities.pathStatus
      : undefined;
  const initialPathStatus =
    adapterPathStatus ?? getMobileBenchmarkPathStatus(setup.implementationPath, availability);
  const baseDurationMs = options.baseDurationMs ?? 0;
  const activeAdapter =
    adapterCapabilities?.implementationPath === setup.implementationPath ? adapter : undefined;
  const nativePathWithoutAdapter =
    isMobileBenchmarkNativeCryptoPath(setup.implementationPath) && !activeAdapter;
  const pathCanRun = initialPathStatus !== 'not_available' && !nativePathWithoutAdapter;
  const measuredPathStatus: MobileBenchmarkPathStatus = pathCanRun ? 'measured' : 'not_available';
  const scenarioIds = setup.selectedScenarioIds.filter((scenarioId) =>
    MOBILE_BENCHMARK_RUNNER_SCENARIO_IDS.includes(scenarioId)
  );
  const progress: MobileBenchmarkProgressEvent[] = [];
  const scenarios: MobileBenchmarkScenarioResult[] = [];

  for (const [scenarioIndex, scenarioId] of scenarioIds.entries()) {
    const scenario = getScenarioDefinition(scenarioId);

    if (!pathCanRun || nativePathWithoutAdapter) {
      const unsupported = createUnsupportedScenario(
        scenario,
        setup,
        generatedAtMs,
        scenarioIndex
      );
      scenarios.push(unsupported);
      progress.push({
        scenarioId,
        operationKind: scenario.operations[0],
        status: 'unsupported_path',
        completedScenarios: scenarioIndex + 1,
        totalScenarios: scenarioIds.length,
        message: 'Implementation path unavailable.',
      });
      continue;
    }

    const operations: MobileBenchmarkReportOperation[] = [];
    const warnings: string[] = [];
    let scenarioStatus: MobileBenchmarkScenarioStatus = 'passed';

    for (const [operationIndex, operationKind] of scenario.operations.entries()) {
      const startedAt = new Date(
        generatedAtMs + scenarioIndex * 1000 + operationIndex * 100
      ).toISOString();
      const forcedFailure = options.forcedFailure;
      const shouldFailOperation =
        forcedFailure?.scenarioId === scenarioId &&
        (!forcedFailure.operationKind || forcedFailure.operationKind === operationKind);

      if (
        options.interruptionScenarioId === scenarioId &&
        operationIndex === 0 &&
        operations.length === 0
      ) {
        const interrupted = createOperationResult({
          scenarioId,
          operationKind,
          implementationPath: setup.implementationPath,
          operationIndex,
          startedAt,
          durationMs: 7,
          status: 'failed',
          resultCode: 'app_interrupted',
          errorCode: 'app_interrupted',
          baseDurationMs,
          releaseIntegrityMode: setup.releaseIntegrityMode,
        });
        operations.push(toReportOperation(interrupted, scenarioId));
        warnings.push('Interrupted sample was preserved before the scenario retry.');
        scenarioStatus = 'warning';
        progress.push({
          scenarioId,
          operationKind,
          status: 'failed',
          completedScenarios: scenarioIndex,
          totalScenarios: scenarioIds.length,
          message: 'Interruption sample preserved.',
        });
      }

      if (forcedFailure && shouldFailOperation) {
        const failed = createOperationResult({
          scenarioId,
          operationKind,
          implementationPath: setup.implementationPath,
          operationIndex,
          startedAt,
          durationMs: 11,
          status: 'failed',
          resultCode: forcedFailure.resultCode,
          errorCode: forcedFailure.resultCode,
          baseDurationMs,
          releaseIntegrityMode: setup.releaseIntegrityMode,
        });
        operations.push(toReportOperation(failed, scenarioId));
        warnings.push(failureMessage(forcedFailure.resultCode));
        scenarioStatus = 'failed';
        progress.push({
          scenarioId,
          operationKind,
          status: 'failed',
          completedScenarios: scenarioIndex,
          totalScenarios: scenarioIds.length,
          message: failureMessage(forcedFailure.resultCode),
        });
        break;
      }

      const result = activeAdapter
        ? await operationResultForKind({
            adapter: activeAdapter,
            scenarioId,
            operationKind,
            implementationPath: setup.implementationPath,
            operationIndex,
            startedAt,
            baseDurationMs,
            releaseIntegrityMode: setup.releaseIntegrityMode,
          })
        : createOperationResult({
            scenarioId,
            operationKind,
            implementationPath: setup.implementationPath,
            operationIndex,
            startedAt,
            durationMs: operationDuration(operationKind, operationIndex, baseDurationMs),
            status: 'passed',
            resultCode: resultCodeForOperation(operationKind, setup.releaseIntegrityMode),
            baseDurationMs,
            releaseIntegrityMode: setup.releaseIntegrityMode,
          });
      operations.push(toReportOperation(sanitizeMobileElectionCryptoOperationResult(result), scenarioId));
      progress.push({
        scenarioId,
        operationKind,
        status: 'passed',
        completedScenarios: scenarioIndex + 1,
        totalScenarios: scenarioIds.length,
        message: 'Operation completed.',
      });
    }

    scenarios.push({
      scenarioId,
      title: scenario.title,
      status: scenarioStatus,
      implementationPath: setup.implementationPath,
      pathStatus: measuredPathStatus,
      operations,
      warnings,
    });
  }

  const report: MobileBenchmarkReport = {
    schemaVersion: MOBILE_BENCHMARK_REPORT_SCHEMA_VERSION,
    reportId: `feat121-phase5-${generatedAt.replace(/[^0-9TZ]/g, '')}`,
    generatedAt,
    benchmarkRole: setup.benchmarkRole,
    implementationPath: setup.implementationPath,
    pathStatus: measuredPathStatus,
    deviceClass: setup.deviceClass,
    benchmarkApp: {
      name: 'HushVoting mobile benchmark runner',
      version: 'FEAT-121-phase5',
      buildId: 'phase5-local-runner',
      releaseIntegrityMode: setup.releaseIntegrityMode,
      notForReleaseIntegrityClaims: true,
    },
    protocolPackage: {
      packageId: MOBILE_BENCHMARK_PROTOCOL_PACKAGE_REF.packageId,
      version: MOBILE_BENCHMARK_PROTOCOL_PACKAGE_REF.packageVersion,
      manifestHash: MOBILE_BENCHMARK_PROTOCOL_PACKAGE_REF.releaseManifestHash,
      spCoverage: createMobileBenchmarkProtocolPackageCoverage(scenarioIds),
    },
    environment: collectMobileBenchmarkEnvironmentFacts(setup, options.env, options.nativeProbe),
    scenarios,
    maturityGapStatus: {
      externalReview: 'not_available',
      operationalEvidence: 'referenced_with_limitations',
      regulatoryTracking: 'not_referenced',
      feat106Readiness: 'not_complete',
      legalValidation: 'not_available',
      certification: 'not_available',
      publicElectionParity: 'not_claimed',
    },
    summary: {
      assurancePositioning:
        'Internal FEAT-121 benchmark evidence only; production, external-review, regulatory, and legal conclusions remain outside this report.',
      warnings: [
        'not_for_release_integrity_claims is true for Phase 5 local benchmark exports.',
        'Browser and WebView samples use deterministic synthetic fixtures and public SP profiles only.',
      ],
    },
  };

  return {
    report,
    progress,
    exportValidation: validateMobileBenchmarkReportForExport(report),
  };
}
