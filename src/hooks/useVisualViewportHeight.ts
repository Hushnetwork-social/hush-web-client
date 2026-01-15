/**
 * useVisualViewportHeight Hook
 *
 * Sets a CSS custom property (--visual-viewport-height) based on the actual
 * visual viewport height. This is essential for Android WebView where the
 * virtual keyboard doesn't trigger proper viewport resize events.
 *
 * The hook:
 * 1. Listens to visualViewport resize events
 * 2. Updates --visual-viewport-height CSS variable on document root
 * 3. Only activates on Android platform (returns early on iOS/desktop)
 *
 * Usage: Call this hook in your layout component, then use the CSS variable:
 * height: var(--visual-viewport-height, 100vh)
 */

'use client';

import { useEffect, useState } from 'react';

/**
 * Check if the current platform is Android
 */
function isAndroidPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

/**
 * Check if visualViewport API is available
 */
function hasVisualViewport(): boolean {
  return typeof window !== 'undefined' && 'visualViewport' in window && window.visualViewport !== null;
}

export interface UseVisualViewportHeightResult {
  /** Current visual viewport height in pixels */
  height: number;
  /** Whether the keyboard is likely open (viewport significantly smaller than window) */
  isKeyboardOpen: boolean;
}

/**
 * Hook that tracks visual viewport height and sets CSS variable.
 * Only activates on Android - returns window.innerHeight on other platforms.
 *
 * @returns Object with current height and keyboard open state
 */
export function useVisualViewportHeight(): UseVisualViewportHeightResult {
  const [height, setHeight] = useState(() => {
    if (typeof window === 'undefined') return 0;
    return window.innerHeight;
  });

  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    // Set initial height
    const initialHeight = window.innerHeight;
    setHeight(initialHeight);
    document.documentElement.style.setProperty('--visual-viewport-height', `${initialHeight}px`);

    // Only use visualViewport tracking on Android
    if (!isAndroidPlatform() || !hasVisualViewport()) {
      // On non-Android platforms, just track window resize
      const handleWindowResize = () => {
        const newHeight = window.innerHeight;
        setHeight(newHeight);
        document.documentElement.style.setProperty('--visual-viewport-height', `${newHeight}px`);
      };

      window.addEventListener('resize', handleWindowResize);
      return () => window.removeEventListener('resize', handleWindowResize);
    }

    // Android with visualViewport API
    const viewport = window.visualViewport!;
    const windowHeight = window.innerHeight;

    const handleViewportChange = () => {
      const viewportHeight = viewport.height;

      // Update CSS variable
      document.documentElement.style.setProperty('--visual-viewport-height', `${viewportHeight}px`);
      setHeight(viewportHeight);

      // Detect keyboard open (viewport is significantly smaller than window)
      // Using 150px threshold to avoid false positives from address bar changes
      const keyboardOpen = (windowHeight - viewportHeight) > 150;
      setIsKeyboardOpen(keyboardOpen);

      // Also prevent any scroll that Android WebView might try to do
      if (keyboardOpen) {
        window.scrollTo(0, 0);
      }
    };

    // Initial call
    handleViewportChange();

    // Listen to both resize and scroll events on visualViewport
    viewport.addEventListener('resize', handleViewportChange);
    viewport.addEventListener('scroll', handleViewportChange);

    return () => {
      viewport.removeEventListener('resize', handleViewportChange);
      viewport.removeEventListener('scroll', handleViewportChange);
    };
  }, []);

  return { height, isKeyboardOpen };
}
