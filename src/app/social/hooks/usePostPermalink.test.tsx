import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

describe("usePostPermalink", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    delete (window as Window & { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown }).__TAURI__;
    delete (window as Window & { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the public web origin when copying permalinks from Tauri", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://chat.hushnetwork.social");
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText,
      },
    });

    const onToast = vi.fn();
    const { usePostPermalink } = await import("./usePostPermalink");
    const { result } = renderHook(() => usePostPermalink({ onToast }));

    await act(async () => {
      await result.current.copyPostPermalink("post-123");
    });

    expect(writeText).toHaveBeenCalledWith("https://chat.hushnetwork.social/social/post/post-123");
    expect(onToast).toHaveBeenCalledWith("Post permalink copied.");
  });
});
