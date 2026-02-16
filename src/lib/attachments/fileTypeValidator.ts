/**
 * FEAT-068: Centralized file type validation.
 *
 * Extension-only validation (no MIME type checking). Blocked executable
 * file types are rejected with user-friendly messages. Unknown extensions
 * are accepted as "generic" — the server validates content separately.
 */

/** File type categories. */
export type FileCategory = 'image' | 'video' | 'document' | 'archive' | 'code' | 'generic';

/** Image extensions (from FEAT-067). */
const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'svg', 'bmp', 'ico', 'tiff',
]);

/** Video extensions. */
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm', 'avi']);

/** Document extensions. */
const DOCUMENT_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt']);

/** Archive extensions. */
const ARCHIVE_EXTENSIONS = new Set(['zip', 'rar', '7z']);

/** Code file extensions. */
const CODE_EXTENSIONS = new Set(['js', 'ts', 'py', 'json', 'xml', 'html', 'css']);

/** Blocked executable extensions. */
const BLOCKED_EXTENSIONS = new Set(['exe', 'bat', 'sh', 'msi', 'cmd', 'ps1', 'vbs', 'wsf']);

/** Known document MIME types (for isDocumentType). */
const DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/zip',
  'application/vnd.rar',
  'application/x-7z-compressed',
  'text/javascript',
  'text/typescript',
  'text/x-python',
  'application/json',
  'text/xml',
  'text/html',
  'text/css',
]);

/**
 * Extract file extension from a filename (lowercase, without dot).
 * Returns empty string if no extension found.
 */
function getExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot < 0 || lastDot === fileName.length - 1) return '';
  return fileName.slice(lastDot + 1).toLowerCase();
}

/** Check if a file has a blocked (dangerous) extension. */
export function isBlockedFileType(fileName: string): boolean {
  return BLOCKED_EXTENSIONS.has(getExtension(fileName));
}

/** Categorize a file by its extension. */
export function getFileCategory(fileName: string): FileCategory {
  const ext = getExtension(fileName);
  if (!ext) return 'generic';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  if (DOCUMENT_EXTENSIONS.has(ext)) return 'document';
  if (ARCHIVE_EXTENSIONS.has(ext)) return 'archive';
  if (CODE_EXTENSIONS.has(ext)) return 'code';
  return 'generic';
}

/** Check if a MIME type is a video type. */
export function isVideoType(mimeType: string): boolean {
  return mimeType.startsWith('video/');
}

/** Check if a MIME type is a known document/archive/code type. */
export function isDocumentType(mimeType: string): boolean {
  return DOCUMENT_MIME_TYPES.has(mimeType);
}

/** Check if a MIME type is PDF. */
export function isPdfType(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

/** Get a user-friendly rejection message for a blocked file. */
export function getBlockedFileMessage(fileName: string): string {
  const ext = getExtension(fileName);
  return `Executable files (.${ext}) are not allowed for security reasons`;
}

/**
 * Accept filter string for the file picker <input>.
 * Includes images, videos, and all supported document MIME types.
 */
export const FILE_PICKER_ACCEPT_ALL = [
  'image/*',
  'video/*',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/zip',
  'application/vnd.rar',
  'application/x-7z-compressed',
  'text/javascript',
  'application/json',
  'text/xml',
  'text/html',
  'text/css',
  '.ts', '.py', '.7z', '.rar',
].join(',');
