"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { X, Plus, Paperclip, Smile, Send, Play, Shuffle } from "lucide-react";
import { ContentCarousel } from "./ContentCarousel";
import { EmojiPicker } from "./EmojiPicker";
import { MAX_ATTACHMENTS_PER_MESSAGE } from "@/lib/attachments/types";
import { getFileTypeIcon, formatFileSize } from "@/lib/attachments/fileTypeIcons";
import type { VideoFrame } from "@/lib/attachments/videoFrameExtractor";

/** File with an object URL for previewing. */
export interface ComposerFile {
  file: File;
  /** Object URL for preview (created via URL.createObjectURL) */
  previewUrl: string;
}

interface ComposerOverlayProps {
  /** Initial files to preview */
  initialFiles: ComposerFile[];
  /** Initial text to pre-populate in the message input */
  initialText: string;
  /** Callback when send is triggered (files + text) */
  onSend: (files: File[], text: string) => void;
  /** Callback when overlay is closed/cancelled (returns current text) */
  onClose: (currentText: string) => void;
  /** Callback to add more files from file picker */
  onAddMore: () => void;
  /** Callback when images are pasted from clipboard */
  onImagePaste?: (files: File[]) => void;
  /** Participants for @mentions (passed through to MessageInput) */
  participants?: Array<{ identityId: string; displayName: string; publicAddress: string }>;
}

/**
 * FEAT-067/068: Full-screen composer overlay for previewing and sending attachments.
 *
 * WhatsApp-style overlay with:
 * - Dark backdrop with fade + scale animation
 * - Centered image/file preview with carousel navigation
 * - Video preview with static frame, play icon, and shuffle button (FEAT-068)
 * - Document preview with category icon, filename, and size (FEAT-068)
 * - PDF preview with first-page thumbnail (FEAT-068)
 * - "+" button to add more files (count X/5)
 * - "X" to remove individual attachments
 * - Close button (top-right) cancels flow
 * - Text input at bottom for caption/message
 * - Escape closes, Enter sends
 */
