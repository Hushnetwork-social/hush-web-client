import { describe, expect, it } from "vitest";
import {
  getThreadReplies,
  getTopLevelEntries,
  INITIAL_THREAD_REPLIES,
  INITIAL_TOP_LEVEL_COMMENTS,
  insertReplyInThread,
  sortThreadEntries,
  type SocialThreadEntry,
} from "./threadPresentation";

const EMPTY_REACTIONS = { "👍": 0, "❤️": 0, "😂": 0, "😮": 0, "😢": 0, "😡": 0 };

function createEntry(overrides: Partial<SocialThreadEntry> & Pick<SocialThreadEntry, "id">): SocialThreadEntry {
  return {
    id: overrides.id,
    author: overrides.author ?? "Owner",
    time: overrides.time ?? "now",
    text: overrides.text ?? "text",
    reactions: overrides.reactions ?? { ...EMPTY_REACTIONS },
    threadRootId: overrides.threadRootId ?? null,
    createdAtMs: overrides.createdAtMs ?? 0,
  };
}

describe("threadPresentation", () => {
  it("sorts entries by reaction count descending then creation time descending", () => {
    const entries = [
      createEntry({ id: "older-high", createdAtMs: 10, reactions: { ...EMPTY_REACTIONS, "👍": 3 } }),
      createEntry({ id: "newer-high", createdAtMs: 20, reactions: { ...EMPTY_REACTIONS, "👍": 3 } }),
      createEntry({ id: "low", createdAtMs: 30, reactions: { ...EMPTY_REACTIONS, "👍": 1 } }),
    ];

    expect(sortThreadEntries(entries).map((entry) => entry.id)).toEqual([
      "newer-high",
      "older-high",
      "low",
    ]);
  });

  it("separates top-level comments from thread replies", () => {
    const entries = [
      createEntry({ id: "comment-1", createdAtMs: 10 }),
      createEntry({ id: "reply-1", createdAtMs: 20, threadRootId: "comment-1" }),
      createEntry({ id: "comment-2", createdAtMs: 30 }),
    ];

    expect(getTopLevelEntries(entries).map((entry) => entry.id)).toEqual(["comment-2", "comment-1"]);
    expect(getThreadReplies(entries, "comment-1").map((entry) => entry.id)).toEqual(["reply-1"]);
  });

  it("inserts flattened replies immediately after the existing thread block", () => {
    const entries = [
      createEntry({ id: "comment-1", createdAtMs: 10 }),
      createEntry({ id: "reply-1", createdAtMs: 20, threadRootId: "comment-1" }),
      createEntry({ id: "comment-2", createdAtMs: 30 }),
    ];
    const inserted = createEntry({ id: "reply-2", createdAtMs: 40, threadRootId: "comment-1" });

    expect(insertReplyInThread(entries, inserted, "comment-1").map((entry) => entry.id)).toEqual([
      "comment-1",
      "reply-1",
      "reply-2",
      "comment-2",
    ]);
  });

  it("keeps FEAT-088 page sizes explicit", () => {
    expect(INITIAL_TOP_LEVEL_COMMENTS).toBe(10);
    expect(INITIAL_THREAD_REPLIES).toBe(5);
  });
});
