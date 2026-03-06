import type { Feed } from "@/types";

export function normalizeCircleName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function isInnerCircleName(name: string): boolean {
  const normalized = normalizeCircleName(name);
  const compact = normalized.replace(/\s+/g, "");
  return normalized === "inner circle" || compact === "innercircle";
}

export function isCircleFeedMetadata(feedName: string, feedDescription?: string): boolean {
  if (isInnerCircleName(feedName)) {
    return true;
  }

  const normalizedDescription = (feedDescription ?? "").trim().toLowerCase();
  return (
    normalizedDescription === "owner-managed custom circle" ||
    normalizedDescription === "auto-managed inner circle"
  );
}

export function isCircleFeed(feed: Pick<Feed, "type" | "name" | "description">): boolean {
  return feed.type === "group" && isCircleFeedMetadata(feed.name, feed.description);
}
