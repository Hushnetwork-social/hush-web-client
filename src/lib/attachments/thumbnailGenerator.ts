/**
 * FEAT-067: Thumbnail generation from images.
 *
 * Generates 300px-width thumbnails with EXIF orientation correction
 * and format preservation. GIFs are passed through unchanged to
 * preserve animation (canvas rendering destroys animation frames).
 * Pure utility with no UI dependencies.
 */

/** Target thumbnail width in pixels. No upscaling if original is smaller. */
export const THUMBNAIL_TARGET_WIDTH = 300;

/** Result of thumbnail generation. */
export interface ThumbnailResult {
  /** Thumbnail image blob */
  blob: Blob;
  /** Thumbnail width in pixels */
  width: number;
  /** Thumbnail height in pixels */
  height: number;
}

/** EXIF orientation tag values that require transformation. */
const EXIF_TRANSFORMS: Record<number, { rotate: number; flipX: boolean }> = {
  2: { rotate: 0, flipX: true },
  3: { rotate: 180, flipX: false },
  4: { rotate: 180, flipX: true },
  5: { rotate: 90, flipX: true },
  6: { rotate: 90, flipX: false },
  7: { rotate: 270, flipX: true },
  8: { rotate: 270, flipX: false },
};

/**
 * Read EXIF orientation from JPEG binary data.
 * Returns orientation value 1-8, or 1 (normal) if not found.
 */
export function readExifOrientation(data: ArrayBuffer): number {
  const view = new DataView(data);

  // Check JPEG SOI marker
  if (view.byteLength < 2 || view.getUint16(0) !== 0xffd8) return 1;

  let offset = 2;
  while (offset < view.byteLength - 4) {
    const marker = view.getUint16(offset);

    // APP1 marker (EXIF)
    if (marker === 0xffe1) {
      view.getUint16(offset + 2); // segment length (not used directly)
      const exifStart = offset + 4;

      // Check "Exif\0\0" header
      if (
        view.byteLength > exifStart + 6 &&
        view.getUint32(exifStart) === 0x45786966 &&
        view.getUint16(exifStart + 4) === 0x0000
      ) {
        const tiffStart = exifStart + 6;

        // Determine byte order
        if (view.byteLength <= tiffStart + 2) return 1;
        const byteOrder = view.getUint16(tiffStart);
        const littleEndian = byteOrder === 0x4949;

        // Read IFD0 entry count
        if (view.byteLength <= tiffStart + 10) return 1;
        const ifdOffset = view.getUint32(tiffStart + 4, littleEndian);
        const ifdStart = tiffStart + ifdOffset;

        if (view.byteLength <= ifdStart + 2) return 1;
        const entryCount = view.getUint16(ifdStart, littleEndian);

        // Scan IFD entries for orientation tag (0x0112)
        for (let i = 0; i < entryCount; i++) {
          const entryOffset = ifdStart + 2 + i * 12;
          if (view.byteLength <= entryOffset + 12) break;

          const tag = view.getUint16(entryOffset, littleEndian);
          if (tag === 0x0112) {
            const value = view.getUint16(entryOffset + 8, littleEndian);
            return value >= 1 && value <= 8 ? value : 1;
          }
        }
      }
      return 1;
    }

    // Skip to next marker
    if ((marker & 0xff00) !== 0xff00) break;
    const segmentLength = view.getUint16(offset + 2);
    offset += 2 + segmentLength;
  }

  return 1;
}

/**
 * Determine the output MIME type for a thumbnail.
 * GIFs are handled earlier (pass-through), so won't reach here.
 */
function thumbnailMimeType(originalType: string): string {
  if (['image/jpeg', 'image/png', 'image/webp'].includes(originalType)) return originalType;
  // Default to JPEG for unknown types
  return 'image/jpeg';
}

/**
 * Generate a thumbnail from an image file.
 *
 * @param file Image file (File or Blob)
 * @param targetWidth Maximum thumbnail width (default 300px)
 * @returns ThumbnailResult with blob and dimensions
 */
export async function generateThumbnail(
  file: Blob,
  targetWidth: number = THUMBNAIL_TARGET_WIDTH,
): Promise<ThumbnailResult> {
  const mimeType = file.type || 'image/jpeg';

  // GIF pass-through: Canvas rendering destroys animation frames.
  // Return the original GIF blob to preserve animation in thumbnails.
  if (mimeType === 'image/gif') {
    const img = await loadImage(file);
    return { blob: file, width: img.naturalWidth, height: img.naturalHeight };
  }

  const outputType = thumbnailMimeType(mimeType);

  // Read EXIF orientation for JPEG
  let orientation = 1;
  if (mimeType === 'image/jpeg') {
    const buffer = await file.arrayBuffer();
    orientation = readExifOrientation(buffer);
  }

  // Load image
  const img = await loadImage(file);

  // Calculate scaled dimensions (before EXIF rotation)
  const srcWidth = img.naturalWidth;
  const srcHeight = img.naturalHeight;

  // For orientations 5-8, the image is rotated 90/270, so width/height are swapped
  const isRotated90 = orientation >= 5 && orientation <= 8;
  const displayWidth = isRotated90 ? srcHeight : srcWidth;
  const displayHeight = isRotated90 ? srcWidth : srcHeight;

  // Calculate target dimensions (no upscaling)
  let thumbWidth: number;
  let thumbHeight: number;
  if (displayWidth <= targetWidth) {
    thumbWidth = displayWidth;
    thumbHeight = displayHeight;
  } else {
    const scale = targetWidth / displayWidth;
    thumbWidth = targetWidth;
    thumbHeight = Math.round(displayHeight * scale);
  }

  // Create canvas and draw with EXIF correction
  const canvas = document.createElement('canvas');
  canvas.width = thumbWidth;
  canvas.height = thumbHeight;
  const ctx = canvas.getContext('2d')!;

  if (orientation !== 1) {
    const transform = EXIF_TRANSFORMS[orientation];
    if (transform) {
      ctx.translate(thumbWidth / 2, thumbHeight / 2);
      if (transform.rotate) {
        ctx.rotate((transform.rotate * Math.PI) / 180);
      }
      if (transform.flipX) {
        ctx.scale(-1, 1);
      }
      // After rotation, draw coordinates are in the rotated space
      if (isRotated90) {
        ctx.drawImage(img, -thumbHeight / 2, -thumbWidth / 2, thumbHeight, thumbWidth);
      } else {
        ctx.drawImage(img, -thumbWidth / 2, -thumbHeight / 2, thumbWidth, thumbHeight);
      }
    }
  } else {
    ctx.drawImage(img, 0, 0, thumbWidth, thumbHeight);
  }

  // Convert to blob
  const blob = await canvasToBlob(canvas, outputType);

  return { blob, width: thumbWidth, height: thumbHeight };
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
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

/** Convert canvas to Blob. */
function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob returned null'));
      },
      mimeType,
      quality,
    );
  });
}
