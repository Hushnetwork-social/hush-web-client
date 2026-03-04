import {
  SocialPostContractErrorCode,
  validateSocialPostAttachments,
  validateSocialPostAudience,
} from './contracts';

describe('Social post contracts', () => {
  it('should reject private audience with no circles', () => {
    const result = validateSocialPostAudience({
      visibility: 'private',
      circleFeedIds: [],
    });

    expect(result.isValid).toBe(false);
    expect(result.errorCode).toBe(SocialPostContractErrorCode.PRIVATE_AUDIENCE_REQUIRES_CIRCLE);
  });

  it('should reject duplicate circle targets', () => {
    const result = validateSocialPostAudience({
      visibility: 'private',
      circleFeedIds: ['Circle-1', 'circle-1'],
    });

    expect(result.isValid).toBe(false);
    expect(result.errorCode).toBe(SocialPostContractErrorCode.DUPLICATE_CIRCLE_TARGETS);
  });

  it('should reject unsupported attachment mime types', () => {
    const result = validateSocialPostAttachments([
      {
        attachmentId: 'att-1',
        mimeType: 'application/pdf',
        size: 1024,
        fileName: 'doc.pdf',
        hash: 'a'.repeat(64),
        kind: 'image',
      },
    ]);

    expect(result.isValid).toBe(false);
    expect(result.errorCode).toBe(SocialPostContractErrorCode.ATTACHMENT_MIME_NOT_ALLOWED);
  });

  it('should accept image/video attachments within limits', () => {
    const result = validateSocialPostAttachments([
      {
        attachmentId: 'att-image',
        mimeType: 'image/jpeg',
        size: 1024,
        fileName: 'photo.jpg',
        hash: 'a'.repeat(64),
        kind: 'image',
      },
      {
        attachmentId: 'att-video',
        mimeType: 'video/mp4',
        size: 2048,
        fileName: 'clip.mp4',
        hash: 'b'.repeat(64),
        kind: 'video',
      },
    ]);

    expect(result.isValid).toBe(true);
    expect(result.errorCode).toBe(SocialPostContractErrorCode.NONE);
  });
});
