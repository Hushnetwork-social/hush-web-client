import { NextRequest, NextResponse } from "next/server";
import { encodeString, encodeVarintField, grpcCall, parseGrpcResponse, parseString, parseVarint } from "@/lib/grpc/grpc-web-helper";

type AccessState = "allowed" | "guest_denied" | "unauthorized_denied" | "not_found";

type PermalinkDto = {
  success: boolean;
  message: string;
  accessState: AccessState;
  postId?: string;
  reactionScopeId?: string;
  authorPublicAddress?: string;
  authorCommitment?: string;
  followState?: {
    isFollowing: boolean;
    canFollow: boolean;
  };
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
  errorCode?: string;
};

function parseFollowState(bytes: Uint8Array): { isFollowing: boolean; canFollow: boolean } {
  const followState = { isFollowing: false, canFollow: false };
  let offset = 0;

  while (offset < bytes.length) {
    const tagInfo = parseVarint(bytes, offset);
    offset += tagInfo.bytesRead;
    const fieldNumber = tagInfo.value >>> 3;
    const wireType = tagInfo.value & 0x07;

    if (wireType !== 0) {
      break;
    }

    const valueInfo = parseVarint(bytes, offset);
    offset += valueInfo.bytesRead;
    if (fieldNumber === 1) {
      followState.isFollowing = valueInfo.value === 1;
    } else if (fieldNumber === 2) {
      followState.canFollow = valueInfo.value === 1;
    }
  }

  return followState;
}

function mapAccessState(value: number): AccessState {
  switch (value) {
    case 1:
      return "allowed";
    case 2:
      return "guest_denied";
    case 3:
      return "unauthorized_denied";
    default:
      return "not_found";
  }
}

function buildRequest(postId: string, requesterPublicAddress: string | null, isAuthenticated: boolean): Uint8Array {
  const bytes: number[] = [];
  bytes.push(...encodeString(1, postId));
  if (requesterPublicAddress) {
    bytes.push(...encodeString(2, requesterPublicAddress));
  }
  bytes.push(...encodeVarintField(3, isAuthenticated ? 1 : 0));
  return new Uint8Array(bytes);
}

function parsePermalinkResponse(messageBytes: Uint8Array): PermalinkDto {
  const result: PermalinkDto = {
    success: false,
    message: "",
    accessState: "not_found",
    canInteract: false,
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
      if (fieldNumber === 1) {
        result.success = valueInfo.value === 1;
      } else if (fieldNumber === 3) {
        result.accessState = mapAccessState(valueInfo.value);
      } else if (fieldNumber === 7) {
        result.createdAtBlock = valueInfo.value;
      } else if (fieldNumber === 9) {
        result.canInteract = valueInfo.value === 1;
      } else if (fieldNumber === 18) {
        result.createdAtUnixMs = valueInfo.value;
      }
      continue;
    }

    if (wireType === 2) {
      const lengthInfo = parseVarint(messageBytes, offset);
      offset += lengthInfo.bytesRead;
      if (fieldNumber === 20) {
        const bytes = messageBytes.slice(offset, offset + lengthInfo.value);
        let binary = "";
        for (const value of bytes) {
          binary += String.fromCharCode(value);
        }
        result.authorCommitment = btoa(binary);
        offset += lengthInfo.value;
        continue;
      }
      if (fieldNumber === 21) {
        const bytes = messageBytes.slice(offset, offset + lengthInfo.value);
        result.followState = parseFollowState(bytes);
        offset += lengthInfo.value;
        continue;
      }

      const value = parseString(messageBytes, offset, lengthInfo.value);
      offset += lengthInfo.value;

      if (fieldNumber === 2) {
        result.message = value;
      } else if (fieldNumber === 4) {
        result.postId = value;
      } else if (fieldNumber === 19) {
        result.reactionScopeId = value;
      } else if (fieldNumber === 5) {
        result.authorPublicAddress = value;
      } else if (fieldNumber === 6) {
        result.content = value;
      } else if (fieldNumber === 8) {
        result.circleFeedIds.push(value);
      } else if (fieldNumber === 17) {
        const attachmentBytes = messageBytes.slice(offset - lengthInfo.value, offset);
        result.attachments.push(parseAttachment(attachmentBytes));
      } else if (fieldNumber === 11) {
        result.errorCode = value;
      }
      continue;
    }

    break;
  }

  return result;
}

export async function GET(request: NextRequest) {
  try {
    const postId = request.nextUrl.searchParams.get("postId")?.trim() ?? "";
    if (!postId) {
      return NextResponse.json(
        { success: false, message: "Missing postId", accessState: "not_found", canInteract: false, circleFeedIds: [] },
        { status: 400 }
      );
    }

    const requesterPublicAddress = request.nextUrl.searchParams.get("requesterPublicAddress")?.trim() || null;
    const isAuthenticated = request.nextUrl.searchParams.get("isAuthenticated") === "true";
    const requestBytes = buildRequest(postId, requesterPublicAddress, isAuthenticated);

    const responseBytes = await grpcCall("rpcHush.HushFeed", "GetSocialPostPermalink", requestBytes);
    const messageBytes = parseGrpcResponse(responseBytes);
    if (!messageBytes) {
      return NextResponse.json(
        { success: false, message: "Invalid gRPC response", accessState: "not_found", canInteract: false, circleFeedIds: [] },
        { status: 502 }
      );
    }

    return NextResponse.json(parsePermalinkResponse(messageBytes));
  } catch (error) {
    console.error("[API] GetSocialPostPermalink failed:", error);
    return NextResponse.json(
      { success: false, message: "Failed to resolve permalink", accessState: "not_found", canInteract: false, circleFeedIds: [] },
      { status: 502 }
    );
  }
}
