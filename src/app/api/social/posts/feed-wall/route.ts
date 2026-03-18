import { NextRequest, NextResponse } from "next/server";
import { grpcCall, parseGrpcResponse, encodeString, encodeVarintField, parseVarint, parseString } from "@/lib/grpc/grpc-web-helper";

type SocialFeedWallPostDto = {
  postId: string;
  reactionScopeId?: string;
  authorPublicAddress: string;
  authorCommitment?: string;
  content: string;
  createdAtBlock: number;
  createdAtUnixMs: number;
  replyCount?: number;
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

type SocialFeedWallResponseDto = {
  success: boolean;
  message: string;
  errorCode?: string;
  posts: SocialFeedWallPostDto[];
};

function buildGetSocialFeedWallRequest(
  requesterPublicAddress: string | null,
  isAuthenticated: boolean,
  limit: number
): Uint8Array {
  const bytes: number[] = [];
  if (requesterPublicAddress) {
    bytes.push(...encodeString(1, requesterPublicAddress));
  }
  bytes.push(...encodeVarintField(2, isAuthenticated ? 1 : 0));
  bytes.push(...encodeVarintField(3, Math.max(1, Math.min(200, Math.trunc(limit)))));
  return new Uint8Array(bytes);
}

function parseSocialFeedWallPost(messageBytes: Uint8Array): SocialFeedWallPostDto {
  const result: SocialFeedWallPostDto = {
    postId: "",
    authorPublicAddress: "",
    content: "",
    createdAtBlock: 0,
    createdAtUnixMs: 0,
    visibility: "open",
    circleFeedIds: [],
    attachments: [],
  };

  const parseAttachment = (bytes: Uint8Array) => {
    const attachment = {
      attachmentId: "",
      mimeType: "",
      size: 0,
      fileName: "",
      hash: "",
      kind: "image" as "image" | "video",
    };

    let nestedOffset = 0;
    while (nestedOffset < bytes.length) {
      const nestedTag = parseVarint(bytes, nestedOffset);
      nestedOffset += nestedTag.bytesRead;
      const nestedField = nestedTag.value >>> 3;
      const nestedWire = nestedTag.value & 0x07;

      if (nestedWire === 0) {
        const valueInfo = parseVarint(bytes, nestedOffset);
        nestedOffset += valueInfo.bytesRead;
        if (nestedField === 3) {
          attachment.size = valueInfo.value;
        } else if (nestedField === 6) {
          attachment.kind = valueInfo.value === 2 ? "video" : "image";
        }
        continue;
      }

      if (nestedWire === 2) {
        const lengthInfo = parseVarint(bytes, nestedOffset);
        nestedOffset += lengthInfo.bytesRead;
        const value = parseString(bytes, nestedOffset, lengthInfo.value);
        nestedOffset += lengthInfo.value;

        if (nestedField === 1) {
          attachment.attachmentId = value;
        } else if (nestedField === 2) {
          attachment.mimeType = value;
        } else if (nestedField === 4) {
          attachment.fileName = value;
        } else if (nestedField === 5) {
          attachment.hash = value;
        }
        continue;
      }

      break;
    }

    return attachment;
  };

  let offset = 0;
  while (offset < messageBytes.length) {
    const tagInfo = parseVarint(messageBytes, offset);
    offset += tagInfo.bytesRead;
    const fieldNumber = tagInfo.value >>> 3;
    const wireType = tagInfo.value & 0x07;

    if (wireType === 0) {
      const valueInfo = parseVarint(messageBytes, offset);
      offset += valueInfo.bytesRead;
      if (fieldNumber === 4) {
        result.createdAtBlock = valueInfo.value;
      } else if (fieldNumber === 5) {
        result.visibility = valueInfo.value === 2 ? "private" : "open";
      } else if (fieldNumber === 7) {
        result.createdAtUnixMs = valueInfo.value;
      } else if (fieldNumber === 11) {
        result.replyCount = valueInfo.value;
      }
      continue;
    }

    if (wireType === 2) {
      const lengthInfo = parseVarint(messageBytes, offset);
      offset += lengthInfo.bytesRead;
      if (fieldNumber === 10) {
        const bytes = messageBytes.slice(offset, offset + lengthInfo.value);
        let binary = "";
        for (const value of bytes) {
          binary += String.fromCharCode(value);
        }
        result.authorCommitment = btoa(binary);
        offset += lengthInfo.value;
        continue;
      }

      const value = parseString(messageBytes, offset, lengthInfo.value);
      offset += lengthInfo.value;

      if (fieldNumber === 1) {
        result.postId = value;
      } else if (fieldNumber === 9) {
        result.reactionScopeId = value;
      } else if (fieldNumber === 2) {
        result.authorPublicAddress = value;
      } else if (fieldNumber === 3) {
        result.content = value;
      } else if (fieldNumber === 6) {
        result.circleFeedIds.push(value);
      } else if (fieldNumber === 8) {
        const attachmentBytes = messageBytes.slice(offset - lengthInfo.value, offset);
        result.attachments.push(parseAttachment(attachmentBytes));
      }
      continue;
    }

    break;
  }

  return result;
}

function parseGetSocialFeedWallResponse(messageBytes: Uint8Array): SocialFeedWallResponseDto {
  const result: SocialFeedWallResponseDto = {
    success: false,
    message: "",
    posts: [],
  };

  let offset = 0;
  while (offset < messageBytes.length) {
    const tagInfo = parseVarint(messageBytes, offset);
    offset += tagInfo.bytesRead;
    const fieldNumber = tagInfo.value >>> 3;
    const wireType = tagInfo.value & 0x07;

    if (wireType === 0) {
      const valueInfo = parseVarint(messageBytes, offset);
      offset += valueInfo.bytesRead;
      if (fieldNumber === 1) {
        result.success = valueInfo.value === 1;
      }
      continue;
    }

    if (wireType === 2) {
      const lengthInfo = parseVarint(messageBytes, offset);
      offset += lengthInfo.bytesRead;

      if (fieldNumber === 3) {
        const nested = messageBytes.slice(offset, offset + lengthInfo.value);
        result.posts.push(parseSocialFeedWallPost(nested));
      } else {
        const value = parseString(messageBytes, offset, lengthInfo.value);
        if (fieldNumber === 2) {
          result.message = value;
        } else if (fieldNumber === 4) {
          result.errorCode = value;
        }
      }

      offset += lengthInfo.value;
      continue;
    }

    break;
  }

  return result;
}

export async function GET(request: NextRequest) {
  try {
    const requesterPublicAddress = request.nextUrl.searchParams.get("requesterPublicAddress");
    const isAuthenticated = request.nextUrl.searchParams.get("isAuthenticated") === "true";
    const limitParam = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "50", 10);
    const limit = Number.isFinite(limitParam) ? limitParam : 50;

    const requestBytes = buildGetSocialFeedWallRequest(
      requesterPublicAddress,
      isAuthenticated,
      limit
    );
    const responseBytes = await grpcCall("rpcHush.HushFeed", "GetSocialFeedWall", requestBytes);
    const messageBytes = parseGrpcResponse(responseBytes);

    if (!messageBytes) {
      return NextResponse.json({ success: false, message: "Invalid gRPC response", posts: [] }, { status: 502 });
    }

    return NextResponse.json(parseGetSocialFeedWallResponse(messageBytes));
  } catch (error) {
    console.error("[API] GetSocialFeedWall failed:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch social feed wall", posts: [] }, { status: 502 });
  }
}
