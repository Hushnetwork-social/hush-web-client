import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  initializeMock: vi.fn(),
  isProverReadyMock: vi.fn(),
  ensureLoadedMock: vi.fn(),
  setProverReadyMock: vi.fn(),
  setBsgsReadyMock: vi.fn(),
  setErrorMock: vi.fn(),
}));

vi.mock("@/lib/debug-logger", () => ({
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
  debugError: vi.fn(),
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
    ensureLoaded: hoisted.ensureLoadedMock,
  },
  solveDiscreteLog: vi.fn(),
}));

vi.mock("@/lib/zk", () => ({
  generateProof: vi.fn(),
}));

vi.mock("@/lib/zk/circuitManager", () => ({
  circuitManager: {
    initialize: hoisted.initializeMock,
    isProverReady: hoisted.isProverReadyMock,
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
    getState: () => ({
      setProverReady: hoisted.setProverReadyMock,
      setBsgsReady: hoisted.setBsgsReadyMock,
      setError: hoisted.setErrorMock,
    }),
  },
  EMPTY_EMOJI_COUNTS: {},
}));

vi.mock("@/stores", () => ({
  useAppStore: {
    getState: () => ({
      credentials: null,
    }),
  },
}));

vi.mock("@/lib/crypto", () => ({
  createReactionTransaction: vi.fn(),
  hexToBytes: vi.fn(),
}));

vi.mock("@/modules/blockchain/BlockchainService", () => ({
  submitTransaction: vi.fn(),
}));

import { reactionsServiceInstance } from "./ReactionsService";

describe("ReactionsService.initialize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.initializeMock.mockResolvedValue(undefined);
    hoisted.isProverReadyMock.mockReturnValue(false);
    hoisted.ensureLoadedMock.mockResolvedValue(undefined);
  });

  it("keeps prover disabled when artifacts are unavailable", async () => {
    await reactionsServiceInstance.initialize();

    expect(hoisted.initializeMock).toHaveBeenCalledTimes(1);
    expect(hoisted.isProverReadyMock).toHaveBeenCalledTimes(1);
    expect(hoisted.setProverReadyMock).toHaveBeenCalledWith(false);
    expect(hoisted.setBsgsReadyMock).toHaveBeenCalledWith(true);
    expect(hoisted.setErrorMock).not.toHaveBeenCalled();
  });

  it("marks prover ready only when the circuit manager reports it ready", async () => {
    hoisted.isProverReadyMock.mockReturnValue(true);

    await reactionsServiceInstance.initialize();

    expect(hoisted.setProverReadyMock).toHaveBeenCalledWith(true);
    expect(hoisted.setBsgsReadyMock).toHaveBeenCalledWith(true);
  });
});
