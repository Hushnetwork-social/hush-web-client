"use client";

import { Users, Globe } from "lucide-react";
import { memo } from "react";
import { MentionBadge } from "@/lib/mentions";

interface ChatListItemProps {
  name: string;
  initials: string;
  lastMessage: string;
  timestamp?: string;
  unreadCount?: number;
  isSelected?: boolean;
  isPersonalFeed?: boolean;
  /** Feed type for visual distinction (group feeds show group icon) */
  feedType?: 'personal' | 'chat' | 'group' | 'broadcast';
  /** Whether the group is public (only for group feeds) */
  isPublic?: boolean;
  /** Whether this feed has unread mentions for the current user */
  hasUnreadMentions?: boolean;
  onClick?: () => void;
}

export const ChatListItem = memo(function ChatListItem({
  name,
  initials,
  lastMessage,
  timestamp,
  unreadCount = 0,
  isSelected = false,
  isPersonalFeed = false,
  feedType = 'chat',
  isPublic = false,
  hasUnreadMentions = false,
  onClick,
}: ChatListItemProps) {
  const isGroup = feedType === 'group';
  const isPublicGroup = isGroup && isPublic;

  return (
    <button
      onClick={onClick}
      data-testid="feed-item"
      className={`
        w-full max-w-full box-border flex items-center p-3 rounded-lg transition-colors cursor-pointer
        ${isSelected
          ? "bg-hush-purple/20 border-2 border-hush-purple"
          : "bg-hush-bg-element border border-hush-purple/70 hover:bg-hush-bg-hover hover:border-hush-purple/90"
        }
      `}
    >
      {/* Avatar / Group Icon - Globe for public groups, Users for private groups */}
      {isPublicGroup ? (
        <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
          <Globe className="w-5 h-5 text-green-400" aria-hidden="true" />
        </div>
      ) : isGroup ? (
        <div className="w-9 h-9 rounded-full bg-hush-purple/20 flex items-center justify-center flex-shrink-0">
          <Users className="w-5 h-5 text-hush-purple" aria-hidden="true" />
        </div>
      ) : (
        <div className="w-9 h-9 rounded-full bg-hush-purple flex items-center justify-center flex-shrink-0">
          <span className="text-[10px] font-bold text-hush-bg-dark">
            {initials}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0 ml-4">
        <div className="flex items-center justify-between">
          {/* For personal feed, split name and (YOU) so truncation preserves (YOU) */}
          {isPersonalFeed ? (
            <span className="text-sm font-semibold text-hush-text-primary flex min-w-0">
              <span className="truncate">{name.replace(' (YOU)', '')}</span>
              <span className="flex-shrink-0">&nbsp;(YOU)</span>
            </span>
          ) : (
            <span className="text-sm font-semibold text-hush-text-primary truncate">
              {name}
            </span>
          )}
          {timestamp && (
            <span className="text-[10px] text-hush-text-accent ml-2 flex-shrink-0">
              {timestamp}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-xs text-hush-text-accent truncate max-w-[180px]">
            {lastMessage}
          </span>
          {/* Badges container: unread count + mention indicator */}
          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
            {unreadCount > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-hush-purple flex items-center justify-center">
                <span className="text-[10px] font-bold text-hush-bg-dark">
                  {unreadCount}
                </span>
              </span>
            )}
            <MentionBadge isVisible={hasUnreadMentions} />
          </div>
        </div>
      </div>
    </button>
  );
});
