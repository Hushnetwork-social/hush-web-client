import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import SocialPostPermalinkPage from "./page";

let accessParam: string | null = null;
let postIdParam = "post-123";

vi.mock("next/navigation", () => ({
  useParams: () => ({ postId: postIdParam }),
  useSearchParams: () => ({
    get: (key: string) => (key === "access" ? accessParam : null),
  }),
}));

describe("SocialPostPermalinkPage", () => {
  beforeEach(() => {
    accessParam = null;
    postIdParam = "post-123";
    vi.restoreAllMocks();
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
    expect(screen.getByTestId("social-permalink-react")).toBeInTheDocument();
    expect(screen.getByTestId("social-permalink-comment")).toBeInTheDocument();
    expect(screen.getByTestId("social-permalink-link")).toBeInTheDocument();
    expect(screen.getByTestId("social-permalink-replies-title")).toHaveTextContent("Replies (0)");
  });

  it("renders guest denial with create-account CTA", () => {
    accessParam = "guest";
    render(<SocialPostPermalinkPage />);

    expect(screen.getByTestId("social-permalink-guest")).toBeInTheDocument();
    expect(screen.getByTestId("social-permalink-guest-cta")).toBeInTheDocument();
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
