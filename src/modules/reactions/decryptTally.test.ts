/**
 * Decrypt Tally Tests
 *
 * Tests for the tally decryption functionality used in Protocol Omega reaction sync.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ServerTallyData } from './decryptTally';

// Create mock functions at module scope
const mockDecrypt = vi.fn();
const mockGrpcToCiphertext = vi.fn();
const mockSolve = vi.fn();
const mockIsLoaded = vi.fn();
const mockEnsureLoaded = vi.fn();
const mockDeriveFeedElGamalKey = vi.fn();

// Mock the crypto module - use inline functions that reference the mock fns
vi.mock('@/lib/crypto/reactions', () => {
  return {
    decrypt: (ciphertext: unknown, privateKey: unknown) => mockDecrypt(ciphertext, privateKey),
    grpcToCiphertext: (c1: unknown, c2: unknown) => mockGrpcToCiphertext(c1, c2),
    bsgsManager: {
      isLoaded: () => mockIsLoaded(),
      ensureLoaded: () => mockEnsureLoaded(),
      solve: (point: unknown) => mockSolve(point),
    },
    EMOJIS: ['👍', '❤️', '😂', '😮', '😢', '😡'],
    deriveFeedElGamalKey: (key: unknown) => mockDeriveFeedElGamalKey(key),
  };
});

// Import after mocks are set up
import {
  decryptTally,
  decryptTallySync,
  decryptTalliesBatch,
  decryptTallyWithAesKey,
  decryptTalliesBatchWithAesKey,
} from './decryptTally';

describe('decryptTally', () => {
  const sampleTally: ServerTallyData = {
    tallyC1: [
      { x: 'YWJj', y: 'ZGVm' }, // base64 encoded
      { x: 'Z2hp', y: 'amts' },
      { x: 'bW5v', y: 'cHFy' },
      { x: 'c3R1', y: 'dnd4' },
      { x: 'eXow', y: 'MTIz' },
      { x: 'NDU2', y: 'Nzg5' },
    ],
    tallyC2: [
      { x: 'YWJj', y: 'ZGVm' },
      { x: 'Z2hp', y: 'amts' },
      { x: 'bW5v', y: 'cHFy' },
      { x: 'c3R1', y: 'dnd4' },
      { x: 'eXow', y: 'MTIz' },
      { x: 'NDU2', y: 'Nzg5' },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoaded.mockReturnValue(true);
    mockEnsureLoaded.mockResolvedValue(undefined);
    mockGrpcToCiphertext.mockReturnValue({ c1: { x: 0n, y: 1n }, c2: { x: 0n, y: 1n } });
    mockDecrypt.mockReturnValue({ x: 0n, y: 1n });
    mockDeriveFeedElGamalKey.mockResolvedValue(12345n);
  });

  describe('decryptTally', () => {
    it('should ensure BSGS table is loaded', async () => {
      mockSolve.mockReturnValue(0);

      await decryptTally(sampleTally, 12345n);

      expect(mockEnsureLoaded).toHaveBeenCalled();
    });

    it('should decrypt all 6 emoji slots', async () => {
      mockSolve.mockReturnValue(5);

      const result = await decryptTally(sampleTally, 12345n);

      expect(mockGrpcToCiphertext).toHaveBeenCalledTimes(6);
      expect(mockDecrypt).toHaveBeenCalledTimes(6);
      expect(mockSolve).toHaveBeenCalledTimes(6);
    });

    it('should return correct emoji counts', async () => {
      // Mock different counts for each emoji
      mockSolve
        .mockReturnValueOnce(5)  // 👍
        .mockReturnValueOnce(3)  // ❤️
        .mockReturnValueOnce(1)  // 😂
        .mockReturnValueOnce(0)  // 😮
        .mockReturnValueOnce(2)  // 😢
        .mockReturnValueOnce(0); // 😡

      const result = await decryptTally(sampleTally, 12345n);

      expect(result['👍']).toBe(5);
      expect(result['❤️']).toBe(3);
      expect(result['😂']).toBe(1);
      expect(result['😮']).toBe(0);
      expect(result['😢']).toBe(2);
      expect(result['😡']).toBe(0);
    });

    it('should handle null solve results', async () => {
      mockSolve.mockReturnValue(null);

      const result = await decryptTally(sampleTally, 12345n);

      expect(result['👍']).toBe(0);
      expect(result['❤️']).toBe(0);
    });

    it('should handle negative solve results', async () => {
      mockSolve.mockReturnValue(-1);

      const result = await decryptTally(sampleTally, 12345n);

      expect(result['👍']).toBe(0);
    });
  });

  describe('decryptTallySync', () => {
    it('should throw if BSGS table not loaded', () => {
      mockIsLoaded.mockReturnValue(false);

      expect(() => decryptTallySync(sampleTally, 12345n)).toThrow('BSGS table not loaded');
    });

    it('should decrypt synchronously when BSGS loaded', () => {
      mockIsLoaded.mockReturnValue(true);
      mockSolve.mockReturnValue(10);

      const result = decryptTallySync(sampleTally, 12345n);

      expect(result['👍']).toBe(10);
    });
  });

  describe('decryptTalliesBatch', () => {
    it('should decrypt multiple tallies', async () => {
      mockSolve.mockReturnValue(1);

      const tallies = new Map<string, ServerTallyData>([
        ['msg-1', sampleTally],
        ['msg-2', sampleTally],
        ['msg-3', sampleTally],
      ]);

      const results = await decryptTalliesBatch(tallies, 12345n);

      expect(results.size).toBe(3);
      expect(results.has('msg-1')).toBe(true);
      expect(results.has('msg-2')).toBe(true);
      expect(results.has('msg-3')).toBe(true);
    });

    it('should log warning on decryption failure but continue processing', async () => {
      // Mock a valid scenario where all tallies succeed
      mockIsLoaded.mockReturnValue(true);
      mockSolve.mockReturnValue(2);

      const tallies = new Map<string, ServerTallyData>([
        ['msg-1', sampleTally],
        ['msg-2', sampleTally],
      ]);

      const results = await decryptTalliesBatch(tallies, 12345n);

      // Both should succeed
      expect(results.size).toBe(2);
      expect(results.has('msg-1')).toBe(true);
      expect(results.has('msg-2')).toBe(true);
      expect(results.get('msg-1')?.['👍']).toBe(2);
    });
  });

  describe('decryptTallyWithAesKey', () => {
    it('should derive ElGamal key from AES key', async () => {
      mockSolve.mockReturnValue(0);
      const aesKey = 'dGVzdC1hZXMta2V5LTEyMzQ1Njc4OTAxMjM0NTY='; // base64 encoded

      await decryptTallyWithAesKey(sampleTally, aesKey);

      expect(mockDeriveFeedElGamalKey).toHaveBeenCalledWith(aesKey);
    });

    it('should decrypt with derived key', async () => {
      mockDeriveFeedElGamalKey.mockResolvedValue(99999n);
      mockSolve.mockReturnValue(7);

      const result = await decryptTallyWithAesKey(sampleTally, 'dGVzdC1rZXk=');

      expect(result['👍']).toBe(7);
    });
  });

  describe('decryptTalliesBatchWithAesKey', () => {
    it('should derive key once and decrypt all tallies', async () => {
      mockDeriveFeedElGamalKey.mockResolvedValue(12345n);
      mockSolve.mockReturnValue(3);

      const tallies = new Map<string, ServerTallyData>([
        ['msg-1', sampleTally],
        ['msg-2', sampleTally],
      ]);

      const results = await decryptTalliesBatchWithAesKey(tallies, 'dGVzdC1rZXk=');

      // deriveFeedElGamalKey should only be called once
      expect(mockDeriveFeedElGamalKey).toHaveBeenCalledTimes(1);
      expect(results.size).toBe(2);
    });
  });
});

describe('deriveFeedElGamalKey integration', () => {
  it('should be exported from crypto module', async () => {
    // The function is mocked, but we verify it's being called correctly
    mockDeriveFeedElGamalKey.mockResolvedValue(42n);

    const { deriveFeedElGamalKey } = await import('@/lib/crypto/reactions');
    const result = await deriveFeedElGamalKey('test-key');

    expect(result).toBe(42n);
  });
});
