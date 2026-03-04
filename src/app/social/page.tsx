"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Link2, Loader2, MessageCircle, SmilePlus, Sparkles, X } from "lucide-react";
import { useAppStore } from "@/stores";
import { useFeedsStore } from "@/modules/feeds/useFeedsStore";
import { useSyncContext } from "@/lib/sync";
import { SystemToastContainer } from "@/components/notifications/SystemToast";
import { addMembersToCustomCircle, createCustomCircle } from "@/modules/feeds/FeedsService";
import { checkIdentityExists } from "@/modules/identity/IdentityService";
import type { CustomCircleMemberPayload } from "@/lib/crypto";

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

function getDisplayInitials(value: string): string {
  const trimmed = value.trim();
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
  return name.trim().toLowerCase();
}

function normalizePublicAddress(address: string): string {
  return address.trim().toLowerCase();
}

function isCircleFeed(feedName: string, feedDescription?: string): boolean {
  const normalizedName = normalizeCircleName(feedName);
  if (normalizedName === "inner circle") {
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
  const searchParams = useSearchParams();
  const appContexts = useAppStore((state) => state.appContexts);
  const selectedNav = useAppStore((state) => state.selectedNav);
  const setSelectedNav = useAppStore((state) => state.setSelectedNav);
  const setAppContextScroll = useAppStore((state) => state.setAppContextScroll);
  const innerCircleSync = useAppStore((state) => state.innerCircleSync);
  const requestInnerCircleRetry = useAppStore((state) => state.requestInnerCircleRetry);
  const credentials = useAppStore((state) => state.credentials);
  const { triggerSyncNow } = useSyncContext();
  const feeds = useFeedsStore((state) => state.feeds);
  const groupMembers = useFeedsStore((state) => state.groupMembers);
  const [activePostId, setActivePostId] = useState<string | null>(null);
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
  const [selectedCustomCircleIdForPost, setSelectedCustomCircleIdForPost] = useState<string | null>(null);
  const [newPostAudienceError, setNewPostAudienceError] = useState<string | null>(null);
  const feedWallRegionRef = useRef<HTMLElement | null>(null);
  const hasInitializedSocialNavRef = useRef(false);

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

  const viewState = useMemo(() => resolveViewState(searchParams.get("state")), [searchParams]);
  const activePost = useMemo(() => DEMO_POSTS.find((post) => post.id === activePostId) ?? null, [activePostId]);
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
        .map((circleFeed) => circleFeed.name)
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
      const isInnerCircle = normalizeCircleName(feed.name) === "inner circle";

      return {
        feedId: feed.id,
        name: feed.name,
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

  const addUiToast = (message: string) => {
    const toastId = `toast-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    setUiToasts((current) => [...current, { id: toastId, message }]);
  };

  const removeUiToast = (toastId: string) => {
    setUiToasts((current) => current.filter((toast) => toast.id !== toastId));
  };

  const getDisplayNameForAddress = (address: string) => {
    const normalizedAddress = normalizePublicAddress(address);
    return (
      renderFollowingItems.find((item) => normalizePublicAddress(item.publicAddress) === normalizedAddress)?.displayName ??
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

    if (selectedCustomCircleIdForPost) {
      const customCircle = availableCustomCirclesForPost.find((circle) => circle.feedId === selectedCustomCircleIdForPost);
      if (customCircle) {
        selectedNames.push(customCircle.name);
      }
    }

    return selectedNames;
  };

  const handlePublishPost = () => {
    if (postAudience === "close" && resolveSelectedCircleNamesForPost().length === 0) {
      setNewPostAudienceError("Private post requires at least one selected circle.");
      return;
    }

    setNewPostAudienceError(null);
    addUiToast("Post composer validation passed (publish flow is out of scope in this phase).");
  };

  const renderNewPostContent = () => {
    const selectedCircleNames = resolveSelectedCircleNamesForPost();

    return (
      <section data-testid="social-new-post" className="rounded-xl border border-hush-bg-hover bg-hush-bg-dark p-4">
        <h3 className="text-sm font-semibold text-hush-text-primary">New Post</h3>
        <p className="mt-1 text-xs text-hush-text-accent">Choose audience before publishing.</p>

        <textarea
          data-testid="social-new-post-draft"
          value={newPostDraft}
          onChange={(event) => setNewPostDraft(event.currentTarget.value)}
          placeholder="Share something..."
          className="mt-3 w-full min-h-28 rounded-md border border-hush-bg-hover bg-hush-bg-dark px-3 py-2 text-sm text-hush-text-primary outline-none focus:border-hush-purple"
        />

        <div className="mt-4 space-y-3 rounded-lg border border-hush-bg-hover p-3">
          <p className="text-xs font-semibold text-hush-text-primary">Audience</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="social-new-post-audience-public"
              onClick={() => {
                setPostAudience("public");
                setNewPostAudienceError(null);
              }}
              className={`rounded-full border px-3 py-1 text-xs ${
                postAudience === "public"
                  ? "border-hush-purple bg-hush-purple/10 text-hush-purple"
                  : "border-hush-bg-hover text-hush-text-accent"
              }`}
            >
              Public
            </button>
            <button
              type="button"
              data-testid="social-new-post-audience-close"
              onClick={() => {
                setPostAudience("close");
                if (!includeInnerCircleForPost && !selectedCustomCircleIdForPost) {
                  setIncludeInnerCircleForPost(true);
                }
                setNewPostAudienceError(null);
              }}
              className={`rounded-full border px-3 py-1 text-xs ${
                postAudience === "close"
                  ? "border-hush-purple bg-hush-purple/10 text-hush-purple"
                  : "border-hush-bg-hover text-hush-text-accent"
              }`}
            >
              Close (Private)
            </button>
          </div>

          {postAudience === "close" && (
            <div className="space-y-2" data-testid="social-new-post-private-options">
              <label className="flex items-center gap-2 text-xs text-hush-text-primary">
                <input
                  type="checkbox"
                  checked={includeInnerCircleForPost}
                  data-testid="social-new-post-inner-circle-toggle"
                  onChange={() => {
                    if (includeInnerCircleForPost && !selectedCustomCircleIdForPost) {
                      setNewPostAudienceError("Inner Circle cannot be removed unless another private circle is selected.");
                      return;
                    }
                    setIncludeInnerCircleForPost((current) => !current);
                    setNewPostAudienceError(null);
                  }}
                />
                Inner Circle (default)
              </label>

              <div className="space-y-1">
                <p className="text-[11px] text-hush-text-accent">Select at most one custom circle:</p>
                {availableCustomCirclesForPost.length === 0 ? (
                  <p className="text-[11px] text-hush-text-accent">No custom circles available yet.</p>
                ) : (
                  availableCustomCirclesForPost.map((circle) => (
                    <label key={circle.feedId} className="flex items-center gap-2 text-xs text-hush-text-primary">
                      <input
                        type="radio"
                        name="new-post-custom-circle"
                        checked={selectedCustomCircleIdForPost === circle.feedId}
                        data-testid={`social-new-post-custom-circle-${circle.feedId}`}
                        onChange={() => {
                          setSelectedCustomCircleIdForPost(circle.feedId);
                          setNewPostAudienceError(null);
                        }}
                      />
                      {circle.name}
                    </label>
                  ))
                )}
                {selectedCustomCircleIdForPost && (
                  <button
                    type="button"
                    data-testid="social-new-post-clear-custom-circle"
                    onClick={() => {
                      setSelectedCustomCircleIdForPost(null);
                      setNewPostAudienceError(null);
                    }}
                    className="rounded border border-hush-bg-hover px-2 py-1 text-[11px] text-hush-text-accent hover:bg-hush-bg-hover"
                  >
                    Clear custom circle
                  </button>
                )}
              </div>
            </div>
          )}

          <div data-testid="social-new-post-selected-circles" className="text-[11px] text-hush-text-accent">
            {postAudience === "public"
              ? "Selected: Public"
              : `Selected circles: ${selectedCircleNames.length > 0 ? selectedCircleNames.join(", ") : "none"}`}
          </div>
          {newPostAudienceError && (
            <p className="text-xs text-red-400" data-testid="social-new-post-audience-error">
              {newPostAudienceError}
            </p>
          )}
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            data-testid="social-new-post-publish"
            onClick={handlePublishPost}
            className="rounded-md bg-hush-purple px-3 py-1.5 text-xs font-semibold text-hush-bg-dark"
          >
            Publish
          </button>
        </div>
      </section>
    );
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
          {selectedNav === "new-post" ? renderNewPostContent() : null}
          {selectedNav !== "feed-wall" && selectedNav !== "following" && selectedNav !== "new-post" ? (
            <div data-testid="social-subview-placeholder" className="py-16 text-center">
              <p className="text-hush-text-primary font-semibold mb-1">{selectedNav.replace(/-/g, " ")}</p>
              <p className="text-hush-text-accent text-sm">This section will be expanded in the next phases.</p>
            </div>
          ) : null}
        </div>
      </section>

      <SystemToastContainer toasts={uiToasts} onDismiss={removeUiToast} />
      {renderCreateCircleDialog()}

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
