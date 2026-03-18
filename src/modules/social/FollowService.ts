import { buildApiUrl } from "@/lib/api-config";
import type {
  FollowSocialAuthorContract,
  FollowSocialAuthorResultContract,
} from "./contracts";

export async function followSocialAuthor(
  contract: FollowSocialAuthorContract
): Promise<FollowSocialAuthorResultContract> {
  const response = await fetch(buildApiUrl("/api/social/follow-author"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(contract),
  });

  if (!response.ok) {
    return {
      success: false,
      message: `Follow request failed (${response.status})`,
      alreadyFollowing: false,
      requiresSyncRefresh: false,
    };
  }

  const payload = (await response.json()) as Partial<FollowSocialAuthorResultContract>;
  return {
    success: payload.success === true,
    message: payload.message ?? "",
    errorCode: payload.errorCode,
    innerCircleFeedId: payload.innerCircleFeedId,
    alreadyFollowing: payload.alreadyFollowing === true,
    requiresSyncRefresh: payload.requiresSyncRefresh === true,
  };
}
