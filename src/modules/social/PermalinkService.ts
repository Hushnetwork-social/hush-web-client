import { buildApiUrl } from "@/lib/api-config";
import type { SocialAuthorFollowStateContract } from "./contracts";

export type SocialPermalinkPayloadContract = {
  success: boolean;
  message: string;
  accessState: "allowed" | "guest_denied" | "unauthorized_denied" | "not_found";
  postId?: string;
  reactionScopeId?: string;
  authorPublicAddress?: string;
  authorCommitment?: string;
  followState?: SocialAuthorFollowStateContract;
  content?: string;
  createdAtBlock?: number;
  createdAtUnixMs?: number;
  canInteract: boolean;
  circleFeedIds: string[];
  attachments: {
    attachmentId: string;
    mimeType: string;
    size: number;
    fileName: string;
    hash: string;
    kind: "image" | "video";
  }[];
  openGraph?: {
    title: string;
    description: string;
    imageUrl?: string;
    isGenericPrivate: boolean;
    cacheControl: string;
  };
  errorCode?: string;
};

export async function getSocialPostPermalink(
  postId: string,
  requesterPublicAddress: string | null,
  isAuthenticated: boolean
): Promise<SocialPermalinkPayloadContract> {
  const params = new URLSearchParams();
  params.set("postId", postId);
  params.set("isAuthenticated", String(isAuthenticated));
  if (requesterPublicAddress) {
    params.set("requesterPublicAddress", requesterPublicAddress);
  }

  const response = await fetch(buildApiUrl(`/api/social/posts/permalink?${params.toString()}`), {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      success: false,
      message: `Permalink request failed (${response.status})`,
      accessState: "not_found",
      canInteract: false,
      circleFeedIds: [],
      attachments: [],
    };
  }

  const payload = (await response.json()) as SocialPermalinkPayloadContract;
  return {
    ...payload,
    circleFeedIds: payload.circleFeedIds ?? [],
    attachments: payload.attachments ?? [],
  };
}
