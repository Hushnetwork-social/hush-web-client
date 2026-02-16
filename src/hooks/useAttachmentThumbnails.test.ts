import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAttachmentThumbnails } from './useAttachmentThumbnails';
import type { FeedMessage } from '@/types';

// Mock the attachment service
vi.mock('@/lib/attachments/attachmentService', () => ({
  downloadAttachment: vi.fn(),
  getAttachmentCache: vi.fn(() => ({
    get: vi.fn(() => null),
    set: vi.fn(),
  })),
}));

import { downloadAttachment } from '@/lib/attachments/attachmentService';

function createMessage(id: string, attachments?: { id: string; mimeType: string }[]): FeedMessage {
  return {
    id,
    feedId: 'feed-1',
    senderPublicKey: 'sender-key',
    content: 'hello',
    timestamp: Date.now(),
    isConfirmed: true,
    attachments: attachments?.map(a => ({
      id: a.id,
      hash: 'hash-' + a.id,
      mimeType: a.mimeType,
      size: 1024,
      fileName: 'file-' + a.id,
    })),
  };
}

describe('useAttachmentThumbnails', () => {
  const mockDownloadFn = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock URL.createObjectURL and revokeObjectURL
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return empty map initially', () => {
    const { result } = renderHook(() =>
      useAttachmentThumbnails([], 'feed-1', 'user-addr', 'aes-key', mockDownloadFn)
    );

    expect(result.current.size).toBe(0);
  });

  it('should trigger download for messages with image attachments', async () => {
    vi.mocked(downloadAttachment).mockResolvedValue(new Uint8Array([1, 2, 3]));

    const messages = [
      createMessage('msg-1', [{ id: 'att-1', mimeType: 'image/jpeg' }]),
    ];

    renderHook(() =>
      useAttachmentThumbnails(messages, 'feed-1', 'user-addr', 'aes-key', mockDownloadFn)
    );

    // Wait for the download to complete
    await vi.waitFor(() => {
      expect(downloadAttachment).toHaveBeenCalledWith(
        'att-1',
        'feed-1',
        'user-addr',
        'aes-key',
        mockDownloadFn,
        true, // thumbnailOnly
      );
    });
  });

  it('should NOT trigger download for non-image attachments', async () => {
    const messages = [
      createMessage('msg-1', [{ id: 'att-1', mimeType: 'application/pdf' }]),
    ];

    renderHook(() =>
      useAttachmentThumbnails(messages, 'feed-1', 'user-addr', 'aes-key', mockDownloadFn)
    );

    // Give it a tick
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(downloadAttachment).not.toHaveBeenCalled();
  });

  it('should NOT trigger download when credentials are missing', async () => {
    const messages = [
      createMessage('msg-1', [{ id: 'att-1', mimeType: 'image/jpeg' }]),
    ];

    renderHook(() =>
      useAttachmentThumbnails(messages, 'feed-1', undefined, 'aes-key', mockDownloadFn)
    );

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(downloadAttachment).not.toHaveBeenCalled();
  });

  it('should NOT trigger download when AES key is missing', async () => {
    const messages = [
      createMessage('msg-1', [{ id: 'att-1', mimeType: 'image/jpeg' }]),
    ];

    renderHook(() =>
      useAttachmentThumbnails(messages, 'feed-1', 'user-addr', undefined, mockDownloadFn)
    );

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(downloadAttachment).not.toHaveBeenCalled();
  });

  it('should skip messages without attachments', async () => {
    const messages = [
      createMessage('msg-1'), // no attachments
    ];

    renderHook(() =>
      useAttachmentThumbnails(messages, 'feed-1', 'user-addr', 'aes-key', mockDownloadFn)
    );

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(downloadAttachment).not.toHaveBeenCalled();
  });

  it('should handle download failure gracefully', async () => {
    vi.mocked(downloadAttachment).mockRejectedValue(new Error('Network error'));

    const messages = [
      createMessage('msg-1', [{ id: 'att-1', mimeType: 'image/jpeg' }]),
    ];

    // Should not throw
    const { result } = renderHook(() =>
      useAttachmentThumbnails(messages, 'feed-1', 'user-addr', 'aes-key', mockDownloadFn)
    );

    await vi.waitFor(() => {
      expect(downloadAttachment).toHaveBeenCalled();
    });

    // No URL should be set for failed download
    expect(result.current.get('att-1')).toBeUndefined();
  });
});
