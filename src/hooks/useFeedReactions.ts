/**
 * useFeedReactions Hook
 *
 * Hook for managing reactions within a feed.
 * Handles feed key derivation, optimistic updates, and reaction submission.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  useReactionsStore,
  EMPTY_EMOJI_COUNTS,
  type EmojiCounts,
} from "@/modules/reactions/useReactionsStore";
import { reactionsServiceInstance } from "@/modules/reactions/ReactionsService";
import {
  deriveFeedElGamalKey,
  scalarMul,
  getGenerator,
  type Point,
  bsgsManager,
} from "@/lib/crypto/reactions";
import { debugLog, debugWarn, debugError } from "@/lib/debug-logger";
import { useFeedsStore } from "@/modules/feeds/useFeedsStore";

// Module-level guards to prevent duplicate operations across React Strict Mode remounts
// These persist across component unmount/remount cycles
const activeKeyDerivations = new Set<string>();
const activeTallyFetches = new Set<string>();

interface UseFeedReactionsOptions {
  /** Feed ID */
  feedId: string;

  /** Feed's decrypted AES key (base64) */
  feedAesKey?: string;
}

interface UseFeedReactionsResult {
  /** Get reaction counts for a message */
  getReactionCounts: (messageId: string) => EmojiCounts;

  /** Get user's own reaction for a message */
  getMyReaction: (messageId: string) => number | null;

  /** Check if a message has a pending reaction */
  isPending: (messageId: string) => boolean;

  /** Whether the reactions system is ready */
  isReady: boolean;

  /** Handle reaction selection for a message */
  handleReactionSelect: (messageId: string, emojiIndex: number) => Promise<void>;

  /** Fetch tallies for specific message IDs (call when messages become visible) */
  fetchTalliesForMessages: (messageIds: string[]) => Promise<void>;

  /** Current error, if any */
  error: string | null;
}

/**
 * Hook for managing reactions within a feed
 */
