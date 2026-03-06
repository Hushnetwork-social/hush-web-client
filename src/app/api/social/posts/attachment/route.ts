import { NextRequest, NextResponse } from "next/server";
import {
  buildDownloadSocialPostAttachmentRequest,
  grpcCall,
  parseAllGrpcDataFrames,
  parseAttachmentChunkData,
} from "@/lib/grpc/grpc-web-helper";

export async function GET(request: NextRequest) {
  const attachmentId = request.nextUrl.searchParams.get("attachmentId");
  const postId = request.nextUrl.searchParams.get("postId");
  const requesterPublicAddress = request.nextUrl.searchParams.get("requesterPublicAddress");
  const isAuthenticated = request.nextUrl.searchParams.get("isAuthenticated") === "true";
  const mimeType = request.nextUrl.searchParams.get("mimeType") ?? "application/octet-stream";

  if (!attachmentId || !postId) {
    return NextResponse.json(
      { error: "Missing required parameters: attachmentId, postId" },
      { status: 400 }
    );
  }

  try {
    const requestBytes = buildDownloadSocialPostAttachmentRequest(
      attachmentId,
      postId,
      requesterPublicAddress,
      isAuthenticated
    );
    const responseBytes = await grpcCall(
      "rpcHush.HushFeed",
      "DownloadSocialPostAttachment",
      requestBytes
    );

    const frames = parseAllGrpcDataFrames(responseBytes);
    if (frames.length === 0) {
      return NextResponse.json({ error: "Attachment not found or empty" }, { status: 404 });
    }

    const chunks: Uint8Array[] = [];
    let totalSize = 0;
    for (const frame of frames) {
      const data = parseAttachmentChunkData(frame);
      if (!data) {
        continue;
      }
      chunks.push(data);
      totalSize += data.length;
    }

    if (totalSize === 0) {
      return NextResponse.json({ error: "Attachment data unavailable" }, { status: 404 });
    }

    const result = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return new NextResponse(result, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": totalSize.toString(),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("[API] DownloadSocialPostAttachment failed:", error);
    return NextResponse.json({ error: "Failed to download social attachment" }, { status: 502 });
  }
}
