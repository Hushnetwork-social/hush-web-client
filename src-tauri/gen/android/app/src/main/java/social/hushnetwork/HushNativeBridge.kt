package social.hushnetwork

import android.content.Context
import android.os.Build
import android.webkit.JavascriptInterface
import android.util.Log

/**
 * JavaScript bridge for exposing native Android functionality to the WebView.
 *
 * This bridge provides FCM token retrieval, device information, and notification
 * permission status to TypeScript code running in the Tauri WebView.
 *
 * Usage from TypeScript:
 * ```typescript
 * // Check if bridge is available (Android only)
 * if (window.HushNative) {
 *     const token = window.HushNative.getFcmToken();
 *     const deviceName = window.HushNative.getDeviceName();
 * }
 * ```
 */
class HushNativeBridge(private val context: Context) {

    companion object {
        private const val TAG = "HushNativeBridge"
    }

    /**
     * Get the current FCM token for push notifications.
     *
     * @return The FCM token string, or empty string if not available
     */
    @JavascriptInterface
    fun getFcmToken(): String {
        val token = FcmService.getCurrentToken(context)
        Log.d(TAG, "getFcmToken called, token: ${token?.take(20) ?: "null"}...")
        return token ?: ""
    }

    /**
     * Get the device name for push notification registration.
     * Returns manufacturer and model (e.g., "Samsung Galaxy S24")
     *
     * @return Human-readable device name
     */
    @JavascriptInterface
    fun getDeviceName(): String {
        val manufacturer = Build.MANUFACTURER
        val model = Build.MODEL
        val deviceName = if (model.startsWith(manufacturer, ignoreCase = true)) {
            model
        } else {
            "$manufacturer $model"
        }
        Log.d(TAG, "getDeviceName called: $deviceName")
        return deviceName
    }

    /**
     * Check if notification permission is granted.
     * On Android 13+, this checks POST_NOTIFICATIONS permission.
     * On Android 12 and below, always returns true (implicit permission).
     *
     * @return true if notifications are allowed, false otherwise
     */
    @JavascriptInterface
    fun hasNotificationPermission(): Boolean {
        val hasPermission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) ==
                android.content.pm.PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
        Log.d(TAG, "hasNotificationPermission called: $hasPermission")
        return hasPermission
    }

    /**
     * Check if this is a mobile platform (always true on Android).
     * Used by TypeScript to determine if push notifications are supported.
     *
     * @return true (always on Android)
     */
    @JavascriptInterface
    fun isPushSupported(): Boolean {
        Log.d(TAG, "isPushSupported called: true")
        return true
    }

    /**
     * Get the platform identifier.
     *
     * @return "android"
     */
    @JavascriptInterface
    fun getPlatform(): String {
        Log.d(TAG, "getPlatform called: android")
        return "android"
    }

    /**
     * Get pending feed navigation from notification tap.
     * When a user taps a push notification, the feedId is stored.
     * This retrieves that feedId for TypeScript to navigate to.
     *
     * @return The feedId to navigate to, or empty string if none pending
     */
    @JavascriptInterface
    fun getPendingNavigation(): String {
        val feedId = FcmService.getPendingNavigation(context)
        Log.d(TAG, "getPendingNavigation called: ${feedId?.take(8) ?: "null"}...")
        return feedId ?: ""
    }

    /**
     * Clear pending feed navigation after TypeScript has processed it.
     * Call this after navigating to prevent re-navigation on next app open.
     */
    @JavascriptInterface
    fun clearPendingNavigation() {
        Log.d(TAG, "clearPendingNavigation called")
        FcmService.clearPendingNavigation(context)
    }
}
