/**
 * FEAT-063: Cross-Device Read Sync Unit Tests
 *
 * Tests that markFeedAsRead calculates remaining unreads from watermark:
 * - F3-003: Client calculates remaining unreads from upToBlockIndex
 * - F3-005: Max-wins watermark semantics
 * - F3-006: lastReadBlockIndex updated on event
 * - F3-007: Mention badge clears when unreadCount reaches 0
 * - addMessages recalculation when lastReadBlockIndex is set
 * - Pending messages always count as unread
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useFeedsStore } from '../useFeedsStore';
import { useAppStore } from '@/stores/useAppStore';
import type { Feed, FeedMessage, Credentials } from '@/types';

// Storage key must match MENTION_STORAGE_KEY in useFeedsStore.ts
const MENTION_STORAGE_KEY = 'hush_mention_tracking';

// In-memory storage for localStorage mock (setup.ts mocks localStorage with vi.fn())
let mockStorage: Record<string, string> = {};

/** Helper to seed mention tracking data into mock localStorage */
function seedMentions(feedId: string, messageIds: string[]): void {
  const raw = mockStorage[MENTION_STORAGE_KEY] || '{}';
  const data = JSON.parse(raw);
  data[feedId] = { messageIds };
  mockStorage[MENTION_STORAGE_KEY] = JSON.stringify(data);
}

