/**
 * FEAT-067: Auto-compression for oversized images.
 *
 * Quality-reduction-first strategy:
 * 1. If image is under MAX_ATTACHMENT_SIZE, pass through unchanged
 * 2. For JPEG/WebP: try quality steps 80% → 60% → 40%
 * 3. If still too large: resize dimensions
 * Platform-adaptive max dimensions: 4000px mobile, 8000px desktop.
 */

import { MAX_ATTACHMENT_SIZE } from './types';

/** Quality reduction steps for JPEG/WebP (tried in order). */
const QUALITY_STEPS = [0.80, 0.60, 0.40];

/** Maximum dimension for mobile platforms. */
export const MAX_DIMENSION_MOBILE = 4000;

/** Maximum dimension for desktop platforms. */
export const MAX_DIMENSION_DESKTOP = 8000;

/** Resize scale steps (tried after quality reduction fails). */
const RESIZE_STEPS = [0.75, 0.50, 0.25];

/** Result of image compression. */
export interface CompressionResult {
  /** Compressed (or original) blob */
  blob: Blob;
  /** Whether compression was performed */
  wasCompressed: boolean;
}

/**
 * Detect if the current platform is mobile.
 * Checks for touch support and small viewport as heuristics.
 */
export function isMobilePlatform(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.innerWidth < 768
  );
}

/**
 * Get the maximum image dimension for the current platform.
 */
export function getMaxDimension(): number {
  return isMobilePlatform() ? MAX_DIMENSION_MOBILE : MAX_DIMENSION_DESKTOP;
}

/**
 * Compress an image to fit within MAX_ATTACHMENT_SIZE.
 *
 * Strategy:
 * 1. Pass through if already under limit
 * 2. Apply dimension cap (platform-adaptive)
 * 3. Try quality reduction (JPEG/WebP only)
 * 4. Fallback to dimension reduction
 *
 * @param file Image blob to compress
 * @param maxSize Maximum file size in bytes (default: MAX_ATTACHMENT_SIZE)
 * @returns Compression result
 */
export async function compressImage(
  file: Blob,
  maxSize: number = MAX_ATTACHMENT_SIZE,
): Promise<CompressionResult> {
  // Pass through if already under limit
  if (file.size <= maxSize) {
    return { blob: file, wasCompressed: false };
  }

  // Skip compression for animated GIFs — Canvas rendering destroys animation frames.
  // GIFs are already LZW-compressed; re-encoding through Canvas produces a single
  // static frame, which is strictly worse. Pass through as-is.
  if (file.type === 'image/gif') {
    return { blob: file, wasCompressed: false };
  }

  const mimeType = file.type || 'image/jpeg';
  const supportsQuality = mimeType === 'image/jpeg' || mimeType === 'image/webp';

  // Load image to get dimensions
  const img = await loadImage(file);
  let { naturalWidth: width, naturalHeight: height } = img;

  // Apply platform dimension cap
  const maxDim = getMaxDimension();
  const longest = Math.max(width, height);
  if (longest > maxDim) {
    const scale = maxDim / longest;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  // Try quality reduction first (JPEG/WebP only)
  if (supportsQuality) {
    for (const quality of QUALITY_STEPS) {
      const blob = await renderToBlob(img, width, height, mimeType, quality);
      if (blob.size <= maxSize) {
        return { blob, wasCompressed: true };
      }
    }
  }

  // Fallback: resize dimensions
  for (const scale of RESIZE_STEPS) {
    const scaledWidth = Math.round(width * scale);
    const scaledHeight = Math.round(height * scale);
    const quality = supportsQuality ? 0.80 : undefined;
    const blob = await renderToBlob(img, scaledWidth, scaledHeight, mimeType, quality);
    if (blob.size <= maxSize) {
      return { blob, wasCompressed: true };
    }
  }

  // Last resort: smallest resize with lowest quality
  const finalWidth = Math.round(width * 0.25);
  const finalHeight = Math.round(height * 0.25);
  const blob = await renderToBlob(img, finalWidth, finalHeight, mimeType, supportsQuality ? 0.40 : undefined);
  return { blob, wasCompressed: true };
}

/** Load an image element from a Blob. */
function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for compression'));
    };
    img.src = url;
  });
}

/** Render an image to a canvas and export as blob. */
function renderToBlob(
  img: HTMLImageElement,
  width: number,
  height: number,
  mimeType: string,
  quality?: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob returned null during compression'));
      },
      mimeType,
      quality,
    );
  });
}
