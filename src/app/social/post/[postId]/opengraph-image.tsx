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
  const compactPreview =
    previewText.length > 120 ? `${previewText.slice(0, 117).trimEnd()}...` : previewText;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(135deg, rgba(11,17,33,1) 0%, rgba(21,31,59,1) 52%, rgba(71,61,132,1) 100%)",
          color: "#f4eeff",
          padding: "42px",
          fontFamily: "Arial, sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: "420px",
            height: "420px",
            right: "-120px",
            top: "-90px",
            borderRadius: "999px",
            background: "radial-gradient(circle, rgba(177,146,255,0.26) 0%, rgba(177,146,255,0) 68%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: "320px",
            height: "320px",
            left: "-90px",
            bottom: "-120px",
            borderRadius: "999px",
            background: "radial-gradient(circle, rgba(80,224,210,0.14) 0%, rgba(80,224,210,0) 70%)",
          }}
        />
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
            padding: "30px",
            background: "rgba(6, 10, 22, 0.52)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "22px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: "120px",
                  height: "120px",
                  borderRadius: "999px",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "linear-gradient(180deg, rgba(144,112,255,0.28) 0%, rgba(104,84,208,0.18) 100%)",
                  border: "3px solid rgba(191,174,255,0.55)",
                  fontSize: "42px",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                }}
              >
                {initials}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "660px" }}>
                <div style={{ display: "flex", fontSize: "18px", color: "#c7b6ff", fontWeight: 700, letterSpacing: "0.08em" }}>
                  HUSHSOCIAL
                </div>
                <div style={{ display: "flex", fontSize: "46px", fontWeight: 700, lineHeight: 1.05 }}>{displayName}</div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                padding: "12px 18px",
                borderRadius: "999px",
                border: "1px solid rgba(190,171,255,0.28)",
                background: "rgba(135,109,255,0.12)",
                color: "#d6c9ff",
                fontSize: "18px",
                fontWeight: 600,
              }}
            >
              HushNetwork.social
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              marginTop: "18px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: "48px",
                fontWeight: 600,
                lineHeight: 1.14,
                whiteSpace: "pre-wrap",
                maxWidth: "900px",
              }}
            >
              {compactPreview}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "#bbaaff",
              fontSize: "22px",
            }}
          >
            <div style={{ display: "flex" }}>Secure decentralized social post</div>
            <div style={{ display: "flex", color: "#8f83c7" }}>Reply, react, and follow on HushSocial</div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
