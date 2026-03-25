import { describe, expect, it } from 'vitest';

import { EMOJI_COUNT } from './constants';
import {
  addCiphertexts,
  type Ciphertext,
  type Point,
  type VectorCiphertext,
  decrypt,
  encrypt,
  encryptZero,
  getGenerator,
  getIdentity,
  pointToKey,
  rerandomizeCiphertext,
  rerandomizeVectorCiphertext,
  scalarMul,
} from './index';

function buildPublicKey(privateKey: bigint): Point {
  return scalarMul(getGenerator(), privateKey);
}

function buildDeterministicVectorCiphertext(
  emojiIndex: number,
  publicKey: Point,
  startingNonce: bigint
): VectorCiphertext {
  const c1: Point[] = [];
  const c2: Point[] = [];

  for (let i = 0; i < EMOJI_COUNT; i++) {
    const value = i === emojiIndex ? 1n : 0n;
    const ct = encrypt(value, publicKey, startingNonce + BigInt(i));
    c1.push(ct.c1);
    c2.push(ct.c2);
  }

  return { c1, c2 };
}

function aggregateVectorSlot(vectors: VectorCiphertext[], index: number): Ciphertext {
  return vectors.reduce<Ciphertext>(
    (aggregate, vector) =>
      addCiphertexts(aggregate, {
        c1: vector.c1[index],
        c2: vector.c2[index],
      }),
    {
      c1: getIdentity(),
      c2: getIdentity(),
    }
  );
}

describe('elgamal rerandomization', () => {
  it('changes ciphertext bytes without changing decrypted message semantics', () => {
    const privateKey = 123456789n;
    const publicKey = buildPublicKey(privateKey);
    const original = encrypt(1n, publicKey, 11n);

    const rerandomized = rerandomizeCiphertext(original, publicKey, 29n).ciphertext;

    expect(pointToKey(rerandomized.c1)).not.toBe(pointToKey(original.c1));
    expect(pointToKey(rerandomized.c2)).not.toBe(pointToKey(original.c2));

    expect(pointToKey(decrypt(rerandomized, privateKey))).toBe(pointToKey(decrypt(original, privateKey)));
    expect(pointToKey(decrypt(rerandomized, privateKey))).toBe(pointToKey(getGenerator()));
  });

  it('preserves zero ciphertext semantics after rerandomization', () => {
    const privateKey = 987654321n;
    const publicKey = buildPublicKey(privateKey);
    const original = encryptZero(publicKey, 7n);

    const rerandomized = rerandomizeCiphertext(original, publicKey, 13n).ciphertext;

    expect(pointToKey(decrypt(rerandomized, privateKey))).toBe(pointToKey(getIdentity()));
    expect(pointToKey(rerandomized.c1)).not.toBe(pointToKey(original.c1));
    expect(pointToKey(rerandomized.c2)).not.toBe(pointToKey(original.c2));
  });

  it('preserves one-hot vector semantics across rerandomization', () => {
    const privateKey = 246813579n;
    const publicKey = buildPublicKey(privateKey);
    const original = buildDeterministicVectorCiphertext(3, publicKey, 101n);

    const rerandomized = rerandomizeVectorCiphertext(
      original,
      publicKey,
      [1001n, 1002n, 1003n, 1004n, 1005n, 1006n]
    ).ciphertext;

    for (let i = 0; i < EMOJI_COUNT; i++) {
      const expected = i === 3 ? getGenerator() : getIdentity();

      expect(pointToKey(rerandomized.c1[i])).not.toBe(pointToKey(original.c1[i]));
      expect(pointToKey(rerandomized.c2[i])).not.toBe(pointToKey(original.c2[i]));
      expect(pointToKey(decrypt(rerandomizedSlot(rerandomized, i), privateKey))).toBe(pointToKey(expected));
      expect(pointToKey(decrypt(rerandomizedSlot(rerandomized, i), privateKey))).toBe(
        pointToKey(decrypt(rerandomizedSlot(original, i), privateKey))
      );
    }
  });

  it('preserves aggregated tally semantics after rerandomizing every ballot', () => {
    const privateKey = 112233445566n;
    const publicKey = buildPublicKey(privateKey);
    const votes = [0, 2, 2, 5];

    const originalVectors = votes.map((emojiIndex, voteIndex) =>
      buildDeterministicVectorCiphertext(emojiIndex, publicKey, 200n + BigInt(voteIndex * 10))
    );

    const rerandomizedVectors = originalVectors.map((vector, voteIndex) =>
      rerandomizeVectorCiphertext(
        vector,
        publicKey,
        Array.from({ length: EMOJI_COUNT }, (_, emojiOffset) =>
          1000n + BigInt(voteIndex * 100 + emojiOffset)
        )
      ).ciphertext
    );

    const expectedCounts = [1n, 0n, 2n, 0n, 0n, 1n];

    for (let i = 0; i < EMOJI_COUNT; i++) {
      const originalAggregate = aggregateVectorSlot(originalVectors, i);
      const rerandomizedAggregate = aggregateVectorSlot(rerandomizedVectors, i);
      const expectedPoint = expectedCounts[i] === 0n
        ? getIdentity()
        : scalarMul(getGenerator(), expectedCounts[i]);

      expect(pointToKey(decrypt(rerandomizedAggregate, privateKey))).toBe(
        pointToKey(decrypt(originalAggregate, privateKey))
      );
      expect(pointToKey(decrypt(rerandomizedAggregate, privateKey))).toBe(pointToKey(expectedPoint));
    }
  });

  it('rejects mismatched rerandomization nonce counts for vector ciphertexts', () => {
    const publicKey = buildPublicKey(123n);
    const original = buildDeterministicVectorCiphertext(1, publicKey, 300n);

    expect(() => rerandomizeVectorCiphertext(original, publicKey, [1n, 2n])).toThrow(
      'Expected 6 rerandomization nonces, received 2'
    );
  });
});

function rerandomizedSlot(vector: VectorCiphertext, index: number): Ciphertext {
  return {
    c1: vector.c1[index],
    c2: vector.c2[index],
  };
}
