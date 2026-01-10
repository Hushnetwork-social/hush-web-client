package social.hushnetwork

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
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
     * Note: Push notification display is handled in FEAT-030
     */
    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        Log.d(TAG, "FCM message received from: ${message.from}")

        // Message handling will be implemented in FEAT-030
        // For now, just log that we received it
    }
}
