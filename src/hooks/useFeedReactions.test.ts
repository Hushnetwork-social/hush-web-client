/**
 * useFeedReactions Hook Tests
 *
 * Tests for:
 * 1. Key derivation from AES key
 * 2. Key rotation detection and re-derivation
 * 3. Reaction submission with correct key
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFeedReactions } from './useFeedReactions';

// Mock dependencies
vi.mock('@/modules/reactions/useReactionsStore', () => ({
  useReactionsStore: vi.fn((selector) => {
    const state = {
      reactions: {},
      pendingReactions: {},
      isProverReady: false,
      userSecret: 'test-secret',
      setPendingReaction: vi.fn(),
      confirmReaction: vi.fn(),
      revertReaction: vi.fn(),
    };
    return selector(state);
  }),
  EMPTY_EMOJI_COUNTS: [0, 0, 0, 0, 0, 0],
}));

vi.mock('@/modules/reactions/ReactionsService', () => ({
  reactionsServiceInstance: {
    submitReactionDevMode: vi.fn().mockResolvedValue(undefined),
    removeReactionDevMode: vi.fn().mockResolvedValue(undefined),
    getTallies: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/crypto/reactions', () => ({
  deriveFeedElGamalKey: vi.fn().mockResolvedValue(123456n),
  scalarMul: vi.fn().mockReturnValue({ x: 1n, y: 2n }),
  getGenerator: vi.fn().mockReturnValue({ x: 0n, y: 1n }),
  bsgsManager: {
    ensureLoaded: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/debug-logger', () => ({
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
  debugError: vi.fn(),
}));

vi.mock('@/modules/feeds/useFeedsStore', () => ({
  useFeedsStore: {
    getState: vi.fn().mockReturnValue({
      messages: {},
    }),
  },
}));

import { deriveFeedElGamalKey, scalarMul } from '@/lib/crypto/reactions';
import { debugLog } from '@/lib/debug-logger';

describe('useFeedReactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Key Derivation', () => {
    it('should derive ElGamal key when feedAesKey is provided', async () => {
      renderHook(() =>
        useFeedReactions({
          feedId: 'test-feed-id',
          feedAesKey: 'test-aes-key-base64==',
        })
      );

      // Wait for async key derivation
      await waitFor(() => {
        expect(deriveFeedElGamalKey).toHaveBeenCalledWith('test-aes-key-base64==');
      });

      expect(scalarMul).toHaveBeenCalled();
    });

    it('should not derive key when feedAesKey is undefined', async () => {
      renderHook(() =>
        useFeedReactions({
          feedId: 'test-feed-id',
          feedAesKey: undefined,
        })
      );

      // Wait a bit to ensure no derivation happens
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(deriveFeedElGamalKey).not.toHaveBeenCalled();
    });

    it('should re-derive key when feedAesKey changes (key rotation)', async () => {
      const { rerender } = renderHook(
        ({ feedAesKey }) =>
          useFeedReactions({
            feedId: 'test-feed-id',
            feedAesKey,
          }),
        { initialProps: { feedAesKey: 'old-key-base64==' } }
      );

      // Wait for initial derivation
      await waitFor(() => {
        expect(deriveFeedElGamalKey).toHaveBeenCalledWith('old-key-base64==');
      });

      vi.clearAllMocks();

      // Simulate key rotation by changing the AES key
      rerender({ feedAesKey: 'new-key-base64==' });

      // Wait for re-derivation with new key
      await waitFor(() => {
        expect(deriveFeedElGamalKey).toHaveBeenCalledWith('new-key-base64==');
      });

      // Should log the key rotation detection
      expect(debugLog).toHaveBeenCalledWith(
        expect.stringContaining('AES key changed')
      );
    });

    it('should not re-derive key when feedAesKey stays the same', async () => {
      const { rerender } = renderHook(
        ({ feedAesKey }) =>
          useFeedReactions({
            feedId: 'test-feed-id',
            feedAesKey,
          }),
        { initialProps: { feedAesKey: 'same-key-base64==' } }
      );

      // Wait for initial derivation
      await waitFor(() => {
        expect(deriveFeedElGamalKey).toHaveBeenCalledTimes(1);
      });

      vi.clearAllMocks();

      // Rerender with same key
      rerender({ feedAesKey: 'same-key-base64==' });

      // Wait a bit to ensure no extra derivation
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should NOT re-derive
      expect(deriveFeedElGamalKey).not.toHaveBeenCalled();
    });
  });

  describe('Reaction Counts', () => {
    it('should return empty counts for unknown message', () => {
      const { result } = renderHook(() =>
        useFeedReactions({
          feedId: 'test-feed-id',
          feedAesKey: 'test-key==',
        })
      );

      const counts = result.current.getReactionCounts('unknown-message-id');
      expect(counts).toEqual([0, 0, 0, 0, 0, 0]);
    });
  });

  describe('My Reaction', () => {
    it('should return null for message with no reaction', () => {
      const { result } = renderHook(() =>
        useFeedReactions({
          feedId: 'test-feed-id',
          feedAesKey: 'test-key==',
        })
      );

      const myReaction = result.current.getMyReaction('unknown-message-id');
      expect(myReaction).toBeNull();
    });
  });

  describe('isReady', () => {
    it('should be false when feedAesKey is not provided', () => {
      const { result } = renderHook(() =>
        useFeedReactions({
          feedId: 'test-feed-id',
          feedAesKey: undefined,
        })
      );

      expect(result.current.isReady).toBe(false);
    });
  });
});
