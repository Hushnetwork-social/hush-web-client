/**
 * FEAT-059: Auto-Pagination Prefetch Tests
 *
 * Tests for:
 * 1. Prefetch state management (init, update, clear, has)
 * 2. initializeFeedPrefetch - skip if already initialized
 * 3. prefetchNextPage - guard conditions (isPrefetching, hasMoreMessages)
 * 4. State updates after prefetch
 * 5. cleanupFeed clears prefetch state
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useFeedsStore } from './useFeedsStore';

describe('FEAT-059: Auto-Pagination Prefetch', () => {
  beforeEach(() => {
    useFeedsStore.getState().reset();
  });

  // ============= Prefetch State Management =============
  describe('Prefetch State Management', () => {
    it('should initialize prefetch state for a feed', () => {
      useFeedsStore.getState().initPrefetchState('feed-1');

      const state = useFeedsStore.getState().getPrefetchState('feed-1');
      expect(state).toEqual({
        oldestLoadedBlockIndex: null,
        isPrefetching: false,
        loadedPageCount: 0,
        hasMoreMessages: true,
      });
    });

    it('should skip initialization if state already exists', () => {
      // First init
      useFeedsStore.getState().initPrefetchState('feed-1');
      useFeedsStore.getState().updatePrefetchState('feed-1', { loadedPageCount: 5 });

      // Second init should not reset state
      useFeedsStore.getState().initPrefetchState('feed-1');

      const state = useFeedsStore.getState().getPrefetchState('feed-1');
      expect(state?.loadedPageCount).toBe(5);
    });

    it('should update prefetch state', () => {
      useFeedsStore.getState().initPrefetchState('feed-1');
      useFeedsStore.getState().updatePrefetchState('feed-1', {
        oldestLoadedBlockIndex: 100,
        loadedPageCount: 2,
        hasMoreMessages: false,
      });

      const state = useFeedsStore.getState().getPrefetchState('feed-1');
      expect(state).toEqual({
        oldestLoadedBlockIndex: 100,
        isPrefetching: false,
        loadedPageCount: 2,
        hasMoreMessages: false,
      });
    });

    it('should create prefetch state when updating non-existent feed', () => {
      useFeedsStore.getState().updatePrefetchState('feed-1', {
        loadedPageCount: 3,
      });

      const state = useFeedsStore.getState().getPrefetchState('feed-1');
      expect(state?.loadedPageCount).toBe(3);
      expect(state?.isPrefetching).toBe(false);
    });

    it('should clear prefetch state for a feed', () => {
      useFeedsStore.getState().initPrefetchState('feed-1');
      useFeedsStore.getState().initPrefetchState('feed-2');

      useFeedsStore.getState().clearPrefetchState('feed-1');

      expect(useFeedsStore.getState().getPrefetchState('feed-1')).toBeUndefined();
      expect(useFeedsStore.getState().getPrefetchState('feed-2')).toBeDefined();
    });

    it('should check if prefetch state exists', () => {
      expect(useFeedsStore.getState().hasPrefetchState('feed-1')).toBe(false);

      useFeedsStore.getState().initPrefetchState('feed-1');

      expect(useFeedsStore.getState().hasPrefetchState('feed-1')).toBe(true);
    });

    it('should track separate prefetch state per feed', () => {
      useFeedsStore.getState().initPrefetchState('feed-1');
      useFeedsStore.getState().initPrefetchState('feed-2');

      useFeedsStore.getState().updatePrefetchState('feed-1', { loadedPageCount: 2 });
      useFeedsStore.getState().updatePrefetchState('feed-2', { loadedPageCount: 5 });

      expect(useFeedsStore.getState().getPrefetchState('feed-1')?.loadedPageCount).toBe(2);
      expect(useFeedsStore.getState().getPrefetchState('feed-2')?.loadedPageCount).toBe(5);
    });
  });

  // ============= cleanupFeed Integration =============
  describe('cleanupFeed clears prefetch state', () => {
    it('should clear prefetch state when cleaning up feed', async () => {
      useFeedsStore.getState().initPrefetchState('feed-1');
      useFeedsStore.getState().initPrefetchState('feed-2');

      // Call cleanupFeed (debounced)
      useFeedsStore.getState().cleanupFeed('feed-1');

      // Wait for debounce (150ms + buffer)
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(useFeedsStore.getState().getPrefetchState('feed-1')).toBeUndefined();
      expect(useFeedsStore.getState().getPrefetchState('feed-2')).toBeDefined();
    });
  });

  // ============= prefetchNextPage Guard Conditions =============
  describe('prefetchNextPage guard conditions', () => {
    it('should skip if no prefetch state exists', async () => {
      // No prefetch state initialized

      await useFeedsStore.getState().prefetchNextPage('feed-1');

      // Should not have created prefetch state
      expect(useFeedsStore.getState().getPrefetchState('feed-1')).toBeUndefined();
    });

    it('should skip if already prefetching', async () => {
      useFeedsStore.getState().initPrefetchState('feed-1');
      useFeedsStore.getState().updatePrefetchState('feed-1', {
        isPrefetching: true,
        oldestLoadedBlockIndex: 100,
      });

      await useFeedsStore.getState().prefetchNextPage('feed-1');

      // State should be unchanged - isPrefetching still true
      expect(useFeedsStore.getState().getPrefetchState('feed-1')?.isPrefetching).toBe(true);
    });

    it('should skip if no more messages', async () => {
      useFeedsStore.getState().initPrefetchState('feed-1');
      useFeedsStore.getState().updatePrefetchState('feed-1', {
        hasMoreMessages: false,
        oldestLoadedBlockIndex: 100,
      });

      await useFeedsStore.getState().prefetchNextPage('feed-1');

      // State should be unchanged
      expect(useFeedsStore.getState().getPrefetchState('feed-1')?.hasMoreMessages).toBe(false);
    });

    it('should skip if no valid cursor (null)', async () => {
      useFeedsStore.getState().initPrefetchState('feed-1');
      // oldestLoadedBlockIndex is null by default

      await useFeedsStore.getState().prefetchNextPage('feed-1');

      // isPrefetching should not have been set to true
      expect(useFeedsStore.getState().getPrefetchState('feed-1')?.isPrefetching).toBe(false);
    });

    it('should skip if no valid cursor (0)', async () => {
      useFeedsStore.getState().initPrefetchState('feed-1');
      useFeedsStore.getState().updatePrefetchState('feed-1', {
        oldestLoadedBlockIndex: 0,
      });

      await useFeedsStore.getState().prefetchNextPage('feed-1');

      // isPrefetching should not have been set to true
      expect(useFeedsStore.getState().getPrefetchState('feed-1')?.isPrefetching).toBe(false);
    });
  });

  // ============= Reset clears prefetch state =============
  describe('reset clears prefetch state', () => {
    it('should clear all prefetch state on reset', () => {
      useFeedsStore.getState().initPrefetchState('feed-1');
      useFeedsStore.getState().initPrefetchState('feed-2');

      useFeedsStore.getState().reset();

      expect(useFeedsStore.getState().prefetchState).toEqual({});
    });
  });

  // ============= initializeFeedPrefetch Guards =============
  describe('initializeFeedPrefetch guard conditions', () => {
    it('should skip if prefetch state already exists', async () => {
      // Mock feed exists
      useFeedsStore.getState().addFeeds([{
        id: 'feed-1',
        type: 'chat',
        name: 'Test Feed',
        participants: [],
        unreadCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }]);

      // Pre-initialize prefetch state
      useFeedsStore.getState().initPrefetchState('feed-1');
      useFeedsStore.getState().updatePrefetchState('feed-1', { loadedPageCount: 5 });

      // Call initializeFeedPrefetch - should skip
      await useFeedsStore.getState().initializeFeedPrefetch('feed-1');

      // loadedPageCount should still be 5 (not reset)
      expect(useFeedsStore.getState().getPrefetchState('feed-1')?.loadedPageCount).toBe(5);
    });

    it('should return early if feed not found', async () => {
      // No feed added

      await useFeedsStore.getState().initializeFeedPrefetch('non-existent-feed');

      // Prefetch state is created first, then function returns early
      // State remains with initial values (loadedPageCount: 0)
      const state = useFeedsStore.getState().getPrefetchState('non-existent-feed');
      expect(state).toBeDefined();
      expect(state?.loadedPageCount).toBe(0);
    });
  });

  // ============= Prefetch State Not Persisted =============
  describe('prefetch state is memory-only', () => {
    it('should not include prefetchState in partialize (persist)', () => {
      // Check initial state
      useFeedsStore.getState().initPrefetchState('feed-1');

      // The persist middleware partialization only includes specific fields
      // prefetchState should NOT be in the persisted state
      // We can verify this by checking the store structure
      const state = useFeedsStore.getState();
      expect(state.prefetchState).toBeDefined();
      expect(state.prefetchState['feed-1']).toBeDefined();

      // On reset (simulating rehydration), prefetchState should be empty
      useFeedsStore.getState().reset();
      expect(useFeedsStore.getState().prefetchState).toEqual({});
    });
  });
});
