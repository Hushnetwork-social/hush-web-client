export type SocialGuestIntentSource = "feed-wall" | "permalink";

export type PendingSocialThreadDraft = {
  postId: string;
  returnTo: string;
  interactionType: "comment" | "reply";
  mode: "top-level" | "inline";
  draft: string;
  targetReplyId: string | null;
  threadRootId: string | null;
  source: SocialGuestIntentSource;
  createdAtMs: number;
};

export type PendingSocialReactionIntent = {
  postId: string;
  returnTo: string;
  interactionType: "reaction";
  reactionEmojiIndex: number;
  source: SocialGuestIntentSource;
  createdAtMs: number;
};

export type PendingSocialGuestIntent = PendingSocialThreadDraft | PendingSocialReactionIntent;

type LegacyPendingSocialThreadDraft = {
  postId: string;
  mode: "top-level" | "inline";
  draft: string;
  targetReplyId: string | null;
  threadRootId: string | null;
  source: SocialGuestIntentSource;
  createdAtMs: number;
};

const GUEST_INTENT_STORAGE_KEY = "hush.social.guest-intent.v1";
const LEGACY_THREAD_DRAFT_STORAGE_KEY = "hush.social.thread-draft.v1";

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function defaultReturnTo(postId: string): string {
  return `/social/post/${encodeURIComponent(postId)}`;
}

function normalizeThreadDraft(
  draft: PendingSocialThreadDraft | LegacyPendingSocialThreadDraft
): PendingSocialThreadDraft {
  return {
    postId: draft.postId,
    returnTo: "returnTo" in draft && typeof draft.returnTo === "string"
      ? draft.returnTo
      : defaultReturnTo(draft.postId),
    interactionType:
      "interactionType" in draft && (draft.interactionType === "comment" || draft.interactionType === "reply")
        ? draft.interactionType
        : draft.mode === "inline"
          ? "reply"
          : "comment",
    mode: draft.mode,
    draft: draft.draft,
    targetReplyId: draft.targetReplyId,
    threadRootId: draft.threadRootId,
    source: draft.source,
    createdAtMs: draft.createdAtMs,
  };
}

function isValidSource(value: unknown): value is SocialGuestIntentSource {
  return value === "feed-wall" || value === "permalink";
}

function isPendingSocialReactionIntent(value: unknown): value is PendingSocialReactionIntent {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.postId === "string" &&
    typeof candidate.returnTo === "string" &&
    candidate.interactionType === "reaction" &&
    typeof candidate.reactionEmojiIndex === "number" &&
    isValidSource(candidate.source) &&
    typeof candidate.createdAtMs === "number"
  );
}

function isPendingSocialThreadDraft(value: unknown): value is PendingSocialThreadDraft {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.postId === "string" &&
    typeof candidate.returnTo === "string" &&
    (candidate.interactionType === "comment" || candidate.interactionType === "reply") &&
    (candidate.mode === "top-level" || candidate.mode === "inline") &&
    typeof candidate.draft === "string" &&
    (typeof candidate.targetReplyId === "string" || candidate.targetReplyId === null) &&
    (typeof candidate.threadRootId === "string" || candidate.threadRootId === null) &&
    isValidSource(candidate.source) &&
    typeof candidate.createdAtMs === "number"
  );
}

function isLegacyPendingSocialThreadDraft(value: unknown): value is LegacyPendingSocialThreadDraft {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.postId === "string" &&
    (candidate.mode === "top-level" || candidate.mode === "inline") &&
    typeof candidate.draft === "string" &&
    (typeof candidate.targetReplyId === "string" || candidate.targetReplyId === null) &&
    (typeof candidate.threadRootId === "string" || candidate.threadRootId === null) &&
    isValidSource(candidate.source) &&
    typeof candidate.createdAtMs === "number"
  );
}

function readJsonFromSessionStorage(key: string): unknown {
  const raw = window.sessionStorage.getItem(key);
  if (!raw) {
    return null;
  }

  return JSON.parse(raw) as unknown;
}

export function savePendingSocialGuestIntent(intent: PendingSocialGuestIntent): void {
  if (!canUseSessionStorage()) {
    return;
  }

  try {
    window.sessionStorage.setItem(GUEST_INTENT_STORAGE_KEY, JSON.stringify(intent));
    window.sessionStorage.removeItem(LEGACY_THREAD_DRAFT_STORAGE_KEY);
  } catch {
    // Ignore storage failures. The UI still functions without persistence.
  }
}

export function readPendingSocialGuestIntent(postId: string): PendingSocialGuestIntent | null {
  if (!canUseSessionStorage()) {
    return null;
  }

  try {
    const parsed = readJsonFromSessionStorage(GUEST_INTENT_STORAGE_KEY);
    if (isPendingSocialReactionIntent(parsed) || isPendingSocialThreadDraft(parsed)) {
      return parsed.postId === postId ? parsed : null;
    }

    const legacyParsed = readJsonFromSessionStorage(LEGACY_THREAD_DRAFT_STORAGE_KEY);
    if (isLegacyPendingSocialThreadDraft(legacyParsed)) {
      const normalized = normalizeThreadDraft(legacyParsed);
      return normalized.postId === postId ? normalized : null;
    }

    return null;
  } catch {
    return null;
  }
}

export function clearPendingSocialGuestIntent(postId: string): void {
  if (!canUseSessionStorage()) {
    return;
  }

  try {
    const guestIntent = readPendingSocialGuestIntent(postId);
    if (guestIntent) {
      window.sessionStorage.removeItem(GUEST_INTENT_STORAGE_KEY);
      window.sessionStorage.removeItem(LEGACY_THREAD_DRAFT_STORAGE_KEY);
      return;
    }

    const legacyParsed = readJsonFromSessionStorage(LEGACY_THREAD_DRAFT_STORAGE_KEY);
    if (isLegacyPendingSocialThreadDraft(legacyParsed) && legacyParsed.postId === postId) {
      window.sessionStorage.removeItem(LEGACY_THREAD_DRAFT_STORAGE_KEY);
    }
  } catch {
    // Ignore corrupt storage values.
  }
}

export function savePendingSocialThreadDraft(
  draft: Omit<PendingSocialThreadDraft, "interactionType" | "returnTo"> &
    Partial<Pick<PendingSocialThreadDraft, "interactionType" | "returnTo">>
): void {
  savePendingSocialGuestIntent({
    ...draft,
    interactionType: draft.interactionType ?? (draft.mode === "inline" ? "reply" : "comment"),
    returnTo: draft.returnTo ?? defaultReturnTo(draft.postId),
  });
}

export function readPendingSocialThreadDraft(postId: string): PendingSocialThreadDraft | null {
  const intent = readPendingSocialGuestIntent(postId);
  if (!intent || intent.interactionType === "reaction") {
    return null;
  }

  return intent;
}

export function clearPendingSocialThreadDraft(postId: string): void {
  clearPendingSocialGuestIntent(postId);
}
