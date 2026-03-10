import { NextRequest, NextResponse } from "next/server";
import {
  buildGetTalliesRequest,
  grpcCall,
  parseGetTalliesResponse,
  parseGrpcResponse,
  type ReactionTally,
  uuidToBytes,
} from "@/lib/grpc/grpc-web-helper";

type TalliesRequestBody = {
  feedId?: string;
  messageIds?: string[];
};

type ReactionTallyDto = {
  messageId: string;
  tallyC1: { x: string; y: string }[];
  tallyC2: { x: string; y: string }[];
  reactionCount: number;
};

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  for (const value of bytes) {
    binary += String.fromCharCode(value);
  }
  return btoa(binary);
}

function mapTally(tally: ReactionTally): ReactionTallyDto {
  return {
    messageId: tally.messageId,
    tallyC1: tally.tallyC1.map((point) => ({
      x: toBase64(point.x),
      y: toBase64(point.y),
    })),
    tallyC2: tally.tallyC2.map((point) => ({
      x: toBase64(point.x),
      y: toBase64(point.y),
    })),
    reactionCount: tally.reactionCount,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TalliesRequestBody;
    const feedId = body.feedId?.trim() ?? "";
    const messageIds = (body.messageIds ?? []).map((value) => value.trim()).filter((value) => value.length > 0);

    if (!feedId || messageIds.length === 0) {
      return NextResponse.json({ success: false, message: "feedId and messageIds are required", tallies: [] }, { status: 400 });
    }

    const requestBytes = buildGetTalliesRequest(
      uuidToBytes(feedId),
      messageIds.map((messageId) => uuidToBytes(messageId))
    );

    const responseBytes = await grpcCall("rpcHush.HushReactions", "GetReactionTallies", requestBytes);
    const messageBytes = parseGrpcResponse(responseBytes);

    if (!messageBytes) {
      return NextResponse.json({ success: true, message: "No tallies", tallies: [] });
    }

    const parsed = parseGetTalliesResponse(messageBytes);
    return NextResponse.json({
      success: true,
      message: "Tallies resolved.",
      tallies: parsed.tallies.map(mapTally),
    });
  } catch (error) {
    console.error("[API] GetReactionTallies failed:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch reaction tallies", tallies: [] }, { status: 502 });
  }
}
