/**
 * useCopyToClipboard Hook
 *
 * Provides copy-to-clipboard functionality with visual feedback state.
 * The isCopied state automatically resets after 2 seconds.
 */

'use client';

import { useState, useCallback, useRef } from 'react';

interface UseCopyToClipboardResult {
  /** Function to copy text to clipboard */
  copy: (text: string) => Promise<boolean>;
  /** Whether text was recently copied (resets after 2 seconds) */
  isCopied: boolean;
  /** Error message if copy failed */
  error: string | null;
}

const RESET_TIMEOUT_MS = 2000;

export function useCopyToClipboard(): UseCopyToClipboardResult {
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const copy = useCallback(async (text: string): Promise<boolean> => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Reset error state
    setError(null);

    // Check if clipboard API is available
    if (!navigator?.clipboard?.writeText) {
      setError('Clipboard API not available');
      setIsCopied(false);
      return false;
    }

    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);

      // Reset isCopied after timeout
      timeoutRef.current = setTimeout(() => {
        setIsCopied(false);
        timeoutRef.current = null;
      }, RESET_TIMEOUT_MS);

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to copy to clipboard';
      setError(errorMessage);
      setIsCopied(false);
      return false;
    }
  }, []);

  return { copy, isCopied, error };
}
