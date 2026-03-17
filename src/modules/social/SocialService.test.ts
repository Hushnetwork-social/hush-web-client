import { beforeEach, describe, expect, it, vi } from "vitest";

const createCreateSocialPostTransaction = vi.fn();
const submitTransaction = vi.fn();
const initializeReactionsSystem = vi.fn();

const appStoreState = {
  credentials: {
    mnemonic: ["alpha", "beta", "gamma"],
  },
};

let currentCommitment: bigint | null = null;

vi.mock("@/lib/crypto", () => ({
  hexToBytes: vi.fn(() => new Uint8Array([1, 2, 3])),
  createCreateSocialPostTransaction,
}));

vi.mock("@/modules/blockchain/BlockchainService", () => ({
  submitTransaction,
}));

vi.mock("@/modules/reactions/initializeReactions", () => ({
  initializeReactionsSystem,
}));

vi.mock("@/modules/reactions/useReactionsStore", () => ({
  useReactionsStore: {
    getState: () => ({
      getUserCommitment: () => currentCommitment,
    }),
  },
}));

vi.mock("@/stores", () => ({
  useAppStore: {
    getState: () => appStoreState,
  },
}));

describe("createSocialPost", () => {
  beforeEach(() => {
    currentCommitment = null;
    createCreateSocialPostTransaction.mockReset();
    submitTransaction.mockReset();
    initializeReactionsSystem.mockReset();

    createCreateSocialPostTransaction.mockResolvedValue({
      signedTransaction: "signed-social-post",
    });
    submitTransaction.mockResolvedValue({
      successful: true,
      message: "ok",
    });
  });

  it("initializes reactions before signing when the author commitment is cold", async () => {
    initializeReactionsSystem.mockImplementation(async () => {
      currentCommitment = 1n;
      return true;
    });

    const { createSocialPost } = await import("./SocialService");

    await createSocialPost(
      {
        postId: "post-1",
        authorPublicAddress: "author-1",
        content: "hello world",
        audience: {
          visibility: "open",
          circleFeedIds: [],
        },
        attachments: [],
        createdAtUnixMs: 123,
      },
      "abcd"
    );

    expect(initializeReactionsSystem).toHaveBeenCalledWith(["alpha", "beta", "gamma"]);
    expect(createCreateSocialPostTransaction).toHaveBeenCalledWith(
      "post-1",
      "post-1",
      "author-1",
      "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAE=",
      "hello world",
      "open",
      [],
      [],
      123,
      new Uint8Array([1, 2, 3])
    );
  });

  it("returns the computed author commitment so optimistic UI can preserve reaction eligibility", async () => {
    currentCommitment = 1n;

    const { createSocialPost } = await import("./SocialService");

    const result = await createSocialPost(
      {
        postId: "post-1",
        authorPublicAddress: "author-1",
        content: "hello world",
        audience: {
          visibility: "open",
          circleFeedIds: [],
        },
        attachments: [],
        createdAtUnixMs: 123,
      },
      "abcd"
    );

    expect(result).toMatchObject({
      success: true,
      authorCommitment: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAE=",
      permalink: "/social/post/post-1",
    });
  });
});
