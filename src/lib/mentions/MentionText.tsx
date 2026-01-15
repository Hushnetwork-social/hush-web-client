"use client";

import { memo } from "react";

interface MentionTextProps {
  /** Display name to show */
  displayName: string;
  /** Identity ID of the mentioned person */
  identityId: string;
  /** Optional callback when mention is clicked */
  onClick?: (identityId: string) => void;
}

/**
 * MentionText - Renders a styled mention within message content
 *
 * Features:
 * - Purple text color (hush-purple brand color)
 * - Medium font weight
 * - Underline on hover
 * - Pointer cursor (clickable)
 * - Calls onClick with identityId when clicked
 */
export const MentionText = memo(function MentionText({
  displayName,
  identityId,
  onClick,
}: MentionTextProps) {
  const handleClick = () => {
    if (onClick) {
      onClick(identityId);
    }
  };

  return (
    <span
      className="text-hush-purple font-medium cursor-pointer hover:underline"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`Mentioned user: ${displayName}`}
    >
      @{displayName}
    </span>
  );
});
