/**
 * FEAT-056: Load More Pagination Tests
 *
 * Tests for:
 * 1. getDisplayMessages - Merge in-memory + persisted messages
 * 2. loadOlderMessages - Guard conditions (concurrent, no more)
 * 3. Memory cap enforcement
 * 4. setFeedHasMoreMessages / setIsLoadingOlderMessages helpers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useFeedsStore } from './useFeedsStore';
import type { FeedMessage } from '@/types';

// Helper to create test messages
function createMessage(
  id: string,
  feedId: string,
  timestamp: number,
  blockHeight?: number
): FeedMessage {
  return {
    id,
    feedId,
    content: `Message ${id}`,
    senderPublicKey: 'user-1',
    senderName: 'Alice',
    timestamp,
    blockHeight,
    isConfirmed: true,
    isRead: true,
  };
}

describe('FEAT-056: Load More Pagination', () => {
  beforeEach(() => {
    useFeedsStore.getState().reset();
  });

  describe('getDisplayMessages', () => {
    it('should return empty array for empty feed', () => {
      const result = useFeedsStore.getState().getDisplayMessages('feed-1');
      expect(result).toEqual([]);
    });

    it('should return only persisted messages when no in-memory', () => {
      const messages = [
        createMessage('msg-1', 'feed-1', 1000, 100),
        createMessage('msg-2', 'feed-1', 2000, 200),
        createMessage('msg-3', 'feed-1', 3000, 300),
      ];
      useFeedsStore.getState().setMessages('feed-1', messages);

      const result = useFeedsStore.getState().getDisplayMessages('feed-1');

      expect(result).toHaveLength(3);
      expect(result.map(m => m.id)).toEqual(['msg-1', 'msg-2', 'msg-3']);
    });

    it('should return only in-memory messages when no persisted', () => {
      useFeedsStore.setState({
        inMemoryMessages: {
          'feed-1': [
            createMessage('msg-1', 'feed-1', 1000, 100),
            createMessage('msg-2', 'feed-1', 2000, 200),
          ],
        },
      });

      const result = useFeedsStore.getState().getDisplayMessages('feed-1');

      expect(result).toHaveLength(2);
      expect(result.map(m => m.id)).toEqual(['msg-1', 'msg-2']);
    });

    it('should merge in-memory and persisted messages', () => {
      // In-memory: older messages (lower timestamps)
      useFeedsStore.setState({
        inMemoryMessages: {
          'feed-1': [
            createMessage('msg-1', 'feed-1', 1000, 100),
            createMessage('msg-2', 'feed-1', 2000, 200),
          ],
        },
      });

      // Persisted: recent messages (higher timestamps)
      useFeedsStore.getState().setMessages('feed-1', [
        createMessage('msg-3', 'feed-1', 3000, 300),
        createMessage('msg-4', 'feed-1', 4000, 400),
      ]);

      const result = useFeedsStore.getState().getDisplayMessages('feed-1');

      expect(result).toHaveLength(4);
      // Should be sorted by timestamp ascending
      expect(result.map(m => m.id)).toEqual(['msg-1', 'msg-2', 'msg-3', 'msg-4']);
    });

    it('should deduplicate by message ID', () => {
      // In-memory has messages 1, 2, 3
      useFeedsStore.setState({
        inMemoryMessages: {
          'feed-1': [
            createMessage('msg-1', 'feed-1', 1000, 100),
            createMessage('msg-2', 'feed-1', 2000, 200),
            createMessage('msg-3', 'feed-1', 3000, 300),
          ],
        },
      });

      // Persisted has messages 3, 4, 5 (msg-3 is duplicate)
      useFeedsStore.getState().setMessages('feed-1', [
        createMessage('msg-3', 'feed-1', 3000, 300),
        createMessage('msg-4', 'feed-1', 4000, 400),
        createMessage('msg-5', 'feed-1', 5000, 500),
      ]);

      const result = useFeedsStore.getState().getDisplayMessages('feed-1');

      expect(result).toHaveLength(5); // Should not have duplicate msg-3
      expect(result.map(m => m.id)).toEqual(['msg-1', 'msg-2', 'msg-3', 'msg-4', 'msg-5']);
    });

    it('should sort by timestamp ascending', () => {
      // In-memory: mix of timestamps
      useFeedsStore.setState({
        inMemoryMessages: {
          'feed-1': [
            createMessage('msg-3', 'feed-1', 3000, 300),
            createMessage('msg-1', 'feed-1', 1000, 100),
          ],
        },
      });

      // Persisted: mix of timestamps
      useFeedsStore.getState().setMessages('feed-1', [
        createMessage('msg-4', 'feed-1', 4000, 400),
        createMessage('msg-2', 'feed-1', 2000, 200),
      ]);

      const result = useFeedsStore.getState().getDisplayMessages('feed-1');

      // Should be sorted by timestamp ascending
      expect(result.map(m => m.timestamp)).toEqual([1000, 2000, 3000, 4000]);
    });
  });

  describe('setFeedHasMoreMessages', () => {
    it('should set feedHasMoreMessages to true', () => {
      useFeedsStore.getState().setFeedHasMoreMessages('feed-1', true);

      expect(useFeedsStore.getState().feedHasMoreMessages['feed-1']).toBe(true);
    });

    it('should set feedHasMoreMessages to false', () => {
      useFeedsStore.getState().setFeedHasMoreMessages('feed-1', false);

      expect(useFeedsStore.getState().feedHasMoreMessages['feed-1']).toBe(false);
    });

    it('should track separate values per feed', () => {
      useFeedsStore.getState().setFeedHasMoreMessages('feed-1', true);
      useFeedsStore.getState().setFeedHasMoreMessages('feed-2', false);

      expect(useFeedsStore.getState().feedHasMoreMessages['feed-1']).toBe(true);
      expect(useFeedsStore.getState().feedHasMoreMessages['feed-2']).toBe(false);
    });
  });

  describe('setIsLoadingOlderMessages', () => {
    it('should set isLoadingOlderMessages to true', () => {
      useFeedsStore.getState().setIsLoadingOlderMessages('feed-1', true);

      expect(useFeedsStore.getState().isLoadingOlderMessages['feed-1']).toBe(true);
    });

    it('should set isLoadingOlderMessages to false', () => {
      useFeedsStore.getState().setIsLoadingOlderMessages('feed-1', false);

      expect(useFeedsStore.getState().isLoadingOlderMessages['feed-1']).toBe(false);
    });

    it('should track separate values per feed', () => {
      useFeedsStore.getState().setIsLoadingOlderMessages('feed-1', true);
      useFeedsStore.getState().setIsLoadingOlderMessages('feed-2', false);

      expect(useFeedsStore.getState().isLoadingOlderMessages['feed-1']).toBe(true);
      expect(useFeedsStore.getState().isLoadingOlderMessages['feed-2']).toBe(false);
    });
  });

  describe('reset', () => {
    it('should clear feedHasMoreMessages on reset', () => {
      useFeedsStore.getState().setFeedHasMoreMessages('feed-1', true);
      useFeedsStore.getState().setFeedHasMoreMessages('feed-2', false);

      useFeedsStore.getState().reset();

      expect(useFeedsStore.getState().feedHasMoreMessages).toEqual({});
    });

    it('should clear isLoadingOlderMessages on reset', () => {
      useFeedsStore.getState().setIsLoadingOlderMessages('feed-1', true);
      useFeedsStore.getState().setIsLoadingOlderMessages('feed-2', false);

      useFeedsStore.getState().reset();

      expect(useFeedsStore.getState().isLoadingOlderMessages).toEqual({});
    });

    it('should clear inMemoryMessages on reset', () => {
      useFeedsStore.setState({
        inMemoryMessages: {
          'feed-1': [createMessage('msg-1', 'feed-1', 1000, 100)],
        },
      });

      useFeedsStore.getState().reset();

      expect(useFeedsStore.getState().inMemoryMessages).toEqual({});
    });
  });

  describe('cleanupFeed pagination state', () => {
    it('should clear feedHasMoreMessages for the feed', async () => {
      useFeedsStore.getState().setFeedHasMoreMessages('feed-1', true);
      useFeedsStore.getState().setFeedHasMoreMessages('feed-2', false);

      // Call cleanupFeed (debounced)
      useFeedsStore.getState().cleanupFeed('feed-1');

      // Wait for debounce (150ms + buffer)
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(useFeedsStore.getState().feedHasMoreMessages['feed-1']).toBeUndefined();
      expect(useFeedsStore.getState().feedHasMoreMessages['feed-2']).toBe(false); // Other feed unchanged
    });

    it('should clear isLoadingOlderMessages for the feed', async () => {
      useFeedsStore.getState().setIsLoadingOlderMessages('feed-1', true);
      useFeedsStore.getState().setIsLoadingOlderMessages('feed-2', false);

      // Call cleanupFeed (debounced)
      useFeedsStore.getState().cleanupFeed('feed-1');

      // Wait for debounce (150ms + buffer)
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(useFeedsStore.getState().isLoadingOlderMessages['feed-1']).toBeUndefined();
      expect(useFeedsStore.getState().isLoadingOlderMessages['feed-2']).toBe(false); // Other feed unchanged
    });

    it('should clear inMemoryMessages for the feed', async () => {
      useFeedsStore.setState({
        inMemoryMessages: {
          'feed-1': [createMessage('msg-1', 'feed-1', 1000, 100)],
          'feed-2': [createMessage('msg-2', 'feed-2', 2000, 200)],
        },
      });

      // Call cleanupFeed (debounced)
      useFeedsStore.getState().cleanupFeed('feed-1');

      // Wait for debounce (150ms + buffer)
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(useFeedsStore.getState().inMemoryMessages['feed-1']).toBeUndefined();
      expect(useFeedsStore.getState().inMemoryMessages['feed-2']).toHaveLength(1); // Other feed unchanged
    });
  });

  describe('loadOlderMessages guard conditions', () => {
    it('should not change loading state if already loading for this feed', async () => {
      // Set loading state
      useFeedsStore.getState().setIsLoadingOlderMessages('feed-1', true);

      // Attempt to load older messages - should return early
      await useFeedsStore.getState().loadOlderMessages('feed-1');

      // Loading state should still be true (not changed by the early return)
      expect(useFeedsStore.getState().isLoadingOlderMessages['feed-1']).toBe(true);
    });

    it('should not change state if feedHasMoreMessages is false', async () => {
      // Set no more messages
      useFeedsStore.getState().setFeedHasMoreMessages('feed-1', false);

      // Attempt to load older messages - should return early
      await useFeedsStore.getState().loadOlderMessages('feed-1');

      // State should not have changed
      expect(useFeedsStore.getState().feedHasMoreMessages['feed-1']).toBe(false);
      expect(useFeedsStore.getState().isLoadingOlderMessages['feed-1']).toBeUndefined();
    });

    it('should not start loading if no displayed messages exist', async () => {
      // No messages set up

      // Attempt to load older messages - should return early
      await useFeedsStore.getState().loadOlderMessages('feed-1');

      // Loading state should not have been set
      expect(useFeedsStore.getState().isLoadingOlderMessages['feed-1']).toBeUndefined();
    });

    it('should warn and return early if no profile public key available', async () => {
      // Add some messages so we have something to paginate from
      useFeedsStore.getState().setMessages('feed-1', [
        createMessage('msg-1', 'feed-1', 1000, 100),
      ]);

      // Mock console.warn to verify warning
      const warnSpy = vi.spyOn(console, 'warn');

      // Attempt to load older messages (no user profile set)
      await useFeedsStore.getState().loadOlderMessages('feed-1');

      // Should have logged a warning about no profile
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('no profile public key')
      );

      warnSpy.mockRestore();
    });
  });
});
