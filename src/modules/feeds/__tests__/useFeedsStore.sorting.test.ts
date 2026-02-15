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

  describe('BUG: addFeeds must NOT overwrite higher local blockIndex with stale server blockIndex', () => {
    it('should preserve local blockIndex when it is higher than server blockIndex after addMessages', () => {
      // Arrange: two feeds, feed-B initially ranked lower
      const feeds = [
        createTestFeed({ id: 'feed-A', blockIndex: 800 }),
        createTestFeed({ id: 'feed-B', blockIndex: 400, name: 'GroupFeed' }),
      ];
      useFeedsStore.getState().setFeeds(feeds);

      // Verify initial order: A first (800 > 400)
      expect(useFeedsStore.getState().feeds[0].id).toBe('feed-A');
      expect(useFeedsStore.getState().feeds[1].id).toBe('feed-B');

      // Act step 1: New confirmed message arrives for feed-B at block 900
      const confirmedMsg = createTestMessage({
        id: 'msg-new',
        feedId: 'feed-B',
        blockHeight: 900,
        timestamp: 5000,
      });
      useFeedsStore.getState().addMessages('feed-B', [confirmedMsg]);

      // Verify: feed-B now ranks first (blockIndex 900 > 800)
      expect(useFeedsStore.getState().feeds[0].id).toBe('feed-B');
      expect(useFeedsStore.getState().feeds[0].blockIndex).toBe(900);

      // Act step 2: Sync cycle calls addFeeds with STALE server data (blockIndex 400)
      const serverFeedB = createTestFeed({ id: 'feed-B', blockIndex: 400, name: 'GroupFeed' });
      const serverFeedA = createTestFeed({ id: 'feed-A', blockIndex: 800 });
      useFeedsStore.getState().addFeeds([serverFeedA, serverFeedB]);

      // Assert: feed-B's blockIndex must NOT be overwritten by server's stale value
      const feedB = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-B');
      expect(feedB?.blockIndex).toBe(900); // local value preserved, NOT 400

      // Assert: sort order must still reflect the higher blockIndex
      const sorted = useFeedsStore.getState().feeds;
      expect(sorted[0].id).toBe('feed-B'); // still first (900 > 800)
      expect(sorted[1].id).toBe('feed-A');
    });

    it('should accept server blockIndex when it is higher than local blockIndex', () => {
      // Arrange: feed with blockIndex 500
      const feed = createTestFeed({ id: 'feed-1', blockIndex: 500 });
      useFeedsStore.getState().setFeeds([feed]);

      // Act: server has higher blockIndex (new activity from another user)
      const serverFeed = createTestFeed({ id: 'feed-1', blockIndex: 700 });
      useFeedsStore.getState().addFeeds([serverFeed]);

      // Assert: server's higher value wins
      const merged = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(merged?.blockIndex).toBe(700);
    });

    it('should preserve sort order across multiple sync cycles after message confirmation', () => {
      // Arrange: reproduce the exact production bug sequence
      const feeds = [
        createTestFeed({ id: 'feed-high', blockIndex: 2196 }),
        createTestFeed({ id: 'feed-low', blockIndex: 500 }),
      ];
      useFeedsStore.getState().setFeeds(feeds);

      // Step 1: Message confirmed at block 2278 for feed-low
      const msg = createTestMessage({
        id: 'msg-confirmed',
        feedId: 'feed-low',
        blockHeight: 2278,
        timestamp: 10000,
      });
      useFeedsStore.getState().addMessages('feed-low', [msg]);

      // Verify: feed-low is now first (2278 > 2196)
      expect(useFeedsStore.getState().feeds[0].id).toBe('feed-low');

      // Step 2: First sync cycle with stale server data
      useFeedsStore.getState().addFeeds([
        createTestFeed({ id: 'feed-high', blockIndex: 2196 }),
        createTestFeed({ id: 'feed-low', blockIndex: 500 }),
      ]);

      // Assert: still correct after first sync
      expect(useFeedsStore.getState().feeds[0].id).toBe('feed-low');
      expect(useFeedsStore.getState().feeds.find((f) => f.id === 'feed-low')?.blockIndex).toBe(2278);

      // Step 3: Second sync cycle - still stale
      useFeedsStore.getState().addFeeds([
        createTestFeed({ id: 'feed-high', blockIndex: 2196 }),
        createTestFeed({ id: 'feed-low', blockIndex: 500 }),
      ]);

      // Assert: still correct after second sync
      expect(useFeedsStore.getState().feeds[0].id).toBe('feed-low');
      expect(useFeedsStore.getState().feeds.find((f) => f.id === 'feed-low')?.blockIndex).toBe(2278);
    });
  });

  describe('BUG: Confirmed pending message must update feed blockIndex', () => {
    it('should update feed blockIndex when a pending message is confirmed (not just truly new messages)', () => {
      // Arrange: two feeds, feed-B initially ranked lower
      const feeds = [
        createTestFeed({ id: 'feed-A', blockIndex: 800 }),
        createTestFeed({ id: 'feed-B', blockIndex: 400 }),
      ];
      useFeedsStore.getState().setFeeds(feeds);

      // Verify initial order: A first (800 > 400)
      expect(useFeedsStore.getState().feeds[0].id).toBe('feed-A');

      // Step 1: User sends a pending message on feed-B
      const pendingMsg = createTestMessage({
        id: 'msg-pending-1',
        feedId: 'feed-B',
        isConfirmed: false,
        status: 'pending' as FeedMessage['status'],
        blockHeight: undefined,
        timestamp: 5000,
      });
      useFeedsStore.getState().addPendingMessage('feed-B', pendingMsg);

      // Verify: feed-B now has hasPendingMessages boost → ranks first
      const afterPending = useFeedsStore.getState().feeds;
      expect(afterPending[0].id).toBe('feed-B');
      expect(afterPending[0].hasPendingMessages).toBe(true);
      expect(afterPending[0].blockIndex).toBe(400); // blockIndex unchanged

      // Step 2: Server confirms the pending message at blockHeight 900
      // addMessages receives the SAME message ID with isConfirmed=true and blockHeight
      const confirmedMsg = createTestMessage({
        id: 'msg-pending-1', // same ID as pending
        feedId: 'feed-B',
        isConfirmed: true,
        status: 'confirmed' as FeedMessage['status'],
        blockHeight: 900,
        timestamp: 5000,
      });
      useFeedsStore.getState().addMessages('feed-B', [confirmedMsg]);

      // Assert: feed-B's blockIndex MUST be updated to 900 (the confirmed blockHeight)
      const feedB = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-B');
      expect(feedB?.blockIndex).toBe(900); // BUG: currently stays at 400 because messagesToConfirm blockHeights are ignored
      expect(feedB?.hasPendingMessages).toBe(false); // pending flag cleared

      // Assert: sort order must reflect the updated blockIndex (900 > 800)
      const sorted = useFeedsStore.getState().feeds;
      expect(sorted[0].id).toBe('feed-B'); // feed-B should still be first (blockIndex 900 > 800)
      expect(sorted[1].id).toBe('feed-A');
    });

    it('should not drop feed position when pending message is confirmed and boost is removed', () => {
      // This reproduces the exact production bug: feed drops after confirmation
      // because hasPendingMessages boost is removed but blockIndex is NOT updated
      const feeds = [
        createTestFeed({ id: 'personal', type: 'personal', blockIndex: 10 }),
        createTestFeed({ id: 'feed-active', blockIndex: 2196 }),
        createTestFeed({ id: 'feed-sender', blockIndex: 500 }),
      ];
      useFeedsStore.getState().setFeeds(feeds);

      // Verify: personal, feed-active (2196), feed-sender (500)
      const initial = useFeedsStore.getState().feeds.map((f) => f.id);
      expect(initial).toEqual(['personal', 'feed-active', 'feed-sender']);

      // Step 1: User sends message in feed-sender
      const pendingMsg = createTestMessage({
        id: 'msg-1',
        feedId: 'feed-sender',
        isConfirmed: false,
        status: 'pending' as FeedMessage['status'],
        blockHeight: undefined,
        timestamp: Date.now(),
      });
      useFeedsStore.getState().addPendingMessage('feed-sender', pendingMsg);

      // Feed-sender gets pending boost → moves above feed-active
      const afterSend = useFeedsStore.getState().feeds.map((f) => f.id);
      expect(afterSend).toEqual(['personal', 'feed-sender', 'feed-active']);

      // Step 2: Server confirms at blockHeight 2300 (higher than feed-active's 2196)
      const confirmedMsg = createTestMessage({
        id: 'msg-1',
        feedId: 'feed-sender',
        isConfirmed: true,
        status: 'confirmed' as FeedMessage['status'],
        blockHeight: 2300,
        timestamp: Date.now(),
      });
      useFeedsStore.getState().addMessages('feed-sender', [confirmedMsg]);

      // Assert: feed-sender should STAY above feed-active (blockIndex 2300 > 2196)
      const afterConfirm = useFeedsStore.getState().feeds.map((f) => f.id);
      expect(afterConfirm).toEqual(['personal', 'feed-sender', 'feed-active']);

      // Verify blockIndex was actually updated
      const feedSender = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-sender');
      expect(feedSender?.blockIndex).toBe(2300);
      expect(feedSender?.hasPendingMessages).toBe(false);
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
