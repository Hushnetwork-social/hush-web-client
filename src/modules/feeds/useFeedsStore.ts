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
import type { Feed, FeedMessage, FeedCacheMetadata, GroupFeedMember, GroupMemberRole, GroupKeyGeneration, GroupKeyState, SettingsChangeRecord } from '@/types';
import { debugLog } from '@/lib/debug-logger';
import { useReactionsStore } from '@/modules/reactions/useReactionsStore';
import { feedService } from '@/lib/grpc/services/feed';
import { useAppStore } from '@/stores/useAppStore';
import { aesDecrypt } from '@/lib/crypto';

// Feed type mapping from server (FeedType enum)
// Server: Personal=0, Chat=1, Broadcast=2, Group=3
export const FEED_TYPE_MAP: Record<number, Feed['type']> = {
  0: 'personal',
  1: 'chat',
  2: 'broadcast',
  3: 'group',
};

interface FeedsSyncMetadata {
  lastFeedBlockIndex: number;
  // FEAT-054: lastMessageBlockIndex REMOVED - now tracked per-feed in FeedCacheMetadata.lastSyncedMessageBlockIndex
  /** Last reaction tally version synced (Protocol Omega) */
  lastReactionTallyVersion: number;
  isPersonalFeedCreationPending: boolean;
  /** Block index when personal feed creation was initiated (for timeout tracking) */
  personalFeedCreationBlockIndex: number;
  /** Feed ID that was just joined (triggers full feed resync until feed appears) */
  pendingGroupJoinFeedId: string | null;
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

  // ============= Mention Tracking State =============

  /** Version counter that increments when mentions change (triggers re-renders) */
  mentionVersion: number;

  // ============= Group Feed State =============

  /** Group members indexed by feed ID */
  groupMembers: Record<string, GroupFeedMember[]>;

  /** Current user's role in each group feed */
  memberRoles: Record<string, GroupMemberRole>;

  /** KeyGeneration state indexed by group feed ID */
  groupKeyStates: Record<string, GroupKeyState>;

  // ============= Message Cache Metadata (FEAT-053) =============

  /** Per-feed cache metadata for message virtualization */
  feedCacheMetadata: Record<string, FeedCacheMetadata>;

  // ============= In-Memory Messages (FEAT-055/FEAT-056) =============

  /**
   * FEAT-055: Placeholder for scroll-up messages (memory-only, NOT persisted).
   * When user scrolls up to view older messages, they're stored here temporarily.
   * Cleaned up when navigating away from the feed (house-cleaning).
   * Populated by FEAT-056 (Load More Pagination).
   */
  inMemoryMessages: Record<string, FeedMessage[]>;

  // ============= FEAT-056: Load More Pagination State =============

  /**
   * FEAT-056: Tracks whether each feed has more older messages on the server.
   * - undefined: Unknown (not yet attempted to load more)
   * - true: Server has more messages to load
   * - false: No more messages (beginning of conversation reached)
   * Memory-only, NOT persisted.
   */
  feedHasMoreMessages: Record<string, boolean>;

  /**
   * FEAT-056: Tracks loading state per feed to prevent concurrent requests.
   * Memory-only, NOT persisted.
   */
  isLoadingOlderMessages: Record<string, boolean>;

  /**
   * FEAT-056: Tracks error state per feed after failed load attempts.
   * - null/undefined: No error
   * - string: Error message to display (after 3 silent retries)
   * Memory-only, NOT persisted.
   */
  feedLoadError: Record<string, string | null>;

  /**
   * FEAT-056: Timestamp when messages were last capped for a feed.
   * - null/undefined: No recent capping
   * - number: Timestamp when capping occurred (for showing notice)
   * Memory-only, NOT persisted.
   */
  feedWasCapped: Record<string, number | null>;
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

  /** Remove a feed by ID (used when group is deleted) */
  removeFeed: (feedId: string) => void;

  /** Get a message by ID (searches across all feeds) */
  getMessageById: (messageId: string) => FeedMessage | undefined;

  /**
   * FEAT-056: Fetch a message by ID, checking cache first then server.
   * Returns the message if found, null if not found.
   * Fetched messages are NOT persisted (one-off for reply preview).
   */
  fetchMessageById: (feedId: string, messageId: string) => Promise<FeedMessage | null>;

  /** Update a feed's AES key (after decryption) */
  updateFeedAesKey: (feedId: string, aesKey: string) => void;

  /** Update a feed's display name (after participant identity update) */
  updateFeedName: (feedId: string, name: string) => void;

  /** Update a feed's info (name, description, isPublic, inviteCode) - for group feeds */
  updateFeedInfo: (feedId: string, info: { name?: string; description?: string; isPublic?: boolean; inviteCode?: string }) => void;

  /** Add a settings change record to a feed's history (for group feeds) */
  addSettingsChangeRecord: (feedId: string, record: SettingsChangeRecord) => void;

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

  // ============= Mention Tracking Actions =============

  /** Increment mention version to trigger re-renders when mentions change */
  incrementMentionVersion: () => void;

  // ============= Group Join Actions =============

  /** Set pending group join - triggers full feed resync until feed appears */
  setPendingGroupJoin: (feedId: string | null) => void;

  /** Check if we're waiting for a pending group join */
  isPendingGroupJoin: () => boolean;

  /** Get the pending group join feed ID */
  getPendingGroupJoinFeedId: () => string | null;

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

  // ============= Per-Feed Sync Tracking =============

  /** Mark a feed as needing sync (blockIndex changed on server) */
  markFeedNeedsSync: (feedId: string, needsSync: boolean) => void;

  /** Clear needsSync flag after messages have been fetched */
  clearFeedNeedsSync: (feedId: string) => void;

  /** Get feeds that need sync */
  getFeedsNeedingSync: () => Feed[];

  // ============= Group Feed Actions =============

  /** Set the member list for a group feed */
  setGroupMembers: (feedId: string, members: GroupFeedMember[]) => void;

  /** Add a single member to a group feed */
  addGroupMember: (feedId: string, member: GroupFeedMember) => void;

  /** Remove a member from a group feed by address */
  removeGroupMember: (feedId: string, memberAddress: string) => void;

  /** Update a member's role in a group feed */
  updateMemberRole: (feedId: string, memberAddress: string, role: GroupMemberRole) => void;

  /** Update a member's data in a group feed (partial update) */
  updateGroupMember: (feedId: string, memberAddress: string, updates: Partial<GroupFeedMember>) => void;

  /** Get members for a specific group feed */
  getGroupMembers: (feedId: string) => GroupFeedMember[];

  /** Set the current user's role in a group feed */
  setUserRole: (feedId: string, role: GroupMemberRole) => void;

  /** Get the current user's role in a group feed */
  getUserRole: (feedId: string) => GroupMemberRole | undefined;

  /** Check if user is an admin of a group feed */
  isUserAdmin: (feedId: string) => boolean;

  // ============= Group KeyGeneration Actions =============

  /** Set the complete key state for a group feed */
  setGroupKeyState: (feedId: string, keyState: GroupKeyState) => void;

  /** Add a single key generation to a group feed */
  addKeyGeneration: (feedId: string, keyGen: GroupKeyGeneration) => void;

  /** Get the current AES key for sending messages to a group */
  getCurrentGroupKey: (feedId: string) => string | undefined;

  /** Get the AES key for a specific key generation (for decryption) */
  getGroupKeyByGeneration: (feedId: string, keyGeneration: number) => string | undefined;

  /** Check if there are missing key generations (unban gap) */
  hasMissingKeyGenerations: (feedId: string) => boolean;

  /** Get the list of missing key generation numbers */
  getMissingKeyGenerations: (feedId: string) => number[];

