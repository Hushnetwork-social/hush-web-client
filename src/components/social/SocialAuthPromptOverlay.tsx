"use client";

import Link from "next/link";
import { getAuthRoute } from "@/lib/navigation/appRoutes";

interface SocialAuthPromptOverlayProps {
  onClose: () => void;
  returnTo?: string | null;
}

export function SocialAuthPromptOverlay({ onClose, returnTo }: SocialAuthPromptOverlayProps) {
  const authRoute = getAuthRoute(returnTo);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      data-testid="social-auth-overlay"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-hush-bg-hover bg-hush-bg-dark p-6 shadow-2xl"
        data-testid="social-auth-overlay-card"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-xl font-semibold text-hush-text-primary">
          Create your HushNetwork account
        </h2>
        <p className="mt-2 text-sm text-hush-text-accent">
          Public posts stay visible to everyone, but reactions, comments, and replies require a valid Hush identity.
        </p>
        <p className="mt-2 text-sm text-hush-text-accent" data-testid="social-auth-overlay-return-copy">
          Create or import your account and you&apos;ll come right back to this same post.
        </p>
        <div className="mt-5 flex items-center gap-3">
          <Link
            href={authRoute}
            className="inline-flex rounded-md bg-hush-purple px-4 py-2 text-sm font-semibold text-hush-bg-dark"
            data-testid="social-auth-overlay-cta"
          >
            Create account
          </Link>
          <button
            type="button"
            className="inline-flex rounded-md border border-hush-bg-hover px-4 py-2 text-sm text-hush-text-accent"
            data-testid="social-auth-overlay-close"
            onClick={onClose}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
