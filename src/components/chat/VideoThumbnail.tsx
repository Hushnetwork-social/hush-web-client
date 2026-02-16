"use client";

import { memo } from "react";
import { Play, Video, Loader2 } from "lucide-react";
import type { AttachmentRefMeta } from "@/types";

/** Props for the VideoThumbnail component. */
export interface VideoThumbnailProps {
  /** Attachment metadata (on-chain ref) */
  attachment: AttachmentRefMeta;
  /** Thumbnail blob URL for the extracted video frame (null while loading) */
  thumbnailUrl: string | null;
  /** Video duration in seconds (for badge) */
  duration?: number;
  /** Whether the full video is being downloaded */
  isDownloading?: boolean;
  /** Download progress percentage (0-100) */
  downloadProgress?: number;
  /** Callback when thumbnail is clicked (opens lightbox) */
  onClick?: () => void;
}

/**
 * Format seconds into a human-readable duration string.
 * @returns "M:SS" for < 1 hour, "H:MM:SS" for >= 1 hour
 */
export function formatDuration(seconds: number): string {
  const s = Math.floor(seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/**
 * FEAT-068: Video thumbnail component for message bubbles.
 *
 * Displays video attachments as a full-width thumbnail with:
 * - Extracted video frame (same styling as image thumbnails)
 * - Centered play icon overlay (semi-transparent circle + white triangle)
 * - Duration badge in bottom-right corner
 * - Skeleton shimmer while thumbnail is loading
 * - Fallback with Video icon when no thumbnail available
 * - Circular progress overlay during full video download
 */
export const VideoThumbnail = memo(function VideoThumbnail({
  attachment,
  thumbnailUrl,
  duration,
  isDownloading = false,
  downloadProgress = 0,
  onClick,
}: VideoThumbnailProps) {
  // Loading state: skeleton shimmer
  if (thumbnailUrl === null) {
    return (
      <div
        className="w-full rounded-lg overflow-hidden"
        data-testid="video-skeleton"
      >
        <div className="w-full h-40 bg-white/10 animate-pulse rounded-lg" />
      </div>
    );
  }

  // Fallback: no thumbnail (empty string = extraction failed)
  if (!thumbnailUrl) {
    return (
      <div
        className="relative w-full rounded-lg overflow-hidden cursor-pointer"
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick?.(); }}
        aria-label={`Play video ${attachment.fileName}`}
        data-testid="video-fallback"
      >
        <div className="w-full h-40 bg-white/5 flex items-center justify-center rounded-lg">
          <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
            <Video className="w-6 h-6 text-white" />
          </div>
        </div>
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
      aria-label={`Play video ${attachment.fileName}`}
      data-testid="video-thumbnail"
    >
      {/* Video frame thumbnail */}
      {/* eslint-disable-next-line @next/next/no-img-element -- blob URL from extracted frame */}
      <img
        src={thumbnailUrl}
        alt={attachment.fileName}
        className="w-full h-auto rounded-lg"
        data-testid="video-thumbnail-img"
      />

      {/* Play icon overlay (centered) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center"
          data-testid="video-play-icon"
        >
          <Play className="w-6 h-6 text-white fill-white ml-0.5" />
        </div>
      </div>

      {/* Duration badge (bottom-right) */}
      {duration !== undefined && duration > 0 && (
        <div
          className="absolute bottom-2 right-2 bg-black/60 rounded-full px-2 py-0.5"
          data-testid="video-duration-badge"
        >
          <span className="text-xs text-white font-medium">{formatDuration(duration)}</span>
        </div>
      )}

      {/* Download progress overlay */}
      {isDownloading && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg"
          data-testid="video-download-progress"
        >
          <div className="relative w-10 h-10">
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
