import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-config', () => ({
  buildApiUrl: vi.fn((path: string) => `http://test${path}`),
}));

vi.mock('@/lib/debug-logger', () => ({
  debugLog: vi.fn(),
  debugError: vi.fn(),
}));

vi.mock('@/lib/crypto', () => ({
  createFeedMessageTransaction: vi.fn(),
  createChatFeedTransaction: vi.fn(),
  createCreateInnerCircleTransaction: vi.fn(),
  createAddMembersToInnerCircleTransaction: vi.fn(),
  createCreateCustomCircleTransaction: vi.fn(),
  createAddMembersToCustomCircleTransaction: vi.fn(),
  generateGuid: vi.fn(() => 'generated-circle-feed-id'),
  hexToBytes: vi.fn(() => new Uint8Array(32)),
}));

vi.mock('./useFeedsStore', () => ({
  useFeedsStore: {
    getState: vi.fn(() => ({
      feeds: [],
      getFeed: vi.fn(),
      messages: {},
      getCurrentGroupKey: vi.fn(),
      getGroupKeyState: vi.fn(),
      updateMessageRetryState: vi.fn(),
      addFeeds: vi.fn(),
      addPendingMessage: vi.fn(),
    })),
  },
  FEED_TYPE_MAP: { 0: 'personal', 1: 'chat', 2: 'broadcast', 3: 'group' },
}));

vi.mock('@/stores', () => ({
  useAppStore: {
    getState: vi.fn(() => ({
      credentials: {
        signingPrivateKey: '0'.repeat(64),
        signingPublicKey: 'owner-public-key',
      },
    })),
  },
}));

vi.mock('@/modules/identity/IdentityService', () => ({
  checkIdentityExists: vi.fn(async () => ({ exists: true, publicEncryptAddress: 'enc-key' })),
}));

vi.mock('@/lib/grpc/services/group', () => ({
  groupService: {
    getGroupMembers: vi.fn(async () => []),
  },
}));

describe('FEAT-092: FeedsService custom circle mapping', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns NAME error deterministically for invalid circle name', async () => {
    const { createCustomCircle, CircleOperationErrorCode, TransactionStatus } = await import('./FeedsService');

    const result = await createCustomCircle('owner-public-key', 'x', 'f'.repeat(64));

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(CircleOperationErrorCode.NAME);
    expect(result.status).toBe(TransactionStatus.REJECTED);
  });

  it('returns DUPLICATE error deterministically for duplicate member payload', async () => {
    const { addMembersToCustomCircle, CircleOperationErrorCode, TransactionStatus } = await import('./FeedsService');

    const result = await addMembersToCustomCircle(
      'circle-id',
      'owner-public-key',
      [
        { PublicAddress: 'A', PublicEncryptAddress: 'enc-A' },
        { PublicAddress: 'A', PublicEncryptAddress: 'enc-A2' },
      ],
      'f'.repeat(64)
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(CircleOperationErrorCode.DUPLICATE);
    expect(result.status).toBe(TransactionStatus.REJECTED);
  });

  it('maps successful create response with generated feed id', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        successful: true,
        message: 'accepted',
        status: 1,
      }),
    }) as unknown as typeof fetch;

    const cryptoModule = await import('@/lib/crypto');
    vi.mocked(cryptoModule.createCreateCustomCircleTransaction).mockResolvedValue({
      signedTransaction: 'signed-json',
    });

    const { createCustomCircle, CircleOperationErrorCode } = await import('./FeedsService');

    const result = await createCustomCircle('owner-public-key', 'Friends', 'f'.repeat(64));

    expect(result.success).toBe(true);
    expect(result.errorCode).toBe(CircleOperationErrorCode.NONE);
    expect(result.feedId).toBe('generated-circle-feed-id');
  });

  it('maps ownership rejection to explicit OWNERSHIP error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        successful: false,
        message: 'Only the profile owner can add members',
        status: 4,
      }),
    }) as unknown as typeof fetch;

    const cryptoModule = await import('@/lib/crypto');
    vi.mocked(cryptoModule.createAddMembersToCustomCircleTransaction).mockResolvedValue({
      signedTransaction: 'signed-json',
    });

    const { addMembersToCustomCircle, CircleOperationErrorCode } = await import('./FeedsService');

    const result = await addMembersToCustomCircle(
      'circle-id',
      'owner-public-key',
      [{ PublicAddress: 'B', PublicEncryptAddress: 'enc-B' }],
      'f'.repeat(64)
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(CircleOperationErrorCode.OWNERSHIP);
  });
});
