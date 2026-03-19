import type { Metadata } from "next";
import { headers } from "next/headers";
import type { SocialPermalinkPayloadContract } from "@/modules/social/PermalinkService";

export const isStaticExport = process.env.STATIC_EXPORT === "true";
export const skipSsrFetch =
  process.env.NODE_ENV === "production" && process.env.GRPC_SERVER_URL?.includes("docker");

export type SocialPermalinkMetadataPayload = SocialPermalinkPayloadContract & {
  openGraph?: {
    title: string;
    description: string;
    imageUrl?: string;
    isGenericPrivate: boolean;
    cacheControl: string;
  };
};

export function getDisplayInitials(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "HS";
  }

  const words = trimmed
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (words.length === 0) {
    return "HS";
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

export function summarizePostContent(content?: string): string {
  const normalized = (content ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "Open this post in HushSocial on HushNetwork.social.";
  }

  if (normalized.length <= 180) {
    return normalized;
  }

  return `${normalized.slice(0, 177).trimEnd()}...`;
}

function resolveAbsoluteUrl(baseUrl: string, candidate: string): string {
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return candidate;
  }
}

export async function getRequestBaseUrl(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("host") || "chat.hushnetwork.social";
  const protocol = headersList.get("x-forwarded-proto") || "https";
  const internalUrl = process.env.INTERNAL_API_URL?.trim();

  return internalUrl || `${protocol}://${host}`;
}

export async function fetchPermalinkMetadataPayload(
  postId: string
): Promise<SocialPermalinkMetadataPayload | null> {
  if (isStaticExport || skipSsrFetch || !postId || postId === "_placeholder") {
    return null;
  }

  try {
    const baseUrl = await getRequestBaseUrl();
    const response = await fetch(
      `${baseUrl}/api/social/posts/permalink?postId=${encodeURIComponent(postId)}&isAuthenticated=false`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as SocialPermalinkMetadataPayload;
  } catch {
    return null;
  }
}

export async function fetchAuthorDisplayName(authorPublicAddress?: string): Promise<string | null> {
  const address = authorPublicAddress?.trim();
  if (!address || isStaticExport || skipSsrFetch) {
    return null;
  }

  try {
    const baseUrl = await getRequestBaseUrl();
    const response = await fetch(
      `${baseUrl}/api/identity/check?address=${encodeURIComponent(address)}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      exists?: boolean;
      identity?: { profileName?: string | null };
    };
    const profileName = payload.identity?.profileName?.trim();
    return profileName && profileName.length > 0 ? profileName : null;
  } catch {
    return null;
  }
}

export function resolvePermalinkPreviewImageUrl(
  baseUrl: string,
  postId: string,
  payload: SocialPermalinkMetadataPayload,
  fallbackPath: string
): string {
  const openGraphImage = payload.openGraph?.imageUrl?.trim();
  if (openGraphImage) {
    return resolveAbsoluteUrl(baseUrl, openGraphImage);
  }

  const firstImageAttachment = payload.attachments.find((attachment) => attachment.kind === "image");
  if (firstImageAttachment) {
    return resolveAbsoluteUrl(
      baseUrl,
      `/api/social/posts/attachment?attachmentId=${encodeURIComponent(firstImageAttachment.attachmentId)}&postId=${encodeURIComponent(
        postId
      )}&isAuthenticated=false&requesterPublicAddress=&mimeType=${encodeURIComponent(firstImageAttachment.mimeType)}`
    );
  }

  return resolveAbsoluteUrl(baseUrl, fallbackPath);
}

export function buildPermalinkMetadata(args: {
  baseUrl: string;
  postId: string;
  payload: SocialPermalinkMetadataPayload | null;
  authorName: string | null;
}): Metadata {
  const { baseUrl, postId, payload, authorName } = args;
  const fallbackTitle = "Post on HushSocial";
  const fallbackDescription = "Open this post in HushSocial on HushNetwork.social.";

  if (!payload) {
    return {
      title: fallbackTitle,
      description: fallbackDescription,
      openGraph: {
        title: fallbackTitle,
        description: fallbackDescription,
        siteName: "HushNetwork.social",
        type: "article",
        url: `/social/post/${postId}`,
      },
      twitter: {
        card: "summary_large_image",
        title: fallbackTitle,
        description: fallbackDescription,
      },
    };
  }

  const canonicalUrl = `/social/post/${postId}`;
  const fallbackImagePath = `/social/post/${postId}/opengraph-image`;
  const displayName = authorName?.trim() || "HushSocial user";
  const isPrivate = payload.openGraph?.isGenericPrivate === true || payload.accessState !== "allowed";
  const title = isPrivate
    ? payload.openGraph?.title?.trim() || "Private post on HushSocial"
    : `${displayName} on HushSocial`;
  const description = isPrivate
    ? payload.openGraph?.description?.trim() || "Sign in to view this post."
    : summarizePostContent(payload.content || payload.openGraph?.description);
  const imageUrl = resolvePermalinkPreviewImageUrl(baseUrl, postId, payload, fallbackImagePath);

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      siteName: "HushNetwork.social",
      type: "article",
      url: canonicalUrl,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}
