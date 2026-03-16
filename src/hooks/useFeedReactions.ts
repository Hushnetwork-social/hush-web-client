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
  ensureCommitmentRegistered,
  initializeReactionsSystem,
} from "@/modules/reactions/initializeReactions";
import {
  deriveFeedElGamalKey,
  deriveDeterministicReactionScopeKey,
  deriveAddressMembershipSecret,
  computeCommitment,
  scalarMul,
  getGenerator,
  type Point,
  bsgsManager,
  bytesToBigint,
} from "@/lib/crypto/reactions";
import { debugLog, debugWarn, debugError } from "@/lib/debug-logger";
import { useFeedsStore } from "@/modules/feeds/useFeedsStore";
import { useAppStore } from "@/stores";
import { GLOBAL_HUSH_MEMBERS_SCOPE_ID } from "@/modules/reactions/publicScope";

// Module-level guards to prevent duplicate operations across React Strict Mode remounts
// These persist across component unmount/remount cycles
const activeTallyFetches = new Set<string>();

// Module-level PROMISE cache for derived ElGamal keys
// When React Strict Mode remounts a component, the second instance can WAIT for
// the first instance's derivation to complete instead of skipping
interface DerivedKeyResult {
  publicKey: Point;
  privateKey: bigint;
}
const derivationPromises = new Map<string, Promise<DerivedKeyResult>>(); // derivationKey -> Promise
function isReactionDevModeAllowed(): boolean {
  return process.env.NEXT_PUBLIC_REACTIONS_ALLOW_DEV_MODE === "true";
}

interface UseFeedReactionsOptions {
  /** Feed ID */
  feedId: string;

  /** Feed's decrypted AES key (base64) */
  feedAesKey?: string;

  /** Public reaction scope for open targets that do not have an AES-backed feed key */
  publicReactionKeyScopeId?: string;

  /** Feed scope used for membership proof registration, when different from the reaction scope */
  membershipFeedId?: string;

  /** Optional resolver for author commitments when the target is not a feed message */
  resolveAuthorCommitment?: (messageId: string) => string | undefined;
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
  fetchTalliesForMessages: (
    messageIds: string[],
    options?: { forceRefresh?: boolean }
  ) => Promise<void>;

  /** Recover the current user's reaction for specific message IDs */
  hydrateMyReactions: (messageIds: string[]) => Promise<void>;

  /** Current error, if any */
  error: string | null;
}

/**
 * Hook for managing reactions within a feed
 */
