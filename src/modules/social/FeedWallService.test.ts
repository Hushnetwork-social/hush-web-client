import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-config", () => ({
  buildApiUrl: vi.fn((path: string) => `http://test${path}`),
}));

describe("getSocialFeedWall", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("preserves author follow state from the feed wall response", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        message: "ok",
        posts: [
          {
            postId: "post-1",
            authorPublicAddress: "author-1",
            content: "hello",
            createdAtBlock: 10,
            createdAtUnixMs: 1000,
            visibility: "open",
            circleFeedIds: [],
            attachments: [],
            followState: {
              isFollowing: false,
              canFollow: true,
            },
          },
        ],
      }),
    })) as typeof fetch;

    const { getSocialFeedWall } = await import("./FeedWallService");
    const result = await getSocialFeedWall("viewer-1", true, 20);

    expect(result.success).toBe(true);
    expect(result.posts[0].followState).toEqual({
      isFollowing: false,
      canFollow: true,
    });
  });
});
