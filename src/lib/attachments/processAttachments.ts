/**
 * FEAT-067: Attachment processing pipeline.
 *
 * Processes files through: HEIC convert -> compress -> thumbnail -> encrypt -> prepare.
 * Returns data ready for sendMessage (on-chain refs + encrypted blobs).
 */

import { isHeic, convertHeicToJpeg } from './heicConverter';
import { compressImage } from './imageCompressor';
import { generateThumbnail } from './thumbnailGenerator';
import { isVideoType, isPdfType } from './fileTypeValidator';
import { prepareAttachmentForUpload } from './attachmentService';
import type { AttachmentUploadData } from './types';
import type { ProcessedAttachment } from '@/modules/feeds/FeedsService';
import type { AttachmentRefPayload } from '@/lib/crypto';

/** Check if a MIME type is an image type. */
function isImageType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/** Convert a Uint8Array to a base64 string. */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Process a single file through the image attachment pipeline.
 *
 * Pipeline for images:
 * 1. HEIC convert (if needed)
 * 2. Compress (if over size limit)
 * 3. Generate thumbnail (300px)
 * 4. Encrypt + hash via prepareAttachmentForUpload
 *
 * Pipeline for non-images:
 * 1. Encrypt + hash via prepareAttachmentForUpload (no thumbnail)
 */
async function processOneFile(
  file: File,
  aesKeyBase64: string,
): Promise<ProcessedAttachment> {
  let blob: Blob = file;
  let fileName = file.name;
  let mimeType = file.type || 'application/octet-stream';

  // Step 1: HEIC conversion (images only)
  if (isHeic(file)) {
    try {
      const result = await convertHeicToJpeg(file, fileName);
      blob = result.blob;
      fileName = result.fileName;
      mimeType = 'image/jpeg';
    } catch (error) {
      console.warn(`[processAttachments] HEIC conversion failed for ${fileName}, sending as-is:`, error);
      // Fall through - send original file without conversion
    }
  }

  // Step 2: Compress (images only, if over size limit)
  if (isImageType(mimeType)) {
    try {
      const compressed = await compressImage(blob);
      blob = compressed.blob;
    } catch (error) {
      console.warn(`[processAttachments] Compression failed for ${fileName}, using original:`, error);
      // Fall through - use uncompressed image
    }
  }

  // Step 3: Generate thumbnail (images, videos, and PDFs)
  let thumbnailBytes: Uint8Array | undefined;
  if (isImageType(mimeType)) {
    try {
      const thumbResult = await generateThumbnail(blob);
      const thumbBuffer = await thumbResult.blob.arrayBuffer();
      thumbnailBytes = new Uint8Array(thumbBuffer);
    } catch (error) {
      console.warn(`[processAttachments] Thumbnail generation failed for ${fileName}, sending without thumbnail:`, error);
    }
  } else if (isVideoType(mimeType)) {
    try {
      const { extractVideoFrames } = await import('./videoFrameExtractor');
      const frames = await extractVideoFrames(blob);
      if (frames.length > 0) {
        const thumbBuffer = await frames[0].blob.arrayBuffer();
        thumbnailBytes = new Uint8Array(thumbBuffer);
      }
    } catch (error) {
      console.warn(`[processAttachments] Video thumbnail failed for ${fileName}, sending without thumbnail:`, error);
    }
  } else if (isPdfType(mimeType)) {
    try {
      const { generatePdfThumbnail } = await import('./pdfThumbnailGenerator');
      const result = await generatePdfThumbnail(blob);
      if (result) {
        const thumbBuffer = await result.blob.arrayBuffer();
        thumbnailBytes = new Uint8Array(thumbBuffer);
      }
    } catch (error) {
      console.warn(`[processAttachments] PDF thumbnail failed for ${fileName}, sending without thumbnail:`, error);
    }
  }

  // Step 4: Read file bytes
  const fileBuffer = await blob.arrayBuffer();
  const fileBytes = new Uint8Array(fileBuffer);

  // Step 5: Encrypt + hash + UUID via FEAT-066 infrastructure
  const uploadData: AttachmentUploadData = await prepareAttachmentForUpload(
    fileBytes,
    fileName,
    mimeType,
    aesKeyBase64,
    thumbnailBytes,
  );

  // Build the on-chain ref for the signed payload
  const ref: AttachmentRefPayload = {
    Id: uploadData.ref.id,
    Hash: uploadData.ref.hash,
    MimeType: uploadData.ref.mimeType,
    Size: uploadData.ref.size,
    FileName: uploadData.ref.fileName,
  };

  // Build base64-encoded blob for JSON transport
  const blobPayload = {
    attachmentId: uploadData.blob.attachmentId,
    encryptedOriginal: uint8ArrayToBase64(uploadData.blob.encryptedOriginal),
    ...(uploadData.blob.encryptedThumbnail && {
      encryptedThumbnail: uint8ArrayToBase64(uploadData.blob.encryptedThumbnail),
    }),
  };

  // Build metadata for optimistic message display
  const meta = {
    id: uploadData.ref.id,
    hash: uploadData.ref.hash,
    mimeType: uploadData.ref.mimeType,
    size: uploadData.ref.size,
    fileName: uploadData.ref.fileName,
  };

  return { ref, blobPayload, meta };
}

/**
 * Process multiple files through the attachment pipeline.
 * All files are processed in parallel.
 *
 * @param files Array of File objects from the ComposerOverlay
 * @param aesKeyBase64 Feed's AES-256 key (base64) for encryption
 * @returns Array of ProcessedAttachment ready for sendMessage
 */
export async function processAttachmentFiles(
  files: File[],
  aesKeyBase64: string,
): Promise<ProcessedAttachment[]> {
  return Promise.all(files.map(f => processOneFile(f, aesKeyBase64)));
}
