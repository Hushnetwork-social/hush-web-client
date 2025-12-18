"use client";

import { useRef, useEffect, useMemo, useCallback } from "react";
import { MessageSquare, Lock, ArrowLeft } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { useAppStore } from "@/stores";
import { useFeedsStore, sendMessage } from "@/modules/feeds";
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { credentials } = useAppStore();
  const messagesMap = useFeedsStore((state) => state.messages);
  const messages = useMemo(
    () => messagesMap[feed.id] ?? EMPTY_MESSAGES,
    [messagesMap, feed.id]
  );

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    // Send to blockchain
    const result = await sendMessage(feed.id, message);

    if (!result.success) {
      console.error("[ChatView] Failed to send message:", result.error);
      // TODO: Show error toast to user
    }

    // Also call optional callback
    if (onSendMessage) {
      onSendMessage(message);
    }
  }, [feed.id, onSendMessage]);

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
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
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
          <>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                content={message.content}
                timestamp={formatTime(message.timestamp)}
                isOwn={isOwnMessage(message)}
                isConfirmed={message.isConfirmed}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input */}
      <MessageInput onSend={handleSend} onEscapeEmpty={onCloseFeed} />
    </div>
  );
}
