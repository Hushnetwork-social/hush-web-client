import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  storeState: {
    getUserSecret: vi.fn(),
    getUserCommitment: vi.fn(),
    setGeneratingProof: vi.fn(),
  },
  appState: {
    credentials: {
      signingPrivateKey: "11".repeat(32),
      signingPublicKey: "02" + "22".repeat(32),
    },
  },
}));

vi.mock("@/lib/grpc/services/reactions", () => ({
  reactionsService: {},
}));

vi.mock("@/lib/grpc/services/reactions-binary", () => ({
  getTallies: vi.fn(),
}));

vi.mock("@/lib/crypto/reactions", () => ({
  encryptVector: vi.fn(),
  vectorCiphertextToGrpc: vi.fn(),
  decrypt: vi.fn(),
  bigintToBytes: vi.fn(),
  bytesToBigint: vi.fn(),
  EMOJIS: [],
  EMOJI_COUNT: 6,
}));

vi.mock("@/lib/crypto/reactions/poseidon", () => ({
  computeNullifier: vi.fn(),
  computeCommitment: vi.fn(),
  computeBackupKey: vi.fn(),
  uuidToBigint: vi.fn(),
}));

vi.mock("@/lib/crypto/reactions/recovery", () => ({
  encryptEmojiBackup: vi.fn(),
  decryptEmojiBackup: vi.fn(),
  localReactionCache: {
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock("@/lib/crypto/reactions/bsgs", () => ({
  bsgsManager: {
    ensureLoaded: vi.fn(),
  },
  solveDiscreteLog: vi.fn(),
}));

vi.mock("@/lib/zk", () => ({
  generateProof: vi.fn(),
}));

vi.mock("@/lib/zk/circuitManager", () => ({
  circuitManager: {
    initialize: vi.fn(),
    isProverReady: vi.fn(),
    getCurrentVersion: vi.fn(() => "omega-v1.0.0"),
    ensureProofResultVersion: vi.fn(),
  },
}));

vi.mock("./MembershipProofManager", () => ({
  membershipProofManager: {
    getProof: vi.fn(),
  },
}));

vi.mock("./useReactionsStore", () => ({
  useReactionsStore: {
    getState: () => hoisted.storeState,
  },
  EMPTY_EMOJI_COUNTS: {},
}));

vi.mock("@/stores", () => ({
  useAppStore: {
    getState: () => hoisted.appState,
  },
}));

vi.mock("@/lib/crypto", () => ({
  createReactionTransaction: vi.fn(),
  hexToBytes: vi.fn(),
  bytesToBase64: vi.fn(() => "base64-proof"),
}));

vi.mock("@/modules/blockchain/BlockchainService", () => ({
  submitTransaction: vi.fn(),
}));

import { encryptVector, vectorCiphertextToGrpc } from "@/lib/crypto/reactions";
import {
  computeBackupKey,
  computeNullifier,
  uuidToBigint,
} from "@/lib/crypto/reactions/poseidon";
import { encryptEmojiBackup } from "@/lib/crypto/reactions/recovery";
import { generateProof } from "@/lib/zk";
import { membershipProofManager } from "./MembershipProofManager";
import { createReactionTransaction, hexToBytes } from "@/lib/crypto";
import { submitTransaction } from "@/modules/blockchain/BlockchainService";
import { reactionsServiceInstance } from "./ReactionsService";

describe("ReactionsService.submitReaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    hoisted.storeState.getUserSecret.mockReturnValue(777n);
    hoisted.storeState.getUserCommitment.mockReturnValue(888n);

    vi.mocked(uuidToBigint).mockImplementation((value: string) => {
      if (value === "feed-id") {
        return 111n;
      }

      if (value === "message-id") {
        return 222n;
      }

      throw new Error(`Unexpected uuidToBigint input: ${value}`);
    });

    vi.mocked(computeNullifier).mockResolvedValue(999n);
    vi.mocked(computeBackupKey).mockResolvedValue(444n);

    vi.mocked(encryptVector).mockReturnValue({
      ciphertext: {
        c1: Array.from({ length: 6 }, (_, index) => ({
          x: BigInt(index * 10 + 1),
          y: BigInt(index * 10 + 2),
        })),
        c2: Array.from({ length: 6 }, (_, index) => ({
          x: BigInt(index * 10 + 101),
          y: BigInt(index * 10 + 102),
        })),
      },
      nonces: [11n, 12n, 13n, 14n, 15n, 16n],
    });

    vi.mocked(vectorCiphertextToGrpc).mockReturnValue({
      CiphertextC1: ["c1"],
      CiphertextC2: ["c2"],
    } as never);

    vi.mocked(encryptEmojiBackup).mockReturnValue("backup-payload");

    vi.mocked(membershipProofManager.getProof).mockResolvedValue({
      root: 321n,
      pathElements: [41n, 42n, 43n],
      pathIndices: [true, false, true],
      depth: 3,
      rootBlockHeight: 12,
    });

    vi.mocked(generateProof).mockResolvedValue({
      proof: new Uint8Array([1, 2, 3]),
      publicSignals: ["sig-1"],
      circuitVersion: "omega-v1.0.0",
    });

    vi.mocked(hexToBytes).mockReturnValue(new Uint8Array([1, 2, 3]));
    vi.mocked(createReactionTransaction).mockResolvedValue({
      signedTransaction: "signed-transaction",
      transactionId: "tx-123",
    } as never);
    vi.mocked(submitTransaction).mockResolvedValue({
      successful: true,
      message: "",
    } as never);
  });

  it("builds the non-dev proof inputs with the expected witness and public signals", async () => {
    await reactionsServiceInstance.submitReaction(
      "feed-id",
      "message-id",
      1,
      { x: 901n, y: 902n },
      654n,
      "membership-feed-id"
    );

    expect(computeNullifier).toHaveBeenCalledWith(777n, 222n, 111n);
    expect(membershipProofManager.getProof).toHaveBeenCalledWith("membership-feed-id", 888n);
    expect(generateProof).toHaveBeenCalledWith({
      nullifier: "999",
      ciphertext_c1: [
        ["1", "2"],
        ["11", "12"],
        ["21", "22"],
        ["31", "32"],
        ["41", "42"],
        ["51", "52"],
      ],
      ciphertext_c2: [
        ["101", "102"],
        ["111", "112"],
        ["121", "122"],
        ["131", "132"],
        ["141", "142"],
        ["151", "152"],
      ],
      message_id: "222",
      feed_id: "111",
      feed_pk: ["901", "902"],
      members_root: "321",
      author_commitment: "654",
      user_secret: "777",
      emoji_index: "1",
      encryption_nonce: ["11", "12", "13", "14", "15", "16"],
      merkle_path: ["41", "42", "43"],
      merkle_indices: [1, 0, 1],
    });
    expect(hoisted.storeState.setGeneratingProof).toHaveBeenNthCalledWith(1, true);
    expect(hoisted.storeState.setGeneratingProof).toHaveBeenLastCalledWith(false);
  });

  it("fails fast when proof generation times out and never submits a transaction", async () => {
    vi.mocked(generateProof).mockRejectedValueOnce(
      new Error("ZK proof generation timed out after 12000ms")
    );

    await expect(
      reactionsServiceInstance.submitReaction(
        "feed-id",
        "message-id",
        1,
        { x: 901n, y: 902n },
        654n,
        "membership-feed-id"
      )
    ).rejects.toThrow("ZK proof generation timed out after 12000ms");

    expect(createReactionTransaction).not.toHaveBeenCalled();
    expect(submitTransaction).not.toHaveBeenCalled();
    expect(hoisted.storeState.setGeneratingProof).toHaveBeenNthCalledWith(1, true);
    expect(hoisted.storeState.setGeneratingProof).toHaveBeenLastCalledWith(false);
  });
});
