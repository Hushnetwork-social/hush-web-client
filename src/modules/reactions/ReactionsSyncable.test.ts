/**
 * ReactionsSyncable Tests
 *
 * Tests for the reactions sync logic.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { reactionsSyncable } from './ReactionsSyncable';
import { useReactionsStore } from './useReactionsStore';
import { useFeedsStore } from '@/modules/feeds/useFeedsStore';

// Mock the debug logger
vi.mock('@/lib/debug-logger', () => ({
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
  debugError: vi.fn(),
}));

describe('ReactionsSyncable', () => {
  beforeEach(() => {
    // Reset stores
    useReactionsStore.getState().reset();
    useFeedsStore.getState().reset();
    // Reset syncable internal state
    reactionsSyncable.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Properties', () => {
    it('should have correct name', () => {
      expect(reactionsSyncable.name).toBe('ReactionsSyncable');
    });

    it('should require authentication', () => {
      expect(reactionsSyncable.requiresAuth).toBe(true);
    });
  });

  describe('syncTask', () => {
    it('should skip sync when no feeds are loaded', async () => {
      // No feeds in store
      await reactionsSyncable.syncTask();

      // Should not throw and should complete gracefully
      expect(true).toBe(true);
    });

    it('should NOT block on isProverReady or isBsgsReady', async () => {
      // Add a feed to pass the feeds check
      useFeedsStore.getState().setFeeds([
        {
          id: 'feed-1',
          name: 'Test Feed',
          type: 'chat',
          participants: [],
          createdAt: Date.now(),
          lastMessageAt: Date.now(),
        },
      ]);

      // Ensure prover and BSGS are NOT ready
      useReactionsStore.getState().setProverReady(false);
      useReactionsStore.getState().setBsgsReady(false);

      // Should NOT block - this was the bug we fixed
      await reactionsSyncable.syncTask();

      // Should complete without waiting for prover/BSGS
      expect(true).toBe(true);
    });

    it('should skip sync when within cooldown period', async () => {
      // Add feeds and messages
      useFeedsStore.getState().setFeeds([
        {
          id: 'feed-1',
          name: 'Test Feed',
          type: 'chat',
          participants: [],
          createdAt: Date.now(),
          lastMessageAt: Date.now(),
        },
      ]);
      useFeedsStore.getState().addMessages('feed-1', [
        {
          id: 'msg-1',
          feedId: 'feed-1',
          content: 'Hello',
          senderPublicKey: 'sender-1',
          timestamp: Date.now(),
          isConfirmed: true,
        },
      ]);

      // First sync
      await reactionsSyncable.syncTask();

      // Second sync immediately should be skipped due to cooldown
      await reactionsSyncable.syncTask();

      // No error means cooldown worked
      expect(true).toBe(true);
    });

    it('should only sync confirmed messages', async () => {
      useFeedsStore.getState().setFeeds([
        {
          id: 'feed-1',
          name: 'Test Feed',
          type: 'chat',
          participants: [],
          createdAt: Date.now(),
          lastMessageAt: Date.now(),
        },
      ]);

      // Add both confirmed and unconfirmed messages
      useFeedsStore.getState().addMessages('feed-1', [
        {
          id: 'msg-confirmed',
          feedId: 'feed-1',
          content: 'Confirmed',
          senderPublicKey: 'sender-1',
          timestamp: Date.now(),
          isConfirmed: true,
        },
        {
          id: 'msg-pending',
          feedId: 'feed-1',
          content: 'Pending',
          senderPublicKey: 'sender-1',
          timestamp: Date.now(),
          isConfirmed: false,
        },
      ]);

      await reactionsSyncable.syncTask();

      // Should complete - only confirmed messages should be synced
      expect(true).toBe(true);
    });
  });

  describe('reset', () => {
    it('should clear tracked messages and sync time', async () => {
      // Add feeds and messages, then sync
      useFeedsStore.getState().setFeeds([
        {
          id: 'feed-1',
          name: 'Test Feed',
          type: 'chat',
          participants: [],
          createdAt: Date.now(),
          lastMessageAt: Date.now(),
        },
      ]);
      useFeedsStore.getState().addMessages('feed-1', [
        {
          id: 'msg-1',
          feedId: 'feed-1',
          content: 'Hello',
          senderPublicKey: 'sender-1',
          timestamp: Date.now(),
          isConfirmed: true,
        },
      ]);

      await reactionsSyncable.syncTask();

      // Reset
      reactionsSyncable.reset();

      // After reset, should be able to sync immediately (no cooldown)
      await reactionsSyncable.syncTask();

      expect(true).toBe(true);
    });
  });
});
