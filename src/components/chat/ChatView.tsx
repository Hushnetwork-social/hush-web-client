"use client";

import { useRef, useMemo, useCallback, useState, useEffect } from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { MessageSquare, Lock, ArrowLeft, Users, Settings } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { MessageInput, type MessageInputHandle } from "./MessageInput";
import { ReplyContextBar } from "./ReplyContextBar";
import { MemberListPanel } from "@/components/groups/MemberListPanel";
import { GroupSettingsPanel } from "@/components/groups/GroupSettingsPanel";
import { useAppStore } from "@/stores";
import { useFeedsStore, sendMessage } from "@/modules/feeds";
import { useFeedReactions } from "@/hooks/useFeedReactions";
import type { Feed, FeedMessage, GroupFeedMember } from "@/types";

// Empty array constants to avoid creating new references
const EMPTY_MESSAGES: FeedMessage[] = [];
const EMPTY_MEMBERS: GroupFeedMember[] = [];

// Constants for display name truncation
const TRUNCATED_KEY_LENGTH = 10;
const TRUNCATION_SUFFIX = "...";

interface ChatViewProps {
  feed: Feed;
  onSendMessage?: (message: string) => void;
  onBack?: () => void;
  onCloseFeed?: () => void;
  showBackButton?: boolean;
}

