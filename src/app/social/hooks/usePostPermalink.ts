"use client";

import { useCallback } from "react";

type UsePostPermalinkParams = {
  onToast: (message: string) => void;
};

export function usePostPermalink({ onToast }: UsePostPermalinkParams) {
  const buildPostPermalink = useCallback((postId: string) => {
    if (typeof window === "undefined") {
      return `/social/post/${postId}`;
    }
    return `${window.location.origin}/social/post/${postId}`;
  }, []);

  const copyPostPermalink = useCallback(
    async (postId: string) => {
      const permalink = buildPostPermalink(postId);
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(permalink);
          onToast("Post permalink copied.");
          return;
        }
        onToast(`Permalink: ${permalink}`);
      } catch (error) {
        console.error("[Social] Failed to copy permalink", error);
        onToast(`Permalink: ${permalink}`);
      }
    },
    [buildPostPermalink, onToast]
  );

  return { copyPostPermalink };
}
