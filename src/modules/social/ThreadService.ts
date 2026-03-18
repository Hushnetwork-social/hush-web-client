import { buildApiUrl } from "@/lib/api-config";
import { createUnsignedTransaction, hexToBytes, PAYLOAD_GUIDS, signByUser, type NewFeedMessagePayload } from "@/lib/crypto";
import { submitTransaction } from "@/modules/blockchain/BlockchainService";
import { initializeReactionsSystem } from "@/modules/reactions/initializeReactions";
import { useReactionsStore } from "@/modules/reactions/useReactionsStore";
import { useAppStore } from "@/stores";
import type { SocialAuthorFollowStateContract } from "./contracts";

export type SocialThreadEntryContract = {
  postId: string;
  entryId: string;
  kind: "comment" | "reply";
  parentCommentId?: string;
  threadRootId: string;
  reactionScopeId?: string;
  createdAtUnixMs?: number;
  reactionCount: number;
  authorPublicAddress?: string;
  followState?: SocialAuthorFollowStateContract;
  content?: string;
  authorCommitment?: string;
  childReplyCount?: number;
};

export type SocialCommentsPageContract = {
  success: boolean;
  message: string;
  comments: SocialThreadEntryContract[];
  paging: { initialPageSize: number; loadMorePageSize: number };
  hasMore: boolean;
};

export type SocialThreadRepliesPageContract = {
  success: boolean;
  message: string;
  replies: SocialThreadEntryContract[];
  paging: { initialPageSize: number; loadMorePageSize: number };
  hasMore: boolean;
};

export type CreateSocialThreadEntryResult = {
  success: boolean;
  message: string;
  entryId?: string;
};

async function getAuthorCommitmentBase64(): Promise<string | undefined> {
  let userCommitment = useReactionsStore.getState().getUserCommitment();
  if (!userCommitment) {
    const mnemonic = useAppStore.getState().credentials?.mnemonic;
    if (mnemonic && mnemonic.length > 0) {
      const initialized = await initializeReactionsSystem(mnemonic);
      if (initialized) {
        userCommitment = useReactionsStore.getState().getUserCommitment();
      }
    }
  }

  if (!userCommitment) {
    return undefined;
  }

  const hex = userCommitment.toString(16).padStart(64, "0");
  const bytes = new Uint8Array(32);
  for (let index = 0; index < 32; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }

  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  for (const value of bytes) {
    binary += String.fromCharCode(value);
  }
  return btoa(binary);
}

export async function getSocialCommentsPage(
  postId: string,
  requesterPublicAddress: string | null,
  isAuthenticated: boolean,
  limit?: number,
  beforeEntryId?: string
): Promise<SocialCommentsPageContract> {
  const params = new URLSearchParams();
  params.set("postId", postId);
  params.set("isAuthenticated", String(isAuthenticated));
  if (requesterPublicAddress) {
    params.set("requesterPublicAddress", requesterPublicAddress);
  }
  if (typeof limit === "number") {
    params.set("limit", String(limit));
  }
  if (beforeEntryId) {
    params.set("beforeEntryId", beforeEntryId);
  }

  const response = await fetch(buildApiUrl(`/api/social/posts/comments?${params.toString()}`), {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    return { success: false, message: `Comments request failed (${response.status})`, comments: [], paging: { initialPageSize: 10, loadMorePageSize: 10 }, hasMore: false };
  }

  return (await response.json()) as SocialCommentsPageContract;
}

export async function getSocialThreadRepliesPage(
  postId: string,
  threadRootId: string,
  requesterPublicAddress: string | null,
  isAuthenticated: boolean,
  limit?: number,
  beforeEntryId?: string
): Promise<SocialThreadRepliesPageContract> {
  const params = new URLSearchParams();
  params.set("postId", postId);
  params.set("threadRootId", threadRootId);
  params.set("isAuthenticated", String(isAuthenticated));
  if (requesterPublicAddress) {
    params.set("requesterPublicAddress", requesterPublicAddress);
  }
  if (typeof limit === "number") {
    params.set("limit", String(limit));
  }
  if (beforeEntryId) {
    params.set("beforeEntryId", beforeEntryId);
  }

  const response = await fetch(buildApiUrl(`/api/social/posts/thread-replies?${params.toString()}`), {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    return { success: false, message: `Thread replies request failed (${response.status})`, replies: [], paging: { initialPageSize: 5, loadMorePageSize: 5 }, hasMore: false };
  }

  return (await response.json()) as SocialThreadRepliesPageContract;
}

export async function createSocialThreadEntry(
  postId: string,
  content: string,
  replyToMessageId?: string
): Promise<CreateSocialThreadEntryResult> {
  const credentials = useAppStore.getState().credentials;
  if (!credentials?.signingPrivateKey || !credentials?.signingPublicKey) {
    return { success: false, message: "Not authenticated." };
  }

  const entryId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const authorCommitment = await getAuthorCommitmentBase64();
  const payload: NewFeedMessagePayload = {
    FeedMessageId: entryId,
    FeedId: postId,
    MessageContent: content,
    ...(replyToMessageId ? { ReplyToMessageId: replyToMessageId } : {}),
    ...(authorCommitment ? { AuthorCommitment: authorCommitment } : {}),
  };

  const unsignedTransaction = createUnsignedTransaction(PAYLOAD_GUIDS.NEW_FEED_MESSAGE, payload);
  const signedTransaction = await signByUser(unsignedTransaction, {
    privateKey: hexToBytes(credentials.signingPrivateKey),
    publicSigningAddress: credentials.signingPublicKey,
  });

  const result = await submitTransaction(JSON.stringify(signedTransaction));
  return {
    success: result.successful,
    message: result.message,
    entryId: result.successful ? entryId : undefined,
  };
}
