/**
 * ElGamal Encryption on Baby JubJub Curve
 *
 * Used for homomorphic encryption of emoji votes.
 * Each vote is encrypted as a vector of 6 ciphertexts (one per emoji).
 *
 * The encryption is additively homomorphic:
 * Enc(m1) + Enc(m2) = Enc(m1 + m2)
 */

import {
  Point,
  addPoints,
  subPoints,
  scalarMul,
  getGenerator,
  getIdentity,
  isIdentity,
  randomScalar,
  pointToBase64,
  base64ToPoint,
} from './babyjubjub';
import { EMOJI_COUNT } from './constants';
import type { ECPoint } from '@/lib/grpc/types';

/**
 * Single ElGamal ciphertext
 */
export interface Ciphertext {
  c1: Point; // r * G (ephemeral key)
  c2: Point; // m * G + r * PK (encrypted message)
}

/**
 * Vector of 6 ciphertexts (one per emoji type)
 */
export interface VectorCiphertext {
  c1: Point[]; // 6 ephemeral keys
  c2: Point[]; // 6 encrypted messages
}

/**
 * Encrypt a single value using ElGamal
 *
 * Encryption:
 *   c1 = r * G           (ephemeral public key)
 *   c2 = m * G + r * PK  (encrypted message point)
 *
 * @param message - The value to encrypt (typically 0 or 1 for reactions)
 * @param publicKey - The feed's public key
 * @param nonce - Optional random nonce (generated if not provided)
 */
export function encrypt(
  message: bigint,
  publicKey: Point,
  nonce?: bigint
): Ciphertext {
  const r = nonce ?? randomScalar();
  const G = getGenerator();

  // c1 = r * G
  const c1 = scalarMul(G, r);

  // m * G (message encoded as point)
  const mG = message === 0n ? getIdentity() : scalarMul(G, message);

  // r * PK (shared secret)
  const rPK = scalarMul(publicKey, r);

  // c2 = m * G + r * PK
  const c2 = addPoints(mG, rPK);

  return { c1, c2 };
}

/**
 * Encrypt a one-hot vector for emoji reaction
 *
 * Creates 6 ciphertexts where only the selected emoji index is encrypted as 1,
 * all others are encrypted as 0.
 *
 * @param emojiIndex - 0-5 for emoji selection, 6 for removal (all zeros)
 * @param publicKey - The feed's public key
 * @returns The vector ciphertext and the nonces used (needed for ZK proof)
 */
export function encryptVector(
  emojiIndex: number,
  publicKey: Point
): { ciphertext: VectorCiphertext; nonces: bigint[] } {
  const c1: Point[] = [];
  const c2: Point[] = [];
  const nonces: bigint[] = [];

  for (let i = 0; i < EMOJI_COUNT; i++) {
    // 1 for selected emoji, 0 for others
    // If emojiIndex >= EMOJI_COUNT (e.g., 6), all are 0 (removal)
    const value = i === emojiIndex ? 1n : 0n;
    const nonce = randomScalar();
    nonces.push(nonce);

    const ct = encrypt(value, publicKey, nonce);
    c1.push(ct.c1);
    c2.push(ct.c2);
  }

  return {
    ciphertext: { c1, c2 },
    nonces,
  };
}

/**
 * Decrypt an ElGamal ciphertext to get the message point
 *
 * Decryption:
 *   m * G = c2 - sk * c1
 *
 * @param ciphertext - The encrypted value
 * @param privateKey - The feed's private key
 * @returns The message point (m * G), which must be solved for m using BSGS
 */
export function decrypt(ciphertext: Ciphertext, privateKey: bigint): Point {
  // sk * c1 = sk * r * G = r * PK
  const skC1 = scalarMul(ciphertext.c1, privateKey);

  // m * G = c2 - sk * c1 = (m * G + r * PK) - r * PK
  const mG = subPoints(ciphertext.c2, skC1);

  return mG;
}

/**
 * Add two ciphertexts (homomorphic addition)
 *
 * Enc(m1) + Enc(m2) = Enc(m1 + m2)
 */
export function addCiphertexts(ct1: Ciphertext, ct2: Ciphertext): Ciphertext {
  return {
    c1: addPoints(ct1.c1, ct2.c1),
    c2: addPoints(ct1.c2, ct2.c2),
  };
}

/**
 * Subtract two ciphertexts (for vote updates)
 *
 * Enc(m1) - Enc(m2) = Enc(m1 - m2)
 */
export function subCiphertexts(ct1: Ciphertext, ct2: Ciphertext): Ciphertext {
  return {
    c1: subPoints(ct1.c1, ct2.c1),
    c2: subPoints(ct1.c2, ct2.c2),
  };
}

/**
 * Create an encryption of zero (identity ciphertext)
 */
export function encryptZero(publicKey: Point, nonce?: bigint): Ciphertext {
  return encrypt(0n, publicKey, nonce);
}

/**
 * Check if a ciphertext encrypts zero (after decryption)
 */
export function isZeroCiphertext(decrypted: Point): boolean {
  return isIdentity(decrypted);
}

/**
 * Convert VectorCiphertext to gRPC format (base64 encoded)
 */
export function vectorCiphertextToGrpc(vc: VectorCiphertext): {
  CiphertextC1: ECPoint[];
  CiphertextC2: ECPoint[];
} {
  return {
    CiphertextC1: vc.c1.map(pointToBase64),
    CiphertextC2: vc.c2.map(pointToBase64),
  };
}

/**
 * Convert gRPC format to VectorCiphertext
 */
export function grpcToVectorCiphertext(
  c1: ECPoint[],
  c2: ECPoint[]
): VectorCiphertext {
  return {
    c1: c1.map(base64ToPoint),
    c2: c2.map(base64ToPoint),
  };
}

/**
 * Convert a single ciphertext pair from gRPC format
 */
export function grpcToCiphertext(c1: ECPoint, c2: ECPoint): Ciphertext {
  return {
    c1: base64ToPoint(c1),
    c2: base64ToPoint(c2),
  };
}
