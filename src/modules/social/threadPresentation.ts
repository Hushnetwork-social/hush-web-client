import type { SocialAuthorFollowStateContract } from "./contracts";

export type SocialThreadEntry = {
  id: string;
  serverEntryId?: string;
  isPending?: boolean;
  author: string;
  authorPublicAddress?: string;
  reactionScopeId?: string;
  authorCommitment?: string;
  time: string;
  text: string;
  reactions: Record<string, number>;
  threadRootId: string | null;
  createdAtMs: number;
  childReplyCount?: number;
  followState?: SocialAuthorFollowStateContract;
};

export const INITIAL_TOP_LEVEL_COMMENTS = 10;
export const LOAD_MORE_TOP_LEVEL_COMMENTS = 10;
export const INITIAL_THREAD_REPLIES = 5;
export const LOAD_MORE_THREAD_REPLIES = 5;

export function getReactionCount(entry: SocialThreadEntry): number {
  return Object.values(entry.reactions).reduce((sum, value) => sum + value, 0);
}

export function sortThreadEntries(entries: SocialThreadEntry[]): SocialThreadEntry[] {
  return [...entries].sort((left, right) => {
    const reactionDelta = getReactionCount(right) - getReactionCount(left);
    if (reactionDelta !== 0) {
      return reactionDelta;
    }

    return right.createdAtMs - left.createdAtMs;
  });
}

export function getTopLevelEntries(entries: SocialThreadEntry[]): SocialThreadEntry[] {
  return sortThreadEntries(entries.filter((entry) => entry.threadRootId === null));
}

export function getThreadReplies(entries: SocialThreadEntry[], threadRootId: string): SocialThreadEntry[] {
  return sortThreadEntries(entries.filter((entry) => entry.threadRootId === threadRootId));
}

export function insertReplyInThread(
  entries: SocialThreadEntry[],
  newReply: SocialThreadEntry,
  threadRootId: string
): SocialThreadEntry[] {
  const insertAfterIndex = entries.reduce((lastIndex, entry, index) => {
    if (entry.id === threadRootId || entry.threadRootId === threadRootId) {
      return index;
    }

    return lastIndex;
  }, -1);

  if (insertAfterIndex < 0) {
    return [newReply, ...entries];
  }

  return [
    ...entries.slice(0, insertAfterIndex + 1),
    newReply,
    ...entries.slice(insertAfterIndex + 1),
  ];
}
