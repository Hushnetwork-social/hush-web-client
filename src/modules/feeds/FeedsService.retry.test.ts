/**
 * FEAT-058: FeedsService Retry Logic Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransactionStatus } from './FeedsService';

// Mock the dependencies before importing the module
vi.mock('@/stores', () => ({
  useAppStore: {
    getState: vi.fn(() => ({
      credentials: {
        signingPrivateKey: '0'.repeat(64),
        signingPublicKey: 'test-public-key',
        encryptionPublicKey: 'test-encrypt-key',
      },
    })),
  },
}));

vi.mock('./useFeedsStore', () => ({
  useFeedsStore: {
    getState: vi.fn(() => ({
      getFeed: vi.fn(),
      messages: {},
      getCurrentGroupKey: vi.fn(),
      getGroupKeyState: vi.fn(),
      updateMessageRetryState: vi.fn(),
    })),
  },
  FEED_TYPE_MAP: { 0: 'personal', 1: 'chat', 2: 'group' },
}));

vi.mock('@/lib/api-config', () => ({
  buildApiUrl: vi.fn((path: string) => `http://test${path}`),
}));

vi.mock('@/lib/crypto', () => ({
  createFeedMessageTransaction: vi.fn(),
  createChatFeedTransaction: vi.fn(),
  hexToBytes: vi.fn(() => new Uint8Array(32)),
}));

vi.mock('@/lib/debug-logger', () => ({
  debugLog: vi.fn(),
  debugError: vi.fn(),
}));

describe('FEAT-058: FeedsService TransactionStatus', () => {
  describe('TransactionStatus enum', () => {
    it('should have correct values', () => {
      expect(TransactionStatus.UNSPECIFIED).toBe(0);
      expect(TransactionStatus.ACCEPTED).toBe(1);
      expect(TransactionStatus.ALREADY_EXISTS).toBe(2);
      expect(TransactionStatus.PENDING).toBe(3);
      expect(TransactionStatus.REJECTED).toBe(4);
    });

    it('should be usable as enum keys', () => {
      expect(TransactionStatus[0]).toBe('UNSPECIFIED');
      expect(TransactionStatus[1]).toBe('ACCEPTED');
      expect(TransactionStatus[2]).toBe('ALREADY_EXISTS');
      expect(TransactionStatus[3]).toBe('PENDING');
      expect(TransactionStatus[4]).toBe('REJECTED');
    });
  });

  describe('submitTransaction response handling', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it('should parse ACCEPTED status correctly', async () => {
      // Mock fetch to return ACCEPTED status
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          successful: true,
          message: 'Transaction accepted',
          status: TransactionStatus.ACCEPTED,
        }),
      });

      // Import dynamically after mocks are set up
      const { submitTransaction } = await import('./FeedsService');
      const result = await submitTransaction('test-transaction');

      expect(result.successful).toBe(true);
      expect(result.status).toBe(TransactionStatus.ACCEPTED);
    });

    it('should parse ALREADY_EXISTS status correctly', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          successful: true,
          message: 'Transaction already exists',
          status: TransactionStatus.ALREADY_EXISTS,
        }),
      });

      const { submitTransaction } = await import('./FeedsService');
      const result = await submitTransaction('test-transaction');

      expect(result.successful).toBe(true);
      expect(result.status).toBe(TransactionStatus.ALREADY_EXISTS);
    });

    it('should parse PENDING status correctly', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          successful: true,
          message: 'Transaction pending',
          status: TransactionStatus.PENDING,
        }),
      });

      const { submitTransaction } = await import('./FeedsService');
      const result = await submitTransaction('test-transaction');

      expect(result.successful).toBe(true);
      expect(result.status).toBe(TransactionStatus.PENDING);
    });

    it('should parse REJECTED status correctly', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          successful: false,
          message: 'Transaction rejected',
          status: TransactionStatus.REJECTED,
        }),
      });

      const { submitTransaction } = await import('./FeedsService');
      const result = await submitTransaction('test-transaction');

      expect(result.successful).toBe(false);
      expect(result.status).toBe(TransactionStatus.REJECTED);
    });

    it('should default to UNSPECIFIED when status is not provided', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          successful: true,
          message: 'Transaction accepted',
          // No status field
        }),
      });

      const { submitTransaction } = await import('./FeedsService');
      const result = await submitTransaction('test-transaction');

      expect(result.successful).toBe(true);
      expect(result.status).toBe(TransactionStatus.UNSPECIFIED);
    });

    it('should throw error on HTTP failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const { submitTransaction } = await import('./FeedsService');

      await expect(submitTransaction('test-transaction')).rejects.toThrow(
        'Failed to submit transaction: HTTP 500'
      );
    });
  });

  describe('retryMessage function', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it('should return error if credentials are missing', async () => {
      // Override the mock to return no credentials
      const { useAppStore } = await import('@/stores');
      vi.mocked(useAppStore.getState).mockReturnValue({
        credentials: null,
      } as ReturnType<typeof useAppStore.getState>);

      const { retryMessage, TransactionStatus } = await import('./FeedsService');
      const result = await retryMessage('feed-id', 'message-id');

      expect(result.success).toBe(false);
      expect(result.status).toBe(TransactionStatus.REJECTED);
      expect(result.error).toBe('Not authenticated');
    });

    it('should return error if feed is not found', async () => {
      const { useAppStore } = await import('@/stores');
      vi.mocked(useAppStore.getState).mockReturnValue({
        credentials: {
          signingPrivateKey: '0'.repeat(64),
          signingPublicKey: 'test-public-key',
        },
      } as ReturnType<typeof useAppStore.getState>);

      const { useFeedsStore } = await import('./useFeedsStore');
      vi.mocked(useFeedsStore.getState).mockReturnValue({
        getFeed: vi.fn(() => undefined),
        messages: {},
        updateMessageRetryState: vi.fn(),
      } as unknown as ReturnType<typeof useFeedsStore.getState>);

      const { retryMessage, TransactionStatus } = await import('./FeedsService');
      const result = await retryMessage('feed-id', 'message-id');

      expect(result.success).toBe(false);
      expect(result.status).toBe(TransactionStatus.REJECTED);
      expect(result.error).toBe('Feed not found');
    });

    it('should return error if message is not found', async () => {
      const { useAppStore } = await import('@/stores');
      vi.mocked(useAppStore.getState).mockReturnValue({
        credentials: {
          signingPrivateKey: '0'.repeat(64),
          signingPublicKey: 'test-public-key',
        },
      } as ReturnType<typeof useAppStore.getState>);

      const { useFeedsStore } = await import('./useFeedsStore');
      vi.mocked(useFeedsStore.getState).mockReturnValue({
        getFeed: vi.fn(() => ({ id: 'feed-id', type: 'chat', aesKey: 'test-key' })),
        messages: { 'feed-id': [] }, // No messages
        updateMessageRetryState: vi.fn(),
      } as unknown as ReturnType<typeof useFeedsStore.getState>);

      const { retryMessage, TransactionStatus } = await import('./FeedsService');
      const result = await retryMessage('feed-id', 'message-id');

      expect(result.success).toBe(false);
      expect(result.status).toBe(TransactionStatus.REJECTED);
      expect(result.error).toBe('Message not found');
    });

    it('should return error if message has no content for retry', async () => {
      const { useAppStore } = await import('@/stores');
      vi.mocked(useAppStore.getState).mockReturnValue({
        credentials: {
          signingPrivateKey: '0'.repeat(64),
          signingPublicKey: 'test-public-key',
        },
      } as ReturnType<typeof useAppStore.getState>);

      const { useFeedsStore } = await import('./useFeedsStore');
      vi.mocked(useFeedsStore.getState).mockReturnValue({
        getFeed: vi.fn(() => ({ id: 'feed-id', type: 'chat', aesKey: 'test-key' })),
        messages: {
          'feed-id': [{
            id: 'message-id',
            feedId: 'feed-id',
            content: '', // Empty content
            contentPlaintext: undefined,
          }],
        },
        updateMessageRetryState: vi.fn(),
      } as unknown as ReturnType<typeof useFeedsStore.getState>);

      const { retryMessage, TransactionStatus } = await import('./FeedsService');
      const result = await retryMessage('feed-id', 'message-id');

      expect(result.success).toBe(false);
      expect(result.status).toBe(TransactionStatus.REJECTED);
      expect(result.error).toBe('Message content not available for retry');
    });
  });
});
