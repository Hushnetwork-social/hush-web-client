"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { AlertCircle, Check, Link2, Loader2, MessageCircle, SmilePlus, Sparkles, X } from "lucide-react";
import { buildApiUrl } from "@/lib/api-config";
import { useAppStore } from "@/stores";
import { useFeedsStore } from "@/modules/feeds/useFeedsStore";
import { useBlockchainStore } from "@/modules/blockchain";
import { useSyncContext } from "@/lib/sync";
import { SystemToastContainer } from "@/components/notifications/SystemToast";
import { addMembersToCustomCircle, createCustomCircle } from "@/modules/feeds/FeedsService";
import { checkIdentityExists } from "@/modules/identity/IdentityService";
import type { CustomCircleMemberPayload } from "@/lib/crypto";
import { createSocialPost } from "@/modules/social/SocialService";
import { getSocialFeedWall } from "@/modules/social/FeedWallService";
import { computeSha256 } from "@/lib/attachments/attachmentHash";
import { ContentCarousel } from "@/components/chat/ContentCarousel";
import { SocialAuthPromptOverlay } from "@/components/social/SocialAuthPromptOverlay";
import { SocialPostReactions } from "@/components/social/SocialPostReactions";
import { SocialPostComposerCard } from "./components/SocialPostComposerCard";
import { usePostPermalink } from "./hooks/usePostPermalink";

const SOCIAL_MENU_IDS = new Set([
  "search",
  "new-post",
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
const POST_PREVIEW_MAX_LINES = 5;
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
  reactionScopeId?: string;
  authorPublicAddress: string;
  authorCommitment?: string;
  author: string;
  time: string;
  createdAtBlock: number;
  visibility: "open" | "private";
  circleFeedIds: string[];
  confirmedAtMs: number | null;
  confirmedAtText: string;
  confirmationState: "pending" | "confirmed";
  text: string;
  replyCount: number;
  reactions: Record<string, number>;
  replies: ReplyItem[];
  attachments: PostMediaItem[];
};

type FollowingItem = {
  publicAddress: string;
  displayName: string;
  circles: string[];
};

type CircleItem = {
  feedId: string;
  name: string;
  isInnerCircle: boolean;
  members: string[];
  memberCount: number;
};

type UiToast = {
  id: string;
  message: string;
};

type PendingCircleAssignment = {
  circleFeedId: string;
  circleName: string;
  memberAddress: string;
  memberDisplayName: string;
  createdAtMs: number;
};

type DraftMediaItem = {
  id: string;
  kind: "image" | "video";
  label: string;
  sizeMb: number;
  sizeBytes: number;
  mimeType: string;
  fileName: string;
  hash: string;
  previewUrl: string;
  rawBytes: Uint8Array;
};

type PostMediaItem = {
  id: string;
  kind: "image" | "video";
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  previewUrl: string;
};

const MAX_MEDIA_ATTACHMENTS = 4;
const MAX_MEDIA_SIZE_MB = 25;
const MAX_MEDIA_SIZE_BYTES = MAX_MEDIA_SIZE_MB * 1024 * 1024;
const FEED_WALL_TIMESTAMP_CACHE_KEY = "hush.social.feedwall.confirmedAtMs.v1";

function formatConfirmedAt(value: Date): string {
  return value.toLocaleString();
}

function formatRelativeTime(value: Date | number): string {
  const timestampMs = value instanceof Date ? value.getTime() : value;
  const deltaMs = Date.now() - timestampMs;
  return formatRelativeDuration(deltaMs);
}

function formatRelativeDuration(deltaMs: number): string {
  if (!Number.isFinite(deltaMs) || deltaMs < 0) {
    return "now";
  }

  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (deltaMs < minuteMs) {
    return "now";
  }

  if (deltaMs < hourMs) {
    const minutes = Math.floor(deltaMs / minuteMs);
    return `${minutes}m ago`;
  }

  if (deltaMs < dayMs) {
    const hours = Math.floor(deltaMs / hourMs);
    return `${hours}h ago`;
  }

  const days = Math.floor(deltaMs / dayMs);
  if (days < 7) {
    return `${days}d ago`;
  }

  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }

  if (days < 365) {
    const months = Math.floor(days / 30);
    return months <= 1 ? "1 month ago" : `${months} months ago`;
  }

  const years = Math.floor(days / 365);
  return years <= 1 ? "1 year ago" : `${years} years ago`;
}

function formatRelativeTimeFromBlockAge(createdAtBlock: number, currentBlockHeight: number): string | null {
  if (createdAtBlock <= 0 || currentBlockHeight <= 0 || currentBlockHeight < createdAtBlock) {
    return null;
  }

  // HushServerNode block production interval defaults to 3 seconds.
  const elapsedMs = (currentBlockHeight - createdAtBlock) * 3000;
  return formatRelativeDuration(elapsedMs);
}

function readFeedWallTimestampCache(): Record<string, number> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(FEED_WALL_TIMESTAMP_CACHE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const normalized: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        normalized[key] = value;
      }
    }
    return normalized;
  } catch {
    return {};
  }
}

function writeFeedWallTimestampCache(cache: Record<string, number>): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(FEED_WALL_TIMESTAMP_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore cache persistence errors; UI still works without this.
  }
}

function getPostPreview(text: string): { previewText: string; isTruncated: boolean } {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  if (lines.length > POST_PREVIEW_MAX_LINES) {
    return {
      previewText: lines.slice(0, POST_PREVIEW_MAX_LINES).join("\n"),
      isTruncated: true,
    };
  }

  if (normalized.length > POST_PREVIEW_LIMIT) {
    return {
      previewText: normalized.slice(0, POST_PREVIEW_LIMIT),
      isTruncated: true,
    };
  }

  return {
    previewText: normalized,
    isTruncated: false,
  };
}

function resolveViewState(rawState: string | null): ViewState {
  if (rawState === "loading" || rawState === "empty" || rawState === "error") {
    return rawState;
  }
  return "populated";
}

function getDisplayInitials(value: string): string {
  const trimmed = value
    .replace(/\([^)]*\)/g, " ")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!trimmed) {
    return "?";
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function normalizeCircleName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function isInnerCircleName(name: string): boolean {
  const normalized = normalizeCircleName(name);
  const compact = normalized.replace(/\s+/g, "");
  return normalized === "inner circle" || compact === "innercircle";
}

function normalizePublicAddress(address?: string | null): string {
  return (address ?? "").trim().toLowerCase();
}

function normalizeFeedId(feedId?: string | null): string {
  return (feedId ?? "").trim().toLowerCase();
}

function detectMediaKindFromMime(mimeType: string): "image" | "video" | null {
  const normalizedMime = mimeType.trim().toLowerCase();
  if (normalizedMime.startsWith("image/")) {
    return "image";
  }

  if (normalizedMime.startsWith("video/")) {
    return "video";
  }

  return null;
}

function toMediaSizeMb(sizeBytes: number): number {
  return Math.round((sizeBytes / (1024 * 1024)) * 10) / 10;
}

async function readFileBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === "function") {
    const buffer = await file.arrayBuffer();
    return new Uint8Array(buffer);
  }

  // Fallback used by some test/browser environments where File#arrayBuffer is unavailable.
  const buffer = await new Response(file).arrayBuffer();
  return new Uint8Array(buffer);
}

function isCircleFeed(feedName: string, feedDescription?: string): boolean {
  if (isInnerCircleName(feedName)) {
    return true;
  }

  const normalizedDescription = (feedDescription ?? "").trim().toLowerCase();
  return (
    normalizedDescription === "owner-managed custom circle" ||
    normalizedDescription === "auto-managed inner circle"
  );
}

function logSocialDrag(event: string, payload: Record<string, unknown>): void {
  console.info(`[SocialDnD] ${event}`, payload);
}

