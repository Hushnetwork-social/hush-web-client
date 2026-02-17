/**
 * FEAT-066 / F2-006: Client-side AES encryption of attachments
 * Tests binary AES-256-GCM encrypt/decrypt roundtrip.
 *
 * @vitest-environment node
 * Node environment required: crypto.subtle and ArrayBuffer must share the same
 * realm. In jsdom, ArrayBuffer is from jsdom's realm but crypto.subtle is native,
 * causing "not instance of ArrayBuffer" errors.
 */

import { describe, it, expect } from 'vitest';
import { generateAesKey, aesEncryptBytes, aesDecryptBytes } from '../../crypto/encryption';

describe('Binary AES Encryption (FEAT-066)', () => {
  it('should encrypt and decrypt small data (100 bytes)', async () => {
    // Arrange
    const key = generateAesKey();
    const original = new Uint8Array(100);
    crypto.getRandomValues(original);

    // Act
    const encrypted = await aesEncryptBytes(original, key);
    const decrypted = await aesDecryptBytes(encrypted, key);

    // Assert
    expect(decrypted).toEqual(original);
  });

  it('should encrypt and decrypt large data (1MB)', async () => {
    // Arrange
    const key = generateAesKey();
    const original = new Uint8Array(1024 * 1024);
    // Fill in chunks (jsdom limits getRandomValues to 65536 bytes)
    for (let i = 0; i < original.length; i += 65536) {
      const chunk = original.subarray(i, Math.min(i + 65536, original.length));
      crypto.getRandomValues(chunk);
    }

    // Act
    const encrypted = await aesEncryptBytes(original, key);
    const decrypted = await aesDecryptBytes(encrypted, key);

    // Assert
    expect(decrypted).toEqual(original);
  }, 15_000); // Extended timeout: Windows CI runners are slower with crypto operations

  it('should produce encrypted output different from input', async () => {
    // Arrange
    const key = generateAesKey();
    const original = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    // Act
    const encrypted = await aesEncryptBytes(original, key);

    // Assert
    expect(encrypted.length).toBeGreaterThan(original.length); // IV + tag overhead
    expect(encrypted).not.toEqual(original);
  });

  it('should fail decryption with wrong key', async () => {
    // Arrange
    const key1 = generateAesKey();
    const key2 = generateAesKey();
    const original = new Uint8Array([1, 2, 3, 4, 5]);
    const encrypted = await aesEncryptBytes(original, key1);

    // Act & Assert
    await expect(aesDecryptBytes(encrypted, key2)).rejects.toThrow();
  });

  it('should produce different ciphertext each time (unique IV)', async () => {
    // Arrange
    const key = generateAesKey();
    const original = new Uint8Array([10, 20, 30, 40, 50]);

    // Act
    const encrypted1 = await aesEncryptBytes(original, key);
    const encrypted2 = await aesEncryptBytes(original, key);

    // Assert - different IVs produce different ciphertext
    expect(encrypted1).not.toEqual(encrypted2);

    // But both decrypt to the same plaintext
    const decrypted1 = await aesDecryptBytes(encrypted1, key);
    const decrypted2 = await aesDecryptBytes(encrypted2, key);
    expect(decrypted1).toEqual(original);
    expect(decrypted2).toEqual(original);
  });
});
