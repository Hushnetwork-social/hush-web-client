import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-config", () => ({
  buildApiUrl: vi.fn((path: string) => `http://test${path}`),
}));

describe("followSocialAuthor", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("posts the shared follow contract and returns the response payload", async () => {
    global.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(
        JSON.stringify({
          viewerPublicAddress: "viewer-1",
          authorPublicAddress: "author-1",
          requesterPublicAddress: "viewer-1",
        })
      );

      return {
        ok: true,
        json: async () => ({
          success: true,
          message: "Author followed successfully",
          errorCode: "SOCIAL_FOLLOW_ACCEPTED",
          innerCircleFeedId: "inner-circle-1",
          alreadyFollowing: false,
          requiresSyncRefresh: true,
        }),
      } as Response;
    }) as typeof fetch;

    const { followSocialAuthor } = await import("./FollowService");
    const result = await followSocialAuthor({
      viewerPublicAddress: "viewer-1",
      authorPublicAddress: "author-1",
      requesterPublicAddress: "viewer-1",
    });

    expect(result).toEqual({
      success: true,
      message: "Author followed successfully",
      errorCode: "SOCIAL_FOLLOW_ACCEPTED",
      innerCircleFeedId: "inner-circle-1",
      alreadyFollowing: false,
      requiresSyncRefresh: true,
    });
  });

  it("returns a deterministic failure contract when the HTTP request fails", async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 502,
    })) as typeof fetch;

    const { followSocialAuthor } = await import("./FollowService");
    const result = await followSocialAuthor({
      viewerPublicAddress: "viewer-1",
      authorPublicAddress: "author-1",
      requesterPublicAddress: "viewer-1",
    });

    expect(result).toEqual({
      success: false,
      message: "Follow request failed (502)",
      alreadyFollowing: false,
      requiresSyncRefresh: false,
    });
  });
});
