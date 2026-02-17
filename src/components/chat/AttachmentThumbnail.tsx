"use client";

import { memo } from "react";
import { Loader2 } from "lucide-react";
import { DocumentCard } from "./DocumentCard";
import { VideoThumbnail } from "./VideoThumbnail";
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

/** Check if a MIME type is an image type. */
function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

/** Check if a MIME type is a video type. */
function isVideoMimeType(mimeType: string): boolean {
  return mimeType.startsWith("video/");
}

/**
 * FEAT-067/068: Attachment thumbnail component for message bubbles.
 *
 * Routes rendering based on MIME type:
 * - Images: inline thumbnail with skeleton shimmer and progress overlay
 * - Videos: VideoThumbnail with play icon and duration badge (FEAT-068)
 * - Documents: DocumentCard with file type icon and metadata (FEAT-068)
 */
export const AttachmentThumbnail = memo(function AttachmentThumbnail({
  attachment,
  thumbnailUrl,
  isDownloading = false,
  downloadProgress = 0,
  onClick,
}: AttachmentThumbnailProps) {
  const isImage = isImageMimeType(attachment.mimeType);
  const isVideo = isVideoMimeType(attachment.mimeType);

  // FEAT-068: Video attachment -> VideoThumbnail
  if (isVideo) {
    return (
      <VideoThumbnail
        attachment={attachment}
        thumbnailUrl={thumbnailUrl}
        isDownloading={isDownloading}
        downloadProgress={downloadProgress}
        onClick={onClick}
      />
    );
  }

  // FEAT-068: Non-image, non-video -> DocumentCard
  if (!isImage) {
    return (
      <DocumentCard
        attachment={attachment}
        thumbnailUrl={thumbnailUrl}
        isDownloading={isDownloading}
        downloadProgress={downloadProgress}
        onClick={onClick}
      />
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
      aria-label={`View image ${attachment.fileName}`}
      data-testid="attachment-image"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- blob URLs from decrypted thumbnails can't use next/image */}
      <img
        src={thumbnailUrl}
        alt={attachment.fileName}
        className="w-full h-auto max-h-80 object-contain rounded-lg"
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
 * FEAT-067/068: Generate a type hint text for attachment summaries.
 * e.g., "[2 images]", "[1 image, 1 video, 1 file]"
 */
export function getAttachmentTypeHint(attachments: AttachmentRefMeta[]): string {
  let imageCount = 0;
  let videoCount = 0;
  let otherCount = 0;

  for (const att of attachments) {
    if (isImageMimeType(att.mimeType)) {
      imageCount++;
    } else if (isVideoMimeType(att.mimeType)) {
      videoCount++;
    } else {
      otherCount++;
    }
  }

  const parts: string[] = [];
  if (imageCount > 0) {
    parts.push(`${imageCount} image${imageCount > 1 ? "s" : ""}`);
  }
  if (videoCount > 0) {
    parts.push(`${videoCount} video${videoCount > 1 ? "s" : ""}`);
  }
  if (otherCount > 0) {
    parts.push(`${otherCount} file${otherCount > 1 ? "s" : ""}`);
  }

  return parts.length > 0 ? `[${parts.join(", ")}]` : "";
}
