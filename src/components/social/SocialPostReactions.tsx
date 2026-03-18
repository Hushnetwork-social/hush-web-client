"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SmilePlus } from "lucide-react";
import { ReactionBar } from "@/components/chat/ReactionBar";
import { ReactionPicker } from "@/components/chat/ReactionPicker";
import { useFeedReactions } from "@/hooks/useFeedReactions";
import { GLOBAL_HUSH_MEMBERS_SCOPE_ID } from "@/modules/reactions/publicScope";
import { useReactionsStore } from "@/modules/reactions/useReactionsStore";
import { useAppStore } from "@/stores";
import { useFeedsStore } from "@/modules/feeds/useFeedsStore";

interface SocialPostReactionsProps {
  postId: string;
  reactionMessageId?: string | null;
  reactionScopeId?: string;
  visibility: "open" | "private";
  circleFeedIds: string[];
  authorCommitment?: string;
  isOwnMessage?: boolean;
  canInteract: boolean;
  testIdPrefix: string;
  onRequireAccount?: (reactionEmojiIndex?: number) => void;
  pendingAutoReactionIndex?: number | null;
  onPendingAutoReactionHandled?: () => void;
}

function resolveReactionFeedAesKey(circleFeedIds: string[]): string | undefined {
  if (circleFeedIds.length === 0) {
    return undefined;
  }

  const feedsStore = useFeedsStore.getState();
  const circleFeedId = circleFeedIds[0];
  const circleFeed = feedsStore.getFeed(circleFeedId);

  if (circleFeed?.type === "group") {
    return feedsStore.getCurrentGroupKey(circleFeedId);
  }

  return circleFeed?.aesKey;
}

