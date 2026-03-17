import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";

import { encrypt, getGenerator, scalarMul } from "@/lib/crypto/reactions";
import {
  computeCommitment,
  computeNullifier,
  poseidonHash,
} from "@/lib/crypto/reactions/poseidon";
import { CIRCUIT } from "@/lib/crypto/reactions/constants";
import type { CircuitInputs } from "./types";
import { generateHeadlessProof } from "./headlessProver";

const WORKSPACE_ROOT = "C:\\myWork\\hush-workspace";
const MERKLE_DEPTH = CIRCUIT.treeDepth;

type ReactionFixture = {
  expectedNullifier: string;
  inputs: CircuitInputs;
};

async function buildMerkleProof(leaf: bigint) {
  const pathElements: bigint[] = [];
  const pathIndices: number[] = [];
  let current = leaf;

  for (let level = 0; level < MERKLE_DEPTH; level++) {
    const sibling = BigInt(level + 1);
    pathElements.push(sibling);
    pathIndices.push(level % 2);
    current =
      level % 2 === 0
        ? await poseidonHash([current, sibling])
        : await poseidonHash([sibling, current]);
  }

  return {
    root: current,
    pathElements,
    pathIndices,
  };
}

async function createReactionFixture(emojiIndex: number, nonces: bigint[]): Promise<ReactionFixture> {
  const userSecret = 123456789n;
  const authorSecret = 987654321n;
  const reactionScopeId = 222222222222222222n;
  const feedPrivateKey = 333333333333333333n;
  const feedPublicKey = scalarMul(getGenerator(), feedPrivateKey);
  const userCommitment = await computeCommitment(userSecret);
  const authorCommitment = await computeCommitment(authorSecret);
  const merkleProof = await buildMerkleProof(userCommitment);

  const ciphertexts = nonces.map((nonce, index) =>
    encrypt(index === emojiIndex ? 1n : 0n, feedPublicKey, nonce)
  );

  const nullifier = await computeNullifier(userSecret, reactionScopeId, reactionScopeId);

  return {
    expectedNullifier: nullifier.toString(),
    inputs: {
      nullifier: nullifier.toString(),
      ciphertext_c1: ciphertexts.map((ciphertext) => [
        ciphertext.c1.x.toString(),
        ciphertext.c1.y.toString(),
      ]),
      ciphertext_c2: ciphertexts.map((ciphertext) => [
        ciphertext.c2.x.toString(),
        ciphertext.c2.y.toString(),
      ]),
      message_id: reactionScopeId.toString(),
      feed_id: reactionScopeId.toString(),
      feed_pk: [feedPublicKey.x.toString(), feedPublicKey.y.toString()],
      members_root: merkleProof.root.toString(),
      author_commitment: authorCommitment.toString(),
      user_secret: userSecret.toString(),
      emoji_index: emojiIndex.toString(),
      encryption_nonce: nonces.map((nonce) => nonce.toString()),
      merkle_path: merkleProof.pathElements.map((element) => element.toString()),
      merkle_indices: merkleProof.pathIndices,
    },
  };
}

async function calculateWitnessOnly(inputs: CircuitInputs): Promise<void> {
  const snarkjs = await import("snarkjs");
  const witnessPath = path.join(WORKSPACE_ROOT, "hush-web-client", ".tmp-headless-test.wtns");

  try {
    await snarkjs.wtns.calculate(
      inputs,
      path.join(
        WORKSPACE_ROOT,
        "hush-web-client",
        "public",
        "circuits",
        CIRCUIT.version,
        "reaction.wasm"
      ),
      witnessPath
    );
  } finally {
    await fs.rm(witnessPath, { force: true });
  }
}

describe("generateHeadlessProof integration", () => {
  it(
    "generates a valid proof for a first reaction with real circuit artifacts",
    async () => {
      const fixture = await createReactionFixture(0, [11n, 12n, 13n, 14n, 15n, 16n]);

      await calculateWitnessOnly(fixture.inputs);
      const result = await generateHeadlessProof(fixture.inputs, {
        workspaceRoot: WORKSPACE_ROOT,
      });

      expect(result.circuitVersion).toBe(CIRCUIT.version);
      expect(result.proof).toHaveLength(256);
      expect(result.publicSignals[0]).toBe(fixture.expectedNullifier);
    },
    120_000
  );

  it(
    "generates a valid proof for a reaction update with the same nullifier and different ciphertexts",
    async () => {
      const firstFixture = await createReactionFixture(0, [11n, 12n, 13n, 14n, 15n, 16n]);
      const updateFixture = await createReactionFixture(1, [21n, 22n, 23n, 24n, 25n, 26n]);

      await calculateWitnessOnly(firstFixture.inputs);
      await calculateWitnessOnly(updateFixture.inputs);
      const firstResult = await generateHeadlessProof(firstFixture.inputs, {
        workspaceRoot: WORKSPACE_ROOT,
      });
      const updateResult = await generateHeadlessProof(updateFixture.inputs, {
        workspaceRoot: WORKSPACE_ROOT,
      });

      expect(firstResult.publicSignals[0]).toBe(firstFixture.expectedNullifier);
      expect(updateResult.publicSignals[0]).toBe(updateFixture.expectedNullifier);
      expect(updateFixture.expectedNullifier).toBe(firstFixture.expectedNullifier);
      expect(updateResult.publicSignals).not.toEqual(firstResult.publicSignals);
    },
    120_000
  );
});
