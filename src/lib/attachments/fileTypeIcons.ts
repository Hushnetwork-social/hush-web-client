/**
 * FEAT-068: File type icon mapping.
 *
 * Maps file extensions to lucide-react icon components and colors
 * for display in DocumentCard, ComposerOverlay, and LightboxViewer.
 */

import type { LucideIcon } from 'lucide-react';
import {
  FileText,
  FileSpreadsheet,
  FileCode,
  Archive,
  Video,
  File,
} from 'lucide-react';

/** Icon mapping result. */
export interface FileTypeIconInfo {
  /** The lucide-react icon component. */
  icon: LucideIcon;
  /** Tailwind color class for the icon. */
  colorClass: string;
  /** Human-readable file type label (e.g., "PDF Document"). */
  label: string;
}

/** Extension-to-icon mapping entry. */
interface IconEntry {
  icon: LucideIcon;
  colorClass: string;
  label: string;
}

/** Extension → icon + color + label mapping. */
const ICON_MAP: Record<string, IconEntry> = {
  // PDF
  pdf: { icon: FileText, colorClass: 'text-red-400', label: 'PDF Document' },
  // Word
  doc: { icon: FileText, colorClass: 'text-blue-400', label: 'Word Document' },
  docx: { icon: FileText, colorClass: 'text-blue-400', label: 'Word Document' },
  // Excel
  xls: { icon: FileSpreadsheet, colorClass: 'text-green-400', label: 'Spreadsheet' },
  xlsx: { icon: FileSpreadsheet, colorClass: 'text-green-400', label: 'Spreadsheet' },
  // PowerPoint
  ppt: { icon: FileText, colorClass: 'text-orange-400', label: 'Presentation' },
  pptx: { icon: FileText, colorClass: 'text-orange-400', label: 'Presentation' },
  // Text
  txt: { icon: FileText, colorClass: 'text-gray-400', label: 'Text File' },
  // Archives
  zip: { icon: Archive, colorClass: 'text-yellow-400', label: 'ZIP Archive' },
  rar: { icon: Archive, colorClass: 'text-yellow-400', label: 'RAR Archive' },
  '7z': { icon: Archive, colorClass: 'text-yellow-400', label: '7Z Archive' },
  // Code
  js: { icon: FileCode, colorClass: 'text-gray-400', label: 'JavaScript' },
  ts: { icon: FileCode, colorClass: 'text-gray-400', label: 'TypeScript' },
  py: { icon: FileCode, colorClass: 'text-gray-400', label: 'Python' },
  json: { icon: FileCode, colorClass: 'text-gray-400', label: 'JSON' },
  xml: { icon: FileCode, colorClass: 'text-gray-400', label: 'XML' },
  html: { icon: FileCode, colorClass: 'text-gray-400', label: 'HTML' },
  css: { icon: FileCode, colorClass: 'text-gray-400', label: 'CSS' },
  // Video
  mp4: { icon: Video, colorClass: 'text-purple-400', label: 'MP4 Video' },
  mov: { icon: Video, colorClass: 'text-purple-400', label: 'MOV Video' },
  webm: { icon: Video, colorClass: 'text-purple-400', label: 'WebM Video' },
  avi: { icon: Video, colorClass: 'text-purple-400', label: 'AVI Video' },
};

/** Default icon for unknown extensions. */
const DEFAULT_ICON: IconEntry = {
  icon: File,
  colorClass: 'text-gray-500',
  label: 'File',
};

/**
 * Get the icon, color, and label for a file based on its name.
 * Unknown extensions return a generic File icon.
 */
export function getFileTypeIcon(fileName: string): FileTypeIconInfo {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot < 0 || lastDot === fileName.length - 1) return DEFAULT_ICON;
  const ext = fileName.slice(lastDot + 1).toLowerCase();
  return ICON_MAP[ext] ?? DEFAULT_ICON;
}

/**
 * Format a byte count into a human-readable size string.
 * Examples: "0 B", "450 KB", "2.3 MB", "1.1 GB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
