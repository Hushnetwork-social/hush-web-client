import { ImageResponse } from "next/og";
import {
  fetchAuthorDisplayName,
  fetchPermalinkMetadataPayload,
  getDisplayInitials,
  isStaticExport,
  summarizePostContent,
} from "./permalinkMetadata";

export const runtime = "nodejs";
export const dynamic = "force-static";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

type PageProps = {
  params: Promise<{ postId: string }>;
};

export function generateStaticParams(): Array<{ postId: string }> {
  if (isStaticExport) {
    return [{ postId: "_placeholder" }];
  }

  return [];
}

export default async function OpenGraphImage({ params }: PageProps) {
  const { postId } = await params;
  const payload = await fetchPermalinkMetadataPayload(postId);
  const authorName = await fetchAuthorDisplayName(payload?.authorPublicAddress);
  const displayName = authorName?.trim() || "HushSocial user";
  const previewText =
    payload?.accessState === "allowed"
      ? summarizePostContent(payload.content || payload.openGraph?.description)
      : payload?.openGraph?.description?.trim() || "Sign in to view this post.";
  const initials = getDisplayInitials(displayName);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(135deg, rgba(15,24,45,1) 0%, rgba(31,44,79,1) 55%, rgba(80,64,153,1) 100%)",
          color: "#f4eeff",
          padding: "48px",
          fontFamily: "Arial, sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "24px",
            border: "1px solid rgba(182, 147, 255, 0.25)",
            borderRadius: "28px",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            borderRadius: "24px",
            padding: "28px",
            background: "rgba(7, 11, 24, 0.46)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
            <div
              style={{
                display: "flex",
                width: "112px",
                height: "112px",
                borderRadius: "999px",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(140, 108, 255, 0.18)",
                border: "3px solid rgba(170, 145, 255, 0.55)",
                fontSize: "40px",
                fontWeight: 700,
                letterSpacing: "0.04em",
              }}
            >
              {initials}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", fontSize: "20px", color: "#bfaeff", fontWeight: 700 }}>
                HushSocial!
              </div>
              <div style={{ display: "flex", fontSize: "42px", fontWeight: 700 }}>{displayName}</div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "18px",
              marginTop: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: "44px",
                fontWeight: 600,
                lineHeight: 1.2,
                whiteSpace: "pre-wrap",
              }}
            >
              {previewText}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "#c8b7ff",
              fontSize: "24px",
            }}
          >
            <div style={{ display: "flex" }}>HushNetwork.social</div>
            <div style={{ display: "flex" }}>Secure decentralized social posts</div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
