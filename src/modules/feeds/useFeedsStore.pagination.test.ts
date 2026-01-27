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

  // ============= Task 3.3: Error Handling with Retry Logic =============
  describe('feedLoadError state', () => {
    it('should set error state for a feed', () => {
      useFeedsStore.getState().setFeedLoadError('feed-1', 'Failed to load messages');

      expect(useFeedsStore.getState().feedLoadError['feed-1']).toBe('Failed to load messages');
    });

    it('should set null error state to clear error', () => {
      useFeedsStore.getState().setFeedLoadError('feed-1', 'Failed to load messages');
      useFeedsStore.getState().setFeedLoadError('feed-1', null);

      expect(useFeedsStore.getState().feedLoadError['feed-1']).toBeNull();
    });

    it('should track separate errors per feed', () => {
      useFeedsStore.getState().setFeedLoadError('feed-1', 'Error 1');
      useFeedsStore.getState().setFeedLoadError('feed-2', 'Error 2');

      expect(useFeedsStore.getState().feedLoadError['feed-1']).toBe('Error 1');
      expect(useFeedsStore.getState().feedLoadError['feed-2']).toBe('Error 2');
    });

    it('should clear error state for a specific feed', () => {
      useFeedsStore.getState().setFeedLoadError('feed-1', 'Error 1');
      useFeedsStore.getState().setFeedLoadError('feed-2', 'Error 2');

      useFeedsStore.getState().clearFeedLoadError('feed-1');

      expect(useFeedsStore.getState().feedLoadError['feed-1']).toBeUndefined();
      expect(useFeedsStore.getState().feedLoadError['feed-2']).toBe('Error 2'); // Other feed unchanged
    });

    it('should clear feedLoadError on reset', () => {
      useFeedsStore.getState().setFeedLoadError('feed-1', 'Error 1');
      useFeedsStore.getState().setFeedLoadError('feed-2', 'Error 2');

      useFeedsStore.getState().reset();

      expect(useFeedsStore.getState().feedLoadError).toEqual({});
    });
  });

  // ============= Task 3.4: Group Key Rotation Tests =============
  describe('Group key handling', () => {
    it('should record missing key generation when keyGeneration is not available', () => {
      // Set up a group feed
      useFeedsStore.setState({
        feeds: [{
          id: 'group-feed-1',
          type: 'group',
          name: 'Test Group',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          unreadCount: 0,
        }],
      });

      // Set up group key state with only keyGeneration 2
      useFeedsStore.getState().setGroupKeyState('group-feed-1', {
        currentKeyGeneration: 2,
        keyGenerations: [
          { keyGeneration: 2, aesKey: 'key-2', validFromBlock: 100 },
        ],
        missingKeyGenerations: [],
      });

      // Record a missing key generation
      useFeedsStore.getState().recordMissingKeyGeneration('group-feed-1', 1);

      // Should have recorded the missing key
      const keyState = useFeedsStore.getState().getGroupKeyState('group-feed-1');
      expect(keyState?.missingKeyGenerations).toContain(1);
    });

    it('should preserve messages with keyGeneration field', () => {
      // Create a message with keyGeneration
      const msg: FeedMessage = {
        id: 'msg-1',
        feedId: 'feed-1',
        content: 'Encrypted content',
        senderPublicKey: 'user-1',
        senderName: 'Alice',
        timestamp: 1000,
        blockHeight: 100,
        isConfirmed: true,
        isRead: true,
        keyGeneration: 5,
      };

      useFeedsStore.setState({
        inMemoryMessages: {
          'feed-1': [msg],
        },
      });

      const result = useFeedsStore.getState().getDisplayMessages('feed-1');

      expect(result[0].keyGeneration).toBe(5);
    });

    it('should handle messages with decryptionFailed flag', () => {
      // Create a message that failed to decrypt
      const msg: FeedMessage = {
        id: 'msg-1',
        feedId: 'feed-1',
        content: '[Message encrypted before you joined]',
        contentEncrypted: 'encrypted-content-here',
        senderPublicKey: 'user-1',
        senderName: 'Alice',
        timestamp: 1000,
        blockHeight: 100,
        isConfirmed: true,
        isRead: true,
        keyGeneration: 1,
        decryptionFailed: true,
      };

      useFeedsStore.setState({
        inMemoryMessages: {
          'feed-1': [msg],
        },
      });

      const result = useFeedsStore.getState().getDisplayMessages('feed-1');

      expect(result[0].decryptionFailed).toBe(true);
      expect(result[0].contentEncrypted).toBe('encrypted-content-here');
    });

    it('should get group key by specific generation', () => {
      useFeedsStore.getState().setGroupKeyState('group-feed-1', {
        currentKeyGeneration: 3,
        keyGenerations: [
          { keyGeneration: 1, aesKey: 'key-1', validFromBlock: 100, validToBlock: 199 },
          { keyGeneration: 2, aesKey: 'key-2', validFromBlock: 200, validToBlock: 299 },
          { keyGeneration: 3, aesKey: 'key-3', validFromBlock: 300 },
        ],
        missingKeyGenerations: [],
      });

      // Get specific generation
      const key1 = useFeedsStore.getState().getGroupKeyByGeneration('group-feed-1', 1);
      const key2 = useFeedsStore.getState().getGroupKeyByGeneration('group-feed-1', 2);
      const key3 = useFeedsStore.getState().getGroupKeyByGeneration('group-feed-1', 3);
      const keyMissing = useFeedsStore.getState().getGroupKeyByGeneration('group-feed-1', 99);

      expect(key1).toBe('key-1');
      expect(key2).toBe('key-2');
      expect(key3).toBe('key-3');
      expect(keyMissing).toBeUndefined();
    });

    it('should detect missing key generations', () => {
      useFeedsStore.getState().setGroupKeyState('group-feed-1', {
        currentKeyGeneration: 5,
        keyGenerations: [
          { keyGeneration: 3, aesKey: 'key-3', validFromBlock: 300 },
          { keyGeneration: 5, aesKey: 'key-5', validFromBlock: 500 },
        ],
        missingKeyGenerations: [1, 2, 4], // User joined at generation 3, missing 1, 2, 4
      });

      expect(useFeedsStore.getState().hasMissingKeyGenerations('group-feed-1')).toBe(true);
      expect(useFeedsStore.getState().getMissingKeyGenerations('group-feed-1')).toEqual([1, 2, 4]);
    });
  });

  // ============= Task 4.7: Memory Cap Notice Tests =============
  describe('feedWasCapped state', () => {
    it('should initialize feedWasCapped as empty object', () => {
      expect(useFeedsStore.getState().feedWasCapped).toEqual({});
    });

    it('should clear feedWasCapped for a specific feed', () => {
      // Manually set feedWasCapped state
      useFeedsStore.setState({
        feedWasCapped: {
          'feed-1': Date.now(),
          'feed-2': Date.now() - 1000,
        },
      });

      useFeedsStore.getState().clearFeedWasCapped('feed-1');

      expect(useFeedsStore.getState().feedWasCapped['feed-1']).toBeUndefined();
      expect(useFeedsStore.getState().feedWasCapped['feed-2']).toBeDefined(); // Other feed unchanged
    });

    it('should clear feedWasCapped on cleanupFeed', async () => {
      // Set up feedWasCapped state
      useFeedsStore.setState({
        feedWasCapped: {
          'feed-1': Date.now(),
          'feed-2': Date.now(),
        },
      });

      // Call cleanupFeed
      useFeedsStore.getState().cleanupFeed('feed-1');

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(useFeedsStore.getState().feedWasCapped['feed-1']).toBeUndefined();
      expect(useFeedsStore.getState().feedWasCapped['feed-2']).toBeDefined(); // Other feed unchanged
    });

    it('should clear feedWasCapped on reset', () => {
      useFeedsStore.setState({
        feedWasCapped: {
          'feed-1': Date.now(),
        },
      });

      useFeedsStore.getState().reset();

      expect(useFeedsStore.getState().feedWasCapped).toEqual({});
    });
  });
});
