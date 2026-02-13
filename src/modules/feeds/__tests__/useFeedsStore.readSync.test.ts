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
import type { Feed, FeedMessage } from '@/types';

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
});
