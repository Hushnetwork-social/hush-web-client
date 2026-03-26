import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDecrypt = vi.fn();
const mockGrpcToCiphertext = vi.fn();
const mockSolve = vi.fn();
const mockIsLoaded = vi.fn();
const mockEnsureLoaded = vi.fn();
const mockDeriveDeterministicReactionScopeKey = vi.fn();
const mockDeriveFeedElGamalKey = vi.fn();

vi.mock('./elgamal', () => ({
  decrypt: (ciphertext: unknown, privateKey: unknown) => mockDecrypt(ciphertext, privateKey),
  grpcToCiphertext: (c1: unknown, c2: unknown) => mockGrpcToCiphertext(c1, c2),
}));

vi.mock('./bsgs', () => ({
  bsgsManager: {
    isLoaded: () => mockIsLoaded(),
    ensureLoaded: () => mockEnsureLoaded(),
    solve: (point: unknown) => mockSolve(point),
  },
}));

vi.mock('./poseidon', () => ({
  deriveDeterministicReactionScopeKey: (scopeId: string) =>
    mockDeriveDeterministicReactionScopeKey(scopeId),
  deriveFeedElGamalKey: (key: string) => mockDeriveFeedElGamalKey(key),
}));

import { decryptReactionTally } from './decryptTally';

describe('lib/crypto/reactions/decryptTally', () => {
  const samplePoints = Array.from({ length: 6 }, () => ({ x: 'YWJj', y: 'ZGVm' }));

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoaded.mockReturnValue(true);
    mockEnsureLoaded.mockResolvedValue(undefined);
    mockDeriveDeterministicReactionScopeKey.mockResolvedValue(12345n);
    mockGrpcToCiphertext.mockReturnValue({ c1: { x: 0n, y: 1n }, c2: { x: 0n, y: 1n } });
    mockDecrypt.mockReturnValue({ x: 0n, y: 1n });
    mockSolve.mockReturnValue(0);
  });

  it('derives the reaction tally key from the deterministic reaction scope', async () => {
    await decryptReactionTally(samplePoints, samplePoints, 'feed-scope-123');

    expect(mockDeriveDeterministicReactionScopeKey).toHaveBeenCalledWith('feed-scope-123');
    expect(mockDeriveFeedElGamalKey).not.toHaveBeenCalled();
  });

  it('uses the derived deterministic key to decrypt all emoji slots', async () => {
    await decryptReactionTally(samplePoints, samplePoints, 'feed-scope-456');

    expect(mockDecrypt).toHaveBeenCalledTimes(6);
    expect(mockDecrypt).toHaveBeenCalledWith(
      { c1: { x: 0n, y: 1n }, c2: { x: 0n, y: 1n } },
      12345n
    );
  });
});
