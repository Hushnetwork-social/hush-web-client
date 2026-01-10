/**
 * Notification Manager
 *
 * Platform-agnostic notification handling that routes to the appropriate
 * notification system based on the runtime environment:
 * - Browser: In-app toast notifications
 * - Tauri Desktop: Native OS notifications (Windows/Mac/Linux)
 * - Tauri Android: No-op (handled by FCM push notifications)
 * - Tauri iOS: No-op (handled by APNs push notifications)
 * - Mobile PWA: Web Push notifications
 */

import { detectPlatform, type Platform } from '../platform';
import { debugLog, debugError } from '../debug-logger';

export interface NotificationEvent {
  feedId: string;
  senderName: string;
  messagePreview: string;
  timestamp: number;
}

export interface NotificationHandler {
  showNotification(event: NotificationEvent): Promise<void>;
  clearNotification(feedId: string): Promise<void>;
  isSupported(): boolean;
}

/**
 * Browser notification handler - shows in-app toasts
 * (Already handled by useNotifications hook and InAppToastContainer)
 */
class BrowserNotificationHandler implements NotificationHandler {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async showNotification(_event: NotificationEvent): Promise<void> {
    // Browser uses in-app toasts which are handled directly
    // in useNotifications via the addToast callback
    debugLog('[BrowserNotificationHandler] showNotification called (handled by toast system)');
  }

  async clearNotification(feedId: string): Promise<void> {
    debugLog(`[BrowserNotificationHandler] clearNotification called for feed: ${feedId}`);
  }

  isSupported(): boolean {
    return true;
  }
}

/**
 * Tauri notification handler - uses native OS notifications
 */
class TauriNotificationHandler implements NotificationHandler {
  private initialized = false;
  private permissionGranted = false;

  private async ensureInitialized(): Promise<boolean> {
    if (this.initialized) {
      return this.permissionGranted;
    }

    try {
      // Dynamic import for Tauri - only loads when in Tauri environment
      const notification = await import('@tauri-apps/plugin-notification');

      // Check if permission is already granted
      let permission = await notification.isPermissionGranted();

      if (!permission) {
        // Request permission
        const result = await notification.requestPermission();
        permission = result === 'granted';
      }

      this.permissionGranted = permission;
      this.initialized = true;

      debugLog(`[TauriNotificationHandler] Initialized, permission: ${permission}`);
      return permission;
    } catch (error) {
      debugError('[TauriNotificationHandler] Failed to initialize:', error);
      this.initialized = true;
      return false;
    }
  }

  async showNotification(event: NotificationEvent): Promise<void> {
    const hasPermission = await this.ensureInitialized();

    if (!hasPermission) {
      debugLog('[TauriNotificationHandler] No permission for notifications');
      return;
    }

    try {
      const notification = await import('@tauri-apps/plugin-notification');

      await notification.sendNotification({
        title: event.senderName || 'Hush Feeds',
        body: event.messagePreview || 'New message',
        // Note: Tauri 2.0 uses different options - actions, attachments etc.
        // are configured differently than v1
      });

      debugLog(`[TauriNotificationHandler] Sent notification from ${event.senderName}`);
    } catch (error) {
      debugError('[TauriNotificationHandler] Failed to show notification:', error);
    }
  }

  async clearNotification(feedId: string): Promise<void> {
    // Native notifications are automatically cleared by the OS
    // when user interacts with them
    debugLog(`[TauriNotificationHandler] clearNotification for feed: ${feedId} (handled by OS)`);
  }

  isSupported(): boolean {
    return detectPlatform() === 'tauri';
  }
}

/**
 * Tauri Mobile notification handler - for Android (FCM) and iOS (APNs)
 *
 * On mobile, push notifications are handled by the OS through FCM/APNs.
 * When the app is open, we use in-app toasts (like browser).
 * When the app is closed, FCM/APNs delivers the notification directly.
 *
 * This handler is intentionally a no-op for showNotification because:
 * 1. When app is OPEN: In-app toasts are shown via real-time gRPC events
 * 2. When app is CLOSED: FCM/APNs delivers the push notification
 */
class TauriMobileNotificationHandler implements NotificationHandler {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async showNotification(_event: NotificationEvent): Promise<void> {
    // On mobile, notifications while app is open are handled by in-app toasts
    // Push notifications (when app is closed) are delivered by FCM/APNs
    debugLog('[TauriMobileNotificationHandler] showNotification called (handled by FCM/APNs or in-app toast)');
  }

  async clearNotification(feedId: string): Promise<void> {
    debugLog(`[TauriMobileNotificationHandler] clearNotification for feed: ${feedId} (handled by OS)`);
  }

  isSupported(): boolean {
    const platform = detectPlatform();
    return platform === 'tauri-android' || platform === 'tauri-ios';
  }
}

/**
 * Mobile PWA notification handler - uses Web Push API
 * (Future implementation for mobile PWA support)
 */
class MobilePWANotificationHandler implements NotificationHandler {
  async showNotification(event: NotificationEvent): Promise<void> {
    // Check if notification API is available
    if (!('Notification' in window)) {
      debugLog('[MobilePWANotificationHandler] Notifications not supported');
      return;
    }

    if (Notification.permission !== 'granted') {
      debugLog('[MobilePWANotificationHandler] No notification permission');
      return;
    }

    try {
      // Use the Notification API directly (works without service worker when app is open)
      new Notification(event.senderName || 'Hush Feeds', {
        body: event.messagePreview || 'New message',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        tag: `feed-${event.feedId}`,
        data: { feedId: event.feedId },
      });

      debugLog(`[MobilePWANotificationHandler] Sent notification from ${event.senderName}`);
    } catch (error) {
      debugError('[MobilePWANotificationHandler] Failed to show notification:', error);
    }
  }

  async clearNotification(feedId: string): Promise<void> {
    // Native notifications are automatically cleared when tapped
    debugLog(`[MobilePWANotificationHandler] clearNotification for feed: ${feedId}`);
  }

  isSupported(): boolean {
    return 'Notification' in window && 'serviceWorker' in navigator;
  }
}

// Singleton notification handler
let notificationHandler: NotificationHandler | null = null;

/**
 * Get the appropriate notification handler for the current platform
 */
export function getNotificationHandler(): NotificationHandler {
  if (notificationHandler) {
    return notificationHandler;
  }

  const platform: Platform = detectPlatform();
  debugLog(`[NotificationManager] Creating handler for platform: ${platform}`);

  switch (platform) {
    case 'tauri-android':
    case 'tauri-ios':
      notificationHandler = new TauriMobileNotificationHandler();
      break;
    case 'tauri':
      notificationHandler = new TauriNotificationHandler();
      break;
    case 'mobile-pwa':
      notificationHandler = new MobilePWANotificationHandler();
      break;
    default:
      notificationHandler = new BrowserNotificationHandler();
  }

  return notificationHandler;
}

/**
 * Show a notification using the appropriate platform handler
 */
export async function showNotification(event: NotificationEvent): Promise<void> {
  const handler = getNotificationHandler();
  await handler.showNotification(event);
}

/**
 * Clear a notification for a specific feed
 */
export async function clearNotification(feedId: string): Promise<void> {
  const handler = getNotificationHandler();
  await handler.clearNotification(feedId);
}
