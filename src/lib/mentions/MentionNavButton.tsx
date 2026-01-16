"use client";

import { memo, useCallback } from "react";

interface MentionNavButtonProps {
  /** Number of unread mentions */
  count: number;
  /** Callback when button is clicked to navigate to next mention */
  onNavigate: () => void;
}

/**
 * MentionNavButton - Floating action button for navigating between mentions
 *
 * Features:
 * - 48px purple circle with white "@" icon
 * - Count badge in top-right corner (shows "9+" for counts > 9)
 * - Hidden when count is 0
 * - Triggers haptic feedback on supported devices
 * - Accessible with proper ARIA attributes
 */
export const MentionNavButton = memo(function MentionNavButton({
  count,
  onNavigate,
}: MentionNavButtonProps) {
  const handleClick = useCallback(() => {
    // Trigger haptic feedback on supported devices
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(10);
    }
    onNavigate();
  }, [onNavigate]);

  // Don't render if no unread mentions
  if (count <= 0) {
    return null;
  }

  // Format count: show "9+" for large numbers
  const displayCount = count > 9 ? "9+" : count.toString();

  return (
    <button
      type="button"
      onClick={handleClick}
      className="relative flex items-center justify-center w-8 h-8 bg-hush-purple hover:bg-hush-purple-hover rounded-full shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-hush-purple focus:ring-offset-2 focus:ring-offset-hush-bg-dark"
      aria-label={`Navigate to mentions, ${count} unread`}
    >
      {/* @ Icon */}
      <span className="text-white text-sm font-bold" aria-hidden="true">
        @
      </span>

      {/* Count Badge - positioned at top-right corner using transform */}
      <span
        className="absolute top-0 right-0 translate-x-1/3 -translate-y-1/3 z-10 flex items-center justify-center min-w-[16px] h-[16px] px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full border border-hush-bg-dark"
        aria-hidden="true"
      >
        {displayCount}
      </span>
    </button>
  );
});
