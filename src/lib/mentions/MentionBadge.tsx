"use client";

import { memo } from "react";

interface MentionBadgeProps {
  /** Whether the badge should be visible */
  isVisible: boolean;
}

/**
 * MentionBadge - Displays a pulsing "@" indicator for feeds with unread mentions
 *
 * Features:
 * - Purple pill with white "@" symbol
 * - Continuous pulse animation (opacity 0.7 -> 1.0, 1.5s cycle)
 * - Accessible with proper ARIA attributes
 * - Only renders when isVisible is true
 */
export const MentionBadge = memo(function MentionBadge({
  isVisible,
}: MentionBadgeProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <span
      className="inline-flex items-center justify-center px-1.5 py-0.5 bg-hush-purple text-white text-xs font-bold rounded-full animate-mention-pulse motion-reduce:animate-none"
      role="status"
      aria-label="Unread mentions"
    >
      @
    </span>
  );
});
