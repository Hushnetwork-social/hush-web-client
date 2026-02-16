// FEAT-066: Attachment module exports

export type {
  AttachmentRef,
  AttachmentBlob,
  AttachmentUploadData,
  CacheEntry,
  DownloadProgress,
} from './types';

export {
  MAX_ATTACHMENT_SIZE,
  MAX_ATTACHMENTS_PER_MESSAGE,
  ATTACHMENT_CHUNK_SIZE,
  MAX_CACHE_SIZE,
} from './types';

export { computeSha256, verifySha256 } from './attachmentHash';

export {
  AttachmentCache,
  MemoryBackend,
  type IAttachmentCacheBackend,
} from './attachmentCache';

export {
  prepareAttachmentForUpload,
  downloadAttachment,
  fetchAttachmentFromApi,
  validateAttachments,
  getAttachmentCache,
  setAttachmentCache,
  type ProgressCallback,
  type StreamingDownloadFn,
} from './attachmentService';
