"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { X, Plus, FileIcon, Paperclip, Smile, Send } from "lucide-react";
import { ContentCarousel } from "./ContentCarousel";
import { EmojiPicker } from "./EmojiPicker";
import { MAX_ATTACHMENTS_PER_MESSAGE } from "@/lib/attachments/types";

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
 * FEAT-067: Full-screen composer overlay for previewing and sending attachments.
 *
 * WhatsApp-style overlay with:
 * - Dark backdrop with fade + scale animation
 * - Centered image/file preview with carousel navigation
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

  // Update files when initialFiles changes (e.g., more files added externally)
  // Jump to last item when new files are added
  useEffect(() => {
    const hadFiles = files.length;
    setFiles(initialFiles);
    if (initialFiles.length > hadFiles) {
      setCarouselGoTo(initialFiles.length - 1);
    }
  }, [initialFiles]); // eslint-disable-line react-hooks/exhaustive-deps -- intentionally reading files.length without depending on it

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

  // Build preview items for ContentCarousel
  const previewItems = files.map((cf, index) => {
    const isImage = cf.file.type.startsWith("image/");

    return (
      <div key={cf.previewUrl} className="relative" data-testid="composer-preview-item">
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
        ) : (
          <div className="flex flex-col items-center gap-2 p-8 bg-white/5 rounded-lg" data-testid="composer-preview-file">
            <FileIcon className="w-16 h-16 text-hush-text-accent" />
            <p className="text-sm text-hush-text-primary truncate max-w-[200px]">{cf.file.name}</p>
            <p className="text-xs text-hush-text-accent">
              {(cf.file.size / (1024 * 1024)).toFixed(1)} MB
            </p>
          </div>
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
