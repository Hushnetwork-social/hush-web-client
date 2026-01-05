"use client";

import { memo } from "react";
import { UserPlus, UserMinus, Key } from "lucide-react";

export type SystemMessageType = "member_joined" | "member_left" | "key_rotated";

interface SystemMessageProps {
  type: SystemMessageType;
  memberName?: string;
  timestamp?: string;
}

/**
 * SystemMessage - Displays centered system notifications in the chat feed.
 * Used for events like member joins, leaves, and key rotations.
 * Styled to be subtle and non-obstructive.
 */
export const SystemMessage = memo(function SystemMessage({
  type,
  memberName,
  timestamp,
}: SystemMessageProps) {
  const getIcon = () => {
    switch (type) {
      case "member_joined":
        return <UserPlus className="w-3 h-3" />;
      case "member_left":
        return <UserMinus className="w-3 h-3" />;
      case "key_rotated":
        return <Key className="w-3 h-3" />;
    }
  };

  const getMessage = () => {
    switch (type) {
      case "member_joined":
        return memberName ? `${memberName} joined the group` : "A new member joined";
      case "member_left":
        return memberName ? `${memberName} left the group` : "A member left the group";
      case "key_rotated":
        return "Group encryption keys updated";
    }
  };

  return (
    <div className="flex justify-center py-2">
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-hush-bg-dark/50 border border-hush-border/30">
        <span className="text-hush-purple/70">{getIcon()}</span>
        <span className="text-xs text-hush-text-accent">{getMessage()}</span>
        {timestamp && (
          <span className="text-[10px] text-hush-text-accent/50 ml-1">
            {timestamp}
          </span>
        )}
      </div>
    </div>
  );
});
