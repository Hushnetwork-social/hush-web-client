"use client";

import { memo, useCallback } from "react";
import { ChevronDown } from "lucide-react";

interface JumpToBottomButtonProps {
  /** Number of new messages at the bottom */
  count: number;
  /** Whether the button should be visible */
  isVisible: boolean;
  /** Callback when button is clicked to jump to bottom */
  onJump: () => void;
}

/**
 * JumpToBottomButton - Floating action button to scroll back to most recent messages
 *
 * FEAT-056: Load More Pagination
 *
 * Features:
 * - Semi-transparent button with blur background
 * - Shows down arrow icon with new message count
 * - Hidden when user is at the bottom of the chat
 * - Triggers haptic feedback on supported devices
 * - Accessible with proper ARIA attributes and keyboard navigation
 */
export const JumpToBottomButton = memo(function JumpToBottomButton({
  count,
  isVisible,
  onJump,
}: JumpToBottomButtonProps) {
  const handleClick = useCallback(() => {
    // Trigger haptic feedback on supported devices
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(10);
    }
    onJump();
  }, [onJump]);

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  // Format count: show "99+" for large numbers, empty if 0
  const displayCount = count > 99 ? "99+" : count > 0 ? count.toString() : "";
  const hasCount = count > 0;

  // Build ARIA label
  const ariaLabel = hasCount
    ? `Jump to bottom, ${count} new message${count === 1 ? "" : "s"}`
    : "Jump to bottom";

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center gap-1 px-3 py-2 bg-hush-bg-secondary/90 backdrop-blur-sm hover:bg-hush-bg-hover border border-hush-bg-hover rounded-full shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-hush-purple focus:ring-offset-2 focus:ring-offset-hush-bg-dark"
      aria-label={ariaLabel}
      data-testid="jump-to-bottom-button"
    >
      {/* Down Arrow Icon */}
      <ChevronDown
        className="w-4 h-4 text-hush-text-primary"
        aria-hidden="true"
      />

      {/* Message Count - only show if > 0 */}
      {hasCount && (
        <span
          className="text-sm font-medium text-hush-text-primary min-w-[1rem] text-center"
          aria-hidden="true"
        >
          {displayCount}
        </span>
      )}
    </button>
  );
});
