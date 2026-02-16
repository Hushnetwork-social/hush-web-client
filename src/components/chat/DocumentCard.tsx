"use client";

import { memo } from "react";
import { Loader2 } from "lucide-react";
import { getFileTypeIcon, formatFileSize } from "@/lib/attachments/fileTypeIcons";
import type { AttachmentRefMeta } from "@/types";

/** Props for the DocumentCard component. */
export interface DocumentCardProps {
  /** Attachment metadata (on-chain ref) */
  attachment: AttachmentRefMeta;
  /** Thumbnail blob URL for PDFs with rendered first page (null = show icon) */
  thumbnailUrl?: string | null;
  /** Whether the file is being downloaded */
  isDownloading?: boolean;
  /** Download progress percentage (0-100) */
  downloadProgress?: number;
  /** Callback when the card is clicked (triggers download) */
  onClick?: () => void;
}

/**
 * FEAT-068: Horizontal document card for message bubbles.
 *
 * Displays document attachments as a horizontal card with:
 * - Left: file type icon (32px) or PDF thumbnail
 * - Right: filename (truncated) + file size
 * - Full card clickable for download
 * - Download progress overlay with circular indicator
 * - Hover tooltip for full filename
 */
export const DocumentCard = memo(function DocumentCard({
  attachment,
  thumbnailUrl,
  isDownloading = false,
  downloadProgress = 0,
  onClick,
}: DocumentCardProps) {
  const iconInfo = getFileTypeIcon(attachment.fileName);
  const IconComponent = iconInfo.icon;

  return (
    <div
      className="relative flex items-center gap-3 p-3 rounded-lg bg-white/5 cursor-pointer hover:bg-white/10 transition-colors"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick?.(); }}
      aria-label={`Download ${attachment.fileName}`}
      title={attachment.fileName}
      data-testid="document-card"
    >
      {/* Left: icon or PDF thumbnail */}
      {thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob URL from PDF render
        <img
          src={thumbnailUrl}
          alt={`Preview of ${attachment.fileName}`}
          className="w-8 h-8 object-cover rounded shrink-0"
          data-testid="document-thumbnail"
        />
      ) : (
        <IconComponent
          className={`w-8 h-8 ${iconInfo.colorClass} shrink-0`}
          data-testid="document-icon"
        />
      )}

      {/* Right: filename + size */}
      <div className="min-w-0">
        <p className="text-sm text-hush-text-primary truncate" data-testid="document-name">
          {attachment.fileName}
        </p>
        <p className="text-xs text-hush-text-accent" data-testid="document-size">
          {formatFileSize(attachment.size)}
        </p>
      </div>

      {/* Download progress overlay */}
      {isDownloading && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg"
          data-testid="document-download-progress"
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
