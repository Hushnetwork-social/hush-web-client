import { buildApiUrl } from "@/lib/api-config";

export type FeedWallPostContract = {
  postId: string;
  authorPublicAddress: string;
  content: string;
  createdAtBlock: number;
  createdAtUnixMs: number;
  visibility: "open" | "private";
  circleFeedIds: string[];
  attachments: {
    attachmentId: string;
    mimeType: string;
    size: number;
    fileName: string;
    hash: string;
    kind: "image" | "video";
  }[];
};

type FeedWallResponse = {
  success: boolean;
  message: string;
  errorCode?: string;
  posts?: FeedWallPostContract[];
};

export async function getSocialFeedWall(
  requesterPublicAddress: string | null,
  isAuthenticated: boolean,
  limit = 50
): Promise<{ success: boolean; posts: FeedWallPostContract[]; message: string; errorCode?: string }> {
  const params = new URLSearchParams();
  if (requesterPublicAddress) {
    params.set("requesterPublicAddress", requesterPublicAddress);
  }
  params.set("isAuthenticated", String(isAuthenticated));
  params.set("limit", String(limit));

  const relativeOrAbsoluteUrl = buildApiUrl(`/api/social/posts/feed-wall?${params.toString()}`);
  const requestUrl = relativeOrAbsoluteUrl.startsWith("/") && typeof window !== "undefined"
    ? `${window.location.origin}${relativeOrAbsoluteUrl}`
    : relativeOrAbsoluteUrl;

  const response = await fetch(requestUrl, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      success: false,
      posts: [],
      message: `Feed wall request failed (${response.status})`,
    };
  }

  const payload = (await response.json()) as FeedWallResponse;
  return {
    success: payload.success,
    posts: payload.posts ?? [],
    message: payload.message,
    errorCode: payload.errorCode,
  };
}
