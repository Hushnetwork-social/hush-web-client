/**
 * Push Notification and Deep Link Handler
 *
 * Handles navigation when:
 * 1. User taps a push notification - navigates to specific feed
 * 2. User taps an App Link (e.g., https://chat.hushnetwork.social/join/ABC123) - navigates to join page
 *
 * Works in conjunction with native Kotlin code that stores
 * the pending feedId/path in SharedPreferences.
 *
 * Architecture:
 * - Native code stores pending feedId/path when notification/App Link is tapped
 * - TypeScript layer checks for pending navigation on app startup/resume
 * - Navigates to the appropriate page and clears the pending state
 */

import { detectPlatformAsync } from '@/lib/platform';
import { debugLog, debugError } from '@/lib/debug-logger';
import { getPendingDeepLink, clearPendingDeepLink } from './pushManager';

// Type matching Rust PendingNavigationResult
interface PendingNavigationResult {
  feed_id: string | null;
}

/**
 * Get pending navigation feedId from notification tap.
 * Returns null if no pending navigation or on non-mobile platforms.
 */
async function getPendingNavigation(): Promise<string | null> {
  const platform = await detectPlatformAsync();

  if (platform !== 'tauri-android' && platform !== 'tauri-ios') {
    return null;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const result = await invoke<PendingNavigationResult>('get_pending_navigation');
    return result.feed_id;
  } catch (error) {
    debugError('[PushHandler] Failed to get pending navigation:', error);
    return null;
  }
}

/**
 * Clear pending navigation after processing.
 * Should be called after successfully navigating or after determining navigation isn't possible.
 */
async function clearPendingNavigation(): Promise<void> {
  const platform = await detectPlatformAsync();

  if (platform !== 'tauri-android' && platform !== 'tauri-ios') {
    return;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('clear_pending_navigation');
    debugLog('[PushHandler] Pending navigation cleared');
  } catch (error) {
    debugError('[PushHandler] Failed to clear pending navigation:', error);
  }
}

/**
 * Check for and handle pending deep link navigation.
 * Called as part of checkPendingNavigation.
 *
 * @returns true if navigation occurred, false otherwise
 */
async function checkPendingDeepLinkNavigation(): Promise<boolean> {
  debugLog('[PushHandler] Checking for pending deep link');

  const path = getPendingDeepLink();

  if (!path) {
    debugLog('[PushHandler] No pending deep link');
    return false;
  }

  debugLog(`[PushHandler] Found pending deep link: ${path}`);

  // Clear before navigating to prevent loops
  clearPendingDeepLink();

  // Navigate to the path
  try {
    // Use window.location for simplicity and reliability
    window.location.href = path;
    return true;
  } catch (error) {
    debugError('[PushHandler] Deep link navigation failed:', error);
    return false;
  }
}

/**
 * Check for and handle pending navigation from notification tap or deep link.
 * Should be called on app startup and resume (visibility change).
 *
 * Navigation behavior:
 * - If feedId exists (from notification): Navigate to /dashboard?feed={feedId}
 * - If deep link path exists: Navigate to that path (e.g., /join/ABC123)
 * - If neither: No navigation occurs
 *
 * Priority: Deep links are checked first (user explicitly clicked a link),
 * then notification taps.
 *
 * @returns true if navigation occurred, false otherwise
 */
export async function checkPendingNavigation(): Promise<boolean> {
  debugLog('[PushHandler] Checking for pending navigation');

  // Check for deep link first (higher priority - user explicitly clicked a link)
  const deepLinkNavigated = await checkPendingDeepLinkNavigation();
  if (deepLinkNavigated) {
    return true;
  }

  // Check for notification tap navigation
  const feedId = await getPendingNavigation();

  if (!feedId) {
    debugLog('[PushHandler] No pending navigation');
    return false;
  }

  debugLog(`[PushHandler] Found pending navigation to feed: ${feedId.substring(0, 8)}...`);

  // Clear before navigating to prevent loops
  await clearPendingNavigation();

  // Navigate to the feed
  try {
    // Use window.location for simplicity and reliability
    // This ensures the dashboard loads with the feed parameter
    window.location.href = `/dashboard?feed=${encodeURIComponent(feedId)}`;
    return true;
  } catch (error) {
    debugError('[PushHandler] Navigation failed:', error);
    return false;
  }
}

/**
 * Setup visibility change listener for app resume handling.
 * Returns a cleanup function to remove the listener.
 *
 * @returns Cleanup function to remove the visibility change listener
 */
export function setupVisibilityChangeListener(): () => void {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      debugLog('[PushHandler] App became visible, checking pending navigation');
      checkPendingNavigation();
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}

export const pushHandler = {
  checkPendingNavigation,
  setupVisibilityChangeListener,
};
