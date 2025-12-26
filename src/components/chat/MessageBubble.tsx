"use client";

import { useState, useRef, useEffect, memo } from "react";
import { Check, SmilePlus } from "lucide-react";
import { ReactionPicker } from "./ReactionPicker";
import { ReactionBar } from "./ReactionBar";
import type { EmojiCounts } from "@/modules/reactions/useReactionsStore";

interface MessageBubbleProps {
  content: string;
  timestamp: string;
  isOwn: boolean;
  isConfirmed?: boolean;
  messageId?: string;
  reactionCounts?: EmojiCounts;
  myReaction?: number | null;
  isPendingReaction?: boolean;
  onReactionSelect?: (emojiIndex: number) => void;
}

export const MessageBubble = memo(function MessageBubble({
  content,
  timestamp,
  isOwn,
  isConfirmed = false,
  messageId,
  reactionCounts,
  myReaction,
  isPendingReaction = false,
  onReactionSelect,
}: MessageBubbleProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    };

    if (showPicker) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showPicker]);

  const handleReactionClick = (emojiIndex: number) => {
    onReactionSelect?.(emojiIndex);
    setShowPicker(false);
  };

  // Check if there are any active reactions to show (including pending/my reaction)
  const hasActiveReactions =
    (reactionCounts && Object.values(reactionCounts).some(c => c > 0)) ||
    (myReaction !== null && myReaction !== undefined && myReaction >= 0);

  // Layout: Left (others) 40% | Center (gap) 20% | Right (own) 40%
  return (
    <div
      className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
      style={{ marginBottom: hasActiveReactions ? '16px' : undefined }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => {
        setIsHovering(false);
        // Keep picker open if hovering over it
        if (!showPicker) setShowPicker(false);
      }}
    >
      <div className="relative group max-w-[60%] flex items-center">
        {/* Reaction button - shows on hover, positioned on the LEFT side for own messages */}
        {isConfirmed && onReactionSelect && isOwn && (
          <div className="relative mr-1">
            <button
              onClick={() => setShowPicker(!showPicker)}
              className={`
                p-1 rounded-full
                bg-hush-bg-light/80 hover:bg-hush-bg-light
                text-hush-text-accent hover:text-hush-purple
                transition-all duration-150
                ${isHovering || showPicker ? "opacity-100" : "opacity-0"}
              `}
              title="Add reaction"
            >
              <SmilePlus className="w-4 h-4" />
            </button>
            {/* Reaction picker - appears below the button */}
            {showPicker && (
              <div
                ref={pickerRef}
                className="absolute z-50 right-0 mt-1"
                style={{ top: "100%" }}
              >
                <ReactionPicker
                  onSelect={handleReactionClick}
                  selectedEmoji={myReaction ?? null}
                  onClose={() => setShowPicker(false)}
                />
              </div>
            )}
          </div>
        )}

        {/* Message bubble wrapper - relative for reaction bar positioning */}
        <div className="relative">
          <div
            className={`
              px-3 py-2
              ${
                isOwn
                  ? "bg-hush-purple text-hush-bg-dark rounded-bubble-sent"
                  : "bg-hush-bg-dark text-hush-text-primary rounded-bubble-received"
              }
            `}
          >
            <p className="text-sm break-words">{content}</p>
            {/* Only show timestamp and checkmark when confirmed */}
            {isConfirmed && (
              <div
                className={`
                  flex items-center justify-end space-x-1 mt-1
                  ${isOwn ? "text-hush-bg-dark/70" : "text-hush-text-accent"}
                `}
              >
                <span className="text-[10px]">{timestamp}</span>
                {isOwn && <Check className="w-3.5 h-3.5 opacity-20" />}
              </div>
            )}
          </div>

          {/* Reaction bar - slightly overlapping the message bubble (WhatsApp style) */}
          {reactionCounts && (
            <div
              className={`absolute ${isOwn ? "right-2" : "left-2"}`}
              style={{ bottom: '-18px' }}
            >
              <ReactionBar
                counts={reactionCounts}
                myReaction={myReaction ?? null}
                isPending={isPendingReaction}
                onReactionClick={onReactionSelect}
                isOwnMessage={isOwn}
              />
            </div>
          )}

        </div>

        {/* Reaction button - shows on hover, positioned on the RIGHT side for others' messages */}
        {isConfirmed && onReactionSelect && !isOwn && (
          <div className="relative ml-1">
            <button
              onClick={() => setShowPicker(!showPicker)}
              className={`
                p-1 rounded-full
                bg-hush-bg-light/80 hover:bg-hush-bg-light
                text-hush-text-accent hover:text-hush-purple
                transition-all duration-150
                ${isHovering || showPicker ? "opacity-100" : "opacity-0"}
              `}
              title="Add reaction"
            >
              <SmilePlus className="w-4 h-4" />
            </button>
            {/* Reaction picker - appears below the button */}
            {showPicker && (
              <div
                ref={pickerRef}
                className="absolute z-50 left-0 mt-1"
                style={{ top: "100%" }}
              >
                <ReactionPicker
                  onSelect={handleReactionClick}
                  selectedEmoji={myReaction ?? null}
                  onClose={() => setShowPicker(false)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
