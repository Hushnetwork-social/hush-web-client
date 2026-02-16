"use client";

import { memo } from "react";
import { FileIcon, Loader2 } from "lucide-react";
import type { AttachmentRefMeta } from "@/types";

/** Props for the AttachmentThumbnail component. */
export interface AttachmentThumbnailProps {
  /** Attachment metadata (on-chain ref) */
  attachment: AttachmentRefMeta;
  /** Object URL for the decrypted thumbnail (null while loading) */
  thumbnailUrl: string | null;
  /** Whether the full-size image is currently downloading (for lightbox) */
  isDownloading?: boolean;
  /** Download progress percentage (0-100) */
  downloadProgress?: number;
  /** Callback when thumbnail is clicked (opens lightbox) */
  onClick?: () => void;
}

/** Format bytes into a human-readable size string. */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Check if a MIME type is an image type. */
function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

/**
 * FEAT-067: Attachment thumbnail component for message bubbles.
 *
 * Displays image thumbnails inline in message bubbles with:
 * - Skeleton shimmer while thumbnail is downloading
 * - Full bubble width with proportional height
 * - GIF auto-play (loops continuously)
 * - Click-to-open-lightbox
 * - Non-image file placeholders (icon + filename + size)
 * - Circular progress overlay during full-size download
 */
export const AttachmentThumbnail = memo(function AttachmentThumbnail({
  attachment,
  thumbnailUrl,
  isDownloading = false,
  downloadProgress = 0,
  onClick,
}: AttachmentThumbnailProps) {
  const isImage = isImageMimeType(attachment.mimeType);

  // Non-image file: show generic icon + filename + size
  if (!isImage) {
    return (
      <div
        className="flex items-center gap-2 p-3 rounded-lg bg-white/5 cursor-pointer hover:bg-white/10 transition-colors"
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick?.(); }}
        data-testid="attachment-file"
      >
        <FileIcon className="w-8 h-8 text-hush-text-accent shrink-0" data-testid="file-icon" />
        <div className="min-w-0">
          <p className="text-sm text-hush-text-primary truncate" data-testid="file-name">
            {attachment.fileName}
          </p>
          <p className="text-xs text-hush-text-accent" data-testid="file-size">
            {formatSize(attachment.size)}
          </p>
        </div>
      </div>
    );
  }

  // Image: skeleton while loading, then thumbnail
  if (!thumbnailUrl) {
    return (
      <div
        className="w-full rounded-lg overflow-hidden"
        data-testid="attachment-skeleton"
      >
        <div className="w-full h-40 bg-white/10 animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div
      className="relative w-full rounded-lg overflow-hidden cursor-pointer group"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick?.(); }}
      data-testid="attachment-image"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- blob URLs from decrypted thumbnails can't use next/image */}
      <img
        src={thumbnailUrl}
        alt={attachment.fileName}
        className="w-full h-auto rounded-lg"
        data-testid="attachment-img"
      />

      {/* Circular progress overlay during full-size download */}
      {isDownloading && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg"
          data-testid="download-progress"
        >
          <div className="relative w-10 h-10">
            {/* Background circle */}
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18" cy="18" r="16"
                fill="none"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="2"
              />
              <circle
                cx="18" cy="18" r="16"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeDasharray={`${downloadProgress} ${100 - downloadProgress}`}
                strokeLinecap="round"
              />
            </svg>
            {downloadProgress === 0 && (
              <Loader2 className="absolute inset-0 m-auto w-5 h-5 text-white animate-spin" />
            )}
          </div>
        </div>
      )}
    </div>
  );
});

/**
 * Generate a type hint text for attachment summaries (e.g., "[2 images]", "[1 image, 1 document]").
 */
export function getAttachmentTypeHint(attachments: AttachmentRefMeta[]): string {
  let imageCount = 0;
  let otherCount = 0;

  for (const att of attachments) {
    if (isImageMimeType(att.mimeType)) {
      imageCount++;
    } else {
      otherCount++;
    }
  }

  const parts: string[] = [];
  if (imageCount > 0) {
    parts.push(`${imageCount} image${imageCount > 1 ? "s" : ""}`);
  }
  if (otherCount > 0) {
    parts.push(`${otherCount} file${otherCount > 1 ? "s" : ""}`);
  }

  return parts.length > 0 ? `[${parts.join(", ")}]` : "";
}
