'use client';

import { useEffect, useState, useCallback } from 'react';
import { checkForDataLoss, clearDataLossFlag } from '@/lib/mentions';

interface DataLossToast {
  id: string;
  message: string;
}

/**
 * useMentionDataLossCheck - Hook to check for and notify about mention tracking data loss
 *
 * Checks on mount if localStorage mention data was cleared (e.g., user cleared browser data).
 * If data loss is detected, shows a notification toast to inform the user.
 *
 * Returns:
 * - toasts: Array of active toast notifications
 * - dismissToast: Function to dismiss a toast by ID
 */
export function useMentionDataLossCheck() {
  const [toasts, setToasts] = useState<DataLossToast[]>([]);

  // Check for data loss on mount
  useEffect(() => {
    // Small delay to avoid race with auth check
    const timer = setTimeout(() => {
      if (checkForDataLoss()) {
        // Data loss detected - show toast
        setToasts([
          {
            id: 'mention-data-loss',
            message: 'Mention tracking data was reset. Your unread mention indicators have been cleared.',
          },
        ]);

        // Clear the flag so we don't show again until next actual data loss
        clearDataLossFlag();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return {
    toasts,
    dismissToast,
  };
}