export function useFeedReactions({
  feedId,
  feedAesKey,
}: UseFeedReactionsOptions): UseFeedReactionsResult {
  const [feedPublicKey, setFeedPublicKey] = useState<Point | null>(null);
  const [feedPrivateKey, setFeedPrivateKey] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDerivingKey, setIsDerivingKey] = useState(false);

  // Subscribe to store state
  const reactions = useReactionsStore((s) => s.reactions);
  const pendingReactions = useReactionsStore((s) => s.pendingReactions);
  const isProverReady = useReactionsStore((s) => s.isProverReady);
  const userSecret = useReactionsStore((s) => s.userSecret);

  // Store actions
  const setPendingReaction = useReactionsStore((s) => s.setPendingReaction);
  const confirmReaction = useReactionsStore((s) => s.confirmReaction);
  const revertReaction = useReactionsStore((s) => s.revertReaction);

  // Track key derivation to prevent duplicate calls (React Strict Mode)
  const keyDerivationStartedRef = useRef<string | null>(null);
  // Track the AES key we derived from, to detect when it changes (key rotation)
  const derivedFromAesKeyRef = useRef<string | null>(null);

  // Derive feed ElGamal keys from AES key
  useEffect(() => {
    // Skip if no AES key or currently deriving
    if (!feedAesKey || isDerivingKey) return;

    // If AES key changed (key rotation), clear the old derived keys and re-derive
    if (derivedFromAesKeyRef.current !== null && derivedFromAesKeyRef.current !== feedAesKey) {
      debugLog(`[useFeedReactions] AES key changed for feed ${feedId.substring(0, 8)}... (key rotation detected)`);
      debugLog(`[useFeedReactions]   Previous AES key: ${derivedFromAesKeyRef.current.substring(0, 16)}...`);
      debugLog(`[useFeedReactions]   New AES key: ${feedAesKey.substring(0, 16)}...`);
      debugLog(`[useFeedReactions]   Re-deriving ElGamal keys...`);
      setFeedPublicKey(null);
      setFeedPrivateKey(null);
      keyDerivationStartedRef.current = null;
      derivedFromAesKeyRef.current = null;
    }

    // Skip if already have public key derived from current AES key
    if (feedPublicKey && derivedFromAesKeyRef.current === feedAesKey) return;

    // Prevent duplicate derivation for the same feed+key (React Strict Mode protection)
    // Use both ref (component-level) and Set (module-level) for robust protection
    const derivationKey = `${feedId}:${feedAesKey.substring(0, 16)}`;
    if (keyDerivationStartedRef.current === derivationKey || activeKeyDerivations.has(derivationKey)) {
      return;
    }
    keyDerivationStartedRef.current = derivationKey;
    activeKeyDerivations.add(derivationKey);

    const deriveKey = async () => {
      setIsDerivingKey(true);
      const startTime = performance.now();
      try {
        debugLog(`[useFeedReactions] Deriving ElGamal key for feed ${feedId.substring(0, 8)}... from AES key ${feedAesKey.substring(0, 16)}...`);
        const privateKey = await deriveFeedElGamalKey(feedAesKey);
        const deriveTime = performance.now() - startTime;
        const publicKey = scalarMul(getGenerator(), privateKey);
        const scalarMulTime = performance.now() - startTime - deriveTime;
        setFeedPublicKey(publicKey);
        setFeedPrivateKey(privateKey);
        // Track which AES key we derived from (for detecting key rotation)
        derivedFromAesKeyRef.current = feedAesKey;
      } catch (err) {
        debugError(`[useFeedReactions] Failed to derive feed key:`, err);
        setError("Failed to derive feed encryption key");
        keyDerivationStartedRef.current = null; // Allow retry on error
        derivedFromAesKeyRef.current = null;
        activeKeyDerivations.delete(derivationKey); // Allow retry on error
      } finally {
        setIsDerivingKey(false);
      }
    };

    deriveKey();
  }, [feedAesKey, feedId, feedPublicKey, isDerivingKey]);

  // Track which message IDs have already had tallies fetched (to avoid duplicate decryption)
  const fetchedTallyMessageIds = useRef<Set<string>>(new Set());
  // Guard against concurrent tally fetches
  const isFetchingTalliesRef = useRef(false);

  // Reset fetched tallies tracking when feedId changes
  useEffect(() => {
    fetchedTallyMessageIds.current = new Set();
    isFetchingTalliesRef.current = false;
  }, [feedId]);

  // Fetch tallies for specific message IDs (lazy loading for visible messages)
  const fetchTalliesForMessages = useCallback(async (messageIds: string[]) => {
    if (!feedPrivateKey || messageIds.length === 0) return;

    // Filter out message IDs that have already been fetched
    const newMessageIds = messageIds.filter(id => !fetchedTallyMessageIds.current.has(id));
    if (newMessageIds.length === 0) return;

    // Prevent concurrent fetches
    if (isFetchingTalliesRef.current || activeTallyFetches.has(feedId)) {
      return;
    }
    isFetchingTalliesRef.current = true;
    activeTallyFetches.add(feedId);

    // Mark these IDs as being fetched (optimistic, to prevent duplicate requests)
    newMessageIds.forEach(id => fetchedTallyMessageIds.current.add(id));

    try {
      await bsgsManager.ensureLoaded();
      await reactionsServiceInstance.getTallies(feedId, newMessageIds, feedPrivateKey);
    } catch (err) {
      // On error, remove IDs from fetched set so they can be retried
      newMessageIds.forEach(id => fetchedTallyMessageIds.current.delete(id));
      console.error(`[useFeedReactions] Failed to fetch tallies:`, err);
    } finally {
      isFetchingTalliesRef.current = false;
      activeTallyFetches.delete(feedId);
    }
  }, [feedId, feedPrivateKey]);

  // Legacy refreshTallies for after reaction submission (refreshes last 20 messages)
  const refreshTallies = useCallback(async () => {
    if (!feedPrivateKey) return;

    const messages = useFeedsStore.getState().messages[feedId] ?? [];
    const confirmedMessageIds = messages
      .filter((m) => m.isConfirmed && m.id)
      .map((m) => m.id)
      .slice(-20);

    // Clear the fetched set for these IDs to force refresh
    confirmedMessageIds.forEach(id => fetchedTallyMessageIds.current.delete(id));
    await fetchTalliesForMessages(confirmedMessageIds);
  }, [feedId, feedPrivateKey, fetchTalliesForMessages]);

  // Get reaction counts for a message
  const getReactionCounts = useCallback(
    (messageId: string): EmojiCounts => {
      return reactions[messageId]?.counts ?? EMPTY_EMOJI_COUNTS;
    },
    [reactions]
  );

  // Get user's own reaction for a message
  const getMyReaction = useCallback(
    (messageId: string): number | null => {
      // Show pending reaction if exists, otherwise confirmed reaction
      const pending = pendingReactions[messageId];
      if (pending) {
        return pending.emojiIndex >= 0 ? pending.emojiIndex : null;
      }
      return reactions[messageId]?.myReaction ?? null;
    },
    [reactions, pendingReactions]
  );

  // Check if a message has a pending reaction
  const isPending = useCallback(
    (messageId: string): boolean => {
      return !!pendingReactions[messageId];
    },
    [pendingReactions]
  );

  // Handle reaction selection
  const handleReactionSelect = useCallback(
    async (messageId: string, emojiIndex: number) => {
      debugLog(`[useFeedReactions] Reaction selected: messageId=${messageId.substring(0, 8)}..., emojiIndex=${emojiIndex}`);
      debugLog(`[useFeedReactions]   Using AES key (derived from): ${derivedFromAesKeyRef.current?.substring(0, 16) ?? 'NOT SET'}...`);

      // Get current reaction for this message
      const currentReaction = getMyReaction(messageId);

      // If clicking the same emoji, remove the reaction
      const isRemoval = currentReaction === emojiIndex || emojiIndex >= 6;
      const newEmojiIndex = isRemoval ? -1 : emojiIndex;

      // Optimistic update - immediately show the reaction (grayed/pending state)
      setPendingReaction(messageId, newEmojiIndex);
      setError(null);

      // Check if we can actually submit to the server
      if (!feedPublicKey) {
        debugWarn("[useFeedReactions] Feed public key not available, reaction stays pending");
        // Reaction stays in pending state until server confirms or user cancels
        return;
      }

      // DEV MODE: If ZK prover isn't ready, use dev mode submission
      // This allows testing the full reaction flow without real ZK proofs
      const useDevMode = !isProverReady;
      if (useDevMode) {
        debugWarn("[useFeedReactions] ZK prover not ready, using DEV MODE submission");
      }

      if (!userSecret) {
        debugWarn("[useFeedReactions] User secret not set, reaction stays pending");
        // Reaction stays in pending state
        return;
      }

      // TODO: Get actual author commitment from message metadata or server
      // For now, use 0n which disables author exclusion check in the circuit
      const authorCommitment = 0n;

      try {
        if (useDevMode) {
          // DEV MODE: Submit without ZK proof
          if (isRemoval) {
            await reactionsServiceInstance.removeReactionDevMode(
              feedId,
              messageId,
              feedPublicKey
            );
          } else {
            await reactionsServiceInstance.submitReactionDevMode(
              feedId,
              messageId,
              emojiIndex,
              feedPublicKey
            );
          }
        } else {
          // PRODUCTION: Submit with full ZK proof
          if (isRemoval) {
            await reactionsServiceInstance.removeReaction(
              feedId,
              messageId,
              feedPublicKey,
              authorCommitment
            );
          } else {
            await reactionsServiceInstance.submitReaction(
              feedId,
              messageId,
              emojiIndex,
              feedPublicKey,
              authorCommitment
            );
          }
        }

        // Confirm the optimistic update - server accepted the reaction
        confirmReaction(messageId);
        debugLog(`[useFeedReactions] Reaction confirmed for ${messageId.substring(0, 8)}...`);

        // Refresh tallies after successful submission to get updated counts
        refreshTallies();
      } catch (err) {
        // Revert the optimistic update - proof failed or server rejected
        revertReaction(messageId);
        const errorMessage = err instanceof Error ? err.message : "Failed to submit reaction";
        setError(errorMessage);
        debugError(`[useFeedReactions] Reaction failed:`, err);
      }
    },
    [
      feedId,
      feedPublicKey,
      isProverReady,
      userSecret,
      getMyReaction,
      setPendingReaction,
      confirmReaction,
      revertReaction,
      refreshTallies,
    ]
  );

  // Whether the reactions system is ready for full operation
  const isReady = useMemo(() => {
    return !!feedPublicKey && isProverReady && !!userSecret;
  }, [feedPublicKey, isProverReady, userSecret]);

  return {
    getReactionCounts,
    getMyReaction,
    isPending,
    isReady,
    handleReactionSelect,
    fetchTalliesForMessages,
    error,
  };
}
