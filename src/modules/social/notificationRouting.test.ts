import { describe, expect, it } from "vitest";
import {
  getSocialNotificationTargetEntryId,
  isViewingSocialNotificationTarget,
  normalizeSocialNotificationRoute,
  readSocialNotificationThreadSelection,
  resolveSocialNotificationDestination,
} from "./notificationRouting";

describe("notificationRouting FEAT-091", () => {
  it("resolves deterministic fallback destinations for comment and reply notifications", () => {
    expect(
      resolveSocialNotificationDestination({
        postId: "post-1",
        targetType: 2,
        targetId: "comment-7",
      })
    ).toBe("/social/post/post-1?commentId=comment-7");

    expect(
      resolveSocialNotificationDestination({
        postId: "post-1",
        targetType: 3,
        targetId: "reply-9",
        parentCommentId: "comment-7",
      })
    ).toBe("/social/post/post-1?threadRootId=comment-7&replyId=reply-9");
  });

  it("normalizes routes and detects whether the viewer is already on the target", () => {
    expect(normalizeSocialNotificationRoute("https://hush.local/social/post/post-1?commentId=comment-7")).toBe(
      "/social/post/post-1?commentId=comment-7"
    );

    expect(
      isViewingSocialNotificationTarget("/social/post/post-1?commentId=comment-7", {
        postId: "post-1",
        targetType: 2,
        targetId: "comment-7",
      })
    ).toBe(true);
  });

  it("reads permalink thread targeting parameters without leaking empty values", () => {
    const selection = readSocialNotificationThreadSelection(
      new URLSearchParams("commentId=comment-7&threadRootId=comment-7&replyId=reply-9")
    );

    expect(selection).toEqual({
      commentId: "comment-7",
      threadRootId: "comment-7",
      replyId: "reply-9",
    });
    expect(getSocialNotificationTargetEntryId(selection)).toBe("reply-9");
    expect(
      getSocialNotificationTargetEntryId(
        readSocialNotificationThreadSelection(new URLSearchParams("commentId=comment-7&replyId=&threadRootId="))
      )
    ).toBe("comment-7");
  });
});
