package social.hushnetwork

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MainActivity : TauriActivity() {
    companion object {
        private const val TAG = "MainActivity"
    }

    // Permission request launcher for Android 13+
    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted: Boolean ->
        if (isGranted) {
            Log.d(TAG, "Notification permission granted")
            // Request FCM token now that we have permission
            requestFcmToken()
        } else {
            Log.d(TAG, "Notification permission denied")
            // App will work without push notifications
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        // Create notification channel (safe to call multiple times)
        NotificationHelper.createChannel(this)

        // Handle notification tap intent (if launched from notification)
        handleNotificationIntent(intent)

        // Check and request notification permission
        checkNotificationPermission()
    }

    /**
     * Handle new intent when app is already running (notification tap while in background)
     */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleNotificationIntent(intent)
    }

    /**
     * Handle notification tap intent extras.
     * Extracts feedId from the notification PendingIntent and stores it for TypeScript to consume.
     *
     * @param intent The intent to check for notification extras
     */
    private fun handleNotificationIntent(intent: Intent?) {
        intent?.let {
            val fromNotification = it.getBooleanExtra(NotificationHelper.EXTRA_FROM_NOTIFICATION, false)
            if (fromNotification) {
                val feedId = it.getStringExtra(NotificationHelper.EXTRA_FEED_ID)
                if (!feedId.isNullOrEmpty()) {
                    Log.d(TAG, "Notification tap with feedId: ${feedId.take(8)}...")
                    // Store for TypeScript to consume via Tauri command
                    FcmService.setPendingNavigation(this, feedId)
                } else {
                    Log.d(TAG, "Notification tap without feedId")
                }
            }
        }
    }

    /**
     * Check notification permission status and request if needed
     * Only required on Android 13+ (API 33 / TIRAMISU)
     */
    private fun checkNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            when {
                ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED -> {
                    Log.d(TAG, "Notification permission already granted")
                    requestFcmToken()
                }
                shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS) -> {
                    // User previously denied, but we can explain why we need it
                    // For now, just request again - UI can show rationale later
                    Log.d(TAG, "Requesting notification permission (rationale available)")
                    requestPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
                else -> {
                    // First time asking for permission
                    Log.d(TAG, "Requesting notification permission (first time)")
                    requestPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
            }
        } else {
            // Android 12 and below - permission granted by default
            Log.d(TAG, "Android < 13, notification permission implicit")
            requestFcmToken()
        }
    }

    /**
     * Request FCM token after permission is granted
     */
    private fun requestFcmToken() {
        CoroutineScope(Dispatchers.IO).launch {
            val token = FcmService.requestToken(this@MainActivity)
            if (token != null) {
                Log.d(TAG, "FCM token obtained: ${token.take(20)}...")
            } else {
                Log.w(TAG, "Failed to obtain FCM token")
            }
        }
    }

    /**
     * Check if notification permission is granted
     * Called from Tauri commands via bridge
     */
    fun hasNotificationPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true // Implicit permission on Android < 13
        }
    }

    /**
     * Get the current FCM token
     * Called from Tauri commands via bridge
     */
    fun getFcmToken(): String? {
        return FcmService.getCurrentToken(this)
    }

    /**
     * Get device name for push notification registration
     */
    fun getDeviceName(): String {
        val manufacturer = Build.MANUFACTURER
        val model = Build.MODEL
        return if (model.startsWith(manufacturer, ignoreCase = true)) {
            model
        } else {
            "$manufacturer $model"
        }
    }
}
