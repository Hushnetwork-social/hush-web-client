"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Link2, Loader2, MessageCircle, SmilePlus, Sparkles, X } from "lucide-react";
import { useAppStore } from "@/stores";

const SOCIAL_MENU_IDS = new Set([
  "feed-wall",
  "following",
  "my-posts",
  "my-replies",
  "notifications",
  "profile",
  "settings",
  "logout",
]);

type ViewState = "loading" | "empty" | "error" | "populated";
const POST_PREVIEW_LIMIT = 1000;
const EMPTY_REACTIONS = { "👍": 0, "❤️": 0, "😂": 0, "😮": 0, "😢": 0, "😡": 0 };

type ReplyItem = {
  id: string;
  author: string;
  time: string;
  text: string;
  reactions: Record<string, number>;
  threadRootId: string | null;
};

type PostItem = {
  id: string;
  author: string;
  time: string;
  text: string;
  replyCount: number;
  reactions: Record<string, number>;
  replies: ReplyItem[];
};

const LONG_POST_TEXT =
  "Kaspa is reentering the GPU era and proving real utility with GPU workstations. " +
  "We are documenting benchmarks, thermals, and real deployment costs so builders can compare setups with clear numbers. ".repeat(
    14
  );

const DEMO_POSTS: PostItem[] = [
  {
    id: "post-1",
    author: "Victor Resto",
    time: "1h",
    text: LONG_POST_TEXT,
    replyCount: 2,
    reactions: { "👍": 1, "❤️": 1, "😂": 0, "😮": 0, "😢": 0, "😡": 0 },
    replies: [
      {
        id: "post-1-reply-1",
        author: "Zbid",
        time: "54m",
        text: "Nice take. Benchmarks on real workloads would make this stronger.",
        reactions: { "👍": 1, "❤️": 0, "😂": 0, "😮": 0, "😢": 0, "😡": 0 },
        threadRootId: null,
      },
      {
        id: "post-1-reply-2",
        author: "Klaus",
        time: "38m",
        text: "We tested two rigs this weekend, power efficiency is improving a lot.",
        reactions: { "👍": 1, "❤️": 0, "😂": 1, "😮": 0, "😢": 0, "😡": 0 },
        threadRootId: null,
      },
    ],
  },
  {
    id: "post-2",
    author: "Falty",
    time: "2h",
    text: "Built a merchant flow on Kasmart for handmade products. Feedback welcome.",
    replyCount: 1,
    reactions: { "👍": 1, "❤️": 0, "😂": 1, "😮": 0, "😢": 0, "😡": 0 },
    replies: [
      {
        id: "post-2-reply-1",
        author: "Jeff",
        time: "1h",
        text: "Checkout flow is clean. I would add one shipping summary step.",
        reactions: { "👍": 1, "❤️": 0, "😂": 0, "😮": 0, "😢": 0, "😡": 0 },
        threadRootId: null,
      },
    ],
  },
];

function resolveViewState(rawState: string | null): ViewState {
  if (rawState === "loading" || rawState === "empty" || rawState === "error") {
    return rawState;
  }
  return "populated";
}

