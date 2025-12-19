/**
 * Notification Manager
 *
 * Platform-agnostic notification handling that routes to the appropriate
 * notification system based on the runtime environment:
 * - Browser: In-app toast notifications
 * - Tauri: Native OS notifications (Windows/Mac/Linux)
 * - Mobile PWA: Web Push notifications
 */

import { detectPlatform, type Platform } from '../platform';

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
  async showNotification(event: NotificationEvent): Promise<void> {
    // Browser uses in-app toasts which are handled directly
    // in useNotifications via the addToast callback
    console.log('[BrowserNotificationHandler] showNotification called (handled by toast system)');
  }

  async clearNotification(feedId: string): Promise<void> {
    console.log(`[BrowserNotificationHandler] clearNotification called for feed: ${feedId}`);
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

      console.log(`[TauriNotificationHandler] Initialized, permission: ${permission}`);
      return permission;
    } catch (error) {
      console.error('[TauriNotificationHandler] Failed to initialize:', error);
      this.initialized = true;
      return false;
    }
  }

  async showNotification(event: NotificationEvent): Promise<void> {
    const hasPermission = await this.ensureInitialized();

    if (!hasPermission) {
      console.log('[TauriNotificationHandler] No permission for notifications');
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

      console.log(`[TauriNotificationHandler] Sent notification from ${event.senderName}`);
    } catch (error) {
      console.error('[TauriNotificationHandler] Failed to show notification:', error);
    }
  }

  async clearNotification(feedId: string): Promise<void> {
    // Native notifications are automatically cleared by the OS
    // when user interacts with them
    console.log(`[TauriNotificationHandler] clearNotification for feed: ${feedId} (handled by OS)`);
  }

  isSupported(): boolean {
    return detectPlatform() === 'tauri';
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
      console.log('[MobilePWANotificationHandler] Notifications not supported');
      return;
    }

    if (Notification.permission !== 'granted') {
      console.log('[MobilePWANotificationHandler] No notification permission');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(event.senderName || 'Hush Feeds', {
        body: event.messagePreview || 'New message',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        tag: `feed-${event.feedId}`,
        data: { feedId: event.feedId },
      });
    } catch (error) {
      console.error('[MobilePWANotificationHandler] Failed to show notification:', error);
    }
  }

  async clearNotification(feedId: string): Promise<void> {
    try {
      const registration = await navigator.serviceWorker.ready;
      const notifications = await registration.getNotifications({ tag: `feed-${feedId}` });
      notifications.forEach(n => n.close());
    } catch (error) {
      console.error('[MobilePWANotificationHandler] Failed to clear notification:', error);
    }
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

  const platform = detectPlatform();
  console.log(`[NotificationManager] Creating handler for platform: ${platform}`);

  switch (platform) {
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
