import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestInnerCircleRetryMock = vi.fn();
const addFeedsMock = vi.fn();
const feedsState = {
  feeds: [] as Array<{
    id: string;
    type: string;
    name: string;
    participants: string[];
    otherParticipantPublicSigningAddress?: string;
  }>,
  getFeed: vi.fn(),
  messages: {},
  getCurrentGroupKey: vi.fn(),
  getGroupKeyState: vi.fn(),
  updateMessageRetryState: vi.fn(),
  addFeeds: addFeedsMock,
  addPendingMessage: vi.fn(),
};

addFeedsMock.mockImplementation((incomingFeeds: typeof feedsState.feeds) => {
  feedsState.feeds = [...feedsState.feeds, ...incomingFeeds];
});

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
    getState: vi.fn(() => feedsState),
  },
  FEED_TYPE_MAP: { 0: 'personal', 1: 'chat', 2: 'broadcast', 3: 'group' },
}));

vi.mock('@/stores', () => ({
  useAppStore: {
    getState: vi.fn(() => ({
      credentials: {
        signingPrivateKey: 'a'.repeat(64),
        signingPublicKey: 'owner-public-key',
        encryptionPublicKey: 'owner-encrypt-key',
      },
      requestInnerCircleRetry: requestInnerCircleRetryMock,
    })),
  },
}));

vi.mock('@/modules/identity/IdentityService', () => ({
  checkIdentityExists: vi.fn(async (address: string) => ({
    exists: true,
    publicEncryptAddress: `enc-${address}`,
  })),
}));

vi.mock('@/lib/grpc/services/group', () => ({
  groupService: {
    getGroupMembers: vi.fn(async () => []),
  },
}));

describe('FeedsService.createChatFeed => InnerCircle linkage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requestInnerCircleRetryMock.mockReset();
    feedsState.feeds = [];
    addFeedsMock.mockImplementation((incomingFeeds: typeof feedsState.feeds) => {
      feedsState.feeds = [...feedsState.feeds, ...incomingFeeds];
    });
  });

  it('submits AddMembersToInnerCircle transaction after creating a new chat feed', async () => {
    const cryptoModule = await import('@/lib/crypto');
    vi.mocked(cryptoModule.createChatFeedTransaction).mockResolvedValue({
      signedTransaction: 'signed-chat-transaction',
      feedId: 'chat-feed-1',
      feedAesKey: 'chat-aes-key',
    });
    vi.mocked(cryptoModule.createAddMembersToInnerCircleTransaction).mockResolvedValue({
      signedTransaction: 'signed-add-member-transaction',
    });

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/feeds/inner-circle')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            exists: true,
            feedId: 'inner-circle-feed-id',
          }),
        } as Response;
      }

      if (url.includes('/api/blockchain/submit')) {
        return {
          ok: true,
          json: async () => ({
            successful: true,
            message: 'accepted',
            status: 1,
          }),
        } as Response;
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    }) as typeof fetch;

    const { createChatFeed } = await import('./FeedsService');
    const result = await createChatFeed({
      displayName: 'FollowerA',
      publicSigningAddress: 'follower-a-address',
      publicEncryptAddress: 'follower-a-encrypt',
    });

    expect(result.success).toBe(true);
    expect(result.isExisting).toBe(false);
    expect(result.innerCircleLinked).toBe(true);
    expect(cryptoModule.createAddMembersToInnerCircleTransaction).toHaveBeenCalledTimes(1);
  });

  it('keeps chat creation successful and schedules retry when inner-circle linkage is retryable', async () => {
    const cryptoModule = await import('@/lib/crypto');
    vi.mocked(cryptoModule.createChatFeedTransaction).mockResolvedValue({
      signedTransaction: 'signed-chat-transaction',
      feedId: 'chat-feed-2',
      feedAesKey: 'chat-aes-key',
    });
    vi.mocked(cryptoModule.createAddMembersToInnerCircleTransaction).mockResolvedValue({
      signedTransaction: 'signed-add-member-transaction',
    });

    let submitCallCount = 0;
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/feeds/inner-circle')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            exists: true,
            feedId: 'inner-circle-feed-id',
          }),
        } as Response;
      }

      if (url.includes('/api/blockchain/submit')) {
        submitCallCount += 1;
        if (submitCallCount === 2) {
          return {
            ok: true,
            json: async () => ({
              successful: false,
              message: 'temporary backend issue',
              status: 4,
            }),
          } as Response;
        }

        return {
          ok: true,
          json: async () => ({
            successful: true,
            message: 'accepted',
            status: 1,
          }),
        } as Response;
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    }) as typeof fetch;

    const { createChatFeed } = await import('./FeedsService');
    const result = await createChatFeed({
      displayName: 'FollowerB',
      publicSigningAddress: 'follower-b-address',
      publicEncryptAddress: 'follower-b-encrypt',
    });

    expect(result.success).toBe(true);
    expect(result.innerCircleLinked).toBe(false);
    expect(requestInnerCircleRetryMock).toHaveBeenCalledTimes(1);
  });
});
