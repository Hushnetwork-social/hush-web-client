"use client";

import { debugLog } from "@/lib/debug-logger";

interface ChatListItemProps {
  name: string;
  initials: string;
  lastMessage: string;
  timestamp?: string;
  unreadCount?: number;
  isSelected?: boolean;
  isPersonalFeed?: boolean;
  onClick?: () => void;
}

export function ChatListItem({
  name,
  initials,
  lastMessage,
  timestamp,
  unreadCount = 0,
  isSelected = false,
  isPersonalFeed = false,
  onClick,
}: ChatListItemProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    console.log(`[ChatListItem] CLICK "${name}": clickX=${e.clientX}, clickY=${e.clientY}, btnTop=${rect.top.toFixed(0)}, btnBottom=${rect.bottom.toFixed(0)}, btnLeft=${rect.left.toFixed(0)}, btnRight=${rect.right.toFixed(0)}, btnWidth=${rect.width.toFixed(0)}, btnHeight=${rect.height.toFixed(0)}`);
    onClick?.();
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    console.log(`[ChatListItem] HOVER "${name}": mouseX=${e.clientX}, mouseY=${e.clientY}, btnTop=${rect.top.toFixed(0)}, btnBottom=${rect.bottom.toFixed(0)}, btnLeft=${rect.left.toFixed(0)}, btnRight=${rect.right.toFixed(0)}, btnWidth=${rect.width.toFixed(0)}, btnHeight=${rect.height.toFixed(0)}`);
  };

  return (
    <button
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      className={`
        w-full max-w-full flex items-center p-3 rounded-lg transition-colors cursor-pointer
        ${isSelected
          ? "bg-hush-purple/20 border-2 border-hush-purple"
          : "bg-hush-bg-element border border-hush-purple/70 hover:bg-hush-bg-hover hover:border-hush-purple/90"
        }
      `}
    >
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-hush-purple flex items-center justify-center flex-shrink-0">
        <span className="text-[10px] font-bold text-hush-bg-dark">
          {initials}
        </span>
      </div>

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
          {unreadCount > 0 && (
            <span className="ml-2 min-w-[20px] h-5 px-1.5 rounded-full bg-hush-purple flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-bold text-hush-bg-dark">
                {unreadCount}
              </span>
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