/** Helper to check if mentions exist for a feed in mock localStorage */
function hasMentionsInStorage(feedId: string): boolean {
  const raw = mockStorage[MENTION_STORAGE_KEY];
  if (!raw) return false;
  const data = JSON.parse(raw);
  return feedId in data;
}

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
    // Configure localStorage mock with real in-memory storage for F3-007 tests
    mockStorage = {};
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => mockStorage[key] ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((key: string, value: string) => { mockStorage[key] = value; });
    vi.mocked(localStorage.removeItem).mockImplementation((key: string) => { delete mockStorage[key]; });
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

    it('should count all messages as unread when lastReadBlockIndex is 0 (never read)', () => {
      // Arrange: feed without lastReadBlockIndex (never read by user)
      const feed = createTestFeed({ id: 'feed-1', unreadCount: 0 });
      useFeedsStore.getState().setFeeds([feed]);

      // Act: messages arrive
      useFeedsStore.getState().addMessages('feed-1', [
        createTestMessage({ id: 'msg-1', feedId: 'feed-1', blockHeight: 850, timestamp: 1 }),
      ]);

      // Assert: message counted as unread (blockHeight > 0, user never read feed)
      const updatedFeed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(updatedFeed?.unreadCount).toBe(1);
    });
  });

  describe('Real sync flow: addFeeds then addMessages', () => {
    it('should calculate unreadCount when new feed arrives via addFeeds then messages via addMessages', () => {
      // This test simulates the real FeedsSyncable flow:
      // 1. syncFeeds() calls fetchFeeds() → returns feed with unreadCount: 0
      // 2. addFeeds() adds the new feed as-is (unreadCount: 0)
      // 3. syncMessages() calls fetchMessages() → returns messages
      // 4. addMessages() recalculates unreadCount from lastReadBlockIndex

      // Arrange: New feed arrives from server with unreadCount: 0 and lastReadBlockIndex: 0
      const serverFeed = createTestFeed({
        id: 'feed-1',
        unreadCount: 0,
        lastReadBlockIndex: 0,
        blockIndex: 500,
      });

      // Act: addFeeds (simulates syncFeeds → addFeeds)
      useFeedsStore.getState().addFeeds([serverFeed]);

      // Verify feed starts with unreadCount: 0
      let feed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(feed?.unreadCount).toBe(0);

      // Act: addMessages (simulates syncMessages → addMessages)
      useFeedsStore.getState().addMessages('feed-1', [
        createTestMessage({ id: 'msg-1', feedId: 'feed-1', blockHeight: 400, timestamp: 1 }),
        createTestMessage({ id: 'msg-2', feedId: 'feed-1', blockHeight: 500, timestamp: 2 }),
      ]);

      // Assert: Both messages are unread (lastReadBlockIndex=0, all blockHeights > 0)
      feed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(feed?.unreadCount).toBe(2);
    });

    it('should preserve unreadCount on existing feed when addFeeds merges server data', () => {
      // Arrange: Existing feed with unreadCount=3 (from previous addMessages)
      useFeedsStore.getState().setFeeds([
        createTestFeed({ id: 'feed-1', unreadCount: 3, blockIndex: 500 }),
      ]);

      // Act: Server returns same feed (addFeeds merge path)
      useFeedsStore.getState().addFeeds([
        createTestFeed({ id: 'feed-1', unreadCount: 0, blockIndex: 600 }),
      ]);

      // Assert: unreadCount preserved (not overwritten by server's 0)
      const feed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(feed?.unreadCount).toBe(3);
    });

    it('should recalculate unreadCount when server lastReadBlockIndex increases (cross-device read sync)', () => {
      // Simulates: Alice reads on Device A → server lastReadBlockIndex updates
      // → Device B fetches feed → addFeeds merges → unreadCount recalculated from messages

      // Arrange: Device B has feed with 2 unread messages
      useFeedsStore.getState().setFeeds([
        createTestFeed({ id: 'feed-1', unreadCount: 2, lastReadBlockIndex: 0, blockIndex: 500 }),
      ]);
      // Messages in store (both at blocks > 0, so both unread when lastReadBlockIndex=0)
      useFeedsStore.getState().addMessages('feed-1', [
        createTestMessage({ id: 'msg-1', feedId: 'feed-1', blockHeight: 400, timestamp: 1 }),
        createTestMessage({ id: 'msg-2', feedId: 'feed-1', blockHeight: 500, timestamp: 2 }),
      ]);

      // Act: Server returns feed with updated lastReadBlockIndex=500 (Alice read on Device A)
      useFeedsStore.getState().addFeeds([
        createTestFeed({ id: 'feed-1', unreadCount: 0, lastReadBlockIndex: 500, blockIndex: 500 }),
      ]);

      // Assert: unreadCount recalculated — both messages at blockHeight <= 500, so 0 unread
      const feed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(feed?.unreadCount).toBe(0);
      expect(feed?.lastReadBlockIndex).toBe(500);
    });

    it('should calculate partial unread when lastReadBlockIndex increases but not all messages read', () => {
      // Arrange: Feed with 3 messages, currently all unread
      useFeedsStore.getState().setFeeds([
        createTestFeed({ id: 'feed-1', unreadCount: 3, lastReadBlockIndex: 0, blockIndex: 900 }),
      ]);
      useFeedsStore.getState().addMessages('feed-1', [
        createTestMessage({ id: 'msg-1', feedId: 'feed-1', blockHeight: 400, timestamp: 1 }),
        createTestMessage({ id: 'msg-2', feedId: 'feed-1', blockHeight: 700, timestamp: 2 }),
        createTestMessage({ id: 'msg-3', feedId: 'feed-1', blockHeight: 900, timestamp: 3 }),
      ]);

      // Act: Alice read up to block 700 on Device A
      useFeedsStore.getState().addFeeds([
        createTestFeed({ id: 'feed-1', unreadCount: 0, lastReadBlockIndex: 700, blockIndex: 900 }),
      ]);

      // Assert: 1 message after block 700 (msg-3 at 900)
      const feed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(feed?.unreadCount).toBe(1);
    });
  });

  describe('FEAT-063: needsSync flag for non-active feed message sync', () => {
    it('should set needsSync via markFeedNeedsSync and clear via clearFeedNeedsSync', () => {
      // Arrange: Feed exists in store
      useFeedsStore.getState().setFeeds([createTestFeed({ id: 'feed-1' })]);

      // Act: Mark feed as needing sync (simulates detectAndMarkFeedsNeedingSync)
      useFeedsStore.getState().markFeedNeedsSync('feed-1', true);

      // Assert: needsSync is set
      let feed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(feed?.needsSync).toBe(true);

      // Act: Clear needsSync (simulates syncFeedsNeedingMessages after fetching)
      useFeedsStore.getState().clearFeedNeedsSync('feed-1');

      // Assert: needsSync is cleared
      feed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(feed?.needsSync).toBe(false);
    });

    it('should compute unreadCount after addFeeds + markNeedsSync + addMessages (full sync flow)', () => {
      // Simulates the complete production flow:
      // 1. syncFeeds → addFeeds (new feed with unreadCount: 0)
      // 2. detectAndMarkFeedsNeedingSync → markFeedNeedsSync
      // 3. syncFeedsNeedingMessages → syncMessagesForFeed → addMessages
      // 4. clearFeedNeedsSync

      // Step 1: New feed arrives from server
      useFeedsStore.getState().addFeeds([
        createTestFeed({ id: 'feed-1', unreadCount: 0, lastReadBlockIndex: 0, blockIndex: 500 }),
      ]);

      // Step 2: Feed marked as needing sync
      useFeedsStore.getState().markFeedNeedsSync('feed-1', true);

      // Step 3: Messages arrive for this feed
      useFeedsStore.getState().addMessages('feed-1', [
        createTestMessage({ id: 'msg-1', feedId: 'feed-1', blockHeight: 400, timestamp: 1 }),
        createTestMessage({ id: 'msg-2', feedId: 'feed-1', blockHeight: 500, timestamp: 2 }),
      ]);

      // Step 4: Clear needsSync
      useFeedsStore.getState().clearFeedNeedsSync('feed-1');

      // Assert: unreadCount calculated correctly (both messages unread since never read)
      const feed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(feed?.unreadCount).toBe(2);
      expect(feed?.needsSync).toBe(false);
    });
  });

  describe('F3-E2E-002: Post-read message arrival (feed not selected)', () => {
    it('should show unread=1 when new message arrives after markFeedAsRead', () => {
      // Simulates the F3-E2E-002 scenario:
      // 1. Alice has a feed with Message 1 (block 800)
      // 2. Alice reads it (markFeedAsRead with upToBlockIndex=800)
      // 3. Alice navigates away (feed is no longer selected)
      // 4. Bob sends Message 2 (block 900) — arrives via addMessages
      // 5. Unread badge should show "1"

      // Step 1: Feed with Message 1
      useFeedsStore.getState().setFeeds([
        createTestFeed({ id: 'feed-1', unreadCount: 0, lastReadBlockIndex: 0, blockIndex: 800 }),
      ]);
      useFeedsStore.getState().addMessages('feed-1', [
        createTestMessage({ id: 'msg-1', feedId: 'feed-1', blockHeight: 800, timestamp: 1 }),
      ]);

      // Verify: 1 unread (message at 800 > lastReadBlockIndex 0)
      let feed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(feed?.unreadCount).toBe(1);

      // Step 2: Alice reads (markFeedAsRead up to block 800)
      useFeedsStore.getState().markFeedAsRead('feed-1', 800);
      feed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(feed?.unreadCount).toBe(0);
      expect(feed?.lastReadBlockIndex).toBe(800);

      // Step 3: Alice navigates away (no state change needed at store level)

      // Step 4: Message 2 arrives via sync (addMessages)
      useFeedsStore.getState().addMessages('feed-1', [
        createTestMessage({ id: 'msg-2', feedId: 'feed-1', blockHeight: 900, timestamp: 2 }),
      ]);

      // Step 5: Unread badge should show "1"
      feed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(feed?.unreadCount).toBe(1);
    });

    it('should show unread=2 when multiple messages arrive after read', () => {
      // Arrange: Feed read up to block 800
      useFeedsStore.getState().setFeeds([
        createTestFeed({ id: 'feed-1', unreadCount: 0, lastReadBlockIndex: 800, blockIndex: 800 }),
      ]);
      useFeedsStore.getState().addMessages('feed-1', [
        createTestMessage({ id: 'msg-1', feedId: 'feed-1', blockHeight: 800, timestamp: 1 }),
      ]);

      // Act: Two new messages arrive after read
      useFeedsStore.getState().addMessages('feed-1', [
        createTestMessage({ id: 'msg-2', feedId: 'feed-1', blockHeight: 900, timestamp: 2 }),
        createTestMessage({ id: 'msg-3', feedId: 'feed-1', blockHeight: 950, timestamp: 3 }),
      ]);

      // Assert: 2 unread messages (900, 950 > lastReadBlockIndex 800)
      const feed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(feed?.unreadCount).toBe(2);
    });

    it('should show correct unread via syncUnreadCounts (server-side fallback)', () => {
      // Simulates: notification stream missed the event, but sync fetches unread counts
      // from server and applies them via syncUnreadCounts

      // Arrange: Feed with 0 unread (local state is stale)
      useFeedsStore.getState().setFeeds([
        createTestFeed({ id: 'feed-1', unreadCount: 0, lastReadBlockIndex: 800 }),
        createTestFeed({ id: 'feed-2', unreadCount: 0 }),
      ]);

      // Act: Server reports 1 unread for feed-1 and 3 for feed-2
      useFeedsStore.getState().syncUnreadCounts({ 'feed-1': 1, 'feed-2': 3 });

      // Assert: unread counts updated from server
      const feeds = useFeedsStore.getState().feeds;
      expect(feeds.find((f) => f.id === 'feed-1')?.unreadCount).toBe(1);
      expect(feeds.find((f) => f.id === 'feed-2')?.unreadCount).toBe(3);
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

  describe('CF-002: markFeedAsRead should not change feed ordering', () => {
    it('should not change feed ordering when a feed is marked as read', () => {
      // Arrange: Two feeds - Bob's feed has higher blockIndex (appears first in sort)
      const bobFeed = createTestFeed({
        id: 'feed-bob',
        name: 'Bob',
        unreadCount: 1,
        blockIndex: 500,
        updatedAt: 2000,
      });
      const charlieFeed = createTestFeed({
        id: 'feed-charlie',
        name: 'Charlie',
        unreadCount: 0,
        blockIndex: 300,
        updatedAt: 1000,
      });
      useFeedsStore.getState().setFeeds([bobFeed, charlieFeed]);
      useFeedsStore.getState().addMessages('feed-bob', [
        createTestMessage({ id: 'msg-1', feedId: 'feed-bob', blockHeight: 500, timestamp: 1 }),
      ]);

      // Capture order before read
      const feedsBefore = useFeedsStore.getState().feeds.map((f) => f.id);

      // Act: Alice reads Bob's feed
      useFeedsStore.getState().markFeedAsRead('feed-bob', 500);

      // Assert: order unchanged
      const feedsAfter = useFeedsStore.getState().feeds.map((f) => f.id);
      expect(feedsAfter).toEqual(feedsBefore);
    });
  });

  describe('EC-003: Messages between read and sync', () => {
    it('should count all messages added after markFeedAsRead as unread', () => {
      // Arrange: Feed with 1 message, Alice reads it
      const feed = createTestFeed({ id: 'feed-1', unreadCount: 0, lastReadBlockIndex: 0, blockIndex: 800 });
      useFeedsStore.getState().setFeeds([feed]);
      useFeedsStore.getState().addMessages('feed-1', [
        createTestMessage({ id: 'msg-1', feedId: 'feed-1', blockHeight: 800, timestamp: 1 }),
      ]);
      useFeedsStore.getState().markFeedAsRead('feed-1', 800);

      // Verify: 0 unread after read
      let state = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(state?.unreadCount).toBe(0);

      // Act: 2 new messages arrive in a single batch (simulates messages between read and next sync)
      useFeedsStore.getState().addMessages('feed-1', [
        createTestMessage({ id: 'msg-2', feedId: 'feed-1', blockHeight: 850, timestamp: 2 }),
        createTestMessage({ id: 'msg-3', feedId: 'feed-1', blockHeight: 900, timestamp: 3 }),
      ]);

      // Assert: both new messages counted as unread
      state = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(state?.unreadCount).toBe(2);
    });
  });

  describe('EC-006: Concurrent read positions converge to max watermark', () => {
    it('should converge to highest watermark when concurrent markFeedAsRead calls arrive', () => {
      // Arrange: Feed with messages at blocks 700, 750, 800
      const feed = createTestFeed({ id: 'feed-1', unreadCount: 3, lastReadBlockIndex: 0 });
      useFeedsStore.getState().setFeeds([feed]);
      useFeedsStore.getState().addMessages('feed-1', [
        createTestMessage({ id: 'msg-1', feedId: 'feed-1', blockHeight: 700, timestamp: 1 }),
        createTestMessage({ id: 'msg-2', feedId: 'feed-1', blockHeight: 750, timestamp: 2 }),
        createTestMessage({ id: 'msg-3', feedId: 'feed-1', blockHeight: 800, timestamp: 3 }),
      ]);

      // Act: Device A reads up to 800 (all messages)
      useFeedsStore.getState().markFeedAsRead('feed-1', 800);

      // Assert: 0 unread, lastReadBlockIndex=800
      let state = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(state?.unreadCount).toBe(0);
      expect(state?.lastReadBlockIndex).toBe(800);

      // Act: Stale event from Device B with lower watermark (600) arrives after
      useFeedsStore.getState().markFeedAsRead('feed-1', 600);

      // Assert: still 0 unread, lastReadBlockIndex=800 (max-wins)
      state = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(state?.unreadCount).toBe(0);
      expect(state?.lastReadBlockIndex).toBe(800);
    });
  });

  describe('EC-001: markFeedAsRead works independently of notification stream', () => {
    it('should work purely from local state without any external dependencies', () => {
      // Arrange: Feed with messages (no notification stream setup needed)
      const feed = createTestFeed({ id: 'feed-1', unreadCount: 3 });
      useFeedsStore.getState().setFeeds([feed]);
      useFeedsStore.getState().addMessages('feed-1', [
        createTestMessage({ id: 'msg-1', feedId: 'feed-1', blockHeight: 700, timestamp: 1 }),
        createTestMessage({ id: 'msg-2', feedId: 'feed-1', blockHeight: 800, timestamp: 2 }),
        createTestMessage({ id: 'msg-3', feedId: 'feed-1', blockHeight: 900, timestamp: 3 }),
      ]);

      // Act: markFeedAsRead works with only store state - no notification stream
      useFeedsStore.getState().markFeedAsRead('feed-1', 800);

      // Assert: correctly calculates remaining unreads
      const updatedFeed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(updatedFeed?.unreadCount).toBe(1); // msg at 900 is after watermark
      expect(updatedFeed?.lastReadBlockIndex).toBe(800);
    });

    it('should update unread counts via syncUnreadCounts even without notification stream', () => {
      // Arrange: Feeds with stale unread counts (simulates missed notification events)
      useFeedsStore.getState().setFeeds([
        createTestFeed({ id: 'feed-1', unreadCount: 0 }),
        createTestFeed({ id: 'feed-2', unreadCount: 0 }),
      ]);

      // Act: syncUnreadCounts provides server-side counts as fallback
      useFeedsStore.getState().syncUnreadCounts({ 'feed-1': 2, 'feed-2': 5 });

      // Assert: counts updated from server without any notification dependency
      const feeds = useFeedsStore.getState().feeds;
      expect(feeds.find((f) => f.id === 'feed-1')?.unreadCount).toBe(2);
      expect(feeds.find((f) => f.id === 'feed-2')?.unreadCount).toBe(5);
    });
  });

  describe('CF-003: Offline reconnection - addMessages recalculates from watermark', () => {
    it('should correctly count unreads when messages arrive after offline gap', () => {
      // Arrange: Feed read up to block 800 before going offline
      const feed = createTestFeed({ id: 'feed-1', lastReadBlockIndex: 800, unreadCount: 0 });
      useFeedsStore.getState().setFeeds([feed]);
      useFeedsStore.getState().addMessages('feed-1', [
        createTestMessage({ id: 'msg-1', feedId: 'feed-1', blockHeight: 750, timestamp: 1 }),
        createTestMessage({ id: 'msg-2', feedId: 'feed-1', blockHeight: 800, timestamp: 2 }),
      ]);

      // Verify: 0 unread (both at or below watermark)
      let state = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(state?.unreadCount).toBe(0);

      // Act: After reconnection, new messages arrive via sync
      useFeedsStore.getState().addMessages('feed-1', [
        createTestMessage({ id: 'msg-3', feedId: 'feed-1', blockHeight: 900, timestamp: 3 }),
      ]);

      // Assert: new message correctly counted as unread from existing watermark
      state = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(state?.unreadCount).toBe(1);
    });
  });

  describe('F3-007: Mention badge clears when unreadCount reaches 0', () => {
    it('should clear mentions from localStorage when markFeedAsRead sets unreadCount to 0', () => {
      // Arrange: feed fully read (watermark >= all messages) with mentions tracked
      const feed = createTestFeed({ id: 'feed-1', unreadCount: 3 });
      useFeedsStore.getState().setFeeds([feed]);
      useFeedsStore.getState().addMessages('feed-1', [
        createTestMessage({ id: 'msg-1', feedId: 'feed-1', blockHeight: 700, timestamp: 1 }),
        createTestMessage({ id: 'msg-2', feedId: 'feed-1', blockHeight: 800, timestamp: 2 }),
      ]);
      seedMentions('feed-1', ['msg-1', 'msg-2']);
      expect(hasMentionsInStorage('feed-1')).toBe(true);

      // Act: mark as read beyond all messages
      useFeedsStore.getState().markFeedAsRead('feed-1', 900);

      // Assert: mentions cleared because unreadCount = 0
      expect(hasMentionsInStorage('feed-1')).toBe(false);
    });

    it('should NOT clear mentions when markFeedAsRead leaves unreadCount > 0', () => {
      // Arrange: feed with messages after the watermark
      const feed = createTestFeed({ id: 'feed-1', unreadCount: 5 });
      useFeedsStore.getState().setFeeds([feed]);
      useFeedsStore.getState().addMessages('feed-1', [
        createTestMessage({ id: 'msg-1', feedId: 'feed-1', blockHeight: 700, timestamp: 1 }),
        createTestMessage({ id: 'msg-2', feedId: 'feed-1', blockHeight: 850, timestamp: 2 }),
        createTestMessage({ id: 'msg-3', feedId: 'feed-1', blockHeight: 900, timestamp: 3 }),
      ]);
      seedMentions('feed-1', ['msg-2', 'msg-3']);

      // Act: mark as read up to 800 (still 2 unreads after)
      useFeedsStore.getState().markFeedAsRead('feed-1', 800);

      // Assert: mentions NOT cleared because unreadCount = 2
      expect(hasMentionsInStorage('feed-1')).toBe(true);
    });

    it('should clear mentions when markFeedAsRead with no watermark (backward compat)', () => {
      // Arrange
      const feed = createTestFeed({ id: 'feed-1', unreadCount: 5 });
      useFeedsStore.getState().setFeeds([feed]);
      seedMentions('feed-1', ['msg-1']);

      // Act: mark as read without watermark (old behavior sets to 0)
      useFeedsStore.getState().markFeedAsRead('feed-1');

      // Assert: mentions cleared because unreadCount = 0
      expect(hasMentionsInStorage('feed-1')).toBe(false);
    });

    it('should NOT clear mentions when max-wins ignores stale event', () => {
      // Arrange: feed already read to 800 with remaining unreads
      const feed = createTestFeed({ id: 'feed-1', lastReadBlockIndex: 800, unreadCount: 3 });
      useFeedsStore.getState().setFeeds([feed]);
      seedMentions('feed-1', ['msg-1']);

      // Act: stale event with lower watermark (no-op)
      useFeedsStore.getState().markFeedAsRead('feed-1', 600);

      // Assert: mentions NOT cleared (stale event was ignored)
      expect(hasMentionsInStorage('feed-1')).toBe(true);
    });

    it('should clear mentions when addMessages recalculates unreadCount to 0', () => {
      // Arrange: feed already read to 900, no messages yet, but has mentions tracked
      const feed = createTestFeed({ id: 'feed-1', lastReadBlockIndex: 900, unreadCount: 0 });
      useFeedsStore.getState().setFeeds([feed]);
      seedMentions('feed-1', ['msg-1']);

      // Act: messages arrive, all within the read watermark
      useFeedsStore.getState().addMessages('feed-1', [
        createTestMessage({ id: 'msg-1', feedId: 'feed-1', blockHeight: 700, timestamp: 1 }),
        createTestMessage({ id: 'msg-2', feedId: 'feed-1', blockHeight: 800, timestamp: 2 }),
      ]);

      // Assert: mentions cleared because recalculated unreadCount = 0
      expect(hasMentionsInStorage('feed-1')).toBe(false);
    });

    it('should NOT clear mentions when addMessages recalculates unreadCount > 0', () => {
      // Arrange: feed read to 800
      const feed = createTestFeed({ id: 'feed-1', lastReadBlockIndex: 800, unreadCount: 0 });
      useFeedsStore.getState().setFeeds([feed]);
      seedMentions('feed-1', ['msg-2']);

      // Act: messages arrive, some after the watermark
      useFeedsStore.getState().addMessages('feed-1', [
        createTestMessage({ id: 'msg-1', feedId: 'feed-1', blockHeight: 750, timestamp: 1 }),
        createTestMessage({ id: 'msg-2', feedId: 'feed-1', blockHeight: 850, timestamp: 2 }),
      ]);

      // Assert: mentions NOT cleared because unreadCount = 1
      expect(hasMentionsInStorage('feed-1')).toBe(true);
    });

    it('should increment mentionVersion when mentions are cleared', () => {
      // Arrange
      const feed = createTestFeed({ id: 'feed-1', unreadCount: 3 });
      useFeedsStore.getState().setFeeds([feed]);
      seedMentions('feed-1', ['msg-1']);
      const versionBefore = useFeedsStore.getState().mentionVersion;

      // Act
      useFeedsStore.getState().markFeedAsRead('feed-1', 900);

      // Assert: mentionVersion incremented (triggers React re-render for "@" badge)
      expect(useFeedsStore.getState().mentionVersion).toBe(versionBefore + 1);
    });
  });

  describe('Own messages should not count as unread', () => {
    const CURRENT_USER_KEY = 'current-user-public-key';
    const OTHER_USER_KEY = 'other-user-public-key';

    beforeEach(() => {
      // Set up useAppStore with credentials so own messages can be identified
      useAppStore.setState({
        credentials: {
          signingPublicKey: CURRENT_USER_KEY,
          signingPrivateKey: 'test-signing-private',
          encryptionPublicKey: 'test-encryption-public',
          encryptionPrivateKey: 'test-encryption-private',
        } satisfies Credentials,
      });
    });

    it('own messages should not count as unread in addMessages', () => {
      // Arrange: feed with lastReadBlockIndex=800
      const feed = createTestFeed({ id: 'feed-1', lastReadBlockIndex: 800, unreadCount: 0 });
      useFeedsStore.getState().setFeeds([feed]);

      // Act: own message arrives at block 900
      useFeedsStore.getState().addMessages('feed-1', [
        createTestMessage({
          id: 'msg-own',
          feedId: 'feed-1',
          senderPublicKey: CURRENT_USER_KEY,
          blockHeight: 900,
          timestamp: 1,
        }),
      ]);

      // Assert: own message not counted as unread
      const updatedFeed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(updatedFeed?.unreadCount).toBe(0);
    });

    it('own messages should not count as unread in markFeedAsRead', () => {
      // Arrange: feed with mixed messages
      const feed = createTestFeed({ id: 'feed-1', unreadCount: 0 });
      useFeedsStore.getState().setFeeds([feed]);
      useFeedsStore.getState().addMessages('feed-1', [
        createTestMessage({ id: 'msg-own', feedId: 'feed-1', senderPublicKey: CURRENT_USER_KEY, blockHeight: 900, timestamp: 1 }),
        createTestMessage({ id: 'msg-other', feedId: 'feed-1', senderPublicKey: OTHER_USER_KEY, blockHeight: 950, timestamp: 2 }),
      ]);

      // Act: mark as read up to block 800 (both messages above watermark)
      useFeedsStore.getState().markFeedAsRead('feed-1', 800);

      // Assert: only the other user's message counts as unread
      const updatedFeed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(updatedFeed?.unreadCount).toBe(1);
    });

    it('own messages should not count as unread in addFeeds cross-device sync', () => {
      // Arrange: existing feed with messages, lastReadBlockIndex about to increase
      useFeedsStore.getState().setFeeds([
        createTestFeed({ id: 'feed-1', unreadCount: 0, lastReadBlockIndex: 0, blockIndex: 900 }),
      ]);
      useFeedsStore.getState().addMessages('feed-1', [
        createTestMessage({ id: 'msg-own', feedId: 'feed-1', senderPublicKey: CURRENT_USER_KEY, blockHeight: 850, timestamp: 1 }),
        createTestMessage({ id: 'msg-other', feedId: 'feed-1', senderPublicKey: OTHER_USER_KEY, blockHeight: 900, timestamp: 2 }),
      ]);

      // Act: server sends updated lastReadBlockIndex=800 (cross-device read sync)
      useFeedsStore.getState().addFeeds([
        createTestFeed({ id: 'feed-1', unreadCount: 0, lastReadBlockIndex: 800, blockIndex: 900 }),
      ]);

      // Assert: only the other user's message (900 > 800) counts as unread, not own (850 > 800)
      const feed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(feed?.unreadCount).toBe(1);
    });

    it('mixed own + other messages counts only other as unread', () => {
      // Arrange: feed with lastReadBlockIndex=700
      const feed = createTestFeed({ id: 'feed-1', lastReadBlockIndex: 700, unreadCount: 0 });
      useFeedsStore.getState().setFeeds([feed]);

      // Act: 3 own messages + 2 other messages arrive above watermark
      useFeedsStore.getState().addMessages('feed-1', [
        createTestMessage({ id: 'msg-own-1', feedId: 'feed-1', senderPublicKey: CURRENT_USER_KEY, blockHeight: 750, timestamp: 1 }),
        createTestMessage({ id: 'msg-own-2', feedId: 'feed-1', senderPublicKey: CURRENT_USER_KEY, blockHeight: 800, timestamp: 2 }),
        createTestMessage({ id: 'msg-own-3', feedId: 'feed-1', senderPublicKey: CURRENT_USER_KEY, blockHeight: 850, timestamp: 3 }),
        createTestMessage({ id: 'msg-other-1', feedId: 'feed-1', senderPublicKey: OTHER_USER_KEY, blockHeight: 900, timestamp: 4 }),
        createTestMessage({ id: 'msg-other-2', feedId: 'feed-1', senderPublicKey: OTHER_USER_KEY, blockHeight: 950, timestamp: 5 }),
      ]);

      // Assert: only 2 other messages count as unread
      const updatedFeed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(updatedFeed?.unreadCount).toBe(2);
    });

    it('own pending message (undefined blockHeight) should not count as unread', () => {
      // Arrange: feed with lastReadBlockIndex=800
      const feed = createTestFeed({ id: 'feed-1', lastReadBlockIndex: 800, unreadCount: 0 });
      useFeedsStore.getState().setFeeds([feed]);

      // Act: own pending (optimistic) message arrives
      useFeedsStore.getState().addMessages('feed-1', [
        createTestMessage({
          id: 'msg-pending',
          feedId: 'feed-1',
          senderPublicKey: CURRENT_USER_KEY,
          blockHeight: undefined,
          isConfirmed: false,
          timestamp: 1,
        }),
      ]);

      // Assert: own pending message not counted as unread
      const updatedFeed = useFeedsStore.getState().feeds.find((f) => f.id === 'feed-1');
      expect(updatedFeed?.unreadCount).toBe(0);
    });
  });
});
