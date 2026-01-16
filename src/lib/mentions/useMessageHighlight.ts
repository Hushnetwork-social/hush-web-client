"use client";

import { useCallback, useRef } from "react";

/**
 * useMessageHighlight - Hook for applying temporary highlight animation to message elements
 *
 * Features:
 * - Applies a purple-tinted highlight effect to a message element
 * - Highlight uses CSS animation that fades out after ~4 seconds
 * - Calling highlight on a new element automatically clears the previous highlight
 * - Scrolls the element into view when highlighting
 * - No memory leaks (cleanup handled automatically)
 *
 * @returns Object with highlightMessage function and clearHighlight function
 */
export function useMessageHighlight() {
  const currentHighlightRef = useRef<HTMLElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Clears any existing highlight
   */
  const clearHighlight = useCallback(() => {
    if (currentHighlightRef.current) {
      currentHighlightRef.current.classList.remove("animate-highlight-fade");
      currentHighlightRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  /**
   * Highlights a message element and scrolls it into view
   * @param element - The HTML element to highlight (typically a message container)
   */
  const highlightMessage = useCallback(
    (element: HTMLElement | null) => {
      if (!element) return;

      // Clear any existing highlight first
      clearHighlight();

      // Store reference to current highlighted element
      currentHighlightRef.current = element;

      // Scroll element into view smoothly
      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      // Apply highlight animation class
      element.classList.add("animate-highlight-fade");

      // Set timeout to clean up after animation completes (4 seconds)
      timeoutRef.current = setTimeout(() => {
        if (currentHighlightRef.current === element) {
          element.classList.remove("animate-highlight-fade");
          currentHighlightRef.current = null;
        }
      }, 4000);
    },
    [clearHighlight]
  );

  return {
    highlightMessage,
    clearHighlight,
  };
}
