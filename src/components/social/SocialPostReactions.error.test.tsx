import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SocialPostReactions } from "./SocialPostReactions";

let mockError: string | null = null;

vi.mock("@/hooks/useFeedReactions", () => ({
  useFeedReactions: () => ({
    getReactionCounts: () => ({ "👍": 0, "❤️": 0, "😂": 0, "😮": 0, "😢": 0, "😡": 0 }),
    getMyReaction: () => null,
    isPending: () => false,
    handleReactionSelect: vi.fn(),
    fetchTalliesForMessages: vi.fn(async () => undefined),
    hydrateMyReactions: vi.fn(async () => undefined),
    error: mockError,
  }),
}));

vi.mock("@/stores", () => ({
  useAppStore: (selector: (state: { credentials: { signingPublicKey: string; mnemonic: string } }) => unknown) =>
    selector({ credentials: { signingPublicKey: "me-address", mnemonic: "test mnemonic" } }),
}));

vi.mock("@/modules/feeds/useFeedsStore", () => ({
  useFeedsStore: {
    getState: () => ({
      getFeed: () => undefined,
      getCurrentGroupKey: () => undefined,
    }),
  },
}));

describe("SocialPostReactions error state", () => {
  beforeEach(() => {
    mockError = null;
  });

  it("does not render an error surface when the reaction hook is healthy", () => {
    render(
      <SocialPostReactions
        postId="post-1"
        visibility="open"
        circleFeedIds={[]}
        canInteract={true}
        testIdPrefix="social-post-reactions"
      />
    );

    expect(screen.queryByTestId("social-post-reactions-error")).not.toBeInTheDocument();
  });

  it("renders the rollback error message on the post surface", () => {
    mockError = "Failed to submit reaction";

    render(
      <SocialPostReactions
        postId="post-1"
        visibility="open"
        circleFeedIds={[]}
        canInteract={true}
        testIdPrefix="social-post-reactions"
      />
    );

    expect(screen.getByTestId("social-post-reactions-error")).toHaveTextContent(
      "Failed to submit reaction"
    );
  });
});
