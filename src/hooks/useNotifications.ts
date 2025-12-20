/**
 * useNotifications Hook
 *
 * Manages real-time notification streaming and unread count synchronization.
 * Subscribes to server events and updates the feeds store accordingly.
 */

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useAppStore } from '@/stores';
import { useFeedsStore } from '@/modules/feeds';
import { notificationService } from '@/lib/grpc/services';
import { aesDecrypt } from '@/lib/crypto/encryption';
import { detectPlatform } from '@/lib/platform';
import { showNotification as showPlatformNotification } from '@/lib/notifications';
import type { FeedEventResponse } from '@/lib/grpc/grpc-web-helper';
import { debugLog, debugError } from '@/lib/debug-logger';

// Event types matching proto enum
const EventType = {
  Unspecified: 0,
  NewMessage: 1,
  MessagesRead: 2,
  UnreadCountSync: 3,
} as const;

export interface NotificationToast {
  id: string;
  feedId: string;
  senderName: string;
  messagePreview: string;
  timestamp: number;
}

export interface UseNotificationsOptions {
  /** Callback when a new message notification is received */
  onNewMessage?: (event: FeedEventResponse) => void;
  /** Whether to auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Reconnect delay in ms (default: 5000) */
  reconnectDelay?: number;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { onNewMessage, autoReconnect = true, reconnectDelay = 5000 } = options;

  const { isAuthenticated, credentials } = useAppStore();
  const selectedFeedId = useAppStore((state) => state.selectedFeedId);
  const {
    setUnreadCount,
    incrementUnreadCount,
    markFeedAsRead: markFeedAsReadInStore,
    syncUnreadCounts,
    getFeed,
  } = useFeedsStore();

  const [isConnected, setIsConnected] = useState(false);
  const [toasts, setToasts] = useState<NotificationToast[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const userId = credentials?.signingPublicKey;

  // Use refs for values that need to be accessed in the streaming callback
  // (to avoid stale closure issues)
  const selectedFeedIdRef = useRef(selectedFeedId);
  selectedFeedIdRef.current = selectedFeedId;

  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  // Add a toast notification
  const addToast = useCallback((toast: NotificationToast) => {
    setToasts((prev) => [...prev, toast]);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, 5000);
  }, []);

