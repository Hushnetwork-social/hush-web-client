/**
 * Push Notification Handler
 *
 * Handles navigation when user taps a push notification.
 * Works in conjunction with native Kotlin code that stores
 * the pending feedId in SharedPreferences.
 *
 * Architecture:
 * - Native code stores pending feedId when notification is tapped
 * - TypeScript layer checks for pending navigation on app startup/resume
 * - Navigates to the appropriate feed and clears the pending state
 */

import { detectPlatformAsync } from '@/lib/platform';
import { debugLog, debugError } from '@/lib/debug-logger';

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
 * Check for and handle pending navigation from notification tap.
 * Should be called on app startup and resume (visibility change).
 *
 * Navigation behavior:
 * - If feedId exists: Navigate to /dashboard?feed={feedId}
 * - If no feedId: No navigation occurs
 *
 * @returns true if navigation occurred, false otherwise
 */
export async function checkPendingNavigation(): Promise<boolean> {
  debugLog('[PushHandler] Checking for pending navigation');

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
