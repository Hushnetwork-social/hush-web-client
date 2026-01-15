/**
 * useVirtualKeyboard Hook
 *
 * Detects virtual keyboard visibility on Android devices.
 * Uses visualViewport API as primary detection, with focusin/focusout fallback.
 * Only activates on Android platform - returns false for iOS/desktop.
 */

'use client';

import { useState, useEffect, useRef } from 'react';

// Threshold in pixels - viewport height decrease greater than this indicates keyboard is open
const KEYBOARD_HEIGHT_THRESHOLD = 150;

// Delay in milliseconds before setting keyboard invisible on blur (debounce)
const BLUR_DELAY_MS = 100;

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

export interface UseVirtualKeyboardResult {
  isKeyboardVisible: boolean;
}

/**
 * Hook to detect virtual keyboard visibility on Android devices.
 *
 * @returns Object with isKeyboardVisible boolean
 *
 * @example
 * ```tsx
 * function ChatHeader() {
 *   const { isKeyboardVisible } = useVirtualKeyboard();
 *   return (
 *     <header className={isKeyboardVisible ? 'compact' : 'normal'}>
 *       ...
 *     </header>
 *   );
 * }
 * ```
 */
export function useVirtualKeyboard(): UseVirtualKeyboardResult {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const initialViewportHeightRef = useRef<number | null>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Only activate on Android
    if (!isAndroidPlatform()) {
      return;
    }

    // Store initial viewport height for comparison
    if (hasVisualViewport()) {
      initialViewportHeightRef.current = window.innerHeight;
    }

    // Primary: visualViewport API detection
    if (hasVisualViewport()) {
      const handleResize = () => {
        const visualViewport = window.visualViewport;
        if (!visualViewport || initialViewportHeightRef.current === null) return;

        const heightDiff = initialViewportHeightRef.current - visualViewport.height;
        const keyboardOpen = heightDiff > KEYBOARD_HEIGHT_THRESHOLD;

        setIsKeyboardVisible(keyboardOpen);
      };

      window.visualViewport!.addEventListener('resize', handleResize);

      return () => {
        window.visualViewport?.removeEventListener('resize', handleResize);
      };
    }

    // Fallback: focusin/focusout events
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      // Only consider text input elements
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Clear any pending blur timeout
        if (blurTimeoutRef.current) {
          clearTimeout(blurTimeoutRef.current);
          blurTimeoutRef.current = null;
        }
        setIsKeyboardVisible(true);
      }
    };

    const handleFocusOut = () => {
      // Delay to handle focus transitions between inputs
      blurTimeoutRef.current = setTimeout(() => {
        setIsKeyboardVisible(false);
        blurTimeoutRef.current = null;
      }, BLUR_DELAY_MS);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  return { isKeyboardVisible };
}
