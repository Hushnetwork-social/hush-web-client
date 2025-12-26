"use client";

import { memo } from "react";
import { Reply, X } from "lucide-react";
import type { FeedMessage } from "@/types";

interface ReplyContextBarProps {
  /** The message being replied to */
  replyingTo: FeedMessage;
  /** Display name of the message sender */
  senderDisplayName: string;
  /** Handler for cancel button click */
  onCancel: () => void;
}

/**
 * ReplyContextBar Component
 *
 * Shows reply context above the message input when user is replying to a message.
 * Displays "Replying to {sender}" with a preview and cancel button.
 */
export const ReplyContextBar = memo(function ReplyContextBar({
  replyingTo,
  senderDisplayName,
  onCancel,
}: ReplyContextBarProps) {
  // Truncate message content if too long
  const maxLength = 60;
  const truncatedContent = replyingTo.content.length > maxLength
    ? replyingTo.content.substring(0, maxLength) + "..."
    : replyingTo.content;

  // Use the provided display name
  const senderName = senderDisplayName;

  return (
    <div
      className="
        flex items-center justify-between
        px-4 py-2
        bg-hush-bg-dark/50
        border-b border-hush-bg-hover
      "
      role="status"
      aria-live="polite"
      aria-label={`Replying to ${senderName}`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Reply className="w-4 h-4 text-hush-purple flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="text-hush-text-accent">Replying to </span>
            <span className="font-medium text-hush-text-primary">{senderName}</span>
          </p>
          <p className="text-sm text-hush-text-accent truncate max-w-[200px] sm:max-w-[300px]">
            {truncatedContent}
          </p>
        </div>
      </div>
      <button
        onClick={onCancel}
        className="
          p-1 rounded
          hover:bg-hush-bg-hover
          text-hush-text-accent hover:text-hush-text-primary
          transition-colors duration-150
          flex-shrink-0
        "
        aria-label="Cancel reply"
        type="button"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
});
