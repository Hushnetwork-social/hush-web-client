"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { X, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import type { AttachmentRefMeta } from "@/types";

interface LightboxViewerProps {
  /** Attachment metadata for the message's attachments */
  attachments: AttachmentRefMeta[];
  /** Index of the attachment to show first */
  initialIndex: number;
  /** Map of attachment ID to blob URL for already-downloaded images */
  imageUrls: Map<string, string>;
  /** Map of attachment ID to download progress (0-100) */
  downloadProgress: Map<string, number>;
  /** Callback to request download of a full-size image */
  onRequestDownload?: (attachmentId: string) => void;
  /** Callback when lightbox is closed */
  onClose: () => void;
}

/**
 * FEAT-067: Full-screen lightbox viewer for viewing full-size images.
 *
 * Features:
 * - Dark backdrop overlay (click to close)
 * - Full-size image with zoom/pan via react-zoom-pan-pinch
 * - Carousel navigation between attachments in same message
 * - Download button for saving images locally
 * - Progress indicator during full-size image download
 * - Close via X button, backdrop click, or Escape key
 */
export function LightboxViewer({
  attachments,
  initialIndex,
  imageUrls,
  downloadProgress,
  onRequestDownload,
  onClose,
}: LightboxViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(
    Math.min(initialIndex, attachments.length - 1),
  );
  const backdropRef = useRef<HTMLDivElement>(null);

  const currentAttachment = attachments[currentIndex];
  const currentUrl = currentAttachment ? imageUrls.get(currentAttachment.id) : undefined;
  const currentProgress = currentAttachment
    ? downloadProgress.get(currentAttachment.id)
    : undefined;
  const isDownloading = currentProgress !== undefined && currentProgress < 100;
  const isImage = currentAttachment?.mimeType.startsWith("image/");
  const hasMultiple = attachments.length > 1;

  // Request download of current image if not already available
  useEffect(() => {
    if (currentAttachment && !currentUrl && onRequestDownload) {
      onRequestDownload(currentAttachment.id);
    }
  }, [currentAttachment, currentUrl, onRequestDownload]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft" && hasMultiple) {
        e.preventDefault();
        setCurrentIndex(prev => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === "ArrowRight" && hasMultiple) {
        e.preventDefault();
        setCurrentIndex(prev =>
          prev < attachments.length - 1 ? prev + 1 : prev,
        );
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, hasMultiple, attachments.length]);

  // Backdrop click handler (close on click outside image)
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) {
        onClose();
      }
    },
    [onClose],
  );

  // Navigation
  const handlePrev = useCallback(() => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : prev));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentIndex(prev =>
      prev < attachments.length - 1 ? prev + 1 : prev,
    );
  }, [attachments.length]);

  // Download handler
  const handleDownload = useCallback(() => {
    if (!currentUrl || !currentAttachment) return;
    const a = document.createElement("a");
    a.href = currentUrl;
    a.download = currentAttachment.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [currentUrl, currentAttachment]);

  // Circular progress SVG for download indicator
  const renderProgress = () => {
    if (!isDownloading) return null;
    const progress = currentProgress ?? 0;
    const circumference = 2 * Math.PI * 20; // radius = 20
    const offset = circumference - (progress / 100) * circumference;

    return (
      <div
        className="flex flex-col items-center justify-center gap-3"
        data-testid="lightbox-progress"
      >
        <svg width="56" height="56" viewBox="0 0 48 48" className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="3"
          />
          {/* Progress circle */}
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            data-testid="lightbox-progress-circle"
          />
        </svg>
        <p className="text-sm text-white/80">{Math.round(progress)}%</p>
      </div>
    );
  };

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleBackdropClick}
      data-testid="lightbox-overlay"
    >
      {/* Top bar: close and download buttons */}
      <div className="absolute top-0 left-0 right-0 flex justify-between items-center p-4 z-10">
        {/* Page indicator */}
        {hasMultiple && (
          <span
            className="text-sm text-white/80 bg-black/40 px-3 py-1 rounded-full"
            data-testid="lightbox-page-indicator"
          >
            {currentIndex + 1} / {attachments.length}
          </span>
        )}
        {!hasMultiple && <div />}

        <div className="flex items-center gap-2">
          {/* Download button - only when image is loaded */}
          {currentUrl && isImage && (
            <button
              onClick={handleDownload}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              aria-label="Download"
              type="button"
              data-testid="lightbox-download"
            >
              <Download size={18} />
            </button>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Close"
            type="button"
            data-testid="lightbox-close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Prev/Next buttons */}
      {hasMultiple && (
        <>
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors disabled:opacity-30"
            aria-label="Previous image"
            type="button"
            data-testid="lightbox-prev"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={handleNext}
            disabled={currentIndex === attachments.length - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors disabled:opacity-30"
            aria-label="Next image"
            type="button"
            data-testid="lightbox-next"
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}

      {/* Main content area */}
      <div className="max-w-[90vw] max-h-[85vh] flex items-center justify-center">
        {isDownloading ? (
          renderProgress()
        ) : currentUrl && isImage ? (
          <TransformWrapper
            key={currentAttachment.id}
            initialScale={1}
            minScale={0.5}
            maxScale={5}
            doubleClick={{ mode: "toggle", step: 2 }}
            wheel={{ step: 0.1 }}
          >
            <TransformComponent
              wrapperStyle={{ width: "100%", height: "100%" }}
              contentStyle={{ display: "flex", justifyContent: "center", alignItems: "center" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- blob URLs from decrypted attachments */}
              <img
                src={currentUrl}
                alt={currentAttachment.fileName}
                className="max-w-[90vw] max-h-[85vh] object-contain select-none"
                draggable={false}
                data-testid="lightbox-image"
              />
            </TransformComponent>
          </TransformWrapper>
        ) : !isImage && currentAttachment ? (
          // Non-image file - show filename only
          <div className="flex flex-col items-center gap-3 text-white" data-testid="lightbox-file-info">
            <p className="text-lg">{currentAttachment.fileName}</p>
            <p className="text-sm text-white/60">
              {(currentAttachment.size / (1024 * 1024)).toFixed(1)} MB
            </p>
            {currentUrl && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                type="button"
                data-testid="lightbox-file-download"
              >
                <Download size={16} />
                <span>Download</span>
              </button>
            )}
          </div>
        ) : (
          // Loading state (no URL, not downloading)
          renderProgress()
        )}
      </div>
    </div>
  );
}
