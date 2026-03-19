"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildApiUrl } from "@/lib/api-config";
import { useSyncContext } from "@/lib/sync";
import { ContentCarousel } from "@/components/chat/ContentCarousel";
import { FollowAuthorButton } from "@/components/social/FollowAuthorButton";
import { SocialAuthPromptOverlay } from "@/components/social/SocialAuthPromptOverlay";
import { SocialPostReactions } from "@/components/social/SocialPostReactions";
import {
  clearPendingSocialGuestIntent,
  readPendingSocialGuestIntent,
  clearPendingSocialThreadDraft,
  savePendingSocialGuestIntent,
  savePendingSocialThreadDraft,
} from "@/modules/social/threadDrafts";
import { getAuthRoute, getSocialPostRoute } from "@/lib/navigation/appRoutes";
import { resolveGuestIntentResumeAction } from "@/modules/social/guestIntentResume";
import { createSocialThreadEntry, getSocialCommentsPage } from "@/modules/social/ThreadService";
import { getSocialPostPermalink, type SocialPermalinkPayloadContract } from "@/modules/social/PermalinkService";
import { followSocialAuthor } from "@/modules/social/FollowService";
import {
  resolveSocialFollowButtonState,
  type SocialAuthorFollowStateContract,
} from "@/modules/social/contracts";

type AccessState = "allowed" | "guest_denied" | "unauthorized_denied" | "not_found";

type PermalinkPayload = SocialPermalinkPayloadContract;

type PermalinkThreadReply = {
  id: string;
  author: string;
  authorPublicAddress?: string;
  reactionScopeId?: string;
  authorCommitment?: string;
  time: string;
  text: string;
  createdAtMs: number;
  followState?: SocialAuthorFollowStateContract;
};

function normalizePermalinkPayload(payload: PermalinkPayload): PermalinkPayload {
  return {
    ...payload,
    circleFeedIds: payload.circleFeedIds ?? [],
    attachments: payload.attachments ?? [],
  };
}

function resolveAccessOverride(access: string | null): AccessState | null {
  if (access === "guest") {
    return "guest_denied";
  }
  if (access === "denied") {
    return "unauthorized_denied";
  }
  return null;
}

function readRequesterAddressFromStorage(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem("hush-app-storage");
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { state?: { credentials?: { signingPublicKey?: string } } };
    const address = parsed?.state?.credentials?.signingPublicKey?.trim();
    return address && address.length > 0 ? address : null;
  } catch {
    return null;
  }
}

function normalizePublicAddress(address?: string | null): string {
  return (address ?? "").trim().toLowerCase();
}

