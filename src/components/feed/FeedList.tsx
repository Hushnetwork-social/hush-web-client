"use client";

import { useMemo } from "react";
import { useAppStore } from "@/stores";
import { useFeedsStore } from "@/modules/feeds";
import { notificationService } from "@/lib/grpc/services";
import { getMentionDisplayText, hasUnreadMentions } from "@/lib/mentions";
import { ChatListItem } from "./ChatListItem";
import { MessageSquare, Loader2 } from "lucide-react";
import type { GroupFeedMember } from "@/types";

interface FeedListProps {
  onFeedSelect?: (feedId: string) => void;
}

export function FeedList({ onFeedSelect }: FeedListProps) {
  // Feeds and messages from feeds module store
  const feeds = useFeedsStore((state) => state.feeds);
  const messages = useFeedsStore((state) => state.messages);
  const isSyncing = useFeedsStore((state) => state.isSyncing);
  const markFeedAsRead = useFeedsStore((state) => state.markFeedAsRead);
  const groupMembersMap = useFeedsStore((state) => state.groupMembers);
  // Subscribe to mentionVersion to trigger re-renders when mentions change
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const mentionVersion = useFeedsStore((state) => state.mentionVersion);

  // UI state from app store
  const { selectedFeedId, selectFeed, isLoading, credentials } = useAppStore();

  const handleFeedClick = async (feedId: string) => {
    selectFeed(feedId);
    onFeedSelect?.(feedId);

    // Mark feed as read when clicking on it
    // Note: needsSync is cleared by FeedsSyncable after fetching messages
    const feed = feeds.find((f) => f.id === feedId);
    if (feed && feed.unreadCount > 0 && credentials?.signingPublicKey) {
      // Optimistic update
      markFeedAsRead(feedId);
      // Notify server
      try {
        await notificationService.markFeedAsRead(credentials.signingPublicKey, feedId);
      } catch (error) {
        console.error('[FeedList] Failed to mark feed as read:', error);
      }
    }
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

    return new Date(timestamp).toLocaleDateString();
  };

  // Get initials from feed name
  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Get last message for a feed
  // For group feeds, find the last message the user can actually read (has decryption key for)
  const getLastMessage = (feedId: string): { content: string; timestamp: number; senderPublicKey?: string } | null => {
    const feedMessages = messages[feedId];
    if (!feedMessages || feedMessages.length === 0) return null;

    // For preview, find the last message that was successfully decrypted
    // Messages with decryptionFailed: true should not be shown as preview
    // (they contain raw encrypted content that looks like gibberish)
    const decryptedMessages = feedMessages.filter(msg => !msg.decryptionFailed);

    if (decryptedMessages.length === 0) {
      // No decrypted messages - user probably just joined and can't read old messages
      return null;
    }

    const lastMsg = decryptedMessages[decryptedMessages.length - 1];
    return {
      content: lastMsg.content,
      timestamp: lastMsg.timestamp,
      senderPublicKey: lastMsg.senderPublicKey,
    };
  };

  // Create O(1) lookup maps for all group members across all feeds
  const allMemberLookups = useMemo(() => {
    const lookups: Record<string, Map<string, GroupFeedMember>> = {};
    for (const [feedId, members] of Object.entries(groupMembersMap)) {
      lookups[feedId] = new Map(members.map(m => [m.publicAddress, m]));
    }
    return lookups;
  }, [groupMembersMap]);

  // Get sender display name for a group feed message
  const getSenderDisplayName = (feedId: string, senderPublicKey: string | undefined): string | undefined => {
    if (!senderPublicKey) return undefined;
    // Skip for own messages (don't show "You: message" in preview)
    if (senderPublicKey === credentials?.signingPublicKey) return undefined;
    const memberLookup = allMemberLookups[feedId];
    if (!memberLookup) return undefined;
    const member = memberLookup.get(senderPublicKey);
    return member?.displayName ?? senderPublicKey.substring(0, 10) + '...';
  };

  // Format message preview for groups (shows sender name)
  // Also converts mention syntax @[name](id) to readable @name
  const formatMessagePreview = (content: string, feedType: string, senderName?: string): string => {
    // Convert mentions to readable format (@[name](id) -> @name)
    const readableContent = getMentionDisplayText(content);

    if (feedType === 'group' && senderName) {
      // Truncate sender name if too long
      const truncatedName = senderName.length > 10 ? senderName.slice(0, 10) + '…' : senderName;
      return `${truncatedName}: ${readableContent}`;
    }
    return readableContent;
  };

  // Show loading only on initial load (no feeds yet and syncing)
  if (isLoading || (feeds.length === 0 && isSyncing)) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-hush-purple" />
      </div>
    );
  }

  if (feeds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-hush-bg-dark flex items-center justify-center mb-4">
          <MessageSquare className="w-8 h-8 text-hush-purple" />
        </div>
        <h3 className="text-lg font-semibold text-hush-text-primary mb-2">No Feeds Yet</h3>
        <p className="text-sm text-hush-text-accent max-w-[280px]">
          Your feeds will appear here once they are created on the blockchain.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 w-full max-w-full" data-testid="feed-list">
      {feeds.map((feed) => {
        const lastMessage = getLastMessage(feed.id);
        const isPersonalFeed = feed.type === 'personal';
        // For group feeds, resolve sender name from group members
        const senderName = feed.type === 'group'
          ? getSenderDisplayName(feed.id, lastMessage?.senderPublicKey)
          : undefined;
        const messagePreview = lastMessage
          ? formatMessagePreview(lastMessage.content, feed.type, senderName)
          : "No messages yet";
        return (
          <ChatListItem
            key={feed.id}
            name={feed.name}
            initials={isPersonalFeed ? "YOU" : getInitials(feed.name)}
            lastMessage={messagePreview}
            timestamp={lastMessage ? formatTimestamp(lastMessage.timestamp) : undefined}
            unreadCount={feed.unreadCount}
            isSelected={feed.id === selectedFeedId}
            isPersonalFeed={isPersonalFeed}
            feedType={feed.type}
            isPublic={feed.isPublic}
            hasUnreadMentions={hasUnreadMentions(feed.id)}
            onClick={() => handleFeedClick(feed.id)}
          />
        );
      })}
    </div>
  );
}
