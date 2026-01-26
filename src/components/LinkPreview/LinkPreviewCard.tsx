"use client";

import { memo } from "react";
import Image from "next/image";
import { Link as LinkIcon } from "lucide-react";
import type { UrlMetadata } from "@/lib/urlDetector/urlMetadataCache";

// Constants for truncation
const MAX_TITLE_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 120;

interface LinkPreviewCardProps {
  /** URL metadata to display */
  metadata: UrlMetadata;
  /** Optional click handler (defaults to opening URL in new tab) */
  onClick?: () => void;
}

/**
 * Truncates text to a maximum length with ellipsis
 */
function truncateText(text: string | null, maxLength: number): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trimEnd() + "...";
}

/**
 * LinkPreviewCard Component
 *
 * Displays a rich preview of a URL with thumbnail, title, description, and domain.
 * Clicking the card opens the URL in a new tab.
 */
export const LinkPreviewCard = memo(function LinkPreviewCard({
  metadata,
  onClick,
}: LinkPreviewCardProps) {
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // Default: open URL in new tab
      window.open(metadata.url, "_blank", "noopener,noreferrer");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  // Prepare display values
  const title = truncateText(metadata.title, MAX_TITLE_LENGTH) || metadata.domain;
  const description = truncateText(metadata.description, MAX_DESCRIPTION_LENGTH);
  const hasImage = !!metadata.imageBase64;

  // Construct aria-label for screen readers
  const ariaLabel = `Link preview: ${metadata.title || metadata.domain} from ${metadata.domain}`;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="
        flex items-start gap-3
        p-3
        bg-hush-bg-hover/40
        border border-hush-border/50
        rounded-lg
        cursor-pointer
        hover:bg-hush-bg-hover/60
        hover:border-hush-border
        transition-all duration-150
        focus:outline-none focus:ring-2 focus:ring-hush-purple/50
        max-w-full
        overflow-hidden
      "
      aria-label={ariaLabel}
    >
      {/* Thumbnail or fallback icon */}
      <div className="flex-shrink-0">
        {hasImage ? (
          <Image
            src={`data:image/jpeg;base64,${metadata.imageBase64}`}
            alt=""
            width={100}
            height={100}
            className="w-[100px] h-[100px] rounded-md object-cover bg-hush-bg-hover"
            unoptimized
          />
        ) : (
          <div
            className="
              w-[100px] h-[100px]
              rounded-md
              bg-hush-bg-hover
              flex items-center justify-center
            "
            aria-hidden="true"
          >
            <LinkIcon size={32} className="text-hush-text-accent/50" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        {/* Title */}
        <h4
          className="
            text-sm font-medium text-hush-text-primary
            truncate
            leading-tight
          "
          title={metadata.title || undefined}
        >
          {title}
        </h4>

        {/* Description */}
        {description && (
          <p
            className="
              mt-1
              text-xs text-hush-text-secondary
              line-clamp-2
              leading-relaxed
            "
            title={metadata.description || undefined}
          >
            {description}
          </p>
        )}

        {/* Domain */}
        <p
          className="
            mt-2
            text-xs text-hush-text-accent
            truncate
            flex items-center gap-1
          "
        >
          <LinkIcon size={12} className="flex-shrink-0" aria-hidden="true" />
          <span>{metadata.domain}</span>
        </p>
      </div>
    </div>
  );
});
