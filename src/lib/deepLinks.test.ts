import { buildTauriPostDeepLink, resolveSupportedDeepLinkPath } from "./deepLinks";

describe("deepLinks", () => {
  it("builds a tauri deep link for social posts", () => {
    expect(buildTauriPostDeepLink("post-123")).toBe("hushfeeds://social/post/post-123");
  });

  it("resolves tauri social post deep links", () => {
    expect(resolveSupportedDeepLinkPath("hushfeeds://social/post/post-123?view=thread#reply")).toBe(
      "/social/post/post-123?view=thread#reply"
    );
  });

  it("resolves tauri join deep links", () => {
    expect(resolveSupportedDeepLinkPath("hushfeeds://join/ABC123")).toBe("/join/ABC123");
  });

  it("resolves supported https post permalinks", () => {
    expect(
      resolveSupportedDeepLinkPath("https://chat.hushnetwork.social/social/post/post-123?view=thread")
    ).toBe("/social/post/post-123?view=thread");
  });

  it("rejects unsupported hosts", () => {
    expect(resolveSupportedDeepLinkPath("https://example.com/social/post/post-123")).toBeNull();
  });
});
