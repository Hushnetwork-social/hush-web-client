import { MAX_ATTACHMENT_SIZE, MAX_ATTACHMENTS_PER_MESSAGE } from '@/lib/attachments/types';

export type SocialPostVisibility = 'open' | 'private';
export type SocialPermalinkAccessState = 'allowed' | 'guest_denied' | 'unauthorized_denied' | 'not_found';
export type SocialAttachmentKind = 'image' | 'video';
export type SocialFollowButtonState = 'hidden' | 'follow' | 'pending' | 'following';

export interface SocialAuthorFollowStateContract {
  isFollowing: boolean;
  canFollow: boolean;
}

export function resolveSocialFollowButtonState(
  isAuthenticated: boolean,
  followState: SocialAuthorFollowStateContract | undefined,
  isPending: boolean
): SocialFollowButtonState {
  if (!isAuthenticated) {
    return 'hidden';
  }

  if (isPending) {
    return 'pending';
  }

  if (followState?.isFollowing) {
    return 'following';
  }

  if (followState?.canFollow) {
    return 'follow';
  }

  return 'hidden';
}

export interface FollowSocialAuthorContract {
  viewerPublicAddress: string;
  authorPublicAddress: string;
  authorPublicEncryptAddress?: string;
  requesterPublicAddress: string;
}

export interface FollowSocialAuthorResultContract {
  success: boolean;
  message: string;
  errorCode?: string;
  innerCircleFeedId?: string;
  alreadyFollowing: boolean;
  requiresSyncRefresh: boolean;
}

export interface SocialPostAttachmentContract {
  attachmentId: string;
  mimeType: string;
  size: number;
  fileName: string;
  hash: string;
  kind: SocialAttachmentKind;
}

export interface SocialPostAudienceContract {
  visibility: SocialPostVisibility;
  circleFeedIds: string[];
}

export interface CreateSocialPostContract {
  postId: string;
  authorPublicAddress: string;
  content: string;
  audience: SocialPostAudienceContract;
  attachments: SocialPostAttachmentContract[];
  createdAtUnixMs: number;
}

export interface SocialPostOpenGraphContract {
  title: string;
  description: string;
  imageUrl?: string;
  isGenericPrivate: boolean;
  cacheControl: string;
}

export interface SocialPermalinkViewContract {
  postId: string;
  accessState: SocialPermalinkAccessState;
  isAuthenticated: boolean;
  canInteract: boolean;
  authorPublicAddress?: string;
  followState?: SocialAuthorFollowStateContract;
  content?: string;
  createdAtBlock?: number;
  circleFeedIds: string[];
  openGraph: SocialPostOpenGraphContract;
}

export enum SocialPostContractErrorCode {
  NONE = 'NONE',
  PRIVATE_AUDIENCE_REQUIRES_CIRCLE = 'PRIVATE_AUDIENCE_REQUIRES_CIRCLE',
  DUPLICATE_CIRCLE_TARGETS = 'DUPLICATE_CIRCLE_TARGETS',
  ATTACHMENT_COUNT_EXCEEDED = 'ATTACHMENT_COUNT_EXCEEDED',
  ATTACHMENT_SIZE_EXCEEDED = 'ATTACHMENT_SIZE_EXCEEDED',
  ATTACHMENT_MIME_NOT_ALLOWED = 'ATTACHMENT_MIME_NOT_ALLOWED',
}

export interface SocialPostContractValidationResult {
  isValid: boolean;
  errorCode: SocialPostContractErrorCode;
  message: string;
}

const ALLOWED_SOCIAL_MIME_PREFIXES = ['image/', 'video/'];

export function validateSocialPostAudience(
  audience: SocialPostAudienceContract
): SocialPostContractValidationResult {
  if (audience.visibility !== 'private') {
    return { isValid: true, errorCode: SocialPostContractErrorCode.NONE, message: '' };
  }

  if (audience.circleFeedIds.length === 0) {
    return {
      isValid: false,
      errorCode: SocialPostContractErrorCode.PRIVATE_AUDIENCE_REQUIRES_CIRCLE,
      message: 'Private post requires at least one selected circle.',
    };
  }

  const normalized = audience.circleFeedIds
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
  if (new Set(normalized).size !== normalized.length) {
    return {
      isValid: false,
      errorCode: SocialPostContractErrorCode.DUPLICATE_CIRCLE_TARGETS,
      message: 'Duplicate circle targets are not allowed.',
    };
  }

  return { isValid: true, errorCode: SocialPostContractErrorCode.NONE, message: '' };
}

export function validateSocialPostAttachments(
  attachments: SocialPostAttachmentContract[]
): SocialPostContractValidationResult {
  if (attachments.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    return {
      isValid: false,
      errorCode: SocialPostContractErrorCode.ATTACHMENT_COUNT_EXCEEDED,
      message: `Too many attachments: ${attachments.length} exceeds the maximum of ${MAX_ATTACHMENTS_PER_MESSAGE}.`,
    };
  }

  for (const attachment of attachments) {
    if (attachment.size > MAX_ATTACHMENT_SIZE) {
      return {
        isValid: false,
        errorCode: SocialPostContractErrorCode.ATTACHMENT_SIZE_EXCEEDED,
        message: `Attachment ${attachment.attachmentId} exceeds the maximum size of ${MAX_ATTACHMENT_SIZE} bytes.`,
      };
    }

    const normalizedMimeType = attachment.mimeType.trim().toLowerCase();
    const isAllowed = ALLOWED_SOCIAL_MIME_PREFIXES.some((prefix) => normalizedMimeType.startsWith(prefix));
    if (!isAllowed) {
      return {
        isValid: false,
        errorCode: SocialPostContractErrorCode.ATTACHMENT_MIME_NOT_ALLOWED,
        message: `Attachment mime type '${attachment.mimeType}' is not allowed for social posts.`,
      };
    }
  }

  return { isValid: true, errorCode: SocialPostContractErrorCode.NONE, message: '' };
}
