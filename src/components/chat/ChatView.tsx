"use client";

import { useRef, useMemo, useCallback, useState, useEffect } from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { MessageSquare, Lock, ArrowLeft } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { ReplyContextBar } from "./ReplyContextBar";
import { useAppStore } from "@/stores";
import { useFeedsStore, sendMessage } from "@/modules/feeds";
import { useFeedReactions } from "@/hooks/useFeedReactions";
import type { Feed, FeedMessage } from "@/types";

// Empty array constant to avoid creating new references
const EMPTY_MESSAGES: FeedMessage[] = [];

interface ChatViewProps {
  feed: Feed;
  onSendMessage?: (message: string) => void;
  onBack?: () => void;
  onCloseFeed?: () => void;
  showBackButton?: boolean;
}

export function ChatView({ feed, onSendMessage, onBack, onCloseFeed, showBackButton = false }: ChatViewProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const { credentials } = useAppStore();
  const messagesMap = useFeedsStore((state) => state.messages);
  const messages = useMemo(
    () => messagesMap[feed.id] ?? EMPTY_MESSAGES,
    [messagesMap, feed.id]
  );

  // Use the feed reactions hook for optimistic updates
  const {
    getReactionCounts,
    getMyReaction,
    isPending,
    handleReactionSelect,
  } = useFeedReactions({
    feedId: feed.id,
    feedAesKey: feed.aesKey,
  });

  // Create stable callback for reactions using ref pattern to avoid re-renders
  const handleReactionSelectRef = useRef(handleReactionSelect);
  handleReactionSelectRef.current = handleReactionSelect;

  const stableHandleReactionSelect = useCallback(
    (messageId: string, emojiIndex: number) => {
      handleReactionSelectRef.current(messageId, emojiIndex);
    },
    []
  );

  // Reply to Message: State for tracking which message is being replied to
  const [replyingTo, setReplyingTo] = useState<FeedMessage | null>(null);

  // Reply to Message: Handler for reply button click
  const handleReplyClick = useCallback((message: FeedMessage) => {
    setReplyingTo(message);
  }, []);

  // Reply to Message: Handler for cancel reply
  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  // Reply to Message: ESC key handler to cancel reply mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && replyingTo) {
        e.preventDefault();
        setReplyingTo(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [replyingTo]);

  // Reply to Message: Scroll to a specific message when clicking reply preview
  const handleScrollToMessage = useCallback((messageId: string) => {
    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex !== -1 && virtuosoRef.current) {
      virtuosoRef.current.scrollToIndex({
        index: messageIndex,
        behavior: "smooth",
        align: "center",
      });
    }
  }, [messages]);

  // Reply to Message: Resolve display name from public key
  // For chat feeds: if it's the other participant, use feed.name; if it's me, use "You"
  const resolveDisplayName = useCallback((publicKey: string): string => {
    if (publicKey === credentials?.signingPublicKey) {
      return "You";
    }
    // For chat feeds, the other participant's name is the feed name
    if (feed.type === "chat" && publicKey === feed.otherParticipantPublicSigningAddress) {
      return feed.name;
    }
    // Fallback: truncated public key
    return publicKey.substring(0, 10) + "...";
  }, [credentials?.signingPublicKey, feed.type, feed.name, feed.otherParticipantPublicSigningAddress]);

  // Format timestamp for display
  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Check if message is from current user
  const isOwnMessage = (message: FeedMessage): boolean => {
    return message.senderPublicKey === credentials?.signingPublicKey;
  };

  // Get feed type label
  const getFeedTypeLabel = (type: Feed["type"]): string => {
    switch (type) {
      case "personal":
        return "Personal Feed";
      case "chat":
        return "Direct Message";
      case "group":
        return "Group Chat";
      case "broadcast":
        return "Broadcast";
      default:
        return "Feed";
    }
  };

  const handleSend = useCallback(async (message: string) => {
    // Send to blockchain (include reply reference if replying)
    const result = await sendMessage(feed.id, message, replyingTo?.id);

    if (!result.success) {
      console.error("[ChatView] Failed to send message:", result.error);
      // TODO: Show error toast to user
    } else {
      // Clear reply state after successful send
      setReplyingTo(null);
    }

    // Also call optional callback
    if (onSendMessage) {
      onSendMessage(message);
    }
  }, [feed.id, onSendMessage, replyingTo?.id]);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Chat Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-hush-bg-hover">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Back Button - shown on mobile */}
            {showBackButton && (
              <button
                onClick={onBack}
                className="p-2 -ml-2 rounded-lg hover:bg-hush-bg-hover transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-hush-text-primary" />
              </button>
            )}
            <div>
              <h2 className="text-lg font-semibold text-hush-text-primary">
                {feed.name}
              </h2>
              <div className="flex items-center space-x-2 text-xs text-hush-text-accent">
                <Lock className="w-3 h-3" />
                <span>{getFeedTypeLabel(feed.type)}</span>
                {feed.type !== "personal" && feed.participants.length > 0 && (
                  <span>• {feed.participants.length} participants</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 min-h-0 flex flex-col">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
            <div className="w-16 h-16 rounded-full bg-hush-bg-dark flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-hush-purple" />
            </div>
            <h3 className="text-lg font-semibold text-hush-text-primary mb-2">
              No messages yet
            </h3>
            <p className="text-sm text-hush-text-accent max-w-[280px]">
              {feed.type === "personal"
                ? "This is your personal feed. Post your first message to start journaling on the blockchain."
                : "Send a message to start the conversation."}
            </p>
          </div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            data={messages}
            followOutput="smooth"
            initialTopMostItemIndex={messages.length - 1}
            className="flex-1"
            itemContent={(index, message) => (
              <div className="px-4 py-1">
                <MessageBubble
                  content={message.content}
                  timestamp={formatTime(message.timestamp)}
                  isOwn={isOwnMessage(message)}
                  isConfirmed={message.isConfirmed}
                  messageId={message.id}
                  reactionCounts={getReactionCounts(message.id)}
                  myReaction={getMyReaction(message.id)}
                  isPendingReaction={isPending(message.id)}
                  onReactionSelect={stableHandleReactionSelect}
                  replyToMessageId={message.replyToMessageId}
                  onReplyClick={handleReplyClick}
                  onScrollToMessage={handleScrollToMessage}
                  message={message}
                  resolveDisplayName={resolveDisplayName}
                />
              </div>
            )}
          />
        )}
      </div>

      {/* Reply Context Bar - shows when replying to a message */}
      {replyingTo && (
        <ReplyContextBar
          replyingTo={replyingTo}
          senderDisplayName={resolveDisplayName(replyingTo.senderPublicKey)}
          onCancel={handleCancelReply}
        />
      )}

      {/* Message Input */}
      <MessageInput onSend={handleSend} onEscapeEmpty={onCloseFeed} />
    </div>
  );
}
