/**
 * useUnreadBadge Hook Tests
 *
 * Tests for:
 * 1. Tab title updates when unread count changes
 * 2. Tab title format is correct "(N) Hush Feeds"
 * 3. Flashing interval alternates title correctly
 * 4. Title restores when count becomes 0
 * 5. Interval is cleaned up on unmount
 * 6. Platform detection for browser
 * 7. Badge icon path generation (getBadgeIconPath)
 * 8. Tauri overlay integration
 * 9. PWA Badging API integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUnreadBadge, UNREAD_BADGE_CONSTANTS, getBadgeIconPath, isBadgingApiSupported } from './useUnreadBadge';

// Mock unread count - controls what the selector returns
let mockUnreadCount = 0;

vi.mock('@/modules/feeds', () => ({
  useFeedsStore: (selector: (state: { feeds: Array<{ unreadCount?: number }> }) => number) => {
    // Create mock feeds array that will produce the desired total
    const mockFeeds = mockUnreadCount > 0 ? [{ unreadCount: mockUnreadCount }] : [];
    return selector({ feeds: mockFeeds });
  },
}));

// Helper to set mock unread count (replaces mockGetTotalUnreadCount.mockReturnValue)
const mockGetTotalUnreadCount = {
  mockReturnValue: (value: number) => {
    mockUnreadCount = value;
  },
};

// Mock platform detection - default to browser
vi.mock('@/lib/platform', () => ({
  detectPlatform: vi.fn(() => 'browser'),
}));

// Import the mocked module to get a reference to the mock
import { detectPlatform as mockDetectPlatformImport } from '@/lib/platform';
const mockDetectPlatform = vi.mocked(mockDetectPlatformImport);

describe('useUnreadBadge', () => {
  const { BASE_TITLE, FULL_TITLE, FLASH_INTERVAL_MS } = UNREAD_BADGE_CONSTANTS;

  beforeEach(() => {
    vi.useFakeTimers();
    // Reset document title
    document.title = FULL_TITLE;
    // Reset mock to return 0 by default
    mockGetTotalUnreadCount.mockReturnValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    document.title = FULL_TITLE;
  });

  describe('Initial State', () => {
    it('should not change title when unread count is 0', () => {
      mockGetTotalUnreadCount.mockReturnValue(0);

      renderHook(() => useUnreadBadge());

      expect(document.title).toBe(FULL_TITLE);
    });
  });

  describe('Title Updates', () => {
    it('should update title when unread count is greater than 0', () => {
      mockGetTotalUnreadCount.mockReturnValue(5);

      renderHook(() => useUnreadBadge());

      expect(document.title).toBe('(5) Hush Feeds');
    });

    it('should use correct format "(N) Hush Feeds"', () => {
      mockGetTotalUnreadCount.mockReturnValue(3);

      renderHook(() => useUnreadBadge());

      expect(document.title).toContain('(3)');
      expect(document.title).toContain(BASE_TITLE);
    });

    it('should update title when unread count changes from 5 to 3', () => {
      mockGetTotalUnreadCount.mockReturnValue(5);
      const { rerender } = renderHook(() => useUnreadBadge());

      expect(document.title).toBe('(5) Hush Feeds');

      // Simulate count change
      mockGetTotalUnreadCount.mockReturnValue(3);
      rerender();

      // After rerender, the title should update
      expect(document.title).toBe('(3) Hush Feeds');
    });

    it('should handle large unread counts', () => {
      mockGetTotalUnreadCount.mockReturnValue(99);

      renderHook(() => useUnreadBadge());

      expect(document.title).toBe('(99) Hush Feeds');
    });

    it('should handle count of 1', () => {
      mockGetTotalUnreadCount.mockReturnValue(1);

      renderHook(() => useUnreadBadge());

      expect(document.title).toBe('(1) Hush Feeds');
    });
  });

  describe('Flashing Behavior', () => {
    it('should alternate title after flash interval', () => {
      mockGetTotalUnreadCount.mockReturnValue(5);

      renderHook(() => useUnreadBadge());

      // Initial state shows count
      expect(document.title).toBe('(5) Hush Feeds');

      // After one interval, title should show without count
      act(() => {
        vi.advanceTimersByTime(FLASH_INTERVAL_MS);
      });

      expect(document.title).toBe(BASE_TITLE);

      // After another interval, title should show count again
      act(() => {
        vi.advanceTimersByTime(FLASH_INTERVAL_MS);
      });

      expect(document.title).toBe('(5) Hush Feeds');
    });

    it('should continue flashing every 2 seconds', () => {
      mockGetTotalUnreadCount.mockReturnValue(3);

      renderHook(() => useUnreadBadge());

      // Initial
      expect(document.title).toBe('(3) Hush Feeds');

      // After 2s
      act(() => {
        vi.advanceTimersByTime(FLASH_INTERVAL_MS);
      });
      expect(document.title).toBe(BASE_TITLE);

      // After 4s
      act(() => {
        vi.advanceTimersByTime(FLASH_INTERVAL_MS);
      });
      expect(document.title).toBe('(3) Hush Feeds');

      // After 6s
      act(() => {
        vi.advanceTimersByTime(FLASH_INTERVAL_MS);
      });
      expect(document.title).toBe(BASE_TITLE);
    });

    it('should not flash before 2 seconds', () => {
      mockGetTotalUnreadCount.mockReturnValue(5);

      renderHook(() => useUnreadBadge());

      expect(document.title).toBe('(5) Hush Feeds');

      // Advance less than the interval
      act(() => {
        vi.advanceTimersByTime(FLASH_INTERVAL_MS - 100);
      });

      // Should still show the count
      expect(document.title).toBe('(5) Hush Feeds');
    });
  });

  describe('Title Restoration', () => {
    it('should restore title to original when count becomes 0', () => {
      mockGetTotalUnreadCount.mockReturnValue(5);
      const { rerender } = renderHook(() => useUnreadBadge());

      expect(document.title).toBe('(5) Hush Feeds');

      // Count becomes 0
      mockGetTotalUnreadCount.mockReturnValue(0);
      rerender();

      expect(document.title).toBe(FULL_TITLE);
    });

    it('should stop flashing when count becomes 0', () => {
      mockGetTotalUnreadCount.mockReturnValue(5);
      const { rerender } = renderHook(() => useUnreadBadge());

      // Verify flashing is working
      act(() => {
        vi.advanceTimersByTime(FLASH_INTERVAL_MS);
      });
      expect(document.title).toBe(BASE_TITLE);

      // Count becomes 0
      mockGetTotalUnreadCount.mockReturnValue(0);
      rerender();

      expect(document.title).toBe(FULL_TITLE);

      // Advance time - should not change
      act(() => {
        vi.advanceTimersByTime(FLASH_INTERVAL_MS);
      });
      expect(document.title).toBe(FULL_TITLE);
    });
  });

  describe('Cleanup', () => {
    it('should restore title on unmount', () => {
      mockGetTotalUnreadCount.mockReturnValue(5);
      const { unmount } = renderHook(() => useUnreadBadge());

      expect(document.title).toBe('(5) Hush Feeds');

      unmount();

      expect(document.title).toBe(FULL_TITLE);
    });

    it('should clear interval on unmount', () => {
      mockGetTotalUnreadCount.mockReturnValue(5);
      const { unmount } = renderHook(() => useUnreadBadge());

      // Verify flashing is working
      act(() => {
        vi.advanceTimersByTime(FLASH_INTERVAL_MS);
      });
      expect(document.title).toBe(BASE_TITLE);

      unmount();

      // After unmount, advancing time should not change the title
      // (because interval was cleared)
      document.title = 'Test Title';
      act(() => {
        vi.advanceTimersByTime(FLASH_INTERVAL_MS);
      });
      expect(document.title).toBe('Test Title');
    });

    it('should clear interval when count changes', () => {
      mockGetTotalUnreadCount.mockReturnValue(5);
      const { rerender } = renderHook(() => useUnreadBadge());

      // Start flashing
      act(() => {
        vi.advanceTimersByTime(FLASH_INTERVAL_MS);
      });
      expect(document.title).toBe(BASE_TITLE);

      // Change count - should reset flashing
      mockGetTotalUnreadCount.mockReturnValue(10);
      rerender();

      // After count change, title should show new count immediately
      expect(document.title).toBe('(10) Hush Feeds');

      // Flash should restart from the new count
      act(() => {
        vi.advanceTimersByTime(FLASH_INTERVAL_MS);
      });
      expect(document.title).toBe(BASE_TITLE);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid count changes', () => {
      mockGetTotalUnreadCount.mockReturnValue(1);
      const { rerender } = renderHook(() => useUnreadBadge());

      expect(document.title).toBe('(1) Hush Feeds');

      // Rapid changes
      mockGetTotalUnreadCount.mockReturnValue(2);
      rerender();
      mockGetTotalUnreadCount.mockReturnValue(3);
      rerender();
      mockGetTotalUnreadCount.mockReturnValue(4);
      rerender();

      expect(document.title).toBe('(4) Hush Feeds');
    });

    it('should handle count going from 0 to positive', () => {
      mockGetTotalUnreadCount.mockReturnValue(0);
      const { rerender } = renderHook(() => useUnreadBadge());

      expect(document.title).toBe(FULL_TITLE);

      mockGetTotalUnreadCount.mockReturnValue(5);
      rerender();

      expect(document.title).toBe('(5) Hush Feeds');
    });
  });
});

describe('getBadgeIconPath', () => {
  describe('Valid counts (1-9)', () => {
    it('should return correct path for count 1', () => {
      expect(getBadgeIconPath(1)).toBe('/icons/badge-1.png');
    });

    it('should return correct path for count 5', () => {
      expect(getBadgeIconPath(5)).toBe('/icons/badge-5.png');
    });

    it('should return correct path for count 9', () => {
      expect(getBadgeIconPath(9)).toBe('/icons/badge-9.png');
    });

    it('should return correct path for each count 1-9', () => {
      for (let i = 1; i <= 9; i++) {
        expect(getBadgeIconPath(i)).toBe(`/icons/badge-${i}.png`);
      }
    });
  });

  describe('Count > 9 (9+ badge)', () => {
    it('should return 9plus path for count 10', () => {
      expect(getBadgeIconPath(10)).toBe('/icons/badge-9plus.png');
    });

    it('should return 9plus path for count 15', () => {
      expect(getBadgeIconPath(15)).toBe('/icons/badge-9plus.png');
    });

    it('should return 9plus path for count 99', () => {
      expect(getBadgeIconPath(99)).toBe('/icons/badge-9plus.png');
    });

    it('should return 9plus path for very large count', () => {
      expect(getBadgeIconPath(1000)).toBe('/icons/badge-9plus.png');
    });
  });

  describe('Zero and negative counts', () => {
    it('should return null for count 0', () => {
      expect(getBadgeIconPath(0)).toBeNull();
    });

    it('should return null for negative count', () => {
      expect(getBadgeIconPath(-1)).toBeNull();
    });

    it('should return null for negative large count', () => {
      expect(getBadgeIconPath(-100)).toBeNull();
    });
  });
});

describe('Tauri Platform Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.title = UNREAD_BADGE_CONSTANTS.FULL_TITLE;
    mockGetTotalUnreadCount.mockReturnValue(0);
    // Reset to browser by default
    mockDetectPlatform.mockReturnValue('browser');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    document.title = UNREAD_BADGE_CONSTANTS.FULL_TITLE;
  });

  it('should still update browser title when platform is tauri', () => {
    mockDetectPlatform.mockReturnValue('tauri');
    mockGetTotalUnreadCount.mockReturnValue(5);

    renderHook(() => useUnreadBadge());

    // Browser title should be updated as secondary indicator
    expect(document.title).toBe('(5) Hush Feeds');
  });

  it('should still update browser title when platform is mobile-pwa', () => {
    mockDetectPlatform.mockReturnValue('mobile-pwa');
    mockGetTotalUnreadCount.mockReturnValue(3);

    renderHook(() => useUnreadBadge());

    // Browser title should be updated as fallback
    expect(document.title).toBe('(3) Hush Feeds');
  });

  it('should restore title when count becomes 0 on tauri', () => {
    mockDetectPlatform.mockReturnValue('tauri');
    mockGetTotalUnreadCount.mockReturnValue(5);
    const { rerender } = renderHook(() => useUnreadBadge());

    expect(document.title).toBe('(5) Hush Feeds');

    mockGetTotalUnreadCount.mockReturnValue(0);
    rerender();

    expect(document.title).toBe(UNREAD_BADGE_CONSTANTS.FULL_TITLE);
  });
});

describe('isBadgingApiSupported', () => {
  const originalNavigator = global.navigator;

  afterEach(() => {
    // Restore original navigator
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
    });
  });

  it('should return false when navigator is undefined', () => {
    // Temporarily make navigator undefined
    Object.defineProperty(global, 'navigator', {
      value: undefined,
      writable: true,
    });

    expect(isBadgingApiSupported()).toBe(false);
  });

  it('should return false when setAppBadge is not in navigator', () => {
    // Mock navigator without setAppBadge
    Object.defineProperty(global, 'navigator', {
      value: { userAgent: 'test' },
      writable: true,
    });

    expect(isBadgingApiSupported()).toBe(false);
  });

  it('should return true when setAppBadge is in navigator', () => {
    // Mock navigator with setAppBadge
    Object.defineProperty(global, 'navigator', {
      value: {
        userAgent: 'test',
        setAppBadge: vi.fn(),
      },
      writable: true,
    });

    expect(isBadgingApiSupported()).toBe(true);
  });
});

describe('PWA Badge Integration', () => {
  let mockSetAppBadge: ReturnType<typeof vi.fn>;
  let mockClearAppBadge: ReturnType<typeof vi.fn>;
  const originalNavigator = global.navigator;

  beforeEach(() => {
    vi.useFakeTimers();
    document.title = UNREAD_BADGE_CONSTANTS.FULL_TITLE;
    mockGetTotalUnreadCount.mockReturnValue(0);
    mockDetectPlatform.mockReturnValue('mobile-pwa');

    // Setup navigator mock with Badging API
    mockSetAppBadge = vi.fn().mockResolvedValue(undefined);
    mockClearAppBadge = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        setAppBadge: mockSetAppBadge,
        clearAppBadge: mockClearAppBadge,
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    document.title = UNREAD_BADGE_CONSTANTS.FULL_TITLE;

    // Restore original navigator
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it('should call setAppBadge when platform is mobile-pwa and count > 0', async () => {
    mockGetTotalUnreadCount.mockReturnValue(5);

    renderHook(() => useUnreadBadge());

    // Allow microtasks to complete (async badge update)
    await Promise.resolve();
    await Promise.resolve();

    expect(mockSetAppBadge).toHaveBeenCalledWith(5);
  });

  it('should call setAppBadge with correct count', async () => {
    mockGetTotalUnreadCount.mockReturnValue(12);

    renderHook(() => useUnreadBadge());

    // Allow microtasks to complete
    await Promise.resolve();
    await Promise.resolve();

    expect(mockSetAppBadge).toHaveBeenCalledWith(12);
  });

  it('should call clearAppBadge when count becomes 0', async () => {
    mockGetTotalUnreadCount.mockReturnValue(5);
    const { rerender } = renderHook(() => useUnreadBadge());

    // Allow initial badge to be set
    await Promise.resolve();
    await Promise.resolve();

    mockGetTotalUnreadCount.mockReturnValue(0);
    rerender();

    // Allow clearAppBadge to be called
    await Promise.resolve();
    await Promise.resolve();

    expect(mockClearAppBadge).toHaveBeenCalled();
  });

  it('should still update browser title as fallback on mobile-pwa', () => {
    mockGetTotalUnreadCount.mockReturnValue(3);

    renderHook(() => useUnreadBadge());

    expect(document.title).toBe('(3) Hush Feeds');
  });

  it('should not throw when Badging API is not available', () => {
    // Remove badging API
    Object.defineProperty(global, 'navigator', {
      value: { userAgent: 'test' },
      writable: true,
      configurable: true,
    });

    mockGetTotalUnreadCount.mockReturnValue(5);

    // Should not throw
    expect(() => {
      renderHook(() => useUnreadBadge());
    }).not.toThrow();
  });

  it('should not call setAppBadge when platform is browser', async () => {
    mockDetectPlatform.mockReturnValue('browser');
    mockGetTotalUnreadCount.mockReturnValue(5);

    renderHook(() => useUnreadBadge());

    // Allow microtasks to complete
    await Promise.resolve();
    await Promise.resolve();

    // setAppBadge should NOT be called for browser platform
    expect(mockSetAppBadge).not.toHaveBeenCalled();
  });

  it('should restore title when count becomes 0 on mobile-pwa', () => {
    mockGetTotalUnreadCount.mockReturnValue(5);
    const { rerender } = renderHook(() => useUnreadBadge());

    expect(document.title).toBe('(5) Hush Feeds');

    mockGetTotalUnreadCount.mockReturnValue(0);
    rerender();

    expect(document.title).toBe(UNREAD_BADGE_CONSTANTS.FULL_TITLE);
  });
});
