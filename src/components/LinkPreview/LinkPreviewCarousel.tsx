"use client";

import { memo, useState, useCallback, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LinkPreviewCard } from "./LinkPreviewCard";
import { LinkPreviewSkeleton } from "./LinkPreviewSkeleton";
import type { UrlMetadata } from "@/lib/urlDetector/urlMetadataCache";
import type { ParsedUrl } from "@/lib/urlDetector/urlDetector";

interface LinkPreviewCarouselProps {
  /** List of parsed URLs to display */
  urls: ParsedUrl[];
  /** Map of URL to metadata (null if fetch failed) */
  metadataMap: Map<string, UrlMetadata | null>;
  /** Set of URLs currently being loaded */
  loadingUrls: Set<string>;
}

/**
 * LinkPreviewCarousel Component
 *
 * Displays multiple link previews with navigation controls.
 * For a single URL, shows the preview without carousel controls.
 * Supports keyboard and touch navigation.
 */
export const LinkPreviewCarousel = memo(function LinkPreviewCarousel({
  urls,
  metadataMap,
  loadingUrls,
}: LinkPreviewCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  const totalCount = urls.length;
  const hasMultiple = totalCount > 1;
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < totalCount - 1;

  const goToPrevious = useCallback(() => {
    if (canGoPrevious) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [canGoPrevious]);

  const goToNext = useCallback(() => {
    if (canGoNext) {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [canGoNext]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrevious();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNext();
      }
    },
    [goToPrevious, goToNext]
  );

  // Touch swipe support
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null) return;

      const touchEndX = e.changedTouches[0].clientX;
      const diff = touchStartX.current - touchEndX;
      const threshold = 50; // Minimum swipe distance

      if (Math.abs(diff) > threshold) {
        if (diff > 0) {
          // Swiped left -> go next
          goToNext();
        } else {
          // Swiped right -> go previous
          goToPrevious();
        }
      }

      touchStartX.current = null;
    },
    [goToNext, goToPrevious]
  );

  // Reset to first item if URLs change
  useEffect(() => {
    setCurrentIndex(0);
  }, [urls.length]);

  // Don't render if no URLs
  if (totalCount === 0) {
    return null;
  }

  const currentUrl = urls[currentIndex];
  const normalizedUrl = currentUrl.normalizedUrl;
  const isLoading = loadingUrls.has(normalizedUrl);
  const metadata = metadataMap.get(normalizedUrl);

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      tabIndex={hasMultiple ? 0 : -1}
      role={hasMultiple ? "region" : undefined}
      aria-label={hasMultiple ? `Link previews, showing ${currentIndex + 1} of ${totalCount}` : undefined}
    >
      {/* Preview card or skeleton */}
      <div className="w-full">
        {isLoading ? (
          <LinkPreviewSkeleton />
        ) : metadata && metadata.success ? (
          <LinkPreviewCard metadata={metadata} />
        ) : metadata && !metadata.success ? (
          // Failed to fetch - show minimal card with just URL
          <LinkPreviewCard
            metadata={{
              ...metadata,
              title: metadata.domain,
              description: metadata.errorMessage || "Could not load preview",
            }}
          />
        ) : (
          // No metadata yet (shouldn't happen, but fallback)
          <LinkPreviewSkeleton />
        )}
      </div>

      {/* Navigation controls (only for multiple URLs) */}
      {hasMultiple && (
        <>
          {/* Previous button */}
          <button
            onClick={goToPrevious}
            disabled={!canGoPrevious}
            className={`
              absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2
              w-8 h-8
              flex items-center justify-center
              rounded-full
              bg-hush-bg-primary border border-hush-border
              shadow-sm
              transition-all duration-150
              ${
                canGoPrevious
                  ? "hover:bg-hush-bg-hover cursor-pointer opacity-100"
                  : "opacity-40 cursor-not-allowed"
              }
              focus:outline-none focus:ring-2 focus:ring-hush-purple/50
            `}
            aria-label="Previous link preview"
            type="button"
          >
            <ChevronLeft size={16} className="text-hush-text-primary" />
          </button>

          {/* Next button */}
          <button
            onClick={goToNext}
            disabled={!canGoNext}
            className={`
              absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2
              w-8 h-8
              flex items-center justify-center
              rounded-full
              bg-hush-bg-primary border border-hush-border
              shadow-sm
              transition-all duration-150
              ${
                canGoNext
                  ? "hover:bg-hush-bg-hover cursor-pointer opacity-100"
                  : "opacity-40 cursor-not-allowed"
              }
              focus:outline-none focus:ring-2 focus:ring-hush-purple/50
            `}
            aria-label="Next link preview"
            type="button"
          >
            <ChevronRight size={16} className="text-hush-text-primary" />
          </button>

          {/* Page indicator */}
          <div
            className="
              absolute -bottom-6 left-1/2 -translate-x-1/2
              text-xs text-hush-text-accent
              bg-hush-bg-primary/80
              px-2 py-0.5
              rounded-full
            "
            aria-hidden="true"
          >
            {currentIndex + 1} / {totalCount}
          </div>
        </>
      )}
    </div>
  );
});
