import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-config", () => ({
  buildApiUrl: vi.fn((path: string) => `http://test${path}`),
}));

describe("getSocialPostPermalink", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("preserves follow state in the permalink contract", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        message: "ok",
        accessState: "allowed",
        postId: "post-1",
        canInteract: true,
        circleFeedIds: [],
        attachments: [],
        followState: {
          isFollowing: true,
          canFollow: false,
        },
      }),
    })) as typeof fetch;

    const { getSocialPostPermalink } = await import("./PermalinkService");
    const result = await getSocialPostPermalink("post-1", "viewer-1", true);

    expect(result.followState).toEqual({
      isFollowing: true,
      canFollow: false,
    });
  });
});
