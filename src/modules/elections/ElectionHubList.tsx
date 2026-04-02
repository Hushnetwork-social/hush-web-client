"use client";

import { useMemo } from 'react';
import type { ElectionHubEntryView } from '@/lib/grpc';
import { ElectionLifecycleStateProto } from '@/lib/grpc';
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
  const orderedEntries = useMemo(
    () =>
      entries.slice().sort((left, right) => {
        const lifecycleOrderDelta =
          LIFECYCLE_GROUP_ORDER.indexOf(left.Election.LifecycleState) -
          LIFECYCLE_GROUP_ORDER.indexOf(right.Election.LifecycleState);

        if (lifecycleOrderDelta !== 0) {
          return lifecycleOrderDelta;
        }

        return (
          timestampToMillis(right.Election.LastUpdatedAt) -
          timestampToMillis(left.Election.LastUpdatedAt)
        );
      }),
    [entries]
  );

  return (
    <div className="space-y-3" data-testid="election-hub-list">
      {orderedEntries.map((entry) => (
        <ElectionHubCard
          key={entry.Election.ElectionId}
          entry={entry}
          isSelected={selectedElectionId === entry.Election.ElectionId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
