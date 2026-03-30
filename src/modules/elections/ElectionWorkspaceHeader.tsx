"use client";

import Link from 'next/link';
import type { ElectionHubEntryView } from '@/lib/grpc';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import {
  formatTimestamp,
  getElectionHubSuggestedActionLabel,
  getLifecycleLabel,
} from './contracts';
import { RoleBadgeCluster } from './RoleBadgeCluster';

type ElectionWorkspaceHeaderProps = {
  entry: ElectionHubEntryView;
};

export function ElectionWorkspaceHeader({ entry }: ElectionWorkspaceHeaderProps) {
  return (
    <section className="rounded-3xl border border-hush-bg-light bg-hush-bg-element/95 p-6 shadow-sm shadow-black/10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link
            href="/account/elections"
            className="inline-flex items-center gap-2 text-sm text-hush-text-accent transition-colors hover:text-hush-purple"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to HushVoting Hub</span>
          </Link>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-hush-purple/30 bg-hush-purple/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-hush-purple">
              {getLifecycleLabel(entry.Election.LifecycleState)}
            </span>
            <span className="rounded-full border border-hush-bg-light bg-hush-bg-dark px-3 py-1 text-xs text-hush-text-accent">
              Updated {formatTimestamp(entry.Election.LastUpdatedAt)}
            </span>
          </div>

          <h1 className="mt-4 text-3xl font-semibold text-hush-text-primary">
            {entry.Election.Title || 'Untitled election'}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
            Election id:{' '}
            <span className="font-mono text-xs text-hush-text-primary">
              {entry.Election.ElectionId}
            </span>
          </p>
          <p className="mt-3 max-w-3xl text-sm text-hush-text-accent">
            {entry.SuggestedActionReason || 'Review the available election surfaces for your roles.'}
          </p>
        </div>

        <div className="rounded-3xl border border-hush-bg-light bg-hush-bg-dark/70 p-4 lg:max-w-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-hush-text-accent">
            Next Suggested Action
          </div>
          <div className="mt-2 text-base font-semibold text-hush-text-primary">
            {getElectionHubSuggestedActionLabel(entry.SuggestedAction)}
          </div>
          <div className="mt-4">
            <RoleBadgeCluster roles={entry.ActorRoles} />
          </div>
          <Link
            href={`/account/elections/${entry.Election.ElectionId}`}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-hush-bg-light px-4 py-2 text-sm font-medium text-hush-text-primary transition-colors hover:border-hush-purple hover:text-hush-purple"
          >
            <ExternalLink className="h-4 w-4" />
            <span>Open dedicated workspace route</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
