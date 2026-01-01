/**
 * Reactions Module Store
 *
 * Zustand store for anonymous reactions state.
 * UI components subscribe to this store for reactive updates.
 *
 * See MemoryBank/ProtocolOmega/ for full documentation.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EmojiType } from '@/lib/crypto/reactions';
import { debugLog } from '@/lib/debug-logger';

/**
 * Emoji counts for a message
 */
export interface EmojiCounts {
  '👍': number;
  '❤️': number;
  '😂': number;
  '😮': number;
  '😢': number;
  '😡': number;
}

/**
 * Empty emoji counts (all zeros)
 */
export const EMPTY_EMOJI_COUNTS: EmojiCounts = {
  '👍': 0,
  '❤️': 0,
  '😂': 0,
  '😮': 0,
  '😢': 0,
  '😡': 0,
};

/**
 * Reaction entry for a single message
 */
export interface ReactionEntry {
  // Decrypted reaction counts
  counts: EmojiCounts;

  // User's own reaction (0-5 for emoji index, null if not reacted)
  myReaction: number | null;

  // Cache metadata
  lastFetched: number;
  tallyVersion: number;
}

/**
 * Pending reaction (optimistic update while ZK proof generates)
 */
export interface PendingReaction {
  // The emoji index being submitted (0-5, or -1 for removal)
  emojiIndex: number;

  // When the reaction was submitted
  submittedAt: number;
}

/**
 * Server reaction tally (Protocol Omega)
 * Received from FeedsSyncable during message sync
 */
export interface ServerReactionTally {
  tallyC1: { x: string; y: string }[];  // Base64 encoded EC points
  tallyC2: { x: string; y: string }[];  // Base64 encoded EC points
  tallyVersion: number;
  reactionCount: number;
  feedId: string;
}

/**
 * Reactions store state
 */
interface ReactionsState {
  // Reactions indexed by messageId
  reactions: Record<string, ReactionEntry>;

  // Optimistic updates (pending ZK proof generation)
  pendingReactions: Record<string, PendingReaction>;

  // Encrypted tallies awaiting decryption (when feed key not available)
  pendingTallies: Record<string, ServerReactionTally>;

  // User's secret for reactions (derived from mnemonic)
  userSecret: bigint | null;

  // User's commitment (Poseidon(userSecret))
  userCommitment: bigint | null;

  // ZK prover status
  isProverReady: boolean;
  isGeneratingProof: boolean;

  // BSGS table status
  isBsgsReady: boolean;

  // Sync status
  isSyncing: boolean;
  lastError: string | null;
}

/**
 * Reactions store actions
 */
interface ReactionsActions {
  // ============= Tally Operations =============

  /** Set reaction tallies for messages */
  setTallies(tallies: Record<string, EmojiCounts>): void;

  /** Update a single tally */
  updateTally(messageId: string, counts: EmojiCounts, tallyVersion?: number): void;

  /** Set user's own reaction for a message */
  setMyReaction(messageId: string, emojiIndex: number | null): void;

  /** Get reaction entry for a message */
  getReaction(messageId: string): ReactionEntry | undefined;

  // ============= Optimistic Updates =============

  /** Set a pending reaction (optimistic UI) */
  setPendingReaction(messageId: string, emojiIndex: number): void;

  /** Confirm a pending reaction (proof succeeded) */
  confirmReaction(messageId: string): void;

  /** Revert a pending reaction (proof failed) */
  revertReaction(messageId: string): void;

  /** Check if a message has a pending reaction */
  hasPendingReaction(messageId: string): boolean;

  // ============= User Secret Management =============

  /** Set user's reaction secret (derived from mnemonic) */
  setUserSecret(secret: bigint): void;

  /** Set user's commitment */
  setUserCommitment(commitment: bigint): void;

  /** Get user's secret */
  getUserSecret(): bigint | null;

  /** Get user's commitment */
  getUserCommitment(): bigint | null;

