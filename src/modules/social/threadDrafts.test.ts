import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearPendingSocialGuestIntent,
  clearPendingSocialThreadDraft,
  readPendingSocialGuestIntent,
  readPendingSocialThreadDraft,
  savePendingSocialGuestIntent,
  savePendingSocialThreadDraft,
} from "./threadDrafts";

describe("threadDrafts guest intent persistence", () => {
  afterEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("saves, reads, and clears reaction intent by post id", () => {
    savePendingSocialGuestIntent({
      postId: "post-123",
      returnTo: "/social/post/post-123",
      interactionType: "reaction",
      reactionEmojiIndex: 4,
      source: "permalink",
      createdAtMs: 123456,
    });

    expect(readPendingSocialGuestIntent("post-123")).toEqual({
      postId: "post-123",
      returnTo: "/social/post/post-123",
      interactionType: "reaction",
      reactionEmojiIndex: 4,
      source: "permalink",
      createdAtMs: 123456,
    });

    clearPendingSocialGuestIntent("post-123");
    expect(readPendingSocialGuestIntent("post-123")).toBeNull();
  });

  it("keeps existing thread draft compatibility and defaults canonical returnTo", () => {
    savePendingSocialThreadDraft({
      postId: "post-456",
      mode: "top-level",
      draft: "hello world",
      targetReplyId: null,
      threadRootId: null,
      source: "feed-wall",
      createdAtMs: 456789,
    });

    expect(readPendingSocialThreadDraft("post-456")).toEqual({
      postId: "post-456",
      returnTo: "/social/post/post-456",
      interactionType: "comment",
      mode: "top-level",
      draft: "hello world",
      targetReplyId: null,
      threadRootId: null,
      source: "feed-wall",
      createdAtMs: 456789,
    });
  });

  it("returns null for mismatched post ids", () => {
    savePendingSocialGuestIntent({
      postId: "post-123",
      returnTo: "/social/post/post-123",
      interactionType: "reaction",
      reactionEmojiIndex: 1,
      source: "feed-wall",
      createdAtMs: 1,
    });

    expect(readPendingSocialGuestIntent("other-post")).toBeNull();
    expect(readPendingSocialThreadDraft("other-post")).toBeNull();
  });

  it("reads legacy thread draft storage values without breaking FEAT-088 behavior", () => {
    window.sessionStorage.setItem(
      "hush.social.thread-draft.v1",
      JSON.stringify({
        postId: "post-legacy",
        mode: "inline",
        draft: "reply text",
        targetReplyId: "reply-1",
        threadRootId: "root-1",
        source: "permalink",
        createdAtMs: 777,
      })
    );

    expect(readPendingSocialThreadDraft("post-legacy")).toEqual({
      postId: "post-legacy",
      returnTo: "/social/post/post-legacy",
      interactionType: "reply",
      mode: "inline",
      draft: "reply text",
      targetReplyId: "reply-1",
      threadRootId: "root-1",
      source: "permalink",
      createdAtMs: 777,
    });
  });

  it("returns null for corrupt storage and ignores clear calls safely", () => {
    window.sessionStorage.setItem("hush.social.guest-intent.v1", "{bad json");

    expect(readPendingSocialGuestIntent("post-123")).toBeNull();
    expect(() => clearPendingSocialThreadDraft("post-123")).not.toThrow();
  });

  it("handles unavailable sessionStorage without throwing", () => {
    const sessionStorageDescriptor = Object.getOwnPropertyDescriptor(window, "sessionStorage");
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get: () => undefined,
    });

    expect(() =>
      savePendingSocialGuestIntent({
        postId: "post-123",
        returnTo: "/social/post/post-123",
        interactionType: "reaction",
        reactionEmojiIndex: 2,
        source: "feed-wall",
        createdAtMs: 999,
      })
    ).not.toThrow();
    expect(readPendingSocialGuestIntent("post-123")).toBeNull();
    expect(() => clearPendingSocialGuestIntent("post-123")).not.toThrow();

    if (sessionStorageDescriptor) {
      Object.defineProperty(window, "sessionStorage", sessionStorageDescriptor);
    }
  });
});
