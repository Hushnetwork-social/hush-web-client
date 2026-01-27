"use client";

import { memo, useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useFeedsStore } from "@/modules/feeds/useFeedsStore";
import type { FeedMessage } from "@/types";

interface ReplyPreviewProps {
  /** ID of the message being replied to */
  messageId: string;
  /** ID of the feed containing the message (needed for server fetch) */
  feedId: string;
  /** Handler for when user clicks the preview (to scroll to original) */
  onPreviewClick?: (messageId: string) => void;
  /** Function to resolve display name from public key (with optional server-provided name fallback) */
  resolveDisplayName?: (publicKey: string, senderName?: string) => string;
}

/**
 * ReplyPreview Component
 *
 * FEAT-056: Enhanced to fetch trimmed messages on demand.
 *
 * Displays a preview of the replied-to message inside a message bubble.
 * Shows sender name and truncated message content.
 * Clicking navigates to the original message.
 *
 * Loading states:
 * - Shows spinner while fetching from server
 * - Shows "Original message unavailable" if fetch fails
 * - Shows message content on success
 */
export const ReplyPreview = memo(function ReplyPreview({
  messageId,
  feedId,
  onPreviewClick,
  resolveDisplayName,
}: ReplyPreviewProps) {
  // First, check the sync cache for immediate display
  const getMessageById = useFeedsStore((state) => state.getMessageById);
  const fetchMessageById = useFeedsStore((state) => state.fetchMessageById);
  const cachedMessage = getMessageById(messageId);

  // State for async fetched message
  const [fetchedMessage, setFetchedMessage] = useState<FeedMessage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);

  // Fetch message from server if not in cache
  useEffect(() => {
    // If we have it in cache, no need to fetch
    if (cachedMessage) {
      setFetchedMessage(null);
      setFetchFailed(false);
      return;
    }

    // If already fetched, don't refetch
    if (fetchedMessage) {
      return;
    }

    // Fetch from server
    let cancelled = false;
    setIsLoading(true);
    setFetchFailed(false);

    fetchMessageById(feedId, messageId)
      .then((result) => {
        if (cancelled) return;
        if (result) {
          setFetchedMessage(result);
        } else {
          setFetchFailed(true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setFetchFailed(true);
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [messageId, feedId, cachedMessage, fetchedMessage, fetchMessageById]);

  // Use cached message or fetched message
  const repliedMessage = cachedMessage || fetchedMessage;

  const handleClick = useCallback(() => {
    if (onPreviewClick) {
      onPreviewClick(messageId);
    }
  }, [onPreviewClick, messageId]);

  // Loading state
  if (isLoading) {
    return (
      <div
        className="
          border-l-2 border-hush-purple/50
          bg-hush-bg-hover/30
          px-2 py-1 mb-2
          rounded-r
          flex items-center gap-2
        "
        aria-label="Loading reply preview"
      >
        <Loader2
          className="w-3 h-3 animate-spin text-hush-purple"
          aria-hidden="true"
        />
        <p className="text-xs text-hush-text-accent italic">
          Loading...
        </p>
      </div>
    );
  }

  // Error state or not found
  if (fetchFailed || !repliedMessage) {
    return (
      <div
        className="
          border-l-2 border-hush-text-accent/50
          bg-hush-bg-hover/30
          px-2 py-1 mb-2
          rounded-r
        "
        aria-label="Original message unavailable"
      >
        <p className="text-xs text-hush-text-accent italic">
          Original message unavailable
        </p>
      </div>
    );
  }

  // Truncate message content if too long
  const maxLength = 80;
  const truncatedContent = repliedMessage.content.length > maxLength
    ? repliedMessage.content.substring(0, maxLength) + "..."
    : repliedMessage.content;

  // Resolve display name or fall back to truncated public key
  // Pass senderName from message for users who left (server-provided name)
  const senderName = resolveDisplayName
    ? resolveDisplayName(repliedMessage.senderPublicKey, repliedMessage.senderName)
    : repliedMessage.senderName ?? repliedMessage.senderPublicKey.substring(0, 10) + "...";

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
        min-w-0
      "
      aria-label={`Reply to message from ${senderName}`}
      type="button"
    >
      <p className="text-xs font-medium text-hush-purple break-words">
        {senderName}
      </p>
      <p className="text-xs text-hush-text-accent break-words whitespace-pre-wrap">
        {truncatedContent}
      </p>
    </button>
  );
});
