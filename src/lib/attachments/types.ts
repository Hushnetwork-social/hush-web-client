/**
 * FEAT-066: Attachment types for off-chain storage infrastructure.
 *
 * Only lightweight metadata (UUID, SHA-256, MIME, size) goes on-chain.
 * Encrypted binaries are stored off-chain in PostgreSQL.
 */

/** On-chain attachment metadata stored in the transaction payload. */
export interface AttachmentRef {
  /** Unique attachment identifier (UUID v4) */
  id: string;
  /** SHA-256 hex hash of the original plaintext file (64 chars) */
  hash: string;
  /** MIME type (e.g. 'image/jpeg', 'application/pdf') */
  mimeType: string;
  /** Original file size in bytes (before encryption) */
  size: number;
  /** Original file name */
  fileName: string;
}

/** Encrypted attachment blob for upload alongside the transaction. */
export interface AttachmentBlob {
  /** Must match the corresponding AttachmentRef.id */
  attachmentId: string;
  /** AES-256-GCM encrypted original file bytes */
  encryptedOriginal: Uint8Array;
  /** AES-256-GCM encrypted thumbnail bytes (images only, null for non-image) */
  encryptedThumbnail: Uint8Array | null;
}

/** Combined upload data returned by prepareAttachmentForUpload. */
export interface AttachmentUploadData {
  /** On-chain metadata reference */
  ref: AttachmentRef;
  /** Encrypted binary blob for off-chain storage */
  blob: AttachmentBlob;
}

/** Cache entry metadata for LRU tracking (stored in localStorage). */
export interface CacheEntry {
  /** Attachment UUID */
  attachmentId: string;
  /** Unix timestamp of last access */
  lastAccessed: number;
  /** Size of cached encrypted bytes */
  size: number;
  /** Whether a thumbnail variant is also cached */
  hasThumbnail: boolean;
}

/** Download progress state for UI feedback. */
export interface DownloadProgress {
  /** Attachment UUID being downloaded */
  attachmentId: string;
  /** Number of chunks received so far */
  chunksReceived: number;
  /** Total number of chunks expected (from first chunk header) */
  totalChunks: number;
  /** Total size in bytes (from first chunk header) */
  totalSize: number;
  /** Current download status */
  status: 'pending' | 'downloading' | 'complete' | 'error';
}

/** Maximum attachment size in bytes (25MB). */
export const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;

/** Maximum number of attachments per message. */
export const MAX_ATTACHMENTS_PER_MESSAGE = 5;

/** Chunk size for streaming downloads (~64KB). */
export const ATTACHMENT_CHUNK_SIZE = 65536;

/** Maximum cache size in bytes (100MB). */
export const MAX_CACHE_SIZE = 100 * 1024 * 1024;
