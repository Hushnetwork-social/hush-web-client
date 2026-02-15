/**
 * FEAT-066: SHA-256 hash computation and verification for attachment integrity.
 * Hash is computed on the ORIGINAL plaintext file (before encryption).
 * Uses Web Crypto API (SubtleCrypto.digest) for hardware-accelerated hashing.
 */

/**
 * Compute SHA-256 hash of binary data.
 * @param data Plaintext file bytes (before encryption)
 * @returns 64-character lowercase hexadecimal hash string
 */
export async function computeSha256(data: Uint8Array): Promise<string> {
  // Copy to a fresh ArrayBuffer to satisfy TypeScript strict BufferSource typing
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify that data matches an expected SHA-256 hash.
 * @param data Plaintext file bytes to verify
 * @param expectedHash Expected 64-character hex hash from on-chain metadata
 * @returns true if computed hash matches expected hash
 */
export async function verifySha256(data: Uint8Array, expectedHash: string): Promise<boolean> {
  const computed = await computeSha256(data);
  return computed === expectedHash.toLowerCase();
}
