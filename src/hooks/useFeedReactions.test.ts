/**
 * useFeedReactions Hook Tests
 *
 * Tests for:
 * 1. Key derivation from AES key
 * 2. Key rotation detection and re-derivation
 * 3. Reaction submission with correct key
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useFeedReactions } from './useFeedReactions';

const hoistedFeedStore = vi.hoisted(() => ({
  getMessageById: vi.fn(() => ({
    id: 'message-1',
    authorCommitment: btoa(String.fromCharCode(...new Uint8Array(32).fill(1))),
  })),
}));

const { ensureCommitmentRegisteredMock } = vi.hoisted(() => ({
  ensureCommitmentRegisteredMock: vi.fn().mockResolvedValue(true),
}));

const { initializeReactionsSystemMock } = vi.hoisted(() => ({
  initializeReactionsSystemMock: vi.fn().mockResolvedValue(true),
}));

const { deriveGlobalMembershipMock } = vi.hoisted(() => ({
  deriveGlobalMembershipMock: vi.fn().mockResolvedValue({
    userSecretHex: "0309",
    userCommitmentHex: "0378",
    userCommitmentBase64: "unused",
  }),
}));

const mockReactionsState = {
  reactions: {},
  pendingReactions: {},
  isProverReady: false,
  userSecret: 'test-secret',
  setPendingReaction: vi.fn(),
  confirmReaction: vi.fn(),
  revertReaction: vi.fn(),
};

// Mock dependencies
vi.mock('@/modules/reactions/useReactionsStore', () => ({
  useReactionsStore: Object.assign(
    vi.fn((selector) => {
      return selector(mockReactionsState);
    }),
    {
      getState: vi.fn(() => mockReactionsState),
    }
  ),
  EMPTY_EMOJI_COUNTS: [0, 0, 0, 0, 0, 0],
}));

vi.mock('@/modules/reactions/ReactionsService', () => ({
  reactionsServiceInstance: {
    submitReactionDevMode: vi.fn().mockResolvedValue(undefined),
    submitReaction: vi.fn().mockResolvedValue('tx-1'),
    removeReaction: vi.fn().mockResolvedValue('tx-2'),
    removeReactionDevMode: vi.fn().mockResolvedValue(undefined),
    getTallies: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/modules/reactions/initializeReactions', () => ({
  ensureCommitmentRegistered: ensureCommitmentRegisteredMock,
  initializeReactionsSystem: initializeReactionsSystemMock,
}));

vi.mock('@/stores', () => ({
  useAppStore: vi.fn((selector) =>
    selector({
      credentials: {
        mnemonic: ['alpha', 'beta', 'gamma'],
        signingPublicKey: '0349f6768a0751dce9e3775cde70468e6eb4977c9484003f661fa04f82ca629ee7',
      },
    })
  ),
}));

vi.mock('@/lib/grpc/services/membership-binary', () => ({
  membershipServiceBinary: {
    deriveGlobalMembership: deriveGlobalMembershipMock,
  },
}));

vi.mock('@/lib/crypto/reactions', () => ({
  deriveFeedElGamalKey: vi.fn().mockResolvedValue(123456n),
  deriveDeterministicReactionScopeKey: vi.fn().mockResolvedValue(654321n),
  deriveAddressMembershipSecret: vi.fn().mockResolvedValue(777n),
  computeCommitment: vi.fn().mockResolvedValue(888n),
  scalarMul: vi.fn().mockReturnValue({ x: 1n, y: 2n }),
  getGenerator: vi.fn().mockReturnValue({ x: 0n, y: 1n }),
  bytesToBigint: vi.fn().mockReturnValue(1n),
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
  useFeedsStore: Object.assign(
    vi.fn((selector) => selector(hoistedFeedStore)),
    {
      getState: vi.fn(() => ({
        messages: {},
        getMessageById: hoistedFeedStore.getMessageById,
      })),
    }
  ),
}));

import {
  deriveFeedElGamalKey,
  deriveDeterministicReactionScopeKey,
  deriveAddressMembershipSecret,
  computeCommitment,
  scalarMul,
} from '@/lib/crypto/reactions';
import { debugLog } from '@/lib/debug-logger';
import { reactionsServiceInstance } from '@/modules/reactions/ReactionsService';
import { GLOBAL_HUSH_MEMBERS_SCOPE_ID } from '@/modules/reactions/publicScope';
import { membershipServiceBinary } from '@/lib/grpc/services/membership-binary';

describe('useFeedReactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureCommitmentRegisteredMock.mockResolvedValue(true);
    initializeReactionsSystemMock.mockResolvedValue(true);
    mockReactionsState.reactions = {};
    mockReactionsState.pendingReactions = {};
    mockReactionsState.isProverReady = false;
    mockReactionsState.userSecret = 'test-secret';
    hoistedFeedStore.getMessageById.mockReturnValue({
      id: 'message-1',
      authorCommitment: btoa(String.fromCharCode(...new Uint8Array(32).fill(1))),
    });
    process.env.NEXT_PUBLIC_REACTIONS_ALLOW_DEV_MODE = 'false';
    deriveGlobalMembershipMock.mockResolvedValue({
      userSecretHex: '0309',
      userCommitmentHex: '0378',
      userCommitmentBase64: 'unused',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_REACTIONS_ALLOW_DEV_MODE = 'false';
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

  describe('Tally Fetching', () => {
    it('deduplicates repeated tally fetches by default', async () => {
      mockReactionsState.isProverReady = true;
      const { result } = renderHook(() =>
        useFeedReactions({
          feedId: 'tally-feed-id-1',
          feedAesKey: 'tally-feed-key-1==',
        })
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      await result.current.fetchTalliesForMessages(['message-1']);
      await result.current.fetchTalliesForMessages(['message-1']);

      expect(reactionsServiceInstance.getTallies).toHaveBeenCalledTimes(1);
      expect(reactionsServiceInstance.getTallies).toHaveBeenCalledWith(
        'tally-feed-id-1',
        ['message-1'],
        123456n
      );
    });

    it('allows forced tally refreshes for already-fetched messages', async () => {
      mockReactionsState.isProverReady = true;
      const { result } = renderHook(() =>
        useFeedReactions({
          feedId: 'tally-feed-id-2',
          feedAesKey: 'tally-feed-key-2==',
        })
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      await result.current.fetchTalliesForMessages(['message-1']);
      await result.current.fetchTalliesForMessages(['message-1'], { forceRefresh: true });

      expect(reactionsServiceInstance.getTallies).toHaveBeenCalledTimes(2);
      expect(reactionsServiceInstance.getTallies).toHaveBeenNthCalledWith(
        2,
        'tally-feed-id-2',
        ['message-1'],
        123456n
      );
    });

    it('allows concurrent tally fetches for different message ids in the same reaction scope', async () => {
      mockReactionsState.isProverReady = true;

      let resolveFirstFetch: (() => void) | null = null;
      vi.mocked(reactionsServiceInstance.getTallies)
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveFirstFetch = resolve;
            })
        )
        .mockResolvedValueOnce(undefined);

      const { result: first } = renderHook(() =>
        useFeedReactions({
          feedId: 'shared-scope-id',
          feedAesKey: 'shared-scope-key==',
        })
      );

      const { result: second } = renderHook(() =>
        useFeedReactions({
          feedId: 'shared-scope-id',
          feedAesKey: 'shared-scope-key==',
        })
      );

      await waitFor(() => {
        expect(first.current.isReady).toBe(true);
        expect(second.current.isReady).toBe(true);
      });

      const firstFetchPromise = act(async () => {
        await first.current.fetchTalliesForMessages(['message-1']);
      });

      await waitFor(() => {
        expect(reactionsServiceInstance.getTallies).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        await second.current.fetchTalliesForMessages(['message-2']);
      });

      expect(reactionsServiceInstance.getTallies).toHaveBeenCalledTimes(2);
      expect(reactionsServiceInstance.getTallies).toHaveBeenNthCalledWith(
        1,
        'shared-scope-id',
        ['message-1'],
        123456n
      );
      expect(reactionsServiceInstance.getTallies).toHaveBeenNthCalledWith(
        2,
        'shared-scope-id',
        ['message-2'],
        123456n
      );

      resolveFirstFetch?.();
      await firstFetchPromise;
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

  describe('Proof Guardrails', () => {
    it('should fail closed when prover is not ready and dev mode is not explicitly enabled', async () => {
      const { result } = renderHook(() =>
        useFeedReactions({
          feedId: 'proof-guard-feed-id-1',
          feedAesKey: 'proof-guard-aes-key-1==',
        })
      );

      await waitFor(() => {
        expect(deriveFeedElGamalKey).toHaveBeenCalled();
      });

      await result.current.handleReactionSelect('message-1', 2);

      expect(mockReactionsState.setPendingReaction).toHaveBeenCalledWith('message-1', 2);
      expect(mockReactionsState.revertReaction).toHaveBeenCalledWith('message-1');
      expect(reactionsServiceInstance.submitReactionDevMode).not.toHaveBeenCalled();
    });

    it('should only use dev mode submission when explicitly enabled', async () => {
      process.env.NEXT_PUBLIC_REACTIONS_ALLOW_DEV_MODE = 'true';
      hoistedFeedStore.getMessageById.mockReturnValue({
        id: 'message-1',
        authorCommitment: undefined,
      });

      const { result } = renderHook(() =>
        useFeedReactions({
          feedId: 'proof-guard-feed-id-2',
          feedAesKey: 'proof-guard-aes-key-2==',
        })
      );

      await waitFor(() => {
        expect(deriveFeedElGamalKey).toHaveBeenCalled();
      });

      await result.current.handleReactionSelect('message-1', 2);

      expect(ensureCommitmentRegisteredMock).not.toHaveBeenCalled();
      expect(reactionsServiceInstance.submitReactionDevMode).toHaveBeenCalled();
      expect(mockReactionsState.revertReaction).not.toHaveBeenCalled();
    });

    it('should fail closed when author commitment is missing outside dev mode', async () => {
      mockReactionsState.isProverReady = true;
      hoistedFeedStore.getMessageById.mockReturnValue({
        id: 'message-1',
        authorCommitment: undefined,
      });

      const { result } = renderHook(() =>
        useFeedReactions({
          feedId: 'proof-guard-feed-id-4',
          feedAesKey: 'proof-guard-aes-key-4==',
        })
      );

      await waitFor(() => {
        expect(deriveFeedElGamalKey).toHaveBeenCalled();
      });

      await result.current.handleReactionSelect('message-1', 2);

      expect(ensureCommitmentRegisteredMock).toHaveBeenCalledWith(
        'proof-guard-feed-id-4',
        undefined
      );
      expect(mockReactionsState.revertReaction).toHaveBeenCalledWith('message-1');
      expect(reactionsServiceInstance.submitReactionDevMode).not.toHaveBeenCalled();
    });

    it('uses the address-derived global membership commitment for open-post reactions', async () => {
      mockReactionsState.isProverReady = true;

      const { result } = renderHook(() =>
        useFeedReactions({
          feedId: '62ab0d24-96a4-420e-bffd-5ce2eaf079b8',
          publicReactionKeyScopeId: '62ab0d24-96a4-420e-bffd-5ce2eaf079b8',
          membershipFeedId: GLOBAL_HUSH_MEMBERS_SCOPE_ID,
        })
      );

      await waitFor(() => {
        expect(reactionsServiceInstance.submitReaction).not.toHaveBeenCalled();
      });

      await result.current.handleReactionSelect('message-1', 2);

      expect(membershipServiceBinary.deriveGlobalMembership).toHaveBeenCalledWith(
        '0349f6768a0751dce9e3775cde70468e6eb4977c9484003f661fa04f82ca629ee7'
      );
      expect(ensureCommitmentRegisteredMock).toHaveBeenCalledWith(
        GLOBAL_HUSH_MEMBERS_SCOPE_ID,
        888n
      );
      expect(reactionsServiceInstance.submitReaction).toHaveBeenCalled();
      expect(deriveAddressMembershipSecret).not.toHaveBeenCalled();
    });

    it('falls back to local derivation when the global membership proxy is unavailable', async () => {
      mockReactionsState.isProverReady = true;
      deriveGlobalMembershipMock.mockRejectedValueOnce(new Error('proxy unavailable'));

      const { result } = renderHook(() =>
        useFeedReactions({
          feedId: '62ab0d24-96a4-420e-bffd-5ce2eaf079b8',
          publicReactionKeyScopeId: '62ab0d24-96a4-420e-bffd-5ce2eaf079b8',
          membershipFeedId: GLOBAL_HUSH_MEMBERS_SCOPE_ID,
        })
      );

      await waitFor(() => {
        expect(reactionsServiceInstance.submitReaction).not.toHaveBeenCalled();
      });

      await result.current.handleReactionSelect('message-1', 2);

      expect(membershipServiceBinary.deriveGlobalMembership).toHaveBeenCalled();
      expect(deriveAddressMembershipSecret).toHaveBeenCalledWith(
        '0349f6768a0751dce9e3775cde70468e6eb4977c9484003f661fa04f82ca629ee7'
      );
      expect(computeCommitment).toHaveBeenCalledWith(777n);
      expect(ensureCommitmentRegisteredMock).toHaveBeenCalledWith(
        GLOBAL_HUSH_MEMBERS_SCOPE_ID,
        888n
      );
    });

    it('reverts the first reaction and exposes the error when non-dev proof generation times out', async () => {
      mockReactionsState.isProverReady = true;
      vi.mocked(reactionsServiceInstance.submitReaction).mockRejectedValueOnce(
        new Error('ZK proof generation timed out after 12000ms')
      );

      const { result } = renderHook(() =>
        useFeedReactions({
          feedId: 'proof-guard-feed-id-timeout',
          feedAesKey: 'proof-guard-aes-key-timeout==',
        })
      );

      await waitFor(() => {
        expect(deriveFeedElGamalKey).toHaveBeenCalled();
      });

      await result.current.handleReactionSelect('message-1', 2);

      expect(ensureCommitmentRegisteredMock).toHaveBeenCalledWith(
        'proof-guard-feed-id-timeout',
        undefined
      );
      expect(reactionsServiceInstance.submitReaction).toHaveBeenCalledTimes(1);
      expect(mockReactionsState.setPendingReaction).toHaveBeenCalledWith('message-1', 2);
      expect(mockReactionsState.confirmReaction).not.toHaveBeenCalled();
      expect(mockReactionsState.revertReaction).toHaveBeenCalledWith('message-1');
      await waitFor(() => {
        expect(result.current.error).toBe('ZK proof generation timed out after 12000ms');
      });
    });

    it('continues in dev mode when feed commitment registration is unavailable', async () => {
      process.env.NEXT_PUBLIC_REACTIONS_ALLOW_DEV_MODE = 'true';
      ensureCommitmentRegisteredMock.mockResolvedValue(false);

      const { result } = renderHook(() =>
        useFeedReactions({
          feedId: 'proof-guard-feed-id-5',
          feedAesKey: 'proof-guard-aes-key-5==',
        })
      );

      await waitFor(() => {
        expect(deriveFeedElGamalKey).toHaveBeenCalled();
      });

      await result.current.handleReactionSelect('message-1', 2);

      expect(ensureCommitmentRegisteredMock).not.toHaveBeenCalled();
      expect(mockReactionsState.revertReaction).not.toHaveBeenCalled();
      expect(reactionsServiceInstance.submitReactionDevMode).toHaveBeenCalled();
    });

    it('bootstraps reaction credentials from mnemonic when the hook is used before sync initialization', async () => {
      process.env.NEXT_PUBLIC_REACTIONS_ALLOW_DEV_MODE = 'true';
      mockReactionsState.userSecret = null;
      initializeReactionsSystemMock.mockImplementation(async () => {
        mockReactionsState.userSecret = 'initialized-secret';
        return true;
      });

      const { result } = renderHook(() =>
        useFeedReactions({
          feedId: 'proof-guard-feed-id-6',
          feedAesKey: 'proof-guard-aes-key-6==',
        })
      );

      await waitFor(() => {
        expect(deriveFeedElGamalKey).toHaveBeenCalled();
      });

      await result.current.handleReactionSelect('message-1', 2);

      expect(initializeReactionsSystemMock).toHaveBeenCalledWith(['alpha', 'beta', 'gamma']);
      expect(ensureCommitmentRegisteredMock).not.toHaveBeenCalled();
      expect(reactionsServiceInstance.submitReactionDevMode).toHaveBeenCalled();
    });

    it('derives the feed reaction key on demand when the user reacts before the effect-driven key setup finishes', async () => {
      process.env.NEXT_PUBLIC_REACTIONS_ALLOW_DEV_MODE = 'true';

      const { result } = renderHook(() =>
        useFeedReactions({
          feedId: 'proof-guard-feed-id-7',
          feedAesKey: 'proof-guard-aes-key-7==',
        })
      );

      await result.current.handleReactionSelect('message-1', 2);

      expect(deriveFeedElGamalKey).toHaveBeenCalledWith('proof-guard-aes-key-7==');
      expect(ensureCommitmentRegisteredMock).not.toHaveBeenCalled();
      expect(reactionsServiceInstance.submitReactionDevMode).toHaveBeenCalled();
    });

    it('derives the public reaction scope key on demand for open-post reactions', async () => {
      mockReactionsState.isProverReady = true;

      const { result } = renderHook(() =>
        useFeedReactions({
          feedId: 'open-scope-message-id',
          publicReactionKeyScopeId: 'open-scope-message-id',
          membershipFeedId: GLOBAL_HUSH_MEMBERS_SCOPE_ID,
        })
      );

      await result.current.handleReactionSelect('message-1', 2);

      expect(deriveDeterministicReactionScopeKey).toHaveBeenCalledWith('open-scope-message-id');
      expect(reactionsServiceInstance.submitReaction).toHaveBeenCalled();
    });

    it('re-reads the initialized user secret before submitting a production reaction', async () => {
      mockReactionsState.isProverReady = true;
      mockReactionsState.userSecret = null;
      initializeReactionsSystemMock.mockImplementation(async () => {
        mockReactionsState.userSecret = 999n;
        return true;
      });

      const { result } = renderHook(() =>
        useFeedReactions({
          feedId: 'proof-guard-feed-id-8',
          feedAesKey: 'proof-guard-aes-key-8==',
        })
      );

      await result.current.handleReactionSelect('message-1', 2);

      expect(initializeReactionsSystemMock).toHaveBeenCalledWith(['alpha', 'beta', 'gamma']);
      expect(reactionsServiceInstance.submitReaction).toHaveBeenCalledWith(
        'proof-guard-feed-id-8',
        'message-1',
        2,
        { x: 1n, y: 2n },
        1n,
        'proof-guard-feed-id-8',
        999n,
        undefined
      );
    });

    it('ignores duplicate clicks while a reaction is already pending for the same message', async () => {
      mockReactionsState.pendingReactions = {
        'message-1': {
          emojiIndex: 2,
          submittedAt: Date.now(),
        },
      };

      const { result } = renderHook(() =>
        useFeedReactions({
          feedId: 'proof-guard-feed-id-3',
          feedAesKey: 'proof-guard-aes-key-3==',
        })
      );

      await waitFor(() => {
        expect(deriveFeedElGamalKey).toHaveBeenCalled();
      });

      await result.current.handleReactionSelect('message-1', 2);

      expect(mockReactionsState.setPendingReaction).not.toHaveBeenCalled();
      expect(reactionsServiceInstance.submitReactionDevMode).not.toHaveBeenCalled();
    });
  });
});
