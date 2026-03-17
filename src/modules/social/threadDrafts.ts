export type PendingSocialThreadDraft = {
  postId: string;
  mode: "top-level" | "inline";
  draft: string;
  targetReplyId: string | null;
  threadRootId: string | null;
  source: "feed-wall" | "permalink";
  createdAtMs: number;
};

const STORAGE_KEY = "hush.social.thread-draft.v1";

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function savePendingSocialThreadDraft(draft: PendingSocialThreadDraft): void {
  if (!canUseSessionStorage()) {
    return;
  }

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Ignore storage failures. The UI still functions without persistence.
  }
}

export function readPendingSocialThreadDraft(postId: string): PendingSocialThreadDraft | null {
  if (!canUseSessionStorage()) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as PendingSocialThreadDraft;
    return parsed.postId === postId ? parsed : null;
  } catch {
    return null;
  }
}

export function clearPendingSocialThreadDraft(postId: string): void {
  if (!canUseSessionStorage()) {
    return;
  }

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw) as PendingSocialThreadDraft;
    if (parsed.postId === postId) {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore corrupt storage values.
  }
}
