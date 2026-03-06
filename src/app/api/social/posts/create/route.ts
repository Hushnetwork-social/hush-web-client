import { NextRequest, NextResponse } from "next/server";
import { grpcCall, parseGrpcResponse, encodeString, encodeVarintField, parseVarint, parseString } from "@/lib/grpc/grpc-web-helper";

type CreateSocialPostRequestBody = {
  postId: string;
  authorPublicAddress: string;
  content?: string;
  audience: {
    visibility: "open" | "private";
    circleFeedIds: string[];
  };
  attachments: Array<{
    attachmentId: string;
    mimeType: string;
    size: number;
    fileName: string;
    hash: string;
    kind: "image" | "video";
  }>;
  createdAtUnixMs: number;
};

function encodeVarintLocal(value: number): number[] {
  let remaining = Math.max(0, Math.trunc(value));
  const bytes: number[] = [];
  while (remaining > 0x7f) {
    bytes.push((remaining & 0x7f) | 0x80);
    remaining = Math.floor(remaining / 128);
  }
  bytes.push(remaining & 0x7f);
  return bytes;
}

function encodeMessageField(fieldNumber: number, payloadBytes: number[]): number[] {
  const tag = (fieldNumber << 3) | 2;
  return [...encodeVarintLocal(tag), ...encodeVarintLocal(payloadBytes.length), ...payloadBytes];
}

function buildCreateSocialPostRequest(body: CreateSocialPostRequestBody): Uint8Array {
  const visibility = body.audience.visibility === "private" ? 2 : 1;
  const audienceBytes: number[] = [
    ...encodeVarintField(1, visibility),
    ...body.audience.circleFeedIds.flatMap((feedId) => encodeString(2, feedId)),
  ];

  const attachmentMessages = body.attachments.map((attachment) => {
    const kindValue = attachment.kind === "video" ? 2 : 1;
    const attachmentBytes: number[] = [
      ...encodeString(1, attachment.attachmentId),
      ...encodeString(2, attachment.mimeType),
      ...encodeVarintField(3, Math.max(0, Math.trunc(attachment.size))),
      ...encodeString(4, attachment.fileName),
      ...encodeString(5, attachment.hash),
      ...encodeVarintField(6, kindValue),
    ];
    return encodeMessageField(5, attachmentBytes);
  });

  const bytes = [
    ...encodeString(1, body.postId),
    ...encodeString(2, body.authorPublicAddress),
    ...encodeString(3, body.content ?? ""),
    ...encodeMessageField(4, audienceBytes),
    ...attachmentMessages.flat(),
  ];

  return new Uint8Array(bytes);
}

function parseCreateSocialPostResponse(messageBytes: Uint8Array): {
  success: boolean;
  message: string;
  errorCode?: string;
  permalink?: string;
} {
  const result: {
    success: boolean;
    message: string;
    errorCode?: string;
    permalink?: string;
  } = {
    success: false,
    message: "",
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
      const value = parseString(messageBytes, offset, lengthInfo.value);
      offset += lengthInfo.value;

      if (fieldNumber === 2) {
        result.message = value;
      } else if (fieldNumber === 3) {
        result.errorCode = value;
      } else if (fieldNumber === 4) {
        result.permalink = value;
      }
      continue;
    }

    break;
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateSocialPostRequestBody;
    if (!body.postId || !body.authorPublicAddress) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const normalizedBody: CreateSocialPostRequestBody = {
      ...body,
      content: body.content ?? "",
      attachments: body.attachments ?? [],
    };

    const requestBytes = buildCreateSocialPostRequest(normalizedBody);
    const responseBytes = await grpcCall("rpcHush.HushFeed", "CreateSocialPost", requestBytes);
    const messageBytes = parseGrpcResponse(responseBytes);

    if (!messageBytes) {
      return NextResponse.json({ success: false, message: "Invalid gRPC response" }, { status: 502 });
    }

    return NextResponse.json(parseCreateSocialPostResponse(messageBytes));
  } catch (error) {
    console.error("[API] CreateSocialPost failed:", error);
    return NextResponse.json({ success: false, message: "Failed to create social post" }, { status: 502 });
  }
}
