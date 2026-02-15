/**
 * FEAT-067: HEIC/HEIF to JPEG conversion.
 *
 * Detects HEIC/HEIF images by MIME type or file extension
 * and converts them to JPEG using the heic2any library.
 * Non-HEIC files pass through unchanged.
 */

/** HEIC conversion quality (JPEG output). */
const HEIC_JPEG_QUALITY = 0.92;

/** MIME types that indicate HEIC/HEIF format. */
const HEIC_MIME_TYPES = new Set(['image/heic', 'image/heif']);

/** File extensions that indicate HEIC/HEIF format. */
const HEIC_EXTENSIONS = new Set(['.heic', '.heif']);

/** Result of HEIC conversion. */
export interface HeicConversionResult {
  /** Converted (or original) blob */
  blob: Blob;
  /** Updated file name (extension changed to .jpg if converted) */
  fileName: string;
  /** Whether conversion was performed */
  wasConverted: boolean;
}

/**
 * Check if a file is HEIC/HEIF format.
 * Checks both MIME type and file extension.
 */
export function isHeic(file: { type?: string; name?: string }): boolean {
  // Check MIME type
  if (file.type && HEIC_MIME_TYPES.has(file.type.toLowerCase())) {
    return true;
  }

  // Check file extension
  if (file.name) {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    return HEIC_EXTENSIONS.has(ext);
  }

  return false;
}

/**
 * Convert a HEIC/HEIF file to JPEG.
 * Non-HEIC files pass through unchanged.
 *
 * @param file The input file
 * @param fileName The original file name
 * @returns Conversion result with blob, updated fileName, and conversion flag
 */
export async function convertHeicToJpeg(
  file: Blob,
  fileName: string,
): Promise<HeicConversionResult> {
  if (!isHeic({ type: file.type, name: fileName })) {
    return { blob: file, fileName, wasConverted: false };
  }

  try {
    // Dynamic import to avoid loading WASM unless needed
    const heic2any = (await import('heic2any')).default;

    const result = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: HEIC_JPEG_QUALITY,
    });

    // heic2any can return a single blob or an array (for HEIF containers with multiple images)
    const convertedBlob = Array.isArray(result) ? result[0] : result;

    // Update file name extension
    const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
    const newFileName = baseName ? `${baseName}.jpg` : `${fileName}.jpg`;

    return { blob: convertedBlob, fileName: newFileName, wasConverted: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to convert HEIC image: ${message}. Try converting the file to JPEG manually before uploading.`,
    );
  }
}
