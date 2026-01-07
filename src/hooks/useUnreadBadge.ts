/**
 * useUnreadBadge Hook
 *
 * Manages visual indicators for unread messages across different platforms:
 * - Browser: Flashing tab title showing unread count
 * - Tauri (Windows): Taskbar overlay icon (handled in Phase 3)
 * - iOS PWA: App icon badge (handled in Phase 4)
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useFeedsStore } from '@/modules/feeds';
import { detectPlatform, type Platform } from '@/lib/platform';

// Constants
const BASE_TITLE = 'Hush Feeds';
const FULL_TITLE = 'Hush Feeds - Decentralized Messaging';
const FLASH_INTERVAL_MS = 2000;

/**
 * Hook that updates visual badge indicators based on unread message count.
 * Currently implements browser tab title flashing.
 * Tauri and PWA badge support will be added in later phases.
 */
export function useUnreadBadge(): void {
  const getTotalUnreadCount = useFeedsStore((state) => state.getTotalUnreadCount);
  const unreadCount = getTotalUnreadCount();

  const flashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const showingCountRef = useRef(true);

  // Clear any existing flash interval
  const clearFlashInterval = useCallback(() => {
    if (flashIntervalRef.current) {
      clearInterval(flashIntervalRef.current);
      flashIntervalRef.current = null;
    }
  }, []);

  // Update browser tab title with flashing effect
  const updateBrowserTitle = useCallback((count: number) => {
    // Clear previous interval
    clearFlashInterval();

    if (count === 0) {
      document.title = FULL_TITLE;
      return;
    }

    // Set initial title with count
    showingCountRef.current = true;
    document.title = `(${count}) ${BASE_TITLE}`;

    // Start flashing interval
    flashIntervalRef.current = setInterval(() => {
      showingCountRef.current = !showingCountRef.current;
      document.title = showingCountRef.current
        ? `(${count}) ${BASE_TITLE}`
        : BASE_TITLE;
    }, FLASH_INTERVAL_MS);
  }, [clearFlashInterval]);

  // Clear all badges for a given platform
  const clearAllBadges = useCallback((platform: Platform) => {
    switch (platform) {
      case 'browser':
        document.title = FULL_TITLE;
        break;
      case 'tauri':
        // Tauri badge clearing will be implemented in Phase 3
        break;
      case 'mobile-pwa':
        // PWA badge clearing will be implemented in Phase 4
        if ('clearAppBadge' in navigator) {
          (navigator as Navigator & { clearAppBadge: () => Promise<void> })
            .clearAppBadge()
            .catch(() => {
              // Silently fail if not supported
            });
        }
        break;
    }
  }, []);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') {
      return;
    }

    const platform = detectPlatform();

    if (unreadCount === 0) {
      clearFlashInterval();
      clearAllBadges(platform);
      return;
    }

    // Platform-specific badge updates
    switch (platform) {
      case 'browser':
        updateBrowserTitle(unreadCount);
        break;
      case 'tauri':
        // Tauri overlay will be implemented in Phase 3
        // For now, also use browser title as fallback
        updateBrowserTitle(unreadCount);
        break;
      case 'mobile-pwa':
        // PWA badge will be implemented in Phase 4
        // For now, use browser title as fallback
        updateBrowserTitle(unreadCount);
        break;
    }

    // Cleanup function
    return () => {
      clearFlashInterval();
      document.title = FULL_TITLE;
    };
  }, [unreadCount, clearFlashInterval, clearAllBadges, updateBrowserTitle]);
}

// Export constants for testing
export const UNREAD_BADGE_CONSTANTS = {
  BASE_TITLE,
  FULL_TITLE,
  FLASH_INTERVAL_MS,
} as const;