export function useFeedReactions({
  feedId,
  feedAesKey,
  publicReactionKeyScopeId,
  membershipFeedId,
  resolveAuthorCommitment,
}: UseFeedReactionsOptions): UseFeedReactionsResult {
  const [feedPublicKey, setFeedPublicKey] = useState<Point | null>(null);
  const [feedPrivateKey, setFeedPrivateKey] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDerivingKey, setIsDerivingKey] = useState(false);
  const credentials = useAppStore((s) => s.credentials);

  // Subscribe to store state
  const reactions = useReactionsStore((s) => s.reactions);
  const pendingReactions = useReactionsStore((s) => s.pendingReactions);
  const isProverReady = useReactionsStore((s) => s.isProverReady);
  const userSecret = useReactionsStore((s) => s.userSecret);

  // Store actions
  const setPendingReaction = useReactionsStore((s) => s.setPendingReaction);
  const confirmReaction = useReactionsStore((s) => s.confirmReaction);
  const revertReaction = useReactionsStore((s) => s.revertReaction);
  const getMessageById = useFeedsStore((s) => s.getMessageById);

  // Track key derivation to prevent duplicate calls (React Strict Mode)
  const keyDerivationStartedRef = useRef<string | null>(null);
  // Track the AES key we derived from, to detect when it changes (key rotation)
  const derivedFromAesKeyRef = useRef<string | null>(null);

  // Use refs to access fresh state in callbacks without re-creating them
  // This avoids stale closure issues where the callback captures old state
  const feedPublicKeyRef = useRef<Point | null>(null);
  feedPublicKeyRef.current = feedPublicKey;

  // Derive feed ElGamal keys from AES key
  useEffect(() => {
    console.log(`[E2E Reaction] useFeedReactions useEffect: feedId=${feedId.substring(0, 8)}..., feedAesKey=${feedAesKey?.substring(0, 16) ?? 'NOT SET'}..., publicReactionKeyScopeId=${publicReactionKeyScopeId?.substring(0, 8) ?? 'NOT SET'}..., isDerivingKey=${isDerivingKey}, feedPublicKey=${!!feedPublicKey}`);

    const derivationInput = feedAesKey ?? publicReactionKeyScopeId;

    // Skip if no derivation input or currently deriving
    if (!derivationInput || isDerivingKey) {
      console.log(`[E2E Reaction]   SKIPPING: !derivationInput=${!derivationInput}, isDerivingKey=${isDerivingKey}`);
      return;
    }

    // If AES key changed (key rotation), clear the old derived keys and re-derive
    if (derivedFromAesKeyRef.current !== null && derivedFromAesKeyRef.current !== derivationInput) {
      const oldDerivationInput = derivedFromAesKeyRef.current;
      debugLog(`[useFeedReactions] AES key changed for feed ${feedId.substring(0, 8)}... (key rotation detected)`);
      debugLog(`[useFeedReactions]   Previous derivation input: ${oldDerivationInput.substring(0, 16)}...`);
      debugLog(`[useFeedReactions]   New derivation input: ${derivationInput.substring(0, 16)}...`);
      debugLog(`[useFeedReactions]   Re-deriving ElGamal keys...`);
      // Invalidate any cached derivation promises for this feed before clearing refs.
      for (const key of derivationPromises.keys()) {
        if (key.startsWith(`${feedId}:`)) {
          derivationPromises.delete(key);
        }
      }
      // Now clear local state
      setFeedPublicKey(null);
      setFeedPrivateKey(null);
      keyDerivationStartedRef.current = null;
      derivedFromAesKeyRef.current = null;
    }

    // Skip if already have public key derived from current AES key
    if (feedPublicKey && derivedFromAesKeyRef.current === derivationInput) {
      console.log(`[E2E Reaction]   SKIPPING: Already have public key from current AES key`);
      return;
    }

    // Key derivation with Promise-based deduplication for React Strict Mode
    // When a second instance mounts while derivation is in progress, it WAITS for
    // the existing Promise instead of skipping (which would leave it without keys)
    const derivationKey = feedAesKey
      ? `${feedId}:aes:${feedAesKey.substring(0, 16)}`
      : `${feedId}:scope:${publicReactionKeyScopeId}`;

    // Skip if this instance already started derivation for this key
    if (keyDerivationStartedRef.current === derivationKey) {
      console.log(`[E2E Reaction]   SKIPPING: Already started derivation for this key (ref guard)`);
      return;
    }

    // Check if another instance is deriving or has derived this key
    const existingPromise = derivationPromises.get(derivationKey);
    if (existingPromise) {
      console.log(`[E2E Reaction]   WAITING: Another instance is deriving this key, awaiting...`);
      keyDerivationStartedRef.current = derivationKey;

      // Wait for the existing derivation to complete
      existingPromise.then((result) => {
        console.log(`[E2E Reaction]   REUSING: Got keys from other instance for feed ${feedId.substring(0, 8)}...`);
        feedPublicKeyRef.current = result.publicKey;
        setFeedPublicKey(result.publicKey);
        setFeedPrivateKey(result.privateKey);
        derivedFromAesKeyRef.current = derivationInput;
      }).catch((err) => {
        console.log(`[E2E Reaction]   OTHER INSTANCE FAILED: ${err}`);
        keyDerivationStartedRef.current = null; // Allow retry
      });
      return;
    }

    // This instance will do the derivation
    keyDerivationStartedRef.current = derivationKey;
    console.log(`[E2E Reaction]   Starting key derivation...`);

    // Create and store the Promise BEFORE starting async work
    const derivationPromise = (async (): Promise<DerivedKeyResult> => {
      setIsDerivingKey(true);
      try {
        let privateKey: bigint;
        if (feedAesKey) {
          console.log(`[E2E Reaction] useFeedReactions: Deriving ElGamal key for feed ${feedId.substring(0, 8)}... from AES key ${feedAesKey.substring(0, 16)}...`);
          debugLog(`[useFeedReactions] Deriving ElGamal key for feed ${feedId.substring(0, 8)}... from AES key ${feedAesKey.substring(0, 16)}...`);
          privateKey = await deriveFeedElGamalKey(feedAesKey);
        } else {
          console.log('[E2E Reaction] useFeedReactions: Deriving deterministic public reaction key');
          debugLog('[useFeedReactions] Deriving deterministic public reaction key');
          privateKey = await deriveDeterministicReactionScopeKey(publicReactionKeyScopeId!);
        }
        const publicKey = scalarMul(getGenerator(), privateKey);

        // Update ref IMMEDIATELY so callbacks can see it right away
        feedPublicKeyRef.current = publicKey;
        setFeedPublicKey(publicKey);
        setFeedPrivateKey(privateKey);
        derivedFromAesKeyRef.current = derivationInput;

        console.log(`[E2E Reaction] useFeedReactions: ElGamal key derived successfully for feed ${feedId.substring(0, 8)}...`);
        return { publicKey, privateKey };
      } catch (err) {
        console.log(`[E2E Reaction] useFeedReactions: Failed to derive feed key:`, err);
        debugError(`[useFeedReactions] Failed to derive feed key:`, err);
        setError("Failed to derive feed encryption key");
        keyDerivationStartedRef.current = null;
        derivedFromAesKeyRef.current = null;
        throw err;
      } finally {
        setIsDerivingKey(false);
        // Keep Promise in map for a short time so other instances can still use it
        // Then clean up to allow re-derivation on key rotation
        setTimeout(() => derivationPromises.delete(derivationKey), 5000);
      }
    })();

    derivationPromises.set(derivationKey, derivationPromise);
  }, [feedAesKey, feedId, feedPublicKey, isDerivingKey, publicReactionKeyScopeId]);

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
  const fetchTalliesForMessages = useCallback(async (
    messageIds: string[],
    options?: { forceRefresh?: boolean }
  ) => {
    if (!feedPrivateKey || messageIds.length === 0) return;
    if (useReactionsStore.getState().isGeneratingProof) {
      return;
    }
    const forceRefresh = options?.forceRefresh === true;
    if (forceRefresh) {
      debugLog(
        `[useFeedReactions] Forcing tally refresh for ${messageIds.length} target(s)`
      );
    }

    // Filter out message IDs that have already been fetched
    const newMessageIds = forceRefresh
      ? [...messageIds]
      : messageIds.filter(id => !fetchedTallyMessageIds.current.has(id));
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

  const hydratedMyReactionMessageIds = useRef<Set<string>>(new Set());

  const hydrateMyReactions = useCallback(async (messageIds: string[]) => {
    if (messageIds.length === 0) {
      return;
    }

    const candidateIds = messageIds.filter((id) => !hydratedMyReactionMessageIds.current.has(id));
    if (candidateIds.length === 0) {
      return;
    }

    const mnemonic = credentials?.mnemonic;
    if (!userSecret && mnemonic && mnemonic.length > 0) {
      await initializeReactionsSystem(mnemonic);
    }

    await Promise.all(
      candidateIds.map(async (messageId) => {
        try {
          await reactionsServiceInstance.getMyReaction(feedId, messageId);
          hydratedMyReactionMessageIds.current.add(messageId);
        } catch {
          // Keep the message eligible for retry if recovery fails.
        }
      })
    );
  }, [credentials, feedId, userSecret]);

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
      // Use ref to always get fresh state (avoids stale closure)
      let currentFeedPublicKey = feedPublicKeyRef.current;

      // [E2E Reaction] Debug logging for tracing the reaction flow
      console.log(`[E2E Reaction] handleReactionSelect called: messageId=${messageId.substring(0, 8)}..., emojiIndex=${emojiIndex}`);
      console.log(`[E2E Reaction]   feedPublicKey available (from ref): ${!!currentFeedPublicKey}`);
      console.log(`[E2E Reaction]   isProverReady: ${isProverReady}`);
      console.log(`[E2E Reaction]   userSecret available: ${!!userSecret}`);
      console.log(`[E2E Reaction]   AES key (derived from): ${derivedFromAesKeyRef.current?.substring(0, 16) ?? 'NOT SET'}...`);

      debugLog(`[useFeedReactions] Reaction selected: messageId=${messageId.substring(0, 8)}..., emojiIndex=${emojiIndex}`);
      debugLog(`[useFeedReactions]   Using AES key (derived from): ${derivedFromAesKeyRef.current?.substring(0, 16) ?? 'NOT SET'}...`);

      // Get current reaction for this message
      const currentReaction = getMyReaction(messageId);

      if (pendingReactions[messageId]) {
        debugWarn(`[useFeedReactions] Ignoring duplicate reaction click while submission is pending for ${messageId.substring(0, 8)}...`);
        return;
      }

      // If clicking the same emoji, remove the reaction
      const isRemoval = currentReaction === emojiIndex || emojiIndex >= 6;
      const newEmojiIndex = isRemoval ? -1 : emojiIndex;

      console.log(`[E2E Reaction]   currentReaction: ${currentReaction}, isRemoval: ${isRemoval}, newEmojiIndex: ${newEmojiIndex}`);

      // Optimistic update - immediately show the reaction (grayed/pending state)
      setPendingReaction(messageId, newEmojiIndex);
      setError(null);

      // Check if we can actually submit to the server (use ref for fresh value)
      if (!currentFeedPublicKey) {
        if (feedAesKey) {
          try {
            const privateKey = await deriveFeedElGamalKey(feedAesKey);
            currentFeedPublicKey = scalarMul(getGenerator(), privateKey);
            feedPublicKeyRef.current = currentFeedPublicKey;
            setFeedPublicKey(currentFeedPublicKey);
            setFeedPrivateKey(privateKey);
            derivedFromAesKeyRef.current = feedAesKey;
          } catch (err) {
            console.log(`[E2E Reaction] EARLY RETURN: Feed public key derivation failed`);
            debugWarn("[useFeedReactions] Feed public key derivation failed", err);
            revertReaction(messageId);
            setError("Reactions are unavailable because the feed encryption key is not ready.");
            return;
          }
        } else {
          console.log(`[E2E Reaction] EARLY RETURN: Feed public key not available`);
          debugWarn("[useFeedReactions] Feed public key not available, reaction stays pending");
          // Reaction stays in pending state until server confirms or user cancels
          return;
        }
      }

      // Dev mode must be an explicit opt-in. Missing prover support should not silently
      // downgrade the supported path and contaminate privacy or throughput evidence.
      const devModeAllowed = isReactionDevModeAllowed();
      const useDevMode = devModeAllowed && !isProverReady;
      if (useDevMode) {
        console.log(`[E2E Reaction] Using DEV MODE (ZK prover not ready)`);
        debugWarn("[useFeedReactions] ZK prover not ready, using DEV MODE submission");
      }

      if (!isProverReady && !devModeAllowed) {
        console.log(`[E2E Reaction] EARLY RETURN: ZK prover not ready and dev mode is not explicitly enabled`);
        revertReaction(messageId);
        const errorMessage = "Reactions are unavailable because the ZK prover is not ready.";
        setError(errorMessage);
        debugWarn(`[useFeedReactions] ${errorMessage}`);
        return;
      }

      if (!userSecret) {
        const mnemonic = credentials?.mnemonic;
        if (mnemonic && mnemonic.length > 0) {
          const initialized = await initializeReactionsSystem(mnemonic);
          if (!initialized) {
            revertReaction(messageId);
            const errorMessage =
              "Reactions are unavailable because reaction credentials could not be initialized.";
            setError(errorMessage);
            debugWarn(`[useFeedReactions] ${errorMessage}`);
            return;
          }
        } else {
          console.log(`[E2E Reaction] EARLY RETURN: User secret not set`);
          debugWarn("[useFeedReactions] User secret not set, reaction stays pending");
          // Reaction stays in pending state
          return;
        }
      }

      let effectiveUserSecret = userSecret ?? null;
      let effectiveUserCommitment: bigint | null = null;

      if (membershipFeedId === GLOBAL_HUSH_MEMBERS_SCOPE_ID) {
        const publicSigningAddress = credentials?.signingPublicKey;
        if (!publicSigningAddress) {
          revertReaction(messageId);
          const errorMessage =
            "Reactions are unavailable because the public membership identity is not ready.";
          setError(errorMessage);
          debugWarn(`[useFeedReactions] ${errorMessage}`);
          return;
        }

        effectiveUserSecret = await deriveAddressMembershipSecret(publicSigningAddress);
        effectiveUserCommitment = await computeCommitment(effectiveUserSecret);
        debugLog(
          `[useFeedReactions] Derived global membership commitment for ${publicSigningAddress.substring(0, 20)}...`
        );
      }

      if (!useDevMode) {
        const effectiveMembershipFeedId = membershipFeedId ?? feedId;
        if (!effectiveMembershipFeedId) {
          revertReaction(messageId);
          const errorMessage =
            "Reactions are unavailable because the membership scope is not ready for this target.";
          setError(errorMessage);
          debugWarn(`[useFeedReactions] ${errorMessage}`);
          return;
        }

        const isRegisteredForFeed = await ensureCommitmentRegistered(
          effectiveMembershipFeedId,
          effectiveUserCommitment ?? undefined
        );
        if (!isRegisteredForFeed) {
          revertReaction(messageId);
          const errorMessage =
            "Reactions are unavailable because membership registration is not ready for this feed.";
          setError(errorMessage);
          debugWarn(`[useFeedReactions] ${errorMessage}`);
          return;
        }
      } else {
        console.log("[E2E Reaction] DEV MODE: skipping membership registration gate");
      }

      const message = getMessageById(messageId);
      let authorCommitment: bigint | null = null;
      const resolvedAuthorCommitment = resolveAuthorCommitment?.(messageId);

      if (message?.authorCommitment || resolvedAuthorCommitment) {
        try {
          const commitmentBytes = Uint8Array.from(
            atob(message?.authorCommitment ?? resolvedAuthorCommitment ?? ""),
            (char) => char.charCodeAt(0)
          );
          authorCommitment = bytesToBigint(commitmentBytes);
        } catch (decodeError) {
          debugWarn("[useFeedReactions] Failed to decode author commitment", decodeError);
        }
      }

      if (authorCommitment === null) {
        if (useDevMode) {
          authorCommitment = 0n;
          debugWarn("[useFeedReactions] Author commitment missing, falling back to dev-mode placeholder");
        } else {
          revertReaction(messageId);
          const errorMessage = "Reactions are unavailable because the message author commitment is missing.";
          setError(errorMessage);
          debugWarn(`[useFeedReactions] ${errorMessage}`);
          return;
        }
      }

      console.log(`[E2E Reaction] Preconditions passed, submitting reaction (useDevMode=${useDevMode})`);

      try {
        if (useDevMode) {
          // DEV MODE: Submit without ZK proof
          console.log(`[E2E Reaction] Calling reactionsServiceInstance.submitReactionDevMode...`);
          if (isRemoval) {
            await reactionsServiceInstance.removeReactionDevMode(
              feedId,
              messageId,
              currentFeedPublicKey
            );
          } else {
            await reactionsServiceInstance.submitReactionDevMode(
              feedId,
              messageId,
              emojiIndex,
              currentFeedPublicKey
            );
          }
          console.log(`[E2E Reaction] DEV MODE submission completed successfully`);
        } else {
          // PRODUCTION: Submit with full ZK proof
          if (isRemoval) {
            await reactionsServiceInstance.removeReaction(
              feedId,
              messageId,
              currentFeedPublicKey,
              authorCommitment,
              membershipFeedId ?? feedId,
              effectiveUserSecret ?? undefined,
              effectiveUserCommitment ?? undefined
            );
          } else {
            await reactionsServiceInstance.submitReaction(
              feedId,
              messageId,
              emojiIndex,
              currentFeedPublicKey,
              authorCommitment,
              membershipFeedId ?? feedId,
              effectiveUserSecret ?? undefined,
              effectiveUserCommitment ?? undefined
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
      feedAesKey,
      isProverReady,
      pendingReactions,
      userSecret,
      getMyReaction,
      setPendingReaction,
      confirmReaction,
      revertReaction,
      refreshTallies,
      getMessageById,
      membershipFeedId,
      resolveAuthorCommitment,
      credentials,
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
    hydrateMyReactions,
    error,
  };
}
