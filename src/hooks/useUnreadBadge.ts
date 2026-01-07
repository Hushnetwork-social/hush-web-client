/**
 * useUnreadBadge Hook
 *
 * Manages visual indicators for unread messages across different platforms:
 * - Browser: Flashing tab title showing unread count
 * - Tauri (Windows): Taskbar overlay icon with numeric badge
 * - iOS PWA: App icon numeric badge using Web App Badging API
 *
 * Focus behavior:
 * When the browser tab loses focus (user switches to another tab or app),
 * this hook deselects the current feed. This ensures that any incoming
 * messages are treated as "unread" by the notification system, and the
 * badge indicator will show the count.
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useFeedsStore } from '@/modules/feeds';
import { useAppStore } from '@/stores/useAppStore';
import { detectPlatform, type Platform } from '@/lib/platform';

// Constants
const BASE_TITLE = 'Hush Feeds';
const FULL_TITLE = 'Hush Feeds - Decentralized Messaging';
const FLASH_INTERVAL_MS = 2000;

/**
 * Get the badge icon path for a given unread count
 * Returns the appropriate badge icon path (1-9 or 9+)
 */
export function getBadgeIconPath(count: number): string | null {
  if (count <= 0) return null;
  if (count <= 9) return `/icons/badge-${count}.png`;
  return '/icons/badge-9plus.png';
}

/**
 * Update Tauri window overlay icon
 * Uses dynamic import to avoid bundling Tauri in browser builds
 * Fetches icon as bytes since Tauri needs actual image data, not web paths
 */
async function updateTauriOverlay(count: number): Promise<void> {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const window = getCurrentWindow();

    if (count === 0) {
      // Clear the overlay icon (undefined clears it in Tauri)
      await window.setOverlayIcon(undefined);
    } else {
      // Get the icon path and fetch it as bytes
      const iconPath = getBadgeIconPath(count);
      if (iconPath) {
        // Fetch the icon from the web server and convert to Uint8Array
        const response = await fetch(iconPath);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const iconBytes = new Uint8Array(arrayBuffer);
          await window.setOverlayIcon(iconBytes);
        }
      }
    }
  } catch {
    // Silently fail if Tauri API is not available
  }
}

/**
 * Clear Tauri window overlay icon
 */
async function clearTauriOverlay(): Promise<void> {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const window = getCurrentWindow();
    await window.setOverlayIcon(undefined);
  } catch {
    // Silently fail if Tauri API is not available
  }
}

/**
 * TypeScript type for Badging API methods
 * The Badging API is available on iOS 16.4+ PWAs and some desktop browsers
 */
type BadgingNavigator = {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

/**
 * Check if the Web App Badging API is available
 */
export function isBadgingApiSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  return 'setAppBadge' in navigator;
}

/**
 * Update PWA app badge using the Web App Badging API
 * Works on iOS 16.4+ when installed as PWA on home screen
 */
async function updatePwaBadge(count: number): Promise<void> {
  try {
    const nav = navigator as unknown as BadgingNavigator;
    if (nav.setAppBadge) {
      if (count === 0) {
        await nav.clearAppBadge?.();
      } else {
        await nav.setAppBadge(count);
      }
    }
  } catch {
    // Silently fail if Badging API is not available or errors
    // This can happen if the app is not installed as PWA
    console.debug('[useUnreadBadge] PWA badge update failed');
  }
}

/**
 * Clear PWA app badge
 */
async function clearPwaBadge(): Promise<void> {
  try {
    const nav = navigator as unknown as BadgingNavigator;
    if (nav.clearAppBadge) {
      await nav.clearAppBadge();
    }
  } catch {
    // Silently fail if not supported
  }
}

/**
 * Hook that updates visual badge indicators based on unread message count.
 * Implements browser tab title flashing, Tauri taskbar overlay, and PWA app badge.
 *
 * When the tab loses focus, this hook deselects the current feed so that
 * incoming messages are treated as unread by the notification system.
 */
export function useUnreadBadge(): void {
  // Get the action to deselect the feed
  const selectFeed = useAppStore((state) => state.selectFeed);

  // Store the feed ID that was selected before losing focus (to restore on regain focus)
  const previousSelectedFeedRef = useRef<string | null>(null);

  // Subscribe to feeds for computing unread count
  const feeds = useFeedsStore((state) => state.feeds);

  // Compute total unread count from all feeds
  // Note: When tab loses focus, we deselect the feed so incoming messages
  // are treated as unread by the notification system. This means we can
  // simply sum all unread counts without complex focus-based logic.
  const unreadCount = feeds.reduce((total, feed) => {
    return total + (feed.unreadCount || 0);
  }, 0);

  const flashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const showingCountRef = useRef(true);

  // Set up focus/blur event listeners
  // When tab loses focus, deselect the feed so incoming messages are marked as unread
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBlur = () => {
      // Save current selection and deselect feed
      // This ensures incoming messages are treated as "unread" by the notification system
      const currentSelectedFeed = useAppStore.getState().selectedFeedId;
      if (currentSelectedFeed) {
        previousSelectedFeedRef.current = currentSelectedFeed;
        selectFeed(null);
      }
    };

    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible' && document.hasFocus();

      if (!isVisible) {
        // Tab became hidden - deselect feed
        const currentSelectedFeed = useAppStore.getState().selectedFeedId;
        if (currentSelectedFeed) {
          previousSelectedFeedRef.current = currentSelectedFeed;
          selectFeed(null);
        }
      }
    };

    // Use both window and document events for better cross-platform support
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectFeed]);

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
        // Clear Tauri overlay icon
        clearTauriOverlay();
        // Also clear browser title as fallback
        document.title = FULL_TITLE;
        break;
      case 'mobile-pwa':
        // Clear PWA app badge
        clearPwaBadge();
        // Also clear browser title as fallback
        document.title = FULL_TITLE;
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
        // Update Tauri taskbar overlay icon
        updateTauriOverlay(unreadCount);
        // Also update browser title as secondary indicator
        updateBrowserTitle(unreadCount);
        break;
      case 'mobile-pwa':
        // Update PWA app badge (iOS 16.4+)
        updatePwaBadge(unreadCount);
        // Also update browser title as fallback for unsupported platforms
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
