//! Privacy-safe native probe support for FEAT-121.
//!
//! These commands intentionally do not expose serial numbers, advertising ids,
//! platform ids, IP addresses, raw attestation tokens, or signing certificate bytes.

use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileBenchmarkNativeProbeMetric {
    pub name: String,
    pub value: Option<f64>,
    pub unit: String,
    pub source: String,
    pub collection_method: String,
    pub confidence: String,
    pub unavailable_reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileBenchmarkNativePlatformFacts {
    pub platform_kind: String,
    pub os_family: Option<String>,
    pub os_major_version: Option<u32>,
    pub runtime_family: String,
    pub app_package_id: Option<String>,
    pub app_version: Option<String>,
    pub app_build: Option<String>,
    pub release_mode: String,
    pub signing_fingerprint_class: String,
    pub integrity_verdict_class: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileBenchmarkNativeSecureStorageProbe {
    pub status: String,
    pub synthetic_only: bool,
    pub collection_method: String,
    pub write_latency_ms: Option<f64>,
    pub read_latency_ms: Option<f64>,
    pub delete_latency_ms: Option<f64>,
    pub unavailable_reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileBenchmarkNativeProbePrivacyGuard {
    pub identifier_values_exported: bool,
    pub attestation_payloads_exported: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileBenchmarkNativeProbeResult {
    pub schema_version: String,
    pub collected_at_unix_ms: u64,
    pub source: String,
    pub platform: MobileBenchmarkNativePlatformFacts,
    pub metrics: Vec<MobileBenchmarkNativeProbeMetric>,
    pub secure_storage: MobileBenchmarkNativeSecureStorageProbe,
    pub privacy: MobileBenchmarkNativeProbePrivacyGuard,
}

fn now_unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn platform_kind() -> &'static str {
    #[cfg(target_os = "android")]
    {
        return "android";
    }
    #[cfg(target_os = "ios")]
    {
        return "ios";
    }
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        "tauri_desktop"
    }
}

fn os_family() -> &'static str {
    #[cfg(target_os = "android")]
    {
        return "android";
    }
    #[cfg(target_os = "ios")]
    {
        return "ios";
    }
    #[cfg(target_os = "windows")]
    {
        return "windows";
    }
    #[cfg(target_os = "macos")]
    {
        return "macos";
    }
    #[cfg(target_os = "linux")]
    {
        return "linux";
    }
    #[cfg(not(any(
        target_os = "android",
        target_os = "ios",
        target_os = "windows",
        target_os = "macos",
        target_os = "linux"
    )))]
    {
        "unknown"
    }
}

fn release_mode() -> &'static str {
    if cfg!(debug_assertions) {
        "debug"
    } else {
        "release"
    }
}

fn unavailable_metric(
    name: &str,
    unit: &str,
    collection_method: &str,
    reason: &str,
) -> MobileBenchmarkNativeProbeMetric {
    MobileBenchmarkNativeProbeMetric {
        name: name.to_string(),
        value: None,
        unit: unit.to_string(),
        source: "unavailable".to_string(),
        collection_method: collection_method.to_string(),
        confidence: "unavailable".to_string(),
        unavailable_reason: Some(reason.to_string()),
    }
}

/// Return privacy-safe native facts for FEAT-121 benchmark reports.
#[tauri::command]
pub fn get_mobile_benchmark_native_probe() -> MobileBenchmarkNativeProbeResult {
    MobileBenchmarkNativeProbeResult {
        schema_version: "hushvoting-mobile-native-probe-v1".to_string(),
        collected_at_unix_ms: now_unix_ms(),
        source: "tauri_command".to_string(),
        platform: MobileBenchmarkNativePlatformFacts {
            platform_kind: platform_kind().to_string(),
            os_family: Some(os_family().to_string()),
            os_major_version: None,
            runtime_family: "tauri_webview".to_string(),
            app_package_id: None,
            app_version: Some(env!("CARGO_PKG_VERSION").to_string()),
            app_build: None,
            release_mode: release_mode().to_string(),
            signing_fingerprint_class: "unavailable".to_string(),
            integrity_verdict_class: "unavailable".to_string(),
        },
        metrics: vec![
            unavailable_metric(
                "battery_level_percent",
                "percent",
                "tauri_command",
                "battery_api_not_exposed_to_rust_probe",
            ),
            unavailable_metric(
                "battery_charging",
                "boolean",
                "tauri_command",
                "battery_api_not_exposed_to_rust_probe",
            ),
            unavailable_metric(
                "thermal_state",
                "state",
                "tauri_command",
                "thermal_api_not_exposed_to_rust_probe",
            ),
            unavailable_metric(
                "available_memory_mb",
                "MB",
                "tauri_command",
                "memory_api_not_exposed_to_rust_probe",
            ),
            unavailable_metric(
                "foreground_state",
                "state",
                "tauri_command",
                "lifecycle_state_not_exposed_to_rust_probe",
            ),
        ],
        secure_storage: MobileBenchmarkNativeSecureStorageProbe {
            status: "unavailable".to_string(),
            synthetic_only: true,
            collection_method: "tauri_command".to_string(),
            write_latency_ms: None,
            read_latency_ms: None,
            delete_latency_ms: None,
            unavailable_reason: Some("secure_storage_bridge_not_available".to_string()),
        },
        privacy: MobileBenchmarkNativeProbePrivacyGuard {
            identifier_values_exported: false,
            attestation_payloads_exported: false,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn native_probe_never_exports_raw_identifier_or_attestation_flags() {
        let result = get_mobile_benchmark_native_probe();
        assert!(!result.privacy.identifier_values_exported);
        assert!(!result.privacy.attestation_payloads_exported);
        assert_eq!(result.schema_version, "hushvoting-mobile-native-probe-v1");
    }

    #[test]
    fn unavailable_metrics_are_explicit() {
        let result = get_mobile_benchmark_native_probe();
        assert!(result
            .metrics
            .iter()
            .any(|metric| metric.name == "thermal_state"
                && metric.source == "unavailable"
                && metric.unavailable_reason.is_some()));
    }
}
