/**
 * Poseidon Hash Function
 *
 * Uses circomlibjs for the actual Poseidon hash implementation.
 * This MUST match the server-side Poseidon and ZK circuit exactly.
 */

import { buildPoseidon, type Poseidon } from 'circomlibjs';
import { BABYJUBJUB, DOMAIN_SEPARATORS, FEED_KEY_DOMAIN } from './constants';
import { bytesToBigint } from './babyjubjub';

// Field modulus (same as Baby JubJub prime)
const F = BABYJUBJUB.p;

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
      console.log('[Poseidon] Initialized circomlibjs Poseidon');
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
 * Uses circomlibjs Poseidon which is compatible with circom ZK circuits.
 */
export async function poseidonHash(inputs: bigint[]): Promise<bigint> {
  const poseidon = await getPoseidon();

  // circomlibjs poseidon expects inputs as bigints or numbers
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
  // Remove hyphens and convert hex to bigint
  const hex = uuid.replace(/-/g, '');
  return BigInt('0x' + hex);
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
