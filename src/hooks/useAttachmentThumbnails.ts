/**
 * FEAT-067: Hook to auto-download and cache attachment thumbnails for visible messages.
 *
 * Thumbnails are downloaded via FEAT-066 gRPC streaming, decrypted with the feed AES key,
 * and cached as blob URLs. The hook returns a Map<attachmentId, blobUrl> that updates
 * reactively as thumbnails are downloaded.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { downloadAttachment } from '@/lib/attachments/attachmentService';
import type { StreamingDownloadFn } from '@/lib/attachments/attachmentService';
import type { FeedMessage, AttachmentRefMeta } from '@/types';

/**
 * Hook that provides thumbnail blob URLs for messages with attachments.
 *
 * @param messages Array of messages currently visible (or in buffer zone)
 * @param feedId The feed ID (for download authorization)
 * @param userAddress The current user's public signing address
 * @param aesKey The feed's AES key for decryption
 * @param downloadFn The gRPC streaming download function
 * @returns Map of attachment ID -> thumbnail blob URL (null while loading)
 */
export function useAttachmentThumbnails(
  messages: FeedMessage[],
  feedId: string,
  userAddress: string | undefined,
  aesKey: string | undefined,
  downloadFn: StreamingDownloadFn | undefined,
): Map<string, string | null> {
  // Map of attachmentId -> blob URL
  const [thumbnailUrls, setThumbnailUrls] = useState<Map<string, string | null>>(new Map());
  // Track in-flight downloads to avoid duplicates
  const inFlightRef = useRef<Set<string>>(new Set());
  // Track blob URLs for cleanup
  const blobUrlsRef = useRef<Map<string, string>>(new Map());

  // Download a single thumbnail
  const downloadThumbnail = useCallback(async (
    attachment: AttachmentRefMeta,
    currentFeedId: string,
    currentUserAddress: string,
    currentAesKey: string,
    currentDownloadFn: StreamingDownloadFn,
  ) => {
    const { id } = attachment;

    // Skip if already downloaded or in flight
    if (blobUrlsRef.current.has(id) || inFlightRef.current.has(id)) return;

    // Skip non-image attachments (no thumbnails for files)
    if (!attachment.mimeType.startsWith('image/')) return;

    inFlightRef.current.add(id);

    try {
      const decryptedBytes = await downloadAttachment(
        id,
        currentFeedId,
        currentUserAddress,
        currentAesKey,
        currentDownloadFn,
        true, // thumbnailOnly
      );

      // Create blob URL from decrypted bytes
      const mimeType = attachment.mimeType || 'image/jpeg';
      const blob = new Blob([decryptedBytes as BlobPart], { type: mimeType });
      const url = URL.createObjectURL(blob);

      blobUrlsRef.current.set(id, url);
      setThumbnailUrls(prev => {
        const next = new Map(prev);
        next.set(id, url);
        return next;
      });
    } catch (error) {
      // Silent failure - thumbnail will show skeleton
      console.warn(`[useAttachmentThumbnails] Failed to download thumbnail for ${id}:`, error);
    } finally {
      inFlightRef.current.delete(id);
    }
  }, []);

  // Trigger downloads for messages with attachments
  useEffect(() => {
    if (!userAddress || !aesKey || !downloadFn) return;

    for (const message of messages) {
      if (!message.attachments || message.attachments.length === 0) continue;

      for (const att of message.attachments) {
        downloadThumbnail(att, feedId, userAddress, aesKey, downloadFn);
      }
    }
  }, [messages, feedId, userAddress, aesKey, downloadFn, downloadThumbnail]);

  // Cleanup blob URLs on unmount or feed change
  useEffect(() => {
    const urls = blobUrlsRef.current;
    return () => {
      for (const url of urls.values()) {
        URL.revokeObjectURL(url);
      }
      urls.clear();
    };
  }, [feedId]);

  return thumbnailUrls;
}
