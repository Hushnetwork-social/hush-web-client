import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSocialNotificationInboxMock = vi.fn();
const getSocialNotificationPreferencesMock = vi.fn();
const updateSocialNotificationPreferencesMock = vi.fn();

let mockAppState = {
  isAuthenticated: true,
  credentials: {
    signingPublicKey: "user-1",
  },
};

vi.mock("@/stores", () => ({
  useAppStore: (selector?: (state: typeof mockAppState) => unknown) =>
    typeof selector === "function" ? selector(mockAppState) : mockAppState,
}));

vi.mock("@/modules/feeds", () => ({
  useFeedsStore: () => ({
    setUnreadCount: vi.fn(),
    incrementUnreadCount: vi.fn(),
    markFeedAsRead: vi.fn(),
    syncUnreadCounts: vi.fn(),
    getFeed: vi.fn(),
  }),
}));

vi.mock("@/lib/grpc/services", () => ({
  notificationService: {
    getSocialNotificationInbox: (...args: unknown[]) => getSocialNotificationInboxMock(...args),
    getSocialNotificationPreferences: (...args: unknown[]) => getSocialNotificationPreferencesMock(...args),
    markSocialNotificationRead: vi.fn(),
    updateSocialNotificationPreferences: (...args: unknown[]) => updateSocialNotificationPreferencesMock(...args),
    subscribeToEvents: vi.fn(),
    markFeedAsRead: vi.fn(),
    getUnreadCounts: vi.fn(),
  },
}));

vi.mock("@/modules/feeds/FeedsService", () => ({
  fetchMessages: vi.fn(),
}));

vi.mock("@/lib/crypto/encryption", () => ({
  aesDecrypt: vi.fn(),
}));

vi.mock("@/lib/platform", () => ({
  detectPlatform: () => "browser",
}));

vi.mock("@/lib/notifications", () => ({
  showNotification: vi.fn(),
}));

vi.mock("@/lib/events", () => ({
  onMemberJoin: () => () => {},
  onVisibilityChange: () => () => {},
}));

vi.mock("@/lib/events/syncRecoveredMessageEvents", () => ({
  onSyncRecoveredMessage: () => () => {},
}));

vi.mock("@/lib/debug-logger", () => ({
  debugLog: vi.fn(),
  debugError: vi.fn(),
}));

vi.mock("@/lib/mentions", () => ({
  parseMentions: () => [],
  trackMention: vi.fn(),
  getMentionDisplayText: (value: string) => value,
}));

import { useSocialNotifications } from "./useNotifications";

describe("useSocialNotifications FEAT-091 integration", () => {
  beforeEach(() => {
    mockAppState = {
      isAuthenticated: true,
      credentials: {
        signingPublicKey: "user-1",
      },
    };

    getSocialNotificationInboxMock.mockReset();
    getSocialNotificationPreferencesMock.mockReset();
    updateSocialNotificationPreferencesMock.mockReset();

    getSocialNotificationInboxMock.mockResolvedValue({
      items: [
        {
          notificationId: "notif-1",
          kind: 3,
          visibilityClass: 1,
          targetType: 2,
          targetId: "comment-1",
          postId: "post-1",
          parentCommentId: "",
          actorUserId: "alice",
          actorDisplayName: "Alice",
          title: "Alice commented",
          body: "Comment body",
          isRead: false,
          isPrivatePreviewSuppressed: false,
          createdAtUnixMs: 100,
          deepLinkPath: "/social/post/post-1?commentId=comment-1",
          matchedCircleIds: [],
        },
      ],
      hasMore: false,
    });
    getSocialNotificationPreferencesMock.mockResolvedValue({
      openActivityEnabled: true,
      closeActivityEnabled: true,
      circleMutes: [],
      updatedAtUnixMs: 200,
    });
    updateSocialNotificationPreferencesMock.mockResolvedValue({
      success: true,
      message: "",
      preferences: {
        openActivityEnabled: true,
        closeActivityEnabled: true,
        circleMutes: [],
        updatedAtUnixMs: 300,
      },
    });
  });

  it("refreshes the durable inbox once when focus and visibility recovery happen together", async () => {
    const { result } = renderHook(() => useSocialNotifications({ enabled: true, includeRead: true, limit: 20 }));

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });
    getSocialNotificationInboxMock.mockClear();
    getSocialNotificationPreferencesMock.mockClear();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(getSocialNotificationInboxMock).toHaveBeenCalledTimes(1);
    });
    expect(result.current.unreadCount).toBe(1);
  });

  it("applies FEAT-091 preference updates optimistically and keeps server response", async () => {
    let resolveUpdate: ((value: {
      success: boolean;
      message: string;
      preferences: {
        openActivityEnabled: boolean;
        closeActivityEnabled: boolean;
        circleMutes: Array<{ circleId: string; isMuted: boolean }>;
        updatedAtUnixMs: number;
      };
    }) => void) | null = null;

    updateSocialNotificationPreferencesMock.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      })
    );

    const { result } = renderHook(() => useSocialNotifications({ enabled: true, includeRead: true, limit: 20 }));

    await waitFor(() => {
      expect(result.current.preferences.closeActivityEnabled).toBe(true);
    });

    let pendingUpdate: Promise<boolean>;
    await act(async () => {
      pendingUpdate = result.current.updatePreferences({
        closeActivityEnabled: false,
        circleMutes: [{ circleId: "inner-circle", isMuted: true }],
      });
    });

    await waitFor(() => {
      expect(result.current.preferences.closeActivityEnabled).toBe(false);
      expect(result.current.preferences.circleMutes).toEqual([{ circleId: "inner-circle", isMuted: true }]);
    });

    await act(async () => {
      resolveUpdate?.({
        success: true,
        message: "",
        preferences: {
          openActivityEnabled: true,
          closeActivityEnabled: false,
          circleMutes: [{ circleId: "inner-circle", isMuted: true }],
          updatedAtUnixMs: 400,
        },
      });

      await pendingUpdate!;
    });

    expect(result.current.preferences.updatedAtUnixMs).toBe(400);
  });
});
