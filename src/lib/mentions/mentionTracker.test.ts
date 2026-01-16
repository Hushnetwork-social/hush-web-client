/**
 * Mention Tracker Tests
 *
 * Comprehensive tests for mention tracking utility functions.
 * Tests localStorage persistence, duplicate prevention, and cleanup logic.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  trackMention,
  markMentionRead,
  getUnreadMentions,
  getUnreadCount,
  hasUnreadMentions,
  clearMentions,
  getAllFeedsWithMentions,
  checkForDataLoss,
  clearDataLossFlag,
  type MentionTrackingData,
} from './mentionTracker';

// Storage keys (must match implementation)
const STORAGE_KEY = 'hush_mention_tracking';
const INIT_FLAG_KEY = 'hush_mention_tracking_init';

describe('mentionTracker', () => {
  // Simulate real localStorage storage
  let storage: Record<string, string>;

  beforeEach(() => {
    // Create fresh in-memory storage for each test
    storage = {};

    // Mock localStorage methods to use in-memory storage
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
      return storage[key] ?? null;
    });

    vi.mocked(localStorage.setItem).mockImplementation(
      (key: string, value: string) => {
        storage[key] = value;
      }
    );

    vi.mocked(localStorage.removeItem).mockImplementation((key: string) => {
      delete storage[key];
    });

    vi.mocked(localStorage.clear).mockImplementation(() => {
      storage = {};
    });
  });

  describe('trackMention', () => {
    it('adds mention to empty feed', () => {
      trackMention('feed1', 'msg1');

      const mentions = getUnreadMentions('feed1');
      expect(mentions).toEqual(['msg1']);
      expect(getUnreadCount('feed1')).toBe(1);
    });

    it('adds multiple mentions to same feed', () => {
      trackMention('feed1', 'msg1');
      trackMention('feed1', 'msg2');
      trackMention('feed1', 'msg3');

      const mentions = getUnreadMentions('feed1');
      expect(mentions).toEqual(['msg1', 'msg2', 'msg3']);
      expect(getUnreadCount('feed1')).toBe(3);
    });

    it('prevents duplicate message IDs', () => {
      trackMention('feed1', 'msg1');
      trackMention('feed1', 'msg1');
      trackMention('feed1', 'msg1');

      const mentions = getUnreadMentions('feed1');
      expect(mentions).toEqual(['msg1']);
      expect(getUnreadCount('feed1')).toBe(1);
    });

    it('tracks mentions for different feeds separately', () => {
      trackMention('feed1', 'msg1');
      trackMention('feed2', 'msg2');
      trackMention('feed1', 'msg3');

      expect(getUnreadMentions('feed1')).toEqual(['msg1', 'msg3']);
      expect(getUnreadMentions('feed2')).toEqual(['msg2']);
    });

    it('persists data to localStorage', () => {
      trackMention('feed1', 'msg1');

      const stored = storage[STORAGE_KEY];
      expect(stored).toBeDefined();

      const parsed = JSON.parse(stored) as MentionTrackingData;
      expect(parsed['feed1'].messageIds).toContain('msg1');
    });

    it('sets lastUpdated timestamp', () => {
      const before = Date.now();
      trackMention('feed1', 'msg1');
      const after = Date.now();

      const stored = storage[STORAGE_KEY];
      const parsed = JSON.parse(stored) as MentionTrackingData;

      expect(parsed['feed1'].lastUpdated).toBeGreaterThanOrEqual(before);
      expect(parsed['feed1'].lastUpdated).toBeLessThanOrEqual(after);
    });
  });

  describe('markMentionRead', () => {
    it('removes mention from tracking', () => {
      trackMention('feed1', 'msg1');
      trackMention('feed1', 'msg2');
      trackMention('feed1', 'msg3');

      markMentionRead('feed1', 'msg2');

      expect(getUnreadMentions('feed1')).toEqual(['msg1', 'msg3']);
    });

    it('handles marking non-existent message as read', () => {
      trackMention('feed1', 'msg1');

      // Should not throw
      markMentionRead('feed1', 'non-existent');

      expect(getUnreadMentions('feed1')).toEqual(['msg1']);
    });

    it('handles marking read for non-existent feed', () => {
      // Should not throw
      markMentionRead('non-existent-feed', 'msg1');

      expect(getUnreadMentions('non-existent-feed')).toEqual([]);
    });

    it('updates lastUpdated when marking read', () => {
      trackMention('feed1', 'msg1');
      trackMention('feed1', 'msg2');

      const before = Date.now();
      markMentionRead('feed1', 'msg1');

      const stored = storage[STORAGE_KEY];
      const parsed = JSON.parse(stored) as MentionTrackingData;

      expect(parsed['feed1'].lastUpdated).toBeGreaterThanOrEqual(before);
    });
  });

  describe('getUnreadMentions', () => {
    it('returns empty array for feed with no mentions', () => {
      expect(getUnreadMentions('non-existent')).toEqual([]);
    });

    it('returns mentions in order (oldest first)', () => {
      trackMention('feed1', 'msg1');
      trackMention('feed1', 'msg2');
      trackMention('feed1', 'msg3');

      const mentions = getUnreadMentions('feed1');
      expect(mentions).toEqual(['msg1', 'msg2', 'msg3']);
    });

    it('does not modify internal state', () => {
      trackMention('feed1', 'msg1');

      const mentions1 = getUnreadMentions('feed1');
      mentions1.push('modified');

      const mentions2 = getUnreadMentions('feed1');
      expect(mentions2).toEqual(['msg1']);
    });
  });

  describe('getUnreadCount', () => {
    it('returns 0 for feed with no mentions', () => {
      expect(getUnreadCount('non-existent')).toBe(0);
    });

    it('returns correct count', () => {
      trackMention('feed1', 'msg1');
      trackMention('feed1', 'msg2');
      trackMention('feed1', 'msg3');
      trackMention('feed1', 'msg4');
      trackMention('feed1', 'msg5');

      expect(getUnreadCount('feed1')).toBe(5);
    });
  });

  describe('hasUnreadMentions', () => {
    it('returns false for feed with no mentions', () => {
      expect(hasUnreadMentions('non-existent')).toBe(false);
    });

    it('returns true when feed has mentions', () => {
      trackMention('feed1', 'msg1');
      expect(hasUnreadMentions('feed1')).toBe(true);
    });

    it('returns false after all mentions cleared', () => {
      trackMention('feed1', 'msg1');
      clearMentions('feed1');
      expect(hasUnreadMentions('feed1')).toBe(false);
    });

    it('returns false after all mentions marked read', () => {
      trackMention('feed1', 'msg1');
      markMentionRead('feed1', 'msg1');
      expect(hasUnreadMentions('feed1')).toBe(false);
    });
  });

  describe('clearMentions', () => {
    it('removes all mentions for a feed', () => {
      trackMention('feed1', 'msg1');
      trackMention('feed1', 'msg2');
      trackMention('feed1', 'msg3');

      clearMentions('feed1');

      expect(getUnreadMentions('feed1')).toEqual([]);
      expect(hasUnreadMentions('feed1')).toBe(false);
    });

    it('does not affect other feeds', () => {
      trackMention('feed1', 'msg1');
      trackMention('feed2', 'msg2');

      clearMentions('feed1');

      expect(getUnreadMentions('feed1')).toEqual([]);
      expect(getUnreadMentions('feed2')).toEqual(['msg2']);
    });

    it('handles clearing non-existent feed', () => {
      // Should not throw
      clearMentions('non-existent');

      expect(getUnreadMentions('non-existent')).toEqual([]);
    });

    it('saves empty object when all mentions cleared', () => {
      trackMention('feed1', 'msg1');
      clearMentions('feed1');

      // Storage should contain empty object (not removed) to distinguish from data loss
      expect(storage[STORAGE_KEY]).toBe('{}');
    });
  });

  describe('getAllFeedsWithMentions', () => {
    it('returns empty array when no mentions', () => {
      expect(getAllFeedsWithMentions()).toEqual([]);
    });

    it('returns all feed IDs with mentions', () => {
      trackMention('feed1', 'msg1');
      trackMention('feed2', 'msg2');
      trackMention('feed3', 'msg3');

      const feeds = getAllFeedsWithMentions();
      expect(feeds).toContain('feed1');
      expect(feeds).toContain('feed2');
      expect(feeds).toContain('feed3');
      expect(feeds).toHaveLength(3);
    });

    it('excludes feeds with no mentions', () => {
      trackMention('feed1', 'msg1');
      trackMention('feed2', 'msg2');
      clearMentions('feed2');

      const feeds = getAllFeedsWithMentions();
      expect(feeds).toEqual(['feed1']);
    });

    it('excludes feeds after all mentions read', () => {
      trackMention('feed1', 'msg1');
      trackMention('feed2', 'msg2');
      markMentionRead('feed2', 'msg2');

      const feeds = getAllFeedsWithMentions();
      expect(feeds).toEqual(['feed1']);
    });
  });

  describe('checkForDataLoss', () => {
    it('returns false on first use (not initialized)', () => {
      expect(checkForDataLoss()).toBe(false);
    });

    it('returns false when data exists', () => {
      trackMention('feed1', 'msg1');
      expect(checkForDataLoss()).toBe(false);
    });

    it('returns true when previously had data but now empty', () => {
      // Initialize with data
      trackMention('feed1', 'msg1');

      // Simulate data loss by clearing storage but keeping init flag
      delete storage[STORAGE_KEY];

      expect(checkForDataLoss()).toBe(true);
    });

    it('returns false after clearing all mentions normally', () => {
      trackMention('feed1', 'msg1');
      clearMentions('feed1');

      // Normal clear sets init flag, but storage is legitimately empty
      // This should NOT be detected as data loss
      expect(checkForDataLoss()).toBe(false);
    });
  });

  describe('clearDataLossFlag', () => {
    it('re-initializes tracking', () => {
      // Simulate data loss scenario
      trackMention('feed1', 'msg1');
      delete storage[STORAGE_KEY];

      expect(checkForDataLoss()).toBe(true);

      clearDataLossFlag();

      // After clearing flag, future data loss can be detected again
      expect(storage[INIT_FLAG_KEY]).toBe('true');
    });
  });

  describe('localStorage unavailable', () => {
    it('handles gracefully when localStorage throws', () => {
      // Mock localStorage to throw
      vi.mocked(localStorage.setItem).mockImplementation(() => {
        throw new Error('localStorage unavailable');
      });
      vi.mocked(localStorage.getItem).mockImplementation(() => {
        throw new Error('localStorage unavailable');
      });

      // Should not throw
      expect(() => trackMention('feed1', 'msg1')).not.toThrow();
      expect(() => markMentionRead('feed1', 'msg1')).not.toThrow();
      expect(() => clearMentions('feed1')).not.toThrow();

      // Should return empty/default values
      expect(getUnreadMentions('feed1')).toEqual([]);
      expect(getUnreadCount('feed1')).toBe(0);
      expect(hasUnreadMentions('feed1')).toBe(false);
      expect(getAllFeedsWithMentions()).toEqual([]);
    });
  });

  describe('persistence across reads', () => {
    it('survives multiple read cycles', () => {
      trackMention('feed1', 'msg1');
      trackMention('feed1', 'msg2');

      // Simulate page refresh by re-reading
      expect(getUnreadMentions('feed1')).toEqual(['msg1', 'msg2']);
      expect(getUnreadMentions('feed1')).toEqual(['msg1', 'msg2']);
      expect(getUnreadMentions('feed1')).toEqual(['msg1', 'msg2']);
    });

    it('maintains order after partial reads', () => {
      trackMention('feed1', 'msg1');
      trackMention('feed1', 'msg2');
      trackMention('feed1', 'msg3');

      markMentionRead('feed1', 'msg2');

      expect(getUnreadMentions('feed1')).toEqual(['msg1', 'msg3']);
    });
  });

  describe('edge cases', () => {
    it('handles empty string feedId', () => {
      trackMention('', 'msg1');
      expect(getUnreadMentions('')).toEqual(['msg1']);
    });

    it('handles empty string messageId', () => {
      trackMention('feed1', '');
      expect(getUnreadMentions('feed1')).toEqual(['']);
    });

    it('handles special characters in feedId', () => {
      trackMention('feed/with/slashes', 'msg1');
      trackMention('feed-with-dashes', 'msg2');
      trackMention('feed.with.dots', 'msg3');

      expect(getUnreadMentions('feed/with/slashes')).toEqual(['msg1']);
      expect(getUnreadMentions('feed-with-dashes')).toEqual(['msg2']);
      expect(getUnreadMentions('feed.with.dots')).toEqual(['msg3']);
    });

    it('handles very long message IDs', () => {
      const longId = 'a'.repeat(1000);
      trackMention('feed1', longId);
      expect(getUnreadMentions('feed1')).toEqual([longId]);
    });

    it('handles many mentions in one feed', () => {
      for (let i = 0; i < 100; i++) {
        trackMention('feed1', `msg${i}`);
      }

      expect(getUnreadCount('feed1')).toBe(100);
    });

    it('handles many feeds', () => {
      for (let i = 0; i < 50; i++) {
        trackMention(`feed${i}`, 'msg1');
      }

      expect(getAllFeedsWithMentions()).toHaveLength(50);
    });
  });
});
