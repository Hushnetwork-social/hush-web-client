import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * FEAT-068: PDF thumbnail generator tests.
 *
 * Mocks pdfjs-dist to test the generatePdfThumbnail logic without
 * requiring a real PDF renderer in the test environment.
 */

// Save original before spying
const originalCreateElement = document.createElement.bind(document);

// Polyfill Blob.arrayBuffer for jsdom (not available in all environments)
if (!Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function () {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

// Mock pdfjs-dist before importing the module under test
const mockRender = vi.fn();
const mockGetViewport = vi.fn();
const mockGetPage = vi.fn();
const mockDestroy = vi.fn();
const mockGetDocument = vi.fn();

vi.mock('pdfjs-dist', () => ({
  version: '5.4.624',
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
}));

import { generatePdfThumbnail } from './pdfThumbnailGenerator';

function createMockCanvas() {
  return {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage: vi.fn(),
      fillRect: vi.fn(),
    }),
    toBlob: vi.fn((callback: (blob: Blob | null) => void) => {
      callback(new Blob(['jpeg-data'], { type: 'image/jpeg' }));
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  // Default: A4 portrait page (595 x 842 points)
  mockGetViewport.mockImplementation(({ scale }: { scale: number }) => ({
    width: 595 * scale,
    height: 842 * scale,
  }));

  mockGetPage.mockResolvedValue({
    getViewport: mockGetViewport,
    render: mockRender,
  });

  mockRender.mockReturnValue({
    promise: Promise.resolve(),
  });

  mockDestroy.mockResolvedValue(undefined);

  mockGetDocument.mockImplementation(() => ({
    promise: Promise.resolve({
      getPage: mockGetPage,
      destroy: mockDestroy,
    }),
  }));

  // Mock createElement for canvas
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'canvas') return createMockCanvas() as unknown as HTMLElement;
    return originalCreateElement(tag);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('FEAT-068: pdfThumbnailGenerator', () => {
  describe('generatePdfThumbnail', () => {
    it('should return thumbnail for valid PDF', async () => {
      const file = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      const result = await generatePdfThumbnail(file);

      expect(result).not.toBeNull();
      expect(result!.blob).toBeInstanceOf(Blob);
      expect(result!.width).toBe(300);
    });

    it('should scale to 300px width with proportional height', async () => {
      const file = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      const result = await generatePdfThumbnail(file);

      expect(result).not.toBeNull();
      expect(result!.width).toBe(300);
      // A4 portrait: 842/595 * 300 ≈ 425
      expect(result!.height).toBe(Math.round(842 / 595 * 300));
    });

    it('should handle landscape PDF', async () => {
      // Landscape: 842 x 595
      mockGetViewport.mockImplementation(({ scale }: { scale: number }) => ({
        width: 842 * scale,
        height: 595 * scale,
      }));

      const file = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      const result = await generatePdfThumbnail(file);

      expect(result).not.toBeNull();
      expect(result!.width).toBe(300);
      expect(result!.height).toBe(Math.round(595 / 842 * 300));
    });

    it('should return null on render failure', async () => {
      // Use mockImplementation so rejected promise is created lazily (avoids unhandled rejection)
      mockRender.mockImplementation(() => ({
        promise: Promise.reject(new Error('Render failed')),
      }));

      const file = new Blob(['corrupted'], { type: 'application/pdf' });
      const result = await generatePdfThumbnail(file);

      expect(result).toBeNull();
    });

    it('should return null when getPage fails', async () => {
      mockGetPage.mockRejectedValue(new Error('Page not found'));

      const file = new Blob(['corrupted'], { type: 'application/pdf' });
      const result = await generatePdfThumbnail(file);

      expect(result).toBeNull();
    });

    it('should return null when document loading fails', async () => {
      // Use mockImplementation so rejected promise is created lazily (avoids unhandled rejection)
      mockGetDocument.mockImplementation(() => ({
        promise: Promise.reject(new Error('Invalid PDF')),
      }));

      const file = new Blob(['not-a-pdf'], { type: 'application/pdf' });
      const result = await generatePdfThumbnail(file);

      expect(result).toBeNull();
    });

    it('should return null when toBlob returns null', async () => {
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') {
          return {
            width: 0,
            height: 0,
            getContext: () => ({
              drawImage: vi.fn(),
              fillRect: vi.fn(),
            }),
            toBlob: vi.fn((callback: (blob: Blob | null) => void) => {
              callback(null);
            }),
          } as unknown as HTMLElement;
        }
        return originalCreateElement(tag);
      });

      const file = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      const result = await generatePdfThumbnail(file);

      expect(result).toBeNull();
    });

    it('should call document.destroy() for cleanup', async () => {
      const file = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      await generatePdfThumbnail(file);

      expect(mockDestroy).toHaveBeenCalledOnce();
    });

    it('should call document.destroy() even on render failure', async () => {
      mockRender.mockImplementation(() => ({
        promise: Promise.reject(new Error('Render failed')),
      }));

      const file = new Blob(['corrupted'], { type: 'application/pdf' });
      await generatePdfThumbnail(file);

      expect(mockDestroy).toHaveBeenCalledOnce();
    });

    it('should request first page', async () => {
      const file = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      await generatePdfThumbnail(file);

      expect(mockGetPage).toHaveBeenCalledWith(1);
    });
  });
});
