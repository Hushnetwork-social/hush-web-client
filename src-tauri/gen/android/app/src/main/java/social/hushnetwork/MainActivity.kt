package social.hushnetwork

import android.Manifest
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

        // Check and request notification permission
        checkNotificationPermission()
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
