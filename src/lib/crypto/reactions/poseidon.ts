/**
 * Poseidon Hash Function
 *
 * Uses a vendored Poseidon-only implementation derived from circomlibjs.
 * This MUST match the server-side Poseidon and ZK circuit exactly.
 */

import { buildPoseidon } from '@/lib/crypto/vendor/circomlibjs-poseidon/buildPoseidon.js';
import { BABYJUBJUB, DOMAIN_SEPARATORS, FEED_KEY_DOMAIN } from './constants';
import { bytesToBigint } from './babyjubjub';
import { uuidToBytes } from '@/lib/grpc/grpc-web-helper';

// Field modulus (same as Baby JubJub prime)
const F = BABYJUBJUB.p;

interface PoseidonField {
  toObject(element: unknown): bigint;
  e(n: bigint | number | string): unknown;
  zero: unknown;
}

interface Poseidon {
  (inputs: (bigint | number | string)[]): unknown;
  F: PoseidonField;
}

/**
 * Modular arithmetic helper
 */
function mod(a: bigint, p: bigint = F): bigint {
  const result = a % p;
  return result >= 0n ? result : result + p;
}

// Singleton Poseidon instance
let poseidonInstance: Poseidon | null = null;
let poseidonPromise: Promise<Poseidon> | null = null;

/**
 * Get or initialize the Poseidon hash function
 */
async function getPoseidon(): Promise<Poseidon> {
  if (poseidonInstance) {
    return poseidonInstance;
  }

  if (!poseidonPromise) {
    poseidonPromise = buildPoseidon().then((poseidon) => {
      poseidonInstance = poseidon;
      console.log('[Poseidon] Initialized vendored Poseidon');
      return poseidon;
    });
  }

  return poseidonPromise;
}

/**
 * Check if Poseidon is initialized
 */
export function isPoseidonReady(): boolean {
  return poseidonInstance !== null;
}

/**
 * Initialize Poseidon (call early in app startup)
 */
export async function initializePoseidon(): Promise<void> {
  await getPoseidon();
}

/**
 * Poseidon hash function
 *
 * Uses the vendored Poseidon implementation which is compatible with circom ZK circuits.
 */
export async function poseidonHash(inputs: bigint[]): Promise<bigint> {
  const poseidon = await getPoseidon();

  // The vendored Poseidon implementation expects inputs as bigints or numbers.
  const result = poseidon(inputs);

  // poseidon.F.toObject converts the result to a bigint
  return poseidon.F.toObject(result) as bigint;
}

/**
 * Synchronous poseidon hash (requires Poseidon to be pre-initialized)
 *
 * @throws Error if Poseidon is not initialized
 */
export function poseidonHashSync(inputs: bigint[]): bigint {
  if (!poseidonInstance) {
    throw new Error('Poseidon not initialized. Call initializePoseidon() first.');
  }

  const result = poseidonInstance(inputs);
  return poseidonInstance.F.toObject(result) as bigint;
}

/**
 * Compute user commitment: Poseidon(user_secret)
 */
export async function computeCommitment(userSecret: bigint): Promise<bigint> {
  return poseidonHash([userSecret]);
}

/**
 * Compute nullifier: Poseidon(user_secret, message_id, feed_id, DOMAIN)
 *
 * The nullifier is deterministic for a (user, message, feed) triple,
 * allowing vote updates while preventing double-voting.
 */
export async function computeNullifier(
  userSecret: bigint,
  messageId: bigint,
  feedId: bigint
): Promise<bigint> {
  return poseidonHash([
    userSecret,
    messageId,
    feedId,
    DOMAIN_SEPARATORS.NULLIFIER,
  ]);
}

/**
 * Compute backup key for cross-device recovery
 */
export async function computeBackupKey(
  userSecret: bigint,
  messageId: bigint
): Promise<bigint> {
  return poseidonHash([
    userSecret,
    messageId,
    DOMAIN_SEPARATORS.BACKUP,
  ]);
}

/**
 * Convert UUID string to bigint for use in hash functions
 */
export function uuidToBigint(uuid: string): bigint {
  // Match .NET Guid.ToByteArray() layout so browser-generated public inputs
  // line up with the server's Guid -> field conversion.
  const bytes = uuidToBytes(uuid);
  return bytesToBigint(bytes);
}

/**
 * Convert bigint back to UUID string format
 */
export function bigintToUuid(n: bigint): string {
  const hex = n.toString(16).padStart(32, '0');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/**
 * Derive feed's ElGamal private key from the feed's AES key
 *
 * Uses HKDF to derive a Baby JubJub scalar from the AES key.
 * This ensures each feed has a unique ElGamal keypair for reaction encryption.
 *
 * @param feedAesKey - The feed's AES-256 key (base64 encoded)
 * @returns The derived ElGamal private key as a bigint
 */
export async function deriveFeedElGamalKey(feedAesKey: string): Promise<bigint> {
  // Decode base64 AES key
  const aesKeyBytes = Uint8Array.from(atob(feedAesKey), c => c.charCodeAt(0));

  // Use HKDF to derive the ElGamal private key
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    aesKeyBytes,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );

  const encoder = new TextEncoder();
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      salt: encoder.encode('hush-network'),
      info: encoder.encode(FEED_KEY_DOMAIN),
      hash: 'SHA-256',
    },
    keyMaterial,
    256 // 32 bytes = 256 bits
  );

  // Convert to bigint and reduce modulo the curve order
  const derivedBytes = new Uint8Array(derivedBits);
  const privateKey = mod(bytesToBigint(derivedBytes), BABYJUBJUB.order);

  // Ensure the private key is non-zero (extremely unlikely but check anyway)
  return privateKey === 0n ? 1n : privateKey;
}

/**
 * Derive a deterministic ElGamal private key from a public reaction scope ID.
 *
 * This matches the server-side open-post path, which hashes the .NET Guid bytes
 * of the reaction scope and maps the result onto Baby JubJub.
 */
export async function deriveDeterministicReactionScopeKey(scopeId: string): Promise<bigint> {
  const scopeBytes = uuidToBytes(scopeId);
  const scopeScalar = bytesToBigint(scopeBytes);
  const hashed = await poseidonHash([scopeScalar]);
  const privateKey = mod(hashed, BABYJUBJUB.order);
  return privateKey === 0n ? 1n : privateKey;
}

/**
 * Derive the global-membership user secret from a public signing address.
 *
 * This matches the server-side `UserCommitmentService.DeriveCommitmentFromAddress`
 * path used for the reserved "all valid Hush identities" membership scope.
 */
export async function deriveAddressMembershipSecret(publicAddress: string): Promise<bigint> {
  const encoder = new TextEncoder();
  const addressBytes = encoder.encode(publicAddress);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    addressBytes,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      salt: encoder.encode('hush-network-address-commitment'),
      info: encoder.encode('address-secret-v1'),
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const derivedBytes = new Uint8Array(derivedBits);
  const secret = mod(bytesToBigint(derivedBytes), BABYJUBJUB.order);
  return secret === 0n ? 1n : secret;
}
