"use client";

import { memo } from "react";

/**
 * LinkPreviewSkeleton Component
 *
 * Displays a skeleton loading state for link previews.
 * Matches the dimensions and layout of LinkPreviewCard.
 */
export const LinkPreviewSkeleton = memo(function LinkPreviewSkeleton() {
  return (
    <div
      className="
        flex items-start gap-3
        p-3
        bg-hush-bg-hover/40
        border border-hush-border/50
        rounded-lg
        max-w-full
        animate-pulse
      "
      aria-busy="true"
      aria-label="Loading link preview"
    >
      {/* Thumbnail skeleton */}
      <div
        className="
          flex-shrink-0
          w-[100px] h-[100px]
          rounded-md
          bg-hush-bg-hover
        "
      />

      {/* Content skeleton */}
      <div className="flex-1 min-w-0 flex flex-col justify-center space-y-2">
        {/* Title skeleton */}
        <div className="h-4 bg-hush-bg-hover rounded w-3/4" />

        {/* Description skeleton - two lines */}
        <div className="space-y-1">
          <div className="h-3 bg-hush-bg-hover rounded w-full" />
          <div className="h-3 bg-hush-bg-hover rounded w-2/3" />
        </div>

        {/* Domain skeleton */}
        <div className="h-3 bg-hush-bg-hover rounded w-1/3 mt-1" />
      </div>
    </div>
  );
});
