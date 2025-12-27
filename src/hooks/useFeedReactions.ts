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

  // Derive feed ElGamal keys from AES key
  useEffect(() => {
    if (!feedAesKey || feedPublicKey || isDerivingKey) return;

    const deriveKey = async () => {
      setIsDerivingKey(true);
      try {
        debugLog(`[useFeedReactions] Deriving ElGamal key for feed ${feedId.substring(0, 8)}...`);
        const privateKey = await deriveFeedElGamalKey(feedAesKey);
        const publicKey = scalarMul(getGenerator(), privateKey);
        setFeedPublicKey(publicKey);
        setFeedPrivateKey(privateKey);
        debugLog(`[useFeedReactions] Feed keys derived`);
      } catch (err) {
        debugError(`[useFeedReactions] Failed to derive feed key:`, err);
        setError("Failed to derive feed encryption key");
      } finally {
        setIsDerivingKey(false);
      }
    };

    deriveKey();
  }, [feedAesKey, feedId, feedPublicKey, isDerivingKey]);

  // Poll for reaction tallies periodically
  const lastPollRef = useRef<number>(0);
  const POLL_INTERVAL_MS = 10_000; // Poll every 10 seconds (reduced frequency to minimize load)

  useEffect(() => {
    debugLog(`[useFeedReactions] Poll effect - feedPrivateKey: ${!!feedPrivateKey}`);
    if (!feedPrivateKey) {
      debugLog(`[useFeedReactions] Skipping poll - private key not ready`);
      return;
    }

    const pollTallies = async () => {
      const now = Date.now();
      if (now - lastPollRef.current < POLL_INTERVAL_MS) return;
      lastPollRef.current = now;

      // Get message IDs for this feed
      const messages = useFeedsStore.getState().messages[feedId] ?? [];
      const confirmedMessageIds = messages
        .filter((m) => m.isConfirmed && m.id)
        .map((m) => m.id)
        .slice(-20); // Last 20 messages

      if (confirmedMessageIds.length === 0) {
        debugLog(`[useFeedReactions] No confirmed messages to poll`);
        return;
      }

      try {
        // Ensure BSGS is loaded (will be instant if already loaded)
        await bsgsManager.ensureLoaded();

        debugLog(`[useFeedReactions] Polling tallies for ${confirmedMessageIds.length} messages in feed ${feedId.substring(0, 8)}...`);
        await reactionsServiceInstance.getTallies(feedId, confirmedMessageIds, feedPrivateKey);
        debugLog(`[useFeedReactions] Tallies updated`);
      } catch (err) {
        debugError(`[useFeedReactions] Failed to poll tallies:`, err);
      }
    };

    // Initial poll
    pollTallies();

    // Set up interval
    const interval = setInterval(pollTallies, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [feedId, feedPrivateKey]);

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
    error,
  };
}
