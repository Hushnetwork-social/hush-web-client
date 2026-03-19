package social.hushnetwork

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.database.Cursor
import android.os.Build
import android.os.Environment
import android.util.Log
import android.webkit.JavascriptInterface
import androidx.core.content.FileProvider
import java.io.File

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

    /**
     * Get pending deep link path from App Link URL.
     * When the app is opened via a deep link (e.g., https://chat.hushnetwork.social/join/ABC123),
     * the path is stored. This retrieves that path for TypeScript to navigate to.
     *
     * @return The URL path to navigate to (e.g., "/join/ABC123"), or empty string if none pending
     */
    @JavascriptInterface
    fun getPendingDeepLink(): String {
        val path = FcmService.getPendingDeepLink(context)
        Log.d(TAG, "getPendingDeepLink called: ${path ?: "null"}")
        return path ?: ""
    }

    /**
     * Clear pending deep link after TypeScript has processed it.
     * Call this after navigating to prevent re-navigation on next app open.
     */
    @JavascriptInterface
    fun clearPendingDeepLink() {
        Log.d(TAG, "clearPendingDeepLink called")
        FcmService.clearPendingDeepLink(context)
    }

    /**
     * Download an APK via Android's DownloadManager and hand it off to the
     * package installer when the download completes.
     *
     * @return true if the download was successfully queued
     */
    @JavascriptInterface
    fun downloadAndInstallApk(url: String): Boolean {
        return try {
            val uri = android.net.Uri.parse(url)
            val downloadManager =
                context.getSystemService(Context.DOWNLOAD_SERVICE) as? DownloadManager
                    ?: return false

            val fileName = uri.lastPathSegment?.takeIf { it.endsWith(".apk") }
                ?: "hush-feeds-update.apk"

            val request = DownloadManager.Request(uri)
                .setTitle("Hush Feeds update")
                .setDescription("Downloading update package")
                .setMimeType("application/vnd.android.package-archive")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setAllowedOverMetered(true)
                .setAllowedOverRoaming(true)
                .setDestinationInExternalFilesDir(
                    context,
                    Environment.DIRECTORY_DOWNLOADS,
                    fileName
                )

            val downloadId = downloadManager.enqueue(request)
            Log.d(TAG, "downloadAndInstallApk queued: id=$downloadId, file=$fileName")

            val receiver = object : android.content.BroadcastReceiver() {
                override fun onReceive(ctx: Context?, intent: Intent?) {
                    val completedDownloadId = intent?.getLongExtra(
                        DownloadManager.EXTRA_DOWNLOAD_ID,
                        -1L
                    ) ?: -1L

                    if (completedDownloadId != downloadId) {
                        return
                    }

                    try {
                        context.unregisterReceiver(this)
                    } catch (_: IllegalArgumentException) {
                    }

                    val query = DownloadManager.Query().setFilterById(downloadId)
                    val cursor: Cursor = downloadManager.query(query) ?: return
                    cursor.use {
                        if (!it.moveToFirst()) {
                            Log.w(TAG, "downloadAndInstallApk: download row not found")
                            return
                        }

                        val status = it.getInt(
                            it.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)
                        )

                        if (status != DownloadManager.STATUS_SUCCESSFUL) {
                            val reason = it.getInt(
                                it.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)
                            )
                            Log.w(TAG, "downloadAndInstallApk failed: status=$status reason=$reason")
                            return
                        }

                        val downloadsDir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
                        val downloadedFile = File(downloadsDir, fileName)
                        val apkUri = FileProvider.getUriForFile(
                            context,
                            "${context.packageName}.fileprovider",
                            downloadedFile
                        )

                        val installIntent = Intent(Intent.ACTION_VIEW).apply {
                            setDataAndType(apkUri, "application/vnd.android.package-archive")
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        }

                        Log.d(TAG, "Launching installer for downloaded APK: $fileName")
                        context.startActivity(installIntent)
                    }
                }
            }

            val filter = IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                @Suppress("DEPRECATION")
                context.registerReceiver(receiver, filter)
            }

            true
        } catch (error: Exception) {
            Log.e(TAG, "downloadAndInstallApk failed", error)
            false
        }
    }
}