export function ChatView({ feed, onSendMessage, onBack, onCloseFeed, showBackButton = false }: ChatViewProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const messageInputRef = useRef<MessageInputHandle>(null);
  const { credentials } = useAppStore();
  const messagesMap = useFeedsStore((state) => state.messages);
  const groupMembersMap = useFeedsStore((state) => state.groupMembers);
  const messages = useMemo(
    () => messagesMap[feed.id] ?? EMPTY_MESSAGES,
    [messagesMap, feed.id]
  );
  const groupMembers = useMemo(
    () => (feed.type === 'group' ? groupMembersMap[feed.id] ?? EMPTY_MEMBERS : EMPTY_MEMBERS),
    [groupMembersMap, feed.id, feed.type]
  );

  // Check if current user is admin of the group
  const isGroupFeed = feed.type === 'group';

  // State for member panel visibility
  const [showMemberPanel, setShowMemberPanel] = useState(false);

  // State for settings panel visibility
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);

  // Get current user's role in the group
  const currentUserRole = useMemo(() => {
    if (!isGroupFeed || !credentials?.signingPublicKey) return 'Member' as const;
    const member = groupMembers.find(m => m.publicAddress === credentials.signingPublicKey);
    return member?.role ?? 'Member' as const;
  }, [isGroupFeed, credentials?.signingPublicKey, groupMembers]);

  // Check if current user is the last admin (for delete button visibility)
  const isLastAdmin = useMemo(() => {
    if (!isGroupFeed || currentUserRole !== 'Admin') return false;
    const adminCount = groupMembers.filter(m => m.role === 'Admin').length;
    return adminCount === 1;
  }, [isGroupFeed, currentUserRole, groupMembers]);

  // Create a lookup Map for O(1) member resolution (optimization for groups with many messages)
  const memberLookup = useMemo(() => {
    if (!isGroupFeed || groupMembers.length === 0) return new Map<string, GroupFeedMember>();
    return new Map(groupMembers.map(m => [m.publicAddress, m]));
  }, [isGroupFeed, groupMembers]);

  // Get sender role for group messages (O(1) lookup)
  const getSenderRole = useCallback((publicKey: string) => {
    return memberLookup.get(publicKey)?.role;
  }, [memberLookup]);

  // Get sender display name for group messages (O(1) lookup)
  const getSenderDisplayName = useCallback((publicKey: string): string | undefined => {
    if (!isGroupFeed) return undefined;
    // Don't show sender name for own messages
    if (publicKey === credentials?.signingPublicKey) return undefined;
    const member = memberLookup.get(publicKey);
    return member?.displayName ?? publicKey.substring(0, TRUNCATED_KEY_LENGTH) + TRUNCATION_SUFFIX;
  }, [isGroupFeed, memberLookup, credentials?.signingPublicKey]);

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
    // Focus the message input when starting a reply
    // Use setTimeout to ensure state update completes first
    setTimeout(() => {
      messageInputRef.current?.focus();
    }, 0);
  }, []);

  // Reply to Message: Handler for cancel reply
  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  // Member Panel: Handler for opening/closing
  const handleOpenMemberPanel = useCallback(() => {
    setShowMemberPanel(true);
  }, []);

  const handleCloseMemberPanel = useCallback(() => {
    setShowMemberPanel(false);
  }, []);

  // Settings Panel: Handler for opening/closing
  const handleOpenSettingsPanel = useCallback(() => {
    setShowSettingsPanel(true);
  }, []);

  const handleCloseSettingsPanel = useCallback(() => {
    setShowSettingsPanel(false);
  }, []);

  // Settings Panel: Handler for leave group action
  const handleLeaveGroup = useCallback(() => {
    // Navigate away from the group (back to feed list)
    if (onBack) {
      onBack();
    }
  }, [onBack]);

  // Settings Panel: Handler for delete group action
  const handleDeleteGroup = useCallback(() => {
    // Navigate away from the deleted group (back to feed list)
    if (onBack) {
      onBack();
    }
  }, [onBack]);

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
  // For group feeds: look up member in memberLookup Map (O(1))
  const resolveDisplayName = useCallback((publicKey: string): string => {
    if (publicKey === credentials?.signingPublicKey) {
      return "You";
    }
    // For chat feeds, the other participant's name is the feed name
    if (feed.type === "chat" && publicKey === feed.otherParticipantPublicSigningAddress) {
      return feed.name;
    }
    // For group feeds, look up member display name (O(1) via Map)
    if (feed.type === "group") {
      const member = memberLookup.get(publicKey);
      if (member) {
        return member.displayName;
      }
    }
    // Fallback: truncated public key
    return publicKey.substring(0, TRUNCATED_KEY_LENGTH) + TRUNCATION_SUFFIX;
  }, [credentials?.signingPublicKey, feed.type, feed.name, feed.otherParticipantPublicSigningAddress, memberLookup]);

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
            {/* Group icon for group feeds */}
            {isGroupFeed && (
              <div className="w-10 h-10 rounded-full bg-hush-purple/20 flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-hush-purple" aria-hidden="true" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-hush-text-primary">
                {feed.name}
              </h2>
              <div className="flex items-center space-x-2 text-xs text-hush-text-accent">
                <Lock className="w-3 h-3" />
                <span>{getFeedTypeLabel(feed.type)}</span>
                {isGroupFeed && groupMembers.length > 0 ? (
                  <span>• {groupMembers.length} members</span>
                ) : feed.type !== "personal" && feed.participants.length > 0 ? (
                  <span>• {feed.participants.length} participants</span>
                ) : null}
              </div>
            </div>
          </div>
          {/* Action buttons for group feeds */}
          {isGroupFeed && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenMemberPanel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-hush-text-accent hover:bg-hush-bg-hover hover:text-hush-text-primary transition-colors"
                aria-label="View group members"
              >
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Members</span>
              </button>
              <button
                onClick={handleOpenSettingsPanel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-hush-text-accent hover:bg-hush-bg-hover hover:text-hush-text-primary transition-colors"
                aria-label="Group settings"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </button>
            </div>
          )}
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
                  showSender={isGroupFeed}
                  senderName={getSenderDisplayName(message.senderPublicKey)}
                  senderRole={getSenderRole(message.senderPublicKey)}
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
      <MessageInput ref={messageInputRef} onSend={handleSend} onEscapeEmpty={onCloseFeed} />

      {/* Member List Panel (Group feeds only) */}
      {isGroupFeed && credentials?.signingPublicKey && (
        <MemberListPanel
          isOpen={showMemberPanel}
          onClose={handleCloseMemberPanel}
          feedId={feed.id}
          currentUserAddress={credentials.signingPublicKey}
          currentUserRole={currentUserRole}
          members={groupMembers}
        />
      )}

      {/* Group Settings Panel (Group feeds only) */}
      {isGroupFeed && credentials?.signingPublicKey && (
        <GroupSettingsPanel
          isOpen={showSettingsPanel}
          onClose={handleCloseSettingsPanel}
          feedId={feed.id}
          groupName={feed.name}
          groupDescription={feed.description ?? ""}
          isPublic={feed.isPublic ?? false}
          currentUserRole={currentUserRole}
          currentUserAddress={credentials.signingPublicKey}
          isLastAdmin={isLastAdmin}
          onLeave={handleLeaveGroup}
          onDelete={handleDeleteGroup}
        />
      )}
    </div>
  );
}