export function ComposerOverlay({
  initialFiles,
  initialText,
  onSend,
  onClose,
  onAddMore,
  onImagePaste,
}: ComposerOverlayProps) {
  const [files, setFiles] = useState<ComposerFile[]>(initialFiles);
  const [text, setText] = useState(initialText);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [carouselGoTo, setCarouselGoTo] = useState<number | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  // FEAT-068: Video frame extraction state
  const [videoFrames, setVideoFrames] = useState<Map<string, VideoFrame[]>>(new Map());
  const [currentFrameIndex, setCurrentFrameIndex] = useState<Map<string, number>>(new Map());
  const [frameLoading, setFrameLoading] = useState<Set<string>>(new Set());

  // FEAT-068: PDF thumbnail state
  const [pdfThumbnails, setPdfThumbnails] = useState<Map<string, string>>(new Map());
  const [pdfLoading, setPdfLoading] = useState<Set<string>>(new Set());

  // Update files when initialFiles changes (e.g., more files added externally)
  // Jump to last item when new files are added
  useEffect(() => {
    const hadFiles = files.length;
    setFiles(initialFiles);
    if (initialFiles.length > hadFiles) {
      setCarouselGoTo(initialFiles.length - 1);
    }
  }, [initialFiles]); // eslint-disable-line react-hooks/exhaustive-deps -- intentionally reading files.length without depending on it

  // FEAT-068: Extract video frames when video files are added
  useEffect(() => {
    for (const cf of files) {
      const key = cf.previewUrl;
      if (!cf.file.type.startsWith("video/")) continue;
      if (videoFrames.has(key) || frameLoading.has(key)) continue;

      setFrameLoading(prev => new Set(prev).add(key));

      (async () => {
        try {
          const { extractVideoFrames } = await import("@/lib/attachments/videoFrameExtractor");
          const frames = await extractVideoFrames(cf.file);
          setVideoFrames(prev => new Map(prev).set(key, frames));
          setCurrentFrameIndex(prev => new Map(prev).set(key, 0));
        } catch {
          setVideoFrames(prev => new Map(prev).set(key, []));
        } finally {
          setFrameLoading(prev => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }
      })();
    }
  }, [files]); // eslint-disable-line react-hooks/exhaustive-deps -- videoFrames/frameLoading are checked inside

  // FEAT-068: Generate PDF thumbnails when PDF files are added
  useEffect(() => {
    for (const cf of files) {
      const key = cf.previewUrl;
      if (cf.file.type !== "application/pdf") continue;
      if (pdfThumbnails.has(key) || pdfLoading.has(key)) continue;

      setPdfLoading(prev => new Set(prev).add(key));

      (async () => {
        try {
          const { generatePdfThumbnail } = await import("@/lib/attachments/pdfThumbnailGenerator");
          const result = await generatePdfThumbnail(cf.file);
          if (result) {
            const url = URL.createObjectURL(result.blob);
            setPdfThumbnails(prev => new Map(prev).set(key, url));
          } else {
            setPdfThumbnails(prev => new Map(prev).set(key, ""));
          }
        } catch {
          setPdfThumbnails(prev => new Map(prev).set(key, ""));
        } finally {
          setPdfLoading(prev => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }
      })();
    }
  }, [files]); // eslint-disable-line react-hooks/exhaustive-deps -- pdfThumbnails/pdfLoading are checked inside

  // Cleanup PDF thumbnail URLs on unmount
  useEffect(() => {
    return () => {
      for (const url of pdfThumbnails.values()) {
        if (url) URL.revokeObjectURL(url);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- cleanup only on unmount

  // Focus text input when overlay opens
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  // Keyboard handler: Escape closes, Enter sends
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose(text);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, text]);

  const handleRemove = useCallback((index: number) => {
    setFiles(prev => {
      const next = prev.filter((_, i) => i !== index);
      // Revoke the removed file's URL
      URL.revokeObjectURL(prev[index].previewUrl);
      if (next.length === 0) {
        // Last attachment removed - close overlay
        onClose(text);
        return prev; // Return original since onClose will unmount
      }
      return next;
    });
  }, [onClose, text]);

  const handleSend = useCallback(() => {
    if (files.length > 0) {
      onSend(files.map(f => f.file), text.trim());
    }
  }, [files, text, onSend]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  const isAtMax = files.length >= MAX_ATTACHMENTS_PER_MESSAGE;

  // Handle paste events to detect image clipboard data
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (!onImagePaste) return;
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      onImagePaste(imageFiles);
    }
  }, [onImagePaste]);

  const handleEmojiSelect = useCallback((emoji: string) => {
    setText(prev => prev + emoji);
    inputRef.current?.focus();
  }, []);

  // FEAT-068: Shuffle video frame to next
  const handleShuffle = useCallback((key: string) => {
    const frames = videoFrames.get(key);
    if (!frames || frames.length === 0) return;
    setCurrentFrameIndex(prev => {
      const next = new Map(prev);
      const current = next.get(key) ?? 0;
      next.set(key, (current + 1) % frames.length);
      return next;
    });
  }, [videoFrames]);

  // Build preview items for ContentCarousel
  const previewItems = files.map((cf, index) => {
    const isImage = cf.file.type.startsWith("image/");
    const isVideo = cf.file.type.startsWith("video/");
    const isPdf = cf.file.type === "application/pdf";
    const key = cf.previewUrl;

    return (
      <div key={key} className="relative" data-testid="composer-preview-item">
        {/* Remove button */}
        <button
          onClick={(e) => { e.stopPropagation(); handleRemove(index); }}
          className="absolute top-2 right-2 z-10 w-6 h-6 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
          aria-label="Remove attachment"
          type="button"
          data-testid="remove-attachment"
        >
          <X size={14} />
        </button>

        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob URLs from file previews
          <img
            src={cf.previewUrl}
            alt={cf.file.name}
            className="max-h-[50vh] max-w-full mx-auto rounded-lg object-contain"
            data-testid="composer-preview-image"
          />
        ) : isVideo ? (
          <VideoPreview
            fileName={cf.file.name}
            frames={videoFrames.get(key)}
            currentIndex={currentFrameIndex.get(key) ?? 0}
            isLoading={frameLoading.has(key)}
            onShuffle={() => handleShuffle(key)}
          />
        ) : isPdf ? (
          <PdfPreview
            fileName={cf.file.name}
            fileSize={cf.file.size}
            thumbnailUrl={pdfThumbnails.get(key)}
            isLoading={pdfLoading.has(key)}
          />
        ) : (
          <DocumentPreview fileName={cf.file.name} fileSize={cf.file.size} />
        )}
      </div>
    );
  });

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      data-testid="composer-overlay"
    >
      {/* Top bar: close button */}
      <div className="flex justify-end p-4">
        <button
          onClick={() => onClose(text)}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Close"
          type="button"
          data-testid="composer-close"
        >
          <X size={18} />
        </button>
      </div>

      {/* Centered content: preview + add more + input */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 min-h-0">
        {/* Image preview */}
        <div className="w-full max-w-lg">
          {previewItems.length === 1 ? (
            previewItems[0]
          ) : (
            <ContentCarousel ariaLabel="Attachment previews" goToIndex={carouselGoTo}>
              {previewItems}
            </ContentCarousel>
          )}
        </div>

        {/* Add more button + count */}
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={onAddMore}
            disabled={isAtMax}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
              isAtMax
                ? "bg-white/5 text-hush-text-accent cursor-not-allowed opacity-50"
                : "bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            }`}
            aria-label="Add more files"
            type="button"
            data-testid="add-more-button"
          >
            <Plus size={16} />
            <span data-testid="attachment-count">{files.length}/{MAX_ATTACHMENTS_PER_MESSAGE}</span>
          </button>
        </div>

        {/* Caption input - styled like MessageInput */}
        <div className="w-full max-w-lg mt-6">
          <form
            onSubmit={handleSubmit}
            className="relative flex items-center bg-hush-bg-dark rounded-xl p-2"
          >
            {/* Emoji Picker Flyout */}
            <EmojiPicker
              isOpen={isEmojiPickerOpen}
              onEmojiSelect={handleEmojiSelect}
              onClose={() => setIsEmojiPickerOpen(false)}
            />

            {/* Add more button (paperclip) */}
            <button
              type="button"
              onClick={onAddMore}
              disabled={isAtMax}
              className="p-2 text-hush-purple hover:text-hush-purple-hover transition-colors disabled:opacity-50"
              aria-label="Add more files"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* Emoji button */}
            <button
              type="button"
              onClick={() => setIsEmojiPickerOpen(prev => !prev)}
              className={`p-2 transition-colors ${
                isEmojiPickerOpen
                  ? "text-hush-purple-hover"
                  : "text-hush-purple hover:text-hush-purple-hover"
              }`}
            >
              <Smile className="w-5 h-5" />
            </button>

            {/* Text input */}
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onPaste={handlePaste}
              placeholder="Add a caption..."
              className="flex-1 bg-transparent border-none outline-none text-hush-text-primary placeholder-hush-text-accent text-sm px-2"
              data-testid="composer-text-input"
            />

            {/* Send button - circular icon, matches MessageInput */}
            <button
              type="submit"
              disabled={files.length === 0}
              className="p-2 rounded-full bg-hush-purple hover:bg-hush-purple-hover transition-all disabled:opacity-50"
              data-testid="composer-send"
            >
              <Send className="w-4 h-4 text-hush-bg-dark" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ---- FEAT-068: Sub-components for video and document previews ----

/** Video preview: static frame with play icon overlay and shuffle button. */
function VideoPreview({
  fileName,
  frames,
  currentIndex,
  isLoading,
  onShuffle,
}: {
  fileName: string;
  frames: VideoFrame[] | undefined;
  currentIndex: number;
  isLoading: boolean;
  onShuffle: () => void;
}) {
  const hasFrames = frames && frames.length > 0;
  const currentFrame = hasFrames ? frames[currentIndex] : null;

  // Create blob URL only when frame changes, revoke previous on change/unmount
  const frameUrl = useMemo(() => {
    return currentFrame ? URL.createObjectURL(currentFrame.blob) : null;
  }, [currentFrame]);

  useEffect(() => {
    return () => {
      if (frameUrl) URL.revokeObjectURL(frameUrl);
    };
  }, [frameUrl]);

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center bg-white/5 rounded-lg"
        style={{ height: "30vh" }}
        data-testid="composer-video-skeleton"
      >
        <div className="w-full h-full animate-pulse bg-white/10 rounded-lg" />
      </div>
    );
  }

  if (!hasFrames) {
    // Extraction failed - show generic video icon
    const iconInfo = getFileTypeIcon(fileName);
    const IconComponent = iconInfo.icon;
    return (
      <div className="flex flex-col items-center gap-2 p-8 bg-white/5 rounded-lg" data-testid="composer-preview-file">
        <IconComponent className={`w-16 h-16 ${iconInfo.colorClass}`} />
        <p className="text-sm text-hush-text-primary truncate max-w-[200px]">{fileName}</p>
      </div>
    );
  }

  return (
    <div className="relative" data-testid="composer-video-preview">
      {/* Static frame thumbnail */}
      {/* eslint-disable-next-line @next/next/no-img-element -- blob URL from extracted frame */}
      <img
        src={frameUrl!}
        alt={`Video frame ${currentIndex + 1} of ${fileName}`}
        className="max-h-[50vh] max-w-full mx-auto rounded-lg object-contain"
        data-testid="composer-video-frame"
      />

      {/* Play icon overlay (centered) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-14 h-14 rounded-full bg-black/50 flex items-center justify-center" data-testid="video-play-overlay">
          <Play className="w-7 h-7 text-white fill-white ml-1" />
        </div>
      </div>

      {/* Shuffle button (bottom-right) */}
      {frames.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onShuffle(); }}
          className="absolute bottom-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
          aria-label="Next frame"
          type="button"
          data-testid="video-shuffle-button"
        >
          <Shuffle size={14} />
        </button>
      )}
    </div>
  );
}

