import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import SocialPostPermalinkPage from "./page";

let accessParam: string | null = null;
let postIdParam = "post-123";
const getSocialCommentsPageMock = vi.fn();
const createSocialThreadEntryMock = vi.fn();
const followSocialAuthorMock = vi.fn();
const triggerSyncNowMock = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ postId: postIdParam }),
  useSearchParams: () => ({
    get: (key: string) => (key === "access" ? accessParam : null),
  }),
}));

const pendingAutoReactionHandledMock = vi.fn();
const lastReactionProps = {
  pendingAutoReactionIndex: null as number | null,
};

vi.mock("@/components/social/SocialPostReactions", () => ({
  SocialPostReactions: ({
    testIdPrefix,
    pendingAutoReactionIndex,
    onPendingAutoReactionHandled,
    onRequireAccount,
  }: {
    testIdPrefix: string;
    pendingAutoReactionIndex?: number | null;
    onPendingAutoReactionHandled?: () => void;
    onRequireAccount?: (reactionEmojiIndex?: number) => void;
  }) => {
    lastReactionProps.pendingAutoReactionIndex = pendingAutoReactionIndex ?? null;
    return (
    <div data-testid={testIdPrefix}>
      <button data-testid={`${testIdPrefix}-add`}>Add</button>
      <button
        data-testid={`${testIdPrefix}-guest-react`}
        onClick={() => onRequireAccount?.(4)}
      >
        Guest react
      </button>
      <span data-testid={`${testIdPrefix}-pending-auto-reaction`}>
        {pendingAutoReactionIndex ?? "none"}
      </span>
      <button
        data-testid={`${testIdPrefix}-pending-auto-reaction-handled`}
        onClick={() => {
          pendingAutoReactionHandledMock();
          onPendingAutoReactionHandled?.();
        }}
      >
        handled
      </button>
    </div>
    );
  },
}));

vi.mock("@/modules/social/ThreadService", () => ({
  getSocialCommentsPage: (...args: unknown[]) => getSocialCommentsPageMock(...args),
  createSocialThreadEntry: (...args: unknown[]) => createSocialThreadEntryMock(...args),
}));

vi.mock("@/modules/social/FollowService", () => ({
  followSocialAuthor: (...args: unknown[]) => followSocialAuthorMock(...args),
}));

vi.mock("@/lib/sync", () => ({
  useSyncContext: () => ({
    triggerSyncNow: triggerSyncNowMock,
  }),
}));

