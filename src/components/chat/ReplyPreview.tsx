"use client";

import { memo } from "react";
import { useFeedsStore } from "@/modules/feeds/useFeedsStore";

interface ReplyPreviewProps {
  /** ID of the message being replied to */
  messageId: string;
  /** Handler for when user clicks the preview (to scroll to original) */
  onPreviewClick?: (messageId: string) => void;
}

/**
 * ReplyPreview Component
 *
 * Displays a preview of the replied-to message inside a message bubble.
 * Shows sender name and truncated message content.
 * Clicking navigates to the original message.
 */
export const ReplyPreview = memo(function ReplyPreview({
  messageId,
  onPreviewClick,
}: ReplyPreviewProps) {
  const getMessageById = useFeedsStore((state) => state.getMessageById);
  const repliedMessage = getMessageById(messageId);

  const handleClick = () => {
    if (onPreviewClick) {
      onPreviewClick(messageId);
    }
  };

  // Handle deleted or not-found message
  if (!repliedMessage) {
    return (
      <div
        className="
          border-l-2 border-hush-text-accent/50
          bg-hush-bg-hover/30
          px-2 py-1 mb-2
          rounded-r
        "
        aria-label="Reply to deleted message"
      >
        <p className="text-xs text-hush-text-accent italic">
          Reply to deleted message
        </p>
      </div>
    );
  }

  // Truncate message content if too long
  const maxLength = 80;
  const truncatedContent = repliedMessage.content.length > maxLength
    ? repliedMessage.content.substring(0, maxLength) + "..."
    : repliedMessage.content;

  return (
    <button
      onClick={handleClick}
      className="
        w-full text-left
        border-l-2 border-hush-purple
        bg-hush-bg-hover/30
        px-2 py-1 mb-2
        rounded-r
        cursor-pointer
        hover:bg-hush-bg-hover/50
        transition-colors duration-150
        focus:outline-none focus:ring-1 focus:ring-hush-purple/50
      "
      aria-label={`Reply to message from ${repliedMessage.senderPublicKey.substring(0, 8)}...`}
      type="button"
    >
      <p className="text-xs font-medium text-hush-purple truncate">
        {repliedMessage.senderPublicKey.substring(0, 10)}...
      </p>
      <p className="text-xs text-hush-text-accent truncate">
        {truncatedContent}
      </p>
    </button>
  );
});
