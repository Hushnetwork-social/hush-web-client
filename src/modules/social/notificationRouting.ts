import { getSocialPostRoute } from "@/lib/navigation/appRoutes";

export type SocialNotificationRouteItem = {
  deepLinkPath?: string;
  postId?: string;
  targetId?: string;
  parentCommentId?: string;
  targetType?: number;
};

export type SocialNotificationThreadSelection = {
  commentId: string | null;
  replyId: string | null;
  threadRootId: string | null;
};

export function normalizeSocialNotificationRoute(route: string | null | undefined): string {
  if (!route) {
    return "";
  }

  try {
    const url = new URL(route, "https://hush.local");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return route.trim();
  }
}

export function resolveSocialNotificationDestination(item: SocialNotificationRouteItem): string {
  const deepLinkPath = normalizeSocialNotificationRoute(item.deepLinkPath);
  if (deepLinkPath) {
    return deepLinkPath;
  }

  if (!item.postId) {
    return "";
  }

  const postRoute = getSocialPostRoute(item.postId);
  if (item.targetType === 2 && item.targetId) {
    return `${postRoute}?commentId=${encodeURIComponent(item.targetId)}`;
  }

  if (item.targetType === 3 && item.targetId) {
    const params = new URLSearchParams();
    if (item.parentCommentId) {
      params.set("threadRootId", item.parentCommentId);
    }
    params.set("replyId", item.targetId);
    return `${postRoute}?${params.toString()}`;
  }

  return postRoute;
}

export function isViewingSocialNotificationTarget(
  pathname: string,
  item: SocialNotificationRouteItem
): boolean {
  const destination = resolveSocialNotificationDestination(item);
  return destination.length > 0 && normalizeSocialNotificationRoute(pathname) === destination;
}

export function readSocialNotificationThreadSelection(
  searchParams: Pick<URLSearchParams, "get">
): SocialNotificationThreadSelection {
  const normalize = (value: string | null): string | null => {
    const trimmed = value?.trim() ?? "";
    return trimmed.length > 0 ? trimmed : null;
  };

  return {
    commentId: normalize(searchParams.get("commentId")),
    replyId: normalize(searchParams.get("replyId")),
    threadRootId: normalize(searchParams.get("threadRootId")),
  };
}

export function getSocialNotificationTargetEntryId(
  selection: SocialNotificationThreadSelection
): string | null {
  return selection.replyId ?? selection.commentId;
}
