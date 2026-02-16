"use client";

import { useState, useRef, useEffect, memo, useMemo, useCallback } from "react";
import { Check, SmilePlus, Reply, Clock, Loader2, AlertTriangle } from "lucide-react";
import { ReactionPicker } from "./ReactionPicker";
import { ReactionBar } from "./ReactionBar";
import { ReplyPreview } from "./ReplyPreview";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { LinkPreviewCarousel, LinkPreviewCard, LinkPreviewSkeleton } from "@/components/LinkPreview";
import { ContentCarousel } from "@/components/chat/ContentCarousel";
import { AttachmentThumbnail } from "@/components/chat/AttachmentThumbnail";
import { parseMentions, MentionText } from "@/lib/mentions";
import { useLinkPreviews } from "@/hooks/useLinkPreviews";
import type { EmojiCounts } from "@/modules/reactions/useReactionsStore";
import type { FeedMessage, GroupMemberRole, MessageStatus, AttachmentRefMeta } from "@/types";

/**
 * FEAT-058: Message status icon component
 * Shows visual indicator for message delivery state
 */
interface MessageStatusIconProps {
  status: MessageStatus;
  isOwn: boolean;
  onRetryClick?: () => void;
}

function MessageStatusIcon({ status, isOwn, onRetryClick }: MessageStatusIconProps) {
  // Status styling differs based on message ownership
  const baseClasses = isOwn ? "text-hush-bg-dark/70" : "text-hush-text-accent";

  switch (status) {
    case 'pending':
      return (
        <Clock
          className={`w-3.5 h-3.5 opacity-40 ${baseClasses}`}
          aria-label="Message pending"
          data-testid="message-pending"
        />
      );

    case 'confirming':
      return (
        <Loader2
          className={`w-3.5 h-3.5 animate-spin ${isOwn ? "text-hush-bg-dark/70" : "text-blue-400"}`}
          aria-label="Sending message"
          data-testid="message-confirming"
        />
      );

    case 'confirmed':
      return (
        <Check
          className={`w-3.5 h-3.5 opacity-20 ${baseClasses}`}
          aria-label="Message delivered"
          data-testid="message-confirmed"
        />
      );

    case 'failed':
      return (
        <AlertTriangle
          className={`w-3.5 h-3.5 text-amber-500 cursor-pointer hover:text-amber-400 transition-colors`}
          onClick={(e) => {
            e.stopPropagation();
            onRetryClick?.();
          }}
          aria-label="Message failed - click to retry"
          role="button"
          tabIndex={0}
          data-testid="message-failed"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onRetryClick?.();
            }
          }}
        />
      );

    default:
      return null;
  }
}

interface MessageBubbleProps {
  content: string;
  timestamp: string;
  isOwn: boolean;
  /** @deprecated Use status instead */
  isConfirmed?: boolean;
  /** FEAT-058: Message delivery status */
  status?: MessageStatus;
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
  /** Reply to Message: Function to resolve display name from public key (with optional server-provided name) */
  resolveDisplayName?: (publicKey: string, senderName?: string) => string;
  /** FEAT-056: Feed ID for fetching reply preview from server */
  feedId?: string;
  /** Group Feed: Whether to show sender name (for group messages from others) */
  showSender?: boolean;
  /** Group Feed: Display name of the sender */
  senderName?: string;
  /** Group Feed: Role of the sender in the group */
  senderRole?: GroupMemberRole;
  /** Mention: Handler for when a mention is clicked */
  onMentionClick?: (identityId: string) => void;
  /** FEAT-058: Handler for retrying failed message */
  onRetryClick?: () => void;
  /** FEAT-067: Attachment metadata for this message */
  attachments?: AttachmentRefMeta[];
  /** FEAT-067: Map of attachment ID -> thumbnail blob URL (null while loading) */
  attachmentThumbnails?: Map<string, string | null>;
  /** FEAT-067: Callback when an attachment thumbnail is clicked (opens lightbox) */
  onAttachmentClick?: (attachmentId: string, index: number) => void;
}

