/**
 * FEAT-066 / F2-007: SHA-256 integrity verification
 * Tests hash computation and verification against known values.
 */

import { describe, it, expect } from 'vitest';
import { computeSha256, verifySha256 } from '../attachmentHash';

describe('SHA-256 Hash (FEAT-066)', () => {
  it('should produce known hash for "hello"', async () => {
    // Arrange - known SHA-256 of "hello"
    const data = new TextEncoder().encode('hello');
    const expectedHash = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';

    // Act
    const hash = await computeSha256(data);

    // Assert
    expect(hash).toBe(expectedHash);
    expect(hash).toHaveLength(64);
  });

  it('should produce correct hash for empty data', async () => {
    // Arrange - known SHA-256 of empty input
    const data = new Uint8Array(0);
    const expectedHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    // Act
    const hash = await computeSha256(data);

    // Assert
    expect(hash).toBe(expectedHash);
  });

  it('should verify matching data returns true', async () => {
    // Arrange
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const hash = await computeSha256(data);

    // Act
    const result = await verifySha256(data, hash);

    // Assert
    expect(result).toBe(true);
  });

  it('should verify modified data returns false', async () => {
    // Arrange
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const hash = await computeSha256(data);

    // Modify one byte
    const modified = new Uint8Array([1, 2, 3, 4, 6]);

    // Act
    const result = await verifySha256(modified, hash);

    // Assert
    expect(result).toBe(false);
  });

  it('should handle case-insensitive hash comparison', async () => {
    // Arrange
    const data = new TextEncoder().encode('hello');
    const upperHash = '2CF24DBA5FB0A30E26E83B2AC5B9E29E1B161E5C1FA7425E73043362938B9824';

    // Act
    const result = await verifySha256(data, upperHash);

    // Assert
    expect(result).toBe(true);
  });
});