/** PDF preview: first-page thumbnail or fallback icon. */
function PdfPreview({
  fileName,
  fileSize,
  thumbnailUrl,
  isLoading,
}: {
  fileName: string;
  fileSize: number;
  thumbnailUrl: string | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center bg-white/5 rounded-lg"
        style={{ height: "30vh" }}
        data-testid="composer-pdf-skeleton"
      >
        <div className="w-full h-full animate-pulse bg-white/10 rounded-lg" />
      </div>
    );
  }

  // thumbnailUrl is "" when generation failed, undefined when not attempted yet
  if (thumbnailUrl) {
    return (
      <div data-testid="composer-pdf-thumbnail">
        {/* eslint-disable-next-line @next/next/no-img-element -- blob URL from PDF render */}
        <img
          src={thumbnailUrl}
          alt={`First page of ${fileName}`}
          className="max-h-[50vh] max-w-full mx-auto rounded-lg object-contain"
          data-testid="composer-preview-image"
        />
      </div>
    );
  }

  // Fallback: PDF icon with name and size
  return <DocumentPreview fileName={fileName} fileSize={fileSize} />;
}

/** Document preview: centered category icon with filename and size. */
function DocumentPreview({
  fileName,
  fileSize,
}: {
  fileName: string;
  fileSize: number;
}) {
  const iconInfo = getFileTypeIcon(fileName);
  const IconComponent = iconInfo.icon;

  return (
    <div className="flex flex-col items-center gap-2 p-8 bg-white/5 rounded-lg" data-testid="composer-preview-file">
      <IconComponent className={`w-16 h-16 ${iconInfo.colorClass}`} />
      <p className="text-sm text-hush-text-primary truncate max-w-[200px]">{fileName}</p>
      <p className="text-xs text-hush-text-accent">{formatFileSize(fileSize)}</p>
    </div>
  );
}
