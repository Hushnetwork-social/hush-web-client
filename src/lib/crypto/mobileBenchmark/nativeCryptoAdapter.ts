import {
  type MobileBenchmarkImplementationPathId,
  type MobileBenchmarkMetric,
  type MobileElectionCommitmentInput,
  type MobileElectionCrypto,
  type MobileElectionCryptoCapabilities,
  type MobileElectionCryptoOperationKind,
  type MobileElectionCryptoOperationResult,
  type MobileElectionProofInput,
  type MobileElectionSecureStorageProbeInput,
  type MobileElectionVerificationInput,
} from './contracts.ts';
import { sanitizeMobileElectionCryptoOperationResult } from './privacy.ts';

export const MOBILE_BENCHMARK_NATIVE_CRYPTO_ADAPTER_DECISION = {
  status: 'not_available',
  reasonCode: 'native_crypto_module_not_bound',
  reason:
    'No native crypto or proof module is bound to FEAT-121; native paths remain adapter slots.',
} as const;

export const MOBILE_BENCHMARK_NATIVE_CRYPTO_ADAPTER_PATHS = [
  'tauri_native_crypto',
  'fully_native_ios',
  'fully_native_android',
] as const satisfies readonly MobileBenchmarkImplementationPathId[];

export type MobileBenchmarkNativeCryptoAdapterPath =
  (typeof MOBILE_BENCHMARK_NATIVE_CRYPTO_ADAPTER_PATHS)[number];

const NATIVE_ADAPTER_INTERFACE_OPERATIONS = [
  'commitment',
  'proof_generation',
  'proof_verification',
  'secure_storage_probe',
] as const satisfies readonly MobileElectionCryptoOperationKind[];

export function isMobileBenchmarkNativeCryptoPath(
  pathId: MobileBenchmarkImplementationPathId
): pathId is MobileBenchmarkNativeCryptoAdapterPath {
  return MOBILE_BENCHMARK_NATIVE_CRYPTO_ADAPTER_PATHS.includes(
    pathId as MobileBenchmarkNativeCryptoAdapterPath
  );
}

function nativeAdapterUnavailableReasons(): Partial<
  Record<MobileElectionCryptoOperationKind, string>
> {
  return Object.fromEntries(
    NATIVE_ADAPTER_INTERFACE_OPERATIONS.map((operation) => [
      operation,
      MOBILE_BENCHMARK_NATIVE_CRYPTO_ADAPTER_DECISION.reasonCode,
    ])
  ) as Partial<Record<MobileElectionCryptoOperationKind, string>>;
}

function unavailableMetric(name: string): MobileBenchmarkMetric {
  return {
    name,
    value: null,
    unit: 'state',
    source: 'unavailable',
    collectionMethod: 'native_crypto_adapter_decision',
    confidence: 'high',
    unavailableReason: MOBILE_BENCHMARK_NATIVE_CRYPTO_ADAPTER_DECISION.reasonCode,
  };
}

function createUnavailableNativeOperation(
  implementationPath: MobileBenchmarkNativeCryptoAdapterPath,
  operationKind: MobileElectionCryptoOperationKind,
  scenarioId: string,
  fixtureRef?: string
): MobileElectionCryptoOperationResult<Record<string, unknown>> {
  return sanitizeMobileElectionCryptoOperationResult({
    operationId: `${scenarioId}-${operationKind}-native-unavailable`,
    operationKind,
    status: 'unsupported_path',
    startedAt: new Date(0).toISOString(),
    durationMs: null,
    resultCode: MOBILE_BENCHMARK_NATIVE_CRYPTO_ADAPTER_DECISION.reasonCode,
    errorCode: MOBILE_BENCHMARK_NATIVE_CRYPTO_ADAPTER_DECISION.reasonCode,
    metrics: [unavailableMetric('native_crypto_adapter_available')],
    publicOutput: {
      adapterDecision: MOBILE_BENCHMARK_NATIVE_CRYPTO_ADAPTER_DECISION.status,
      reasonCode: MOBILE_BENCHMARK_NATIVE_CRYPTO_ADAPTER_DECISION.reasonCode,
      implementationPath,
      scenarioId,
      fixtureRef,
      syntheticOnly: true,
    },
  });
}

export function createUnavailableNativeMobileElectionCrypto(
  implementationPath: MobileBenchmarkNativeCryptoAdapterPath = 'tauri_native_crypto'
): MobileElectionCrypto {
  return {
    discoverCapabilities(): Promise<MobileElectionCryptoCapabilities> {
      return Promise.resolve({
        adapterId: `unavailable-${implementationPath}`,
        implementationPath,
        pathStatus: 'not_available',
        supportedOperations: [],
        unavailableReasons: nativeAdapterUnavailableReasons(),
        secureStorageAvailable: false,
        appIntegrityProbeAvailable: false,
        nativeCryptoAvailable: false,
      });
    },
    createCommitment(input: MobileElectionCommitmentInput) {
      return Promise.resolve(
        createUnavailableNativeOperation(
          implementationPath,
          'commitment',
          input.scenarioId,
          input.fixtureRef
        )
      );
    },
    generateProof(input: MobileElectionProofInput) {
      return Promise.resolve(
        createUnavailableNativeOperation(
          implementationPath,
          'proof_generation',
          input.scenarioId,
          input.fixtureRef
        )
      );
    },
    verifyProof(input: MobileElectionVerificationInput) {
      return Promise.resolve(
        createUnavailableNativeOperation(
          implementationPath,
          'proof_verification',
          input.scenarioId,
          input.fixtureRef
        )
      );
    },
    probeSecureStorage(input: MobileElectionSecureStorageProbeInput) {
      return Promise.resolve(
        createUnavailableNativeOperation(
          implementationPath,
          'secure_storage_probe',
          input.scenarioId,
          input.storageProfileId
        )
      );
    },
  };
}
