"use client";

import { memo, useMemo } from "react";
import { ContentCarousel } from "@/components/chat/ContentCarousel";
import { LinkPreviewCard } from "./LinkPreviewCard";
import { LinkPreviewSkeleton } from "./LinkPreviewSkeleton";
import type { UrlMetadata } from "@/lib/urlDetector/urlMetadataCache";
import type { ParsedUrl } from "@/lib/urlDetector/urlDetector";

interface LinkPreviewCarouselProps {
  /** List of parsed URLs to display */
  urls: ParsedUrl[];
  /** Map of URL to metadata (null if fetch failed) */
  metadataMap: Map<string, UrlMetadata | null>;
  /** Set of URLs currently being loaded */
  loadingUrls: Set<string>;
}

/**
 * LinkPreviewCarousel Component
 *
 * Displays multiple link previews with navigation controls.
 * Delegates carousel behavior to the generic ContentCarousel.
 */
export const LinkPreviewCarousel = memo(function LinkPreviewCarousel({
  urls,
  metadataMap,
  loadingUrls,
}: LinkPreviewCarouselProps) {
  // Build children array from URL data
  const children = useMemo(() => {
    return urls.map((parsedUrl) => {
      const normalizedUrl = parsedUrl.normalizedUrl;
      const isLoading = loadingUrls.has(normalizedUrl);
      const metadata = metadataMap.get(normalizedUrl);

      if (isLoading) {
        return <LinkPreviewSkeleton key={normalizedUrl} />;
      }

      if (metadata && metadata.success) {
        return <LinkPreviewCard key={normalizedUrl} metadata={metadata} />;
      }

      if (metadata && !metadata.success) {
        return (
          <LinkPreviewCard
            key={normalizedUrl}
            metadata={{
              ...metadata,
              title: metadata.domain,
              description: metadata.errorMessage || "Could not load preview",
            }}
          />
        );
      }

      return <LinkPreviewSkeleton key={normalizedUrl} />;
    });
  }, [urls, metadataMap, loadingUrls]);

  if (urls.length === 0) {
    return null;
  }

  return (
    <ContentCarousel ariaLabel="Link previews">
      {children}
    </ContentCarousel>
  );
});
