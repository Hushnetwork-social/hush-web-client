/**
 * FEAT-068: PDF thumbnail generation.
 *
 * Renders the first page of a PDF to a canvas using pdfjs-dist,
 * then converts to a JPEG thumbnail at THUMBNAIL_TARGET_WIDTH (300px).
 * Returns null on failure (UI falls back to PDF icon).
 */

import { THUMBNAIL_TARGET_WIDTH } from './thumbnailGenerator';
import type { ThumbnailResult } from './thumbnailGenerator';
import type { PDFDocumentProxy } from 'pdfjs-dist';

/** JPEG quality for PDF thumbnails. */
const PDF_JPEG_QUALITY = 0.85;

/** Cached pdfjs-dist module (loaded once on first use). */
let pdfjsCache: typeof import('pdfjs-dist') | null = null;

/**
 * Dynamically import pdfjs-dist and configure the worker.
 * Uses dynamic import for code splitting — pdfjs-dist (~2.5MB) is only
 * loaded when a user actually attaches a PDF.
 */
async function getPdfjsLib(): Promise<typeof import('pdfjs-dist')> {
  if (pdfjsCache) return pdfjsCache;

  const pdfjsLib = await import('pdfjs-dist');

  // Configure the worker using CDN to avoid Next.js bundling issues.
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    const version = pdfjsLib.version;
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;
  }

  pdfjsCache = pdfjsLib;
  return pdfjsLib;
}

/**
 * Generate a thumbnail from the first page of a PDF file.
 * Returns null if rendering fails (corrupted, password-protected, etc.).
 */
export async function generatePdfThumbnail(
  file: Blob,
): Promise<ThumbnailResult | null> {
  let pdfDocument: PDFDocumentProxy | null = null;

  try {
    const pdfjsLib = await getPdfjsLib();

    // Load the PDF document
    const arrayBuffer = await file.arrayBuffer();
    pdfDocument = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // Get the first page
    const page = await pdfDocument.getPage(1);

    // Calculate scale for target width
    const unscaledViewport = page.getViewport({ scale: 1 });
    const scale = THUMBNAIL_TARGET_WIDTH / unscaledViewport.width;
    const viewport = page.getViewport({ scale });

    const width = Math.round(viewport.width);
    const height = Math.round(viewport.height);

    // Create canvas and render
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    await page.render({ canvas, canvasContext: ctx, viewport }).promise;

    // Convert to JPEG blob
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (b) => resolve(b),
        'image/jpeg',
        PDF_JPEG_QUALITY,
      );
    });

    if (!blob) return null;

    return { blob, width, height };
  } catch {
    return null;
  } finally {
    if (pdfDocument) {
      try {
        await pdfDocument.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
