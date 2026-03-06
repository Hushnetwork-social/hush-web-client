import { beforeEach, describe, expect, it, vi } from "vitest";

const createFeedMessageTransactionMock = vi.fn();

const feedsState = {
  getFeed: vi.fn(),
  getCurrentGroupKey: vi.fn(),
  getGroupKeyState: vi.fn(),
  addPendingMessage: vi.fn(),
  updateMessageRetryState: vi.fn(),
};

vi.mock("@/lib/api-config", () => ({
  buildApiUrl: vi.fn((path: string) => `http://test${path}`),
}));

vi.mock("@/lib/debug-logger", () => ({
  debugLog: vi.fn(),
  debugError: vi.fn(),
}));

vi.mock("@/lib/crypto", () => ({
  createFeedMessageTransaction: createFeedMessageTransactionMock,
  createChatFeedTransaction: vi.fn(),
  createCreateInnerCircleTransaction: vi.fn(),
  createAddMembersToInnerCircleTransaction: vi.fn(),
  createCreateCustomCircleTransaction: vi.fn(),
  createAddMembersToCustomCircleTransaction: vi.fn(),
  generateGuid: vi.fn(() => "generated-guid"),
  hexToBytes: vi.fn(() => new Uint8Array(32)),
}));

vi.mock("./useFeedsStore", () => ({
  useFeedsStore: {
    getState: vi.fn(() => feedsState),
  },
  FEED_TYPE_MAP: { 0: "personal", 1: "chat", 2: "broadcast", 3: "group" },
}));

vi.mock("@/stores", () => ({
  useAppStore: {
    getState: vi.fn(() => ({
      credentials: {
        signingPrivateKey: "a".repeat(64),
        signingPublicKey: "owner-public-key",
      },
    })),
  },
}));

vi.mock("@/modules/identity/IdentityService", () => ({
  checkIdentityExists: vi.fn(async () => ({ exists: true, publicEncryptAddress: "enc-address" })),
}));

vi.mock("@/lib/grpc/services/group", () => ({
  groupService: {
    getGroupMembers: vi.fn(async () => []),
  },
}));

describe("FeedsService.sendMessage circle enforcement", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects sendMessage for custom circle feeds before creating transaction", async () => {
    feedsState.getFeed.mockReturnValue({
      id: "circle-feed-id",
      type: "group",
      name: "SpecialCircle",
      description: "owner-managed custom circle",
      aesKey: "ignored",
    });

    const { sendMessage } = await import("./FeedsService");
    const result = await sendMessage("circle-feed-id", "hello");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Circle feeds are audience-only");
    expect(createFeedMessageTransactionMock).not.toHaveBeenCalled();
  });
});