  /** Record a missing key generation (when message cannot be decrypted) */
  recordMissingKeyGeneration: (feedId: string, keyGeneration: number) => void;

  /** Get the GroupKeyState for a feed */
  getGroupKeyState: (feedId: string) => GroupKeyState | undefined;

  /**
   * Merge new KeyGenerations with existing ones, preserving already-decrypted keys.
   * This is the preferred method for syncing - only decrypts keys we don't already have.
   * @param feedId - The group feed ID
   * @param newKeyGens - New KeyGenerations to merge (only adds keys not already present)
   * @param missingKeyGens - Optional list of missing KeyGeneration numbers (unban gaps)
   */
  mergeKeyGenerations: (
    feedId: string,
    newKeyGens: GroupKeyGeneration[],
    missingKeyGens?: number[]
  ) => void;

  /**
   * Check if a specific KeyGeneration is already decrypted and cached.
   * Used by sync to skip re-decryption of existing keys.
   */
  hasDecryptedKey: (feedId: string, keyGeneration: number) => boolean;

  // ============= FEAT-051: Read Watermarks Actions =============

  /** Update lastReadBlockIndex for a feed (after marking as read) */
  updateLastReadBlockIndex: (feedId: string, blockIndex: number) => void;

  /** Get the max block index from messages in a feed (for marking as read) */
  getMaxMessageBlockIndex: (feedId: string) => number;

  // ============= FEAT-053: Message Cache Limits Actions =============

  /**
   * Trim messages to limit, keeping all UNREAD + latest N READ messages.
   * Returns array of removed message IDs (for reaction cleanup by FEAT-055).
   */
  trimMessagesToLimit: (feedId: string, limit?: number) => string[];

  /**
   * Update cache metadata for a feed (hasOlderMessages, oldestCachedBlockIndex).
   */
  updateFeedCacheMetadata: (feedId: string, metadata: Partial<FeedCacheMetadata>) => void;

  /**
   * Get cache metadata for a feed.
   */
  getFeedCacheMetadata: (feedId: string) => FeedCacheMetadata | undefined;

  /**
   * Handle localStorage quota exceeded - evicts oldest 20% of read messages globally.
   * Returns array of removed message IDs across all feeds.
   */
  handleStorageQuotaExceeded: () => string[];

  /**
   * FEAT-054: Clear all per-feed cache metadata (on logout).
   * Called by reset() to ensure clean state.
   */
  clearAllFeedCacheMetadata: () => void;

  // ============= FEAT-055: House-cleaning Actions =============

  /**
   * FEAT-055: Clean up a feed when user navigates away.
   * - Clears inMemoryMessages for the feed
   * - Trims localStorage messages to 100 read + all unread
   * - Triggers reaction cleanup for trimmed messages
   *
   * This is debounced (150ms) and fire-and-forget (async, doesn't block navigation).
   */
  cleanupFeed: (feedId: string) => void;

  // ============= FEAT-056: Load More Pagination Actions =============

  /**
   * FEAT-056: Load older messages from server when user scrolls up.
   * - Skips if already loading for this feed
   * - Skips if feedHasMoreMessages is false
   * - Prepends loaded messages to inMemoryMessages
   * - Enforces 500 message cap (discards oldest)
   * - Updates feedHasMoreMessages from server response
   */
  loadOlderMessages: (feedId: string) => Promise<void>;

  /**
   * FEAT-056: Get all displayable messages for a feed (merged in-memory + persisted).
   * - Merges inMemoryMessages (older) with messages (recent)
   * - Deduplicates by message ID
   * - Sorts by timestamp ascending
   */
  getDisplayMessages: (feedId: string) => FeedMessage[];

  /**
   * FEAT-056: Set whether a feed has more older messages on server.
   */
  setFeedHasMoreMessages: (feedId: string, hasMore: boolean) => void;

  /**
   * FEAT-056: Set loading state for older messages.
   */
  setIsLoadingOlderMessages: (feedId: string, isLoading: boolean) => void;

  /**
   * FEAT-056: Set error state for a feed after failed load attempts.
   */
  setFeedLoadError: (feedId: string, error: string | null) => void;

  /**
   * FEAT-056: Clear error state for a feed (e.g., on successful retry).
   */
  clearFeedLoadError: (feedId: string) => void;

  /**
   * FEAT-056: Clear the "was capped" notice state for a feed.
   */
  clearFeedWasCapped: (feedId: string) => void;
}

type FeedsStore = FeedsState & FeedsActions;

