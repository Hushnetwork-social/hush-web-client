"use client";

import type { ElectionHubEntryView } from '@/lib/grpc';
import { ArrowRight, CheckCircle2, LockKeyhole, Vote } from 'lucide-react';
import {
  formatTimestamp,
  getElectionHubSuggestedActionLabel,
  getLifecycleLabel,
} from './contracts';
import { RoleBadgeCluster } from './RoleBadgeCluster';

type ElectionHubCardProps = {
  entry: ElectionHubEntryView;
  isSelected: boolean;
  onSelect: (electionId: string) => void;
};

function getResultCopy(entry: ElectionHubEntryView): string | null {
  if (entry.HasOfficialResult) {
    return 'Official result available';
  }

  if (entry.HasUnofficialResult) {
    return 'Participant result available';
  }

  if (entry.CanClaimIdentity) {
    return 'Link identity required';
  }

  return null;
}

export function ElectionHubCard({ entry, isSelected, onSelect }: ElectionHubCardProps) {
  const resultCopy = getResultCopy(entry);

  return (
    <button
      type="button"
      onClick={() => onSelect(entry.Election.ElectionId)}
      className={`w-full rounded-3xl border p-4 text-left transition-all ${
        isSelected
          ? 'border-hush-purple bg-hush-purple/10 shadow-lg shadow-hush-purple/10'
          : 'border-hush-bg-light bg-hush-bg-dark/70 hover:border-hush-purple/50 hover:bg-hush-bg-dark'
      }`}
      data-testid={`election-hub-card-${entry.Election.ElectionId}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-hush-bg-light bg-hush-bg-element px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
              {getLifecycleLabel(entry.Election.LifecycleState)}
            </span>
            <span className="rounded-full border border-hush-bg-light bg-hush-bg-element px-3 py-1 text-[11px] text-hush-text-accent">
              Updated {formatTimestamp(entry.Election.LastUpdatedAt)}
            </span>
          </div>

          <h3 className="mt-3 truncate text-lg font-semibold text-hush-text-primary">
            {entry.Election.Title || 'Untitled election'}
          </h3>
          <p className="mt-1 text-sm text-hush-text-accent">
            {entry.SuggestedActionReason || 'Open this election to review the allowed workspace.'}
          </p>
        </div>

        <ArrowRight className={`mt-1 h-5 w-5 flex-shrink-0 ${isSelected ? 'text-hush-purple' : 'text-hush-text-accent'}`} />
      </div>

      <div className="mt-4">
        <RoleBadgeCluster roles={entry.ActorRoles} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-hush-bg-light bg-hush-bg-element px-3 py-1 text-xs text-hush-text-primary">
          <Vote className="h-3.5 w-3.5 text-hush-purple" />
          <span>{getElectionHubSuggestedActionLabel(entry.SuggestedAction)}</span>
        </span>
        {resultCopy ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs text-green-100">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{resultCopy}</span>
          </span>
        ) : null}
        {entry.CanViewReportPackage ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-100">
            <LockKeyhole className="h-3.5 w-3.5" />
            <span>Report package allowed</span>
          </span>
        ) : null}
      </div>
    </button>
  );
}
