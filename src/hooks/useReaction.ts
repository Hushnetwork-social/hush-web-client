/**
 * useReaction Hook
 *
 * React hook for managing reactions on a message.
 * Handles optimistic updates, ZK proof generation, and error recovery.
 */

import { useState, useCallback, useEffect } from "react";
import {
  useReactionsStore,
  EMPTY_EMOJI_COUNTS,
  type EmojiCounts,
} from "@/modules/reactions/useReactionsStore";
import { reactionsServiceInstance } from "@/modules/reactions/ReactionsService";
import type { Point } from "@/lib/crypto/reactions/babyjubjub";

interface UseReactionOptions {
  /** Feed ID for the message */
  feedId: string;

  /** Message ID to react to */
  messageId: string;

  /** Feed's public key for encryption */
  feedPublicKey?: Point;

  /** Message author's commitment (for author exclusion) */
  authorCommitment?: bigint;
}

interface UseReactionResult {
  /** Current reaction counts for all emojis */
  counts: EmojiCounts;

  /** User's current reaction (0-5 for emoji index, null if not reacted) */
  myReaction: number | null;

  /** Whether a reaction is being submitted */
  isPending: boolean;

  /** Whether the ZK prover is generating a proof */
  isGeneratingProof: boolean;

  /** Last error message, if any */
  error: string | null;

  /** Add or update a reaction */
  addReaction: (emojiIndex: number) => Promise<void>;

  /** Remove the current reaction */
  removeReaction: () => Promise<void>;

  /** Toggle a reaction (add if not reacted, remove if same, change if different) */
  toggleReaction: (emojiIndex: number) => Promise<void>;
}

/**
 * Hook for managing reactions on a message
 */
export function useReaction({
  feedId,
  messageId,
  feedPublicKey,
  authorCommitment,
}: UseReactionOptions): UseReactionResult {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to store state
  const reaction = useReactionsStore((s) => s.reactions[messageId]);
  const pendingReaction = useReactionsStore((s) => s.pendingReactions[messageId]);
  const isGeneratingProof = useReactionsStore((s) => s.isGeneratingProof);
  const isProverReady = useReactionsStore((s) => s.isProverReady);
  const userSecret = useReactionsStore((s) => s.userSecret);

  // Store actions
  const setPendingReaction = useReactionsStore((s) => s.setPendingReaction);
  const confirmReaction = useReactionsStore((s) => s.confirmReaction);
  const revertReaction = useReactionsStore((s) => s.revertReaction);

  // Determine current state
  const counts = reaction?.counts ?? EMPTY_EMOJI_COUNTS;
  const confirmedReaction = reaction?.myReaction ?? null;

  // Display the pending reaction if there is one, otherwise the confirmed one
  const myReaction = pendingReaction?.emojiIndex ?? confirmedReaction;

  // Load user's reaction on mount
  useEffect(() => {
    if (userSecret && !reaction) {
      reactionsServiceInstance
        .getMyReaction(feedId, messageId)
        .catch(console.error);
    }
  }, [feedId, messageId, userSecret, reaction]);

  /**
   * Add or update a reaction
   */
  const addReaction = useCallback(
    async (emojiIndex: number) => {
      if (!feedPublicKey || !authorCommitment) {
        setError("Feed configuration not available");
        return;
      }

      if (!isProverReady) {
        setError("ZK prover not ready. Please wait...");
        return;
      }

      // Optimistic update
      setPendingReaction(messageId, emojiIndex);
      setIsPending(true);
      setError(null);

      try {
        await reactionsServiceInstance.submitReaction(
          feedId,
          messageId,
          emojiIndex,
          feedPublicKey,
          authorCommitment
        );

        // Confirm the reaction
        confirmReaction(messageId);
      } catch (err) {
        // Revert on failure
        revertReaction(messageId);
        const errorMessage =
          err instanceof Error ? err.message : "Failed to add reaction";
        setError(errorMessage);
        console.error("[useReaction] Failed to add reaction:", err);
      } finally {
        setIsPending(false);
      }
    },
    [
      feedId,
      messageId,
      feedPublicKey,
      authorCommitment,
      isProverReady,
      setPendingReaction,
      confirmReaction,
      revertReaction,
    ]
  );

  /**
   * Remove the current reaction
   */
  const removeReaction = useCallback(async () => {
    if (!feedPublicKey || !authorCommitment) {
      setError("Feed configuration not available");
      return;
    }

    if (!isProverReady) {
      setError("ZK prover not ready. Please wait...");
      return;
    }

    // Optimistic update (index 6 = removal)
    setPendingReaction(messageId, -1);
    setIsPending(true);
    setError(null);

    try {
      await reactionsServiceInstance.removeReaction(
        feedId,
        messageId,
        feedPublicKey,
        authorCommitment
      );

      // Confirm the removal
      confirmReaction(messageId);
    } catch (err) {
      // Revert on failure
      revertReaction(messageId);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to remove reaction";
      setError(errorMessage);
      console.error("[useReaction] Failed to remove reaction:", err);
    } finally {
      setIsPending(false);
    }
  }, [
    feedId,
    messageId,
    feedPublicKey,
    authorCommitment,
    isProverReady,
    setPendingReaction,
    confirmReaction,
    revertReaction,
  ]);

  /**
   * Toggle a reaction
   */
  const toggleReaction = useCallback(
    async (emojiIndex: number) => {
      if (myReaction === emojiIndex) {
        // Clicking same emoji removes it
        await removeReaction();
      } else {
        // Add/change reaction
        await addReaction(emojiIndex);
      }
    },
    [myReaction, addReaction, removeReaction]
  );

  return {
    counts,
    myReaction: myReaction !== undefined && myReaction >= 0 ? myReaction : null,
    isPending: isPending || !!pendingReaction,
    isGeneratingProof,
    error,
    addReaction,
    removeReaction,
    toggleReaction,
  };
}
