package social.hushnetwork

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

/**
 * Notification Helper for HushNetwork
 *
 * Handles notification channel creation and notification display.
 * Used by FcmService to show push notifications when the app is in background.
 */
object NotificationHelper {

    private const val TAG = "NotificationHelper"

    // Channel configuration
    const val CHANNEL_ID = "hush_messages"
    private const val CHANNEL_NAME = "Messages"
    private const val CHANNEL_DESCRIPTION = "Message notifications from Hush Feeds"

    // Intent extras for notification tap handling
    const val EXTRA_FEED_ID = "feed_id"
    const val EXTRA_FROM_NOTIFICATION = "from_notification"

    // Notification color (Violet-400: #8B5CF6)
    private const val NOTIFICATION_COLOR = 0xFF8B5CF6.toInt()

    /**
     * Create the notification channel for messages
     * Must be called before showing any notification (Android 8.0+)
     * Safe to call multiple times - Android handles duplicates gracefully
     */
    fun createChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = CHANNEL_DESCRIPTION
                enableLights(true)
                lightColor = NOTIFICATION_COLOR
                enableVibration(true)
                setShowBadge(true)
            }

            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
            Log.d(TAG, "Notification channel created: $CHANNEL_ID")
        }
    }

    /**
     * Show a notification for an incoming message
     *
     * @param context Application context
     * @param title Notification title (e.g., sender name)
     * @param body Notification body (e.g., message preview)
     * @param feedId The feed ID to navigate to when tapped
     */
    fun showNotification(context: Context, title: String, body: String, feedId: String) {
        // Create intent to launch MainActivity with feed ID
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_FEED_ID, feedId)
            putExtra(EXTRA_FROM_NOTIFICATION, true)
        }

        // Create PendingIntent with appropriate flags
        val pendingIntentFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            feedId.hashCode(), // Unique request code per feed
            intent,
            pendingIntentFlags
        )

        // Build the notification
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher) // App icon
            .setContentTitle(title)
            .setContentText(body)
            .setColor(NOTIFICATION_COLOR)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setAutoCancel(true) // Dismiss on tap
            .setContentIntent(pendingIntent)
            .setDefaults(NotificationCompat.DEFAULT_SOUND or NotificationCompat.DEFAULT_VIBRATE)
            .build()

        // Use feedId hashCode as notification ID for replacement behavior
        val notificationId = feedId.hashCode()

        try {
            NotificationManagerCompat.from(context).notify(notificationId, notification)
            Log.d(TAG, "Notification shown for feed: ${feedId.take(8)}...")
        } catch (e: SecurityException) {
            // Permission not granted - this is expected if user denied
            Log.w(TAG, "Cannot show notification - permission not granted", e)
        }
    }
}
