"use client";

import { memo, useState, useCallback, useRef, useEffect } from "react";
import { Play } from "lucide-react";

interface ContentCarouselProps {
  /** Child elements to render as carousel items */
  children: React.ReactNode[];
  /** Optional CSS class for the container */
  className?: string;
  /** Accessible label for the carousel region */
  ariaLabel?: string;
}

/**
 * FEAT-067: Generic content carousel supporting mixed content types.
 *
 * Renders children as navigable carousel items with prev/next buttons,
 * page indicator, keyboard arrow keys, and touch swipe navigation.
 * Single item hides all navigation controls.
 * Refactored from LinkPreviewCarousel for reuse with attachments.
 */
export const ContentCarousel = memo(function ContentCarousel({
  children,
  className = "",
  ariaLabel = "Content carousel",
}: ContentCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  const totalCount = children.length;
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
      const threshold = 50;

      if (Math.abs(diff) > threshold) {
        if (diff > 0) {
          goToNext();
        } else {
          goToPrevious();
        }
      }

      touchStartX.current = null;
    },
    [goToNext, goToPrevious]
  );

  // Reset to first item if children count changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [totalCount]);

  if (totalCount === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${hasMultiple ? "mb-3" : ""} ${className}`}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      tabIndex={hasMultiple ? 0 : -1}
      role={hasMultiple ? "region" : undefined}
      aria-label={hasMultiple ? `${ariaLabel}, showing ${currentIndex + 1} of ${totalCount}` : undefined}
      data-testid="content-carousel"
    >
      {/* Current item */}
      <div className="w-full" data-testid="carousel-item">
        {children[currentIndex]}
      </div>

      {/* Navigation controls (only for multiple items) */}
      {hasMultiple && (
        <>
          {/* Previous button */}
          <button
            onClick={goToPrevious}
            disabled={!canGoPrevious}
            className={`
              absolute -left-2.5 top-1/2 -translate-y-1/2
              w-5 h-5
              flex items-center justify-center
              rounded-full
              bg-hush-purple
              transition-all duration-150
              ${
                canGoPrevious
                  ? "hover:bg-hush-purple-light hover:scale-110 cursor-pointer"
                  : "opacity-40 cursor-not-allowed"
              }
              focus:outline-none focus:ring-1 focus:ring-hush-purple/50
            `}
            aria-label="Previous item"
            type="button"
          >
            <Play size={10} className="text-white rotate-180 -mr-px" fill="currentColor" />
          </button>

          {/* Next button */}
          <button
            onClick={goToNext}
            disabled={!canGoNext}
            className={`
              absolute -right-2.5 top-1/2 -translate-y-1/2
              w-5 h-5
              flex items-center justify-center
              rounded-full
              bg-hush-purple
              transition-all duration-150
              ${
                canGoNext
                  ? "hover:bg-hush-purple-light hover:scale-110 cursor-pointer"
                  : "opacity-40 cursor-not-allowed"
              }
              focus:outline-none focus:ring-1 focus:ring-hush-purple/50
            `}
            aria-label="Next item"
            type="button"
          >
            <Play size={10} className="text-white ml-px" fill="currentColor" />
          </button>

          {/* Page indicator */}
          <div
            className="
              absolute -bottom-2.5 left-1/2 -translate-x-1/2
              text-[10px] text-white
              bg-hush-purple
              px-2 py-0.5
              rounded-full
            "
            aria-hidden="true"
            data-testid="page-indicator"
          >
            {currentIndex + 1} / {totalCount}
          </div>
        </>
      )}
    </div>
  );
});