export default function SocialPostPermalinkPage() {
  const params = useParams<{ postId: string }>();
  const searchParams = useSearchParams();
  const routePostId = typeof params?.postId === "string" ? params.postId : "";
  const { triggerSyncNow } = useSyncContext();

  const [permalink, setPermalink] = useState<PermalinkPayload | null>(null);
  const [authorName, setAuthorName] = useState<string>("Owner");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [showAuthOverlay, setShowAuthOverlay] = useState(false);
  const [isTopComposerOpen, setIsTopComposerOpen] = useState(false);
  const [topReplyDraft, setTopReplyDraft] = useState("");
  const [topReplyTargetId, setTopReplyTargetId] = useState<string | null>(null);
  const [topReplyThreadRootId, setTopReplyThreadRootId] = useState<string | null>(null);
  const [localReplies, setLocalReplies] = useState<PermalinkThreadReply[]>([]);
  const [followRefreshNonce, setFollowRefreshNonce] = useState(0);
  const [pendingFollowAuthors, setPendingFollowAuthors] = useState<Record<string, boolean>>({});
  const [followStateOverrides, setFollowStateOverrides] = useState<Record<string, SocialAuthorFollowStateContract>>({});
  const [followError, setFollowError] = useState<string | null>(null);
  const [pendingAutoReactionIndex, setPendingAutoReactionIndex] = useState<number | null>(null);
  const pendingPermalinkIntentRef = useRef<{
    postId: string | null;
    intent: ReturnType<typeof readPendingSocialGuestIntent>;
    applied: boolean;
  }>({
    postId: null,
    intent: null,
    applied: false,
  });

  const closeTopComposer = () => {
    setIsTopComposerOpen(false);
    setTopReplyTargetId(null);
    setTopReplyThreadRootId(null);
  };

  const openTopComposer = (options?: {
    targetReplyId?: string | null;
    threadRootId?: string | null;
    draft?: string;
  }) => {
    setTopReplyTargetId(options?.targetReplyId ?? null);
    setTopReplyThreadRootId(options?.threadRootId ?? null);
    if (typeof options?.draft === "string") {
      setTopReplyDraft(options.draft);
    }
    setIsTopComposerOpen(true);
  };

  const accessOverride = useMemo(() => resolveAccessOverride(searchParams.get("access")), [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadPermalink(): Promise<void> {
      if (!routePostId) {
        setPermalink({
          success: false,
          message: "Invalid post id",
          accessState: "not_found",
          canInteract: false,
          circleFeedIds: [],
          attachments: [],
        });
        setIsLoading(false);
        return;
      }

      if (accessOverride) {
        setPermalink({
          success: true,
          message: "",
          accessState: accessOverride,
          postId: routePostId,
          canInteract: false,
          circleFeedIds: [],
          attachments: [],
        });
        setIsLoading(false);
        return;
      }

      const requesterAddress = readRequesterAddressFromStorage();
      const qs = new URLSearchParams();
      qs.set("postId", routePostId);
      qs.set("isAuthenticated", requesterAddress ? "true" : "false");
      if (requesterAddress) {
        qs.set("requesterPublicAddress", requesterAddress);
      }

      try {
        const payload = await getSocialPostPermalink(
          routePostId,
          requesterAddress,
          requesterAddress !== null
        );

        if (
          payload.accessState === "allowed" &&
          (!payload.createdAtUnixMs || payload.createdAtUnixMs <= 0) &&
          payload.postId
        ) {
          try {
            const wallQs = new URLSearchParams();
            wallQs.set("isAuthenticated", requesterAddress ? "true" : "false");
            wallQs.set("limit", "200");
            if (requesterAddress) {
              wallQs.set("requesterPublicAddress", requesterAddress);
            }

            const wallResponse = await fetch(buildApiUrl(`/api/social/posts/feed-wall?${wallQs.toString()}`), {
              method: "GET",
              cache: "no-store",
            });

            if (wallResponse.ok) {
              const wallPayload = (await wallResponse.json()) as {
                success?: boolean;
                posts?: Array<{ postId: string; createdAtUnixMs?: number }>;
              };
              const matchedPost = wallPayload.posts?.find((post) => post.postId === payload.postId);
              if (matchedPost?.createdAtUnixMs && matchedPost.createdAtUnixMs > 0) {
                payload.createdAtUnixMs = matchedPost.createdAtUnixMs;
              }
            }
          } catch {
            // Keep permalink payload without timestamp if feed-wall enrichment fails.
          }
        }

        if (cancelled) {
          return;
        }
        setPermalink(normalizePermalinkPayload(payload));

        const authorAddress = payload.authorPublicAddress?.trim();
        if (authorAddress) {
          try {
            const identityResponse = await fetch(
              buildApiUrl(`/api/identity/check?address=${encodeURIComponent(authorAddress)}`),
              { method: "GET", cache: "no-store" }
            );
            const identityPayload = (await identityResponse.json()) as {
              exists?: boolean;
              identity?: { profileName?: string | null };
            };
            const profileName = identityPayload.identity?.profileName?.trim();
            if (!cancelled) {
              setAuthorName(profileName && profileName.length > 0 ? profileName : "Owner");
            }
          } catch {
            if (!cancelled) {
              setAuthorName("Owner");
            }
          }
        }
      } catch {
        if (!cancelled) {
          setPermalink({
            success: false,
            message: "Failed to resolve permalink",
            accessState: "not_found",
            postId: routePostId,
            canInteract: false,
            circleFeedIds: [],
            attachments: [],
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadPermalink();

    return () => {
      cancelled = true;
    };
  }, [accessOverride, routePostId, followRefreshNonce]);

  useEffect(() => {
    setActiveMediaIndex(0);
  }, [permalink?.postId]);

  useEffect(() => {
    const requesterAddress = readRequesterAddressFromStorage();
    if (requesterAddress) {
      return;
    }

    setPendingFollowAuthors({});
    setFollowStateOverrides({});
    setFollowError(null);
  }, [permalink?.postId]);

  useEffect(() => {
    if (!permalink?.postId) {
      return;
    }

    if (pendingPermalinkIntentRef.current.postId !== permalink.postId) {
      pendingPermalinkIntentRef.current = {
        postId: permalink.postId,
        intent: readPendingSocialGuestIntent(permalink.postId),
        applied: false,
      };
    }

    setLocalReplies([]);

    const pendingIntent = pendingPermalinkIntentRef.current;
    const resumeAction =
      pendingIntent.intent?.source === "permalink"
        ? resolveGuestIntentResumeAction(pendingIntent.intent)
        : null;
      if (permalink.canInteract && resumeAction && !pendingIntent.applied) {
      pendingIntent.applied = true;
      if (resumeAction.kind === "restore-draft") {
        openTopComposer({
          draft: resumeAction.intent.draft,
          targetReplyId: resumeAction.intent.targetReplyId,
          threadRootId: resumeAction.intent.threadRootId,
        });
      } else {
        setPendingAutoReactionIndex(resumeAction.intent.reactionEmojiIndex);
      }
      clearPendingSocialGuestIntent(permalink.postId);
      return;
    }

    if (!pendingIntent.applied) {
      closeTopComposer();
      setTopReplyDraft("");
      setPendingAutoReactionIndex(null);
    }
  }, [permalink?.canInteract, permalink?.postId]);

  useEffect(() => {
    let cancelled = false;

    async function loadComments(): Promise<void> {
      if (!permalink?.postId || permalink.accessState !== "allowed") {
        return;
      }

      const requesterAddress = readRequesterAddressFromStorage();
      if (!requesterAddress) {
        setLocalReplies([]);
        return;
      }
      const requesterAddressNormalized = normalizePublicAddress(requesterAddress);
      const response = await getSocialCommentsPage(
        permalink.postId,
        requesterAddress,
        !!requesterAddress,
        10
      );

      if (cancelled || !response.success) {
        return;
      }

      const uniqueAddresses = Array.from(
        new Set(
          response.comments
            .map((entry) => normalizePublicAddress(entry.authorPublicAddress))
            .filter((address) => address.length > 0 && address !== requesterAddressNormalized)
        )
      );
      const namesByAddress = new Map<string, string>();
      await Promise.all(
        uniqueAddresses.map(async (address) => {
          try {
            const identityResponse = await fetch(
              buildApiUrl(`/api/identity/check?address=${encodeURIComponent(address)}`),
              { method: "GET", cache: "no-store" }
            );
            const identityPayload = (await identityResponse.json()) as {
              exists?: boolean;
              identity?: { profileName?: string | null };
            };
            const profileName = identityPayload.identity?.profileName?.trim();
            if (profileName) {
              namesByAddress.set(address, profileName);
            }
          } catch {
            // Keep address fallback when identity lookup fails.
          }
        })
      );

      setLocalReplies(
        response.comments.map((entry) => ({
          id: entry.entryId,
          author:
            normalizePublicAddress(entry.authorPublicAddress) === requesterAddressNormalized
              ? "You"
              : namesByAddress.get(normalizePublicAddress(entry.authorPublicAddress)) ??
                (entry.authorPublicAddress
                  ? `${entry.authorPublicAddress.slice(0, 8)}...${entry.authorPublicAddress.slice(-6)}`
                  : "Unknown"),
          authorPublicAddress: entry.authorPublicAddress,
          reactionScopeId: entry.reactionScopeId,
          authorCommitment: entry.authorCommitment,
          time: entry.createdAtUnixMs ? new Date(entry.createdAtUnixMs).toLocaleString("en-GB") : "now",
          text: entry.content ?? "",
          createdAtMs: entry.createdAtUnixMs ?? Date.now(),
          followState: entry.followState,
        }))
      );
    }

    void loadComments();

    return () => {
      cancelled = true;
    };
  }, [permalink?.accessState, permalink?.postId, followRefreshNonce]);

  const savePermalinkDraft = () => {
    if (!permalink?.postId) {
      return;
    }

    savePendingSocialThreadDraft({
      postId: permalink.postId,
      mode: "top-level",
      draft: topReplyDraft,
      targetReplyId: null,
      threadRootId: null,
      source: "permalink",
      createdAtMs: Date.now(),
    });
  };

  const submitTopLevelReply = async () => {
    const trimmed = topReplyDraft.trim();
    if (!trimmed || !permalink?.postId) {
      return;
    }

    const result = await createSocialThreadEntry(permalink.postId, trimmed, topReplyTargetId ?? undefined);
    const entryId = result.entryId;
    if (!result.success || !entryId) {
      return;
    }

    setLocalReplies((current) => [
      {
        id: entryId,
        author: "You",
        authorPublicAddress: readRequesterAddressFromStorage() ?? undefined,
        reactionScopeId: permalink.reactionScopeId ?? permalink.postId ?? routePostId,
        time: "now",
        text: trimmed,
        createdAtMs: Date.now(),
        followState: undefined,
      },
      ...current,
    ]);
    setTopReplyDraft("");
    closeTopComposer();
    clearPendingSocialThreadDraft(permalink.postId);
  };

  useEffect(() => {
    if (!permalink || permalink.accessState !== "allowed") {
      return;
    }

    const attachmentCount = permalink.attachments.length;
    if (attachmentCount <= 1) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setActiveMediaIndex((current) => Math.max(0, current - 1));
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setActiveMediaIndex((current) => Math.min(attachmentCount - 1, current + 1));
        return;
      }

      if (event.key === "Escape" && isTopComposerOpen) {
        event.preventDefault();
        closeTopComposer();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isTopComposerOpen, permalink]);

  if (isLoading) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-10" data-testid="social-permalink-loading">
        <p className="text-sm text-hush-text-accent">Loading post...</p>
      </section>
    );
  }

  if (!permalink || permalink.accessState === "guest_denied") {
    return (
      <section className="mx-auto max-w-2xl px-4 py-10" data-testid="social-permalink-guest">
        <h1 className="text-xl font-semibold text-hush-text-primary">This post is in HushSocial</h1>
        <p className="mt-2 text-sm text-hush-text-accent">
          Create your HushNetwork account to view this content.
        </p>
        <Link
          href={getAuthRoute(getSocialPostRoute(routePostId))}
          className="mt-4 inline-flex rounded-md bg-hush-purple px-4 py-2 text-sm font-semibold text-hush-bg-dark"
          data-testid="social-permalink-guest-cta"
        >
          Create account and continue
        </Link>
      </section>
    );
  }

  if (permalink.accessState === "unauthorized_denied" || permalink.accessState === "not_found") {
    return (
      <section className="mx-auto max-w-2xl px-4 py-10" data-testid="social-permalink-denied">
        <h1 className="text-xl font-semibold text-hush-text-primary">You do not have permission to view this post</h1>
        <p className="mt-2 text-sm text-hush-text-accent">
          Ask the post owner to grant you access.
        </p>
        <Link
          href="/social"
          className="mt-4 inline-flex rounded-md border border-hush-bg-hover px-4 py-2 text-sm text-hush-text-accent"
          data-testid="social-permalink-denied-cta"
        >
          Back to HushSocial
        </Link>
      </section>
    );
  }

  const createdAtLabel =
    permalink.createdAtUnixMs && permalink.createdAtUnixMs > 0
      ? new Date(permalink.createdAtUnixMs).toLocaleString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      : permalink.createdAtBlock
        ? `Confirmed at block ${permalink.createdAtBlock}`
        : "Confirmed";
  const requesterForMedia = readRequesterAddressFromStorage();
  const requesterAddressNormalized = normalizePublicAddress(requesterForMedia);
  const isAuthenticatedViewer = requesterAddressNormalized.length > 0;
  const getEffectiveFollowState = (
    authorPublicAddress: string | undefined,
    followState: SocialAuthorFollowStateContract | undefined
  ) => {
    const normalizedAuthorAddress = normalizePublicAddress(authorPublicAddress);
    if (!normalizedAuthorAddress) {
      return followState;
    }

    return followStateOverrides[normalizedAuthorAddress] ?? followState;
  };

  const getFollowButtonState = (
    authorPublicAddress: string | undefined,
    followState: SocialAuthorFollowStateContract | undefined
  ) => {
    const normalizedAuthorAddress = normalizePublicAddress(authorPublicAddress);
    return resolveSocialFollowButtonState(
      isAuthenticatedViewer,
      getEffectiveFollowState(authorPublicAddress, followState),
      normalizedAuthorAddress.length > 0 && pendingFollowAuthors[normalizedAuthorAddress] === true
    );
  };

  const submitFollowAuthor = async (
    authorPublicAddress: string | undefined,
    followState: SocialAuthorFollowStateContract | undefined
  ) => {
    if (!requesterForMedia) {
      setFollowError("Failed to follow author.");
      return;
    }

    const normalizedAuthorAddress = normalizePublicAddress(authorPublicAddress);
    if (!normalizedAuthorAddress || getFollowButtonState(authorPublicAddress, followState) !== "follow") {
      return;
    }

    setFollowError(null);
    setPendingFollowAuthors((current) => ({ ...current, [normalizedAuthorAddress]: true }));

    try {
      const result = await followSocialAuthor({
        viewerPublicAddress: requesterForMedia,
        authorPublicAddress: authorPublicAddress!.trim(),
        requesterPublicAddress: requesterForMedia,
      });

      if (!result.success) {
        if (result.requiresSyncRefresh || result.alreadyFollowing) {
          await triggerSyncNow();
          setFollowRefreshNonce((current) => current + 1);
        }
        setFollowError(result.message || "Failed to follow author.");
        return;
      }

      setFollowStateOverrides((current) => ({
        ...current,
        [normalizedAuthorAddress]: { isFollowing: true, canFollow: false },
      }));
      if (result.requiresSyncRefresh) {
        await triggerSyncNow();
      }
      setFollowRefreshNonce((current) => current + 1);
    } finally {
      setPendingFollowAuthors((current) => {
        const next = { ...current };
        delete next[normalizedAuthorAddress];
        return next;
      });
    }
  };

  return (
    <section className="h-full w-full overflow-y-auto p-4" data-testid="social-permalink-layout">
      <div className="h-full w-full" data-testid="social-permalink-public">
        <Link
          href="/social"
          className="inline-flex items-center rounded-md px-2 py-1 text-xs text-hush-text-accent hover:bg-hush-bg-hover"
          data-testid="social-permalink-back-to-feedwall"
        >
          {"<- To FeedWall"}
        </Link>

        <article className="mt-3 w-full min-h-[calc(100%-2rem)] rounded-xl border border-hush-bg-hover bg-hush-bg-dark p-4" data-testid="social-permalink-post-card">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="min-w-0 flex items-center gap-2">
              <p className="text-sm font-semibold text-hush-text-primary" data-testid="social-permalink-author-name">
                {authorName}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <FollowAuthorButton
                state={getFollowButtonState(permalink.authorPublicAddress, permalink.followState)}
                testId="social-permalink-follow-author"
                onClick={() => void submitFollowAuthor(permalink.authorPublicAddress, permalink.followState)}
              />
              <span className="text-xs text-hush-text-accent" data-testid="social-permalink-confirmed-at">
                {createdAtLabel}
              </span>
            </div>
          </div>

          {followError ? (
            <p className="mb-2 text-xs text-red-300" data-testid="social-permalink-follow-error">
              {followError}
            </p>
          ) : null}

          <p className="text-sm text-hush-text-accent whitespace-pre-wrap" data-testid="social-permalink-content">
            {permalink.content}
          </p>

          {permalink.attachments.length > 0 && (
            <div className="mt-3" data-testid="social-permalink-media-container">
              {permalink.attachments.length === 1 ? (
                permalink.attachments[0].kind === "video" ? (
                  <video
                    controls
                    className="max-h-80 w-full rounded-md object-contain"
                    src={buildApiUrl(
                      `/api/social/posts/attachment?attachmentId=${encodeURIComponent(permalink.attachments[0].attachmentId)}&postId=${encodeURIComponent(permalink.postId ?? routePostId)}&isAuthenticated=${encodeURIComponent(String(!!requesterForMedia))}&requesterPublicAddress=${encodeURIComponent(requesterForMedia ?? "")}&mimeType=${encodeURIComponent(permalink.attachments[0].mimeType)}`
                    )}
                    data-testid={`social-permalink-video-${permalink.attachments[0].attachmentId}`}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={buildApiUrl(
                      `/api/social/posts/attachment?attachmentId=${encodeURIComponent(permalink.attachments[0].attachmentId)}&postId=${encodeURIComponent(permalink.postId ?? routePostId)}&isAuthenticated=${encodeURIComponent(String(!!requesterForMedia))}&requesterPublicAddress=${encodeURIComponent(requesterForMedia ?? "")}&mimeType=${encodeURIComponent(permalink.attachments[0].mimeType)}`
                    )}
                    alt={permalink.attachments[0].fileName}
                    className="max-h-80 w-full rounded-md object-contain"
                    data-testid={`social-permalink-image-${permalink.attachments[0].attachmentId}`}
                  />
                )
              ) : (
                <ContentCarousel
                  ariaLabel="Permalink media"
                  goToIndex={activeMediaIndex}
                  onIndexChange={setActiveMediaIndex}
                >
                  {permalink.attachments.map((attachment) => (
                    <div key={attachment.attachmentId} className="overflow-hidden rounded-lg border border-hush-bg-hover bg-black/20 p-1">
                      {attachment.kind === "video" ? (
                        <video
                          controls
                          className="max-h-80 w-full rounded-md object-contain"
                          src={buildApiUrl(
                            `/api/social/posts/attachment?attachmentId=${encodeURIComponent(attachment.attachmentId)}&postId=${encodeURIComponent(permalink.postId ?? routePostId)}&isAuthenticated=${encodeURIComponent(String(!!requesterForMedia))}&requesterPublicAddress=${encodeURIComponent(requesterForMedia ?? "")}&mimeType=${encodeURIComponent(attachment.mimeType)}`
                          )}
                          data-testid={`social-permalink-video-${attachment.attachmentId}`}
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={buildApiUrl(
                            `/api/social/posts/attachment?attachmentId=${encodeURIComponent(attachment.attachmentId)}&postId=${encodeURIComponent(permalink.postId ?? routePostId)}&isAuthenticated=${encodeURIComponent(String(!!requesterForMedia))}&requesterPublicAddress=${encodeURIComponent(requesterForMedia ?? "")}&mimeType=${encodeURIComponent(attachment.mimeType)}`
                          )}
                          alt={attachment.fileName}
                          className="max-h-80 w-full rounded-md object-contain"
                          data-testid={`social-permalink-image-${attachment.attachmentId}`}
                        />
                      )}
                    </div>
                  ))}
                </ContentCarousel>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="social-permalink-actions">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-hush-text-accent hover:bg-hush-bg-hover"
              data-testid="social-permalink-comment"
              onClick={() => {
                if (!permalink.canInteract && permalink.circleFeedIds.length === 0) {
                  savePermalinkDraft();
                  setShowAuthOverlay(true);
                  return;
                }

                openTopComposer();
              }}
            >
              {isAuthenticatedViewer ? `Reply (${localReplies.length})` : "Reply"}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-hush-text-accent hover:bg-hush-bg-hover"
              data-testid="social-permalink-link"
            >
              Get Link
            </button>
            <span
              className="rounded-full border border-hush-purple/40 bg-hush-purple/10 px-2 py-0.5 text-[11px] text-hush-purple"
              data-testid="social-permalink-audience-badge"
            >
              {permalink.circleFeedIds.length > 0 ? "Private" : "Public"}
            </span>
          </div>

          <SocialPostReactions
            postId={permalink.postId ?? routePostId}
            reactionScopeId={permalink.reactionScopeId}
            visibility={permalink.circleFeedIds.length > 0 ? "private" : "open"}
            circleFeedIds={permalink.circleFeedIds}
            authorCommitment={permalink.authorCommitment}
            isOwnMessage={normalizePublicAddress(permalink.authorPublicAddress) === requesterAddressNormalized}
            canInteract={permalink.canInteract}
            testIdPrefix="social-permalink-reactions"
            pendingAutoReactionIndex={pendingAutoReactionIndex}
            onPendingAutoReactionHandled={() => setPendingAutoReactionIndex(null)}
            onRequireAccount={(reactionEmojiIndex) => {
              if (typeof reactionEmojiIndex === "number" && permalink?.postId) {
                savePendingSocialGuestIntent({
                  postId: permalink.postId,
                  returnTo: getSocialPostRoute(permalink.postId),
                  interactionType: "reaction",
                  reactionEmojiIndex,
                  source: "permalink",
                  createdAtMs: Date.now(),
                });
              } else {
                savePermalinkDraft();
              }
              setShowAuthOverlay(true);
            }}
          />

          {isTopComposerOpen ? (
            <div className="mt-3 rounded-lg border border-hush-bg-hover p-3" data-testid="social-permalink-composer-top">
              <p className="mb-2 text-[11px] text-hush-text-accent" data-testid="social-permalink-composer-context">
                {topReplyTargetId
                  ? `Replying in thread${topReplyThreadRootId ? ` (${topReplyThreadRootId})` : ""}`
                  : "Replying to post"}
              </p>
              <textarea
                className="w-full min-h-24 rounded-md border border-hush-bg-hover bg-hush-bg-dark px-3 py-2 text-sm text-hush-text-primary outline-none focus:border-hush-purple"
                value={topReplyDraft}
                onChange={(event) => setTopReplyDraft(event.currentTarget.value)}
                data-testid="social-permalink-composer-input"
                placeholder="Write your reply..."
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    closeTopComposer();
                    return;
                  }

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
                  data-testid="social-permalink-composer-send"
                >
                  Reply
                </button>
              </div>
            </div>
          ) : null}

          {isAuthenticatedViewer ? (
            <>
              <p className="mt-3 text-sm font-semibold text-hush-text-primary" data-testid="social-permalink-replies-title">
                Replies ({localReplies.length})
              </p>
              <div className="mt-2 space-y-2" data-testid="social-permalink-replies-list">
                {localReplies.length === 0 ? (
                  <div
                    className="rounded-lg border border-dashed border-hush-bg-hover bg-hush-bg-dark/40 px-4 py-5 text-sm text-hush-text-accent"
                    data-testid="social-permalink-replies-empty"
                  >
                    {permalink.canInteract
                      ? "No comments yet. Start the conversation from this permalink."
                      : "No comments yet. Create your account to reply from this permalink."}
                  </div>
                ) : null}
                {localReplies.map((reply) => (
                  <div
                    key={reply.id}
                    className="rounded-lg border border-hush-bg-hover p-3"
                    data-testid={`social-permalink-reply-${reply.id}`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="min-w-0 text-xs font-semibold text-hush-text-primary">{reply.author}</p>
                      <div className="flex shrink-0 items-center gap-2">
                        <FollowAuthorButton
                          state={getFollowButtonState(reply.authorPublicAddress, reply.followState)}
                          testId={`social-permalink-follow-reply-${reply.id}`}
                          onClick={() => void submitFollowAuthor(reply.authorPublicAddress, reply.followState)}
                        />
                        <span className="text-[10px] text-hush-text-accent">{reply.time}</span>
                      </div>
                    </div>
                    <p className="text-xs text-hush-text-accent">{reply.text}</p>
                    <SocialPostReactions
                      postId={reply.id}
                      reactionMessageId={reply.id}
                      reactionScopeId={reply.reactionScopeId ?? permalink.reactionScopeId ?? permalink.postId ?? routePostId}
                      visibility={permalink.circleFeedIds.length > 0 ? "private" : "open"}
                      circleFeedIds={permalink.circleFeedIds}
                      authorCommitment={reply.authorCommitment}
                      isOwnMessage={normalizePublicAddress(reply.authorPublicAddress) === requesterAddressNormalized}
                      canInteract={permalink.canInteract}
                      testIdPrefix={`social-permalink-reply-reactions-${reply.id}`}
                      onRequireAccount={(reactionEmojiIndex) => {
                        if (typeof reactionEmojiIndex === "number" && permalink.postId) {
                          savePendingSocialGuestIntent({
                            postId: permalink.postId,
                            returnTo: getSocialPostRoute(permalink.postId),
                            interactionType: "reaction",
                            reactionEmojiIndex,
                            source: "permalink",
                            createdAtMs: Date.now(),
                          });
                        }
                        setShowAuthOverlay(true);
                      }}
                    />
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </article>
      </div>
      {showAuthOverlay ? (
        <SocialAuthPromptOverlay
          onClose={() => setShowAuthOverlay(false)}
          returnTo={getSocialPostRoute(permalink?.postId ?? routePostId)}
        />
      ) : null}
    </section>
  );
}
