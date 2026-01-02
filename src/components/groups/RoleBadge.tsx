"use client";

import { memo } from "react";
import { ShieldOff, Crown } from "lucide-react";
import type { GroupMemberRole } from "@/types";

interface RoleBadgeProps {
  /** The role to display */
  role: GroupMemberRole;
  /** Size variant */
  size?: "sm" | "md";
  /** Whether to show the label text alongside the icon */
  showLabel?: boolean;
}

/**
 * Displays a visual badge indicating a member's role in a group.
 *
 * - Admin: Purple background with Crown icon
 * - Member: No badge displayed (undefined or regular)
 * - Blocked: Red background with ShieldOff icon
 */
export const RoleBadge = memo(function RoleBadge({
  role,
  size = "sm",
  showLabel = false,
}: RoleBadgeProps) {
  // Don't render anything for regular members
  if (role === "Member") {
    return null;
  }

  const isSmall = size === "sm";
  const iconSize = isSmall ? "w-3 h-3" : "w-4 h-4";
  const paddingClass = isSmall ? "px-1.5 py-0.5" : "px-2 py-1";
  const textSize = isSmall ? "text-[10px]" : "text-xs";

  if (role === "Admin") {
    return (
      <span
        className={`inline-flex items-center gap-1 ${paddingClass} rounded-full bg-hush-purple/20 text-hush-purple ${textSize} font-medium`}
        title="Admin"
      >
        <Crown className={iconSize} aria-hidden="true" />
        {showLabel && <span>Admin</span>}
      </span>
    );
  }

  if (role === "Blocked") {
    return (
      <span
        className={`inline-flex items-center gap-1 ${paddingClass} rounded-full bg-red-500/20 text-red-400 ${textSize} font-medium`}
        title="Blocked"
      >
        <ShieldOff className={iconSize} aria-hidden="true" />
        {showLabel && <span>Blocked</span>}
      </span>
    );
  }

  return null;
});
