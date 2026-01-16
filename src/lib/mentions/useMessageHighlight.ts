"use client";

import { useCallback, useRef, useEffect, useState } from "react";

/**
 * useMessageHighlight - Hook for applying temporary highlight animation to message elements
 *
 * Features:
 * - Applies a purple-tinted highlight effect to a message element
 * - Highlight uses CSS animation that fades out after ~4 seconds
 * - Calling highlight on a new element automatically clears the previous highlight
 * - Scrolls the element into view when highlighting
 * - No memory leaks (cleanup handled automatically)
 * - Respects prefers-reduced-motion for accessibility
 *
 * @returns Object with highlightMessage function and clearHighlight function
 */
export function useMessageHighlight() {
  const currentHighlightRef = useRef<HTMLElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track reduced motion preference
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check if matchMedia is available (may not be in tests)
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    // Check initial preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    // Listen for changes
    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

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

      // Scroll element into view (instant for reduced motion, smooth otherwise)
      element.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "center",
      });

      // Apply highlight animation class (use reduced motion variant if needed)
      const animationClass = prefersReducedMotion
        ? "animate-highlight-fade-reduced"
        : "animate-highlight-fade";
      element.classList.add(animationClass);

      // Set timeout to clean up after animation completes
      // Shorter duration for reduced motion (0.5s vs 4s)
      const cleanupDelay = prefersReducedMotion ? 500 : 4000;
      timeoutRef.current = setTimeout(() => {
        if (currentHighlightRef.current === element) {
          element.classList.remove(animationClass);
          currentHighlightRef.current = null;
        }
      }, cleanupDelay);
    },
    [clearHighlight, prefersReducedMotion]
  );

  return {
    highlightMessage,
    clearHighlight,
  };
}