const initialState: FeedsState = {
  feeds: [],
  messages: {},
  syncMetadata: {
    lastFeedBlockIndex: 0,
    // FEAT-054: lastMessageBlockIndex REMOVED - now tracked per-feed
    lastReactionTallyVersion: 0,
    isPersonalFeedCreationPending: false,
    personalFeedCreationBlockIndex: 0,
    pendingGroupJoinFeedId: null,
  },
  isSyncing: false,
  isCreatingPersonalFeed: false,
  lastError: null,
  mentionVersion: 0,
  groupMembers: {},
  memberRoles: {},
  groupKeyStates: {},
  feedCacheMetadata: {},
  inMemoryMessages: {},
  feedHasMoreMessages: {},
  isLoadingOlderMessages: {},
  feedLoadError: {},
  feedWasCapped: {},
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

/**
 * Custom storage adapter for Zustand persist that handles QuotaExceededError (FEAT-053)
 * When localStorage quota is exceeded, it triggers LRU eviction of oldest read messages.
 */
// FEAT-055: Module-level debounce timeout for cleanupFeed
// Placed outside store to survive React re-renders and ensure proper debouncing
let cleanupTimeoutId: ReturnType<typeof setTimeout> | null = null;

const createQuotaHandlingStorage = (): {
  getItem: (name: string) => { state: unknown } | null;
  setItem: (name: string, value: { state: unknown }) => void;
  removeItem: (name: string) => void;
} => {
  return {
    getItem: (name: string) => {
      if (typeof window === 'undefined') return null;
      const value = localStorage.getItem(name);
      if (!value) return null;
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    },
    setItem: (name: string, value: { state: unknown }) => {
      if (typeof window === 'undefined') return;

      const trySetItem = (retryCount: number): void => {
        try {
          localStorage.setItem(name, JSON.stringify(value));
        } catch (error) {
          // Check if it's a QuotaExceededError
          if (
            error instanceof DOMException &&
            (error.name === 'QuotaExceededError' || error.code === 22)
          ) {
            if (retryCount >= 5) {
              console.warn('[FeedsStore] Storage quota exceeded, max retries reached');
              return;
            }

            debugLog(`[FeedsStore] Storage quota exceeded, attempting LRU eviction (retry ${retryCount + 1})`);

            // Trigger LRU eviction - need to call it on the store instance
            // Since we're in the storage adapter, we access the store directly
            const evictedIds = useFeedsStore.getState().handleStorageQuotaExceeded();

            if (evictedIds.length === 0) {
              console.warn('[FeedsStore] Storage quota exceeded, no read messages to evict');
              return;
            }

            // Retry after eviction
            trySetItem(retryCount + 1);
          } else {
            // Re-throw non-quota errors
            throw error;
          }
        }
      };

      trySetItem(0);
    },
    removeItem: (name: string) => {
      if (typeof window === 'undefined') return;
      localStorage.removeItem(name);
    },
  };
};

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
            // Check if encryptedFeedKey changed (key rotation) - if so, clear aesKey to force re-decrypt
            const keyChanged = serverFeed.encryptedFeedKey !== existingFeed.encryptedFeedKey;
            if (keyChanged && existingFeed.encryptedFeedKey) {
              console.log(`[E2E FeedsStore] KEY CHANGED for feed ${existingFeed.name}: old=${existingFeed.encryptedFeedKey?.substring(0, 20)}..., new=${serverFeed.encryptedFeedKey?.substring(0, 20)}...`);
            }
            // Merge server data, preserving local-only data like decrypted aesKey and unreadCount
            return {
              ...existingFeed,
              ...serverFeed,
              // Keep the decrypted aesKey if we have it AND the encryptedFeedKey hasn't changed
              // If encryptedFeedKey changed (key rotation), clear aesKey to force re-decrypt
              aesKey: keyChanged ? undefined : (existingFeed.aesKey || serverFeed.aesKey),
              // Preserve unreadCount - server doesn't track this, it's client-side only
              unreadCount: existingFeed.unreadCount ?? 0,
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

      removeFeed: (feedId) => {
        debugLog(`[FeedsStore] removeFeed: feedId=${feedId}`);
        set((state) => ({
          feeds: state.feeds.filter((f) => f.id !== feedId),
          // Also remove associated data
          messages: Object.fromEntries(
            Object.entries(state.messages).filter(([key]) => key !== feedId)
          ),
          groupMembers: Object.fromEntries(
            Object.entries(state.groupMembers).filter(([key]) => key !== feedId)
          ),
          memberRoles: Object.fromEntries(
            Object.entries(state.memberRoles).filter(([key]) => key !== feedId)
          ),
          groupKeyStates: Object.fromEntries(
            Object.entries(state.groupKeyStates).filter(([key]) => key !== feedId)
          ),
        }));
      },

      getMessageById: (messageId) => {
        const allMessages = get().messages;
        for (const feedMessages of Object.values(allMessages)) {
          const found = feedMessages.find((m) => m.id === messageId);
          if (found) return found;
        }
        return undefined;
      },

      fetchMessageById: async (feedId, messageId) => {
        // Step 1: Check persisted messages cache
        const persistedMessages = get().messages[feedId] || [];
        const fromPersisted = persistedMessages.find((m) => m.id === messageId);
        if (fromPersisted) {
          debugLog(`[FeedsStore] fetchMessageById: Found in persisted cache for ${messageId.substring(0, 8)}...`);
          return fromPersisted;
        }

        // Step 2: Check inMemory messages cache
        const inMemoryMsgs = get().inMemoryMessages[feedId] || [];
        const fromInMemory = inMemoryMsgs.find((m) => m.id === messageId);
        if (fromInMemory) {
          debugLog(`[FeedsStore] fetchMessageById: Found in inMemory cache for ${messageId.substring(0, 8)}...`);
          return fromInMemory;
        }

        // Step 3: Fetch from server
        debugLog(`[FeedsStore] fetchMessageById: Fetching from server for ${messageId.substring(0, 8)}...`);
        try {
          const response = await feedService.getMessageById(feedId, messageId);
          if (!response.Success || !response.Message) {
            debugLog(`[FeedsStore] fetchMessageById: Not found on server for ${messageId.substring(0, 8)}...`);
            return null;
          }

          // Transform server message to FeedMessage format
          const serverMsg = response.Message;
          const feed = get().feeds.find((f) => f.id === feedId);

          // Decrypt content if needed
          let content = serverMsg.MessageContent;
          if (feed?.aesKey) {
            try {
              content = await aesDecrypt(serverMsg.MessageContent, feed.aesKey);
            } catch {
              debugLog(`[FeedsStore] fetchMessageById: Failed to decrypt message ${messageId.substring(0, 8)}...`);
              content = '[Message encrypted before you joined]';
            }
          }

          const fetchedMessage: FeedMessage = {
            id: serverMsg.FeedMessageId,
            feedId: serverMsg.FeedId,
            content,
            senderPublicKey: serverMsg.IssuerPublicAddress,
            senderName: serverMsg.IssuerName,
            timestamp: serverMsg.TimeStamp?.seconds
              ? serverMsg.TimeStamp.seconds * 1000 + Math.floor((serverMsg.TimeStamp.nanos || 0) / 1000000)
              : Date.now(),
            blockHeight: serverMsg.BlockIndex,
            isConfirmed: true,
            isRead: true,
            replyToMessageId: serverMsg.ReplyToMessageId,
            keyGeneration: serverMsg.KeyGeneration,
          };

          debugLog(`[FeedsStore] fetchMessageById: Fetched from server for ${messageId.substring(0, 8)}...`);
          // Note: We intentionally do NOT persist this message (one-off for preview)
          return fetchedMessage;
        } catch (error) {
          debugLog(`[FeedsStore] fetchMessageById: Error fetching ${messageId.substring(0, 8)}...`, error);
          return null;
        }
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

      updateFeedInfo: (feedId, info) => {
        set((state) => ({
          feeds: state.feeds.map((f) =>
            f.id === feedId
              ? {
                  ...f,
                  ...(info.name !== undefined && { name: info.name }),
                  ...(info.description !== undefined && { description: info.description }),
                  ...(info.isPublic !== undefined && { isPublic: info.isPublic }),
                  ...(info.inviteCode !== undefined && { inviteCode: info.inviteCode }),
                }
              : f
          ),
        }));
      },

      addSettingsChangeRecord: (feedId, record) => {
        debugLog(`[FeedsStore] addSettingsChangeRecord: feedId=${feedId}, recordId=${record.id}`);
        set((state) => ({
          feeds: state.feeds.map((f) =>
            f.id === feedId
              ? {
                  ...f,
                  settingsChangeHistory: [...(f.settingsChangeHistory ?? []), record],
                }
              : f
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
        debugLog(`[FeedsStore] addMessages START: feedId=${feedId.substring(0, 8)}..., incoming=${newMessages.length}, msgIds=[${newMessages.map(m => m.id.substring(0, 8)).join(', ')}]`);
        const currentMessages = get().messages[feedId] || [];
        const existingIds = new Set(currentMessages.map((m) => m.id));
        debugLog(`[FeedsStore] addMessages: currentCount=${currentMessages.length}`);

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

          // Get feed's lastReadBlockIndex for isRead calculation (FEAT-053)
          const feed = state.feeds.find((f) => f.id === feedId);
          const lastReadBlockIndex = feed?.lastReadBlockIndex ?? 0;

          // Helper to calculate isRead based on lastReadBlockIndex
          // Messages with blockHeight <= lastReadBlockIndex are read
          // Messages without blockHeight (optimistic) are unread (never trim pending)
          const calculateIsRead = (blockHeight: number | undefined): boolean => {
            if (blockHeight === undefined) return false; // Optimistic messages are unread
            return blockHeight <= lastReadBlockIndex;
          };

          // Confirm pending messages by updating their isConfirmed status and metadata
          // Also merge any fields that may have been missing from cached data (e.g., replyToMessageId)
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
                  // Merge replyToMessageId from server if local message is missing it
                  // This handles cached messages from before the Reply feature was added
                  replyToMessageId: msg.replyToMessageId || confirmedMsg.replyToMessageId,
                  // Calculate isRead now that blockHeight is known (FEAT-053)
                  isRead: calculateIsRead(confirmedMsg.blockHeight),
                };
              }
              return msg;
            });
          }

          // Add truly new messages with isRead calculated (FEAT-053)
          if (trulyNewMessages.length > 0) {
            const messagesWithReadState = trulyNewMessages.map((msg) => ({
              ...msg,
              isRead: calculateIsRead(msg.blockHeight),
            }));
            updatedMessages = [...updatedMessages, ...messagesWithReadState];
          }

          // Sort messages by timestamp to ensure correct order
          updatedMessages.sort((a, b) => a.timestamp - b.timestamp);

          // Update the feed's updatedAt to reflect new activity
          // This ensures feeds with recent messages appear at the top of the list
          const latestMessageTimestamp = trulyNewMessages.length > 0
            ? Math.max(...trulyNewMessages.map((m) => m.timestamp))
            : null;

          let updatedFeeds = state.feeds;
          if (latestMessageTimestamp) {
            updatedFeeds = state.feeds.map((feed) =>
              feed.id === feedId
                ? { ...feed, updatedAt: Math.max(feed.updatedAt, latestMessageTimestamp) }
                : feed
            );
            // Re-sort feeds to maintain order (personal first, then by updatedAt)
            updatedFeeds = sortFeeds(updatedFeeds);
          }

          debugLog(`[FeedsStore] addMessages COMMIT: feedId=${feedId.substring(0, 8)}..., finalCount=${updatedMessages.length}, msgIds=[${updatedMessages.map(m => m.id.substring(0, 8)).join(', ')}]`);
          return {
            feeds: updatedFeeds,
            messages: {
              ...state.messages,
              [feedId]: updatedMessages,
            },
          };
        });
      },

      addPendingMessage: (feedId, message) => {
        debugLog(`[FeedsStore] addPendingMessage: feedId=${feedId}, messageId=${message.id}, isConfirmed=${message.isConfirmed}`);
        set((state) => {
          // Update the feed's updatedAt to reflect the new message activity
          const updatedFeeds = sortFeeds(
            state.feeds.map((feed) =>
              feed.id === feedId
                ? { ...feed, updatedAt: Math.max(feed.updatedAt, message.timestamp) }
                : feed
            )
          );

          return {
            feeds: updatedFeeds,
            messages: {
              ...state.messages,
              [feedId]: [...(state.messages[feedId] || []), message],
            },
          };
        });
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

      // ============= Mention Tracking Implementations =============

      incrementMentionVersion: () => {
        set((state) => ({ mentionVersion: state.mentionVersion + 1 }));
      },

      // ============= Group Join Implementations =============

      setPendingGroupJoin: (feedId) => {
        debugLog(`[FeedsStore] setPendingGroupJoin: ${feedId}`);
        set((state) => ({
          syncMetadata: { ...state.syncMetadata, pendingGroupJoinFeedId: feedId },
        }));
      },

      isPendingGroupJoin: () => {
        const feedId = get().syncMetadata.pendingGroupJoinFeedId;
        if (!feedId) return false;
        // Check if the feed has appeared in the store
        const feedExists = get().feeds.some((f) => f.id === feedId);
        return !feedExists; // Still pending if feed doesn't exist yet
      },

      getPendingGroupJoinFeedId: () => get().syncMetadata.pendingGroupJoinFeedId,

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
        // Note: Do NOT clear mentions here - user needs to navigate to them via MentionNavButton
        // Mentions are cleared individually when user navigates to each one
      },

      syncUnreadCounts: (counts) => {
        set((state) => ({
          feeds: state.feeds.map((f) => ({
            ...f,
            unreadCount: counts[f.id] ?? f.unreadCount ?? 0,
          })),
        }));
        // Note: Do NOT clear mentions based on unreadCount - mentions are independent
        // Mentions are cleared individually when user navigates to each one via MentionNavButton
      },

      getTotalUnreadCount: () => {
        const { feeds } = get();
        return feeds.reduce((total, feed) => total + (feed.unreadCount || 0), 0);
      },

      // ============= Per-Feed Sync Tracking Implementations =============

      markFeedNeedsSync: (feedId, needsSync) => {
        set((state) => ({
          feeds: state.feeds.map((f) =>
            f.id === feedId ? { ...f, needsSync } : f
          ),
        }));
      },

      clearFeedNeedsSync: (feedId) => {
        set((state) => ({
          feeds: state.feeds.map((f) =>
            f.id === feedId ? { ...f, needsSync: false } : f
          ),
        }));
      },

      getFeedsNeedingSync: () => {
        return get().feeds.filter((f) => f.needsSync === true);
      },

      // ============= Group Feed Implementations =============

      setGroupMembers: (feedId, members) => {
        debugLog(`[FeedsStore] setGroupMembers: feedId=${feedId}, count=${members.length}`);
        set((state) => ({
          groupMembers: {
            ...state.groupMembers,
            [feedId]: members,
          },
        }));
      },

      addGroupMember: (feedId, member) => {
        debugLog(`[FeedsStore] addGroupMember: feedId=${feedId}, member=${member.displayName}`);
        set((state) => {
          const currentMembers = state.groupMembers[feedId] || [];
          // Don't add duplicate members
          if (currentMembers.some((m) => m.publicAddress === member.publicAddress)) {
            return state;
          }
          return {
            groupMembers: {
              ...state.groupMembers,
              [feedId]: [...currentMembers, member],
            },
          };
        });
      },

      removeGroupMember: (feedId, memberAddress) => {
        debugLog(`[FeedsStore] removeGroupMember: feedId=${feedId}, address=${memberAddress}`);
        set((state) => {
          const currentMembers = state.groupMembers[feedId] || [];
          return {
            groupMembers: {
              ...state.groupMembers,
              [feedId]: currentMembers.filter((m) => m.publicAddress !== memberAddress),
            },
          };
        });
      },

      updateMemberRole: (feedId, memberAddress, role) => {
        debugLog(`[FeedsStore] updateMemberRole: feedId=${feedId}, address=${memberAddress}, role=${role}`);
        set((state) => {
          const currentMembers = state.groupMembers[feedId] || [];
          return {
            groupMembers: {
              ...state.groupMembers,
              [feedId]: currentMembers.map((m) =>
                m.publicAddress === memberAddress ? { ...m, role } : m
              ),
            },
          };
        });
      },

      updateGroupMember: (feedId, memberAddress, updates) => {
        debugLog(`[FeedsStore] updateGroupMember: feedId=${feedId}, address=${memberAddress}`, updates);
        set((state) => {
          const currentMembers = state.groupMembers[feedId] || [];
          return {
            groupMembers: {
              ...state.groupMembers,
              [feedId]: currentMembers.map((m) =>
                m.publicAddress === memberAddress ? { ...m, ...updates } : m
              ),
            },
          };
        });
      },

      getGroupMembers: (feedId) => {
        return get().groupMembers[feedId] || [];
      },

      setUserRole: (feedId, role) => {
        debugLog(`[FeedsStore] setUserRole: feedId=${feedId}, role=${role}`);
        set((state) => ({
          memberRoles: {
            ...state.memberRoles,
            [feedId]: role,
          },
        }));
      },

      getUserRole: (feedId) => {
        return get().memberRoles[feedId];
      },

      isUserAdmin: (feedId) => {
        return get().memberRoles[feedId] === 'Admin';
      },

      // ============= Group KeyGeneration Implementations =============

      setGroupKeyState: (feedId, keyState) => {
        debugLog(`[FeedsStore] setGroupKeyState: feedId=${feedId}, currentKeyGen=${keyState.currentKeyGeneration}, keyCount=${keyState.keyGenerations.length}`);
        set((state) => ({
          groupKeyStates: {
            ...state.groupKeyStates,
            [feedId]: keyState,
          },
        }));
      },

      addKeyGeneration: (feedId, keyGen) => {
        debugLog(`[FeedsStore] addKeyGeneration: feedId=${feedId}, keyGen=${keyGen.keyGeneration}, validFromBlock=${keyGen.validFromBlock}`);
        set((state) => {
          const currentState = state.groupKeyStates[feedId] || {
            currentKeyGeneration: 0,
            keyGenerations: [],
            missingKeyGenerations: [],
          };

          // Check if this key generation already exists
          const existingIndex = currentState.keyGenerations.findIndex(
            (k) => k.keyGeneration === keyGen.keyGeneration
          );

          let updatedKeyGenerations: GroupKeyGeneration[];
          if (existingIndex >= 0) {
            // Update existing key generation
            updatedKeyGenerations = [...currentState.keyGenerations];
            updatedKeyGenerations[existingIndex] = keyGen;
          } else {
            // Add new key generation
            updatedKeyGenerations = [...currentState.keyGenerations, keyGen];
          }

          // Sort by keyGeneration number
          updatedKeyGenerations.sort((a, b) => a.keyGeneration - b.keyGeneration);

          // Update validToBlock for previous key generation if this is a new higher one
          if (keyGen.keyGeneration > 0) {
            const prevIndex = updatedKeyGenerations.findIndex(
              (k) => k.keyGeneration === keyGen.keyGeneration - 1
            );
            if (prevIndex >= 0 && !updatedKeyGenerations[prevIndex].validToBlock) {
              updatedKeyGenerations[prevIndex] = {
                ...updatedKeyGenerations[prevIndex],
                validToBlock: keyGen.validFromBlock,
              };
            }
          }

          // Update currentKeyGeneration if this is a higher one
          const newCurrentKeyGen = Math.max(currentState.currentKeyGeneration, keyGen.keyGeneration);

          // Remove from missingKeyGenerations if it was there
          const updatedMissing = currentState.missingKeyGenerations.filter(
            (n) => n !== keyGen.keyGeneration
          );

          return {
            groupKeyStates: {
              ...state.groupKeyStates,
              [feedId]: {
                currentKeyGeneration: newCurrentKeyGen,
                keyGenerations: updatedKeyGenerations,
                missingKeyGenerations: updatedMissing,
              },
            },
          };
        });
      },

      getCurrentGroupKey: (feedId) => {
        const keyState = get().groupKeyStates[feedId];
        if (!keyState) return undefined;

        const currentKeyGen = keyState.keyGenerations.find(
          (k) => k.keyGeneration === keyState.currentKeyGeneration
        );
        return currentKeyGen?.aesKey;
      },

      getGroupKeyByGeneration: (feedId, keyGeneration) => {
        const keyState = get().groupKeyStates[feedId];
        if (!keyState) return undefined;

        const keyGen = keyState.keyGenerations.find(
          (k) => k.keyGeneration === keyGeneration
        );
        return keyGen?.aesKey;
      },

      hasMissingKeyGenerations: (feedId) => {
        const keyState = get().groupKeyStates[feedId];
        if (!keyState) return false;
        return keyState.missingKeyGenerations.length > 0;
      },

      getMissingKeyGenerations: (feedId) => {
        const keyState = get().groupKeyStates[feedId];
        if (!keyState) return [];
        return [...keyState.missingKeyGenerations];
      },

      recordMissingKeyGeneration: (feedId, keyGeneration) => {
        debugLog(`[FeedsStore] recordMissingKeyGeneration: feedId=${feedId}, keyGen=${keyGeneration}`);
        set((state) => {
          const currentState = state.groupKeyStates[feedId] || {
            currentKeyGeneration: 0,
            keyGenerations: [],
            missingKeyGenerations: [],
          };

          // Don't record if we already have this key
          const hasKey = currentState.keyGenerations.some(
            (k) => k.keyGeneration === keyGeneration
          );
          if (hasKey) return state;

          // Don't record if already in missing list
          if (currentState.missingKeyGenerations.includes(keyGeneration)) {
            return state;
          }

          return {
            groupKeyStates: {
              ...state.groupKeyStates,
              [feedId]: {
                ...currentState,
                missingKeyGenerations: [...currentState.missingKeyGenerations, keyGeneration].sort((a, b) => a - b),
              },
            },
          };
        });
      },

      getGroupKeyState: (feedId) => {
        return get().groupKeyStates[feedId];
      },

      mergeKeyGenerations: (feedId, newKeyGens, missingKeyGens) => {
        if (newKeyGens.length === 0 && !missingKeyGens) {
          return; // Nothing to merge
        }

        set((state) => {
          const currentState = state.groupKeyStates[feedId] || {
            currentKeyGeneration: 0,
            keyGenerations: [],
            missingKeyGenerations: [],
          };

          // Create a map of existing keys by keyGeneration number for O(1) lookup
          const existingKeysMap = new Map(
            currentState.keyGenerations.map((k) => [k.keyGeneration, k])
          );

          // Merge keys: add new ones, update validity of existing ones
          // Keys are immutable (AES key never changes), but validity can change
          // when new members join (existing key gets a ValidToBlock set)
          let addedCount = 0;
          let updatedCount = 0;
          for (const newKey of newKeyGens) {
            const existingKey = existingKeysMap.get(newKey.keyGeneration);
            if (!existingKey) {
              // New key - add it
              existingKeysMap.set(newKey.keyGeneration, newKey);
              addedCount++;
            } else {
              // Existing key - update validity if changed
              // (AES key is immutable, only validity changes)
              if (
                existingKey.validFromBlock !== newKey.validFromBlock ||
                existingKey.validToBlock !== newKey.validToBlock
              ) {
                existingKeysMap.set(newKey.keyGeneration, {
                  ...existingKey,
                  validFromBlock: newKey.validFromBlock,
                  validToBlock: newKey.validToBlock,
                });
                updatedCount++;
              }
            }
          }

          // Convert back to sorted array
          const mergedKeyGens = Array.from(existingKeysMap.values()).sort(
            (a, b) => a.keyGeneration - b.keyGeneration
          );

          // Calculate new currentKeyGeneration (highest key number)
          const newCurrentKeyGen = mergedKeyGens.length > 0
            ? Math.max(...mergedKeyGens.map((k) => k.keyGeneration))
            : 0;

          // Update missing key generations if provided
          const updatedMissing = missingKeyGens !== undefined
            ? missingKeyGens.filter((n) => !existingKeysMap.has(n))
            : currentState.missingKeyGenerations;

          debugLog(
            `[FeedsStore] mergeKeyGenerations: feedId=${feedId.substring(0, 8)}..., ` +
            `existing=${currentState.keyGenerations.length}, incoming=${newKeyGens.length}, ` +
            `added=${addedCount}, validityUpdated=${updatedCount}, total=${mergedKeyGens.length}`
          );

          return {
            groupKeyStates: {
              ...state.groupKeyStates,
              [feedId]: {
                currentKeyGeneration: newCurrentKeyGen,
                keyGenerations: mergedKeyGens,
                missingKeyGenerations: updatedMissing,
              },
            },
          };
        });
      },

      hasDecryptedKey: (feedId, keyGeneration) => {
        const keyState = get().groupKeyStates[feedId];
        if (!keyState) return false;
        return keyState.keyGenerations.some(
          (k) => k.keyGeneration === keyGeneration && k.aesKey !== undefined
        );
      },

      // ============= FEAT-051: Read Watermarks Implementations =============

      updateLastReadBlockIndex: (feedId, blockIndex) => {
        debugLog(`[FeedsStore] updateLastReadBlockIndex: feedId=${feedId}, blockIndex=${blockIndex}`);
        set((state) => ({
          feeds: state.feeds.map((f) =>
            f.id === feedId
              ? { ...f, lastReadBlockIndex: Math.max(f.lastReadBlockIndex ?? 0, blockIndex) }
              : f
          ),
        }));
      },

      getMaxMessageBlockIndex: (feedId) => {
        const messages = get().messages[feedId] || [];
        if (messages.length === 0) return 0;
        return Math.max(...messages.map((m) => m.blockHeight ?? 0));
      },

      // ============= FEAT-053: Message Cache Limits Implementations =============

      trimMessagesToLimit: (feedId, limit = 100) => {
        const currentMessages = get().messages[feedId] || [];

        // Separate read and unread messages
        // Messages without isRead or with isRead=undefined are treated as unread (safety)
        const unreadMessages = currentMessages.filter((m) => !m.isRead);
        const readMessages = currentMessages.filter((m) => m.isRead === true);

        debugLog(`[FeedsStore] trimMessagesToLimit: feedId=${feedId.substring(0, 8)}..., total=${currentMessages.length}, read=${readMessages.length}, unread=${unreadMessages.length}, limit=${limit}`);

        // If read messages are under limit, no trimming needed
        if (readMessages.length <= limit) {
          debugLog(`[FeedsStore] trimMessagesToLimit: under limit, no trimming needed`);
          return [];
        }

        // Sort read messages by timestamp (newest first)
        const sortedReadMessages = [...readMessages].sort((a, b) => b.timestamp - a.timestamp);

        // Keep the latest N read messages
        const messagesToKeep = sortedReadMessages.slice(0, limit);
        const messagesToRemove = sortedReadMessages.slice(limit);
        const removedIds = messagesToRemove.map((m) => m.id);

        debugLog(`[FeedsStore] trimMessagesToLimit: removing ${removedIds.length} oldest read messages`);

        // Combine kept read messages with all unread messages
        const finalMessages = [...messagesToKeep, ...unreadMessages].sort(
          (a, b) => a.timestamp - b.timestamp
        );

        // Calculate new metadata
        const oldestBlockIndex = finalMessages.length > 0
          ? Math.min(...finalMessages.filter((m) => m.blockHeight !== undefined).map((m) => m.blockHeight!))
          : 0;

        set((state) => ({
          messages: {
            ...state.messages,
            [feedId]: finalMessages,
          },
          feedCacheMetadata: {
            ...state.feedCacheMetadata,
            [feedId]: {
              // Preserve existing lastSyncedMessageBlockIndex (FEAT-054)
              ...state.feedCacheMetadata[feedId],
              hasOlderMessages: true, // We trimmed, so server has older messages
              oldestCachedBlockIndex: oldestBlockIndex,
            },
          },
        }));

        return removedIds;
      },

      updateFeedCacheMetadata: (feedId, metadata) => {
        set((state) => ({
          feedCacheMetadata: {
            ...state.feedCacheMetadata,
            [feedId]: {
              ...state.feedCacheMetadata[feedId],
              ...metadata,
            } as FeedCacheMetadata,
          },
        }));
      },

      getFeedCacheMetadata: (feedId) => {
        return get().feedCacheMetadata[feedId];
      },

      handleStorageQuotaExceeded: () => {
        debugLog(`[FeedsStore] handleStorageQuotaExceeded: starting LRU eviction`);
        const state = get();

        // Collect all read messages globally with their feed context
        const allReadMessages: { feedId: string; messageId: string; timestamp: number }[] = [];

        for (const feedId of Object.keys(state.messages)) {
          const messages = state.messages[feedId] || [];
          for (const msg of messages) {
            if (msg.isRead === true) {
              allReadMessages.push({
                feedId,
                messageId: msg.id,
                timestamp: msg.timestamp,
              });
            }
          }
        }

        if (allReadMessages.length === 0) {
          console.warn('[FeedsStore] handleStorageQuotaExceeded: no read messages to evict');
          return [];
        }

        // Sort by timestamp ascending (oldest first)
        allReadMessages.sort((a, b) => a.timestamp - b.timestamp);

        // Evict oldest 20%
        const evictCount = Math.max(1, Math.ceil(allReadMessages.length * 0.2));
        const toEvict = allReadMessages.slice(0, evictCount);
        const evictedIds = toEvict.map((m) => m.messageId);

        debugLog(`[FeedsStore] handleStorageQuotaExceeded: evicting ${evictCount} oldest read messages`);

        // Group evictions by feed for efficient update
        const evictByFeed = new Map<string, Set<string>>();
        for (const { feedId, messageId } of toEvict) {
          if (!evictByFeed.has(feedId)) {
            evictByFeed.set(feedId, new Set());
          }
          evictByFeed.get(feedId)!.add(messageId);
        }

        // Update state - remove evicted messages from each feed
        set((state) => {
          const newMessages = { ...state.messages };
          const newMetadata = { ...state.feedCacheMetadata };

          for (const [feedId, idsToRemove] of evictByFeed) {
            const currentMessages = newMessages[feedId] || [];
            const remainingMessages = currentMessages.filter((m) => !idsToRemove.has(m.id));
            newMessages[feedId] = remainingMessages;

            // Update metadata for affected feeds
            if (remainingMessages.length > 0) {
              const oldestBlockIndex = Math.min(
                ...remainingMessages.filter((m) => m.blockHeight !== undefined).map((m) => m.blockHeight!)
              );
              newMetadata[feedId] = {
                // Preserve existing lastSyncedMessageBlockIndex (FEAT-054)
                ...newMetadata[feedId],
                hasOlderMessages: true,
                oldestCachedBlockIndex: oldestBlockIndex,
              };
            }
          }

          return {
            messages: newMessages,
            feedCacheMetadata: newMetadata,
          };
        });

        return evictedIds;
      },

      // ============= FEAT-054: Per-Feed Sync Metadata Implementations =============

      clearAllFeedCacheMetadata: () => {
        debugLog('[FeedsStore] clearAllFeedCacheMetadata: clearing all per-feed cache metadata');
        set({ feedCacheMetadata: {} });
      },

      // ============= FEAT-055: House-cleaning Implementations =============

      cleanupFeed: (feedId) => {
        // Cancel any pending cleanup (debounce)
        if (cleanupTimeoutId) {
          clearTimeout(cleanupTimeoutId);
        }

        // Debounce: Wait 150ms before executing cleanup
        // This handles rapid feed switching (A -> B -> C) by only cleaning the last previous feed
        cleanupTimeoutId = setTimeout(() => {
          try {
            debugLog(`[FeedsStore] cleanupFeed: starting cleanup for feedId=${feedId.substring(0, 8)}...`);

            // 1. Clear inMemoryMessages for this feed
            const currentInMemory = get().inMemoryMessages;
            if (currentInMemory[feedId]) {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { [feedId]: _removed, ...remainingInMemory } = currentInMemory;
              set({ inMemoryMessages: remainingInMemory });
              debugLog(`[FeedsStore] cleanupFeed: cleared inMemoryMessages for feedId=${feedId.substring(0, 8)}...`);
            }

            // 1b. FEAT-056: Clear pagination state for this feed
            const currentHasMore = get().feedHasMoreMessages;
            const currentIsLoading = get().isLoadingOlderMessages;
            const currentLoadError = get().feedLoadError;
            const currentWasCapped = get().feedWasCapped;
            if (currentHasMore[feedId] !== undefined || currentIsLoading[feedId] !== undefined ||
                currentLoadError[feedId] !== undefined || currentWasCapped[feedId] !== undefined) {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { [feedId]: _hasMore, ...remainingHasMore } = currentHasMore;
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { [feedId]: _isLoading, ...remainingIsLoading } = currentIsLoading;
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { [feedId]: _loadError, ...remainingLoadError } = currentLoadError;
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { [feedId]: _wasCapped, ...remainingWasCapped } = currentWasCapped;
              set({
                feedHasMoreMessages: remainingHasMore,
                isLoadingOlderMessages: remainingIsLoading,
                feedLoadError: remainingLoadError,
                feedWasCapped: remainingWasCapped,
              });
              debugLog(`[FeedsStore] cleanupFeed: cleared pagination state for feedId=${feedId.substring(0, 8)}...`);
            }

            // 2. Trim localStorage messages to 100 read + all unread
            // trimMessagesToLimit returns array of removed message IDs
            const removedIds = get().trimMessagesToLimit(feedId, 100);
            debugLog(`[FeedsStore] cleanupFeed: trimmed ${removedIds.length} messages from feedId=${feedId.substring(0, 8)}...`);

            // 3. Clean up reactions for trimmed messages
            if (removedIds.length > 0) {
              useReactionsStore.getState().removeReactionsForMessages(removedIds);
              debugLog(`[FeedsStore] cleanupFeed: removed reactions for ${removedIds.length} trimmed messages`);
            }

            debugLog(`[FeedsStore] cleanupFeed: completed for feedId=${feedId.substring(0, 8)}...`);
          } catch (error) {
            // Graceful degradation: log and continue, don't block navigation
            console.warn('[FeedsStore] cleanupFeed failed:', error);
          }
        }, 150);
      },

      // ============= FEAT-056: Load More Pagination Implementations =============

      loadOlderMessages: async (feedId) => {
        const state = get();

        // Guard: Skip if already loading for this feed
        if (state.isLoadingOlderMessages[feedId]) {
          debugLog(`[FeedsStore] loadOlderMessages: skipping - already loading for feedId=${feedId.substring(0, 8)}...`);
          return;
        }

        // Guard: Skip if we know there are no more messages
        if (state.feedHasMoreMessages[feedId] === false) {
          debugLog(`[FeedsStore] loadOlderMessages: skipping - no more messages for feedId=${feedId.substring(0, 8)}...`);
          return;
        }

        // Get user's profile public key for the request
        const profilePublicKey = useAppStore.getState().currentUser?.publicKey;
        if (!profilePublicKey) {
          console.warn('[FeedsStore] loadOlderMessages: no profile public key available');
          return;
        }

        // Get the oldest blockHeight from displayed messages to use as the "before" cursor
        const displayMessages = get().getDisplayMessages(feedId);
        if (displayMessages.length === 0) {
          debugLog(`[FeedsStore] loadOlderMessages: skipping - no messages to paginate from for feedId=${feedId.substring(0, 8)}...`);
          return;
        }

        // Find oldest blockHeight (minimum), filtering out undefined values
        const blockHeights = displayMessages
          .map(m => m.blockHeight)
          .filter((h): h is number => h !== undefined);

        if (blockHeights.length === 0) {
          debugLog(`[FeedsStore] loadOlderMessages: skipping - no messages with blockHeight for feedId=${feedId.substring(0, 8)}...`);
          return;
        }

        const oldestBlockHeight = Math.min(...blockHeights);

        // FEAT-056: Proactive guard - if oldest message is at or very close to feed creation, skip
        // This prevents unnecessary server requests when we're clearly at the beginning of the feed
        const feed = get().getFeed(feedId);
        if (feed?.blockIndex !== undefined && oldestBlockHeight <= feed.blockIndex + 5) {
          // The oldest message is within 5 blocks of feed creation - we're at the beginning
          debugLog(`[FeedsStore] loadOlderMessages: skipping - oldest message (block ${oldestBlockHeight}) is near feed creation (block ${feed.blockIndex}) for feedId=${feedId.substring(0, 8)}...`);
          set((state) => ({
            feedHasMoreMessages: { ...state.feedHasMoreMessages, [feedId]: false },
          }));
          return;
        }

        debugLog(`[FeedsStore] loadOlderMessages: fetching before blockHeight=${oldestBlockHeight} for feedId=${feedId.substring(0, 8)}...`);

        // Mark as loading
        set((state) => ({
          isLoadingOlderMessages: { ...state.isLoadingOlderMessages, [feedId]: true },
        }));

        // FEAT-056: Retry logic - 3 silent retries before showing error
        const MAX_RETRIES = 3;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            // Fetch older messages from server
            const response = await feedService.getOlderMessages(profilePublicKey, oldestBlockHeight, 50);
            debugLog(`[FeedsStore] loadOlderMessages: received ${response.Messages.length} messages, hasMore=${response.HasMoreMessages}`);

            // Convert server entities to FeedMessage format
            // Note: Server uses PascalCase (FeedId, MessageContent, BlockIndex)
            // Client uses camelCase (feedId, content, blockHeight)
            const rawMessages: FeedMessage[] = response.Messages.map((msg) => ({
              id: msg.FeedMessageId,
              feedId: msg.FeedId,
              content: msg.MessageContent,
              senderPublicKey: msg.IssuerPublicAddress,
              senderName: msg.IssuerName,
              isConfirmed: true,
              isRead: true, // Older messages are considered "read" by default
              timestamp: msg.TimeStamp ? msg.TimeStamp.seconds * 1000 + msg.TimeStamp.nanos / 1000000 : Date.now(),
              blockHeight: msg.BlockIndex,
              replyToMessageId: msg.ReplyToMessageId,
              keyGeneration: msg.KeyGeneration,
            }));

            // FEAT-056 Task 3.4: Decrypt messages based on feed type
            const feed = get().getFeed(feedId);
            let newMessages: FeedMessage[] = rawMessages;

            if (feed?.type === 'chat') {
              // Chat feed: decrypt with feed's AES key
              const feedAesKey = feed.aesKey;
              if (feedAesKey) {
                newMessages = await Promise.all(
                  rawMessages.map(async (msg) => {
                    try {
                      const decryptedContent = await aesDecrypt(msg.content, feedAesKey);
                      return {
                        ...msg,
                        content: decryptedContent,
                        contentEncrypted: msg.content,
                        decryptionFailed: false,
                      };
                    } catch {
                      debugLog(`[FeedsStore] loadOlderMessages: failed to decrypt chat msg ${msg.id.substring(0, 8)}...`);
                      return {
                        ...msg,
                        contentEncrypted: msg.content,
                        decryptionFailed: true,
                      };
                    }
                  })
                );
              } else {
                debugLog(`[FeedsStore] loadOlderMessages: no AES key for chat feed ${feedId.substring(0, 8)}...`);
              }
            } else if (feed?.type === 'group') {
              // Group feed: decrypt with keyGeneration-specific AES key
              const keyState = get().getGroupKeyState(feedId);
              if (keyState && keyState.keyGenerations.length > 0) {
                // Get all available keys sorted by keyGeneration descending (try newest first)
                const keysToTry = [...keyState.keyGenerations]
                  .filter(kg => kg.aesKey)
                  .sort((a, b) => b.keyGeneration - a.keyGeneration);

                newMessages = await Promise.all(
                  rawMessages.map(async (msg) => {
                    // If message has keyGeneration, use that specific key
                    if (msg.keyGeneration !== undefined) {
                      const specificKey = keyState.keyGenerations.find(
                        kg => kg.keyGeneration === msg.keyGeneration
                      );
                      if (specificKey?.aesKey) {
                        try {
                          const decryptedContent = await aesDecrypt(msg.content, specificKey.aesKey);
                          return {
                            ...msg,
                            content: decryptedContent,
                            contentEncrypted: msg.content,
                            decryptionFailed: false,
                          };
                        } catch {
                          debugLog(`[FeedsStore] loadOlderMessages: failed to decrypt with keyGen=${msg.keyGeneration}`);
                          return {
                            ...msg,
                            contentEncrypted: msg.content,
                            decryptionFailed: true,
                          };
                        }
                      } else {
                        // Missing key (joined after this KeyGeneration)
                        debugLog(`[FeedsStore] loadOlderMessages: missing keyGen=${msg.keyGeneration} for msg ${msg.id.substring(0, 8)}...`);
                        get().recordMissingKeyGeneration(feedId, msg.keyGeneration);
                        return {
                          ...msg,
                          contentEncrypted: msg.content,
                          decryptionFailed: true,
                        };
                      }
                    }

                    // No keyGeneration - try all keys until one works
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
                        continue; // Try next key
                      }
                    }

                    // All keys failed
                    debugLog(`[FeedsStore] loadOlderMessages: all ${keysToTry.length} keys failed for msg ${msg.id.substring(0, 8)}...`);
                    return {
                      ...msg,
                      contentEncrypted: msg.content,
                      decryptionFailed: true,
                    };
                  })
                );
              } else {
                debugLog(`[FeedsStore] loadOlderMessages: no KeyGenerations for group feed ${feedId.substring(0, 8)}...`);
                // Mark all as decryption failed
                newMessages = rawMessages.map(msg => ({
                  ...msg,
                  contentEncrypted: msg.content,
                  decryptionFailed: true,
                }));
              }
            }
            // For personal/broadcast feeds: no encryption, messages stay as-is

            // Prepend to inMemoryMessages for this feed
            const currentInMemory = get().inMemoryMessages[feedId] || [];
            const mergedMessages = [...newMessages, ...currentInMemory];

            // Enforce 500 message cap (discard oldest if exceeded)
            const IN_MEMORY_CAP = 500;
            const wasCapped = mergedMessages.length > IN_MEMORY_CAP;
            const cappedMessages = wasCapped
              ? mergedMessages.slice(-IN_MEMORY_CAP) // Keep newest N messages
              : mergedMessages;

            if (wasCapped) {
              debugLog(`[FeedsStore] loadOlderMessages: capped inMemoryMessages from ${mergedMessages.length} to ${IN_MEMORY_CAP}`);
            }

            // Update state - success
            set((state) => ({
              inMemoryMessages: { ...state.inMemoryMessages, [feedId]: cappedMessages },
              feedHasMoreMessages: { ...state.feedHasMoreMessages, [feedId]: response.HasMoreMessages ?? true },
              isLoadingOlderMessages: { ...state.isLoadingOlderMessages, [feedId]: false },
              // FEAT-056: Track when capping occurred for showing notice
              ...(wasCapped && { feedWasCapped: { ...state.feedWasCapped, [feedId]: Date.now() } }),
            }));

            // Clear any previous error on success
            get().clearFeedLoadError(feedId);

            debugLog(`[FeedsStore] loadOlderMessages: completed for feedId=${feedId.substring(0, 8)}..., inMemory count=${cappedMessages.length}`);
            return; // Success - exit the function
          } catch (error) {
            // FEAT-056: Check if this is a decode error (empty/malformed response)
            // This typically happens when we're at the beginning of the feed and server returns empty result
            const errorMessage = error instanceof Error ? error.message : String(error);
            const isDecodeError = errorMessage.includes('too short') ||
                                  errorMessage.includes('decode') ||
                                  errorMessage.includes('Invalid gRPC');

            if (isDecodeError) {
              // Treat decode errors as "no more messages" - this is likely the beginning of the feed
              debugLog(`[FeedsStore] loadOlderMessages: decode error detected, treating as end of feed for feedId=${feedId.substring(0, 8)}...`);
              set((state) => ({
                feedHasMoreMessages: { ...state.feedHasMoreMessages, [feedId]: false },
                isLoadingOlderMessages: { ...state.isLoadingOlderMessages, [feedId]: false },
              }));
              get().clearFeedLoadError(feedId);
              return; // Exit - no more messages
            }

            if (attempt < MAX_RETRIES) {
              debugLog(`[FeedsStore] loadOlderMessages: attempt ${attempt}/${MAX_RETRIES} failed, retrying...`);
              // Silent retry - continue to next iteration
            } else {
              // All retries exhausted - set error state
              console.error(`[FeedsStore] loadOlderMessages failed after ${MAX_RETRIES} attempts:`, error);
              set((state) => ({
                isLoadingOlderMessages: { ...state.isLoadingOlderMessages, [feedId]: false },
              }));
              get().setFeedLoadError(feedId, 'Failed to load older messages. Tap to retry.');
            }
          }
        }
      },

      getDisplayMessages: (feedId) => {
        const state = get();
        const inMemory = state.inMemoryMessages[feedId] || [];
        const persisted = state.messages[feedId] || [];

        // Fast path: if no in-memory messages, just return persisted
        if (inMemory.length === 0) {
          return persisted;
        }

        // Merge and deduplicate by message ID
        const seenIds = new Set<string>();
        const merged: FeedMessage[] = [];

        // Add in-memory messages first (older messages)
        for (const msg of inMemory) {
          if (!seenIds.has(msg.id)) {
            seenIds.add(msg.id);
            merged.push(msg);
          }
        }

        // Add persisted messages (recent messages), skip duplicates
        for (const msg of persisted) {
          if (!seenIds.has(msg.id)) {
            seenIds.add(msg.id);
            merged.push(msg);
          }
        }

        // Sort by timestamp ascending
        merged.sort((a, b) => a.timestamp - b.timestamp);

        return merged;
      },

      setFeedHasMoreMessages: (feedId, hasMore) => {
        set((state) => ({
          feedHasMoreMessages: { ...state.feedHasMoreMessages, [feedId]: hasMore },
        }));
        debugLog(`[FeedsStore] setFeedHasMoreMessages: feedId=${feedId.substring(0, 8)}... hasMore=${hasMore}`);
      },

      setIsLoadingOlderMessages: (feedId, isLoading) => {
        set((state) => ({
          isLoadingOlderMessages: { ...state.isLoadingOlderMessages, [feedId]: isLoading },
        }));
        debugLog(`[FeedsStore] setIsLoadingOlderMessages: feedId=${feedId.substring(0, 8)}... isLoading=${isLoading}`);
      },

      setFeedLoadError: (feedId, error) => {
        set((state) => ({
          feedLoadError: { ...state.feedLoadError, [feedId]: error },
        }));
        if (error) {
          debugLog(`[FeedsStore] setFeedLoadError: feedId=${feedId.substring(0, 8)}... error=${error}`);
        }
      },

      clearFeedLoadError: (feedId) => {
        set((state) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [feedId]: _removed, ...rest } = state.feedLoadError;
          return { feedLoadError: rest };
        });
        debugLog(`[FeedsStore] clearFeedLoadError: feedId=${feedId.substring(0, 8)}...`);
      },

      clearFeedWasCapped: (feedId) => {
        set((state) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [feedId]: _removed, ...rest } = state.feedWasCapped;
          return { feedWasCapped: rest };
        });
      },
    }),
    {
      name: 'hush-feeds-storage',
      storage: createQuotaHandlingStorage(),
      partialize: (state) => ({
        // Persist feeds, messages, sync metadata, group data, and cache metadata
        feeds: state.feeds,
        messages: state.messages,
        syncMetadata: state.syncMetadata,
        groupMembers: state.groupMembers,
        memberRoles: state.memberRoles,
        groupKeyStates: state.groupKeyStates,
        feedCacheMetadata: state.feedCacheMetadata,
      }),
    }
  )
);

// FEAT-055: Expose store to window for E2E test verification
// This allows E2E tests to intercept store actions like cleanupFeed
// Check for NEXT_PUBLIC_DEBUG_LOGGING since E2E tests run with NODE_ENV=production
const isE2EOrDev = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEBUG_LOGGING === 'true';
if (typeof window !== 'undefined' && isE2EOrDev) {
  (window as unknown as { __zustand_stores?: Record<string, unknown> }).__zustand_stores = {
    ...((window as unknown as { __zustand_stores?: Record<string, unknown> }).__zustand_stores || {}),
    feedsStore: useFeedsStore,
  };
}
