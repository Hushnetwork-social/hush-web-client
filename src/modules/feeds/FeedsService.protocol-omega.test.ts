import { beforeEach, describe, expect, it, vi } from 'vitest';

const createFeedMessageTransactionMock = vi.fn();
const addPendingMessageMock = vi.fn();
const updateMessageRetryStateMock = vi.fn();

const feedsState = {
  getFeed: vi.fn(),
  messages: {} as Record<string, unknown[]>,
  getCurrentGroupKey: vi.fn(),
  getGroupKeyState: vi.fn(),
  addPendingMessage: addPendingMessageMock,
  updateMessageRetryState: updateMessageRetryStateMock,
};

vi.mock('@/lib/api-config', () => ({
  buildApiUrl: vi.fn((path: string) => `http://test${path}`),
}));

vi.mock('@/lib/debug-logger', () => ({
  debugLog: vi.fn(),
  debugError: vi.fn(),
}));

vi.mock('@/lib/crypto', () => ({
  createFeedMessageTransaction: createFeedMessageTransactionMock,
  createChatFeedTransaction: vi.fn(),
  createCreateInnerCircleTransaction: vi.fn(),
  createAddMembersToInnerCircleTransaction: vi.fn(),
  createCreateCustomCircleTransaction: vi.fn(),
  createAddMembersToCustomCircleTransaction: vi.fn(),
  generateGuid: vi.fn(() => 'generated-guid'),
  bytesToBase64: vi.fn(() => 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAE='),
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

vi.mock('@/modules/reactions/useReactionsStore', () => ({
  useReactionsStore: {
    getState: vi.fn(() => ({
      getUserCommitment: vi.fn(() => 1n),
    })),
  },
}));

describe('FeedsService Protocol Omega author commitment', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    feedsState.getFeed.mockReturnValue({
      id: 'feed-id',
      type: 'chat',
      aesKey: 'test-key',
    });
    feedsState.getCurrentGroupKey.mockReturnValue(undefined);
    feedsState.getGroupKeyState.mockReturnValue(undefined);
    feedsState.messages = {
      'feed-id': [
        {
          id: 'message-id',
          feedId: 'feed-id',
          content: 'hello',
          contentPlaintext: 'hello',
          replyToMessageId: undefined,
        },
      ],
    };
    createFeedMessageTransactionMock.mockResolvedValue({
      signedTransaction: 'signed-transaction',
      messageId: 'message-id',
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        successful: true,
        message: 'accepted',
        status: 1,
      }),
    }) as unknown as typeof fetch;
  });

  it('passes author commitment into new message transactions', async () => {
    const { sendMessage } = await import('./FeedsService');

    const result = await sendMessage('feed-id', 'hello');

    expect(result.success).toBe(true);
    expect(createFeedMessageTransactionMock).toHaveBeenCalledWith(
      'feed-id',
      'hello',
      'test-key',
      expect.any(Uint8Array),
      'owner-public-key',
      undefined,
      undefined,
      undefined,
      undefined,
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAE='
    );
    expect(addPendingMessageMock).toHaveBeenCalled();
  });

  it('passes author commitment into retry transactions', async () => {
    const { retryMessage } = await import('./FeedsService');

    const result = await retryMessage('feed-id', 'message-id');

    expect(result.success).toBe(true);
    expect(createFeedMessageTransactionMock).toHaveBeenCalledWith(
      'feed-id',
      'hello',
      'test-key',
      expect.any(Uint8Array),
      'owner-public-key',
      undefined,
      undefined,
      'message-id',
      undefined,
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAE='
    );
    expect(updateMessageRetryStateMock).toHaveBeenCalled();
  });
});
