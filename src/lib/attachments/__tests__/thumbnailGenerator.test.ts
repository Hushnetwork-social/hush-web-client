/**
 * FEAT-067: Unit tests for thumbnailGenerator.
 *
 * Tests EXIF orientation parsing and thumbnail generation logic.
 * Canvas/Image APIs are mocked since we're running in Node/jsdom.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readExifOrientation, generateThumbnail, THUMBNAIL_TARGET_WIDTH } from '../thumbnailGenerator';

// ─── EXIF orientation parsing tests (pure function, no mocks needed) ───

describe('readExifOrientation', () => {
  it('returns 1 for non-JPEG data', () => {
    const buf = new ArrayBuffer(10);
    expect(readExifOrientation(buf)).toBe(1);
  });

  it('returns 1 for JPEG without EXIF', () => {
    // JPEG SOI + non-APP1 marker
    const buf = new ArrayBuffer(10);
    const view = new DataView(buf);
    view.setUint16(0, 0xffd8); // SOI
    view.setUint16(2, 0xffc0); // SOF0 (not APP1)
    view.setUint16(4, 4); // segment length
    expect(readExifOrientation(buf)).toBe(1);
  });

  it('reads orientation from big-endian EXIF', () => {
    // Build minimal JPEG with EXIF APP1 segment containing orientation = 6
    const buf = new ArrayBuffer(50);
    const view = new DataView(buf);
    let offset = 0;

    // SOI
    view.setUint16(offset, 0xffd8);
    offset += 2;

    // APP1 marker
    view.setUint16(offset, 0xffe1);
    offset += 2;
    // APP1 length (covers rest of data)
    view.setUint16(offset, 44);
    offset += 2;

    // "Exif\0\0"
    view.setUint32(offset, 0x45786966);
    offset += 4;
    view.setUint16(offset, 0x0000);
    offset += 2;

    const tiffStart = offset;

    // Big-endian byte order ("MM")
    view.setUint16(offset, 0x4d4d);
    offset += 2;
    // TIFF magic
    view.setUint16(offset, 0x002a);
    offset += 2;
    // IFD0 offset (8 bytes from TIFF start)
    view.setUint32(offset, 8);
    offset += 4;

    // IFD0 entry count = 1
    view.setUint16(tiffStart + 8, 1);

    // IFD entry: tag=0x0112 (orientation), type=3 (SHORT), count=1, value=6
    const entryOffset = tiffStart + 10;
    view.setUint16(entryOffset, 0x0112);     // tag
    view.setUint16(entryOffset + 2, 3);       // type (SHORT)
    view.setUint32(entryOffset + 4, 1);       // count
    view.setUint16(entryOffset + 8, 6);       // value (orientation 6)

    expect(readExifOrientation(buf)).toBe(6);
  });

  it('reads orientation from little-endian EXIF', () => {
    const buf = new ArrayBuffer(50);
    const view = new DataView(buf);
    let offset = 0;

    // SOI
    view.setUint16(offset, 0xffd8);
    offset += 2;

    // APP1 marker
    view.setUint16(offset, 0xffe1);
    offset += 2;
    view.setUint16(offset, 44);
    offset += 2;

    // "Exif\0\0"
    view.setUint32(offset, 0x45786966);
    offset += 4;
    view.setUint16(offset, 0x0000);
    offset += 2;

    const tiffStart = offset;

    // Little-endian ("II")
    view.setUint16(offset, 0x4949);
    offset += 2;
    // TIFF magic (little-endian)
    view.setUint16(offset, 0x002a, true);
    offset += 2;
    // IFD0 offset
    view.setUint32(offset, 8, true);
    offset += 4;

    // IFD0 entry count
    view.setUint16(tiffStart + 8, 1, true);

    const entryOffset = tiffStart + 10;
    view.setUint16(entryOffset, 0x0112, true);   // tag
    view.setUint16(entryOffset + 2, 3, true);     // type
    view.setUint32(entryOffset + 4, 1, true);     // count
    view.setUint16(entryOffset + 8, 3, true);     // value (orientation 3 = 180°)

    expect(readExifOrientation(buf)).toBe(3);
  });

  it('returns 1 for empty data', () => {
    expect(readExifOrientation(new ArrayBuffer(0))).toBe(1);
  });
});

// ─── Thumbnail generation tests (requires browser API mocks) ───

describe('generateThumbnail', () => {
  let mockCanvas: {
    width: number;
    height: number;
    getContext: ReturnType<typeof vi.fn>;
    toBlob: ReturnType<typeof vi.fn>;
  };
  let mockCtx: {
    drawImage: ReturnType<typeof vi.fn>;
    translate: ReturnType<typeof vi.fn>;
    rotate: ReturnType<typeof vi.fn>;
    scale: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockCtx = {
      drawImage: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
    };

    mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockCtx),
      toBlob: vi.fn(),
    };

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') return mockCanvas as unknown as HTMLCanvasElement;
      return document.createElement(tag);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createMockFile(type: string, size: number = 100): Blob {
    const bytes = new Uint8Array(size);
    const blob = new Blob([bytes], { type });
    // Ensure arrayBuffer is available in test env (jsdom may lack it)
    if (!blob.arrayBuffer) {
      blob.arrayBuffer = () => Promise.resolve(bytes.buffer as ArrayBuffer);
    }
    return blob;
  }

  function setupImageLoad(width: number, height: number) {
    const MockImage = vi.fn(function (this: Record<string, unknown>) {
      this.naturalWidth = width;
      this.naturalHeight = height;
      this.onload = null;
      this.onerror = null;
      Object.defineProperty(this, 'src', {
        set() { setTimeout(() => (this as Record<string, (() => void) | null>).onload?.(), 0); },
        get() { return ''; },
        configurable: true,
      });
    });
    vi.stubGlobal('Image', MockImage);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  }

  function setupCanvasToBlob(outputType: string, outputSize: number = 500) {
    mockCanvas.toBlob.mockImplementation(
      (callback: BlobCallback, type?: string) => {
        const blob = new Blob([new Uint8Array(outputSize)], { type: type || outputType });
        callback(blob);
      },
    );
  }

  it('generates 300px width thumbnail from larger image', async () => {
    setupImageLoad(1200, 800);
    setupCanvasToBlob('image/jpeg');

    const file = createMockFile('image/jpeg');
    const result = await generateThumbnail(file);

    expect(result.width).toBe(300);
    expect(result.height).toBe(200);
    expect(result.blob.type).toBe('image/jpeg');
    expect(mockCanvas.width).toBe(300);
    expect(mockCanvas.height).toBe(200);
  });

  it('does not upscale small images', async () => {
    setupImageLoad(150, 100);
    setupCanvasToBlob('image/png');

    const file = createMockFile('image/png');
    const result = await generateThumbnail(file);

    expect(result.width).toBe(150);
    expect(result.height).toBe(100);
  });

  it('passes GIF through unchanged to preserve animation', async () => {
    setupImageLoad(600, 400);

    const file = createMockFile('image/gif');
    const result = await generateThumbnail(file);

    expect(result.blob).toBe(file); // Same blob reference (no canvas conversion)
    expect(result.blob.type).toBe('image/gif');
    expect(result.width).toBe(600);
    expect(result.height).toBe(400);
  });

  it('preserves WebP format', async () => {
    setupImageLoad(600, 400);
    setupCanvasToBlob('image/webp');

    const file = createMockFile('image/webp');
    const result = await generateThumbnail(file);

    expect(result.blob.type).toBe('image/webp');
  });

  it('preserves PNG format', async () => {
    setupImageLoad(600, 600);
    setupCanvasToBlob('image/png');

    const file = createMockFile('image/png');
    const result = await generateThumbnail(file);

    expect(result.blob.type).toBe('image/png');
    expect(result.width).toBe(300);
    expect(result.height).toBe(300);
  });

  it('accepts custom target width', async () => {
    setupImageLoad(800, 600);
    setupCanvasToBlob('image/jpeg');

    const file = createMockFile('image/jpeg');
    const result = await generateThumbnail(file, 200);

    expect(result.width).toBe(200);
    expect(result.height).toBe(150);
  });

  it('exports THUMBNAIL_TARGET_WIDTH constant', () => {
    expect(THUMBNAIL_TARGET_WIDTH).toBe(300);
  });
});
