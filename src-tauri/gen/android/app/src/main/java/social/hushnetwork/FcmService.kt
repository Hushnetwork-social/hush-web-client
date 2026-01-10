package social.hushnetwork

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ProcessLifecycleOwner
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.tasks.await

/**
 * Firebase Cloud Messaging Service for HushNetwork
 *
 * Handles FCM token retrieval, storage, and refresh callbacks.
 * Token is stored in SharedPreferences for persistence and change detection.
 */
class FcmService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "FcmService"
        private const val PREFS_NAME = "hush_fcm_prefs"
        private const val KEY_FCM_TOKEN = "fcm_token"
        private const val KEY_TOKEN_CHANGED = "token_changed"
        private const val KEY_PENDING_NAVIGATION = "pending_feed_navigation"

        // Default values for missing notification fields
        private const val DEFAULT_TITLE = "Hush Feeds"
        private const val DEFAULT_BODY = "You have a new message"
        private const val MAX_BODY_LENGTH = 255
        private const val MAX_TITLE_LENGTH = 100

        /**
         * Get the stored FCM token from SharedPreferences
         * @return The stored token, or null if not available
         */
        fun getStoredToken(context: Context): String? {
            val prefs = getPrefs(context)
            return prefs.getString(KEY_FCM_TOKEN, null)
        }

        /**
         * Check if the token has changed since last check
         * Clears the flag after reading
         * @return true if token changed, false otherwise
         */
        fun hasTokenChanged(context: Context): Boolean {
            val prefs = getPrefs(context)
            val changed = prefs.getBoolean(KEY_TOKEN_CHANGED, false)
            if (changed) {
                prefs.edit().putBoolean(KEY_TOKEN_CHANGED, false).apply()
            }
            return changed
        }

        /**
         * Request the current FCM token from Firebase
         * This is an async operation that should be called from a coroutine
         * @return The FCM token, or null if retrieval failed
         */
        suspend fun requestToken(context: Context): String? {
            return try {
                val token = FirebaseMessaging.getInstance().token.await()
                if (token != null) {
                    storeToken(context, token)
                }
                Log.d(TAG, "FCM token retrieved successfully")
                token
            } catch (e: Exception) {
                Log.e(TAG, "Failed to retrieve FCM token", e)
                null
            }
        }

        /**
         * Get the current FCM token synchronously
         * Returns stored token if available, otherwise null
         * Use requestToken() for fresh token retrieval
         */
        fun getCurrentToken(context: Context): String? {
            return getStoredToken(context)
        }

        /**
         * Store the FCM token in SharedPreferences
         * Also sets the token_changed flag if the token is different
         */
        private fun storeToken(context: Context, token: String) {
            val prefs = getPrefs(context)
            val oldToken = prefs.getString(KEY_FCM_TOKEN, null)
            val tokenChanged = oldToken != null && oldToken != token

            prefs.edit()
                .putString(KEY_FCM_TOKEN, token)
                .putBoolean(KEY_TOKEN_CHANGED, tokenChanged)
                .apply()

            if (tokenChanged) {
                Log.d(TAG, "FCM token changed, flag set for re-registration")
            }
        }

        /**
         * Clear the stored token (for logout scenarios)
         */
        fun clearToken(context: Context) {
            val prefs = getPrefs(context)
            prefs.edit()
                .remove(KEY_FCM_TOKEN)
                .remove(KEY_TOKEN_CHANGED)
                .apply()
            Log.d(TAG, "FCM token cleared")
        }

        /**
         * Set pending feed navigation from notification tap.
         * Called by MainActivity when a notification tap intent is received.
         *
         * @param context The application context
         * @param feedId The feed ID to navigate to
         */
        fun setPendingNavigation(context: Context, feedId: String) {
            val prefs = getPrefs(context)
            prefs.edit().putString(KEY_PENDING_NAVIGATION, feedId).apply()
            Log.d(TAG, "Pending navigation set: ${feedId.take(8)}...")
        }

        /**
         * Get pending feed navigation from notification tap.
         * Called by Tauri command to retrieve the feedId for navigation.
         *
         * @param context The application context
         * @return The pending feedId, or null if none pending
         */
        fun getPendingNavigation(context: Context): String? {
            val prefs = getPrefs(context)
            return prefs.getString(KEY_PENDING_NAVIGATION, null)
        }

        /**
         * Clear pending feed navigation after TypeScript has processed it.
         * Called by Tauri command after navigation is complete.
         *
         * @param context The application context
         */
        fun clearPendingNavigation(context: Context) {
            val prefs = getPrefs(context)
            prefs.edit().remove(KEY_PENDING_NAVIGATION).apply()
            Log.d(TAG, "Pending navigation cleared")
        }

        private fun getPrefs(context: Context): SharedPreferences {
            return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        }
    }

    /**
     * Called when a new FCM token is issued by Firebase
     * This can happen when:
     * - App is restored on a new device
     * - User uninstalls/reinstalls the app
     * - User clears app data
     * - Firebase rotates the token
     */
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "FCM token refreshed")

        // Store the new token with change flag
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val oldToken = prefs.getString(KEY_FCM_TOKEN, null)

        prefs.edit()
            .putString(KEY_FCM_TOKEN, token)
            .putBoolean(KEY_TOKEN_CHANGED, oldToken != null)
            .apply()

        // Note: Server re-registration will be handled by TypeScript layer
        // when it detects the token_changed flag
    }

    /**
     * Called when a message is received from FCM
     * Displays a notification if the app is in the background or killed.
     * Suppresses notifications when app is in foreground (gRPC handles in-app notifications).
     */
    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        Log.d(TAG, "FCM message received from: ${message.from}")

        // Extract notification data from the FCM message
        val data = message.data
        if (data.isEmpty()) {
            Log.w(TAG, "FCM message has no data payload, skipping")
            return
        }

        // Log the received data for debugging
        Log.d(TAG, "FCM message data: $data")

        // Check if app is in foreground - suppress notification if so
        if (isAppInForeground()) {
            Log.i(TAG, "App is in foreground, suppressing notification (gRPC handles in-app)")
            return
        }

        // Extract and validate notification fields
        val notificationData = extractNotificationData(data)
        if (notificationData == null) {
            Log.e(TAG, "Failed to extract notification data, skipping")
            return
        }

        // Show the notification
        Log.i(TAG, "App is in background/killed, showing notification for feed: ${notificationData.feedId?.take(8) ?: "unknown"}...")
        NotificationHelper.showNotification(
            context = applicationContext,
            title = notificationData.title,
            body = notificationData.body,
            feedId = notificationData.feedId ?: ""
        )
    }

    /**
     * Check if the app is currently in the foreground.
     * Uses ProcessLifecycleOwner which is the recommended approach for Android.
     *
     * @return true if app is visible to user, false if background or killed
     */
    private fun isAppInForeground(): Boolean {
        return try {
            val lifecycle = ProcessLifecycleOwner.get().lifecycle
            lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)
        } catch (e: Exception) {
            // If lifecycle owner not available, assume background (safe default)
            Log.w(TAG, "Could not determine foreground state, assuming background", e)
            false
        }
    }

    /**
     * Extract and validate notification data from FCM message data payload.
     * Handles missing fields gracefully with defaults.
     *
     * @param data The FCM message data map
     * @return NotificationData if valid, null if completely invalid
     */
    private fun extractNotificationData(data: Map<String, String>): NotificationData? {
        // Extract fields with defaults for missing values
        var title = data["title"]?.trim()
        var body = data["body"]?.trim()
        val feedId = data["feedId"]?.trim()
        val type = data["type"]?.trim()

        // Log what we extracted
        Log.d(TAG, "Extracted - title: ${title?.take(20) ?: "null"}, body: ${body?.take(20) ?: "null"}, feedId: ${feedId?.take(8) ?: "null"}, type: $type")

        // Apply defaults for missing required fields
        if (title.isNullOrEmpty()) {
            Log.w(TAG, "Missing or empty title, using default")
            title = DEFAULT_TITLE
        }

        if (body.isNullOrEmpty()) {
            Log.w(TAG, "Missing or empty body, using default")
            body = DEFAULT_BODY
        }

        // Truncate long text
        if (body.length > MAX_BODY_LENGTH) {
            Log.d(TAG, "Body exceeds $MAX_BODY_LENGTH chars, truncating")
            body = body.take(MAX_BODY_LENGTH - 3) + "..."
        }

        if (title.length > MAX_TITLE_LENGTH) {
            Log.d(TAG, "Title exceeds $MAX_TITLE_LENGTH chars, truncating")
            title = title.take(MAX_TITLE_LENGTH - 3) + "..."
        }

        // Warn if feedId is missing (notification will work but no navigation)
        if (feedId.isNullOrEmpty()) {
            Log.w(TAG, "Missing feedId - notification will not navigate to specific feed")
        }

        return NotificationData(
            title = title,
            body = body,
            feedId = feedId,
            type = type
        )
    }

    /**
     * Data class to hold extracted notification data
     */
    private data class NotificationData(
        val title: String,
        val body: String,
        val feedId: String?,
        val type: String?
    )
}
