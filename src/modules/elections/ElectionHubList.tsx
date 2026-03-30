"use client";

import { useMemo } from 'react';
import type { ElectionHubEntryView } from '@/lib/grpc';
import { ElectionLifecycleStateProto } from '@/lib/grpc';
import { getLifecycleLabel } from './contracts';
import { ElectionHubCard } from './ElectionHubCard';

type ElectionHubListProps = {
  entries: ElectionHubEntryView[];
  selectedElectionId: string | null;
  onSelect: (electionId: string) => void;
};

const LIFECYCLE_GROUP_ORDER = [
  ElectionLifecycleStateProto.Open,
  ElectionLifecycleStateProto.Draft,
  ElectionLifecycleStateProto.Closed,
  ElectionLifecycleStateProto.Finalized,
] as const;

function timestampToMillis(timestamp?: { seconds?: number; nanos?: number }): number {
  if (!timestamp) {
    return 0;
  }

  return (timestamp.seconds ?? 0) * 1000 + Math.floor((timestamp.nanos ?? 0) / 1_000_000);
}

export function ElectionHubList({
  entries,
  selectedElectionId,
  onSelect,
}: ElectionHubListProps) {
  const groupedEntries = useMemo(
    () =>
      LIFECYCLE_GROUP_ORDER.map((lifecycleState) => ({
        lifecycleState,
        entries: entries
          .filter((entry) => entry.Election.LifecycleState === lifecycleState)
          .sort(
            (left, right) =>
              timestampToMillis(right.Election.LastUpdatedAt) -
              timestampToMillis(left.Election.LastUpdatedAt)
          ),
      })).filter((group) => group.entries.length > 0),
    [entries]
  );

  return (
    <div className="space-y-6" data-testid="election-hub-list">
      {groupedEntries.map((group) => (
        <section
          key={group.lifecycleState}
          className="space-y-3"
          data-testid={`election-hub-group-${group.lifecycleState}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-hush-text-accent">
                {getLifecycleLabel(group.lifecycleState)}
              </h2>
              <p className="mt-1 text-xs text-hush-text-accent">
                {group.entries.length} election{group.entries.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {group.entries.map((entry) => (
              <ElectionHubCard
                key={entry.Election.ElectionId}
                entry={entry}
                isSelected={selectedElectionId === entry.Election.ElectionId}
                onSelect={onSelect}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
