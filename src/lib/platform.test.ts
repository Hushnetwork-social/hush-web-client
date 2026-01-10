/**
 * Platform Detection Tests
 *
 * Tests for the platform detection module that handles
 * platform identification across browser, Tauri desktop, and mobile.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to mock window and navigator before importing the module
const originalWindow = global.window;
const originalNavigator = global.navigator;

describe('platform', () => {
  beforeEach(() => {
    // Reset modules before each test to ensure fresh state
    vi.resetModules();
  });

  afterEach(() => {
    // Restore originals
    global.window = originalWindow;
    global.navigator = originalNavigator;
  });

  describe('detectPlatform', () => {
    it('returns "browser" when window is undefined (SSR)', async () => {
      // @ts-expect-error - Simulating SSR environment
      global.window = undefined;

      const { detectPlatform } = await import('./platform');
      expect(detectPlatform()).toBe('browser');
    });

    it('returns "browser" when not in Tauri environment', async () => {
      // Mock window without Tauri markers
      global.window = {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
        navigator: { userAgent: 'Mozilla/5.0' },
      } as unknown as Window & typeof globalThis;

      const { detectPlatform } = await import('./platform');
      expect(detectPlatform()).toBe('browser');
    });

    it('returns "tauri" when __TAURI__ is present', async () => {
      // Mock window with __TAURI__
      global.window = {
        __TAURI__: {},
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
      } as unknown as Window & typeof globalThis;

      const { detectPlatform } = await import('./platform');
      expect(detectPlatform()).toBe('tauri');
    });

    it('returns "tauri" when __TAURI_INTERNALS__ is present', async () => {
      // Mock window with __TAURI_INTERNALS__
      global.window = {
        __TAURI_INTERNALS__: {},
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
      } as unknown as Window & typeof globalThis;

      const { detectPlatform } = await import('./platform');
      expect(detectPlatform()).toBe('tauri');
    });

    it('returns "mobile-pwa" when standalone and mobile user agent', async () => {
      // Mock window with standalone mode and mobile user agent
      const mobileUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)';
      global.window = {
        matchMedia: vi.fn().mockReturnValue({ matches: true }),
        navigator: { userAgent: mobileUserAgent },
      } as unknown as Window & typeof globalThis;
      // Also mock global navigator since the implementation uses navigator.userAgent
      global.navigator = { userAgent: mobileUserAgent } as Navigator;

      const { detectPlatform } = await import('./platform');
      expect(detectPlatform()).toBe('mobile-pwa');
    });

    it('returns "browser" when standalone but desktop user agent', async () => {
      // Mock window with standalone mode but desktop user agent
      const desktopUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
      global.window = {
        matchMedia: vi.fn().mockReturnValue({ matches: true }),
        navigator: { userAgent: desktopUserAgent },
      } as unknown as Window & typeof globalThis;
      // Also mock global navigator since the implementation uses navigator.userAgent
      global.navigator = { userAgent: desktopUserAgent } as Navigator;

      const { detectPlatform } = await import('./platform');
      expect(detectPlatform()).toBe('browser');
    });
  });

  describe('isTauri', () => {
    it('returns true for tauri platform', async () => {
      global.window = {
        __TAURI__: {},
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
      } as unknown as Window & typeof globalThis;

      const { isTauri } = await import('./platform');
      expect(isTauri()).toBe(true);
    });

    it('returns false for browser platform', async () => {
      global.window = {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
        navigator: { userAgent: 'Mozilla/5.0' },
      } as unknown as Window & typeof globalThis;

      const { isTauri } = await import('./platform');
      expect(isTauri()).toBe(false);
    });
  });

  describe('isBrowser', () => {
    it('returns true for browser platform', async () => {
      global.window = {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
        navigator: { userAgent: 'Mozilla/5.0' },
      } as unknown as Window & typeof globalThis;

      const { isBrowser } = await import('./platform');
      expect(isBrowser()).toBe(true);
    });

    it('returns false for tauri platform', async () => {
      global.window = {
        __TAURI__: {},
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
      } as unknown as Window & typeof globalThis;

      const { isBrowser } = await import('./platform');
      expect(isBrowser()).toBe(false);
    });
  });

  describe('isTauriMobile', () => {
    it('returns false for basic tauri platform (not yet detected as mobile)', async () => {
      // Without async detection, tauri-android/ios won't be detected
      global.window = {
        __TAURI__: {},
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
      } as unknown as Window & typeof globalThis;

      const { isTauriMobile } = await import('./platform');
      // Basic detection returns 'tauri', not 'tauri-android'
      expect(isTauriMobile()).toBe(false);
    });
  });

  describe('isPushSupported', () => {
    it('returns false for basic tauri platform (not yet detected as mobile)', async () => {
      // Without async detection, tauri-android/ios won't be detected
      global.window = {
        __TAURI__: {},
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
      } as unknown as Window & typeof globalThis;

      const { isPushSupported } = await import('./platform');
      // Basic detection returns 'tauri', not 'tauri-android'
      expect(isPushSupported()).toBe(false);
    });

    it('returns false for browser platform', async () => {
      global.window = {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
        navigator: { userAgent: 'Mozilla/5.0' },
      } as unknown as Window & typeof globalThis;

      const { isPushSupported } = await import('./platform');
      expect(isPushSupported()).toBe(false);
    });
  });
});
