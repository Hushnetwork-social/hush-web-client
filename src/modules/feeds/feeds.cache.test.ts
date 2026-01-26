/**
 * FEAT-053: Client Message Cache Limits Tests
 *
 * Tests for:
 * 1. trimMessagesToLimit - Per-feed message trimming with read/unread awareness
 * 2. handleStorageQuotaExceeded - Global LRU eviction of oldest read messages
 * 3. isRead calculation in addMessages
 * 4. FeedCacheMetadata updates
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useFeedsStore } from './useFeedsStore';
import type { Feed, FeedMessage } from '@/types';

// Helper to create test messages
function createMessage(
  id: string,
  feedId: string,
  timestamp: number,
  blockHeight: number,
  isRead: boolean
): FeedMessage {
  return {
    id,
    feedId,
    content: `Message ${id}`,
    senderId: 'user-1',
    senderName: 'Alice',
    timestamp,
    blockHeight,
    isConfirmed: true,
    isRead,
  };
}

// Helper to create a test feed
function createFeed(id: string, lastReadBlockIndex: number = 100): Feed {
  return {
    id,
    type: 'chat',
    name: 'Test Feed',
    participants: ['user-1', 'user-2'],
    unreadCount: 0,
    createdAt: 100,
    updatedAt: 100,
    lastReadBlockIndex,
  };
}

describe('FEAT-053: Client Message Cache Limits', () => {
  beforeEach(() => {
    useFeedsStore.getState().reset();
  });

  describe('trimMessagesToLimit', () => {
    describe('Edge Cases', () => {
      it('should return empty array for empty feed', () => {
        const result = useFeedsStore.getState().trimMessagesToLimit('feed-1', 100);
        expect(result).toEqual([]);
      });

      it('should return empty array for non-existent feed', () => {
        const result = useFeedsStore.getState().trimMessagesToLimit('non-existent', 100);
        expect(result).toEqual([]);
      });

      it('should return empty array when feed has only unread messages', () => {
        // Set up feed with only unread messages
        const messages = [
          createMessage('msg-1', 'feed-1', 1000, 101, false),
          createMessage('msg-2', 'feed-1', 2000, 102, false),
          createMessage('msg-3', 'feed-1', 3000, 103, false),
        ];
        useFeedsStore.getState().setMessages('feed-1', messages);

        const result = useFeedsStore.getState().trimMessagesToLimit('feed-1', 100);

        expect(result).toEqual([]);
        // All messages should remain
        expect(useFeedsStore.getState().messages['feed-1']).toHaveLength(3);
      });

      it('should return empty array when read messages are exactly at limit', () => {
        // Set up feed with exactly 100 read messages
        const messages = Array.from({ length: 100 }, (_, i) =>
          createMessage(`msg-${i}`, 'feed-1', i * 1000, i, true)
        );
        useFeedsStore.getState().setMessages('feed-1', messages);

        const result = useFeedsStore.getState().trimMessagesToLimit('feed-1', 100);

        expect(result).toEqual([]);
        expect(useFeedsStore.getState().messages['feed-1']).toHaveLength(100);
      });

      it('should return empty array when read messages are under limit', () => {
        // Set up feed with 50 read messages
        const messages = Array.from({ length: 50 }, (_, i) =>
          createMessage(`msg-${i}`, 'feed-1', i * 1000, i, true)
        );
        useFeedsStore.getState().setMessages('feed-1', messages);

        const result = useFeedsStore.getState().trimMessagesToLimit('feed-1', 100);

        expect(result).toEqual([]);
        expect(useFeedsStore.getState().messages['feed-1']).toHaveLength(50);
      });
    });

    describe('Boundary Conditions', () => {
      it('should remove exactly 1 message when read count is limit+1', () => {
        // Set up feed with 101 read messages
        const messages = Array.from({ length: 101 }, (_, i) =>
          createMessage(`msg-${i}`, 'feed-1', i * 1000, i, true)
        );
        useFeedsStore.getState().setMessages('feed-1', messages);

        const result = useFeedsStore.getState().trimMessagesToLimit('feed-1', 100);

        expect(result).toHaveLength(1);
        expect(result[0]).toBe('msg-0'); // Oldest message removed
        expect(useFeedsStore.getState().messages['feed-1']).toHaveLength(100);
      });

      it('should handle limit of 0 (remove all read messages)', () => {
        const messages = [
          createMessage('msg-1', 'feed-1', 1000, 50, true),
          createMessage('msg-2', 'feed-1', 2000, 60, true),
          createMessage('msg-3', 'feed-1', 3000, 150, false), // unread
        ];
        useFeedsStore.getState().setMessages('feed-1', messages);

        const result = useFeedsStore.getState().trimMessagesToLimit('feed-1', 0);

        expect(result).toHaveLength(2);
        expect(result).toContain('msg-1');
        expect(result).toContain('msg-2');
        // Only unread message should remain
        expect(useFeedsStore.getState().messages['feed-1']).toHaveLength(1);
        expect(useFeedsStore.getState().messages['feed-1'][0].id).toBe('msg-3');
      });

      it('should handle limit of 1', () => {
        const messages = [
          createMessage('msg-1', 'feed-1', 1000, 50, true), // oldest read
          createMessage('msg-2', 'feed-1', 2000, 60, true),
          createMessage('msg-3', 'feed-1', 3000, 70, true), // newest read
        ];
        useFeedsStore.getState().setMessages('feed-1', messages);

        const result = useFeedsStore.getState().trimMessagesToLimit('feed-1', 1);

        expect(result).toHaveLength(2);
        expect(result).toContain('msg-1');
        expect(result).toContain('msg-2');
        // Only newest read message should remain
        expect(useFeedsStore.getState().messages['feed-1']).toHaveLength(1);
        expect(useFeedsStore.getState().messages['feed-1'][0].id).toBe('msg-3');
      });
    });

    describe('Read/Unread Separation', () => {
      it('should never trim unread messages regardless of count', () => {
        // 200 unread messages, 50 read messages
        const unreadMessages = Array.from({ length: 200 }, (_, i) =>
          createMessage(`unread-${i}`, 'feed-1', i * 1000 + 100000, i + 200, false)
        );
        const readMessages = Array.from({ length: 50 }, (_, i) =>
          createMessage(`read-${i}`, 'feed-1', i * 1000, i, true)
        );
        useFeedsStore.getState().setMessages('feed-1', [...readMessages, ...unreadMessages]);

        const result = useFeedsStore.getState().trimMessagesToLimit('feed-1', 100);

        expect(result).toEqual([]); // No trimming needed (only 50 read)
        // All 250 messages should remain
        expect(useFeedsStore.getState().messages['feed-1']).toHaveLength(250);
      });

      it('should trim read messages while preserving all unread', () => {
        // 150 read messages, 50 unread messages, limit 100
        const readMessages = Array.from({ length: 150 }, (_, i) =>
          createMessage(`read-${i}`, 'feed-1', i * 1000, i, true)
        );
        const unreadMessages = Array.from({ length: 50 }, (_, i) =>
          createMessage(`unread-${i}`, 'feed-1', i * 1000 + 200000, i + 200, false)
        );
        useFeedsStore.getState().setMessages('feed-1', [...readMessages, ...unreadMessages]);

        const result = useFeedsStore.getState().trimMessagesToLimit('feed-1', 100);

        expect(result).toHaveLength(50); // 150 - 100 = 50 removed
        // 100 read + 50 unread = 150 remaining
        expect(useFeedsStore.getState().messages['feed-1']).toHaveLength(150);

        // Verify all unread messages are preserved
        const remainingIds = useFeedsStore.getState().messages['feed-1'].map((m) => m.id);
        for (let i = 0; i < 50; i++) {
          expect(remainingIds).toContain(`unread-${i}`);
        }
      });

      it('should treat undefined isRead as unread (never trim)', () => {
        const messages = [
          { ...createMessage('msg-1', 'feed-1', 1000, 50, true), isRead: undefined },
          { ...createMessage('msg-2', 'feed-1', 2000, 60, true), isRead: undefined },
          createMessage('msg-3', 'feed-1', 3000, 70, true), // This one has isRead: true
        ] as FeedMessage[];
        useFeedsStore.getState().setMessages('feed-1', messages);

        const result = useFeedsStore.getState().trimMessagesToLimit('feed-1', 1);

        // Only msg-3 is considered read, others are treated as unread
        expect(result).toEqual([]); // Only 1 read message, under limit
      });
    });

    describe('Timestamp Ordering', () => {
      it('should keep newest read messages and remove oldest', () => {
        const messages = [
          createMessage('oldest', 'feed-1', 1000, 10, true),
          createMessage('middle', 'feed-1', 2000, 20, true),
          createMessage('newest', 'feed-1', 3000, 30, true),
        ];
        useFeedsStore.getState().setMessages('feed-1', messages);

        const result = useFeedsStore.getState().trimMessagesToLimit('feed-1', 2);

        expect(result).toEqual(['oldest']);
        const remaining = useFeedsStore.getState().messages['feed-1'];
        expect(remaining.map((m) => m.id)).toContain('middle');
        expect(remaining.map((m) => m.id)).toContain('newest');
      });

      it('should maintain chronological order after trimming', () => {
        const messages = [
          createMessage('msg-1', 'feed-1', 1000, 10, true),
          createMessage('msg-2', 'feed-1', 2000, 20, true),
          createMessage('msg-3', 'feed-1', 3000, 30, true),
          createMessage('msg-4', 'feed-1', 4000, 40, true),
        ];
        useFeedsStore.getState().setMessages('feed-1', messages);

        useFeedsStore.getState().trimMessagesToLimit('feed-1', 2);

        const remaining = useFeedsStore.getState().messages['feed-1'];
        expect(remaining[0].timestamp).toBeLessThan(remaining[1].timestamp);
      });
    });

    describe('FeedCacheMetadata Updates', () => {
      it('should set hasOlderMessages to true after trimming', () => {
        const messages = Array.from({ length: 150 }, (_, i) =>
          createMessage(`msg-${i}`, 'feed-1', i * 1000, i + 100, true)
        );
        useFeedsStore.getState().setMessages('feed-1', messages);

        useFeedsStore.getState().trimMessagesToLimit('feed-1', 100);

        const metadata = useFeedsStore.getState().getFeedCacheMetadata('feed-1');
        expect(metadata?.hasOlderMessages).toBe(true);
      });

      it('should update oldestCachedBlockIndex after trimming', () => {
        const messages = [
          createMessage('msg-1', 'feed-1', 1000, 100, true), // oldest by timestamp
          createMessage('msg-2', 'feed-1', 2000, 200, true),
          createMessage('msg-3', 'feed-1', 3000, 150, true), // newest by timestamp, will be kept
        ];
        useFeedsStore.getState().setMessages('feed-1', messages);

        useFeedsStore.getState().trimMessagesToLimit('feed-1', 2);

        const metadata = useFeedsStore.getState().getFeedCacheMetadata('feed-1');
        // After removing msg-1, the remaining messages have blockHeights 200 and 150
        // The oldest cached block should be the min of those
        expect(metadata?.oldestCachedBlockIndex).toBe(150);
      });
    });
  });

  describe('handleStorageQuotaExceeded', () => {
    describe('Edge Cases', () => {
      it('should return empty array when no messages exist', () => {
        const result = useFeedsStore.getState().handleStorageQuotaExceeded();
        expect(result).toEqual([]);
      });

      it('should return empty array when all messages are unread', () => {
        const messages = [
          createMessage('msg-1', 'feed-1', 1000, 101, false),
          createMessage('msg-2', 'feed-1', 2000, 102, false),
        ];
        useFeedsStore.getState().setMessages('feed-1', messages);

        const result = useFeedsStore.getState().handleStorageQuotaExceeded();

        expect(result).toEqual([]);
        expect(useFeedsStore.getState().messages['feed-1']).toHaveLength(2);
      });

      it('should handle single read message (evict at least 1)', () => {
        const messages = [createMessage('msg-1', 'feed-1', 1000, 50, true)];
        useFeedsStore.getState().setMessages('feed-1', messages);

        const result = useFeedsStore.getState().handleStorageQuotaExceeded();

        // Math.max(1, Math.ceil(1 * 0.2)) = 1
        expect(result).toHaveLength(1);
        expect(result[0]).toBe('msg-1');
      });
    });

    describe('20% Eviction Rule', () => {
      it('should evict exactly 20% of read messages (rounded up)', () => {
        // 100 read messages -> 20 evicted
        const messages = Array.from({ length: 100 }, (_, i) =>
          createMessage(`msg-${i}`, 'feed-1', i * 1000, i, true)
        );
        useFeedsStore.getState().setMessages('feed-1', messages);

        const result = useFeedsStore.getState().handleStorageQuotaExceeded();

        expect(result).toHaveLength(20);
      });

      it('should round up eviction count (5 messages -> 1 evicted)', () => {
        // 5 read messages -> ceil(5 * 0.2) = 1 evicted
        const messages = Array.from({ length: 5 }, (_, i) =>
          createMessage(`msg-${i}`, 'feed-1', i * 1000, i, true)
        );
        useFeedsStore.getState().setMessages('feed-1', messages);

        const result = useFeedsStore.getState().handleStorageQuotaExceeded();

        expect(result).toHaveLength(1);
      });

      it('should evict at least 1 message even for small percentages', () => {
        // 3 read messages -> max(1, ceil(3 * 0.2)) = max(1, 1) = 1
        const messages = Array.from({ length: 3 }, (_, i) =>
          createMessage(`msg-${i}`, 'feed-1', i * 1000, i, true)
        );
        useFeedsStore.getState().setMessages('feed-1', messages);

        const result = useFeedsStore.getState().handleStorageQuotaExceeded();

        expect(result).toHaveLength(1);
      });
    });

    describe('Global LRU Eviction', () => {
      it('should evict oldest messages globally across multiple feeds', () => {
        // Feed 1: messages at timestamps 1000, 3000, 5000
        // Feed 2: messages at timestamps 2000, 4000, 6000
        // Global order: 1000, 2000, 3000, 4000, 5000, 6000
        useFeedsStore.getState().setMessages('feed-1', [
          createMessage('f1-old', 'feed-1', 1000, 10, true),
          createMessage('f1-mid', 'feed-1', 3000, 30, true),
          createMessage('f1-new', 'feed-1', 5000, 50, true),
        ]);
        useFeedsStore.getState().setMessages('feed-2', [
          createMessage('f2-old', 'feed-2', 2000, 20, true),
          createMessage('f2-mid', 'feed-2', 4000, 40, true),
          createMessage('f2-new', 'feed-2', 6000, 60, true),
        ]);

        // 6 total read messages -> evict 2 (ceil(6 * 0.2) = 2)
        const result = useFeedsStore.getState().handleStorageQuotaExceeded();

        expect(result).toHaveLength(2);
        // Should evict the 2 oldest globally
        expect(result).toContain('f1-old'); // timestamp 1000
        expect(result).toContain('f2-old'); // timestamp 2000
      });

      it('should only evict from feeds with read messages', () => {
        // Feed 1: all unread
        // Feed 2: all read
        useFeedsStore.getState().setMessages('feed-1', [
          createMessage('f1-1', 'feed-1', 1000, 101, false),
          createMessage('f1-2', 'feed-1', 2000, 102, false),
        ]);
        useFeedsStore.getState().setMessages('feed-2', [
          createMessage('f2-1', 'feed-2', 3000, 30, true),
          createMessage('f2-2', 'feed-2', 4000, 40, true),
        ]);

        const result = useFeedsStore.getState().handleStorageQuotaExceeded();

        // Only feed-2 has read messages, so only evict from there
        expect(result.every((id) => id.startsWith('f2-'))).toBe(true);
        // Feed 1 should still have all messages
        expect(useFeedsStore.getState().messages['feed-1']).toHaveLength(2);
      });
    });

    describe('FeedCacheMetadata Updates', () => {
      it('should update metadata for affected feeds', () => {
        useFeedsStore.getState().setMessages('feed-1', [
          createMessage('msg-1', 'feed-1', 1000, 100, true),
          createMessage('msg-2', 'feed-1', 2000, 200, true),
        ]);

        useFeedsStore.getState().handleStorageQuotaExceeded();

        const metadata = useFeedsStore.getState().getFeedCacheMetadata('feed-1');
        expect(metadata?.hasOlderMessages).toBe(true);
      });
    });
  });

  describe('isRead Calculation in addMessages', () => {
    it('should mark messages as read when blockHeight <= lastReadBlockIndex', () => {
      // Set up feed with lastReadBlockIndex = 500
      useFeedsStore.getState().setFeeds([createFeed('feed-1', 500)]);

      // Add messages with various blockHeights
      const messages = [
        { ...createMessage('msg-1', 'feed-1', 1000, 400, false), isRead: undefined },
        { ...createMessage('msg-2', 'feed-1', 2000, 500, false), isRead: undefined }, // boundary
        { ...createMessage('msg-3', 'feed-1', 3000, 501, false), isRead: undefined }, // boundary
        { ...createMessage('msg-4', 'feed-1', 4000, 1000, false), isRead: undefined },
      ] as FeedMessage[];

      useFeedsStore.getState().addMessages('feed-1', messages);

      const stored = useFeedsStore.getState().messages['feed-1'];
      expect(stored.find((m) => m.id === 'msg-1')?.isRead).toBe(true); // 400 <= 500
      expect(stored.find((m) => m.id === 'msg-2')?.isRead).toBe(true); // 500 <= 500 (boundary)
      expect(stored.find((m) => m.id === 'msg-3')?.isRead).toBe(false); // 501 > 500 (boundary)
      expect(stored.find((m) => m.id === 'msg-4')?.isRead).toBe(false); // 1000 > 500
    });

    it('should treat messages without blockHeight as unread', () => {
      useFeedsStore.getState().setFeeds([createFeed('feed-1', 500)]);

      const message = {
        id: 'optimistic-msg',
        feedId: 'feed-1',
        content: 'Optimistic message',
        senderId: 'user-1',
        senderName: 'Alice',
        timestamp: Date.now(),
        blockHeight: undefined, // Optimistic message has no blockHeight
        isConfirmed: false,
      } as FeedMessage;

      useFeedsStore.getState().addMessages('feed-1', [message]);

      const stored = useFeedsStore.getState().messages['feed-1'];
      expect(stored[0].isRead).toBe(false);
    });

    it('should treat blockHeight 0 as read when lastReadBlockIndex >= 0', () => {
      useFeedsStore.getState().setFeeds([createFeed('feed-1', 0)]);

      const message = { ...createMessage('msg-1', 'feed-1', 1000, 0, false), isRead: undefined } as FeedMessage;
      useFeedsStore.getState().addMessages('feed-1', [message]);

      const stored = useFeedsStore.getState().messages['feed-1'];
      expect(stored[0].isRead).toBe(true); // 0 <= 0
    });
  });

  describe('FeedCacheMetadata Management', () => {
    it('should update feed cache metadata', () => {
      useFeedsStore.getState().updateFeedCacheMetadata('feed-1', {
        hasOlderMessages: true,
        oldestCachedBlockIndex: 500,
        lastSyncedMessageBlockIndex: 500,
      });

      const metadata = useFeedsStore.getState().getFeedCacheMetadata('feed-1');
      expect(metadata?.hasOlderMessages).toBe(true);
      expect(metadata?.oldestCachedBlockIndex).toBe(500);
      expect(metadata?.lastSyncedMessageBlockIndex).toBe(500);
    });

    it('should return undefined for non-existent feed metadata', () => {
      const metadata = useFeedsStore.getState().getFeedCacheMetadata('non-existent');
      expect(metadata).toBeUndefined();
    });

    it('should merge partial metadata updates', () => {
      useFeedsStore.getState().updateFeedCacheMetadata('feed-1', {
        hasOlderMessages: true,
        oldestCachedBlockIndex: 500,
      });

      useFeedsStore.getState().updateFeedCacheMetadata('feed-1', {
        oldestCachedBlockIndex: 300,
      });

      const metadata = useFeedsStore.getState().getFeedCacheMetadata('feed-1');
      expect(metadata?.hasOlderMessages).toBe(true); // preserved
      expect(metadata?.oldestCachedBlockIndex).toBe(300); // updated
    });

    it('should reset feedCacheMetadata on store reset', () => {
      useFeedsStore.getState().updateFeedCacheMetadata('feed-1', {
        hasOlderMessages: true,
        oldestCachedBlockIndex: 500,
        lastSyncedMessageBlockIndex: 500,
      });

      useFeedsStore.getState().reset();

      expect(useFeedsStore.getState().feedCacheMetadata).toEqual({});
    });
  });

  // ============= FEAT-054: Per-Feed Sync Metadata Tests =============

  describe('FEAT-054: Per-Feed Sync Metadata', () => {
    describe('lastSyncedMessageBlockIndex', () => {
      it('should store lastSyncedMessageBlockIndex per feed', () => {
        useFeedsStore.getState().updateFeedCacheMetadata('feed-1', {
          hasOlderMessages: false,
          oldestCachedBlockIndex: 100,
          lastSyncedMessageBlockIndex: 500,
        });

        const metadata = useFeedsStore.getState().getFeedCacheMetadata('feed-1');
        expect(metadata?.lastSyncedMessageBlockIndex).toBe(500);
      });

      it('should allow different feeds to have different sync positions', () => {
        // Set up feed-1 synced to block 100
        useFeedsStore.getState().updateFeedCacheMetadata('feed-1', {
          hasOlderMessages: false,
          oldestCachedBlockIndex: 50,
          lastSyncedMessageBlockIndex: 100,
        });

        // Set up feed-2 synced to block 500
        useFeedsStore.getState().updateFeedCacheMetadata('feed-2', {
          hasOlderMessages: false,
          oldestCachedBlockIndex: 200,
          lastSyncedMessageBlockIndex: 500,
        });

        const metadata1 = useFeedsStore.getState().getFeedCacheMetadata('feed-1');
        const metadata2 = useFeedsStore.getState().getFeedCacheMetadata('feed-2');

        expect(metadata1?.lastSyncedMessageBlockIndex).toBe(100);
        expect(metadata2?.lastSyncedMessageBlockIndex).toBe(500);
      });

      it('should update lastSyncedMessageBlockIndex independently', () => {
        // Initial state for feed-1
        useFeedsStore.getState().updateFeedCacheMetadata('feed-1', {
          hasOlderMessages: false,
          oldestCachedBlockIndex: 100,
          lastSyncedMessageBlockIndex: 100,
        });

        // Update only lastSyncedMessageBlockIndex
        useFeedsStore.getState().updateFeedCacheMetadata('feed-1', {
          lastSyncedMessageBlockIndex: 200,
        });

        const metadata = useFeedsStore.getState().getFeedCacheMetadata('feed-1');
        expect(metadata?.lastSyncedMessageBlockIndex).toBe(200);
        expect(metadata?.hasOlderMessages).toBe(false); // preserved
        expect(metadata?.oldestCachedBlockIndex).toBe(100); // preserved
      });
    });

    describe('clearAllFeedCacheMetadata', () => {
      it('should clear all feed cache metadata', () => {
        // Set up metadata for multiple feeds
        useFeedsStore.getState().updateFeedCacheMetadata('feed-1', {
          hasOlderMessages: true,
          oldestCachedBlockIndex: 100,
          lastSyncedMessageBlockIndex: 500,
        });
        useFeedsStore.getState().updateFeedCacheMetadata('feed-2', {
          hasOlderMessages: false,
          oldestCachedBlockIndex: 200,
          lastSyncedMessageBlockIndex: 600,
        });
        useFeedsStore.getState().updateFeedCacheMetadata('feed-3', {
          hasOlderMessages: true,
          oldestCachedBlockIndex: 50,
          lastSyncedMessageBlockIndex: 300,
        });

        // Verify metadata exists
        expect(Object.keys(useFeedsStore.getState().feedCacheMetadata)).toHaveLength(3);

        // Clear all metadata
        useFeedsStore.getState().clearAllFeedCacheMetadata();

        // Verify all cleared
        expect(useFeedsStore.getState().feedCacheMetadata).toEqual({});
      });

      it('should be called by reset() (implicitly via initialState)', () => {
        // Set up metadata
        useFeedsStore.getState().updateFeedCacheMetadata('feed-1', {
          hasOlderMessages: true,
          oldestCachedBlockIndex: 100,
          lastSyncedMessageBlockIndex: 500,
        });

        // Reset store (simulates logout)
        useFeedsStore.getState().reset();

        // Verify metadata is cleared
        expect(useFeedsStore.getState().feedCacheMetadata).toEqual({});
      });
    });

    describe('Global lastMessageBlockIndex removal', () => {
      it('should NOT have lastMessageBlockIndex in syncMetadata', () => {
        const syncMetadata = useFeedsStore.getState().syncMetadata;

        // Verify lastMessageBlockIndex does not exist
        expect('lastMessageBlockIndex' in syncMetadata).toBe(false);
      });

      it('should have lastFeedBlockIndex still available', () => {
        const syncMetadata = useFeedsStore.getState().syncMetadata;

        // lastFeedBlockIndex should still exist (for feed list sync)
        expect('lastFeedBlockIndex' in syncMetadata).toBe(true);
        expect(syncMetadata.lastFeedBlockIndex).toBe(0);
      });
    });
  });
});
