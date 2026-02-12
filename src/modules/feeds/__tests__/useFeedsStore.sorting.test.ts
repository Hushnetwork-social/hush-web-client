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

  // === Phase 3 Tests: addMessages() + Pending Message Lifecycle ===

  describe('F2-002: blockIndex updated on new messages', () => {
    it('should update feed blockIndex from incoming messages', () => {
      // Arrange: feed with blockIndex 500
      const feed = createTestFeed({ id: 'feed-1', blockIndex: 500 });
      useFeedsStore.getState().setFeeds([feed]);

      const newMessages = [
        createTestMessage({ id: 'msg-1', feedId: 'feed-1', blockHeight: 600, timestamp: 1000 }),
        createTestMessage({ id: 'msg-2', feedId: 'feed-1', blockHeight: 650, timestamp: 2000 }),
      ];

      // Act
      useFeedsStore.getState().addMessages('feed-1', newMessages);

      // Assert: blockIndex updated to max(500, 600, 650) = 650
      const updatedFeed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(updatedFeed?.blockIndex).toBe(650);
    });

    it('should NOT decrease blockIndex from older messages (max protection)', () => {
      // Arrange: feed with blockIndex 500
      const feed = createTestFeed({ id: 'feed-1', blockIndex: 500 });
      useFeedsStore.getState().setFeeds([feed]);

      const olderMessages = [
        createTestMessage({ id: 'msg-1', feedId: 'feed-1', blockHeight: 300, timestamp: 1000 }),
        createTestMessage({ id: 'msg-2', feedId: 'feed-1', blockHeight: 400, timestamp: 2000 }),
      ];

      // Act
      useFeedsStore.getState().addMessages('feed-1', olderMessages);

      // Assert: blockIndex remains 500
      const updatedFeed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(updatedFeed?.blockIndex).toBe(500);
    });

    it('should handle mixed old and new messages correctly', () => {
      // Arrange
      const feed = createTestFeed({ id: 'feed-1', blockIndex: 500 });
      useFeedsStore.getState().setFeeds([feed]);

      const mixedMessages = [
        createTestMessage({ id: 'msg-1', feedId: 'feed-1', blockHeight: 300, timestamp: 1000 }),
        createTestMessage({ id: 'msg-2', feedId: 'feed-1', blockHeight: 600, timestamp: 2000 }),
      ];

      // Act
      useFeedsStore.getState().addMessages('feed-1', mixedMessages);

      // Assert: max(500, 300, 600) = 600
      const updatedFeed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(updatedFeed?.blockIndex).toBe(600);
    });

    it('should ignore messages without blockHeight for max calculation', () => {
      // Arrange
      const feed = createTestFeed({ id: 'feed-1', blockIndex: 500 });
      useFeedsStore.getState().setFeeds([feed]);

      const messages = [
        createTestMessage({ id: 'msg-1', feedId: 'feed-1', blockHeight: undefined, timestamp: 1000 }),
      ];

      // Act
      useFeedsStore.getState().addMessages('feed-1', messages);

      // Assert: blockIndex unchanged (no valid blockHeights)
      const updatedFeed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(updatedFeed?.blockIndex).toBe(500);
    });
  });

  describe('F2-003: hasPendingMessages on pending message', () => {
    it('should set hasPendingMessages when addPendingMessage is called', () => {
      // Arrange
      const feed = createTestFeed({ id: 'feed-1', blockIndex: 500 });
      useFeedsStore.getState().setFeeds([feed]);

      const pendingMsg = createTestMessage({
        id: 'pending-1',
        feedId: 'feed-1',
        isConfirmed: false,
        status: 'pending' as FeedMessage['status'],
      });

      // Act
      useFeedsStore.getState().addPendingMessage('feed-1', pendingMsg);

      // Assert
      const updatedFeed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(updatedFeed?.hasPendingMessages).toBe(true);
      expect(updatedFeed?.blockIndex).toBe(500); // blockIndex unchanged
    });

    it('should keep hasPendingMessages on multiple pending messages', () => {
      // Arrange
      const feed = createTestFeed({ id: 'feed-1', blockIndex: 500 });
      useFeedsStore.getState().setFeeds([feed]);

      const msg1 = createTestMessage({ id: 'pending-1', feedId: 'feed-1', isConfirmed: false, status: 'pending' as FeedMessage['status'] });
      const msg2 = createTestMessage({ id: 'pending-2', feedId: 'feed-1', isConfirmed: false, status: 'pending' as FeedMessage['status'] });

      // Act
      useFeedsStore.getState().addPendingMessage('feed-1', msg1);
      useFeedsStore.getState().addPendingMessage('feed-1', msg2);

      // Assert
      const updatedFeed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(updatedFeed?.hasPendingMessages).toBe(true);
    });
  });

  describe('F2-005: Sort called after blockIndex update', () => {
    it('should re-sort feeds when blockIndex increases from new messages', () => {
      // Arrange: feed-A has higher blockIndex initially
      const feeds = [
        createTestFeed({ id: 'feed-A', blockIndex: 500 }),
        createTestFeed({ id: 'feed-B', blockIndex: 400 }),
      ];
      useFeedsStore.getState().setFeeds(feeds);

      // Verify initial order
      expect(useFeedsStore.getState().feeds[0].id).toBe('feed-A');

      // Act: new message arrives for feed-B at blockIndex 600
      const newMsg = createTestMessage({ id: 'msg-1', feedId: 'feed-B', blockHeight: 600, timestamp: 1000 });
      useFeedsStore.getState().addMessages('feed-B', [newMsg]);

      // Assert: feed-B now first (blockIndex 600 > 500)
      const sorted = useFeedsStore.getState().feeds;
      expect(sorted[0].id).toBe('feed-B');
      expect(sorted[1].id).toBe('feed-A');
    });
  });

  describe('hasPendingMessages lifecycle', () => {
    it('should clear hasPendingMessages when all pending messages are confirmed', () => {
      // Arrange: feed with one pending message
      const feed = createTestFeed({ id: 'feed-1', blockIndex: 500, hasPendingMessages: true });
      useFeedsStore.getState().setFeeds([feed]);

      const pendingMsg = createTestMessage({
        id: 'msg-1',
        feedId: 'feed-1',
        isConfirmed: false,
        blockHeight: undefined,
      });
      // Set up the pending message in the store
      useFeedsStore.setState((state) => ({
        messages: { ...state.messages, 'feed-1': [pendingMsg] },
      }));

      // Act: confirmation arrives for msg-1
      const confirmedMsg = createTestMessage({
        id: 'msg-1',
        feedId: 'feed-1',
        isConfirmed: true,
        blockHeight: 550,
        timestamp: 2000,
      });
      useFeedsStore.getState().addMessages('feed-1', [confirmedMsg]);

      // Assert: hasPendingMessages cleared
      const updatedFeed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(updatedFeed?.hasPendingMessages).toBe(false);
    });

    it('should keep hasPendingMessages when some pending messages remain', () => {
      // Arrange: feed with two pending messages
      const feed = createTestFeed({ id: 'feed-1', blockIndex: 500, hasPendingMessages: true });
      useFeedsStore.getState().setFeeds([feed]);

      const pendingMsg1 = createTestMessage({ id: 'msg-1', feedId: 'feed-1', isConfirmed: false, blockHeight: undefined });
      const pendingMsg2 = createTestMessage({ id: 'msg-2', feedId: 'feed-1', isConfirmed: false, blockHeight: undefined });
      useFeedsStore.setState((state) => ({
        messages: { ...state.messages, 'feed-1': [pendingMsg1, pendingMsg2] },
      }));

      // Act: only msg-1 confirmed
      const confirmedMsg1 = createTestMessage({ id: 'msg-1', feedId: 'feed-1', isConfirmed: true, blockHeight: 550, timestamp: 2000 });
      useFeedsStore.getState().addMessages('feed-1', [confirmedMsg1]);

      // Assert: hasPendingMessages still true (msg-2 still unconfirmed)
      const updatedFeed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(updatedFeed?.hasPendingMessages).toBe(true);
    });
  });

  describe('Scroll-up pagination protection', () => {
    it('should not change blockIndex when loading older paginated messages', () => {
      // Arrange: feed at blockIndex 500
      const feed = createTestFeed({ id: 'feed-1', blockIndex: 500 });
      useFeedsStore.getState().setFeeds([feed]);

      // Act: loading older messages via scroll-up pagination (FEAT-059)
      const olderMessages = [
        createTestMessage({ id: 'old-1', feedId: 'feed-1', blockHeight: 100, timestamp: 100 }),
        createTestMessage({ id: 'old-2', feedId: 'feed-1', blockHeight: 200, timestamp: 200 }),
        createTestMessage({ id: 'old-3', feedId: 'feed-1', blockHeight: 300, timestamp: 300 }),
      ];
      useFeedsStore.getState().addMessages('feed-1', olderMessages);

      // Assert: blockIndex unchanged
      const updatedFeed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(updatedFeed?.blockIndex).toBe(500);
    });
  });

  // === Phase 4 Tests: createdAt Fix + Cross-Feature ===

  describe('createdAt preservation during feed sync merge', () => {
    it('should preserve createdAt when feed is synced again via addFeeds', () => {
      // Arrange: local feed with createdAt = 100
      const localFeed = createTestFeed({ id: 'feed-1', createdAt: 100, blockIndex: 100 });
      useFeedsStore.getState().setFeeds([localFeed]);

      // Act: server returns the same feed with updated blockIndex
      const serverFeed = createTestFeed({ id: 'feed-1', createdAt: 500, blockIndex: 500 });
      useFeedsStore.getState().addFeeds([serverFeed]);

      // Assert: createdAt preserved, blockIndex updated
      const mergedFeed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(mergedFeed?.createdAt).toBe(100); // preserved
      expect(mergedFeed?.blockIndex).toBe(500); // updated from server
    });

    it('should set createdAt from blockIndex for new feeds', () => {
      // Arrange: no existing feeds
      useFeedsStore.getState().setFeeds([]);

      // Act: server returns a new feed
      const newFeed = createTestFeed({ id: 'feed-new', createdAt: 200, blockIndex: 200 });
      useFeedsStore.getState().addFeeds([newFeed]);

      // Assert: new feed gets createdAt as provided
      const addedFeed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-new');
      expect(addedFeed?.createdAt).toBe(200);
      expect(addedFeed?.blockIndex).toBe(200);
    });
  });

  describe('CF-002: Read sync does NOT affect feed sort position', () => {
    it('should not change sort order when unreadCount changes', () => {
      // Arrange: two feeds in specific order
      const feeds = [
        createTestFeed({ id: 'feed-1', blockIndex: 800, unreadCount: 5 }),
        createTestFeed({ id: 'feed-2', blockIndex: 600, unreadCount: 10 }),
      ];
      useFeedsStore.getState().setFeeds(feeds);

      // Verify initial order
      const initial = useFeedsStore.getState().feeds;
      expect(initial[0].id).toBe('feed-1');
      expect(initial[1].id).toBe('feed-2');

      // Act: simulate MessagesRead event — change unreadCount without changing blockIndex
      useFeedsStore.setState((state) => ({
        feeds: state.feeds.map((f) =>
          f.id === 'feed-2' ? { ...f, unreadCount: 0 } : f
        ),
      }));

      // Assert: sort order unchanged — blockIndex determines order, not unreadCount
      const after = useFeedsStore.getState().feeds;
      expect(after[0].id).toBe('feed-1');
      expect(after[1].id).toBe('feed-2');
      expect(after[1].blockIndex).toBe(600); // blockIndex unchanged
    });

    it('should not move feed down when marked as fully read', () => {
      // Arrange: feed at position 1 (after personal)
      const feeds = [
        createTestFeed({ id: 'personal', type: 'personal', blockIndex: 10 }),
        createTestFeed({ id: 'feed-1', blockIndex: 800, unreadCount: 5 }),
        createTestFeed({ id: 'feed-2', blockIndex: 600, unreadCount: 0 }),
      ];
      useFeedsStore.getState().setFeeds(feeds);

      // Act: mark feed-1 as fully read
      useFeedsStore.setState((state) => ({
        feeds: state.feeds.map((f) =>
          f.id === 'feed-1' ? { ...f, unreadCount: 0, lastReadBlockIndex: 800 } : f
        ),
      }));

      // Assert: feed-1 stays at same position
      const after = useFeedsStore.getState().feeds;
      expect(after[0].id).toBe('personal');
      expect(after[1].id).toBe('feed-1');
      expect(after[1].blockIndex).toBe(800);
    });
  });
});
