/**
 * useUnreadBadge Hook
 *
 * Manages visual indicators for unread messages across different platforms:
 * - Browser: Flashing tab title showing unread count
 * - Tauri (Windows): Taskbar overlay icon with numeric badge
 * - iOS PWA: App icon numeric badge using Web App Badging API
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
 */
async function updateTauriOverlay(count: number): Promise<void> {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const window = getCurrentWindow();

    if (count === 0) {
      // Clear the overlay icon (undefined clears it in Tauri)
      await window.setOverlayIcon(undefined);
    } else {
      // Set the overlay icon with the appropriate badge
      const iconPath = getBadgeIconPath(count);
      if (iconPath) {
        await window.setOverlayIcon(iconPath);
      }
    }
  } catch (error) {
    // Silently fail if Tauri API is not available
    // This can happen during SSR or in non-Tauri environments
    console.debug('[useUnreadBadge] Tauri overlay update failed:', error);
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
