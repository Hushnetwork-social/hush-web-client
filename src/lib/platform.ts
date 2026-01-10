/**
 * Platform Detection Utility
 *
 * Detects the runtime platform (browser, Tauri desktop, Tauri mobile, or mobile PWA)
 * and provides platform-specific notification handlers.
 */

export type Platform = 'browser' | 'tauri' | 'tauri-android' | 'tauri-ios' | 'mobile-pwa';

// Cached detailed platform for async detection
let cachedDetailedPlatform: Platform | null = null;

/**
 * Detect the current runtime platform (synchronous, basic detection)
 * For mobile-specific detection, use detectPlatformAsync() which calls Tauri commands.
 */
export function detectPlatform(): Platform {
  // Return cached value if available (set by async detection)
  if (cachedDetailedPlatform) {
    return cachedDetailedPlatform;
  }

  if (typeof window === 'undefined') {
    return 'browser';
  }

  // Check if running in Tauri
  if ('__TAURI__' in window || '__TAURI_INTERNALS__' in window) {
    // Basic Tauri detection - use detectPlatformAsync for mobile-specific
    return 'tauri';
  }

  // Check if installed as PWA on mobile
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isMobile = /mobile|android|iphone|ipad/i.test(navigator.userAgent);
  if (isStandalone && isMobile) {
    return 'mobile-pwa';
  }

  return 'browser';
}

/**
 * Detect the platform asynchronously with detailed Tauri mobile detection.
 * This uses Tauri commands to distinguish between desktop, Android, and iOS.
 * Results are cached for subsequent synchronous calls.
 */
export async function detectPlatformAsync(): Promise<Platform> {
  if (cachedDetailedPlatform) {
    return cachedDetailedPlatform;
  }

  const basicPlatform = detectPlatform();

  // Only query Tauri if we're in a Tauri environment
  if (basicPlatform === 'tauri') {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const tauriPlatform = await invoke<string>('get_platform');

      if (tauriPlatform === 'android') {
        cachedDetailedPlatform = 'tauri-android';
      } else if (tauriPlatform === 'ios') {
        cachedDetailedPlatform = 'tauri-ios';
      } else {
        cachedDetailedPlatform = 'tauri';
      }
    } catch {
      // Fallback to basic tauri if command fails
      cachedDetailedPlatform = 'tauri';
    }
  } else {
    cachedDetailedPlatform = basicPlatform;
  }

  return cachedDetailedPlatform;
}

/**
 * Check if we're running in Tauri (any variant: desktop, Android, or iOS)
 */
export function isTauri(): boolean {
  const platform = detectPlatform();
  return platform === 'tauri' || platform === 'tauri-android' || platform === 'tauri-ios';
}

/**
 * Check if we're running in Tauri mobile (Android or iOS)
 */
export function isTauriMobile(): boolean {
  const platform = detectPlatform();
  return platform === 'tauri-android' || platform === 'tauri-ios';
}

/**
 * Check if we're running in a browser (not Tauri or PWA)
 */
export function isBrowser(): boolean {
  return detectPlatform() === 'browser';
}

/**
 * Check if push notifications are supported on this platform.
 * Returns true for Tauri mobile platforms.
 */
export function isPushSupported(): boolean {
  const platform = detectPlatform();
  return platform === 'tauri-android' || platform === 'tauri-ios';
}
