"use client";

import { useState, useRef, useEffect, memo } from "react";
import { Check, SmilePlus, Reply } from "lucide-react";
import { ReactionPicker } from "./ReactionPicker";
import { ReactionBar } from "./ReactionBar";
import { ReplyPreview } from "./ReplyPreview";
import type { EmojiCounts } from "@/modules/reactions/useReactionsStore";
import type { FeedMessage } from "@/types";

interface MessageBubbleProps {
  content: string;
  timestamp: string;
  isOwn: boolean;
  isConfirmed?: boolean;
  messageId?: string;
  reactionCounts?: EmojiCounts;
  myReaction?: number | null;
  isPendingReaction?: boolean;
  /** Handler for reaction selection. Receives messageId and emojiIndex for stable reference. */
  onReactionSelect?: (messageId: string, emojiIndex: number) => void;
  /** Reply to Message: ID of the parent message being replied to */
  replyToMessageId?: string;
  /** Reply to Message: Handler for reply button click */
  onReplyClick?: (message: FeedMessage) => void;
  /** Reply to Message: Handler for scrolling to a message when clicking reply preview */
  onScrollToMessage?: (messageId: string) => void;
  /** Reply to Message: The full message object (needed for onReplyClick) */
  message?: FeedMessage;
  /** Reply to Message: Function to resolve display name from public key */
  resolveDisplayName?: (publicKey: string) => string;
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
  replyToMessageId,
  onReplyClick,
  onScrollToMessage,
  message,
  resolveDisplayName,
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
    if (messageId) {
      onReactionSelect?.(messageId, emojiIndex);
    }
    setShowPicker(false);
  };

  const handleReplyClick = () => {
    if (message && onReplyClick) {
      onReplyClick(message);
    }
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
        {/* Action buttons - shows on hover, positioned on the LEFT side for own messages */}
        {isConfirmed && isOwn && (
          <div className="flex items-center mr-1">
            {/* Reply button */}
            {onReplyClick && message && (
              <button
                onClick={handleReplyClick}
                className={`
                  p-1 rounded-full mr-0.5
                  bg-hush-bg-light/80 hover:bg-hush-bg-light
                  text-hush-text-accent hover:text-hush-purple
                  transition-all duration-150
                  ${isHovering ? "opacity-100" : "opacity-0"}
                `}
                title="Reply to message"
                aria-label={`Reply to message`}
              >
                <Reply className="w-4 h-4" />
              </button>
            )}
            {/* Reaction button */}
            {onReactionSelect && (
              <div className="relative">
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
            {/* Reply preview - shows when this message is a reply */}
            {replyToMessageId && (
              <ReplyPreview
                messageId={replyToMessageId}
                onPreviewClick={onScrollToMessage}
                resolveDisplayName={resolveDisplayName}
              />
            )}
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
                onReactionClick={handleReactionClick}
                isOwnMessage={isOwn}
              />
            </div>
          )}

        </div>

        {/* Action buttons - shows on hover, positioned on the RIGHT side for others' messages */}
        {isConfirmed && !isOwn && (
          <div className="flex items-center ml-1">
            {/* Reply button */}
            {onReplyClick && message && (
              <button
                onClick={handleReplyClick}
                className={`
                  p-1 rounded-full mr-0.5
                  bg-hush-bg-light/80 hover:bg-hush-bg-light
                  text-hush-text-accent hover:text-hush-purple
                  transition-all duration-150
                  ${isHovering ? "opacity-100" : "opacity-0"}
                `}
                title="Reply to message"
                aria-label={`Reply to message`}
              >
                <Reply className="w-4 h-4" />
              </button>
            )}
            {/* Reaction button */}
            {onReactionSelect && (
              <div className="relative">
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
        )}
      </div>
    </div>
  );
});
