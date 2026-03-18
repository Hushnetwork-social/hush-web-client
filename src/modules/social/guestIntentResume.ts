import type { PendingSocialGuestIntent, PendingSocialReactionIntent, PendingSocialThreadDraft } from './threadDrafts';

export type SocialGuestResumeAction =
  | {
      kind: 'auto-react';
      intent: PendingSocialReactionIntent;
    }
  | {
      kind: 'restore-draft';
      intent: PendingSocialThreadDraft;
    };

export function shouldAutoApplyGuestIntent(intent: PendingSocialGuestIntent | null): intent is PendingSocialReactionIntent {
  return intent?.interactionType === 'reaction';
}

export function shouldRestoreGuestDraft(intent: PendingSocialGuestIntent | null): intent is PendingSocialThreadDraft {
  return intent !== null && intent.interactionType !== 'reaction';
}

export function resolveGuestIntentResumeAction(intent: PendingSocialGuestIntent | null): SocialGuestResumeAction | null {
  if (shouldAutoApplyGuestIntent(intent)) {
    return {
      kind: 'auto-react',
      intent,
    };
  }

  if (shouldRestoreGuestDraft(intent)) {
    return {
      kind: 'restore-draft',
      intent,
    };
  }

  return null;
}