export default function SocialPage() {
  const searchParams = useSearchParams();
  const appContexts = useAppStore((state) => state.appContexts);
  const selectedNav = useAppStore((state) => state.selectedNav);
  const setSelectedNav = useAppStore((state) => state.setSelectedNav);
  const setAppContextScroll = useAppStore((state) => state.setAppContextScroll);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [topReplyDraft, setTopReplyDraft] = useState("");
  const [isTopComposerOpen, setIsTopComposerOpen] = useState(false);
  const [inlineReplyDraft, setInlineReplyDraft] = useState("");
  const [inlineComposerTargetId, setInlineComposerTargetId] = useState<string | null>(null);
  const [inlineComposerRootId, setInlineComposerRootId] = useState<string | null>(null);
  const [overlayReplies, setOverlayReplies] = useState<ReplyItem[]>([]);
  const feedWallRegionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!SOCIAL_MENU_IDS.has(selectedNav)) {
      setSelectedNav("feed-wall");
    }
  }, [selectedNav, setSelectedNav]);

  useEffect(() => {
    const region = feedWallRegionRef.current;
    if (!region) {
      return;
    }

    region.scrollTop = appContexts.social.scrollOffset;
  }, [appContexts.social.scrollOffset]);

  const viewState = useMemo(() => resolveViewState(searchParams.get("state")), [searchParams]);
  const activePost = useMemo(() => DEMO_POSTS.find((post) => post.id === activePostId) ?? null, [activePostId]);

  useEffect(() => {
    if (!activePost) {
      setOverlayReplies([]);
      setTopReplyDraft("");
      setIsTopComposerOpen(false);
      setInlineReplyDraft("");
      setInlineComposerTargetId(null);
      setInlineComposerRootId(null);
      return;
    }

    setOverlayReplies(activePost.replies);
    setTopReplyDraft("");
    setIsTopComposerOpen(false);
    setInlineReplyDraft("");
    setInlineComposerTargetId(null);
    setInlineComposerRootId(null);
  }, [activePost]);

  useEffect(() => {
    if (!activePost) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActivePostId(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activePost]);

  const openPostDetail = (postId: string) => {
    setActivePostId(postId);
  };

  const insertReplyInThread = (replies: ReplyItem[], newReply: ReplyItem, rootId: string) => {
    const lastThreadIndex = replies.reduce((lastIdx, item, index) => {
      if (item.id === rootId || item.threadRootId === rootId) {
        return index;
      }
      return lastIdx;
    }, -1);

    if (lastThreadIndex < 0) {
      return [newReply, ...replies];
    }

    return [...replies.slice(0, lastThreadIndex + 1), newReply, ...replies.slice(lastThreadIndex + 1)];
  };

  const openReplyToReplyComposer = (targetReply: ReplyItem) => {
    const rootId = targetReply.threadRootId ?? targetReply.id;
    setInlineComposerTargetId(targetReply.id);
    setInlineComposerRootId(rootId);
    setInlineReplyDraft(`${targetReply.author}, `);
  };

  const submitTopLevelReply = () => {
    const trimmed = topReplyDraft.trim();
    if (!trimmed) return;

    const newReply: ReplyItem = {
      id: `reply-${Date.now()}`,
      author: "You",
      time: "now",
      text: trimmed,
      reactions: { ...EMPTY_REACTIONS },
      threadRootId: null,
    };

    setOverlayReplies((prev) => [newReply, ...prev]);
    setTopReplyDraft("");
  };

  const submitInlineReply = () => {
    const trimmed = inlineReplyDraft.trim();
    if (!trimmed || !inlineComposerRootId) return;

    const newReply: ReplyItem = {
      id: `reply-${Date.now()}`,
      author: "You",
      time: "now",
      text: trimmed,
      reactions: { ...EMPTY_REACTIONS },
      threadRootId: inlineComposerRootId,
    };

    setOverlayReplies((prev) => insertReplyInThread(prev, newReply, inlineComposerRootId));
    setInlineReplyDraft("");
    setInlineComposerTargetId(null);
    setInlineComposerRootId(null);
  };

  const renderFeedWallContent = () => {
    if (viewState === "loading") {
      return (
        <div data-testid="social-loading" className="flex flex-col items-center justify-center py-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-hush-purple mb-3" />
          <p className="text-hush-text-accent text-sm">Loading Feed Wall...</p>
        </div>
      );
    }

    if (viewState === "error") {
      return (
        <div data-testid="social-error" className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mb-3" />
          <p className="text-hush-text-primary font-semibold mb-1">Could not load Feed Wall</p>
          <p className="text-hush-text-accent text-sm">Please try again in a moment.</p>
        </div>
      );
    }

    if (viewState === "empty") {
      return (
        <div data-testid="social-empty" className="flex flex-col items-center justify-center py-16 text-center">
          <Sparkles className="w-8 h-8 text-hush-purple mb-3" />
          <p className="text-hush-text-primary font-semibold mb-1">Your Feed Wall is quiet</p>
          <p className="text-hush-text-accent text-sm">Follow people or create a post to start your wall.</p>
        </div>
      );
    }

    return (
      <div data-testid="social-populated" className="space-y-3">
        {DEMO_POSTS.map((post) => (
          <article
            key={post.id}
            data-testid={`social-post-${post.id}`}
            className="bg-hush-bg-dark rounded-xl p-4 border border-hush-bg-hover"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-hush-text-primary font-semibold">{post.author}</p>
              <span className="text-xs text-hush-text-accent">{post.time}</span>
            </div>
            <p className="text-sm text-hush-text-accent" data-testid={`post-preview-${post.id}`}>
              {post.text.length > POST_PREVIEW_LIMIT ? post.text.slice(0, POST_PREVIEW_LIMIT) : post.text}
              {post.text.length > POST_PREVIEW_LIMIT && (
                <button
                  type="button"
                  className="ml-1 text-hush-purple hover:underline"
                  data-testid={`open-post-detail-${post.id}`}
                  onClick={() => openPostDetail(post.id)}
                >
                  ...
                </button>
              )}
            </p>

            <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-hush-text-accent hover:bg-hush-bg-hover"
                  data-testid={`post-action-reply-${post.id}`}
                  onClick={() => openPostDetail(post.id)}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Reply ({post.replyCount})
                </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-hush-text-accent hover:bg-hush-bg-hover"
                data-testid={`post-action-link-${post.id}`}
              >
                <Link2 className="w-3.5 h-3.5" />
                Get Link
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2" data-testid={`post-reaction-strip-${post.id}`}>
              {Object.entries(post.reactions).map(([emoji, count]) => (
                <button
                  key={emoji}
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full border border-hush-bg-hover px-2 py-1 text-[11px] text-hush-text-accent hover:bg-hush-bg-hover"
                  data-testid={`post-reaction-${post.id}-${emoji}`}
                >
                  <span>{emoji}</span>
                  <span>{count}</span>
                </button>
              ))}
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-hush-purple/40 px-2 py-1 text-[11px] text-hush-purple hover:bg-hush-purple/10"
                data-testid={`post-reaction-add-${post.id}`}
              >
                <SmilePlus className="w-3 h-3" />
                Add
              </button>
            </div>
            {post.replyCount > 0 && (
              <div className="mt-2 text-[11px] text-hush-text-accent" data-testid={`post-replies-hint-${post.id}`}>
                Replies open in post detail (mock preview mode).
              </div>
            )}
          </article>
        ))}
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden" data-testid="social-shell">
      <section
        ref={feedWallRegionRef}
        className="flex-1 min-h-0 overflow-y-auto p-4"
        data-testid="feed-wall-region"
        onScroll={(event) => {
          setAppContextScroll("social", event.currentTarget.scrollTop);
        }}
      >
        <div className="max-w-3xl mx-auto">
          <div className="mb-3">
            <h2 className="text-xl font-semibold text-hush-text-primary">Feed Wall</h2>
            <p className="text-xs text-hush-text-accent">Public posts from people you follow and nearby circles.</p>
          </div>

          {selectedNav === "feed-wall" ? (
            renderFeedWallContent()
          ) : (
            <div data-testid="social-subview-placeholder" className="py-16 text-center">
              <p className="text-hush-text-primary font-semibold mb-1">{selectedNav.replace(/-/g, " ")}</p>
              <p className="text-hush-text-accent text-sm">This section will be expanded in the next phases.</p>
            </div>
          )}
        </div>
      </section>

      {activePost && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          data-testid="post-detail-overlay"
          onClick={() => setActivePostId(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-xl border border-hush-bg-hover bg-hush-bg-dark p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-hush-text-primary font-semibold">{activePost.author}</p>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-hush-text-accent hover:bg-hush-bg-hover"
                onClick={() => setActivePostId(null)}
                data-testid="close-post-detail"
              >
                <X className="w-3.5 h-3.5" />
                Close
              </button>
            </div>
            <p className="text-xs text-hush-text-accent mb-3">{activePost.time}</p>
            <p className="text-sm text-hush-text-accent whitespace-pre-wrap" data-testid="post-detail-full-text">
              {activePost.text}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2" data-testid={`post-detail-actions-${activePost.id}`}>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-hush-text-accent hover:bg-hush-bg-hover"
                data-testid={`post-detail-action-reply-${activePost.id}`}
                onClick={() => setIsTopComposerOpen(true)}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Reply ({overlayReplies.length})
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-hush-text-accent hover:bg-hush-bg-hover"
                data-testid={`post-detail-action-link-${activePost.id}`}
              >
                <Link2 className="w-3.5 h-3.5" />
                Get Link
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2" data-testid={`post-detail-reaction-strip-${activePost.id}`}>
              {Object.entries(activePost.reactions).map(([emoji, count]) => (
                <button
                  key={emoji}
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full border border-hush-bg-hover px-2 py-1 text-[11px] text-hush-text-accent hover:bg-hush-bg-hover"
                >
                  <span>{emoji}</span>
                  <span>{count}</span>
                </button>
              ))}
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-hush-purple/40 px-2 py-1 text-[11px] text-hush-purple hover:bg-hush-purple/10"
                data-testid={`post-detail-reaction-add-${activePost.id}`}
              >
                <SmilePlus className="w-3 h-3" />
                Add
              </button>
            </div>

            {isTopComposerOpen && (
              <div className="mt-3 rounded-lg border border-hush-bg-hover p-3" data-testid="post-detail-composer-top">
                <p className="text-[11px] text-hush-text-accent mb-2">Replying to post (mock rich text)</p>
                <textarea
                  className="w-full min-h-24 rounded-md border border-hush-bg-hover bg-hush-bg-dark px-3 py-2 text-sm text-hush-text-primary outline-none focus:border-hush-purple"
                  value={topReplyDraft}
                  onChange={(event) => setTopReplyDraft(event.currentTarget.value)}
                  data-testid="post-detail-composer-input"
                  placeholder="Write your reply..."
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.ctrlKey) {
                      event.preventDefault();
                      submitTopLevelReply();
                    }
                  }}
                />
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-[10px] text-hush-text-accent">Enter = send, Ctrl+Enter = new line</p>
                  <button
                    type="button"
                    className="rounded-md bg-hush-purple px-3 py-1 text-xs font-semibold text-hush-bg-dark disabled:opacity-50"
                    onClick={submitTopLevelReply}
                    disabled={topReplyDraft.trim().length === 0}
                    data-testid="post-detail-composer-send"
                  >
                    Reply
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4">
              <h3 className="text-sm font-semibold text-hush-text-primary mb-2">Replies ({overlayReplies.length})</h3>
              <div className="space-y-2" data-testid="post-detail-replies-scroll">
                {overlayReplies
                  .filter((reply) => reply.threadRootId === null)
                  .map((reply) => (
                  <div key={reply.id} className="rounded-lg border border-hush-bg-hover p-3" data-testid={`post-detail-reply-${reply.id}`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-hush-text-primary">{reply.author}</p>
                      <span className="text-[10px] text-hush-text-accent">{reply.time}</span>
                    </div>
                    <p className="text-xs text-hush-text-accent">{reply.text}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {Object.entries(reply.reactions).map(([emoji, count]) => (
                        <button
                          key={emoji}
                          type="button"
                          className="inline-flex items-center gap-1 rounded-full border border-hush-bg-hover px-2 py-1 text-[11px] text-hush-text-accent hover:bg-hush-bg-hover"
                        >
                          <span>{emoji}</span>
                          <span>{count}</span>
                        </button>
                      ))}
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-full border border-hush-bg-hover px-2 py-1 text-[11px] text-hush-text-accent hover:bg-hush-bg-hover"
                        data-testid={`post-detail-reply-reply-${reply.id}`}
                        onClick={() => openReplyToReplyComposer(reply)}
                      >
                        <MessageCircle className="w-3 h-3" />
                        Reply
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-full border border-hush-purple/40 px-2 py-1 text-[11px] text-hush-purple hover:bg-hush-purple/10"
                        data-testid={`post-detail-reply-add-${reply.id}`}
                      >
                        <SmilePlus className="w-3 h-3" />
                        Add
                      </button>
                    </div>
                    {inlineComposerTargetId === reply.id && (
                      <div className="mt-2 rounded-lg border border-hush-bg-hover p-2 bg-hush-bg-dark/60" data-testid={`inline-composer-${reply.id}`}>
                        <textarea
                          className="w-full min-h-20 rounded-md border border-hush-bg-hover bg-hush-bg-dark px-2 py-1 text-xs text-hush-text-primary outline-none focus:border-hush-purple"
                          value={inlineReplyDraft}
                          onChange={(event) => setInlineReplyDraft(event.currentTarget.value)}
                          data-testid="inline-composer-input"
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.ctrlKey) {
                              event.preventDefault();
                              submitInlineReply();
                            }
                          }}
                        />
                        <div className="mt-2 flex items-center justify-between">
                          <p className="text-[10px] text-hush-text-accent">Enter = send, Ctrl+Enter = new line</p>
                          <button
                            type="button"
                            className="rounded-md bg-hush-purple px-2 py-1 text-[11px] font-semibold text-hush-bg-dark disabled:opacity-50"
                            onClick={submitInlineReply}
                            disabled={inlineReplyDraft.trim().length === 0}
                            data-testid="inline-composer-send"
                          >
                            Reply
                          </button>
                        </div>
                      </div>
                    )}
                    {overlayReplies
                      .filter((childReply) => childReply.threadRootId === reply.id)
                      .map((childReply) => (
                        <div
                          key={childReply.id}
                          className="mt-2 ml-4 rounded-lg border border-hush-bg-hover p-3 bg-hush-bg-dark/50"
                          data-testid={`post-detail-reply-${childReply.id}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-semibold text-hush-text-primary">{childReply.author}</p>
                            <span className="text-[10px] text-hush-text-accent">{childReply.time}</span>
                          </div>
                          <p className="text-xs text-hush-text-accent">{childReply.text}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {Object.entries(childReply.reactions).map(([emoji, count]) => (
                              <button
                                key={emoji}
                                type="button"
                                className="inline-flex items-center gap-1 rounded-full border border-hush-bg-hover px-2 py-1 text-[11px] text-hush-text-accent hover:bg-hush-bg-hover"
                              >
                                <span>{emoji}</span>
                                <span>{count}</span>
                              </button>
                            ))}
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-full border border-hush-bg-hover px-2 py-1 text-[11px] text-hush-text-accent hover:bg-hush-bg-hover"
                              data-testid={`post-detail-reply-reply-${childReply.id}`}
                              onClick={() => openReplyToReplyComposer(childReply)}
                            >
                              <MessageCircle className="w-3 h-3" />
                              Reply
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-full border border-hush-purple/40 px-2 py-1 text-[11px] text-hush-purple hover:bg-hush-purple/10"
                              data-testid={`post-detail-reply-add-${childReply.id}`}
                            >
                              <SmilePlus className="w-3 h-3" />
                              Add
                            </button>
                          </div>
                          {inlineComposerTargetId === childReply.id && (
                            <div className="mt-2 rounded-lg border border-hush-bg-hover p-2 bg-hush-bg-dark/60" data-testid={`inline-composer-${childReply.id}`}>
                              <textarea
                                className="w-full min-h-20 rounded-md border border-hush-bg-hover bg-hush-bg-dark px-2 py-1 text-xs text-hush-text-primary outline-none focus:border-hush-purple"
                                value={inlineReplyDraft}
                                onChange={(event) => setInlineReplyDraft(event.currentTarget.value)}
                                data-testid="inline-composer-input"
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" && !event.ctrlKey) {
                                    event.preventDefault();
                                    submitInlineReply();
                                  }
                                }}
                              />
                              <div className="mt-2 flex items-center justify-between">
                                <p className="text-[10px] text-hush-text-accent">Enter = send, Ctrl+Enter = new line</p>
                                <button
                                  type="button"
                                  className="rounded-md bg-hush-purple px-2 py-1 text-[11px] font-semibold text-hush-bg-dark disabled:opacity-50"
                                  onClick={submitInlineReply}
                                  disabled={inlineReplyDraft.trim().length === 0}
                                  data-testid="inline-composer-send"
                                >
                                  Reply
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
