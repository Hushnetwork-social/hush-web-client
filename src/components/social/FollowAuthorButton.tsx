"use client";

import { Loader2 } from "lucide-react";
import type { SocialFollowButtonState } from "@/modules/social/contracts";

interface FollowAuthorButtonProps {
  state: SocialFollowButtonState;
  onClick?: () => void;
  testId: string;
}

export function FollowAuthorButton({ state, onClick, testId }: FollowAuthorButtonProps) {
  if (state === "hidden") {
    return null;
  }

  const isDisabled = state !== "follow";
  const label = state === "following" ? "Following" : "Follow";

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-full border border-hush-purple/40 bg-hush-purple/10 px-3 py-1 text-xs font-semibold text-hush-purple disabled:cursor-not-allowed disabled:opacity-70"
      disabled={isDisabled}
      onClick={onClick}
      data-testid={testId}
    >
      {state === "pending" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
      {label}
    </button>
  );
}
