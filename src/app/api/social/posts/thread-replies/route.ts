import { NextRequest, NextResponse } from "next/server";
import { encodeString, encodeVarintField, grpcCall, parseGrpcResponse, parseString, parseVarint } from "@/lib/grpc/grpc-web-helper";

type SocialThreadEntryDto = {
  postId: string;
  entryId: string;
  kind: "comment" | "reply";
  parentCommentId?: string;
  threadRootId: string;
  reactionScopeId?: string;
  createdAtUnixMs?: number;
  reactionCount: number;
  authorPublicAddress?: string;
  followState?: {
    isFollowing: boolean;
    canFollow: boolean;
  };
  content?: string;
  authorCommitment?: string;
  childReplyCount?: number;
};

function parseFollowState(bytes: Uint8Array): { isFollowing: boolean; canFollow: boolean } {
  const followState = { isFollowing: false, canFollow: false };
  let offset = 0;

  while (offset < bytes.length) {
    const tag = parseVarint(bytes, offset);
    offset += tag.bytesRead;
    const fieldNumber = tag.value >>> 3;
    const wireType = tag.value & 0x07;

    if (wireType !== 0) {
      break;
    }

    const value = parseVarint(bytes, offset);
    offset += value.bytesRead;
    if (fieldNumber === 1) {
      followState.isFollowing = value.value === 1;
    } else if (fieldNumber === 2) {
      followState.canFollow = value.value === 1;
    }
  }

  return followState;
}

type SocialThreadRepliesPageDto = {
  success: boolean;
  message: string;
  replies: SocialThreadEntryDto[];
  paging: { initialPageSize: number; loadMorePageSize: number };
  hasMore: boolean;
};

function buildRequest(
  postId: string,
  threadRootId: string,
  limit: number | null,
  beforeEntryId: string | null,
  requesterPublicAddress: string | null,
  isAuthenticated: boolean
): Uint8Array {
  const bytes: number[] = [];
  bytes.push(...encodeString(1, postId));
  bytes.push(...encodeString(2, threadRootId));
  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    bytes.push(...encodeVarintField(3, Math.trunc(limit)));
  }
  if (beforeEntryId) {
    bytes.push(...encodeString(4, beforeEntryId));
  }
  if (requesterPublicAddress) {
    bytes.push(...encodeString(5, requesterPublicAddress));
  }
  bytes.push(...encodeVarintField(6, isAuthenticated ? 1 : 0));
  return new Uint8Array(bytes);
}

function parseThreadEntry(bytes: Uint8Array): SocialThreadEntryDto {
  const result: SocialThreadEntryDto = {
    postId: "",
    entryId: "",
    kind: "comment",
    threadRootId: "",
    reactionCount: 0,
  };

  let offset = 0;
  while (offset < bytes.length) {
    const tag = parseVarint(bytes, offset);
    offset += tag.bytesRead;
    const fieldNumber = tag.value >>> 3;
    const wireType = tag.value & 0x07;

    if (wireType === 0) {
      const value = parseVarint(bytes, offset);
      offset += value.bytesRead;
      if (fieldNumber === 3) {
        result.kind = value.value === 2 ? "reply" : "comment";
      } else if (fieldNumber === 7) {
        result.createdAtUnixMs = value.value;
      } else if (fieldNumber === 8) {
        result.reactionCount = value.value;
      } else if (fieldNumber === 12) {
        result.childReplyCount = value.value;
      }
      continue;
    }

    if (wireType === 2) {
      const length = parseVarint(bytes, offset);
      offset += length.bytesRead;
      const fieldBytes = bytes.slice(offset, offset + length.value);
      const stringValue = parseString(bytes, offset, length.value);
      offset += length.value;

      if (fieldNumber === 1) {
        result.postId = stringValue;
      } else if (fieldNumber === 2) {
        result.entryId = stringValue;
      } else if (fieldNumber === 4) {
        result.parentCommentId = stringValue;
      } else if (fieldNumber === 5) {
        result.threadRootId = stringValue;
      } else if (fieldNumber === 6) {
        result.reactionScopeId = stringValue;
      } else if (fieldNumber === 9) {
        result.authorPublicAddress = stringValue;
      } else if (fieldNumber === 10) {
        result.content = stringValue;
      } else if (fieldNumber === 11) {
        result.authorCommitment = Buffer.from(fieldBytes).toString("base64");
      } else if (fieldNumber === 13) {
        result.followState = parseFollowState(fieldBytes);
      }
      continue;
    }

    break;
  }

  return result;
}

