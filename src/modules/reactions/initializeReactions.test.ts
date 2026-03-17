import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useReactionsStore } from './useReactionsStore';
import { initializeReactionsSystem } from './initializeReactions';

const { initializeMock } = vi.hoisted(() => ({
  initializeMock: vi.fn(),
}));

vi.mock('@/lib/debug-logger', () => ({
  debugLog: vi.fn(),
  debugError: vi.fn(),
}));

vi.mock('@/lib/crypto/reactions/poseidon', () => ({
  initializePoseidon: vi.fn().mockResolvedValue(undefined),
  computeCommitment: vi.fn().mockResolvedValue(123n),
}));

vi.mock('./MembershipProofManager', () => ({
  membershipProofManager: {
    isMember: vi.fn(),
    registerCommitment: vi.fn(),
  },
}));

vi.mock('./ReactionsService', () => ({
  reactionsServiceInstance: {
    initialize: initializeMock,
  },
}));

describe('initializeReactionsSystem', () => {
  beforeEach(() => {
    useReactionsStore.getState().reset();
    initializeMock.mockReset();

    vi.spyOn(globalThis.crypto.subtle, 'importKey').mockResolvedValue({} as CryptoKey);
    vi.spyOn(globalThis.crypto.subtle, 'deriveBits').mockResolvedValue(new Uint8Array(32).fill(7).buffer);
  });

  it('initializes the supported reaction proof path after deriving credentials', async () => {
    initializeMock.mockImplementation(async () => {
      const store = useReactionsStore.getState();
      store.setProverReady(true);
      store.setBsgsReady(true);
    });

    const success = await initializeReactionsSystem(['alpha', 'beta', 'gamma']);
    const state = useReactionsStore.getState();

    expect(success).toBe(true);
    expect(state.userSecret).not.toBeNull();
    expect(state.userCommitment).toBe(123n);
    expect(state.isProverReady).toBe(true);
    expect(state.isBsgsReady).toBe(true);
    expect(initializeMock).toHaveBeenCalledTimes(1);
  });

  it('fails initialization if the supported proof path cannot be initialized', async () => {
    initializeMock.mockRejectedValue(new Error('init failed'));

    const success = await initializeReactionsSystem(['alpha', 'beta', 'gamma']);

    expect(success).toBe(false);
    expect(initializeMock).toHaveBeenCalledTimes(1);
  });
});