export const MessageBubble = memo(function MessageBubble({
  content,
  timestamp,
  isOwn,
  isConfirmed = false,
  status,
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
  feedId,
  showSender = false,
  senderName,
  senderRole,
  onMentionClick,
  onRetryClick,
  attachments,
  attachmentThumbnails,
  onAttachmentClick,
}: MessageBubbleProps) {
  // FEAT-058: Compute effective status (backward compatible with isConfirmed)
  const effectiveStatus: MessageStatus = status ?? (isConfirmed ? 'confirmed' : 'pending');
  const isMessageConfirmed = effectiveStatus === 'confirmed';
  const [showPicker, setShowPicker] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Link preview hook - detects URLs and fetches metadata
  const { urls, metadataMap, loadingUrls, hasUrls } = useLinkPreviews(content);

  // FEAT-067: Build attachment thumbnail items
  const hasAttachments = !!(attachments && attachments.length > 0);
  const attachmentItems = useMemo(() => {
    if (!attachments || attachments.length === 0) return [];
    return attachments.map((att, index) => (
      <AttachmentThumbnail
        key={att.id}
        attachment={att}
        thumbnailUrl={attachmentThumbnails?.get(att.id) ?? null}
        onClick={() => onAttachmentClick?.(att.id, index)}
      />
    ));
  }, [attachments, attachmentThumbnails, onAttachmentClick]);

  // Build link preview items for ContentCarousel (when mixing with attachments)
  const linkPreviewItems = useMemo(() => {
    if (!hasUrls || !hasAttachments) return [];
    return urls.map((parsedUrl) => {
      const normalizedUrl = parsedUrl.normalizedUrl;
      const isLoading = loadingUrls.has(normalizedUrl);
      const metadata = metadataMap.get(normalizedUrl);

      if (isLoading) {
        return <LinkPreviewSkeleton key={normalizedUrl} />;
      }
      if (metadata && metadata.success) {
        return <LinkPreviewCard key={normalizedUrl} metadata={metadata} />;
      }
      if (metadata && !metadata.success) {
        return (
          <LinkPreviewCard
            key={normalizedUrl}
            metadata={{
              ...metadata,
              title: metadata.domain,
              description: metadata.errorMessage || "Could not load preview",
            }}
          />
        );
      }
      return <LinkPreviewSkeleton key={normalizedUrl} />;
    });
  }, [hasUrls, hasAttachments, urls, loadingUrls, metadataMap]);

  // Parse mentions from content
  const contentWithMentions = useMemo(() => {
    const mentions = parseMentions(content);
    if (mentions.length === 0) {
      return [{ type: 'text' as const, content }];
    }

    // Build segments array alternating between text and mentions
    const segments: Array<{ type: 'text' | 'mention'; content: string; identityId?: string; displayName?: string }> = [];
    let lastIndex = 0;

    for (const mention of mentions) {
      // Add text before this mention
      if (mention.startIndex > lastIndex) {
        segments.push({
          type: 'text',
          content: content.slice(lastIndex, mention.startIndex),
        });
      }
      // Add the mention
      segments.push({
        type: 'mention',
        content: mention.raw,
        identityId: mention.identityId,
        displayName: mention.displayName,
      });
      lastIndex = mention.endIndex;
    }

    // Add remaining text after last mention
    if (lastIndex < content.length) {
      segments.push({
        type: 'text',
        content: content.slice(lastIndex),
      });
    }

    return segments;
  }, [content]);

  // Handle mention click
  const handleMentionClick = useCallback((identityId: string) => {
    onMentionClick?.(identityId);
  }, [onMentionClick]);

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
      className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}
      style={{ marginBottom: hasActiveReactions ? '16px' : undefined }}
      data-message-id={messageId}
      data-testid="message"
    >
      {/* Sender name header - only shown for group messages from others */}
      {showSender && senderName && !isOwn && (
        <div className="flex items-center gap-1.5 mb-1 ml-1">
          <span className="text-xs font-medium text-hush-text-accent">
            {senderName}
          </span>
          {senderRole === 'Admin' && (
            <RoleBadge role="Admin" size="sm" showLabel={false} />
          )}
        </div>
      )}

      {/* Message row with action buttons */}
      <div
        className={`flex ${isOwn ? "justify-end" : "justify-start"} w-full`}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => {
          setIsHovering(false);
          // Keep picker open if hovering over it
          if (!showPicker) setShowPicker(false);
        }}
      >
        <div className="relative group max-w-[60%] flex items-center min-w-0">
        {/* Action buttons - shows on hover, positioned on the LEFT side for own messages */}
        {isMessageConfirmed && isOwn && (
          <div className="flex items-center mr-1">
            {/* Reply button */}
            {onReplyClick && message && (
              <button
                onClick={handleReplyClick}
                data-testid="reply-button"
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
                  data-testid="add-reaction-button"
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
        <div className="relative min-w-0">
          <div
            className={`
              px-3 py-2 min-w-0
              ${
                isOwn
                  ? "bg-hush-purple text-hush-bg-dark rounded-bubble-sent"
                  : "bg-hush-bg-dark text-hush-text-primary rounded-bubble-received"
              }
            `}
          >
            {/* Reply preview - shows when this message is a reply */}
            {replyToMessageId && feedId && (
              <ReplyPreview
                messageId={replyToMessageId}
                feedId={feedId}
                onPreviewClick={onScrollToMessage}
                resolveDisplayName={resolveDisplayName}
              />
            )}
            <p className="text-sm break-words" data-testid="message-content">
              {contentWithMentions.map((segment, index) =>
                segment.type === 'mention' && segment.identityId && segment.displayName ? (
                  <MentionText
                    key={`mention-${index}`}
                    displayName={segment.displayName}
                    identityId={segment.identityId}
                    onClick={handleMentionClick}
                    isOwn={isOwn}
                  />
                ) : (
                  <span key={`text-${index}`}>{segment.content}</span>
                )
              )}
            </p>
            {/* FEAT-058: Show timestamp and status icon */}
            <div
              className={`
                flex items-center justify-end space-x-1 mt-1
                ${isOwn ? "text-hush-bg-dark/70" : "text-hush-text-accent"}
              `}
            >
              {/* Only show timestamp when confirmed or confirming */}
              {(effectiveStatus === 'confirmed' || effectiveStatus === 'confirming') && (
                <span className="text-[10px]">{timestamp}</span>
              )}
              {/* FEAT-058: Show status icon for own messages */}
              {isOwn && (
                <MessageStatusIcon
                  status={effectiveStatus}
                  isOwn={isOwn}
                  onRetryClick={effectiveStatus === 'failed' ? onRetryClick : undefined}
                />
              )}
            </div>
          </div>

          {/* FEAT-067: Attachments and/or link previews below message content */}
          {hasAttachments && (
            <div className="mt-2 pb-1" data-testid="message-attachments">
              {attachmentItems.length === 1 && !hasUrls ? (
                // Single attachment, no link previews: render directly
                attachmentItems[0]
              ) : (
                // Multiple items or mixed with link previews: use ContentCarousel
                <ContentCarousel ariaLabel="Message content">
                  {[...attachmentItems, ...linkPreviewItems]}
                </ContentCarousel>
              )}
            </div>
          )}

          {/* Link previews only (no attachments) - backward compatible */}
          {!hasAttachments && hasUrls && (
            <div className="mt-2 pb-1">
              <LinkPreviewCarousel
                urls={urls}
                metadataMap={metadataMap}
                loadingUrls={loadingUrls}
              />
            </div>
          )}

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
        {isMessageConfirmed && !isOwn && (
          <div className="flex items-center ml-1">
            {/* Reply button */}
            {onReplyClick && message && (
              <button
                onClick={handleReplyClick}
                data-testid="reply-button"
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
                  data-testid="add-reaction-button"
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
    </div>
  );
});