export function SocialPostReactions({
  postId,
  reactionMessageId,
  reactionScopeId,
  visibility,
  circleFeedIds,
  authorCommitment,
  isOwnMessage = false,
  canInteract,
  testIdPrefix,
  onRequireAccount,
  pendingAutoReactionIndex,
  onPendingAutoReactionHandled,
}: SocialPostReactionsProps) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const hasHydratedMyReactionRef = useRef(false);
  const credentials = useAppStore((s) => s.credentials);
  const isGeneratingProof = useReactionsStore((s) => s.isGeneratingProof);
  const reactionScope = reactionScopeId ?? postId;
  const resolvedReactionMessageId = reactionMessageId === undefined ? postId : reactionMessageId;
  const membershipFeedId = visibility === "private"
    ? circleFeedIds[0]
    : GLOBAL_HUSH_MEMBERS_SCOPE_ID;
  const feedAesKey = visibility === "private"
    ? resolveReactionFeedAesKey(circleFeedIds)
    : undefined;

  const {
    getReactionCounts,
    getMyReaction,
    isPending,
    handleReactionSelect,
    fetchTalliesForMessages,
    hydrateMyReactions,
    error,
  } = useFeedReactions({
    feedId: reactionScope,
    feedAesKey,
    publicReactionKeyScopeId: visibility === "open" ? reactionScope : undefined,
    membershipFeedId,
    resolveAuthorCommitment: () => authorCommitment,
  });

  useEffect(() => {
    if (!resolvedReactionMessageId) {
      return;
    }

    const messageIds = [resolvedReactionMessageId];

    const refreshReactions = async () => {
      if (useReactionsStore.getState().isGeneratingProof) {
        return;
      }
      await fetchTalliesForMessages(messageIds, { forceRefresh: true });
    };

    void refreshReactions();

    const intervalId = window.setInterval(() => {
      void refreshReactions();
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchTalliesForMessages, isGeneratingProof, resolvedReactionMessageId]);

  useEffect(() => {
    if (!resolvedReactionMessageId) {
      return;
    }

    const messageIds = [resolvedReactionMessageId];

    if (!credentials?.mnemonic || hasHydratedMyReactionRef.current) {
      return;
    }

    hasHydratedMyReactionRef.current = true;
    void hydrateMyReactions(messageIds);
  }, [credentials?.mnemonic, hydrateMyReactions, resolvedReactionMessageId]);

  useEffect(() => {
    hasHydratedMyReactionRef.current = false;
  }, [resolvedReactionMessageId, credentials?.signingPublicKey]);

  const counts = getReactionCounts(resolvedReactionMessageId ?? postId);
  const myReaction = getMyReaction(resolvedReactionMessageId ?? postId);
  const pending = isPending(resolvedReactionMessageId ?? postId);
  const hasInteractiveIdentity = canInteract && !!credentials?.signingPublicKey;
  const isReadOnlyOwnMessage = isOwnMessage;
  const canOpenPicker = visibility === "open" || canInteract;
  const handleGuestInteraction = (reactionEmojiIndex?: number) => {
    if (!hasInteractiveIdentity && visibility === "open") {
      onRequireAccount?.(reactionEmojiIndex);
    }
  };

  useEffect(() => {
    if (
      pendingAutoReactionIndex === null ||
      pendingAutoReactionIndex === undefined ||
      !resolvedReactionMessageId ||
      !hasInteractiveIdentity ||
      pending ||
      isReadOnlyOwnMessage ||
      myReaction === pendingAutoReactionIndex
    ) {
      return;
    }

    void handleReactionSelect(resolvedReactionMessageId, pendingAutoReactionIndex)
      .finally(() => {
        onPendingAutoReactionHandled?.();
      });
  }, [
    handleReactionSelect,
    hasInteractiveIdentity,
    isReadOnlyOwnMessage,
    myReaction,
    onPendingAutoReactionHandled,
    pending,
    pendingAutoReactionIndex,
    resolvedReactionMessageId,
  ]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const visibleChipCount = useMemo(
    () =>
      Object.values(counts).filter((count) => count > 0).length +
      (myReaction !== null && myReaction >= 0 ? 1 : 0),
    [counts, myReaction]
  );

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2" data-testid={testIdPrefix}>
      <ReactionBar
        counts={counts}
        myReaction={myReaction}
        isPending={pending}
        isOwnMessage={isReadOnlyOwnMessage}
        disabled={pending || isReadOnlyOwnMessage}
        onReactionClick={
          hasInteractiveIdentity && !pending && !isReadOnlyOwnMessage
            ? (emojiIndex) => resolvedReactionMessageId
              ? void handleReactionSelect(resolvedReactionMessageId, emojiIndex)
              : undefined
            : visibility === "open"
              ? (emojiIndex) => handleGuestInteraction(emojiIndex)
              : undefined
        }
      />

      {isReadOnlyOwnMessage ? (
        <p
          className="text-[11px] text-hush-text-accent"
          data-testid={`${testIdPrefix}-own-message-note`}
        >
          cannot react to own message
        </p>
      ) : (
        <div className="relative" ref={pickerRef}>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-hush-purple/40 px-2 py-1 text-[11px] text-hush-purple hover:bg-hush-purple/10 disabled:opacity-60"
            data-testid={`${testIdPrefix}-add`}
            onClick={() => {
              if (!hasInteractiveIdentity) {
                handleGuestInteraction();
                return;
              }

              setShowPicker((current) => !current);
            }}
            disabled={!canOpenPicker || pending}
            title={hasInteractiveIdentity ? "Add reaction" : "Sign in to react"}
          >
            <SmilePlus className="h-3 w-3" />
            <span>{visibleChipCount > 0 ? "Add" : "React"}</span>
          </button>

          {showPicker ? (
            <div className="absolute z-20 mt-2" data-testid={`${testIdPrefix}-picker`}>
              <ReactionPicker
                onSelect={(emojiIndex) => {
                  if (!resolvedReactionMessageId) {
                    return;
                  }

                  void handleReactionSelect(resolvedReactionMessageId, emojiIndex);
                }}
                selectedEmoji={myReaction}
                disabled={!hasInteractiveIdentity || pending}
                onClose={() => setShowPicker(false)}
              />
            </div>
          ) : null}
        </div>
      )}

      {error && !isReadOnlyOwnMessage ? (
        <p
          className="basis-full text-[11px] text-red-400"
          data-testid={`${testIdPrefix}-error`}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
