import { Suspense } from "react";
import type { Metadata } from "next";
import SocialPostPermalinkClient from "./SocialPostPermalinkClient";
import {
  buildPermalinkMetadata,
  fetchAuthorDisplayName,
  fetchPermalinkMetadataPayload,
  getRequestBaseUrl,
  isStaticExport,
  skipSsrFetch,
} from "./permalinkMetadata";

type PageProps = {
  params: Promise<{ postId: string }>;
};

export function generateStaticParams(): Array<{ postId: string }> {
  if (isStaticExport) {
    return [{ postId: "_placeholder" }];
  }

  return [];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { postId } = await params;

  if (isStaticExport || skipSsrFetch || !postId || postId === "_placeholder") {
    return {
      title: "Post on HushSocial",
      description: "Open this post in HushSocial on HushNetwork.social.",
    };
  }

  const [baseUrl, payload] = await Promise.all([
    getRequestBaseUrl(),
    fetchPermalinkMetadataPayload(postId),
  ]);
  const authorName = await fetchAuthorDisplayName(payload?.authorPublicAddress);

  return buildPermalinkMetadata({
    baseUrl,
    postId,
    payload,
    authorName,
  });
}

export default function SocialPostPermalinkPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-hush-text-accent">Loading post...</div>}>
      <SocialPostPermalinkClient />
    </Suspense>
  );
}
