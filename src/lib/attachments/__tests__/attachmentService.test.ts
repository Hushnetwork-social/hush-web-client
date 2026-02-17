/**
 * FEAT-066 / F2-008: Attachment service tests
 * Tests upload preparation, cache-first download, and size validation.
 *
 * @vitest-environment node
 * Node environment required: crypto.subtle and ArrayBuffer must share the same
 * realm. In jsdom, ArrayBuffer is from jsdom's realm but crypto.subtle is native,
 * causing "not instance of ArrayBuffer" errors.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateAesKey, aesEncryptBytes } from '../../crypto/encryption';
import {
  prepareAttachmentForUpload,
  downloadAttachment,
  validateAttachments,
  setAttachmentCache,
  type StreamingDownloadFn,
} from '../attachmentService';
import { AttachmentCache, MemoryBackend } from '../attachmentCache';

describe('Attachment Service (FEAT-066)', () => {
  let aesKey: string;

  beforeEach(() => {
    aesKey = generateAesKey();
    // Use in-memory cache for tests
    setAttachmentCache(new AttachmentCache(new MemoryBackend()));
  });

  describe('prepareAttachmentForUpload', () => {
    it('should produce valid ref and blob', async () => {
      // Arrange
      const fileBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

      // Act
      const result = await prepareAttachmentForUpload(
        fileBytes, 'photo.jpg', 'image/jpeg', aesKey,
      );

      // Assert - ref
      expect(result.ref.id).toBeDefined();
      expect(result.ref.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(result.ref.hash).toHaveLength(64); // SHA-256 hex
      expect(result.ref.mimeType).toBe('image/jpeg');
      expect(result.ref.size).toBe(8);
      expect(result.ref.fileName).toBe('photo.jpg');

      // Assert - blob
      expect(result.blob.attachmentId).toBe(result.ref.id);
      expect(result.blob.encryptedOriginal).toBeInstanceOf(Uint8Array);
      expect(result.blob.encryptedOriginal.length).toBeGreaterThan(fileBytes.length);
      expect(result.blob.encryptedThumbnail).toBeNull();
    });

    it('should produce encrypted output different from original', async () => {
      // Arrange
      const fileBytes = new Uint8Array([10, 20, 30, 40, 50]);

      // Act
      const result = await prepareAttachmentForUpload(
        fileBytes, 'test.bin', 'application/octet-stream', aesKey,
      );

      // Assert
      expect(result.blob.encryptedOriginal).not.toEqual(fileBytes);
    });

    it('should include encrypted thumbnail when provided', async () => {
      // Arrange
      const fileBytes = new Uint8Array([1, 2, 3]);
      const thumbBytes = new Uint8Array([4, 5, 6]);

      // Act
      const result = await prepareAttachmentForUpload(
        fileBytes, 'img.png', 'image/png', aesKey, thumbBytes,
      );

      // Assert
      expect(result.blob.encryptedThumbnail).toBeInstanceOf(Uint8Array);
      expect(result.blob.encryptedThumbnail!.length).toBeGreaterThan(0);
    });

    it('should reject file over 25MB', async () => {
      // Arrange - 26MB file
      const fileBytes = new Uint8Array(26 * 1024 * 1024);

      // Act & Assert
      await expect(
        prepareAttachmentForUpload(fileBytes, 'huge.bin', 'application/octet-stream', aesKey),
      ).rejects.toThrow('25MB');
    });
  });

  describe('validateAttachments', () => {
    it('should accept valid attachments', () => {
      const files = [{ size: 1024 }, { size: 2048 }];
      expect(validateAttachments(files)).toBeNull();
    });

    it('should reject too many attachments', () => {
      const files = Array.from({ length: 6 }, () => ({ size: 100 }));
      const error = validateAttachments(files);
      expect(error).toContain('6');
      expect(error).toContain('maximum of 5');
    });

    it('should reject oversized attachment', () => {
      const files = [{ size: 30 * 1024 * 1024 }];
      const error = validateAttachments(files);
      expect(error).toContain('25MB');
    });
  });

  describe('downloadAttachment', () => {
    it('should return cached data without network call', async () => {
      // Arrange - pre-populate cache with encrypted bytes
      const cache = new AttachmentCache(new MemoryBackend());
      setAttachmentCache(cache);

      const original = new Uint8Array([1, 2, 3, 4, 5]);
      const encrypted = await aesEncryptBytes(original, aesKey);
      await cache.set('cached-uuid', encrypted);

      const mockDownload: StreamingDownloadFn = vi.fn();

      // Act
      const result = await downloadAttachment(
        'cached-uuid', 'feed-id', 'user-addr', aesKey, mockDownload,
      );

      // Assert
      expect(result).toEqual(original);
      expect(mockDownload).not.toHaveBeenCalled();
    });

    it('should fetch from server and cache on miss', async () => {
      // Arrange
      const cache = new AttachmentCache(new MemoryBackend());
      setAttachmentCache(cache);

      const original = new Uint8Array([10, 20, 30]);
      const encrypted = await aesEncryptBytes(original, aesKey);

      const mockDownload: StreamingDownloadFn = vi.fn().mockResolvedValue(encrypted);

      // Act
      const result = await downloadAttachment(
        'server-uuid', 'feed-id', 'user-addr', aesKey, mockDownload,
      );

      // Assert
      expect(result).toEqual(original);
      expect(mockDownload).toHaveBeenCalledWith('server-uuid', 'feed-id', 'user-addr', false);
      // Verify it was cached
      expect(cache.has('server-uuid')).toBe(true);
    });

    it('should download thumbnail when requested', async () => {
      // Arrange
      const cache = new AttachmentCache(new MemoryBackend());
      setAttachmentCache(cache);

      const thumbData = new Uint8Array([99, 88, 77]);
      const encryptedThumb = await aesEncryptBytes(thumbData, aesKey);

      const mockDownload: StreamingDownloadFn = vi.fn().mockResolvedValue(encryptedThumb);

      // Act
      const result = await downloadAttachment(
        'thumb-uuid', 'feed-id', 'user-addr', aesKey, mockDownload, true,
      );

      // Assert
      expect(result).toEqual(thumbData);
      expect(mockDownload).toHaveBeenCalledWith('thumb-uuid', 'feed-id', 'user-addr', true);
      expect(cache.has('thumb-uuid', 'thumbnail')).toBe(true);
    });
  });
});
