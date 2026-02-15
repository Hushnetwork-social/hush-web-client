/**
 * FEAT-067: Unit tests for heicConverter.
 *
 * Tests HEIC detection logic and conversion flow with mocked heic2any.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isHeic, convertHeicToJpeg } from '../heicConverter';

// Mock heic2any
vi.mock('heic2any', () => ({
  default: vi.fn(),
}));

describe('isHeic', () => {
  it('detects image/heic MIME type', () => {
    expect(isHeic({ type: 'image/heic', name: 'photo.heic' })).toBe(true);
  });

  it('detects image/heif MIME type', () => {
    expect(isHeic({ type: 'image/heif', name: 'photo.heif' })).toBe(true);
  });

  it('detects .heic extension when MIME is empty', () => {
    expect(isHeic({ type: '', name: 'photo.heic' })).toBe(true);
  });

  it('detects .heif extension when MIME is empty', () => {
    expect(isHeic({ type: '', name: 'photo.heif' })).toBe(true);
  });

  it('detects HEIC case-insensitively by extension', () => {
    expect(isHeic({ type: '', name: 'PHOTO.HEIC' })).toBe(true);
  });

  it('returns false for JPEG', () => {
    expect(isHeic({ type: 'image/jpeg', name: 'photo.jpg' })).toBe(false);
  });

  it('returns false for PNG', () => {
    expect(isHeic({ type: 'image/png', name: 'image.png' })).toBe(false);
  });

  it('returns false for empty file', () => {
    expect(isHeic({})).toBe(false);
  });

  it('returns false when name has no extension', () => {
    expect(isHeic({ type: '', name: 'photo' })).toBe(false);
  });
});

describe('convertHeicToJpeg', () => {
  let mockHeic2any: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const mod = await import('heic2any');
    mockHeic2any = mod.default as unknown as ReturnType<typeof vi.fn>;
    mockHeic2any.mockReset();
  });

  it('passes through non-HEIC files unchanged', async () => {
    const file = new Blob([new Uint8Array(10)], { type: 'image/jpeg' });
    const result = await convertHeicToJpeg(file, 'photo.jpg');

    expect(result.blob).toBe(file);
    expect(result.fileName).toBe('photo.jpg');
    expect(result.wasConverted).toBe(false);
    expect(mockHeic2any).not.toHaveBeenCalled();
  });

  it('converts HEIC file to JPEG', async () => {
    const jpegBlob = new Blob([new Uint8Array(20)], { type: 'image/jpeg' });
    mockHeic2any.mockResolvedValue(jpegBlob);

    const heicFile = new Blob([new Uint8Array(10)], { type: 'image/heic' });
    const result = await convertHeicToJpeg(heicFile, 'photo.heic');

    expect(result.blob).toBe(jpegBlob);
    expect(result.fileName).toBe('photo.jpg');
    expect(result.wasConverted).toBe(true);
    expect(mockHeic2any).toHaveBeenCalledWith({
      blob: heicFile,
      toType: 'image/jpeg',
      quality: 0.92,
    });
  });

  it('handles heic2any returning an array', async () => {
    const jpegBlob = new Blob([new Uint8Array(20)], { type: 'image/jpeg' });
    mockHeic2any.mockResolvedValue([jpegBlob]);

    const heicFile = new Blob([new Uint8Array(10)], { type: 'image/heic' });
    const result = await convertHeicToJpeg(heicFile, 'photo.heic');

    expect(result.blob).toBe(jpegBlob);
    expect(result.wasConverted).toBe(true);
  });

  it('updates .heif extension to .jpg', async () => {
    const jpegBlob = new Blob([new Uint8Array(20)], { type: 'image/jpeg' });
    mockHeic2any.mockResolvedValue(jpegBlob);

    const heifFile = new Blob([new Uint8Array(10)], { type: 'image/heif' });
    const result = await convertHeicToJpeg(heifFile, 'photo.heif');

    expect(result.fileName).toBe('photo.jpg');
  });

  it('throws descriptive error on conversion failure', async () => {
    mockHeic2any.mockRejectedValue(new Error('WASM init failed'));

    const heicFile = new Blob([new Uint8Array(10)], { type: 'image/heic' });

    await expect(convertHeicToJpeg(heicFile, 'photo.heic')).rejects.toThrow(
      'Failed to convert HEIC image: WASM init failed',
    );
  });

  it('error message includes manual conversion suggestion', async () => {
    mockHeic2any.mockRejectedValue(new Error('corrupt'));

    const heicFile = new Blob([new Uint8Array(10)], { type: 'image/heic' });

    await expect(convertHeicToJpeg(heicFile, 'photo.heic')).rejects.toThrow(
      'Try converting the file to JPEG manually',
    );
  });
});
