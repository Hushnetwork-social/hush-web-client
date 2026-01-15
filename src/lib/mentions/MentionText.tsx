"use client";

import { memo } from "react";

interface MentionTextProps {
  /** Display name to show */
  displayName: string;
  /** Identity ID of the mentioned person */
  identityId: string;
  /** Optional callback when mention is clicked */
  onClick?: (identityId: string) => void;
  /** Whether this mention is in an own message (for color contrast) */
  isOwn?: boolean;
}

/**
 * MentionText - Renders a styled mention within message content
 *
 * Features:
 * - Contrasting text color based on bubble type:
 *   - Own messages (purple bg): dark text for visibility
 *   - Received messages (dark bg): purple text
 * - Medium font weight
 * - Underline on hover
 * - Pointer cursor (clickable)
 * - Calls onClick with identityId when clicked
 */
export const MentionText = memo(function MentionText({
  displayName,
  identityId,
  onClick,
  isOwn = false,
}: MentionTextProps) {
  const handleClick = () => {
    if (onClick) {
      onClick(identityId);
    }
  };

  // Use contrasting colors: dark text on purple bubbles, purple text on dark bubbles
  const colorClass = isOwn
    ? "text-hush-bg-dark/90 hover:text-hush-bg-dark"
    : "text-hush-purple hover:text-hush-purple-hover";

  return (
    <span
      className={`${colorClass} font-semibold cursor-pointer hover:underline`}
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
