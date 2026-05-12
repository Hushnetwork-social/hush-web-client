import {
  type MobileBenchmarkEnvironmentFact,
  type MobileBenchmarkMetricConfidence,
  type MobileBenchmarkMetricSource,
  type MobileBenchmarkMetricValue,
} from './contracts.ts';
import { scanMobileBenchmarkReportPrivacy } from './privacy.ts';

export const MOBILE_BENCHMARK_NATIVE_PROBE_SCHEMA_VERSION =
  'hushvoting-mobile-native-probe-v1';

export type MobileBenchmarkNativeProbeSource =
  | 'tauri_command'
  | 'android_js_bridge'
  | 'browser_unavailable'
  | 'mock';

export type MobileBenchmarkNativePlatformKind =
  | 'android'
  | 'ios'
  | 'tauri_desktop'
  | 'browser'
  | 'unknown';

export interface MobileBenchmarkNativeProbeMetric {
  name: string;
  value: MobileBenchmarkMetricValue;
  unit: string;
  source: MobileBenchmarkMetricSource;
  collectionMethod: string;
  confidence: MobileBenchmarkMetricConfidence;
  unavailableReason?: string;
}

export interface MobileBenchmarkNativePlatformFacts {
  platformKind: MobileBenchmarkNativePlatformKind;
  osFamily: string | null;
  osMajorVersion: number | null;
  runtimeFamily: 'tauri_webview' | 'browser' | 'unknown';
  appPackageId: string | null;
  appVersion: string | null;
  appBuild: string | null;
  releaseMode: 'debug' | 'release' | 'unavailable';
  signingFingerprintClass: 'debug' | 'release' | 'available' | 'unavailable' | 'not_checked';
  integrityVerdictClass: 'available' | 'unavailable' | 'not_checked';
}

export interface MobileBenchmarkNativeSecureStorageProbe {
  status: 'measured' | 'unavailable';
  syntheticOnly: true;
  collectionMethod: string;
  writeLatencyMs: number | null;
  readLatencyMs: number | null;
  deleteLatencyMs: number | null;
  unavailableReason?: string;
}

export interface MobileBenchmarkNativeProbePrivacyGuard {
  identifierValuesExported: false;
  attestationPayloadsExported: false;
}

export interface MobileBenchmarkNativeProbeResult {
  schemaVersion: typeof MOBILE_BENCHMARK_NATIVE_PROBE_SCHEMA_VERSION;
  collectedAtUnixMs: number;
  source: MobileBenchmarkNativeProbeSource;
  platform: MobileBenchmarkNativePlatformFacts;
  metrics: MobileBenchmarkNativeProbeMetric[];
  secureStorage: MobileBenchmarkNativeSecureStorageProbe;
  privacy: MobileBenchmarkNativeProbePrivacyGuard;
}

interface HushNativeBenchmarkBridge {
  getMobileBenchmarkNativeProbeJson?: () => string;
}

function nowUnixMs(): number {
  return Date.now();
}

function unavailableMetric(
  name: string,
  unit: string,
  unavailableReason: string,
  collectionMethod = 'not_available'
): MobileBenchmarkNativeProbeMetric {
  return {
    name,
    value: null,
    unit,
    source: 'unavailable',
    collectionMethod,
    confidence: 'unavailable',
    unavailableReason,
  };
}

export function createUnavailableMobileBenchmarkNativeProbe(
  unavailableReason = 'native_probe_not_available',
  source: MobileBenchmarkNativeProbeSource = 'browser_unavailable'
): MobileBenchmarkNativeProbeResult {
  return {
    schemaVersion: MOBILE_BENCHMARK_NATIVE_PROBE_SCHEMA_VERSION,
    collectedAtUnixMs: nowUnixMs(),
    source,
    platform: {
      platformKind: source === 'browser_unavailable' ? 'browser' : 'unknown',
      osFamily: null,
      osMajorVersion: null,
      runtimeFamily: source === 'browser_unavailable' ? 'browser' : 'unknown',
      appPackageId: null,
      appVersion: null,
      appBuild: null,
      releaseMode: 'unavailable',
      signingFingerprintClass: 'unavailable',
      integrityVerdictClass: 'unavailable',
    },
    metrics: [
      unavailableMetric('battery_level_percent', 'percent', unavailableReason),
      unavailableMetric('battery_charging', 'boolean', unavailableReason),
      unavailableMetric('thermal_state', 'state', unavailableReason),
      unavailableMetric('available_memory_mb', 'MB', unavailableReason),
      unavailableMetric('foreground_state', 'state', unavailableReason),
    ],
    secureStorage: {
      status: 'unavailable',
      syntheticOnly: true,
      collectionMethod: 'not_available',
      writeLatencyMs: null,
      readLatencyMs: null,
      deleteLatencyMs: null,
      unavailableReason,
    },
    privacy: {
      identifierValuesExported: false,
      attestationPayloadsExported: false,
    },
  };
}

export function assertMobileBenchmarkNativeProbePrivacy(value: unknown): void {
  const scan = scanMobileBenchmarkReportPrivacy(value, 'nativeProbe');

  if (scan.status === 'blocked') {
    throw new Error(
      `Native benchmark probe contains forbidden output: ${scan.findings
        .map((finding) => finding.path)
        .join(', ')}`
    );
  }
}

