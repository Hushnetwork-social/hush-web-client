import { NextRequest, NextResponse } from "next/server";
import { getSocialPermalink } from "@/modules/social/server/getSocialPermalink";

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
    return NextResponse.json(await getSocialPermalink(postId, requesterPublicAddress, isAuthenticated));
  } catch (error) {
    console.error("[API] GetSocialPostPermalink failed:", error);
    return NextResponse.json(
      { success: false, message: "Failed to resolve permalink", accessState: "not_found", canInteract: false, circleFeedIds: [] },
      { status: 502 }
    );
  }
}
