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
  reactionScopeId?: string;
  visibility: "open" | "private";
  circleFeedIds: string[];
  authorCommitment?: string;
  canInteract: boolean;
  testIdPrefix: string;
  onRequireAccount?: () => void;
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
  reactionScopeId,
  visibility,
  circleFeedIds,
  authorCommitment,
  canInteract,
  testIdPrefix,
  onRequireAccount,
}: SocialPostReactionsProps) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const hasHydratedMyReactionRef = useRef(false);
  const credentials = useAppStore((s) => s.credentials);
  const isGeneratingProof = useReactionsStore((s) => s.isGeneratingProof);
  const reactionScope = reactionScopeId ?? postId;
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
    const messageIds = [postId];

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
  }, [fetchTalliesForMessages, isGeneratingProof, postId]);

  useEffect(() => {
    const messageIds = [postId];

    if (!credentials?.mnemonic || hasHydratedMyReactionRef.current) {
      return;
    }

    hasHydratedMyReactionRef.current = true;
    void hydrateMyReactions(messageIds);
  }, [credentials?.mnemonic, hydrateMyReactions, postId]);

  useEffect(() => {
    hasHydratedMyReactionRef.current = false;
  }, [postId, credentials?.signingPublicKey]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const counts = getReactionCounts(postId);
  const myReaction = getMyReaction(postId);
  const pending = isPending(postId);
  const hasInteractiveIdentity = canInteract && !!credentials?.signingPublicKey;
  const canOpenPicker = visibility === "open" || canInteract;
  const handleGuestInteraction = () => {
    if (!hasInteractiveIdentity && visibility === "open") {
      onRequireAccount?.();
    }
  };

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
        disabled={pending}
        onReactionClick={
          hasInteractiveIdentity && !pending
            ? (emojiIndex) => void handleReactionSelect(postId, emojiIndex)
            : visibility === "open"
              ? () => handleGuestInteraction()
              : undefined
        }
      />

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
              onSelect={(emojiIndex) => void handleReactionSelect(postId, emojiIndex)}
              selectedEmoji={myReaction}
              disabled={!hasInteractiveIdentity || pending}
              onClose={() => setShowPicker(false)}
            />
          </div>
        ) : null}
      </div>

      {error ? (
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
