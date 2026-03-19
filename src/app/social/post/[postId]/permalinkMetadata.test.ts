import { describe, expect, it } from "vitest";
import {
  buildPermalinkMetadata,
  getDisplayInitials,
  resolvePermalinkPreviewImageUrl,
  summarizePostContent,
  type SocialPermalinkMetadataPayload,
} from "./permalinkMetadata";

describe("permalinkMetadata", () => {
  it("builds initials from multi-word names", () => {
    expect(getDisplayInitials("Paulo Aboim Pinto")).toBe("PA");
    expect(getDisplayInitials("CoZ")).toBe("CO");
    expect(getDisplayInitials("")).toBe("HS");
  });

  it("summarizes long content for preview cards", () => {
    const text = "a".repeat(200);
    expect(summarizePostContent(text)).toHaveLength(180);
    expect(summarizePostContent("hello world")).toBe("hello world");
  });

  it("prefers the first image attachment for public previews", () => {
    const payload: SocialPermalinkMetadataPayload = {
      success: true,
      message: "",
      accessState: "allowed",
      postId: "post-1",
      content: "Hello public world",
      canInteract: false,
      circleFeedIds: [],
      attachments: [
        {
          attachmentId: "image-1",
          mimeType: "image/png",
          size: 100,
          fileName: "cover.png",
          hash: "hash",
          kind: "image",
        },
      ],
      openGraph: {
        title: "HushSocial post",
        description: "Hello public world",
        isGenericPrivate: false,
        cacheControl: "public, max-age=300",
      },
    };

    expect(
      resolvePermalinkPreviewImageUrl(
        "https://chat.hushnetwork.social",
        "post-1",
        payload,
        "/social/post/post-1/opengraph-image"
      )
    ).toContain("/api/social/posts/attachment?attachmentId=image-1");
  });

  it("falls back to the generated card for non-image posts", () => {
    const payload: SocialPermalinkMetadataPayload = {
      success: true,
      message: "",
      accessState: "allowed",
      postId: "post-1",
      content: "Video-only post",
      canInteract: false,
      circleFeedIds: [],
      attachments: [
        {
          attachmentId: "video-1",
          mimeType: "video/mp4",
          size: 100,
          fileName: "clip.mp4",
          hash: "hash",
          kind: "video",
        },
      ],
      openGraph: {
        title: "HushSocial post",
        description: "Video-only post",
        isGenericPrivate: false,
        cacheControl: "public, max-age=300",
      },
    };

    expect(
      resolvePermalinkPreviewImageUrl(
        "https://chat.hushnetwork.social",
        "post-1",
        payload,
        "/social/post/post-1/opengraph-image"
      )
    ).toBe("https://chat.hushnetwork.social/social/post/post-1/opengraph-image");
  });

  it("builds private metadata from the server open graph contract", () => {
    const payload: SocialPermalinkMetadataPayload = {
      success: true,
      message: "",
      accessState: "guest_denied",
      postId: "post-1",
      canInteract: false,
      circleFeedIds: [],
      attachments: [],
      openGraph: {
        title: "Private post",
        description: "Sign in to view this post.",
        isGenericPrivate: true,
        cacheControl: "no-store",
      },
    };

    const metadata = buildPermalinkMetadata({
      baseUrl: "https://chat.hushnetwork.social",
      postId: "post-1",
      payload,
      authorName: "Owner",
    });

    expect(metadata.title).toBe("Private post");
    expect(metadata.description).toBe("Sign in to view this post.");
    expect(metadata.twitter?.card).toBe("summary_large_image");
  });
});
