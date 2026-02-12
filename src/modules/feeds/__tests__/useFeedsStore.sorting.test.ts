/**
 * FEAT-062: Feed Sorting Unit Tests
 *
 * Tests that feeds are sorted by blockIndex (blockchain-canonical ordering)
 * instead of updatedAt (local timestamps):
 * - F2-001: Sort feeds by blockIndex descending
 * - F2-004: Personal feed pinned at position 0
 * - F2-006: Deterministic ordering across devices
 * - hasPendingMessages boost
 * - Edge cases (undefined blockIndex, equal blockIndex, empty/single)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useFeedsStore } from '../useFeedsStore';
import type { Feed } from '@/types';

/** Helper to create a test feed with sensible defaults */
function createTestFeed(overrides: Partial<Feed> = {}): Feed {
  return {
    id: `feed-${Math.random().toString(36).substring(7)}`,
    type: 'chat',
    name: 'Test Feed',
    participants: ['user-1', 'user-2'],
    unreadCount: 0,
    createdAt: 1000,
    updatedAt: 1000,
    blockIndex: 0,
    ...overrides,
  };
}

describe('FEAT-062: Feed Sorting (blockIndex-based)', () => {
  beforeEach(() => {
    useFeedsStore.getState().reset();
  });

  describe('F2-001: Sort feeds by blockIndex descending', () => {
    it('should sort feeds by blockIndex descending, not updatedAt', () => {
      // Arrange: feeds where updatedAt would give different order than blockIndex
      const feeds: Feed[] = [
        createTestFeed({ id: 'feed-1', blockIndex: 500, updatedAt: 3000 }),
        createTestFeed({ id: 'feed-2', blockIndex: 800, updatedAt: 1000 }),
        createTestFeed({ id: 'feed-3', blockIndex: 300, updatedAt: 5000 }),
      ];

      // Act
      useFeedsStore.getState().setFeeds(feeds);

      // Assert: ordered by blockIndex descending (800, 500, 300)
      const sorted = useFeedsStore.getState().feeds;
      expect(sorted.map((f) => f.id)).toEqual(['feed-2', 'feed-1', 'feed-3']);
    });

    it('should ignore updatedAt values when sorting', () => {
      // Arrange: feed-3 has highest updatedAt but lowest blockIndex
      const feeds: Feed[] = [
        createTestFeed({ id: 'feed-A', blockIndex: 100, updatedAt: 9999 }),
        createTestFeed({ id: 'feed-B', blockIndex: 200, updatedAt: 1 }),
      ];

      // Act
      useFeedsStore.getState().setFeeds(feeds);

      // Assert: blockIndex wins over updatedAt
      const sorted = useFeedsStore.getState().feeds;
      expect(sorted[0].id).toBe('feed-B');
      expect(sorted[1].id).toBe('feed-A');
    });
  });

  describe('F2-004: Personal feed pinned at top', () => {
    it('should always place personal feed at position 0', () => {
      // Arrange: personal feed has lowest blockIndex
      const feeds: Feed[] = [
        createTestFeed({ id: 'chat-1', type: 'chat', blockIndex: 900 }),
        createTestFeed({ id: 'personal', type: 'personal', blockIndex: 100 }),
        createTestFeed({ id: 'chat-2', type: 'chat', blockIndex: 800 }),
      ];

      // Act
      useFeedsStore.getState().setFeeds(feeds);

      // Assert
      const sorted = useFeedsStore.getState().feeds;
      expect(sorted[0].id).toBe('personal');
      expect(sorted[0].type).toBe('personal');
    });

    it('should place personal feed first even with blockIndex 0', () => {
      // Arrange
      const feeds: Feed[] = [
        createTestFeed({ id: 'chat-1', type: 'chat', blockIndex: 500 }),
        createTestFeed({ id: 'personal', type: 'personal', blockIndex: 0 }),
      ];

      // Act
      useFeedsStore.getState().setFeeds(feeds);

      // Assert
      const sorted = useFeedsStore.getState().feeds;
      expect(sorted[0].id).toBe('personal');
    });
  });

  describe('F2-006: Deterministic ordering across devices', () => {
    it('should produce identical order regardless of updatedAt values', () => {
      // Arrange: two "devices" with same blockIndexes but different local timestamps
      const device1Feeds: Feed[] = [
        createTestFeed({ id: 'feed-A', blockIndex: 300, updatedAt: 1000 }),
        createTestFeed({ id: 'feed-B', blockIndex: 500, updatedAt: 2000 }),
        createTestFeed({ id: 'feed-C', blockIndex: 100, updatedAt: 3000 }),
      ];
      const device2Feeds: Feed[] = [
        createTestFeed({ id: 'feed-A', blockIndex: 300, updatedAt: 9000 }),
        createTestFeed({ id: 'feed-B', blockIndex: 500, updatedAt: 100 }),
        createTestFeed({ id: 'feed-C', blockIndex: 100, updatedAt: 5000 }),
      ];

      // Act: simulate sorting on both devices
      useFeedsStore.getState().setFeeds(device1Feeds);
      const sorted1 = useFeedsStore.getState().feeds.map((f) => f.id);

      useFeedsStore.getState().reset();
      useFeedsStore.getState().setFeeds(device2Feeds);
      const sorted2 = useFeedsStore.getState().feeds.map((f) => f.id);

      // Assert: identical ordering
      expect(sorted1).toEqual(sorted2);
      expect(sorted1).toEqual(['feed-B', 'feed-A', 'feed-C']);
    });
  });

  describe('hasPendingMessages boost', () => {
    it('should sort feeds with pending messages above non-pending', () => {
      // Arrange
      const feeds: Feed[] = [
        createTestFeed({ id: 'feed-A', blockIndex: 800 }),
        createTestFeed({ id: 'feed-B', blockIndex: 400, hasPendingMessages: true }),
      ];

      // Act
      useFeedsStore.getState().setFeeds(feeds);

      // Assert: feed-B (pending) above feed-A (not pending)
      const sorted = useFeedsStore.getState().feeds;
      expect(sorted[0].id).toBe('feed-B');
      expect(sorted[1].id).toBe('feed-A');
    });

    it('should sort pending feeds by blockIndex among themselves', () => {
      // Arrange
      const feeds: Feed[] = [
        createTestFeed({ id: 'feed-A', blockIndex: 600, hasPendingMessages: true }),
        createTestFeed({ id: 'feed-B', blockIndex: 400, hasPendingMessages: true }),
      ];

      // Act
      useFeedsStore.getState().setFeeds(feeds);

      // Assert: higher blockIndex first among pending
      const sorted = useFeedsStore.getState().feeds;
      expect(sorted[0].id).toBe('feed-A');
      expect(sorted[1].id).toBe('feed-B');
    });

    it('should place personal feed above pending feeds', () => {
      // Arrange
      const feeds: Feed[] = [
        createTestFeed({ id: 'pending-feed', type: 'chat', blockIndex: 999, hasPendingMessages: true }),
        createTestFeed({ id: 'personal', type: 'personal', blockIndex: 1 }),
      ];

      // Act
      useFeedsStore.getState().setFeeds(feeds);

      // Assert: personal always first
      const sorted = useFeedsStore.getState().feeds;
      expect(sorted[0].id).toBe('personal');
      expect(sorted[1].id).toBe('pending-feed');
    });
  });

  describe('Edge cases', () => {
    it('should treat undefined blockIndex as 0', () => {
      // Arrange
      const feeds: Feed[] = [
        createTestFeed({ id: 'feed-no-block', blockIndex: undefined }),
        createTestFeed({ id: 'feed-with-block', blockIndex: 100 }),
      ];

      // Act
      useFeedsStore.getState().setFeeds(feeds);

      // Assert
      const sorted = useFeedsStore.getState().feeds;
      expect(sorted[0].id).toBe('feed-with-block');
      expect(sorted[1].id).toBe('feed-no-block');
    });

    it('should maintain stable order for equal blockIndex', () => {
      // Arrange: feeds with same blockIndex
      const feeds: Feed[] = [
        createTestFeed({ id: 'feed-X', blockIndex: 500 }),
        createTestFeed({ id: 'feed-Y', blockIndex: 500 }),
      ];

      // Act
      useFeedsStore.getState().setFeeds(feeds);

      // Assert: order is consistent (not random)
      const sorted = useFeedsStore.getState().feeds;
      expect(sorted).toHaveLength(2);
      // Both have same blockIndex, order should be stable (input order preserved by sort)
      expect(sorted[0].id).toBe('feed-X');
      expect(sorted[1].id).toBe('feed-Y');
    });

    it('should handle empty feeds array', () => {
      // Act
      useFeedsStore.getState().setFeeds([]);

      // Assert
      expect(useFeedsStore.getState().feeds).toEqual([]);
    });

    it('should handle single feed', () => {
      // Arrange
      const feeds: Feed[] = [createTestFeed({ id: 'only-feed', blockIndex: 42 })];

      // Act
      useFeedsStore.getState().setFeeds(feeds);

      // Assert
      const sorted = useFeedsStore.getState().feeds;
      expect(sorted).toHaveLength(1);
      expect(sorted[0].id).toBe('only-feed');
    });
  });
});