function parseResponse(messageBytes: Uint8Array): SocialThreadRepliesPageDto {
  const result: SocialThreadRepliesPageDto = {
    success: false,
    message: "",
    replies: [],
    paging: { initialPageSize: 5, loadMorePageSize: 5 },
    hasMore: false,
  };

  let offset = 0;
  while (offset < messageBytes.length) {
    const tag = parseVarint(messageBytes, offset);
    offset += tag.bytesRead;
    const fieldNumber = tag.value >>> 3;
    const wireType = tag.value & 0x07;

    if (wireType === 0) {
      const value = parseVarint(messageBytes, offset);
      offset += value.bytesRead;
      if (fieldNumber === 1) {
        result.success = value.value === 1;
      } else if (fieldNumber === 5) {
        result.hasMore = value.value === 1;
      }
      continue;
    }

    if (wireType === 2) {
      const length = parseVarint(messageBytes, offset);
      offset += length.bytesRead;
      const fieldBytes = messageBytes.slice(offset, offset + length.value);

      if (fieldNumber === 2) {
        result.message = parseString(messageBytes, offset, length.value);
      } else if (fieldNumber === 3) {
        result.replies.push(parseThreadEntry(fieldBytes));
      } else if (fieldNumber === 4) {
        let nestedOffset = 0;
        while (nestedOffset < fieldBytes.length) {
          const nestedTag = parseVarint(fieldBytes, nestedOffset);
          nestedOffset += nestedTag.bytesRead;
          const nestedFieldNumber = nestedTag.value >>> 3;
          const nestedValue = parseVarint(fieldBytes, nestedOffset);
          nestedOffset += nestedValue.bytesRead;
          if (nestedFieldNumber === 1) {
            result.paging.initialPageSize = nestedValue.value;
          } else if (nestedFieldNumber === 2) {
            result.paging.loadMorePageSize = nestedValue.value;
          }
        }
      }

      offset += length.value;
      continue;
    }

    break;
  }

  return result;
}

export async function GET(request: NextRequest) {
  try {
    const postId = request.nextUrl.searchParams.get("postId")?.trim() ?? "";
    const threadRootId = request.nextUrl.searchParams.get("threadRootId")?.trim() ?? "";
    if (!postId || !threadRootId) {
      return NextResponse.json({ success: false, message: "Missing postId or threadRootId", replies: [], paging: { initialPageSize: 5, loadMorePageSize: 5 }, hasMore: false }, { status: 400 });
    }

    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : null;
    const beforeEntryId = request.nextUrl.searchParams.get("beforeEntryId")?.trim() || null;
    const requesterPublicAddress = request.nextUrl.searchParams.get("requesterPublicAddress")?.trim() || null;
    const isAuthenticated = request.nextUrl.searchParams.get("isAuthenticated") === "true";

    const requestBytes = buildRequest(postId, threadRootId, limit, beforeEntryId, requesterPublicAddress, isAuthenticated);
    const responseBytes = await grpcCall("rpcHush.HushFeed", "GetSocialThreadReplies", requestBytes);
    const messageBytes = parseGrpcResponse(responseBytes);
    if (!messageBytes) {
      return NextResponse.json({ success: false, message: "Invalid gRPC response", replies: [], paging: { initialPageSize: 5, loadMorePageSize: 5 }, hasMore: false }, { status: 502 });
    }

    return NextResponse.json(parseResponse(messageBytes));
  } catch (error) {
    console.error("[API] GetSocialThreadReplies failed:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch thread replies", replies: [], paging: { initialPageSize: 5, loadMorePageSize: 5 }, hasMore: false }, { status: 502 });
  }
}
