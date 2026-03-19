import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-config", () => ({
  buildApiUrl: vi.fn((path: string) => `http://test${path}`),
}));

vi.mock("@/lib/crypto", () => ({
  createUnsignedTransaction: vi.fn(),
  hexToBytes: vi.fn(),
  PAYLOAD_GUIDS: { NEW_FEED_MESSAGE: "payload-guid" },
  signByUser: vi.fn(),
}));

vi.mock("@/modules/blockchain/BlockchainService", () => ({
  submitTransaction: vi.fn(),
}));

vi.mock("@/modules/reactions/initializeReactions", () => ({
  initializeReactionsSystem: vi.fn(),
}));

vi.mock("@/modules/reactions/useReactionsStore", () => ({
  useReactionsStore: {
    getState: vi.fn(() => ({
      getUserCommitment: vi.fn(() => null),
    })),
  },
}));

vi.mock("@/stores", () => ({
  useAppStore: {
    getState: vi.fn(() => ({
      credentials: null,
    })),
  },
}));

describe("ThreadService follow-state mapping", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("preserves comment author follow state", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        message: "ok",
        comments: [
          {
            postId: "post-1",
            entryId: "comment-1",
            kind: "comment",
            threadRootId: "comment-1",
            reactionCount: 0,
            followState: {
              isFollowing: false,
              canFollow: true,
            },
          },
        ],
        paging: { initialPageSize: 10, loadMorePageSize: 10 },
        hasMore: false,
      }),
    })) as typeof fetch;

    const { getSocialCommentsPage } = await import("./ThreadService");
    const result = await getSocialCommentsPage("post-1", "viewer-1", true);

    expect(result.comments[0].followState).toEqual({
      isFollowing: false,
      canFollow: true,
    });
  });

  it("preserves reply author follow state", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        message: "ok",
        replies: [
          {
            postId: "post-1",
            entryId: "reply-1",
            kind: "reply",
            threadRootId: "comment-1",
            reactionCount: 0,
            followState: {
              isFollowing: true,
              canFollow: false,
            },
          },
        ],
        paging: { initialPageSize: 5, loadMorePageSize: 5 },
        hasMore: false,
      }),
    })) as typeof fetch;

    const { getSocialThreadRepliesPage } = await import("./ThreadService");
    const result = await getSocialThreadRepliesPage("post-1", "comment-1", "viewer-1", true);

    expect(result.replies[0].followState).toEqual({
      isFollowing: true,
      canFollow: false,
    });
  });
});