export default function SocialPage() {
  const [queryViewState, setQueryViewState] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return new URLSearchParams(window.location.search).get("state");
  });
  const appContexts = useAppStore((state) => state.appContexts);
  const selectedNav = useAppStore((state) => state.selectedNav);
  const setSelectedNav = useAppStore((state) => state.setSelectedNav);
  const setAppContextScroll = useAppStore((state) => state.setAppContextScroll);
  const innerCircleSync = useAppStore((state) => state.innerCircleSync);
  const requestInnerCircleRetry = useAppStore((state) => state.requestInnerCircleRetry);
  const credentials = useAppStore((state) => state.credentials);
  const currentUser = useAppStore((state) => state.currentUser);
  const currentBlockHeight = useBlockchainStore((state) => state.blockHeight);
  const { triggerSyncNow } = useSyncContext();
  const feeds = useFeedsStore((state) => state.feeds);
  const groupMembers = useFeedsStore((state) => state.groupMembers);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [activePostMediaIndex, setActivePostMediaIndex] = useState(0);
  const [topReplyDraft, setTopReplyDraft] = useState("");
  const [isTopComposerOpen, setIsTopComposerOpen] = useState(false);
  const [inlineReplyDraft, setInlineReplyDraft] = useState("");
  const [inlineComposerTargetId, setInlineComposerTargetId] = useState<string | null>(null);
  const [inlineComposerRootId, setInlineComposerRootId] = useState<string | null>(null);
  const [overlayReplies, setOverlayReplies] = useState<ReplyItem[]>([]);
  const [pointerDragMemberAddress, setPointerDragMemberAddress] = useState<string | null>(null);
  const [selectedMemberAddress, setSelectedMemberAddress] = useState<string | null>(null);
  const [creatingCircle, setCreatingCircle] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createCircleNameDraft, setCreateCircleNameDraft] = useState("");
  const [createCircleError, setCreateCircleError] = useState<string | null>(null);
  const [pendingCircleMembers, setPendingCircleMembers] = useState<Record<string, string[]>>({});
  const [pendingAssignments, setPendingAssignments] = useState<Record<string, PendingCircleAssignment>>({});
  const [uiToasts, setUiToasts] = useState<UiToast[]>([]);
  const [renderFollowingItems, setRenderFollowingItems] = useState<FollowingItem[]>([]);
  const [renderCircleItems, setRenderCircleItems] = useState<CircleItem[]>([]);
  const [newPostDraft, setNewPostDraft] = useState("");
  const [postAudience, setPostAudience] = useState<"public" | "close">("close");
  const [includeInnerCircleForPost, setIncludeInnerCircleForPost] = useState(true);
  const [selectedCustomCircleIdsForPost, setSelectedCustomCircleIdsForPost] = useState<string[]>([]);
  const [newPostAudienceError, setNewPostAudienceError] = useState<string | null>(null);
  const [isFeedComposerExpanded, setIsFeedComposerExpanded] = useState(false);
  const [draftMediaItems, setDraftMediaItems] = useState<DraftMediaItem[]>([]);
  const [newPostMediaError, setNewPostMediaError] = useState<string | null>(null);
  const [feedWallPosts, setFeedWallPosts] = useState<PostItem[]>([]);
  const [showAuthOverlay, setShowAuthOverlay] = useState(false);
  const authorNamesByAddressRef = useRef<Record<string, string>>({});
  const mediaPreviewUrlsRef = useRef<Set<string>>(new Set());
  const [isFeedWallLoading, setIsFeedWallLoading] = useState(true);
  const feedWallRegionRef = useRef<HTMLElement | null>(null);
  const activePostDialogRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedSocialNavRef = useRef(false);
  const ownDisplayName = currentUser?.displayName?.trim() || "You";
  const ownAuthorLabel = `${ownDisplayName} (YOU)`;
  const ownAddressNormalized = normalizePublicAddress(credentials?.signingPublicKey ?? "");
  const ownInitials = currentUser?.initials?.trim() || getDisplayInitials(ownDisplayName);
  const circleNameByFeedId = useMemo(() => {
    const lookup = new Map<string, string>();
    for (const circle of renderCircleItems) {
      lookup.set(normalizeFeedId(circle.feedId), circle.name);
    }
    for (const feed of feeds) {
      if (!isCircleFeed(feed.name, feed.description)) {
        continue;
      }
      const normalizedId = normalizeFeedId(feed.id);
      if (!lookup.has(normalizedId)) {
        lookup.set(normalizedId, isInnerCircleName(feed.name) ? "Inner Circle" : feed.name);
      }
    }
    return lookup;
  }, [renderCircleItems, feeds]);

  useEffect(() => {
    const previewUrls = mediaPreviewUrlsRef.current;
    return () => {
      for (const previewUrl of previewUrls) {
        URL.revokeObjectURL(previewUrl);
      }
      previewUrls.clear();
    };
  }, []);

  useEffect(() => {
    if (hasInitializedSocialNavRef.current) {
      return;
    }

    hasInitializedSocialNavRef.current = true;
    if (!SOCIAL_MENU_IDS.has(selectedNav)) {
      setSelectedNav("feed-wall");
    }
  }, [selectedNav, setSelectedNav]);

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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const nextState = new URLSearchParams(window.location.search).get("state");
    setQueryViewState((current) => (current === nextState ? current : nextState));
  }, []);

  const viewState = useMemo(() => resolveViewState(queryViewState), [queryViewState]);
  const activePost = useMemo(() => feedWallPosts.find((post) => post.id === activePostId) ?? null, [activePostId, feedWallPosts]);
  const followingItems = useMemo<FollowingItem[]>(() => {
    const ownAddress = credentials?.signingPublicKey;
    const circleFeeds = feeds.filter((feed) => feed.type === "group" && isCircleFeed(feed.name, feed.description));
    const followedByAddress = new Map<string, FollowingItem>();

    for (const feed of feeds) {
      if (feed.type !== "chat") {
        continue;
      }

      const otherParticipant =
        feed.otherParticipantPublicSigningAddress ??
        feed.participants.find((participant) => participant !== ownAddress);
      if (!otherParticipant) {
        continue;
      }
      const normalizedOtherParticipant = normalizePublicAddress(otherParticipant);

      const circleNames = circleFeeds
        .filter((circleFeed) => {
          const members =
            groupMembers[circleFeed.id]?.map((member) => normalizePublicAddress(member.publicAddress)) ??
            circleFeed.participants.map((participant) => normalizePublicAddress(participant));
          return members.includes(normalizedOtherParticipant);
        })
        .map((circleFeed) => (isInnerCircleName(circleFeed.name) ? "Inner Circle" : circleFeed.name))
        .filter((name): name is string => Boolean(name));

      const entry = followedByAddress.get(normalizedOtherParticipant);
      if (entry) {
        for (const circleName of circleNames) {
          if (!entry.circles.includes(circleName)) {
            entry.circles.push(circleName);
          }
        }
        continue;
      }

      followedByAddress.set(normalizedOtherParticipant, {
        publicAddress: normalizedOtherParticipant,
        displayName: feed.name || `${normalizedOtherParticipant.slice(0, 8)}...${normalizedOtherParticipant.slice(-6)}`,
        circles: circleNames.length > 0 ? circleNames : ["Not in circle yet"],
      });
    }

    return Array.from(followedByAddress.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [credentials?.signingPublicKey, feeds, groupMembers]);

  const circleItems = useMemo<CircleItem[]>(() => {
    const ownAddress = credentials?.signingPublicKey;
    const normalizedOwnAddress = ownAddress ? normalizePublicAddress(ownAddress) : null;
    const groupFeeds = feeds.filter((feed) => {
      if (feed.type !== "group") {
        return false;
      }

      if (isCircleFeed(feed.name, feed.description)) {
        return true;
      }

      return false;
    });

    const allCircles = groupFeeds.map((feed) => {
      const members =
        groupMembers[feed.id]?.map((member) => normalizePublicAddress(member.publicAddress)) ??
        feed.participants.map((participant) => normalizePublicAddress(participant));
      const uniqueMembers = Array.from(new Set(members.filter((member) => member !== normalizedOwnAddress)));
      const isInnerCircle = isInnerCircleName(feed.name);

      return {
        feedId: feed.id,
        name: isInnerCircle ? "Inner Circle" : feed.name,
        isInnerCircle,
        members: uniqueMembers,
        memberCount: uniqueMembers.length,
      };
    });

    const hasInnerCircle = allCircles.some((circle) => circle.isInnerCircle);
    if (!hasInnerCircle) {
      allCircles.push({
        feedId: "inner-circle-pending",
        name: "Inner Circle",
        isInnerCircle: true,
        members: [],
        memberCount: 0,
      });
    }

    return allCircles.sort((left, right) => {
      if (left.memberCount !== right.memberCount) {
        return right.memberCount - left.memberCount;
      }
      if (left.isInnerCircle !== right.isInnerCircle) {
        return left.isInnerCircle ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    });
  }, [credentials?.signingPublicKey, feeds, groupMembers]);

  const followingSignature = useMemo(
    () =>
      followingItems
        .map((item) => `${item.publicAddress}:${item.displayName}:${item.circles.join(",")}`)
        .join("|"),
    [followingItems]
  );

  const circlesSignature = useMemo(
    () =>
      circleItems
        .map((circle) => `${circle.feedId}:${circle.name}:${circle.memberCount}:${circle.members.join(",")}`)
        .join("|"),
    [circleItems]
  );

  const availableCustomCirclesForPost = useMemo(
    () => renderCircleItems.filter((circle) => !circle.isInnerCircle && circle.feedId !== "inner-circle-pending"),
    [renderCircleItems]
  );

  useEffect(() => {
    setRenderFollowingItems((current) => {
      const currentSignature = current
        .map((item) => `${item.publicAddress}:${item.displayName}:${item.circles.join(",")}`)
        .join("|");
      return currentSignature === followingSignature ? current : followingItems;
    });
  }, [followingItems, followingSignature]);

  useEffect(() => {
    setRenderCircleItems((current) => {
      const currentSignature = current
        .map((circle) => `${circle.feedId}:${circle.name}:${circle.memberCount}:${circle.members.join(",")}`)
        .join("|");
      return currentSignature === circlesSignature ? current : circleItems;
    });
  }, [circleItems, circlesSignature]);

  useEffect(() => {
    setPendingAssignments((current) => {
      const entries = Object.entries(current);
      if (entries.length === 0) {
        return current;
      }

      let changed = false;
      const nextAssignments: Record<string, PendingCircleAssignment> = {};
      const confirmed: PendingCircleAssignment[] = [];

      for (const [assignmentKey, assignment] of entries) {
        const circle = renderCircleItems.find((item) => item.feedId === assignment.circleFeedId);
        if (circle?.members.includes(assignment.memberAddress)) {
          changed = true;
          confirmed.push(assignment);
          continue;
        }
        nextAssignments[assignmentKey] = assignment;
      }

      if (confirmed.length > 0) {
        setPendingCircleMembers((pendingCurrent) => {
          const pendingNext = { ...pendingCurrent };
          for (const assignment of confirmed) {
            pendingNext[assignment.circleFeedId] = (pendingCurrent[assignment.circleFeedId] ?? []).filter(
              (address) => address !== assignment.memberAddress
            );
          }
          return pendingNext;
        });

        for (const assignment of confirmed) {
          addUiToast(`Member ${assignment.memberDisplayName} added to Circle ${assignment.circleName}`);
        }
      }

      return changed ? nextAssignments : current;
    });
  }, [renderCircleItems]);

  useEffect(() => {
    if (Object.keys(pendingAssignments).length === 0) {
      return;
    }

    const timeoutMs = 45000;
    const intervalId = window.setInterval(() => {
      const now = Date.now();
      setPendingAssignments((current) => {
        const entries = Object.entries(current);
        if (entries.length === 0) {
          return current;
        }

        let changed = false;
        const nextAssignments: Record<string, PendingCircleAssignment> = {};
        const expired: PendingCircleAssignment[] = [];

        for (const [assignmentKey, assignment] of entries) {
          if (now - assignment.createdAtMs > timeoutMs) {
            changed = true;
            expired.push(assignment);
            continue;
          }
          nextAssignments[assignmentKey] = assignment;
        }

        if (expired.length > 0) {
          setPendingCircleMembers((pendingCurrent) => {
            const pendingNext = { ...pendingCurrent };
            for (const assignment of expired) {
              pendingNext[assignment.circleFeedId] = (pendingCurrent[assignment.circleFeedId] ?? []).filter(
                (address) => address !== assignment.memberAddress
              );
            }
            return pendingNext;
          });

          for (const assignment of expired) {
            addUiToast(`Transaction failed: timed out while adding ${assignment.memberDisplayName} to ${assignment.circleName}`);
          }
        }

        return changed ? nextAssignments : current;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [pendingAssignments]);

  useEffect(() => {
    if (!activePost) {
      setActivePostMediaIndex(0);
      setOverlayReplies([]);
      setTopReplyDraft("");
      setIsTopComposerOpen(false);
      setInlineReplyDraft("");
      setInlineComposerTargetId(null);
      setInlineComposerRootId(null);
      return;
    }

    setActivePostMediaIndex(0);
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
        return;
      }

      const attachmentCount = activePost.attachments?.length ?? 0;
      if (attachmentCount <= 1) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setActivePostMediaIndex((current) => Math.max(0, current - 1));
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setActivePostMediaIndex((current) => Math.min(attachmentCount - 1, current + 1));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activePost]);

  useEffect(() => {
    if (!activePost) {
      return;
    }

    const focusTarget = activePostDialogRef.current;
    if (!focusTarget) {
      return;
    }

    window.setTimeout(() => {
      focusTarget.focus();
    }, 0);
  }, [activePost]);

  useEffect(() => {
    if (!isFeedComposerExpanded || activePost) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFeedComposerExpanded(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFeedComposerExpanded, activePost]);

  const openPostDetail = (postId: string) => {
    setActivePostId(postId);
  };

  const handlePostCardClick = (event: MouseEvent<HTMLElement>, postId: string) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select, [data-post-interactive='true']")) {
      return;
    }

    if (typeof window !== "undefined") {
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) {
        return;
      }
    }

    openPostDetail(postId);
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

  const addUiToast = (message: string) => {
    const toastId = `toast-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    setUiToasts((current) => [...current, { id: toastId, message }]);
  };
  const { copyPostPermalink } = usePostPermalink({ onToast: addUiToast });

  const removeUiToast = (toastId: string) => {
    setUiToasts((current) => current.filter((toast) => toast.id !== toastId));
  };

  const handleGuestInteractiveAttempt = (visibility: PostItem["visibility"]) => {
    if (visibility !== "open" || credentials?.signingPublicKey) {
      return false;
    }

    setShowAuthOverlay(true);
    return true;
  };

  useEffect(() => {
    let cancelled = false;

    const refreshFeedWall = async () => {
      let result: Awaited<ReturnType<typeof getSocialFeedWall>>;
      try {
        result = await getSocialFeedWall(
          credentials?.signingPublicKey ?? null,
          !!credentials?.signingPublicKey,
          100
        );
      } catch {
        if (!cancelled) {
          setIsFeedWallLoading(false);
        }
        return;
      }

      if (!result.success) {
        if (!cancelled) {
          setIsFeedWallLoading(false);
        }
        return;
      }

      const ownAddress = normalizePublicAddress(credentials?.signingPublicKey ?? "");
      const fetchedAt = new Date();
      const cachedTimestamps = readFeedWallTimestampCache();
      const nextTimestampCache: Record<string, number> = { ...cachedTimestamps };
      const followedDisplayNameByAddress = new Map<string, string>();
      for (const item of renderFollowingItems) {
        followedDisplayNameByAddress.set(normalizePublicAddress(item.publicAddress), item.displayName);
      }

      const unresolvedAuthorAddresses = Array.from(
        new Set(
          result.posts
            .map((post) => normalizePublicAddress(post.authorPublicAddress))
            .filter(
              (address) =>
                address.length > 0 &&
                address !== ownAddress &&
                !followedDisplayNameByAddress.has(address) &&
                !authorNamesByAddressRef.current[address]
            )
        )
      );

      const fetchedAuthorNames: Record<string, string> = {};
      if (unresolvedAuthorAddresses.length > 0) {
        await Promise.all(
          unresolvedAuthorAddresses.map(async (address) => {
            try {
              const identity = await checkIdentityExists(address);
              const profileName = identity.profileName?.trim();
              if (profileName) {
                fetchedAuthorNames[address] = profileName;
              }
            } catch {
              // Keep address fallback when identity lookup fails.
            }
          })
        );

        if (!cancelled && Object.keys(fetchedAuthorNames).length > 0) {
          authorNamesByAddressRef.current = {
            ...authorNamesByAddressRef.current,
            ...fetchedAuthorNames,
          };
        }
      }

      if (cancelled) {
        return;
      }

      setFeedWallPosts((current) => {
        const serverPosts = result.posts.map((post) => {
          const authorPublicAddress = post.authorPublicAddress ?? "";
          const existing = current.find((item) => item.id === post.postId);
          const isOwnPost = normalizePublicAddress(authorPublicAddress) === ownAddress;
          const normalizedAuthorAddress = normalizePublicAddress(authorPublicAddress);
          const followedDisplayName = followedDisplayNameByAddress.get(normalizedAuthorAddress) ?? null;
          const resolvedAuthorName =
            followedDisplayName ??
            authorNamesByAddressRef.current[normalizedAuthorAddress] ??
            fetchedAuthorNames[normalizedAuthorAddress] ??
            `${authorPublicAddress.slice(0, 8)}...${authorPublicAddress.slice(-6)}`;
          const createdAtBlock = Number(post.createdAtBlock || 0);
          const createdAtUnixMs = Number(post.createdAtUnixMs || 0);
          const cachedConfirmedAtMs = nextTimestampCache[post.postId];
          const inferredFromBlockMs =
            currentBlockHeight > 0 && createdAtBlock > 0 && currentBlockHeight >= createdAtBlock
              ? fetchedAt.getTime() - (currentBlockHeight - createdAtBlock) * 3000
              : null;
          const confirmedAtMs =
            existing?.confirmationState === "confirmed" && existing.confirmedAtMs
              ? existing.confirmedAtMs
              : (createdAtUnixMs > 0 ? createdAtUnixMs : null) ||
                cachedConfirmedAtMs ||
                inferredFromBlockMs ||
                fetchedAt.getTime();

          nextTimestampCache[post.postId] = confirmedAtMs;
          const confirmedAtText =
            existing?.confirmationState === "confirmed"
              ? existing.confirmedAtText
              : formatConfirmedAt(fetchedAt);

          const attachmentItems = (post.attachments ?? []).map((attachment) => ({
            id: attachment.attachmentId,
            kind: attachment.kind,
            fileName: attachment.fileName,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.size,
            previewUrl: buildApiUrl(
              `/api/social/posts/attachment?attachmentId=${encodeURIComponent(attachment.attachmentId)}&postId=${encodeURIComponent(post.postId)}&isAuthenticated=${encodeURIComponent(String(!!credentials?.signingPublicKey))}&requesterPublicAddress=${encodeURIComponent(credentials?.signingPublicKey ?? "")}&mimeType=${encodeURIComponent(attachment.mimeType)}`
            ),
          }));

          return {
            id: post.postId,
            reactionScopeId: post.reactionScopeId,
            authorPublicAddress,
            authorCommitment: post.authorCommitment,
            author: isOwnPost
              ? ownAuthorLabel
              : resolvedAuthorName,
            time: confirmedAtText,
            createdAtBlock,
            visibility: post.visibility,
            circleFeedIds: [...post.circleFeedIds],
            confirmedAtMs,
            confirmedAtText,
            confirmationState: "confirmed" as const,
            text: post.content,
            replyCount: existing?.replyCount ?? 0,
            reactions: existing?.reactions ?? { ...EMPTY_REACTIONS },
            replies: existing?.replies ?? [],
            attachments: attachmentItems.length > 0 ? attachmentItems : existing?.attachments ?? [],
          };
        });

        const serverPostIds = new Set(serverPosts.map((post) => post.id));
        const pendingPosts = current.filter((post) => post.confirmationState === "pending" && !serverPostIds.has(post.id));
        return [...serverPosts, ...pendingPosts];
      });

      writeFeedWallTimestampCache(nextTimestampCache);

      setIsFeedWallLoading(false);
    };

    void refreshFeedWall();
    const intervalId = window.setInterval(() => {
      void refreshFeedWall();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [credentials?.signingPublicKey, ownAuthorLabel, renderFollowingItems, currentBlockHeight]);

  const getDisplayNameForAddress = (address: string) => {
    const normalizedAddress = normalizePublicAddress(address);
    return (
      renderFollowingItems.find((item) => normalizePublicAddress(item.publicAddress) === normalizedAddress)?.displayName ??
      authorNamesByAddressRef.current[normalizedAddress] ??
      `${normalizedAddress.slice(0, 8)}...${normalizedAddress.slice(-6)}`
    );
  };

  const isCircleAssignmentBlocked = (circle: CircleItem, memberAddress: string) => {
    const normalizedMemberAddress = normalizePublicAddress(memberAddress);
    const normalizedCircleMembers = circle.members.map((address) => normalizePublicAddress(address));
    const pending = (pendingCircleMembers[circle.feedId] ?? []).map((address) => normalizePublicAddress(address));
    return normalizedCircleMembers.includes(normalizedMemberAddress) || pending.includes(normalizedMemberAddress);
  };

  const resolveAnyDraggedMemberAddress = (): string | null => {
    if (pointerDragMemberAddress) {
      return pointerDragMemberAddress;
    }
    return null;
  };

  const assignMemberToCircle = async (memberAddress: string, circle: CircleItem) => {
    const normalizedMemberAddress = normalizePublicAddress(memberAddress);
    logSocialDrag("assign.start", {
      memberAddress: normalizedMemberAddress,
      circleFeedId: circle.feedId,
      circleName: circle.name,
    });
    if (circle.feedId === "inner-circle-pending") {
      logSocialDrag("assign.blocked.inner_circle_pending", {
        memberAddress: normalizedMemberAddress,
        circleFeedId: circle.feedId,
      });
      addUiToast("Transaction failed: Inner Circle is not available yet");
      return;
    }

    if (!credentials?.signingPublicKey || !credentials.signingPrivateKey) {
      logSocialDrag("assign.blocked.missing_credentials", {
        hasSigningPublicKey: Boolean(credentials?.signingPublicKey),
        hasSigningPrivateKey: Boolean(credentials?.signingPrivateKey),
      });
      addUiToast("Transaction failed: missing credentials");
      return;
    }

    if (isCircleAssignmentBlocked(circle, normalizedMemberAddress)) {
      logSocialDrag("assign.blocked.already_member_or_pending", {
        memberAddress: normalizedMemberAddress,
        circleFeedId: circle.feedId,
      });
      addUiToast(`Transaction failed: ${getDisplayNameForAddress(normalizedMemberAddress)} is already in ${circle.name}`);
      return;
    }

    const memberDisplayName = getDisplayNameForAddress(normalizedMemberAddress);
    const assignmentKey = `${circle.feedId}:${normalizedMemberAddress}`;
    setPendingCircleMembers((current) => ({
      ...current,
      [circle.feedId]: [...(current[circle.feedId] ?? []), normalizedMemberAddress],
    }));
    setPendingAssignments((current) => ({
      ...current,
      [assignmentKey]: {
        circleFeedId: circle.feedId,
        circleName: circle.name,
        memberAddress: normalizedMemberAddress,
        memberDisplayName,
        createdAtMs: Date.now(),
      },
    }));
    logSocialDrag("assign.submit_transaction", {
      memberAddress: normalizedMemberAddress,
      memberDisplayName,
      circleFeedId: circle.feedId,
      circleName: circle.name,
      assignmentKey,
    });
    addUiToast(`${memberDisplayName} is being added to Circle ${circle.name}`);

    try {
      const identity = await checkIdentityExists(memberAddress);
      if (!identity.exists || !identity.publicEncryptAddress) {
        throw new Error("member identity is missing encryption key");
      }

      const membersPayload: CustomCircleMemberPayload[] = [
        {
          PublicAddress: normalizedMemberAddress,
          PublicEncryptAddress: identity.publicEncryptAddress,
        },
      ];

      const result = await addMembersToCustomCircle(
        circle.feedId,
        credentials.signingPublicKey,
        membersPayload,
        credentials.signingPrivateKey
      );

      if (!result.success) {
        throw new Error(result.message || "backend rejected assignment");
      }
      await triggerSyncNow();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      addUiToast(`Transaction failed: ${message}`);
      setPendingAssignments((current) => {
        const next = { ...current };
        delete next[assignmentKey];
        return next;
      });
      setPendingCircleMembers((current) => ({
        ...current,
        [circle.feedId]: (current[circle.feedId] ?? []).filter(
          (address) => normalizePublicAddress(address) !== normalizedMemberAddress
        ),
      }));
    } finally {
      setSelectedMemberAddress(null);
      setPointerDragMemberAddress(null);
    }
  };

  useEffect(() => {
    if (!pointerDragMemberAddress) {
      return;
    }

    const clearPointerDrag = () => {
      setPointerDragMemberAddress(null);
    };

    window.addEventListener("mouseup", clearPointerDrag);
    return () => window.removeEventListener("mouseup", clearPointerDrag);
  }, [pointerDragMemberAddress]);

  const submitCreateCircle = async () => {
    if (!credentials?.signingPublicKey || !credentials.signingPrivateKey) {
      setCreateCircleError("Missing credentials");
      return;
    }

    setCreatingCircle(true);
    setCreateCircleError(null);
    const result = await createCustomCircle(
      credentials.signingPublicKey,
      createCircleNameDraft,
      credentials.signingPrivateKey
    );

    if (!result.success) {
      setCreateCircleError(result.message);
      addUiToast(`Transaction failed: ${result.message}`);
      setCreatingCircle(false);
      return;
    }

    addUiToast(`Circle ${createCircleNameDraft.trim()} creation transaction submitted`);
    setCreateCircleNameDraft("");
    await triggerSyncNow();
    setCreatingCircle(false);
    setIsCreateDialogOpen(false);
  };

  const resolveSelectedCircleNamesForPost = () => {
    if (postAudience === "public") {
      return [] as string[];
    }

    const selectedNames: string[] = [];
    if (includeInnerCircleForPost) {
      selectedNames.push("Inner Circle");
    }

    for (const customCircleId of selectedCustomCircleIdsForPost) {
      const customCircle = availableCustomCirclesForPost.find((circle) => circle.feedId === customCircleId);
      if (customCircle) {
        selectedNames.push(customCircle.name);
      }
    }

    return selectedNames;
  };

  const resolveAudienceBadgesForPost = (post: PostItem): string[] => {
    if (post.visibility === "open") {
      return ["Public"];
    }

    const isOwnPost = normalizePublicAddress(post.authorPublicAddress) === ownAddressNormalized;
    if (!isOwnPost) {
      return ["Private"];
    }

    const resolvedCircleBadges = post.circleFeedIds.flatMap((feedId) => {
      const circleName = circleNameByFeedId.get(normalizeFeedId(feedId));
      if (circleName) {
        return [circleName];
      }
      return [];
    });

    const uniqueBadges = Array.from(new Set(resolvedCircleBadges));
    return uniqueBadges.length > 0 ? uniqueBadges : ["Private"];
  };

  const renderPostMedia = (
    post: PostItem,
    testIdPrefix: string,
    options?: {
      goToIndex?: number;
      onIndexChange?: (index: number) => void;
    }
  ) => {
    if (!post.attachments || post.attachments.length === 0) {
      return null;
    }

    const mediaItems = post.attachments.map((attachment) => (
      <div
        key={`${post.id}-media-${attachment.id}`}
        className="overflow-hidden rounded-md border border-hush-bg-hover bg-hush-bg-dark/40 p-1"
      >
        {attachment.kind === "video" ? (
          <video
            src={attachment.previewUrl}
            controls
            className="max-h-80 w-full rounded-md object-contain"
            data-testid={`${testIdPrefix}-video-${attachment.id}`}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={attachment.previewUrl}
            alt={attachment.fileName}
            className="max-h-80 w-full rounded-md object-contain"
            data-testid={`${testIdPrefix}-image-${attachment.id}`}
          />
        )}
      </div>
    ));

    return (
      <div className="mt-3" data-testid={`${testIdPrefix}-container`}>
        {mediaItems.length === 1 ? (
          mediaItems[0]
        ) : (
          <ContentCarousel
            ariaLabel="Post media"
            goToIndex={options?.goToIndex}
            onIndexChange={options?.onIndexChange}
          >
            {mediaItems}
          </ContentCarousel>
        )}
      </div>
    );
  };

  const handlePublishPost = async () => {
    if (postAudience === "close" && resolveSelectedCircleNamesForPost().length === 0) {
      setNewPostAudienceError("Private post requires at least one selected circle.");
      return;
    }

    if (draftMediaItems.some((item) => item.sizeBytes > MAX_MEDIA_SIZE_BYTES)) {
      setNewPostMediaError(`Each attachment must be ${MAX_MEDIA_SIZE_MB}MB or less.`);
      return;
    }

    const trimmedContent = newPostDraft.trim();
    if (!trimmedContent && draftMediaItems.length === 0) {
      setNewPostAudienceError("Post content cannot be empty unless media is attached.");
      return;
    }

    setNewPostAudienceError(null);
    setNewPostMediaError(null);

    const selectedCircleFeedIds: string[] = [];
    if (postAudience === "close") {
      if (includeInnerCircleForPost) {
        const innerCircle = renderCircleItems.find((circle) => circle.isInnerCircle);
        if (!innerCircle || innerCircle.feedId === "inner-circle-pending") {
          setNewPostAudienceError("Inner Circle is not ready yet. Please sync and try again.");
          return;
        }
        selectedCircleFeedIds.push(innerCircle.feedId);
      }

      selectedCircleFeedIds.push(...selectedCustomCircleIdsForPost);
    }

    const authorPublicAddress = credentials?.signingPublicKey;
    const signingPrivateKeyHex = credentials?.signingPrivateKey;
    if (!authorPublicAddress || !signingPrivateKeyHex) {
      addUiToast("Missing credentials. Please login again.");
      return;
    }

    const now = Date.now();
    const postId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `post-${now}`;

    const result = await createSocialPost(
      {
        postId,
        authorPublicAddress,
        content: trimmedContent,
        audience: {
          visibility: postAudience === "close" ? "private" : "open",
          circleFeedIds: selectedCircleFeedIds,
        },
        attachments: draftMediaItems.map((item) => ({
          attachmentId: item.id,
          mimeType: item.mimeType,
          size: item.sizeBytes,
          fileName: item.fileName,
          hash: item.hash,
          kind: item.kind,
        })),
        createdAtUnixMs: now,
      },
      signingPrivateKeyHex,
      draftMediaItems.map((item) => ({
        attachmentId: item.id,
        bytes: item.rawBytes,
      }))
    );

    if (!result.success) {
      addUiToast(`Transaction failed: ${result.message || result.errorCode || "Unknown error"}`);
      return;
    }

    setFeedWallPosts((current) => [
      {
        id: postId,
        authorPublicAddress,
        authorCommitment: result.authorCommitment,
        author: ownAuthorLabel,
        time: "sending...",
        createdAtBlock: 0,
        visibility: postAudience === "close" ? "private" : "open",
        circleFeedIds: [...selectedCircleFeedIds],
        confirmedAtMs: null,
        confirmedAtText: "sending...",
        confirmationState: "pending",
        text: trimmedContent,
        replyCount: 0,
        reactions: { ...EMPTY_REACTIONS },
        replies: [],
        attachments: draftMediaItems.map((item) => ({
          id: item.id,
          kind: item.kind,
          fileName: item.fileName,
          mimeType: item.mimeType,
          sizeBytes: item.sizeBytes,
          previewUrl: item.previewUrl,
        })),
      },
      ...current,
    ]);

    setNewPostDraft("");
    setDraftMediaItems([]);
    setPostAudience("close");
    setIncludeInnerCircleForPost(true);
    setSelectedCustomCircleIdsForPost([]);
    setIsFeedComposerExpanded(false);
    addUiToast(result.permalink ? `Post published: ${result.permalink}` : "Post published.");
    await triggerSyncNow();
  };

  const addDraftMediaFiles = async (incomingFiles: File[] | FileList | null) => {
    const files = incomingFiles ? Array.from(incomingFiles) : [];
    if (files.length === 0) {
      return;
    }

    if (draftMediaItems.length + files.length > MAX_MEDIA_ATTACHMENTS) {
      setNewPostMediaError(`You can attach up to ${MAX_MEDIA_ATTACHMENTS} items.`);
      return;
    }

    const nextItems: DraftMediaItem[] = [];
    for (const file of files) {
      const kind = detectMediaKindFromMime(file.type);
      if (!kind) {
        setNewPostMediaError(`Unsupported file type: ${file.type || file.name}`);
        return;
      }

      if (file.size > MAX_MEDIA_SIZE_BYTES) {
        setNewPostMediaError(`Each attachment must be ${MAX_MEDIA_SIZE_MB}MB or less.`);
        return;
      }

      const bytes = await readFileBytes(file);
      const hash = await computeSha256(bytes);
      const previewUrl = URL.createObjectURL(file);
      mediaPreviewUrlsRef.current.add(previewUrl);
      const itemId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${kind}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

      nextItems.push({
        id: itemId,
        kind,
        label: file.name,
        sizeMb: toMediaSizeMb(file.size),
        sizeBytes: file.size,
        mimeType: file.type,
        fileName: file.name,
        hash,
        previewUrl,
        rawBytes: bytes,
      });
    }

    setDraftMediaItems((current) => [...current, ...nextItems]);
    setNewPostMediaError(null);
  };

  const handleAddImageClick = () => {
    setNewPostMediaError(null);
  };

  const handleAddVideoClick = () => {
    setNewPostMediaError(null);
  };

  const removeDraftMediaItem = (id: string) => {
    setDraftMediaItems((current) => {
      const target = current.find((item) => item.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
        mediaPreviewUrlsRef.current.delete(target.previewUrl);
      }
      return current.filter((item) => item.id !== id);
    });
    setNewPostMediaError(null);
  };

  const handleSelectPublicAudience = () => {
    setPostAudience("public");
    setNewPostAudienceError(null);
  };

  const handleSelectPrivateAudience = () => {
    setPostAudience("close");
    if (!includeInnerCircleForPost && selectedCustomCircleIdsForPost.length === 0) {
      setIncludeInnerCircleForPost(true);
    }
    setNewPostAudienceError(null);
  };

  const handleToggleInnerCircleForPost = () => {
    if (includeInnerCircleForPost && selectedCustomCircleIdsForPost.length === 0) {
      setNewPostAudienceError("Inner Circle cannot be removed unless another private circle is selected.");
      return;
    }
    setIncludeInnerCircleForPost((current) => !current);
    setNewPostAudienceError(null);
  };

  const handleToggleCustomCircleForPost = (feedId: string) => {
    const alreadySelected = selectedCustomCircleIdsForPost.includes(feedId);
    if (alreadySelected) {
      if (!includeInnerCircleForPost && selectedCustomCircleIdsForPost.length === 1) {
        setNewPostAudienceError("Private post requires at least one selected circle.");
        return;
      }
      setSelectedCustomCircleIdsForPost((current) => current.filter((id) => id !== feedId));
      setNewPostAudienceError(null);
      return;
    }

    setSelectedCustomCircleIdsForPost((current) => [...current, feedId]);
    setNewPostAudienceError(null);
  };

  const renderPostComposerCard = (mode: "full" | "compact") => (
    <SocialPostComposerCard
      mode={mode}
      isExpanded={isFeedComposerExpanded}
      onExpand={() => setIsFeedComposerExpanded(true)}
      onCollapse={() => setIsFeedComposerExpanded(false)}
      newPostDraft={newPostDraft}
      onDraftChange={setNewPostDraft}
      postAudience={postAudience}
      onSelectPublicAudience={handleSelectPublicAudience}
      onSelectPrivateAudience={handleSelectPrivateAudience}
      includeInnerCircleForPost={includeInnerCircleForPost}
      onToggleInnerCircle={handleToggleInnerCircleForPost}
      availableCustomCirclesForPost={availableCustomCirclesForPost}
      selectedCustomCircleIdsForPost={selectedCustomCircleIdsForPost}
      onToggleCustomCircle={handleToggleCustomCircleForPost}
      selectedCircleNames={resolveSelectedCircleNamesForPost()}
      newPostAudienceError={newPostAudienceError}
      draftMediaItems={draftMediaItems}
      newPostMediaError={newPostMediaError}
      maxMediaAttachments={MAX_MEDIA_ATTACHMENTS}
      maxMediaSizeMb={MAX_MEDIA_SIZE_MB}
      onAddImage={handleAddImageClick}
      onAddVideo={handleAddVideoClick}
      onAddFiles={(files) => void addDraftMediaFiles(files)}
      onRemoveMedia={removeDraftMediaItem}
      onPublish={handlePublishPost}
    />
  );

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

    if (isFeedWallLoading) {
      return (
        <div data-testid="social-loading" className="flex flex-col items-center justify-center py-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-hush-purple mb-3" />
          <p className="text-hush-text-accent text-sm">Loading Feed Wall...</p>
        </div>
      );
    }

    return (
      <div data-testid="social-populated" className="space-y-3">
        <section data-testid="social-feedwall-composer">{renderPostComposerCard("compact")}</section>
        {feedWallPosts.length === 0 ? (
          <div data-testid="social-empty" className="rounded-xl border border-hush-bg-hover bg-hush-bg-dark p-6 text-center">
            <p className="text-hush-text-primary font-semibold mb-1">Your Feed Wall is quiet</p>
            <p className="text-hush-text-accent text-sm">Create a post to start your wall.</p>
          </div>
        ) : null}
        {feedWallPosts.map((post) => {
          const preview = getPostPreview(post.text);

          return (
            <article
              key={post.id}
              data-testid={`social-post-${post.id}`}
              className="bg-hush-bg-dark rounded-xl p-4 border border-hush-bg-hover cursor-pointer"
              onClick={(event) => handlePostCardClick(event, post.id)}
            >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hush-purple/40 bg-hush-purple/10 text-sm font-semibold text-hush-purple">
                  {normalizePublicAddress(post.authorPublicAddress) === ownAddressNormalized
                    ? ownInitials
                    : getDisplayInitials(post.author)}
                </span>
                <p className="truncate text-sm font-semibold text-hush-text-primary">{post.author}</p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs text-hush-text-accent" data-testid={`post-status-${post.id}`}>
                {post.confirmationState === "confirmed" ? (
                  <Check className="h-3.5 w-3.5 text-green-400" />
                ) : (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-hush-purple" />
                )}
                {post.confirmationState === "confirmed"
                  ? (post.confirmedAtMs
                    ? formatRelativeTime(post.confirmedAtMs)
                    : formatRelativeTimeFromBlockAge(post.createdAtBlock, currentBlockHeight) ?? post.time)
                  : post.time}
              </span>
            </div>
            <p
              className="text-sm text-hush-text-accent whitespace-pre-wrap break-words"
              data-testid={`post-preview-${post.id}`}
            >
              {preview.previewText}
              {preview.isTruncated && (
                <button
                  type="button"
                  className="ml-1 text-hush-purple hover:underline"
                  data-testid={`open-post-detail-${post.id}`}
                  onClick={() => openPostDetail(post.id)}
                >
                  ... Show more
                </button>
              )}
            </p>
            {renderPostMedia(post, `post-media-${post.id}`)}

            <div className="mt-3 flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-hush-text-accent hover:bg-hush-bg-hover"
                  data-testid={`post-action-reply-${post.id}`}
                  onClick={() => {
                    if (handleGuestInteractiveAttempt(post.visibility)) {
                      return;
                    }

                    openPostDetail(post.id);
                  }}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Reply ({post.replyCount})
                </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-hush-text-accent hover:bg-hush-bg-hover"
                data-testid={`post-action-link-${post.id}`}
                onClick={() => void copyPostPermalink(post.id)}
              >
                <Link2 className="w-3.5 h-3.5" />
                Get Link
              </button>
              <div className="ml-1 flex flex-wrap items-center gap-1" data-testid={`post-audience-badges-${post.id}`}>
                {resolveAudienceBadgesForPost(post).map((badge) => (
                  <span
                    key={`${post.id}-audience-${badge}`}
                    className="rounded-full border border-hush-purple/40 bg-hush-purple/10 px-2 py-0.5 text-[11px] text-hush-purple"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>

            <div
              className="mt-2 flex flex-wrap items-center gap-2"
              onClick={(event) => event.stopPropagation()}
            >
              <SocialPostReactions
                postId={post.id}
                reactionScopeId={post.reactionScopeId}
                visibility={post.visibility}
                circleFeedIds={post.circleFeedIds}
                authorCommitment={post.authorCommitment}
                canInteract={!!credentials?.signingPublicKey}
                testIdPrefix={`post-reaction-strip-${post.id}`}
                onRequireAccount={() => setShowAuthOverlay(true)}
              />
            </div>
            {post.replyCount > 0 && (
              <div
                className="mt-2 text-[11px] text-hush-text-accent"
                data-testid={`post-replies-hint-${post.id}`}
                onClick={(event) => event.stopPropagation()}
              >
                Replies open in post detail.
              </div>
            )}
            </article>
          );
        })}
      </div>
    );
  };

  const renderFollowingContent = () => {
    if (renderFollowingItems.length === 0) {
      return (
        <>
          <div data-testid="social-following-empty" className="rounded-xl border border-hush-bg-hover bg-hush-bg-dark p-4 text-sm text-hush-text-accent">
            You are not following anyone yet.
          </div>
          <div className="mt-6 rounded-xl border border-hush-bg-hover bg-hush-bg-dark p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-hush-text-primary">Circles</h3>
              <button
                type="button"
                onClick={() => setIsCreateDialogOpen(true)}
                className="rounded-md border border-hush-purple/40 px-2 py-1 text-xs text-hush-purple hover:bg-hush-purple/10"
                data-testid="social-create-circle-button"
              >
                Create Circle
              </button>
            </div>
            <div className="text-xs text-hush-text-accent">No followed users to assign yet.</div>
          </div>
        </>
      );
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col gap-6">
        <div data-testid="social-following-list" className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {renderFollowingItems.map((item) => {
            const isSelectedOnMobile = selectedMemberAddress === item.publicAddress;
            return (
              <article
                key={item.publicAddress}
                data-testid={`social-following-item-${item.publicAddress}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  setPointerDragMemberAddress(item.publicAddress);
                  logSocialDrag("pointerdrag.start", { memberAddress: item.publicAddress });
                }}
                onClick={() => setSelectedMemberAddress(item.publicAddress)}
                className={`select-none cursor-grab rounded-xl border bg-hush-bg-dark p-4 transition active:cursor-grabbing ${
                  isSelectedOnMobile
                    ? "border-hush-purple shadow-[0_0_0_1px_rgba(149,98,255,0.3)]"
                    : "border-hush-bg-hover"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-hush-text-primary">{item.displayName}</p>
                  <p className="text-[11px] text-hush-text-accent">
                    {item.publicAddress.slice(0, 8)}...{item.publicAddress.slice(-6)}
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {item.circles.map((circle) => (
                    <span
                      key={`${item.publicAddress}-${circle}`}
                      data-testid={`social-following-circle-${item.publicAddress}-${circle}`}
                      className="rounded-full border border-hush-purple/40 px-2 py-1 text-[11px] text-hush-purple"
                    >
                      {circle}
                    </span>
                  ))}
                </div>
              </article>
            );
          })}
        </div>

        <section className="rounded-xl border border-hush-bg-hover bg-hush-bg-dark p-4" data-testid="social-circles-panel">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-hush-text-primary">Circles</h3>
            <button
              type="button"
              onClick={() => setIsCreateDialogOpen(true)}
              className="rounded-md border border-hush-purple/40 px-2 py-1 text-xs text-hush-purple hover:bg-hush-purple/10"
              data-testid="social-create-circle-button"
            >
              Create Circle
            </button>
          </div>

          <p className="mb-3 text-xs text-hush-text-accent">
            {selectedMemberAddress
              ? `Selected member: ${getDisplayNameForAddress(selectedMemberAddress)}. Tap a circle to add.`
              : "Drag a member into a circle on desktop or tap a member first on mobile."}
          </p>

          <div className="flex snap-x gap-3 overflow-x-auto pb-2" data-testid="social-circles-strip">
            {renderCircleItems.map((circle) => {
              const pendingMembers = pendingCircleMembers[circle.feedId] ?? [];
              const draggedAddressForStyle = resolveAnyDraggedMemberAddress();
              const canDrop =
                !!draggedAddressForStyle &&
                !isCircleAssignmentBlocked(circle, draggedAddressForStyle) &&
                circle.feedId !== "inner-circle-pending";

              return (
                <button
                  key={circle.feedId}
                  type="button"
                  data-testid={`social-circle-card-${circle.feedId}`}
                  style={{ userSelect: "none", WebkitUserSelect: "none" }}
                  onMouseUp={() => {
                    const draggedAddress = resolveAnyDraggedMemberAddress();
                    if (!draggedAddress) {
                      return;
                    }
                    const normalizedDraggedAddress = normalizePublicAddress(draggedAddress);

                    const blockedByMembership = isCircleAssignmentBlocked(circle, normalizedDraggedAddress);
                    const blockedByPendingInnerCircle = circle.feedId === "inner-circle-pending";
                    const eligible = !blockedByMembership && !blockedByPendingInnerCircle;
                    logSocialDrag("pointerdrag.drop", {
                      circleFeedId: circle.feedId,
                      circleName: circle.name,
                      draggedAddress: normalizedDraggedAddress,
                      eligible,
                      blockedByMembership,
                      blockedByPendingInnerCircle,
                      existingMembers: circle.members.map((address) => normalizePublicAddress(address)),
                      pendingMembers: (pendingCircleMembers[circle.feedId] ?? []).map((address) =>
                        normalizePublicAddress(address)
                      ),
                    });
                    if (!eligible) {
                      if (blockedByPendingInnerCircle) {
                        addUiToast("Transaction failed: Inner Circle is not available yet");
                      } else if (blockedByMembership) {
                        addUiToast(
                          `Transaction failed: ${getDisplayNameForAddress(normalizedDraggedAddress)} is already in ${circle.name}`
                        );
                      }
                      return;
                    }
                    void assignMemberToCircle(normalizedDraggedAddress, circle);
                  }}
                  onClick={() => {
                    if (!selectedMemberAddress) {
                      return;
                    }
                    void assignMemberToCircle(selectedMemberAddress, circle);
                  }}
                  className={`min-w-[190px] snap-start rounded-xl border p-3 text-left transition select-none ${
                    canDrop
                      ? "cursor-pointer border-hush-purple bg-hush-purple/10"
                      : draggedAddressForStyle
                        ? "cursor-not-allowed border-hush-bg-hover bg-hush-bg-dark/70"
                        : "cursor-pointer border-hush-bg-hover bg-hush-bg-dark/70 hover:border-hush-purple/40"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-hush-text-primary">{circle.name}</p>
                    <span className="text-[11px] text-hush-text-accent">{circle.memberCount}</span>
                  </div>

                  <div className="flex min-h-8 flex-wrap items-center gap-1">
                    {circle.members.slice(0, 8).map((memberAddress) => (
                      <span
                        key={`${circle.feedId}-${memberAddress}`}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-hush-purple/40 text-[10px] text-hush-purple"
                        title={getDisplayNameForAddress(memberAddress)}
                      >
                        {getDisplayInitials(getDisplayNameForAddress(memberAddress))}
                      </span>
                    ))}
                    {pendingMembers.map((memberAddress) => (
                      <span
                        key={`${circle.feedId}-pending-${memberAddress}`}
                        data-testid={`social-circle-pending-${circle.feedId}-${memberAddress}`}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-400 text-[10px] text-slate-300"
                        title={`${getDisplayNameForAddress(memberAddress)} pending`}
                      >
                        {getDisplayInitials(getDisplayNameForAddress(memberAddress))}
                      </span>
                    ))}
                  </div>

                  <div className="mt-2 text-[11px] text-hush-text-accent">
                    {circle.isInnerCircle ? "Default private circle" : "Custom circle"}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    );
  };

  const renderCreateCircleDialog = () => {
    if (!isCreateDialogOpen) {
      return null;
    }

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        onClick={() => {
          if (!creatingCircle) {
            setIsCreateDialogOpen(false);
            setCreateCircleError(null);
          }
        }}
        data-testid="social-create-circle-modal"
      >
        <div
          className="w-full max-w-md rounded-xl border border-hush-bg-hover bg-hush-bg-dark p-4"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-hush-text-primary">Create Circle</h3>
            <button
              type="button"
              onClick={() => {
                if (!creatingCircle) {
                  setIsCreateDialogOpen(false);
                  setCreateCircleError(null);
                }
              }}
              className="rounded-md px-2 py-1 text-xs text-hush-text-accent hover:bg-hush-bg-hover"
              data-testid="social-create-circle-close"
            >
              Close
            </button>
          </div>

          <label className="text-xs text-hush-text-accent" htmlFor="create-circle-input">
            Circle name
          </label>
          <input
            id="create-circle-input"
            value={createCircleNameDraft}
            onChange={(event) => {
              setCreateCircleNameDraft(event.currentTarget.value);
              setCreateCircleError(null);
            }}
            className="mt-1 w-full rounded-md border border-hush-bg-hover bg-hush-bg-dark px-3 py-2 text-sm text-hush-text-primary outline-none focus:border-hush-purple"
            placeholder="Friends"
            data-testid="social-create-circle-input"
          />
          <p className="mt-1 text-[11px] text-hush-text-accent">3-40 chars, letters/numbers/spaces/_/-</p>

          {createCircleError && (
            <p className="mt-2 text-xs text-red-400" data-testid="social-create-circle-error">
              {createCircleError}
            </p>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                if (!creatingCircle) {
                  setIsCreateDialogOpen(false);
                  setCreateCircleError(null);
                }
              }}
              className="rounded-md border border-hush-bg-hover px-3 py-1.5 text-xs text-hush-text-accent hover:bg-hush-bg-hover"
              data-testid="social-create-circle-cancel"
              disabled={creatingCircle}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submitCreateCircle()}
              className="rounded-md bg-hush-purple px-3 py-1.5 text-xs font-semibold text-hush-bg-dark disabled:opacity-50"
              data-testid="social-create-circle-submit"
              disabled={creatingCircle || createCircleNameDraft.trim().length < 3}
            >
              {creatingCircle ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden" data-testid="social-shell">
      <section
        ref={feedWallRegionRef}
        className={`flex-1 min-h-0 p-4 ${
          selectedNav === "following" ? "flex flex-col overflow-hidden" : "overflow-y-auto"
        }`}
        data-testid="feed-wall-region"
        onScroll={(event) => {
          setAppContextScroll("social", event.currentTarget.scrollTop);
        }}
      >
        <div className={`w-full ${selectedNav === "following" ? "min-h-0 flex flex-1 flex-col" : ""}`}>
          <div className="mb-3">
            <h2 className="text-xl font-semibold text-hush-text-primary">
              {selectedNav === "following"
                ? "Following"
                : selectedNav === "new-post"
                  ? "New Post"
                  : selectedNav === "search"
                    ? "Search"
                    : "Feed Wall"}
            </h2>
            <p className="text-xs text-hush-text-accent">
              {selectedNav === "following"
                ? "People you follow and their current circle memberships."
                : selectedNav === "new-post"
                  ? "Compose a post with explicit audience targeting rules."
                  : selectedNav === "search"
                    ? "Profile discovery is being prepared."
                : "Public posts from people you follow and nearby circles."}
            </p>
            {innerCircleSync.status !== "idle" && (
              <div
                data-testid="inner-circle-sync-status"
                className="mt-2 inline-flex items-center gap-2 rounded-md border border-hush-bg-hover bg-hush-bg-dark px-2 py-1 text-[11px] text-hush-text-accent"
              >
                <span>
                  {innerCircleSync.status === "syncing" && "Syncing Inner Circle..."}
                  {innerCircleSync.status === "retrying" &&
                    `Inner Circle retry ${innerCircleSync.attemptCount}/5`}
                  {innerCircleSync.status === "error" && "Inner Circle sync needs attention"}
                </span>
                {innerCircleSync.status === "error" && (
                  <button
                    type="button"
                    onClick={() => requestInnerCircleRetry()}
                    className="rounded border border-hush-purple/40 px-2 py-0.5 text-[10px] text-hush-purple hover:bg-hush-purple/10"
                    data-testid="inner-circle-sync-retry"
                  >
                    Retry now
                  </button>
                )}
              </div>
            )}
          </div>

          {selectedNav === "feed-wall" ? renderFeedWallContent() : null}
          {selectedNav === "following" ? renderFollowingContent() : null}
          {selectedNav === "new-post" ? renderPostComposerCard("full") : null}
          {selectedNav !== "feed-wall" && selectedNav !== "following" && selectedNav !== "new-post" ? (
            <div data-testid="social-subview-placeholder" className="py-16 text-center">
              <p className="text-hush-text-primary font-semibold mb-1">{selectedNav.replace(/-/g, " ")}</p>
              <p className="text-hush-text-accent text-sm">This section will be expanded in the next phases.</p>
            </div>
          ) : null}
        </div>
      </section>

      <SystemToastContainer toasts={uiToasts} onDismiss={removeUiToast} />
      {showAuthOverlay ? (
        <SocialAuthPromptOverlay onClose={() => setShowAuthOverlay(false)} />
      ) : null}
      {renderCreateCircleDialog()}

      {activePost && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          data-testid="post-detail-overlay"
          onClick={() => setActivePostId(null)}
        >
          <div
            ref={activePostDialogRef}
            className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-xl border border-hush-bg-hover bg-hush-bg-dark p-4"
            onClick={(event) => event.stopPropagation()}
            tabIndex={-1}
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
            {renderPostMedia(activePost, `post-detail-media-${activePost.id}`, {
              goToIndex: activePostMediaIndex,
              onIndexChange: setActivePostMediaIndex,
            })}
            <div className="mt-3 flex flex-wrap items-center gap-2" data-testid={`post-detail-actions-${activePost.id}`}>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-hush-text-accent hover:bg-hush-bg-hover"
                data-testid={`post-detail-action-reply-${activePost.id}`}
                onClick={() => {
                  if (handleGuestInteractiveAttempt(activePost.visibility)) {
                    return;
                  }

                  setIsTopComposerOpen(true);
                }}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Reply ({overlayReplies.length})
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-hush-text-accent hover:bg-hush-bg-hover"
                data-testid={`post-detail-action-link-${activePost.id}`}
                onClick={() => void copyPostPermalink(activePost.id)}
              >
                <Link2 className="w-3.5 h-3.5" />
                Get Link
              </button>
              <div className="ml-1 flex flex-wrap items-center gap-1" data-testid={`post-detail-audience-badges-${activePost.id}`}>
                {resolveAudienceBadgesForPost(activePost).map((badge) => (
                  <span
                    key={`${activePost.id}-detail-audience-${badge}`}
                    className="rounded-full border border-hush-purple/40 bg-hush-purple/10 px-2 py-0.5 text-[11px] text-hush-purple"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>
            <SocialPostReactions
              postId={activePost.id}
              reactionScopeId={activePost.reactionScopeId}
              visibility={activePost.visibility}
              circleFeedIds={activePost.circleFeedIds}
              authorCommitment={activePost.authorCommitment}
              canInteract={!!credentials?.signingPublicKey}
              testIdPrefix={`post-detail-reaction-strip-${activePost.id}`}
              onRequireAccount={() => setShowAuthOverlay(true)}
            />

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

