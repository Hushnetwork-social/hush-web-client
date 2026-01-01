"use client";

import { EMOJIS } from "@/lib/crypto/reactions/constants";
import type { EmojiCounts } from "@/modules/reactions/useReactionsStore";

interface ReactionBarProps {
  counts: EmojiCounts;
  myReaction: number | null;
  isPending?: boolean;
  onReactionClick?: (emojiIndex: number) => void;
  isOwnMessage?: boolean;
}

/**
 * Displays reaction counts below a message
 *
 * Shows emojis with their counts, highlighting the user's own reaction.
 * Pending reactions show as grayed/desaturated at 50% opacity with pulse.
 * Confirmed reactions show at full color.
 *
 * See MemoryBank/ProtocolOmega/PROTOCOL_OMEGA_UI.md for design spec.
 */
export function ReactionBar({
  counts,
  myReaction,
  isPending = false,
  onReactionClick,
  isOwnMessage = false,
}: ReactionBarProps) {
  // Get emojis with counts > 0
  const activeReactions = EMOJIS.map((emoji, index) => ({
    emoji,
    index,
    count: counts[emoji] || 0,
  })).filter((r) => r.count > 0 || myReaction === r.index);

  // Don't render if no reactions
  if (activeReactions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Reactions">
      {activeReactions.map(({ emoji, index, count }) => {
        const isMyReaction = myReaction === index;
        const displayCount = isMyReaction && count === 0 ? 1 : count;
        // My reaction is pending if isPending=true AND server count is 0 (not yet confirmed)
        const isMyPendingReaction = isPending && isMyReaction && count === 0;

        // Color scheme depends on whether it's on own message or other's message
        // Own message (purple bg): use dark background for contrast
        // Other's message (dark bg): use purple/light background for contrast
        const baseColors = isOwnMessage
          ? isMyReaction
            ? "bg-hush-bg-dark text-hush-purple border border-hush-purple/50"
            : "bg-hush-bg-dark text-hush-text-primary border border-hush-border"
          : isMyReaction
            ? "bg-hush-purple text-white border border-hush-purple"
            : "bg-hush-bg-hover text-hush-text-primary border border-hush-border";

        return (
          <button
            key={emoji}
            onClick={() => onReactionClick?.(index)}
            disabled={!onReactionClick}
            className={`
              inline-flex items-center gap-0.5
              text-xs px-1.5 py-0.5 rounded-full
              shadow-sm
              transition-all duration-200
              ${baseColors}
              ${
                isMyPendingReaction
                  ? "opacity-50 grayscale animate-pulse"
                  : "opacity-100"
              }
              ${onReactionClick ? "hover:scale-105 cursor-pointer" : "cursor-default"}
            `}
            title={
              isMyPendingReaction
                ? `Sending ${emoji} reaction...`
                : isMyReaction
                ? `You reacted with ${emoji}${count > 1 ? ` (${count} total)` : ""}`
                : `${count} ${emoji} reaction${count !== 1 ? "s" : ""}`
            }
          >
            <span className="text-sm">{emoji}</span>
            <span className="font-medium">{displayCount}</span>
          </button>
        );
      })}
    </div>
  );
}