  // Remove a toast
  const dismissToast = useCallback((toastId: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  // Decrypt message preview using feed's AES key
  const decryptMessagePreview = useCallback(
    async (feedId: string, encryptedPreview: string): Promise<string> => {
      try {
        const feed = getFeed(feedId);
        if (!feed?.aesKey) {
          debugLog('[useNotifications] No AES key for feed, showing fallback');
          return 'New message';
        }
        const decrypted = await aesDecrypt(encryptedPreview, feed.aesKey);
        // Truncate if too long
        return decrypted.length > 100 ? decrypted.slice(0, 100) + '...' : decrypted;
      } catch (error) {
        debugError('[useNotifications] Failed to decrypt message preview:', error);
        return 'New message';
      }
    },
    [getFeed]
  );

  // Handle incoming events
  const handleEvent = useCallback(
    async (event: FeedEventResponse) => {
      // Use ref to get current selectedFeedId (not stale from callback closure)
      const currentSelectedFeedId = selectedFeedIdRef.current;
      debugLog(`[useNotifications] Processing event: type=${event.type} (expected NewMessage=${EventType.NewMessage}), feedId=${event.feedId}, selectedFeedId=${currentSelectedFeedId}`);

      switch (event.type) {
        case EventType.NewMessage:
          // Only update unread count and show toast if NOT viewing this feed
          if (event.feedId !== currentSelectedFeedId) {
            // Update unread count
            if (event.unreadCount !== undefined) {
              setUnreadCount(event.feedId, event.unreadCount);
            } else {
              incrementUnreadCount(event.feedId);
            }

            // Decrypt message preview for notification
            const decryptedPreview = event.messagePreview
              ? await decryptMessagePreview(event.feedId, event.messagePreview)
              : 'New message';

            const platform = detectPlatform();

            if (platform === 'tauri') {
              // Tauri: Use native OS notification
              await showPlatformNotification({
                feedId: event.feedId,
                senderName: event.senderName || 'Unknown',
                messagePreview: decryptedPreview,
                timestamp: event.timestampUnixMs,
              });
            } else {
              // Browser: Use in-app toast
              const toast: NotificationToast = {
                id: `${event.feedId}-${event.timestampUnixMs}`,
                feedId: event.feedId,
                senderName: event.senderName || 'Unknown',
                messagePreview: decryptedPreview,
                timestamp: event.timestampUnixMs,
              };
              addToast(toast);
            }
            onNewMessage?.(event);
          } else {
            // User is viewing this feed - tell server to mark as read
            // so unread count stays at 0 even if they disconnect
            debugLog(`[useNotifications] User viewing feed, marking as read: ${event.feedId}`);
            const currentUserId = userIdRef.current;
            if (currentUserId) {
              notificationService.markFeedAsRead(currentUserId, event.feedId).catch((err) => {
                debugError('[useNotifications] Failed to mark viewed feed as read:', err);
              });
            }
          }
          break;

        case EventType.MessagesRead:
          // Another device marked feed as read
          markFeedAsReadInStore(event.feedId);
          break;

        case EventType.UnreadCountSync:
          // Full sync of unread counts (on reconnect)
          if (event.allCounts && Object.keys(event.allCounts).length > 0) {
            syncUnreadCounts(event.allCounts);
          }
          break;
      }
    },
    [
      // Note: selectedFeedId is accessed via ref, not as dependency
      setUnreadCount,
      incrementUnreadCount,
      markFeedAsReadInStore,
      syncUnreadCounts,
      addToast,
      onNewMessage,
      decryptMessagePreview,
    ]
  );

  // Handle connection errors
  const handleError = useCallback(
    (error: Error) => {
      debugError('[useNotifications] Stream error:', error);
      setIsConnected(false);

      if (autoReconnect) {
        debugLog(`[useNotifications] Reconnecting in ${reconnectDelay}ms...`);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, reconnectDelay);
      }
    },
    [autoReconnect, reconnectDelay]
  );

  // Connect to notification stream
  const connect = useCallback(() => {
    if (!userId) {
      debugLog('[useNotifications] No userId, skipping connection');
      return;
    }

    // Cleanup previous connection
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    debugLog('[useNotifications] Connecting to notification stream...');

    abortControllerRef.current = notificationService.subscribeToEvents(
      userId,
      (event) => {
        setIsConnected(true);
        handleEvent(event);
      },
      handleError,
      `browser-${Date.now()}`,
      'browser'
    );

    setIsConnected(true);
  }, [userId, handleEvent, handleError]);

  // Disconnect from notification stream
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setIsConnected(false);
  }, []);

  // Fetch initial unread counts
  const fetchUnreadCounts = useCallback(async () => {
    if (!userId) return;

    try {
      const counts = await notificationService.getUnreadCounts(userId);
      if (Object.keys(counts).length > 0) {
        syncUnreadCounts(counts);
      }
    } catch (error) {
      debugError('[useNotifications] Failed to fetch unread counts:', error);
    }
  }, [userId, syncUnreadCounts]);

  // Mark feed as read (calls server and updates store)
  const markAsRead = useCallback(
    async (feedId: string) => {
      if (!userId) return;

      // Optimistic update
      markFeedAsReadInStore(feedId);

      try {
        await notificationService.markFeedAsRead(userId, feedId);
      } catch (error) {
        debugError('[useNotifications] Failed to mark feed as read:', error);
        // Could revert optimistic update here if needed
      }
    },
    [userId, markFeedAsReadInStore]
  );

  // Connect when authenticated
  useEffect(() => {
    if (isAuthenticated && userId) {
      // Fetch initial unread counts
      fetchUnreadCounts();
      // Connect to event stream
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [isAuthenticated, userId]);

  return {
    isConnected,
    toasts,
    dismissToast,
    markAsRead,
    fetchUnreadCounts,
    connect,
    disconnect,
  };
}
