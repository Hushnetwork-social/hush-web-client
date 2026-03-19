import { NextRequest, NextResponse } from "next/server";
import {
  encodeString,
  grpcCall,
  parseGrpcResponse,
  parseString,
  parseVarint,
} from "@/lib/grpc/grpc-web-helper";

type FollowSocialAuthorRequestBody = {
  viewerPublicAddress?: string;
  authorPublicAddress?: string;
  authorPublicEncryptAddress?: string;
  requesterPublicAddress?: string;
};

function buildRequest(body: FollowSocialAuthorRequestBody): Uint8Array {
  const bytes: number[] = [];
  bytes.push(...encodeString(1, body.viewerPublicAddress ?? ""));
  bytes.push(...encodeString(2, body.authorPublicAddress ?? ""));

  const authorPublicEncryptAddress = body.authorPublicEncryptAddress?.trim();
  if (authorPublicEncryptAddress) {
    bytes.push(...encodeString(3, authorPublicEncryptAddress));
  }

  bytes.push(...encodeString(4, body.requesterPublicAddress ?? ""));
  return new Uint8Array(bytes);
}

function parseResponse(messageBytes: Uint8Array) {
  const result = {
    success: false,
    message: "",
    errorCode: undefined as string | undefined,
    innerCircleFeedId: undefined as string | undefined,
    alreadyFollowing: false,
    requiresSyncRefresh: false,
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
        result.alreadyFollowing = value.value === 1;
      } else if (fieldNumber === 6) {
        result.requiresSyncRefresh = value.value === 1;
      }

      continue;
    }

    if (wireType === 2) {
      const length = parseVarint(messageBytes, offset);
      offset += length.bytesRead;
      const value = parseString(messageBytes, offset, length.value);
      offset += length.value;

      if (fieldNumber === 2) {
        result.message = value;
      } else if (fieldNumber === 3) {
        result.errorCode = value;
      } else if (fieldNumber === 4) {
        result.innerCircleFeedId = value;
      }

      continue;
    }

    break;
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as FollowSocialAuthorRequestBody;
    const viewerPublicAddress = body.viewerPublicAddress?.trim() ?? "";
    const authorPublicAddress = body.authorPublicAddress?.trim() ?? "";
    const requesterPublicAddress = body.requesterPublicAddress?.trim() ?? "";

    if (!viewerPublicAddress || !authorPublicAddress || !requesterPublicAddress) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing required parameters",
          alreadyFollowing: false,
          requiresSyncRefresh: false,
        },
        { status: 400 }
      );
    }

    const responseBytes = await grpcCall(
      "rpcHush.HushFeed",
      "FollowSocialAuthor",
      buildRequest({
        viewerPublicAddress,
        authorPublicAddress,
        authorPublicEncryptAddress: body.authorPublicEncryptAddress,
        requesterPublicAddress,
      })
    );
    const messageBytes = parseGrpcResponse(responseBytes);

    if (!messageBytes) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid gRPC response",
          alreadyFollowing: false,
          requiresSyncRefresh: false,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(parseResponse(messageBytes));
  } catch (error) {
    console.error("[API] FollowSocialAuthor failed:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to follow author",
        alreadyFollowing: false,
        requiresSyncRefresh: false,
      },
      { status: 502 }
    );
  }
}
