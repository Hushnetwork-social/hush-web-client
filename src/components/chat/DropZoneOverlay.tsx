"use client";

import { memo } from "react";
import { ImageIcon } from "lucide-react";

interface DropZoneOverlayProps {
  /** Whether the drop zone overlay is visible */
  visible: boolean;
  /** Callback when files are dropped */
  onDrop: (files: File[]) => void;
}

/**
 * FEAT-067: Drop zone overlay for drag-and-drop file ingestion.
 *
 * Shows a semi-transparent overlay with a dashed border and hint text
 * when the user drags files over the chat area.
 */
export const DropZoneOverlay = memo(function DropZoneOverlay({
  visible,
  onDrop,
}: DropZoneOverlayProps) {
  if (!visible) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onDrop(files);
    }
  };

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      role="region"
      aria-label="Drop files here to attach"
      data-testid="drop-zone-overlay"
    >
      <div className="flex flex-col items-center gap-3 p-8 border-2 border-dashed border-hush-purple rounded-2xl">
        <ImageIcon className="w-12 h-12 text-hush-purple" />
        <p className="text-lg font-medium text-hush-text-primary">Drop files here</p>
        <p className="text-sm text-hush-text-accent">Images, documents, or videos</p>
      </div>
    </div>
  );
});
