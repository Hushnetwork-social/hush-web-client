import { describe, expect, it } from 'vitest';
import {
  resolveGuestIntentResumeAction,
  shouldAutoApplyGuestIntent,
  shouldRestoreGuestDraft,
} from './guestIntentResume';

describe('guestIntentResume', () => {
  it('classifies reaction intent as auto-apply only', () => {
    const intent = {
      postId: 'post-123',
      returnTo: '/social/post/post-123',
      interactionType: 'reaction' as const,
      reactionEmojiIndex: 3,
      source: 'permalink' as const,
      createdAtMs: 123,
    };

    expect(shouldAutoApplyGuestIntent(intent)).toBe(true);
    expect(shouldRestoreGuestDraft(intent)).toBe(false);
    expect(resolveGuestIntentResumeAction(intent)).toEqual({
      kind: 'auto-react',
      intent,
    });
  });

  it('classifies top-level comment intent as restore-only', () => {
    const intent = {
      postId: 'post-456',
      returnTo: '/social/post/post-456',
      interactionType: 'comment' as const,
      mode: 'top-level' as const,
      draft: 'Restore me',
      targetReplyId: null,
      threadRootId: null,
      source: 'feed-wall' as const,
      createdAtMs: 456,
    };

    expect(shouldAutoApplyGuestIntent(intent)).toBe(false);
    expect(shouldRestoreGuestDraft(intent)).toBe(true);
    expect(resolveGuestIntentResumeAction(intent)).toEqual({
      kind: 'restore-draft',
      intent,
    });
  });

  it('classifies reply intent as restore-only', () => {
    const intent = {
      postId: 'post-789',
      returnTo: '/social/post/post-789',
      interactionType: 'reply' as const,
      mode: 'inline' as const,
      draft: 'Reply text',
      targetReplyId: 'reply-1',
      threadRootId: 'root-1',
      source: 'permalink' as const,
      createdAtMs: 789,
    };

    expect(shouldAutoApplyGuestIntent(intent)).toBe(false);
    expect(shouldRestoreGuestDraft(intent)).toBe(true);
    expect(resolveGuestIntentResumeAction(intent)).toEqual({
      kind: 'restore-draft',
      intent,
    });
  });

  it('returns null for missing guest intent', () => {
    expect(shouldAutoApplyGuestIntent(null)).toBe(false);
    expect(shouldRestoreGuestDraft(null)).toBe(false);
    expect(resolveGuestIntentResumeAction(null)).toBeNull();
  });
});
