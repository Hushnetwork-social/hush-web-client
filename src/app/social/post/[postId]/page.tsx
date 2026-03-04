"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

function resolveAccessState(access: string | null): "public" | "guest" | "denied" {
  if (access === "guest") {
    return "guest";
  }
  if (access === "denied") {
    return "denied";
  }
  return "public";
}

export default function SocialPostPermalinkPage() {
  const params = useParams<{ postId: string }>();
  const searchParams = useSearchParams();
  const postId = typeof params?.postId === "string" ? params.postId : "unknown-post";
  const access = resolveAccessState(searchParams.get("access"));

  if (access === "guest") {
    return (
      <section className="mx-auto max-w-2xl px-4 py-10" data-testid="social-permalink-guest">
        <h1 className="text-xl font-semibold text-hush-text-primary">This post is in HushSocial</h1>
        <p className="mt-2 text-sm text-hush-text-accent">
          Create your HushNetwork account to view this content.
        </p>
        <Link
          href="/social"
          className="mt-4 inline-flex rounded-md bg-hush-purple px-4 py-2 text-sm font-semibold text-hush-bg-dark"
          data-testid="social-permalink-guest-cta"
        >
          Create account and continue
        </Link>
      </section>
    );
  }

  if (access === "denied") {
    return (
      <section className="mx-auto max-w-2xl px-4 py-10" data-testid="social-permalink-denied">
        <h1 className="text-xl font-semibold text-hush-text-primary">You do not have permission to view this post</h1>
        <p className="mt-2 text-sm text-hush-text-accent">
          Ask the post owner to grant you access.
        </p>
        <Link
          href="/social"
          className="mt-4 inline-flex rounded-md border border-hush-bg-hover px-4 py-2 text-sm text-hush-text-accent"
          data-testid="social-permalink-denied-cta"
        >
          Back to HushSocial
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-10" data-testid="social-permalink-public">
      <h1 className="text-xl font-semibold text-hush-text-primary">Public post</h1>
      <p className="mt-2 text-xs text-hush-text-accent">Post ID: {postId}</p>
      <article className="mt-4 rounded-xl border border-hush-bg-hover bg-hush-bg-dark p-4" data-testid="social-permalink-post-card">
        <p className="text-sm text-hush-text-primary">
          Public permalink rendering is active for FEAT-086.
        </p>
      </article>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-full border border-hush-bg-hover px-3 py-1 text-xs text-hush-text-accent"
          data-testid="social-permalink-react"
        >
          React
        </button>
        <button
          type="button"
          className="rounded-full border border-hush-bg-hover px-3 py-1 text-xs text-hush-text-accent"
          data-testid="social-permalink-comment"
        >
          Comment
        </button>
      </div>
    </section>
  );
}
