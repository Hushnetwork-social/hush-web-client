/**
 * FEAT-067: Unit tests for imageCompressor.
 *
 * Tests compression logic with mocked Canvas/Image APIs.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  compressImage,
  isMobilePlatform,
  getMaxDimension,
  MAX_DIMENSION_MOBILE,
  MAX_DIMENSION_DESKTOP,
} from '../imageCompressor';
import { MAX_ATTACHMENT_SIZE } from '../types';

describe('isMobilePlatform', () => {
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true });
  });

  it('detects mobile by touch support', () => {
    Object.defineProperty(window, 'ontouchstart', { value: () => {}, configurable: true });
    expect(isMobilePlatform()).toBe(true);
    delete (window as Record<string, unknown>)['ontouchstart'];
  });

  it('detects mobile by narrow viewport', () => {
    Object.defineProperty(window, 'innerWidth', { value: 400, writable: true });
    expect(isMobilePlatform()).toBe(true);
  });

  it('detects desktop for wide viewport without touch', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });
    delete (window as Record<string, unknown>)['ontouchstart'];
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, writable: true, configurable: true });
    expect(isMobilePlatform()).toBe(false);
  });
});

describe('getMaxDimension', () => {
  it('returns correct mobile dimension constant', () => {
    expect(MAX_DIMENSION_MOBILE).toBe(4000);
  });

  it('returns correct desktop dimension constant', () => {
    expect(MAX_DIMENSION_DESKTOP).toBe(8000);
  });

  it('returns a number', () => {
    expect(typeof getMaxDimension()).toBe('number');
  });
});

describe('compressImage', () => {
  let mockCanvas: {
    width: number;
    height: number;
    getContext: ReturnType<typeof vi.fn>;
    toBlob: ReturnType<typeof vi.fn>;
  };
  let mockCtx: { drawImage: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockCtx = { drawImage: vi.fn() };
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

  it('passes through images under 25MB unchanged', async () => {
    const smallFile = new Blob([new Uint8Array(1000)], { type: 'image/jpeg' });
    const result = await compressImage(smallFile);

    expect(result.blob).toBe(smallFile);
    expect(result.wasCompressed).toBe(false);
  });

  it('passes through images at exactly MAX_ATTACHMENT_SIZE', async () => {
    const exactFile = new Blob([new Uint8Array(MAX_ATTACHMENT_SIZE)], { type: 'image/jpeg' });
    const result = await compressImage(exactFile);

    expect(result.blob).toBe(exactFile);
    expect(result.wasCompressed).toBe(false);
  });

  it('compresses JPEG via quality reduction', async () => {
    setupImageLoad(2000, 1500);

    // First quality step (0.80) produces small enough result
    let callCount = 0;
    mockCanvas.toBlob.mockImplementation((callback: BlobCallback, type?: string) => {
      callCount++;
      const size = callCount === 1 ? 10_000_000 : 5_000_000;
      callback(new Blob([new Uint8Array(size)], { type: type || 'image/jpeg' }));
    });

    const maxSize = 15_000_000;
    const oversized = new Blob([new Uint8Array(maxSize + 1)], { type: 'image/jpeg' });
    const result = await compressImage(oversized, maxSize);

    expect(result.wasCompressed).toBe(true);
    expect(result.blob.size).toBeLessThanOrEqual(maxSize);
  });

  it('falls back to resize when quality alone is insufficient', async () => {
    setupImageLoad(4000, 3000);

    let callCount = 0;
    mockCanvas.toBlob.mockImplementation((callback: BlobCallback, type?: string) => {
      callCount++;
      // Quality steps (3 calls) all too large, first resize (4th call) works
      const size = callCount <= 3 ? 20_000_000 : 5_000_000;
      callback(new Blob([new Uint8Array(size)], { type: type || 'image/jpeg' }));
    });

    const maxSize = 10_000_000;
    const oversized = new Blob([new Uint8Array(maxSize + 1)], { type: 'image/jpeg' });
    const result = await compressImage(oversized, maxSize);

    expect(result.wasCompressed).toBe(true);
    expect(result.blob.size).toBeLessThanOrEqual(maxSize);
  });

  it('resizes PNG directly (no quality parameter)', async () => {
    setupImageLoad(2000, 2000);

    mockCanvas.toBlob.mockImplementation((callback: BlobCallback, type?: string) => {
      callback(new Blob([new Uint8Array(5_000_000)], { type: type || 'image/png' }));
    });

    const maxSize = 10_000_000;
    const oversized = new Blob([new Uint8Array(maxSize + 1)], { type: 'image/png' });
    const result = await compressImage(oversized, maxSize);

    expect(result.wasCompressed).toBe(true);
  });

  it('exports MAX_ATTACHMENT_SIZE as 25MB', () => {
    expect(MAX_ATTACHMENT_SIZE).toBe(25 * 1024 * 1024);
  });
});
