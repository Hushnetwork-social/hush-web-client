"use client";

import { memo } from "react";
import { ShieldOff } from "lucide-react";

/**
 * UnbanGapPlaceholder Component
 *
 * Displays a placeholder message indicating that messages are unavailable
 * due to the user being banned during a specific period.
 *
 * This component is shown in group feed timelines where there are gaps
 * in message visibility due to the user's ban period.
 */
export const UnbanGapPlaceholder = memo(function UnbanGapPlaceholder() {
  return (
    <div
      className="flex items-center justify-center gap-3 py-4 px-6 my-4 mx-auto max-w-md
        bg-hush-bg-hover border border-dashed border-hush-text-accent/30 rounded-lg"
      role="status"
      aria-label="Messages unavailable due to ban period"
    >
      <ShieldOff
        className="w-5 h-5 text-hush-text-accent flex-shrink-0"
        aria-hidden="true"
      />
      <p className="text-sm text-hush-text-accent text-center">
        You were banned during this period. Messages unavailable.
      </p>
    </div>
  );
});
