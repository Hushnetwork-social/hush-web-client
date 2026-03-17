import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SocialPostReactions } from "./SocialPostReactions";

const handleReactionSelectMock = vi.fn();
const fetchTalliesForMessagesMock = vi.fn(async () => undefined);
const hydrateMyReactionsMock = vi.fn(async () => undefined);

vi.mock("@/hooks/useFeedReactions", () => ({
  useFeedReactions: () => ({
    getReactionCounts: () => ({ "👍": 1, "❤️": 0, "😂": 0, "😮": 0, "😢": 0, "😡": 0 }),
    getMyReaction: () => null,
    isPending: () => false,
    handleReactionSelect: (...args: unknown[]) => handleReactionSelectMock(...args),
    fetchTalliesForMessages: (...args: unknown[]) => fetchTalliesForMessagesMock(...args),
    hydrateMyReactions: (...args: unknown[]) => hydrateMyReactionsMock(...args),
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

let mockIsGeneratingProof = false;

vi.mock("@/modules/reactions/useReactionsStore", () => ({
  useReactionsStore: Object.assign(
    (selector: (state: { isGeneratingProof: boolean }) => unknown) =>
      selector({ isGeneratingProof: mockIsGeneratingProof }),
    {
      getState: () => ({ isGeneratingProof: mockIsGeneratingProof }),
    }
  ),
}));

describe("SocialPostReactions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockIsGeneratingProof = false;
    mockCredentials = {
      signingPublicKey: "me-address",
      mnemonic: "test mnemonic",
    };
    handleReactionSelectMock.mockReset();
    fetchTalliesForMessagesMock.mockClear();
    hydrateMyReactionsMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
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

  it("hydrates my reaction once while continuing forced tally refresh polling", async () => {
    render(
      <SocialPostReactions
        postId="post-1"
        visibility="open"
        circleFeedIds={[]}
        canInteract={true}
        testIdPrefix="social-post-reactions"
      />
    );

    await vi.advanceTimersByTimeAsync(0);

    expect(hydrateMyReactionsMock).toHaveBeenCalledTimes(1);
    expect(hydrateMyReactionsMock).toHaveBeenCalledWith(["post-1"]);
    expect(fetchTalliesForMessagesMock).toHaveBeenCalledTimes(1);
    expect(fetchTalliesForMessagesMock).toHaveBeenNthCalledWith(1, ["post-1"], {
      forceRefresh: true,
    });

    await vi.advanceTimersByTimeAsync(9000);

    expect(hydrateMyReactionsMock).toHaveBeenCalledTimes(1);
    expect(fetchTalliesForMessagesMock).toHaveBeenCalledTimes(4);
    expect(fetchTalliesForMessagesMock).toHaveBeenLastCalledWith(["post-1"], {
      forceRefresh: true,
    });
  });

  it("pauses forced tally refresh polling while proof generation is in flight", async () => {
    mockIsGeneratingProof = true;

    render(
      <SocialPostReactions
        postId="post-1"
        visibility="open"
        circleFeedIds={[]}
        canInteract={true}
        testIdPrefix="social-post-reactions"
      />
    );

    await vi.advanceTimersByTimeAsync(9000);

    expect(fetchTalliesForMessagesMock).not.toHaveBeenCalled();
    expect(hydrateMyReactionsMock).toHaveBeenCalledTimes(1);
  });

});


