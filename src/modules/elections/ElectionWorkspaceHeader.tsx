"use client";

import Link from 'next/link';
import type { ElectionHubEntryView } from '@/lib/grpc';
import { ArrowLeft } from 'lucide-react';
import {
  formatTimestamp,
  getElectionHubDisplayActionLabel,
  getElectionHubNarrative,
  getLifecycleLabel,
} from './contracts';
import { RoleBadgeCluster } from './RoleBadgeCluster';

type ElectionWorkspaceHeaderProps = {
  entry: ElectionHubEntryView;
};

export function ElectionWorkspaceHeader({ entry }: ElectionWorkspaceHeaderProps) {
  return (
    <section className="pt-1">
      <Link
        href="/elections"
        className="inline-flex items-center gap-2 text-sm text-hush-text-accent transition-colors hover:text-hush-purple"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to HushVoting! Hub</span>
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
        {getElectionHubNarrative(entry)}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="text-sm font-medium text-hush-text-primary">
          {getElectionHubDisplayActionLabel(entry)}
        </div>
        <RoleBadgeCluster roles={entry.ActorRoles} />
      </div>
    </section>
  );
}
