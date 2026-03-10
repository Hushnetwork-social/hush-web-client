import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SocialPostReactions } from "./SocialPostReactions";

const handleReactionSelectMock = vi.fn();

vi.mock("@/hooks/useFeedReactions", () => ({
  useFeedReactions: () => ({
    getReactionCounts: () => ({ "👍": 1, "❤️": 0, "😂": 0, "😮": 0, "😢": 0, "😡": 0 }),
    getMyReaction: () => null,
    isPending: () => false,
    handleReactionSelect: (...args: unknown[]) => handleReactionSelectMock(...args),
    fetchTalliesForMessages: vi.fn(async () => undefined),
    hydrateMyReactions: vi.fn(async () => undefined),
  }),
}));

let mockCredentials: { signingPublicKey?: string; mnemonic?: string } | null = {
  signingPublicKey: "me-address",
  mnemonic: "test mnemonic",
};

vi.mock("@/stores", () => ({
  useAppStore: (selector: (state: { credentials: typeof mockCredentials }) => unknown) =>
    selector({ credentials: mockCredentials }),
}));

vi.mock("@/modules/feeds/useFeedsStore", () => ({
  useFeedsStore: {
    getState: () => ({
      getFeed: () => undefined,
      getCurrentGroupKey: () => undefined,
    }),
  },
}));

describe("SocialPostReactions", () => {
  beforeEach(() => {
    mockCredentials = {
      signingPublicKey: "me-address",
      mnemonic: "test mnemonic",
    };
    handleReactionSelectMock.mockReset();
  });

  it("opens the reaction picker for authenticated users", () => {
    render(
      <SocialPostReactions
        postId="post-1"
        visibility="open"
        circleFeedIds={[]}
        canInteract={true}
        testIdPrefix="social-post-reactions"
      />
    );

    fireEvent.click(screen.getByTestId("social-post-reactions-add"));

    expect(screen.getByTestId("social-post-reactions-picker")).toBeInTheDocument();
  });

  it("routes guest public-post interaction into account creation instead of opening the picker", () => {
    mockCredentials = null;
    const onRequireAccount = vi.fn();

    render(
      <SocialPostReactions
        postId="post-1"
        visibility="open"
        circleFeedIds={[]}
        canInteract={false}
        testIdPrefix="social-post-reactions"
        onRequireAccount={onRequireAccount}
      />
    );

    fireEvent.click(screen.getByTestId("social-post-reactions-add"));

    expect(onRequireAccount).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("social-post-reactions-picker")).not.toBeInTheDocument();
  });
});
