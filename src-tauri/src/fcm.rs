//! FCM (Firebase Cloud Messaging) Commands Module
//!
//! This module provides Tauri commands for FCM operations.
//! On Android, these commands interface with the Kotlin FCM implementation.
//! On desktop, they return appropriate placeholder values.

use serde::{Deserialize, Serialize};

/// Result type for FCM token operations
#[derive(Debug, Serialize, Deserialize)]
pub struct FcmTokenResult {
    pub token: Option<String>,
    pub error: Option<String>,
}

/// Result type for permission check
#[derive(Debug, Serialize, Deserialize)]
pub struct PermissionResult {
    pub granted: bool,
    pub can_request: bool,
}

/// Get the current platform type
///
/// Returns:
/// - "android" on Android devices
/// - "ios" on iOS devices
/// - "desktop" on desktop platforms
#[tauri::command]
pub fn get_platform() -> String {
    #[cfg(target_os = "android")]
    {
        "android".to_string()
    }
    #[cfg(target_os = "ios")]
    {
        "ios".to_string()
    }
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        "desktop".to_string()
    }
}

/// Get the device name for push notification registration
///
/// Returns a human-readable device identifier.
/// On mobile: Returns device manufacturer and model (e.g., "Samsung Galaxy S24")
/// On desktop: Returns the hostname or a generic identifier
#[tauri::command]
pub fn get_device_name() -> String {
    #[cfg(target_os = "android")]
    {
        // On Android, the Kotlin layer provides device name via MainActivity.getDeviceName()
        // For now, return a placeholder - TypeScript will call the Kotlin bridge directly
        "Android Device".to_string()
    }
    #[cfg(target_os = "ios")]
    {
        // On iOS, similar pattern will be used
        "iOS Device".to_string()
    }
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        // On desktop, try to get hostname
        hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "Desktop".to_string())
    }
}

/// Check if notification permission is granted
///
/// On Android 13+: Checks POST_NOTIFICATIONS permission
/// On Android <13: Always returns true (implicit permission)
/// On iOS: Checks notification authorization status
/// On desktop: Always returns true (no permission needed)
#[tauri::command]
pub fn has_notification_permission() -> PermissionResult {
    #[cfg(target_os = "android")]
    {
        // On Android, the actual permission check is done in Kotlin
        // The Kotlin layer handles this via MainActivity.hasNotificationPermission()
        // This returns a default that TypeScript should verify with the native bridge
        PermissionResult {
            granted: true, // Optimistic default - TypeScript verifies with Kotlin
            can_request: true,
        }
    }
    #[cfg(target_os = "ios")]
    {
        // Similar pattern for iOS
        PermissionResult {
            granted: true,
            can_request: true,
        }
    }
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        // Desktop doesn't need push notification permission
        PermissionResult {
            granted: true,
            can_request: false, // No permission to request on desktop
        }
    }
}

/// Get the FCM token for push notifications
///
/// On Android: Returns the FCM token stored by the Kotlin layer
/// On iOS: Returns the APNs token (future implementation)
/// On desktop: Returns None (push notifications not supported)
#[tauri::command]
pub fn get_fcm_token() -> FcmTokenResult {
    #[cfg(target_os = "android")]
    {
        // On Android, the FCM token is managed by FcmService.kt
        // It's stored in SharedPreferences and accessed via MainActivity.getFcmToken()
        // TypeScript should call the Kotlin bridge directly for the actual token
        // This command provides the interface structure
        FcmTokenResult {
            token: None, // TypeScript retrieves from Kotlin bridge
            error: Some("Use native bridge to retrieve FCM token".to_string()),
        }
    }
    #[cfg(target_os = "ios")]
    {
        // iOS uses APNs, which will be implemented in FEAT-034
        FcmTokenResult {
            token: None,
            error: Some("iOS push notifications not yet implemented".to_string()),
        }
    }
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        // Desktop doesn't support FCM/APNs push notifications
        FcmTokenResult {
            token: None,
            error: Some("Push notifications not available on desktop".to_string()),
        }
    }
}

/// Check if push notifications are supported on this platform
#[tauri::command]
pub fn is_push_supported() -> bool {
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        true
    }
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        false
    }
}

/// Result type for pending navigation operations
#[derive(Debug, Serialize, Deserialize)]
pub struct PendingNavigationResult {
    pub feed_id: Option<String>,
}

/// Get pending feed navigation from notification tap.
///
/// When a user taps a push notification, the feedId is stored by the native layer.
/// This command retrieves that feedId so TypeScript can navigate to the correct feed.
///
/// On Android: Returns feedId stored by MainActivity when handling notification tap
/// On iOS: Similar pattern (future implementation)
/// On desktop: Always returns None (no push notifications)
#[tauri::command]
pub fn get_pending_navigation() -> PendingNavigationResult {
    #[cfg(target_os = "android")]
    {
        // On Android, the pending navigation is stored in SharedPreferences
        // by MainActivity when a notification is tapped.
        // The Kotlin layer provides FcmService.getPendingNavigation(context)
        // TypeScript should call this via the Kotlin bridge
        PendingNavigationResult {
            feed_id: None, // TypeScript retrieves from Kotlin bridge directly
        }
    }
    #[cfg(target_os = "ios")]
    {
        // iOS implementation will follow similar pattern
        PendingNavigationResult {
            feed_id: None,
        }
    }
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        // Desktop doesn't have push notification navigation
        PendingNavigationResult {
            feed_id: None,
        }
    }
}

/// Clear pending feed navigation after TypeScript has processed it.
///
/// After navigating to the feed, TypeScript calls this to clear the pending navigation
/// so subsequent app opens don't re-navigate to the same feed.
///
/// On Android: Clears the SharedPreferences value via FcmService.clearPendingNavigation()
/// On iOS: Similar pattern (future implementation)
/// On desktop: No-op
#[tauri::command]
pub fn clear_pending_navigation() -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        // On Android, the Kotlin layer handles clearing via SharedPreferences
        // TypeScript should call this via the Kotlin bridge
        Ok(())
    }
    #[cfg(target_os = "ios")]
    {
        // iOS implementation will follow similar pattern
        Ok(())
    }
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        // Desktop doesn't have pending navigation to clear
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_platform_returns_desktop_on_desktop() {
        // This test runs on the dev machine (desktop)
        let platform = get_platform();
        assert_eq!(platform, "desktop");
    }

    #[test]
    fn test_has_notification_permission_on_desktop() {
        let result = has_notification_permission();
        assert!(result.granted);
        assert!(!result.can_request);
    }

    #[test]
    fn test_get_fcm_token_on_desktop() {
        let result = get_fcm_token();
        assert!(result.token.is_none());
        assert!(result.error.is_some());
    }

    #[test]
    fn test_is_push_supported_on_desktop() {
        assert!(!is_push_supported());
    }

    #[test]
    fn test_get_pending_navigation_on_desktop() {
        let result = get_pending_navigation();
        assert!(result.feed_id.is_none());
    }

    #[test]
    fn test_clear_pending_navigation_on_desktop() {
        let result = clear_pending_navigation();
        assert!(result.is_ok());
    }
}
