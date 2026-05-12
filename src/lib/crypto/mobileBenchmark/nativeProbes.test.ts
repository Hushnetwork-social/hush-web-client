import { describe, expect, it } from 'vitest';
import {
  assertMobileBenchmarkNativeProbePrivacy,
  createUnavailableMobileBenchmarkNativeProbe,
  nativeProbeToEnvironmentFacts,
  normalizeMobileBenchmarkNativeProbe,
  type MobileBenchmarkNativeProbeResult,
} from './nativeProbes.ts';

function measuredProbe(): MobileBenchmarkNativeProbeResult {
  return {
    schemaVersion: 'hushvoting-mobile-native-probe-v1',
    collectedAtUnixMs: 1778570000000,
    source: 'mock',
    platform: {
      platformKind: 'android',
      osFamily: 'android',
      osMajorVersion: 35,
      runtimeFamily: 'tauri_webview',
      appPackageId: 'social.hushnetwork.app',
      appVersion: '0.2.15',
      appBuild: '215',
      releaseMode: 'release',
      signingFingerprintClass: 'release',
      integrityVerdictClass: 'unavailable',
    },
    metrics: [
      {
        name: 'battery_level_percent',
        value: 82,
        unit: 'percent',
        source: 'measured',
        collectionMethod: 'android_battery_manager',
        confidence: 'medium',
      },
      {
        name: 'thermal_state',
        value: null,
        unit: 'state',
        source: 'unavailable',
        collectionMethod: 'android_power_manager',
        confidence: 'unavailable',
        unavailableReason: 'thermal_api_unavailable',
      },
    ],
    secureStorage: {
      status: 'measured',
      syntheticOnly: true,
      collectionMethod: 'android_encrypted_preferences_synthetic_roundtrip',
      writeLatencyMs: 2.4,
      readLatencyMs: 1.2,
      deleteLatencyMs: 1.1,
    },
    privacy: {
      identifierValuesExported: false,
      attestationPayloadsExported: false,
    },
  };
}

describe('FEAT-121 native platform probes', () => {
  it('represents unavailable native facts explicitly instead of inferring values', () => {
    const probe = createUnavailableMobileBenchmarkNativeProbe('browser_test_runtime');
    const facts = nativeProbeToEnvironmentFacts(probe);

    expect(probe.metrics.every((metric) => metric.source === 'unavailable')).toBe(true);
    expect(facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldPath: 'native.metrics.battery_level_percent',
          value: null,
          source: 'unavailable',
          collectionMethod: 'not_available',
          unavailableReason: 'browser_test_runtime',
        }),
        expect.objectContaining({
          fieldPath: 'native.secure_storage.write_latency_ms',
          value: null,
          source: 'unavailable',
        }),
      ])
    );
  });

  it('maps measured platform and secure-storage facts without exposing stored values', () => {
    const facts = nativeProbeToEnvironmentFacts(measuredProbe());

    expect(facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldPath: 'native.platform.kind',
          value: 'android',
          source: 'measured',
        }),
        expect.objectContaining({
          fieldPath: 'native.secure_storage.synthetic_only',
          value: true,
        }),
        expect.objectContaining({
          fieldPath: 'native.secure_storage.write_latency_ms',
          value: 2.4,
          collectionMethod: 'android_encrypted_preferences_synthetic_roundtrip',
        }),
      ])
    );
    expect(JSON.stringify(facts).toLowerCase()).not.toContain('storedvalue');
  });

  it('rejects raw native identifiers and raw attestation fields before report use', () => {
    expect(() =>
      assertMobileBenchmarkNativeProbePrivacy({
        platform: {
          androidId: 'abc',
        },
      })
    ).toThrow('forbidden output');

    expect(() =>
      assertMobileBenchmarkNativeProbePrivacy({
        appIntegrity: {
          rawAttestationToken: 'token',
        },
      })
    ).toThrow('forbidden output');
  });

  it('normalizes incomplete native payloads and keeps privacy guards false', () => {
    const normalized = normalizeMobileBenchmarkNativeProbe({
      platform: {
        platformKind: 'tauri_desktop',
        runtimeFamily: 'tauri_webview',
      },
    });

    expect(normalized.schemaVersion).toBe('hushvoting-mobile-native-probe-v1');
    expect(normalized.platform.platformKind).toBe('tauri_desktop');
    expect(normalized.privacy).toEqual({
      identifierValuesExported: false,
      attestationPayloadsExported: false,
    });
  });
});
