import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies before importing
vi.mock('./heicConverter', () => ({
  isHeic: vi.fn(() => false),
  convertHeicToJpeg: vi.fn(),
}));

vi.mock('./imageCompressor', () => ({
  compressImage: vi.fn(async (blob: Blob) => {
    // Return a blob that has arrayBuffer (jsdom may not support it natively)
    const result = new Blob([new Uint8Array(64)], { type: blob.type || 'image/jpeg' });
    if (!result.arrayBuffer) {
      const buf = new Uint8Array(64).buffer;
      (result as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = () =>
        Promise.resolve(buf as ArrayBuffer);
    }
    return { blob: result, wasCompressed: false };
  }),
}));

vi.mock('./thumbnailGenerator', () => ({
  generateThumbnail: vi.fn(async () => {
    const thumbBytes = new Uint8Array([10, 20, 30]);
    const blob = new Blob([thumbBytes], { type: 'image/jpeg' });
    // Ensure arrayBuffer is available (jsdom Blob may lack it)
    if (!blob.arrayBuffer) {
      (blob as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = () =>
        Promise.resolve(thumbBytes.buffer as ArrayBuffer);
    }
    return { blob, width: 300, height: 200 };
  }),
}));

vi.mock('./attachmentService', () => ({
  prepareAttachmentForUpload: vi.fn(async (
    _fileBytes: Uint8Array,
    fileName: string,
    mimeType: string,
    _aesKey: string,
    _thumbnailBytes?: Uint8Array,
  ) => ({
    ref: {
      id: 'mock-uuid',
      hash: 'mock-hash-abcdef1234567890',
      mimeType,
      size: _fileBytes.byteLength,
      fileName,
    },
    blob: {
      attachmentId: 'mock-uuid',
      encryptedOriginal: new Uint8Array([1, 2, 3]),
      encryptedThumbnail: _thumbnailBytes ? new Uint8Array([4, 5, 6]) : null,
    },
  })),
}));

import { processAttachmentFiles } from './processAttachments';
import { isHeic, convertHeicToJpeg } from './heicConverter';
import { compressImage } from './imageCompressor';
import { generateThumbnail } from './thumbnailGenerator';
import { prepareAttachmentForUpload } from './attachmentService';

function createMockFile(name: string, type: string, size = 1024): File {
  const content = new Uint8Array(size);
  const file = new File([content], name, { type });
  // Ensure arrayBuffer is available (jsdom may lack it on File)
  if (!file.arrayBuffer) {
    (file as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = () =>
      Promise.resolve(content.buffer as ArrayBuffer);
  }
  return file;
}

describe('processAttachmentFiles', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Reset isHeic to default (false) since some tests override it
    vi.mocked(isHeic).mockReturnValue(false);
  });

  it('should process a single image through the full pipeline', async () => {
    const file = createMockFile('photo.jpg', 'image/jpeg', 2048);
    const result = await processAttachmentFiles([file], 'base64-aes-key');

    expect(result).toHaveLength(1);

    // HEIC check should be called
    expect(isHeic).toHaveBeenCalledWith(file);

    // Compression should be called (image type)
    expect(compressImage).toHaveBeenCalled();

    // Thumbnail generation should be called (image type)
    expect(generateThumbnail).toHaveBeenCalled();

    // prepareAttachmentForUpload should be called with correct args
    expect(prepareAttachmentForUpload).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      'photo.jpg',
      'image/jpeg',
      'base64-aes-key',
      expect.any(Uint8Array), // thumbnail bytes
    );
  });

  it('should return correct ref, blobPayload, and meta', async () => {
    const file = createMockFile('photo.jpg', 'image/jpeg', 512);
    const result = await processAttachmentFiles([file], 'key');

    const { ref, blobPayload, meta } = result[0];

    // Ref has PascalCase keys for server payload
    expect(ref.Id).toBe('mock-uuid');
    expect(ref.Hash).toBe('mock-hash-abcdef1234567890');
    expect(ref.MimeType).toBe('image/jpeg');
    expect(ref.FileName).toBe('photo.jpg');

    // Blob payload has base64-encoded encrypted bytes
    expect(blobPayload.attachmentId).toBe('mock-uuid');
    expect(typeof blobPayload.encryptedOriginal).toBe('string'); // base64

    // Meta has camelCase keys for client display
    expect(meta.id).toBe('mock-uuid');
    expect(meta.mimeType).toBe('image/jpeg');
    expect(meta.fileName).toBe('photo.jpg');
  });

  it('should call HEIC conversion when file is HEIC', async () => {
    vi.mocked(isHeic).mockReturnValue(true);
    vi.mocked(convertHeicToJpeg).mockResolvedValue({
      blob: new Blob(['converted'], { type: 'image/jpeg' }),
      fileName: 'photo.jpg',
      wasConverted: true,
    });

    const file = createMockFile('photo.heic', 'image/heic', 1024);
    await processAttachmentFiles([file], 'key');

    expect(convertHeicToJpeg).toHaveBeenCalledWith(file, 'photo.heic');
  });

  it('should NOT call compression or thumbnail for non-image files', async () => {
    const file = createMockFile('report.pdf', 'application/pdf', 2048);
    // Verify the file type is set correctly
    expect(file.type).toBe('application/pdf');

    const result = await processAttachmentFiles([file], 'key');

    expect(result).toHaveLength(1);
    expect(compressImage).not.toHaveBeenCalled();
    expect(generateThumbnail).not.toHaveBeenCalled();

    // prepareAttachmentForUpload should be called without thumbnail bytes
    expect(prepareAttachmentForUpload).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      'report.pdf',
      'application/pdf',
      'key',
      undefined, // no thumbnail for non-images
    );
  });

  it('should process multiple files in parallel', async () => {
    const files = [
      createMockFile('photo1.jpg', 'image/jpeg', 512),
      createMockFile('photo2.png', 'image/png', 1024),
      createMockFile('doc.pdf', 'application/pdf', 2048),
    ];

    const result = await processAttachmentFiles(files, 'key');

    expect(result).toHaveLength(3);
    // prepareAttachmentForUpload called 3 times
    expect(prepareAttachmentForUpload).toHaveBeenCalledTimes(3);
  });

  it('should use correct AES key for encryption', async () => {
    const file = createMockFile('photo.jpg', 'image/jpeg', 512);
    await processAttachmentFiles([file], 'specific-aes-key-base64');

    expect(prepareAttachmentForUpload).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      'photo.jpg',
      'image/jpeg',
      'specific-aes-key-base64',
      expect.any(Uint8Array),
    );
  });

  it('should handle empty files array', async () => {
    const result = await processAttachmentFiles([], 'key');
    expect(result).toHaveLength(0);
    expect(prepareAttachmentForUpload).not.toHaveBeenCalled();
  });

  it('should gracefully handle HEIC conversion failure', async () => {
    vi.mocked(isHeic).mockReturnValue(true);
    vi.mocked(convertHeicToJpeg).mockRejectedValue(new Error('HEIC conversion failed'));

    const file = createMockFile('photo.heic', 'image/heic', 1024);
    const result = await processAttachmentFiles([file], 'key');

    // Should still succeed - sends original file without conversion
    expect(result).toHaveLength(1);
    expect(prepareAttachmentForUpload).toHaveBeenCalled();
  });

  it('should gracefully handle compression failure', async () => {
    vi.mocked(compressImage).mockRejectedValue(new Error('Compression failed'));

    const file = createMockFile('photo.jpg', 'image/jpeg', 2048);
    const result = await processAttachmentFiles([file], 'key');

    // Should still succeed - sends uncompressed image
    expect(result).toHaveLength(1);
    expect(prepareAttachmentForUpload).toHaveBeenCalled();
  });

  it('should gracefully handle thumbnail generation failure', async () => {
    vi.mocked(generateThumbnail).mockRejectedValue(new Error('Thumbnail generation failed'));

    const file = createMockFile('photo.jpg', 'image/jpeg', 2048);
    const result = await processAttachmentFiles([file], 'key');

    // Should still succeed - sends image without thumbnail
    expect(result).toHaveLength(1);
    // prepareAttachmentForUpload called without thumbnail bytes
    expect(prepareAttachmentForUpload).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      'photo.jpg',
      'image/jpeg',
      'key',
      undefined, // no thumbnail due to failure
    );
  });
});