  // ============= Status Management =============

  /** Set ZK prover ready status */
  setProverReady(ready: boolean): void;

  /** Set proof generation in progress */
  setGeneratingProof(generating: boolean): void;

  /** Set BSGS table ready status */
  setBsgsReady(ready: boolean): void;

  /** Set syncing status */
  setSyncing(syncing: boolean): void;

  /** Set error state */
  setError(error: string | null): void;

  // ============= Server Sync (Protocol Omega) =============

  /** Update from server sync - stores encrypted tally or decrypts if key available */
  setTallyFromServer(messageId: string, serverTally: ServerReactionTally): void;

  // ============= Reset =============

  /** Reset store to initial state (on logout) */
  reset(): void;
}

type ReactionsStore = ReactionsState & ReactionsActions;

const initialState: ReactionsState = {
  reactions: {},
  pendingReactions: {},
  pendingTallies: {},
  userSecret: null,
  userCommitment: null,
  isProverReady: false,
  isGeneratingProof: false,
  isBsgsReady: false,
  isSyncing: false,
  lastError: null,
};

export const useReactionsStore = create<ReactionsStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ============= Tally Operations =============

      setTallies: (tallies) => {
        set((state) => {
          const reactions = { ...state.reactions };
          const now = Date.now();

          for (const [messageId, counts] of Object.entries(tallies)) {
            reactions[messageId] = {
              counts,
              myReaction: reactions[messageId]?.myReaction ?? null,
              lastFetched: now,
              // Keep existing version - don't increment locally
              tallyVersion: reactions[messageId]?.tallyVersion ?? 0,
            };
          }

          return { reactions };
        });
      },

      updateTally: (messageId, counts, tallyVersion) => {
        set((state) => ({
          reactions: {
            ...state.reactions,
            [messageId]: {
              counts,
              myReaction: state.reactions[messageId]?.myReaction ?? null,
              lastFetched: Date.now(),
              // Use server version if provided, otherwise keep existing
              tallyVersion: tallyVersion ?? state.reactions[messageId]?.tallyVersion ?? 0,
            },
          },
        }));
      },

      setMyReaction: (messageId, emojiIndex) => {
        set((state) => ({
          reactions: {
            ...state.reactions,
            [messageId]: {
              ...(state.reactions[messageId] ?? {
                counts: { ...EMPTY_EMOJI_COUNTS },
                lastFetched: Date.now(),
                tallyVersion: 0,
              }),
              myReaction: emojiIndex,
            },
          },
        }));
      },

      getReaction: (messageId) => {
        return get().reactions[messageId];
      },

      // ============= Optimistic Updates =============

      setPendingReaction: (messageId, emojiIndex) => {
        set((state) => ({
          pendingReactions: {
            ...state.pendingReactions,
            [messageId]: {
              emojiIndex,
              submittedAt: Date.now(),
            },
          },
        }));
      },

      confirmReaction: (messageId) => {
        const pending = get().pendingReactions[messageId];
        if (!pending) return;

        set((state) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [messageId]: _, ...remainingPending } = state.pendingReactions;

          // Update myReaction with the confirmed value
          const emojiIndex = pending.emojiIndex >= 0 ? pending.emojiIndex : null;

          return {
            pendingReactions: remainingPending,
            reactions: {
              ...state.reactions,
              [messageId]: {
                ...(state.reactions[messageId] ?? {
                  counts: { ...EMPTY_EMOJI_COUNTS },
                  lastFetched: Date.now(),
                  tallyVersion: 0,
                }),
                myReaction: emojiIndex,
              },
            },
          };
        });
      },

      revertReaction: (messageId) => {
        set((state) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [messageId]: _, ...remainingPending } = state.pendingReactions;
          return { pendingReactions: remainingPending };
        });
      },

      hasPendingReaction: (messageId) => {
        return !!get().pendingReactions[messageId];
      },

      // ============= User Secret Management =============

      setUserSecret: (secret) => {
        set({ userSecret: secret });
      },

      setUserCommitment: (commitment) => {
        set({ userCommitment: commitment });
      },

      getUserSecret: () => {
        return get().userSecret;
      },

      getUserCommitment: () => {
        return get().userCommitment;
      },

      // ============= Status Management =============

      setProverReady: (ready) => {
        set({ isProverReady: ready });
      },

      setGeneratingProof: (generating) => {
        set({ isGeneratingProof: generating });
      },

      setBsgsReady: (ready) => {
        set({ isBsgsReady: ready });
      },

      setSyncing: (syncing) => {
        set({ isSyncing: syncing });
      },

      setError: (error) => {
        set({ lastError: error });
      },

      // ============= Server Sync (Protocol Omega) =============

      setTallyFromServer: (messageId, serverTally) => {
        set((state) => {
          const existingReaction = state.reactions[messageId];
          const existingVersion = existingReaction?.tallyVersion ?? 0;

          // Only update if this is a newer version
          if (serverTally.tallyVersion <= existingVersion) {
            debugLog(`[ReactionsStore] Skipping tally for ${messageId.substring(0, 8)}... (version ${serverTally.tallyVersion} <= existing ${existingVersion})`);
            return state;
          }

          debugLog(`[ReactionsStore] Storing tally for ${messageId.substring(0, 8)}...: version=${serverTally.tallyVersion}, reactionCount=${serverTally.reactionCount}, feedId=${serverTally.feedId.substring(0, 8)}...`);

          // Store the encrypted tally for later decryption when feed key is available
          const newPendingTallies = {
            ...state.pendingTallies,
            [messageId]: serverTally,
          };

          // Build placeholder counts based on myReaction if available
          // This ensures we show the user's actual emoji, not always 👍
          // TODO: Implement proper ElGamal decryption with BSGS to get actual counts per emoji
          const placeholderCounts: EmojiCounts = { ...EMPTY_EMOJI_COUNTS };
          const myReaction = existingReaction?.myReaction;

          if (serverTally.reactionCount > 0) {
            // If user has reacted, show their emoji with count
            // Otherwise show 👍 as generic placeholder
            if (myReaction !== null && myReaction !== undefined && myReaction >= 0 && myReaction < 6) {
              const emojis: (keyof EmojiCounts)[] = ['👍', '❤️', '😂', '😮', '😢', '😡'];
              placeholderCounts[emojis[myReaction]] = serverTally.reactionCount;
            } else {
              // No myReaction set, use 👍 as placeholder
              placeholderCounts['👍'] = serverTally.reactionCount;
            }
          }

          const newReactions = {
            ...state.reactions,
            [messageId]: {
              counts: placeholderCounts,
              myReaction: myReaction ?? null,
              lastFetched: Date.now(),
              tallyVersion: serverTally.tallyVersion,
            },
          };

          return {
            pendingTallies: newPendingTallies,
            reactions: newReactions,
          };
        });
      },

      // ============= Reset =============

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'hush-reactions-storage',
      partialize: (state) => ({
        // Only persist reactions (not secrets or status)
        reactions: state.reactions,
        // Don't persist: userSecret, userCommitment, pendingReactions, status flags
      }),
      // Custom serialization for bigint (if we were persisting them)
      // For now, we don't persist secrets
    }
  )
);

/**
 * Helper to get display emoji for an index
 */
export function getEmojiForIndex(index: number): EmojiType | null {
  const emojis: EmojiType[] = ['👍', '❤️', '😂', '😮', '😢', '😡'];
  return index >= 0 && index < emojis.length ? emojis[index] : null;
}

/**
 * Helper to get index for an emoji
 */
export function getIndexForEmoji(emoji: EmojiType): number {
  const emojis: EmojiType[] = ['👍', '❤️', '😂', '😮', '😢', '😡'];
  return emojis.indexOf(emoji);
}
