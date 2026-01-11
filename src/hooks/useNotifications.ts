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
import { fetchMessages } from '@/modules/feeds/FeedsService';
import { aesDecrypt } from '@/lib/crypto/encryption';
import { detectPlatform } from '@/lib/platform';
import { showNotification as showPlatformNotification } from '@/lib/notifications';
import { onMemberJoin, onVisibilityChange } from '@/lib/events';
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

  // Fetch new messages for a specific feed (called when notification arrives)
  const fetchMessagesForFeed = useCallback(
    async (feedId: string) => {
      const currentUserId = userIdRef.current;
      if (!currentUserId) return;

      try {
        debugLog(`[useNotifications] Fetching new messages for feed ${feedId.substring(0, 8)}...`);
        const { syncMetadata, feeds, addMessages, getGroupKeyState } = useFeedsStore.getState();

        // Fetch messages from the last synced block
        const response = await fetchMessages(currentUserId, syncMetadata.lastMessageBlockIndex, syncMetadata.lastReactionTallyVersion);

        // Filter for messages in this feed
        const feedMessages = response.messages.filter(m => m.feedId === feedId);

        if (feedMessages.length > 0) {
          debugLog(`[useNotifications] Found ${feedMessages.length} new message(s) for feed ${feedId.substring(0, 8)}...`);

          const feed = feeds.find(f => f.id === feedId);

          // Handle group feeds with multi-key decryption
          if (feed?.type === 'group') {
            const keyState = getGroupKeyState(feedId);
            if (keyState && keyState.keyGenerations.length > 0) {
              // Get all available AES keys, sorted by keyGeneration descending (try newest first)
              const keysToTry = [...keyState.keyGenerations]
                .filter(kg => kg.aesKey)
                .sort((a, b) => b.keyGeneration - a.keyGeneration);

              const decryptedMessages = await Promise.all(
                feedMessages.map(async (msg) => {
                  // Try each key until one works
                  for (const keyGen of keysToTry) {
                    try {
                      const decryptedContent = await aesDecrypt(msg.content, keyGen.aesKey);
                      return {
                        ...msg,
                        content: decryptedContent,
                        contentEncrypted: msg.content,
                        keyGeneration: keyGen.keyGeneration,
                        decryptionFailed: false,
                      };
                    } catch {
                      continue;
                    }
                  }
                  // All keys failed
                  return {
                    ...msg,
                    contentEncrypted: msg.content,
                    decryptionFailed: true,
                  };
                })
              );
              addMessages(feedId, decryptedMessages);
            } else {
              // No keys available for group feed
              addMessages(feedId, feedMessages.map(msg => ({
                ...msg,
                contentEncrypted: msg.content,
                decryptionFailed: true,
              })));
            }
          } else {
            // Non-group feeds: Use the single AES key
            const feedAesKey = feed?.aesKey;
            if (feedAesKey) {
              const decryptedMessages = await Promise.all(
                feedMessages.map(async (msg) => {
                  try {
                    const decryptedContent = await aesDecrypt(msg.content, feedAesKey);
                    return {
                      ...msg,
                      content: decryptedContent,
                      contentEncrypted: msg.content,
                    };
                  } catch {
                    return msg;
                  }
                })
              );
              addMessages(feedId, decryptedMessages);
            } else {
              addMessages(feedId, feedMessages);
            }
          }

          // Update sync metadata
          useFeedsStore.getState().setSyncMetadata({
            lastMessageBlockIndex: response.maxBlockIndex,
            lastReactionTallyVersion: response.maxReactionTallyVersion,
          });
        }
      } catch (error) {
        debugError('[useNotifications] Failed to fetch messages for feed:', error);
      }
    },
    []
  );

  // Decrypt message preview using feed's AES key (or group keys for group feeds)
  const decryptMessagePreview = useCallback(
    async (feedId: string, encryptedPreview: string): Promise<string> => {
      try {
        const feed = getFeed(feedId);

        // For group feeds, try all available keys
        if (feed?.type === 'group') {
          const keyState = useFeedsStore.getState().getGroupKeyState(feedId);
          if (keyState && keyState.keyGenerations.length > 0) {
            // Try keys from newest to oldest
            const keysToTry = [...keyState.keyGenerations]
              .filter(kg => kg.aesKey)
              .sort((a, b) => b.keyGeneration - a.keyGeneration);

            for (const keyGen of keysToTry) {
              try {
                const decrypted = await aesDecrypt(encryptedPreview, keyGen.aesKey);
                return decrypted;
              } catch {
                continue;
              }
            }
          }
          debugLog('[useNotifications] No group key could decrypt preview');
          return 'New message';
        }

        // Non-group feeds: use single AES key
        if (!feed?.aesKey) {
          debugLog('[useNotifications] No AES key for feed, showing fallback');
          return 'New message';
        }
        const decrypted = await aesDecrypt(encryptedPreview, feed.aesKey);
        return decrypted;
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

            // Fetch the new message so the feed list can show the updated preview
            // This runs in the background - don't block toast display
            fetchMessagesForFeed(event.feedId).catch((err) => {
              debugError('[useNotifications] Failed to fetch message for non-active feed:', err);
            });

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
            // User is viewing this feed - fetch the new message immediately
            debugLog(`[useNotifications] User viewing feed, fetching new messages: ${event.feedId}`);
            fetchMessagesForFeed(event.feedId);

            // Also tell server to mark as read so unread count stays at 0
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
      fetchMessagesForFeed,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // Always log connection attempts (critical for debugging)
    console.log('[useNotifications] Connecting to notification stream for user:', userId.substring(0, 20) + '...');

    abortControllerRef.current = notificationService.subscribeToEvents(
      userId,
      (event) => {
        console.log('[useNotifications] Received event:', event.type, 'feedId:', event.feedId);
        setIsConnected(true);
        handleEvent(event);
      },
      (error) => {
        console.error('[useNotifications] Stream error:', error);
        handleError(error);
      },
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
    console.log('[useNotifications] Auth state changed:', { isAuthenticated, hasUserId: !!userId });
    if (isAuthenticated && userId) {
      // Fetch initial unread counts
      fetchUnreadCounts();
      // Connect to event stream
      connect();
    } else {
      console.log('[useNotifications] Not authenticated or no userId, disconnecting');
      disconnect();
    }

    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, userId]);

  // Subscribe to member join events for toast notifications
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubscribe = onMemberJoin((event) => {
      debugLog(`[useNotifications] Member join event: ${event.member.displayName} joined ${event.feedName}`);

      // Use current selectedFeedId from ref (not stale closure)
      const currentSelectedFeedId = selectedFeedIdRef.current;

      // Only show notification if user is not currently viewing this group
      if (event.feedId !== currentSelectedFeedId) {
        const platform = detectPlatform();

        if (platform === 'tauri') {
          // Tauri: Use native OS notification
          showPlatformNotification({
            feedId: event.feedId,
            senderName: event.feedName,
            messagePreview: `${event.member.displayName} joined the group`,
            timestamp: event.timestamp,
          });
        } else {
          // Browser: Use in-app toast
          const toast: NotificationToast = {
            id: `member-join-${event.feedId}-${event.member.publicAddress}-${event.timestamp}`,
            feedId: event.feedId,
            senderName: event.feedName,
            messagePreview: `${event.member.displayName} joined the group`,
            timestamp: event.timestamp,
          };
          addToast(toast);
        }
      }
    });

    return unsubscribe;
  }, [isAuthenticated, addToast]);

  // Subscribe to visibility change events for toast notifications
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubscribe = onVisibilityChange((event) => {
      const visibilityText = event.isPublic ? 'Public' : 'Private';
      debugLog(`[useNotifications] Visibility change event: ${event.feedName} changed to ${visibilityText}`);

      // Use current selectedFeedId from ref (not stale closure)
      const currentSelectedFeedId = selectedFeedIdRef.current;

      // Only show notification if user is not currently viewing this group
      if (event.feedId !== currentSelectedFeedId) {
        const platform = detectPlatform();

        if (platform === 'tauri') {
          // Tauri: Use native OS notification
          showPlatformNotification({
            feedId: event.feedId,
            senderName: event.feedName,
            messagePreview: `Group visibility changed to ${visibilityText}`,
            timestamp: event.timestamp,
          });
        } else {
          // Browser: Use in-app toast
          const toast: NotificationToast = {
            id: `visibility-change-${event.feedId}-${event.timestamp}`,
            feedId: event.feedId,
            senderName: event.feedName,
            messagePreview: `Group visibility changed to ${visibilityText}`,
            timestamp: event.timestamp,
          };
          addToast(toast);
        }
      }
    });

    return unsubscribe;
  }, [isAuthenticated, addToast]);

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
