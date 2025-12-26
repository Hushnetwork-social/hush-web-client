/**
 * Feeds Module Store
 *
 * Zustand store for feeds and messages state.
 * UI components subscribe to this store for reactive updates.
 *
 * See MemoryBank/HushWebClient/SYNC_ARCHITECTURE.md for full documentation.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Feed, FeedMessage } from '@/types';
import { debugLog } from '@/lib/debug-logger';

// Feed type mapping from server (FeedType enum)
export const FEED_TYPE_MAP: Record<number, Feed['type']> = {
  0: 'personal',
  1: 'chat',
  2: 'group',
  3: 'broadcast',
};

interface FeedsSyncMetadata {
  lastFeedBlockIndex: number;
  lastMessageBlockIndex: number;
  /** Last reaction tally version synced (Protocol Omega) */
  lastReactionTallyVersion: number;
  isPersonalFeedCreationPending: boolean;
  /** Block index when personal feed creation was initiated (for timeout tracking) */
  personalFeedCreationBlockIndex: number;
}

interface FeedsState {
  /** List of feeds for the current user */
  feeds: Feed[];

  /** Messages indexed by feed ID */
  messages: Record<string, FeedMessage[]>;

  /** Sync metadata for incremental sync */
  syncMetadata: FeedsSyncMetadata;

  /** Whether feeds are currently being synced */
  isSyncing: boolean;

  /** Whether personal feed is being created */
  isCreatingPersonalFeed: boolean;

  /** Last sync error, if any */
  lastError: string | null;
}

interface FeedsActions {
  /** Set the feeds list (sorts with personal feed first) */
  setFeeds: (feeds: Feed[]) => void;

  /** Add new feeds (merges and deduplicates) */
  addFeeds: (newFeeds: Feed[]) => void;

  /** Check if personal feed exists */
  hasPersonalFeed: () => boolean;

  /** Get personal feed if it exists */
  getPersonalFeed: () => Feed | undefined;

  /** Get a feed by ID */
  getFeed: (feedId: string) => Feed | undefined;

  /** Get a message by ID (searches across all feeds) */
  getMessageById: (messageId: string) => FeedMessage | undefined;

  /** Update a feed's AES key (after decryption) */
  updateFeedAesKey: (feedId: string, aesKey: string) => void;

  /** Update a feed's display name (after participant identity update) */
  updateFeedName: (feedId: string, name: string) => void;

  /** Set messages for a specific feed */
  setMessages: (feedId: string, messages: FeedMessage[]) => void;

  /** Add messages to a specific feed (handles confirmation of pending messages) */
  addMessages: (feedId: string, newMessages: FeedMessage[]) => void;

  /** Add a pending message (optimistic UI - isConfirmed=false) */
  addPendingMessage: (feedId: string, message: FeedMessage) => void;

  /** Update sync metadata */
  setSyncMetadata: (metadata: Partial<FeedsSyncMetadata>) => void;

  /** Set personal feed creation pending status */
  setPersonalFeedCreationPending: (pending: boolean) => void;

  /** Set syncing status */
  setSyncing: (syncing: boolean) => void;

  /** Set creating personal feed status */
  setCreatingPersonalFeed: (creating: boolean) => void;

  /** Set error state */
  setError: (error: string | null) => void;

  /** Reset store to initial state (on logout) */
  reset: () => void;

  // ============= Unread Count Actions =============

  /** Set unread count for a specific feed */
  setUnreadCount: (feedId: string, count: number) => void;

  /** Increment unread count for a feed */
  incrementUnreadCount: (feedId: string) => void;

  /** Mark a feed as read (set unread count to 0) */
  markFeedAsRead: (feedId: string) => void;

  /** Sync all unread counts from server (bulk update) */
  syncUnreadCounts: (counts: Record<string, number>) => void;

  /** Get total unread count across all feeds */
  getTotalUnreadCount: () => number;
}

type FeedsStore = FeedsState & FeedsActions;

const initialState: FeedsState = {
  feeds: [],
  messages: {},
  syncMetadata: {
    lastFeedBlockIndex: 0,
    lastMessageBlockIndex: 0,
    lastReactionTallyVersion: 0,
    isPersonalFeedCreationPending: false,
    personalFeedCreationBlockIndex: 0,
  },
  isSyncing: false,
  isCreatingPersonalFeed: false,
  lastError: null,
};

/**
 * Sort feeds with personal feed first, then by updatedAt (newest first)
 */
function sortFeeds(feeds: Feed[]): Feed[] {
  return [...feeds].sort((a, b) => {
    if (a.type === 'personal') return -1;
    if (b.type === 'personal') return 1;
    return b.updatedAt - a.updatedAt;
  });
}

