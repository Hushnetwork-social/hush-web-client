/**
 * FEAT-063: Cross-Device Read Sync Unit Tests
 *
 * Tests that markFeedAsRead calculates remaining unreads from watermark:
 * - F3-003: Client calculates remaining unreads from upToBlockIndex
 * - F3-005: Max-wins watermark semantics
 * - F3-006: lastReadBlockIndex updated on event
 * - addMessages recalculation when lastReadBlockIndex is set
 * - Pending messages always count as unread
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useFeedsStore } from '../useFeedsStore';
import type { Feed, FeedMessage } from '@/types';

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

/** Helper to create a test message */
function createTestMessage(overrides: Partial<FeedMessage> = {}): FeedMessage {
  return {
    id: `msg-${Math.random().toString(36).substring(7)}`,
    feedId: 'feed-1',
    senderPublicKey: 'sender-key',
    content: 'Test message',
    timestamp: Date.now(),
    isConfirmed: true,
    ...overrides,
  };
}

describe('FEAT-063: Cross-Device Read Sync', () => {
  beforeEach(() => {
    useFeedsStore.getState().reset();
  });

  describe('F3-003: Client calculates remaining unreads from watermark', () => {
    it('should calculate remaining unreads after watermark', () => {
      // Arrange: feed with messages at blockIndex [700, 750, 800, 850, 900]
      const feed = createTestFeed({ id: 'feed-1', unreadCount: 5 });
      useFeedsStore.getState().setFeeds([feed]);
      useFeedsStore.getState().addMessages('feed-1', [
        createTestMessage({ id: 'msg-1', feedId: 'feed-1', blockHeight: 700, timestamp: 1 }),
        createTestMessage({ id: 'msg-2', feedId: 'feed-1', blockHeight: 750, timestamp: 2 }),
        createTestMessage({ id: 'msg-3', feedId: 'feed-1', blockHeight: 800, timestamp: 3 }),
        createTestMessage({ id: 'msg-4', feedId: 'feed-1', blockHeight: 850, timestamp: 4 }),
        createTestMessage({ id: 'msg-5', feedId: 'feed-1', blockHeight: 900, timestamp: 5 }),
      ]);

      // Act: mark as read up to block 800
      useFeedsStore.getState().markFeedAsRead('feed-1', 800);

      // Assert: 2 messages after block 800 (850, 900)
      const state = useFeedsStore.getState();
      const updatedFeed = state.feeds.find((f) => f.id === 'feed-1');
      expect(updatedFeed?.unreadCount).toBe(2);
    });

    it('should set unreadCount to 0 when watermark >= highest message', () => {
      // Arrange: messages up to block 800
      const feed = createTestFeed({ id: 'feed-1', unreadCount: 3 });
      useFeedsStore.getState().setFeeds([feed]);
      useFeedsStore.getState().addMessages('feed-1', [
        createTestMessage({ id: 'msg-1', feedId: 'feed-1', blockHeight: 700, timestamp: 1 }),
        createTestMessage({ id: 'msg-2', feedId: 'feed-1', blockHeight: 750, timestamp: 2 }),
        createTestMessage({ id: 'msg-3', feedId: 'feed-1', blockHeight: 800, timestamp: 3 }),
      ]);

      // Act: mark as read up to block 900 (beyond all messages)
      useFeedsStore.getState().markFeedAsRead('feed-1', 900);

      // Assert
      const updatedFeed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(updatedFeed?.unreadCount).toBe(0);
    });

    it('should set unreadCount to 0 when no local messages', () => {
      // Arrange: feed with no messages
      const feed = createTestFeed({ id: 'feed-1', unreadCount: 3 });
      useFeedsStore.getState().setFeeds([feed]);

      // Act: mark as read up to block 500
      useFeedsStore.getState().markFeedAsRead('feed-1', 500);

      // Assert: no error, unreadCount = 0
      const updatedFeed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(updatedFeed?.unreadCount).toBe(0);
    });

    it('should set unreadCount to 0 when no upToBlockIndex (backward compat)', () => {
      // Arrange
      const feed = createTestFeed({ id: 'feed-1', unreadCount: 5 });
      useFeedsStore.getState().setFeeds([feed]);

      // Act: mark as read without watermark (old behavior)
      useFeedsStore.getState().markFeedAsRead('feed-1');

      // Assert: blindly set to 0
      const updatedFeed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(updatedFeed?.unreadCount).toBe(0);
    });
  });

  describe('F3-005: Max-wins watermark semantics', () => {
    it('should update lastReadBlockIndex when higher watermark arrives', () => {
      // Arrange
      const feed = createTestFeed({ id: 'feed-1', lastReadBlockIndex: 800 });
      useFeedsStore.getState().setFeeds([feed]);

      // Act: higher watermark
      useFeedsStore.getState().markFeedAsRead('feed-1', 900);

      // Assert
      const updatedFeed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(updatedFeed?.lastReadBlockIndex).toBe(900);
    });

    it('should ignore lower watermark (no-op)', () => {
      // Arrange: feed already read up to 800, with 5 unreads
      const feed = createTestFeed({ id: 'feed-1', lastReadBlockIndex: 800, unreadCount: 5 });
      useFeedsStore.getState().setFeeds([feed]);

      // Act: stale event with lower watermark
      useFeedsStore.getState().markFeedAsRead('feed-1', 600);

      // Assert: nothing changed
      const updatedFeed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(updatedFeed?.lastReadBlockIndex).toBe(800);
      expect(updatedFeed?.unreadCount).toBe(5);
    });

    it('should ignore equal watermark (no-op)', () => {
      // Arrange
      const feed = createTestFeed({ id: 'feed-1', lastReadBlockIndex: 800, unreadCount: 3 });
      useFeedsStore.getState().setFeeds([feed]);

      // Act: same watermark
      useFeedsStore.getState().markFeedAsRead('feed-1', 800);

      // Assert: unchanged
      const updatedFeed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(updatedFeed?.lastReadBlockIndex).toBe(800);
      expect(updatedFeed?.unreadCount).toBe(3);
    });
  });

  describe('F3-006: lastReadBlockIndex updated on event', () => {
    it('should update lastReadBlockIndex from watermark', () => {
      // Arrange
      const feed = createTestFeed({ id: 'feed-1', lastReadBlockIndex: 500 });
      useFeedsStore.getState().setFeeds([feed]);

      // Act
      useFeedsStore.getState().markFeedAsRead('feed-1', 800);

      // Assert
      const updatedFeed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(updatedFeed?.lastReadBlockIndex).toBe(800);
    });

    it('should set lastReadBlockIndex from 0 when first watermark arrives', () => {
      // Arrange: feed with no previous lastReadBlockIndex
      const feed = createTestFeed({ id: 'feed-1' });
      useFeedsStore.getState().setFeeds([feed]);

      // Act
      useFeedsStore.getState().markFeedAsRead('feed-1', 500);

      // Assert
      const updatedFeed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(updatedFeed?.lastReadBlockIndex).toBe(500);
    });
  });

  describe('addMessages recalculation', () => {
    it('should recalculate unreads when messages arrive after lastReadBlockIndex is set', () => {
      // Arrange: feed with lastReadBlockIndex=800, no messages yet
      const feed = createTestFeed({ id: 'feed-1', lastReadBlockIndex: 800, unreadCount: 0 });
      useFeedsStore.getState().setFeeds([feed]);

      // Act: messages arrive via sync
      useFeedsStore.getState().addMessages('feed-1', [
        createTestMessage({ id: 'msg-1', feedId: 'feed-1', blockHeight: 750, timestamp: 1 }),
        createTestMessage({ id: 'msg-2', feedId: 'feed-1', blockHeight: 850, timestamp: 2 }),
        createTestMessage({ id: 'msg-3', feedId: 'feed-1', blockHeight: 900, timestamp: 3 }),
      ]);

      // Assert: 2 messages after block 800 (850, 900)
      const updatedFeed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(updatedFeed?.unreadCount).toBe(2);
    });

    it('should not recalculate when lastReadBlockIndex is 0', () => {
      // Arrange: feed without lastReadBlockIndex
      const feed = createTestFeed({ id: 'feed-1', unreadCount: 0 });
      useFeedsStore.getState().setFeeds([feed]);

      // Act: messages arrive
      useFeedsStore.getState().addMessages('feed-1', [
        createTestMessage({ id: 'msg-1', feedId: 'feed-1', blockHeight: 850, timestamp: 1 }),
      ]);

      // Assert: unreadCount not recalculated (no lastReadBlockIndex)
      const updatedFeed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(updatedFeed?.unreadCount).toBe(0);
    });
  });

  describe('Pending messages edge case', () => {
    it('should count pending messages (undefined blockHeight) as unread', () => {
      // Arrange
      const feed = createTestFeed({ id: 'feed-1' });
      useFeedsStore.getState().setFeeds([feed]);
      useFeedsStore.getState().addMessages('feed-1', [
        createTestMessage({ id: 'msg-1', feedId: 'feed-1', blockHeight: 700, timestamp: 1 }),
        createTestMessage({ id: 'msg-2', feedId: 'feed-1', blockHeight: undefined, isConfirmed: false, timestamp: 2 }),
      ]);

      // Act: mark as read up to block 800
      useFeedsStore.getState().markFeedAsRead('feed-1', 800);

      // Assert: pending message counts as unread
      const updatedFeed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(updatedFeed?.unreadCount).toBe(1);
    });
  });
});
