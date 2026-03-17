import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SocialPostReactions } from "./SocialPostReactions";

const handleReactionSelectMock = vi.fn();

let mockCounts = { "👍": 1, "❤️": 0, "😂": 0, "😮": 0, "😢": 0, "😡": 0 };
let mockMyReaction: number | null = null;
let mockIsPending = false;

vi.mock("@/hooks/useFeedReactions", () => ({
  useFeedReactions: () => ({
    getReactionCounts: () => mockCounts,
    getMyReaction: () => mockMyReaction,
    isPending: () => mockIsPending,
    handleReactionSelect: (...args: unknown[]) => handleReactionSelectMock(...args),
    fetchTalliesForMessages: vi.fn(async () => undefined),
    hydrateMyReactions: vi.fn(async () => undefined),
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

describe("SocialPostReactions pending state", () => {
  beforeEach(() => {
    mockCounts = { "👍": 1, "❤️": 0, "😂": 0, "😮": 0, "😢": 0, "😡": 0 };
    mockMyReaction = null;
    mockIsPending = false;
    handleReactionSelectMock.mockReset();
  });

  it("shows the selected reaction even when the tally is still zero", () => {
    mockCounts = { "👍": 0, "❤️": 0, "😂": 0, "😮": 0, "😢": 0, "😡": 0 };
    mockMyReaction = 1;

    render(
      <SocialPostReactions
        postId="post-1"
        visibility="open"
        circleFeedIds={[]}
        canInteract={true}
        testIdPrefix="social-post-reactions"
      />
    );

    expect(screen.getByRole("group", { name: "Reactions" })).toBeInTheDocument();
    expect(screen.getByTestId("reaction-badge-❤️")).toBeInTheDocument();
    expect(screen.getByText("Add")).toBeInTheDocument();
  });

  it("shows the zero-state React affordance when no reaction is visible", () => {
    mockCounts = { "👍": 0, "❤️": 0, "😂": 0, "😮": 0, "😢": 0, "😡": 0 };

    render(
      <SocialPostReactions
        postId="post-1"
        visibility="open"
        circleFeedIds={[]}
        canInteract={true}
        testIdPrefix="social-post-reactions"
      />
    );

    expect(screen.queryByRole("group", { name: "Reactions" })).not.toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
  });

  it("disables reaction controls while submission is pending", () => {
    mockIsPending = true;

    render(
      <SocialPostReactions
        postId="post-1"
        visibility="open"
        circleFeedIds={[]}
        canInteract={true}
        testIdPrefix="social-post-reactions"
      />
    );

    fireEvent.click(screen.getByTestId("reaction-badge-👍"));

    expect(handleReactionSelectMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("social-post-reactions-add")).toBeDisabled();
    expect(screen.queryByTestId("social-post-reactions-picker")).not.toBeInTheDocument();
  });
});
