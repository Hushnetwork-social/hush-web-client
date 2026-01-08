import type { Metadata } from "next";
import { headers } from "next/headers";
import { JoinByCodeClient } from "./JoinByCodeClient";

// Force dynamic rendering for this page (needs to fetch group info)
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ code: string }>;
}

/**
 * Fetch group info from the API for metadata generation
 */
async function getGroupInfo(code: string): Promise<{
  success: boolean;
  feedId?: string;
  title?: string;
  description?: string;
  memberCount?: number;
  isPublic?: boolean;
} | null> {
  try {
    // Get the host from request headers to construct internal URL
    const headersList = await headers();
    const host = headersList.get("host") || "chat.hushnetwork.social";
    const protocol = headersList.get("x-forwarded-proto") || "https";

    // For server-side fetches, try localhost first (faster), then fall back to host
    const internalUrl = process.env.INTERNAL_API_URL;
    const baseUrl = internalUrl || `${protocol}://${host}`;

    console.log(`[JoinPage] Fetching group info from: ${baseUrl}/api/groups/by-code?code=${code}`);

    const response = await fetch(`${baseUrl}/api/groups/by-code?code=${encodeURIComponent(code)}`, {
      cache: "no-store", // Always fetch fresh data for OG tags
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.log(`[JoinPage] Failed to fetch group info: ${response.status}`);
      return null;
    }

    const result = await response.json();
    console.log(`[JoinPage] Group info result: success=${result.success}, title=${result.title}`);
    return result;
  } catch (error) {
    console.error("[JoinPage] Error fetching group info for metadata:", error);
    return null;
  }
}

/**
 * Generate dynamic metadata for Open Graph previews
 * This allows WhatsApp, Telegram, etc. to show group name and description
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const groupInfo = await getGroupInfo(code);

  // Default metadata if group not found
  if (!groupInfo?.success || !groupInfo.title) {
    return {
      title: "Join Group - Hush Feeds",
      description: "Join a group on Hush Feeds - Secure, decentralized messaging",
      openGraph: {
        title: "Join Group - Hush Feeds",
        description: "Join a group on Hush Feeds - Secure, decentralized messaging powered by HushNetwork blockchain",
        siteName: "Hush Feeds",
        type: "website",
      },
      twitter: {
        card: "summary",
        title: "Join Group - Hush Feeds",
        description: "Join a group on Hush Feeds - Secure, decentralized messaging",
      },
    };
  }

  // Dynamic metadata with group info
  const title = `Join "${groupInfo.title}" - Hush Feeds`;
  const description = groupInfo.description
    ? `${groupInfo.description} (${groupInfo.memberCount} member${groupInfo.memberCount !== 1 ? "s" : ""})`
    : `Join this group on Hush Feeds (${groupInfo.memberCount} member${groupInfo.memberCount !== 1 ? "s" : ""})`;

  return {
    title,
    description,
    openGraph: {
      title: groupInfo.title,
      description,
      siteName: "Hush Feeds",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: groupInfo.title,
      description,
    },
  };
}

/**
 * Join by invite code page
 * Server component that generates OG metadata and renders the client component
 */
export default async function JoinByCodePage({ params }: PageProps) {
  const { code } = await params;

  // Pre-fetch group info to pass to client (avoids double fetch)
  const groupInfo = await getGroupInfo(code);

  // Convert to client-expected format
  const initialGroupInfo = groupInfo?.success && groupInfo.title ? {
    feedId: groupInfo.feedId || "",
    name: groupInfo.title,
    description: groupInfo.description || "",
    memberCount: groupInfo.memberCount || 0,
    isPublic: groupInfo.isPublic ?? true, // Groups accessed by invite code are typically public
  } : null;

  return <JoinByCodeClient initialGroupInfo={initialGroupInfo} />;
}
