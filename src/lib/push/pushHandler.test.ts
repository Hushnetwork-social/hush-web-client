/**
 * Push Handler Tests
 *
 * Tests for the push notification handler that manages
 * navigation when users tap push notifications.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock platform detection
vi.mock('@/lib/platform', () => ({
  detectPlatformAsync: vi.fn(),
}));

// Mock debug logger
vi.mock('@/lib/debug-logger', () => ({
  debugLog: vi.fn(),
  debugError: vi.fn(),
}));

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import {
  checkPendingNavigation,
  setupVisibilityChangeListener,
} from './pushHandler';
import { detectPlatformAsync } from '@/lib/platform';
import { invoke } from '@tauri-apps/api/core';

describe('pushHandler', () => {
  // Store original window.location
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock window.location
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: '/' },
    });
  });

  afterEach(() => {
    vi.resetAllMocks();

    // Restore window.location
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  describe('checkPendingNavigation', () => {
    it('returns false and skips on desktop platform', async () => {
      vi.mocked(detectPlatformAsync).mockResolvedValue('tauri');

      const result = await checkPendingNavigation();

      expect(result).toBe(false);
      expect(invoke).not.toHaveBeenCalled();
    });

    it('returns false and skips on browser platform', async () => {
      vi.mocked(detectPlatformAsync).mockResolvedValue('browser');

      const result = await checkPendingNavigation();

      expect(result).toBe(false);
      expect(invoke).not.toHaveBeenCalled();
    });

    it('returns false when no pending navigation exists on Android', async () => {
      vi.mocked(detectPlatformAsync).mockResolvedValue('tauri-android');
      vi.mocked(invoke).mockResolvedValue({ feed_id: null });

      const result = await checkPendingNavigation();

      expect(result).toBe(false);
      expect(invoke).toHaveBeenCalledWith('get_pending_navigation');
    });

    it('navigates to feed when pending navigation exists on Android', async () => {
      const mockFeedId = 'test-feed-id-12345';
      vi.mocked(detectPlatformAsync).mockResolvedValue('tauri-android');
      vi.mocked(invoke).mockImplementation((cmd: string) => {
        if (cmd === 'get_pending_navigation') {
          return Promise.resolve({ feed_id: mockFeedId });
        }
        if (cmd === 'clear_pending_navigation') {
          return Promise.resolve(undefined);
        }
        return Promise.reject(new Error(`Unknown command: ${cmd}`));
      });

      const result = await checkPendingNavigation();

      expect(result).toBe(true);
      expect(invoke).toHaveBeenCalledWith('get_pending_navigation');
      expect(invoke).toHaveBeenCalledWith('clear_pending_navigation');
      expect(window.location.href).toBe(`/dashboard?feed=${encodeURIComponent(mockFeedId)}`);
    });

    it('navigates to feed when pending navigation exists on iOS', async () => {
      const mockFeedId = 'ios-feed-id-67890';
      vi.mocked(detectPlatformAsync).mockResolvedValue('tauri-ios');
      vi.mocked(invoke).mockImplementation((cmd: string) => {
        if (cmd === 'get_pending_navigation') {
          return Promise.resolve({ feed_id: mockFeedId });
        }
        if (cmd === 'clear_pending_navigation') {
          return Promise.resolve(undefined);
        }
        return Promise.reject(new Error(`Unknown command: ${cmd}`));
      });

      const result = await checkPendingNavigation();

      expect(result).toBe(true);
      expect(window.location.href).toBe(`/dashboard?feed=${encodeURIComponent(mockFeedId)}`);
    });

    it('clears pending navigation before navigating', async () => {
      const mockFeedId = 'test-feed-id';
      vi.mocked(detectPlatformAsync).mockResolvedValue('tauri-android');

      const invokeOrder: string[] = [];
      vi.mocked(invoke).mockImplementation((cmd: string) => {
        invokeOrder.push(cmd);
        if (cmd === 'get_pending_navigation') {
          return Promise.resolve({ feed_id: mockFeedId });
        }
        if (cmd === 'clear_pending_navigation') {
          return Promise.resolve(undefined);
        }
        return Promise.reject(new Error(`Unknown command: ${cmd}`));
      });

      await checkPendingNavigation();

      // Verify clear is called before navigation (which sets window.location.href)
      expect(invokeOrder).toContain('get_pending_navigation');
      expect(invokeOrder).toContain('clear_pending_navigation');
      expect(invokeOrder.indexOf('clear_pending_navigation')).toBeGreaterThan(
        invokeOrder.indexOf('get_pending_navigation')
      );
    });

    it('handles get_pending_navigation errors gracefully', async () => {
      vi.mocked(detectPlatformAsync).mockResolvedValue('tauri-android');
      vi.mocked(invoke).mockRejectedValue(new Error('Native error'));

      const result = await checkPendingNavigation();

      expect(result).toBe(false);
    });

    it('encodes feedId in navigation URL', async () => {
      const mockFeedId = 'feed with spaces & special=chars';
      vi.mocked(detectPlatformAsync).mockResolvedValue('tauri-android');
      vi.mocked(invoke).mockImplementation((cmd: string) => {
        if (cmd === 'get_pending_navigation') {
          return Promise.resolve({ feed_id: mockFeedId });
        }
        if (cmd === 'clear_pending_navigation') {
          return Promise.resolve(undefined);
        }
        return Promise.reject(new Error(`Unknown command: ${cmd}`));
      });

      await checkPendingNavigation();

      expect(window.location.href).toBe(`/dashboard?feed=${encodeURIComponent(mockFeedId)}`);
    });
  });

  describe('setupVisibilityChangeListener', () => {
    it('returns a cleanup function', () => {
      const cleanup = setupVisibilityChangeListener();

      expect(typeof cleanup).toBe('function');

      // Cleanup to remove listener
      cleanup();
    });

    it('adds visibilitychange event listener', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      setupVisibilityChangeListener();

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function)
      );

      addEventListenerSpy.mockRestore();
    });

    it('removes visibilitychange event listener on cleanup', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const cleanup = setupVisibilityChangeListener();
      cleanup();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function)
      );

      removeEventListenerSpy.mockRestore();
    });

    it('checks pending navigation when visibility changes to visible', async () => {
      vi.mocked(detectPlatformAsync).mockResolvedValue('tauri-android');
      vi.mocked(invoke).mockResolvedValue({ feed_id: null });

      // Setup listener
      setupVisibilityChangeListener();

      // Simulate visibility change to visible
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));

      // Allow async operations to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(invoke).toHaveBeenCalledWith('get_pending_navigation');
    });

    it('does not check pending navigation when visibility changes to hidden', async () => {
      vi.mocked(detectPlatformAsync).mockResolvedValue('tauri-android');

      // Setup listener
      setupVisibilityChangeListener();

      // Simulate visibility change to hidden
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));

      // Allow async operations to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(invoke).not.toHaveBeenCalled();
    });
  });
});