export function normalizeMobileBenchmarkNativeProbe(
  value: unknown,
  source: MobileBenchmarkNativeProbeSource = 'tauri_command'
): MobileBenchmarkNativeProbeResult {
  assertMobileBenchmarkNativeProbePrivacy(value);

  const input = value as Partial<MobileBenchmarkNativeProbeResult>;
  const fallback = createUnavailableMobileBenchmarkNativeProbe(
    'native_probe_payload_incomplete',
    source
  );
  const normalized: MobileBenchmarkNativeProbeResult = {
    ...fallback,
    ...input,
    schemaVersion: MOBILE_BENCHMARK_NATIVE_PROBE_SCHEMA_VERSION,
    source: input.source ?? source,
    platform: {
      ...fallback.platform,
      ...(input.platform ?? {}),
    },
    metrics: Array.isArray(input.metrics) ? input.metrics : fallback.metrics,
    secureStorage: {
      ...fallback.secureStorage,
      ...(input.secureStorage ?? {}),
      syntheticOnly: true,
    },
    privacy: {
      identifierValuesExported: false,
      attestationPayloadsExported: false,
    },
  };

  assertMobileBenchmarkNativeProbePrivacy(normalized);
  return normalized;
}

export async function readMobileBenchmarkNativeProbe(): Promise<MobileBenchmarkNativeProbeResult> {
  const windowWithBridge =
    typeof window === 'undefined'
      ? undefined
      : (window as Window & { HushNative?: HushNativeBenchmarkBridge });

  if (typeof windowWithBridge?.HushNative?.getMobileBenchmarkNativeProbeJson === 'function') {
    try {
      return normalizeMobileBenchmarkNativeProbe(
        JSON.parse(windowWithBridge.HushNative.getMobileBenchmarkNativeProbeJson()),
        'android_js_bridge'
      );
    } catch {
      return createUnavailableMobileBenchmarkNativeProbe(
        'android_js_bridge_probe_failed',
        'android_js_bridge'
      );
    }
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const result = await invoke<unknown>('get_mobile_benchmark_native_probe');
    return normalizeMobileBenchmarkNativeProbe(result, 'tauri_command');
  } catch {
    return createUnavailableMobileBenchmarkNativeProbe();
  }
}

function platformFact(
  fieldPath: string,
  value: MobileBenchmarkMetricValue,
  collectionMethod: string,
  source: MobileBenchmarkMetricSource = value === null ? 'unavailable' : 'measured',
  confidence: MobileBenchmarkMetricConfidence = value === null ? 'unavailable' : 'medium',
  unavailableReason?: string
): MobileBenchmarkEnvironmentFact {
  return {
    fieldPath,
    value,
    source,
    confidence,
    collectionMethod,
    unavailableReason,
  };
}

export function nativeProbeToEnvironmentFacts(
  probe: MobileBenchmarkNativeProbeResult
): MobileBenchmarkEnvironmentFact[] {
  const facts: MobileBenchmarkEnvironmentFact[] = [
    platformFact('native.platform.kind', probe.platform.platformKind, 'native_probe'),
    platformFact('native.platform.os_family', probe.platform.osFamily, 'native_probe'),
    platformFact('native.platform.os_major_version', probe.platform.osMajorVersion, 'native_probe'),
    platformFact('native.runtime.family', probe.platform.runtimeFamily, 'native_probe'),
    platformFact('native.app.package_id', probe.platform.appPackageId, 'native_probe'),
    platformFact('native.app.version', probe.platform.appVersion, 'native_probe'),
    platformFact('native.app.build', probe.platform.appBuild, 'native_probe'),
    platformFact('native.app.release_mode', probe.platform.releaseMode, 'native_probe'),
    platformFact(
      'native.app.signing_fingerprint_class',
      probe.platform.signingFingerprintClass,
      'native_probe'
    ),
    platformFact(
      'native.app.integrity_verdict_class',
      probe.platform.integrityVerdictClass,
      'native_probe'
    ),
  ];

  for (const item of probe.metrics) {
    facts.push({
      fieldPath: `native.metrics.${item.name}`,
      value: item.value,
      source: item.source,
      confidence: item.confidence,
      collectionMethod: item.collectionMethod,
      unavailableReason: item.unavailableReason,
    });
  }

  facts.push(
    platformFact(
      'native.secure_storage.status',
      probe.secureStorage.status,
      probe.secureStorage.collectionMethod
    ),
    platformFact(
      'native.secure_storage.synthetic_only',
      probe.secureStorage.syntheticOnly,
      probe.secureStorage.collectionMethod
    ),
    platformFact(
      'native.secure_storage.write_latency_ms',
      probe.secureStorage.writeLatencyMs,
      probe.secureStorage.collectionMethod,
      probe.secureStorage.writeLatencyMs === null ? 'unavailable' : 'measured',
      probe.secureStorage.writeLatencyMs === null ? 'unavailable' : 'medium',
      probe.secureStorage.unavailableReason
    ),
    platformFact(
      'native.secure_storage.read_latency_ms',
      probe.secureStorage.readLatencyMs,
      probe.secureStorage.collectionMethod,
      probe.secureStorage.readLatencyMs === null ? 'unavailable' : 'measured',
      probe.secureStorage.readLatencyMs === null ? 'unavailable' : 'medium',
      probe.secureStorage.unavailableReason
    ),
    platformFact(
      'native.secure_storage.delete_latency_ms',
      probe.secureStorage.deleteLatencyMs,
      probe.secureStorage.collectionMethod,
      probe.secureStorage.deleteLatencyMs === null ? 'unavailable' : 'measured',
      probe.secureStorage.deleteLatencyMs === null ? 'unavailable' : 'medium',
      probe.secureStorage.unavailableReason
    ),
    platformFact(
      'native.privacy.identifier_values_exported',
      probe.privacy.identifierValuesExported,
      'native_probe',
      'measured',
      'high'
    ),
    platformFact(
      'native.privacy.attestation_payloads_exported',
      probe.privacy.attestationPayloadsExported,
      'native_probe',
      'measured',
      'high'
    )
  );

  return facts;
}
