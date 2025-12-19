/**
 * Platform Detection Utility
 *
 * Detects the runtime platform (browser, Tauri desktop, or mobile PWA)
 * and provides platform-specific notification handlers.
 */

export type Platform = 'browser' | 'tauri' | 'mobile-pwa';

/**
 * Detect the current runtime platform
 */
export function detectPlatform(): Platform {
  if (typeof window === 'undefined') {
    return 'browser';
  }

  // Check if running in Tauri
  if ('__TAURI__' in window || '__TAURI_INTERNALS__' in window) {
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
 * Check if we're running in Tauri
 */
export function isTauri(): boolean {
  return detectPlatform() === 'tauri';
}

/**
 * Check if we're running in a browser (not Tauri or PWA)
 */
export function isBrowser(): boolean {
  return detectPlatform() === 'browser';
}
