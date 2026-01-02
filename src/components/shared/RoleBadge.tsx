"use client";

import { memo } from "react";
import { Shield, User, Ban } from "lucide-react";
import { GroupMemberRole } from "@/types";

interface RoleBadgeProps {
  /** The member role to display */
  role: GroupMemberRole;
  /** Size variant */
  size?: "sm" | "md";
  /** Whether to show label text */
  showLabel?: boolean;
}

const roleConfig: Record<
  GroupMemberRole,
  {
    label: string;
    icon: typeof Shield;
    bgColor: string;
    textColor: string;
    iconColor: string;
  }
> = {
  Admin: {
    label: "Admin",
    icon: Shield,
    bgColor: "bg-amber-500/20",
    textColor: "text-amber-400",
    iconColor: "text-amber-400",
  },
  Member: {
    label: "Member",
    icon: User,
    bgColor: "bg-hush-purple/20",
    textColor: "text-hush-purple",
    iconColor: "text-hush-purple",
  },
  Blocked: {
    label: "Blocked",
    icon: Ban,
    bgColor: "bg-red-500/20",
    textColor: "text-red-400",
    iconColor: "text-red-400",
  },
};

/**
 * RoleBadge Component
 *
 * Displays a visual badge indicating a group member's role.
 * Shows an icon and optional text label.
 */
export const RoleBadge = memo(function RoleBadge({
  role,
  size = "md",
  showLabel = true,
}: RoleBadgeProps) {
  const config = roleConfig[role];
  const Icon = config.icon;

  const sizeClasses = {
    sm: {
      container: "px-1.5 py-0.5 gap-1",
      icon: "w-3 h-3",
      text: "text-xs",
    },
    md: {
      container: "px-2 py-1 gap-1.5",
      icon: "w-4 h-4",
      text: "text-sm",
    },
  };

  const sizes = sizeClasses[size];

  return (
    <span
      className={`
        inline-flex items-center
        ${sizes.container}
        ${config.bgColor}
        rounded-full
      `}
      role="status"
      aria-label={`Role: ${config.label}`}
    >
      <Icon className={`${sizes.icon} ${config.iconColor}`} aria-hidden="true" />
      {showLabel && (
        <span className={`${sizes.text} ${config.textColor} font-medium`}>
          {config.label}
        </span>
      )}
    </span>
  );
});