export const useFeedsStore = create<FeedsStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setFeeds: (feeds) => set({ feeds: sortFeeds(feeds) }),

      addFeeds: (newFeeds) => {
        const currentFeeds = get().feeds;
        const existingIds = new Set(currentFeeds.map((f) => f.id));
        const newFeedsMap = new Map(newFeeds.map((f) => [f.id, f]));

        // Update existing feeds with new data (e.g., encryptedFeedKey from server)
        const updatedFeeds = currentFeeds.map((existingFeed) => {
          const serverFeed = newFeedsMap.get(existingFeed.id);
          if (serverFeed) {
            // Merge server data, preserving local-only data like decrypted aesKey
            return {
              ...existingFeed,
              ...serverFeed,
              // Keep the decrypted aesKey if we have it
              aesKey: existingFeed.aesKey || serverFeed.aesKey,
            };
          }
          return existingFeed;
        });

        // Add truly new feeds
        const uniqueNewFeeds = newFeeds.filter((f) => !existingIds.has(f.id));
        const mergedFeeds = sortFeeds([...updatedFeeds, ...uniqueNewFeeds]);

        set({ feeds: mergedFeeds });
      },

      hasPersonalFeed: () => {
        return get().feeds.some((f) => f.type === 'personal');
      },

      getPersonalFeed: () => {
        return get().feeds.find((f) => f.type === 'personal');
      },

      getFeed: (feedId) => {
        return get().feeds.find((f) => f.id === feedId);
      },

      getMessageById: (messageId) => {
        const allMessages = get().messages;
        for (const feedMessages of Object.values(allMessages)) {
          const found = feedMessages.find((m) => m.id === messageId);
          if (found) return found;
        }
        return undefined;
      },

      updateFeedAesKey: (feedId, aesKey) => {
        set((state) => ({
          feeds: state.feeds.map((f) =>
            f.id === feedId ? { ...f, aesKey } : f
          ),
        }));
      },

      updateFeedName: (feedId, name) => {
        set((state) => ({
          feeds: state.feeds.map((f) =>
            f.id === feedId ? { ...f, name } : f
          ),
        }));
      },

      setMessages: (feedId, messages) =>
        set((state) => ({
          messages: {
            ...state.messages,
            [feedId]: messages,
          },
        })),

      addMessages: (feedId, newMessages) => {
        const currentMessages = get().messages[feedId] || [];
        const existingIds = new Set(currentMessages.map((m) => m.id));

        // Separate messages that need to confirm existing pending messages
        const messagesToConfirm: FeedMessage[] = [];
        const trulyNewMessages: FeedMessage[] = [];

        for (const msg of newMessages) {
          if (existingIds.has(msg.id)) {
            // This message already exists - it's a confirmation of a pending message
            messagesToConfirm.push(msg);
          } else {
            trulyNewMessages.push(msg);
          }
        }

        // Update state
        set((state) => {
          let updatedMessages = state.messages[feedId] || [];

          // Confirm pending messages by updating their isConfirmed status and metadata
          if (messagesToConfirm.length > 0) {
            const confirmIds = new Set(messagesToConfirm.map((m) => m.id));
            const confirmMap = new Map(messagesToConfirm.map((m) => [m.id, m]));

            updatedMessages = updatedMessages.map((msg) => {
              if (confirmIds.has(msg.id)) {
                const confirmedMsg = confirmMap.get(msg.id)!;
                return {
                  ...msg,
                  isConfirmed: true,
                  blockHeight: confirmedMsg.blockHeight,
                  timestamp: confirmedMsg.timestamp,
                };
              }
              return msg;
            });
          }

          // Add truly new messages
          if (trulyNewMessages.length > 0) {
            updatedMessages = [...updatedMessages, ...trulyNewMessages];
          }

          return {
            messages: {
              ...state.messages,
              [feedId]: updatedMessages,
            },
          };
        });
      },

      addPendingMessage: (feedId, message) => {
        set((state) => ({
          messages: {
            ...state.messages,
            [feedId]: [...(state.messages[feedId] || []), message],
          },
        }));
      },

      setSyncMetadata: (metadata) =>
        set((state) => ({
          syncMetadata: { ...state.syncMetadata, ...metadata },
        })),

      setPersonalFeedCreationPending: (pending) =>
        set((state) => ({
          syncMetadata: { ...state.syncMetadata, isPersonalFeedCreationPending: pending },
        })),

      setSyncing: (syncing) => set({ isSyncing: syncing }),

      setCreatingPersonalFeed: (creating) => set({ isCreatingPersonalFeed: creating }),

      setError: (error) => set({ lastError: error }),

      reset: () => set(initialState),

      // ============= Unread Count Implementations =============

      setUnreadCount: (feedId, count) => {
        const feeds = get().feeds;
        const feedExists = feeds.some((f) => f.id === feedId);
        debugLog(`[FeedsStore] setUnreadCount: feedId=${feedId}, count=${count}, feedExists=${feedExists}, totalFeeds=${feeds.length}`);
        if (!feedExists) {
          debugLog(`[FeedsStore] Available feed IDs:`, feeds.map((f) => f.id));
        }
        set((state) => ({
          feeds: state.feeds.map((f) =>
            f.id === feedId ? { ...f, unreadCount: count } : f
          ),
        }));
      },

      incrementUnreadCount: (feedId) => {
        set((state) => ({
          feeds: state.feeds.map((f) =>
            f.id === feedId ? { ...f, unreadCount: (f.unreadCount || 0) + 1 } : f
          ),
        }));
      },

      markFeedAsRead: (feedId) => {
        set((state) => ({
          feeds: state.feeds.map((f) =>
            f.id === feedId ? { ...f, unreadCount: 0 } : f
          ),
        }));
      },

      syncUnreadCounts: (counts) => {
        set((state) => ({
          feeds: state.feeds.map((f) => ({
            ...f,
            unreadCount: counts[f.id] ?? f.unreadCount ?? 0,
          })),
        }));
      },

      getTotalUnreadCount: () => {
        const { feeds } = get();
        return feeds.reduce((total, feed) => total + (feed.unreadCount || 0), 0);
      },
    }),
    {
      name: 'hush-feeds-storage',
      partialize: (state) => ({
        // Persist feeds, messages, and sync metadata
        feeds: state.feeds,
        messages: state.messages,
        syncMetadata: state.syncMetadata,
      }),
    }
  )
);