describe("SocialPostPermalinkPage", () => {
  beforeEach(() => {
    accessParam = null;
    postIdParam = "post-123";
    window.sessionStorage.clear();
    window.localStorage.clear();
    lastReactionProps.pendingAutoReactionIndex = null;
    pendingAutoReactionHandledMock.mockReset();
    vi.restoreAllMocks();
    getSocialCommentsPageMock.mockReset();
    createSocialThreadEntryMock.mockReset();
    followSocialAuthorMock.mockReset();
    triggerSyncNowMock.mockReset();
    getSocialCommentsPageMock.mockResolvedValue({
      success: true,
      message: "",
      comments: [],
      paging: { initialPageSize: 10, loadMorePageSize: 10 },
      hasMore: false,
    });
    createSocialThreadEntryMock.mockResolvedValue({
      success: true,
      message: "ok",
      entryId: "thread-entry-1",
    });
    followSocialAuthorMock.mockResolvedValue({
      success: true,
      message: "ok",
      alreadyFollowing: false,
      requiresSyncRefresh: true,
    });
    triggerSyncNowMock.mockResolvedValue(true);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/social/posts/permalink")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            message: "",
            accessState: "allowed",
            postId: "post-123",
            authorPublicAddress: "02abcdef1234567890fedcba1234567890abcdef1234567890fedcba1234567890",
            content: "Hello public world",
            canInteract: true,
            circleFeedIds: [],
          }),
        } as Response;
      }

      if (url.includes("/api/identity/check")) {
        return {
          ok: true,
          json: async () => ({
            exists: true,
            identity: {
              profileName: "Owner",
            },
          }),
        } as Response;
      }

      return {
        ok: false,
        json: async () => ({}),
      } as Response;
    }));
  });

  it("renders public permalink content with author identity", async () => {
    render(<SocialPostPermalinkPage />);

    expect(await screen.findByTestId("social-permalink-back-to-feedwall")).toBeInTheDocument();
    expect(await screen.findByTestId("social-permalink-public")).toBeInTheDocument();
    expect(await screen.findByTestId("social-permalink-author-name")).toHaveTextContent("Owner");
    expect(await screen.findByTestId("social-permalink-content")).toHaveTextContent("Hello public world");
    expect(screen.getByTestId("social-permalink-reactions")).toBeInTheDocument();
    expect(screen.getByTestId("social-permalink-reactions-add")).toBeInTheDocument();
    expect(screen.getByTestId("social-permalink-comment")).toHaveTextContent("Reply");
    expect(screen.getByTestId("social-permalink-link")).toBeInTheDocument();
    expect(screen.queryByTestId("social-permalink-follow-author")).not.toBeInTheDocument();
    expect(screen.queryByTestId("social-permalink-replies-title")).not.toBeInTheDocument();
    expect(screen.queryByTestId("social-permalink-replies-empty")).not.toBeInTheDocument();
  });

  it("hides replies for unauthenticated public permalink viewers", async () => {
    getSocialCommentsPageMock.mockResolvedValue({
      success: true,
      message: "",
      comments: [
        {
          entryId: "reply-1",
          authorPublicAddress: "03replyuser1234567890fedcba1234567890abcdef1234567890fedcba1234567890",
          createdAtUnixMs: 1735689600000,
          content: "Reply content",
          followState: { isFollowing: false, canFollow: true },
        },
      ],
      paging: { initialPageSize: 10, loadMorePageSize: 10 },
      hasMore: false,
    });

    render(<SocialPostPermalinkPage />);

    expect(await screen.findByTestId("social-permalink-public")).toBeInTheDocument();
    expect(screen.getByTestId("social-permalink-comment")).toHaveTextContent("Reply");
    expect(screen.queryByTestId("social-permalink-replies-title")).not.toBeInTheDocument();
    expect(screen.queryByTestId("social-permalink-replies-list")).not.toBeInTheDocument();
  });

  it("renders public reply authors with identity names for logged-in viewers", async () => {
    vi.mocked(window.localStorage.getItem).mockImplementation((key: string) => {
      if (key === "hush-app-storage") {
        return JSON.stringify({
          state: {
            credentials: {
              signingPublicKey: "02viewer1234567890fedcba1234567890abcdef1234567890fedcba1234567890",
            },
          },
        });
      }

      return null;
    });

    getSocialCommentsPageMock.mockResolvedValue({
      success: true,
      message: "",
      comments: [
        {
          entryId: "reply-1",
          authorPublicAddress: "03replyuser1234567890fedcba1234567890abcdef1234567890fedcba1234567890",
          createdAtUnixMs: 1735689600000,
          content: "Reply content",
          followState: { isFollowing: false, canFollow: true },
        },
      ],
      paging: { initialPageSize: 10, loadMorePageSize: 10 },
      hasMore: false,
    });

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/social/posts/permalink")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            message: "",
            accessState: "allowed",
            postId: "post-123",
            authorPublicAddress: "02abcdef1234567890fedcba1234567890abcdef1234567890fedcba1234567890",
            followState: { isFollowing: false, canFollow: true },
            content: "Hello public world",
            canInteract: true,
            circleFeedIds: [],
          }),
        } as Response;
      }

      if (url.includes("03replyuser1234567890fedcba1234567890abcdef1234567890fedcba1234567890")) {
        return {
          ok: true,
          json: async () => ({
            exists: true,
            identity: {
              profileName: "Reply User",
            },
          }),
        } as Response;
      }

      if (url.includes("/api/identity/check")) {
        return {
          ok: true,
          json: async () => ({
            exists: true,
            identity: {
              profileName: "Owner",
            },
          }),
        } as Response;
      }

      return {
        ok: false,
        json: async () => ({}),
      } as Response;
    }));

    render(<SocialPostPermalinkPage />);

    await waitFor(() => {
      expect(screen.getByTestId("social-permalink-comment")).toHaveTextContent("Reply (1)");
      expect(screen.getByTestId("social-permalink-replies-title")).toHaveTextContent("Replies (1)");
    });
    fireEvent.click(screen.getByTestId("social-permalink-follow-author"));
    await waitFor(() => {
      expect(followSocialAuthorMock).toHaveBeenCalledWith({
        viewerPublicAddress: "02viewer1234567890fedcba1234567890abcdef1234567890fedcba1234567890",
        authorPublicAddress: "02abcdef1234567890fedcba1234567890abcdef1234567890fedcba1234567890",
        requesterPublicAddress: "02viewer1234567890fedcba1234567890abcdef1234567890fedcba1234567890",
      });
    });
    expect(triggerSyncNowMock).toHaveBeenCalled();
    expect(screen.getByTestId("social-permalink-follow-author")).toHaveTextContent("Following");
    expect(await screen.findByTestId("social-permalink-reply-reply-1")).toHaveTextContent("Reply User");
    expect(screen.getByTestId("social-permalink-reply-reply-1")).toHaveTextContent("Reply content");
    expect(screen.getByTestId("social-permalink-follow-reply-reply-1")).toHaveTextContent("Follow");
    expect(screen.getByTestId("social-permalink-reply-reactions-reply-1")).toBeInTheDocument();
    expect(screen.getByTestId("social-permalink-reply-reactions-reply-1-add")).toBeInTheDocument();
  });

  it("opens create-account overlay when guest attempts to reply on a public permalink", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/social/posts/permalink")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            message: "",
            accessState: "allowed",
            postId: "post-123",
            authorPublicAddress: "02abcdef1234567890fedcba1234567890abcdef1234567890fedcba1234567890",
            content: "Hello public world",
            canInteract: false,
            circleFeedIds: [],
          }),
        } as Response;
      }

      if (url.includes("/api/identity/check")) {
        return {
          ok: true,
          json: async () => ({
            exists: true,
            identity: {
              profileName: "Owner",
            },
          }),
        } as Response;
      }

      return {
        ok: false,
        json: async () => ({}),
      } as Response;
    }));

    render(<SocialPostPermalinkPage />);

    fireEvent.click(await screen.findByTestId("social-permalink-comment"));

    expect(screen.getByTestId("social-auth-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("social-auth-overlay-cta")).toHaveAttribute(
      "href",
      "/auth?returnTo=%2Fsocial%2Fpost%2Fpost-123"
    );
  });

  it("stores canonical reaction resume intent when a guest reacts on a public permalink", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/social/posts/permalink")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            message: "",
            accessState: "allowed",
            postId: "post-123",
            authorPublicAddress: "02abcdef1234567890fedcba1234567890abcdef1234567890fedcba1234567890",
            content: "Hello public world",
            canInteract: false,
            circleFeedIds: [],
          }),
        } as Response;
      }

      if (url.includes("/api/identity/check")) {
        return {
          ok: true,
          json: async () => ({
            exists: true,
            identity: {
              profileName: "Owner",
            },
          }),
        } as Response;
      }

      return {
        ok: false,
        json: async () => ({}),
      } as Response;
    }));

    render(<SocialPostPermalinkPage />);

    fireEvent.click(await screen.findByTestId("social-permalink-reactions-guest-react"));

    expect(screen.getByTestId("social-auth-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("social-auth-overlay-cta")).toHaveAttribute(
      "href",
      "/auth?returnTo=%2Fsocial%2Fpost%2Fpost-123"
    );
    expect(JSON.parse(sessionStorage.getItem("hush.social.guest-intent.v1") ?? "null")).toMatchObject({
      postId: "post-123",
      returnTo: "/social/post/post-123",
      interactionType: "reaction",
      reactionEmojiIndex: 4,
      source: "permalink",
    });
  });

  it("restores a pending draft after the user returns authenticated to the same permalink", async () => {
    window.sessionStorage.setItem(
      "hush.social.thread-draft.v1",
      JSON.stringify({
        postId: "post-123",
        mode: "top-level",
        draft: "Restore me",
        targetReplyId: null,
        threadRootId: null,
        source: "permalink",
        createdAtMs: Date.now(),
      })
    );

    render(<SocialPostPermalinkPage />);

    expect(await screen.findByTestId("social-permalink-composer-top")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("social-permalink-composer-input")).toHaveValue("Restore me");
    });
  });

  it("closes the permalink composer when Escape is pressed", async () => {
    render(<SocialPostPermalinkPage />);

    fireEvent.click(await screen.findByTestId("social-permalink-comment"));
    expect(screen.getByTestId("social-permalink-composer-top")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByTestId("social-permalink-composer-input"), { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByTestId("social-permalink-composer-top")).not.toBeInTheDocument();
    });
  });

  it("restores a pending reply draft with thread context after the user returns authenticated", async () => {
    window.sessionStorage.setItem(
      "hush.social.guest-intent.v1",
      JSON.stringify({
        postId: "post-123",
        returnTo: "/social/post/post-123",
        interactionType: "reply",
        mode: "inline",
        draft: "Restore reply",
        targetReplyId: "reply-7",
        threadRootId: "root-3",
        source: "permalink",
        createdAtMs: Date.now(),
      })
    );

    render(<SocialPostPermalinkPage />);

    expect(await screen.findByTestId("social-permalink-composer-top")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("social-permalink-composer-input")).toHaveValue("Restore reply");
    });
    expect(screen.getByTestId("social-permalink-composer-context")).toHaveTextContent("Replying in thread (root-3)");
  });

  it("resets an open threaded composer back to top-level when replying to the post", async () => {
    window.sessionStorage.setItem(
      "hush.social.guest-intent.v1",
      JSON.stringify({
        postId: "post-123",
        returnTo: "/social/post/post-123",
        interactionType: "reply",
        mode: "inline",
        draft: "Restore reply",
        targetReplyId: "reply-7",
        threadRootId: "root-3",
        source: "permalink",
        createdAtMs: Date.now(),
      })
    );

    render(<SocialPostPermalinkPage />);

    expect(await screen.findByTestId("social-permalink-composer-top")).toBeInTheDocument();
    expect(screen.getByTestId("social-permalink-composer-context")).toHaveTextContent("Replying in thread (root-3)");

    fireEvent.click(screen.getByTestId("social-permalink-comment"));

    expect(screen.getByTestId("social-permalink-composer-context")).toHaveTextContent("Replying to post");
  });

  it("restores a pending reaction as an auto-apply entry and clears it once handled", async () => {
    window.sessionStorage.setItem(
      "hush.social.guest-intent.v1",
      JSON.stringify({
        postId: "post-123",
        returnTo: "/social/post/post-123",
        interactionType: "reaction",
        reactionEmojiIndex: 4,
        source: "permalink",
        createdAtMs: Date.now(),
      })
    );

    render(<SocialPostPermalinkPage />);

    expect(await screen.findByTestId("social-permalink-reactions")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("social-permalink-reactions-pending-auto-reaction")).toHaveTextContent("4");
    });
    fireEvent.click(screen.getByTestId("social-permalink-reactions-pending-auto-reaction-handled"));
    expect(pendingAutoReactionHandledMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByTestId("social-permalink-reactions-pending-auto-reaction")).toHaveTextContent("none");
    });
  });

  it("ignores invalid pending intent data and falls back safely", async () => {
    window.sessionStorage.setItem(
      "hush.social.guest-intent.v1",
      JSON.stringify({
        postId: "post-123",
        returnTo: "/social/post/post-123",
        interactionType: "reaction",
        reactionEmojiIndex: "bad-data",
        source: "permalink",
        createdAtMs: Date.now(),
      })
    );

    render(<SocialPostPermalinkPage />);

    expect(await screen.findByTestId("social-permalink-public")).toBeInTheDocument();
    expect(screen.queryByTestId("social-permalink-composer-top")).not.toBeInTheDocument();
    expect(screen.getByTestId("social-permalink-reactions-pending-auto-reaction")).toHaveTextContent("none");
  });

  it("renders guest denial with create-account CTA", () => {
    accessParam = "guest";
    render(<SocialPostPermalinkPage />);

    expect(screen.getByTestId("social-permalink-guest")).toBeInTheDocument();
    expect(screen.getByTestId("social-permalink-guest-cta")).toHaveAttribute(
      "href",
      "/auth?returnTo=%2Fsocial%2Fpost%2Fpost-123"
    );
  });

  it("renders privacy-safe unauthorized state for logged-in user without permission", () => {
    accessParam = "denied";
    render(<SocialPostPermalinkPage />);

    expect(screen.getByTestId("social-permalink-denied")).toBeInTheDocument();
    expect(screen.getByText("You do not have permission to view this post")).toBeInTheDocument();
    expect(screen.getByTestId("social-permalink-denied-cta")).toBeInTheDocument();
  });

  it("uses ArrowLeft and ArrowRight to navigate permalink media carousel", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/social/posts/permalink")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            message: "",
            accessState: "allowed",
            postId: "post-123",
            authorPublicAddress: "02abcdef1234567890fedcba1234567890abcdef1234567890fedcba1234567890",
            followState: { isFollowing: false, canFollow: true },
            content: "Hello public world",
            canInteract: true,
            circleFeedIds: [],
            attachments: [
              {
                attachmentId: "attachment-1",
                mimeType: "image/png",
                size: 1024,
                fileName: "image-1.png",
                hash: "hash-1",
                kind: "image",
              },
              {
                attachmentId: "attachment-2",
                mimeType: "image/png",
                size: 2048,
                fileName: "image-2.png",
                hash: "hash-2",
                kind: "image",
              },
            ],
          }),
        } as Response;
      }

      if (url.includes("/api/identity/check")) {
        return {
          ok: true,
          json: async () => ({
            exists: true,
            identity: {
              profileName: "Owner",
            },
          }),
        } as Response;
      }

      return {
        ok: false,
        json: async () => ({}),
      } as Response;
    }));

    render(<SocialPostPermalinkPage />);

    const mediaContainer = await screen.findByTestId("social-permalink-media-container");
    expect(within(mediaContainer).getByTestId("page-indicator")).toHaveTextContent("1 / 2");

    fireEvent.keyDown(window, { key: "ArrowRight" });
    await waitFor(() => {
      expect(within(mediaContainer).getByTestId("page-indicator")).toHaveTextContent("2 / 2");
    });

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    await waitFor(() => {
      expect(within(mediaContainer).getByTestId("page-indicator")).toHaveTextContent("1 / 2");
    });
  });
});
