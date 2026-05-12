import { describe, expect, it } from 'vitest';
import {
  MOBILE_BENCHMARK_NATIVE_CRYPTO_ADAPTER_DECISION,
  createUnavailableNativeMobileElectionCrypto,
} from './nativeCryptoAdapter.ts';
import { sanitizeMobileElectionCryptoOperationResult } from './privacy.ts';

describe('FEAT-121 native crypto adapter decision', () => {
  it('records that native crypto is an unavailable adapter slot until a native module exists', async () => {
    const adapter = createUnavailableNativeMobileElectionCrypto();
    const capabilities = await adapter.discoverCapabilities();

    expect(MOBILE_BENCHMARK_NATIVE_CRYPTO_ADAPTER_DECISION).toMatchObject({
      status: 'not_available',
      reasonCode: 'native_crypto_module_not_bound',
    });
    expect(capabilities).toMatchObject({
      implementationPath: 'tauri_native_crypto',
      pathStatus: 'not_available',
      supportedOperations: [],
      secureStorageAvailable: false,
      appIntegrityProbeAvailable: false,
      nativeCryptoAvailable: false,
    });
    expect(capabilities.unavailableReasons.commitment).toBe('native_crypto_module_not_bound');
  });

  it('uses the MobileElectionCrypto interface without echoing private handles', async () => {
    const adapter = createUnavailableNativeMobileElectionCrypto();
    const result = await adapter.createCommitment({
      scenarioId: 'scenario-02',
      fixtureRef: 'fixture:synthetic-commitment',
      commitmentSeedHandle: {
        handleId: 'private-handle-that-must-not-be-exported',
        materialKind: 'vote_secret',
      },
    });
    const serialized = JSON.stringify(result);

    expect(result).toMatchObject({
      operationKind: 'commitment',
      status: 'unsupported_path',
      resultCode: 'native_crypto_module_not_bound',
      errorCode: 'native_crypto_module_not_bound',
    });
    expect(serialized).not.toContain('private-handle-that-must-not-be-exported');
    expect(serialized).not.toContain('vote_secret');
    expect(sanitizeMobileElectionCryptoOperationResult(result)).toBe(result);
  });
});
