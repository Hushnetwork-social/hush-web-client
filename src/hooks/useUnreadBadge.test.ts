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
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUnreadBadge, UNREAD_BADGE_CONSTANTS } from './useUnreadBadge';

// Mock the feeds store
const mockGetTotalUnreadCount = vi.fn();

vi.mock('@/modules/feeds', () => ({
  useFeedsStore: (selector: (state: { getTotalUnreadCount: () => number }) => number) => {
    return selector({ getTotalUnreadCount: mockGetTotalUnreadCount });
  },
}));

// Mock platform detection - default to browser
vi.mock('@/lib/platform', () => ({
  detectPlatform: vi.fn(() => 'browser'),
}));

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
