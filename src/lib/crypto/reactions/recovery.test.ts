import { describe, expect, it } from 'vitest';
import { bigintToBytes } from './babyjubjub';
import { decryptEmojiBackup, encryptEmojiBackup } from './recovery';

describe('reaction backup recovery', () => {
  const backupKey = 0x1234_5678_90ab_cdef_1234_5678_90ab_cdef_1234_5678_90ab_cdef_1234_5678_90ab_cdefn;

  it('round-trips supported reaction backup values', () => {
    for (const emojiIndex of [-1, 0, 1, 2, 3, 4, 5, 6]) {
      const encrypted = encryptEmojiBackup(emojiIndex, backupKey);

      expect(encrypted).toHaveLength(32);
      expect(decryptEmojiBackup(encrypted, backupKey)).toBe(emojiIndex);
    }
  });

  it('still supports legacy one-byte backups', () => {
    const legacyKeyBytes = bigintToBytes(backupKey);
    const legacyEncrypted = new Uint8Array([
      (-1 + 128) ^ legacyKeyBytes[0],
    ]);

    expect(decryptEmojiBackup(legacyEncrypted, backupKey)).toBe(-1);
  });

  it('rejects corrupted backup artifacts', () => {
    const encrypted = encryptEmojiBackup(2, backupKey);
    encrypted[7] ^= 0xff;

    expect(() => decryptEmojiBackup(encrypted, backupKey)).toThrow(
      'Encrypted reaction backup integrity check failed'
    );
  });

  it('rejects unsupported backup lengths', () => {
    expect(() => decryptEmojiBackup(new Uint8Array([1, 2]), backupKey)).toThrow(
      'Encrypted reaction backup has unexpected length 2'
    );
  });

  it('rejects unsupported reaction values before encryption', () => {
    expect(() => encryptEmojiBackup(99, backupKey)).toThrow(
      'Unsupported reaction backup emoji index: 99'
    );
  });
});
