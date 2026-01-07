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
import type { Feed, FeedMessage, GroupFeedMember, GroupMemberRole, GroupKeyGeneration, GroupKeyState, SettingsChangeRecord } from '@/types';
import { debugLog } from '@/lib/debug-logger';

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
  lastMessageBlockIndex: number;
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

  // ============= Group Feed State =============

  /** Group members indexed by feed ID */
  groupMembers: Record<string, GroupFeedMember[]>;

  /** Current user's role in each group feed */
  memberRoles: Record<string, GroupMemberRole>;

  /** KeyGeneration state indexed by group feed ID */
  groupKeyStates: Record<string, GroupKeyState>;
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
    pendingGroupJoinFeedId: null,
  },
  isSyncing: false,
  isCreatingPersonalFeed: false,
  lastError: null,
  groupMembers: {},
  memberRoles: {},
  groupKeyStates: {},
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
            // Merge server data, preserving local-only data like decrypted aesKey and unreadCount
            return {
              ...existingFeed,
              ...serverFeed,
              // Keep the decrypted aesKey if we have it
              aesKey: existingFeed.aesKey || serverFeed.aesKey,
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
                };
              }
              return msg;
            });
          }

          // Add truly new messages
          if (trulyNewMessages.length > 0) {
            updatedMessages = [...updatedMessages, ...trulyNewMessages];
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
    }),
    {
      name: 'hush-feeds-storage',
      partialize: (state) => ({
        // Persist feeds, messages, sync metadata, and group data
        feeds: state.feeds,
        messages: state.messages,
        syncMetadata: state.syncMetadata,
        groupMembers: state.groupMembers,
        memberRoles: state.memberRoles,
        groupKeyStates: state.groupKeyStates,
      }),
    }
  )
);
