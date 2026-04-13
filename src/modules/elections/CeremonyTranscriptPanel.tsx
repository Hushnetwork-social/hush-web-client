"use client";

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, History } from 'lucide-react';
import type { ElectionCeremonyTranscriptEvent, GetElectionResponse } from '@/lib/grpc';
import {
  formatArtifactValue,
  formatTimestamp,
  getActiveCeremonyVersion,
  getCeremonyTranscriptEvents,
  getSupersededCeremonyVersions,
} from './contracts';

type CeremonyTranscriptPanelProps = {
  detail: GetElectionResponse | null;
  className?: string;
  defaultExpandLatestActiveGroup?: boolean;
};

type TranscriptActorGroup = {
  key: string;
  label: string;
  meta: string;
  latestSummary: string;
  latestAt?: ElectionCeremonyTranscriptEvent['OccurredAt'];
  events: ElectionCeremonyTranscriptEvent[];
};

function buildTranscriptActorGroups(
  events: ElectionCeremonyTranscriptEvent[],
  ownerPublicAddress?: string
): TranscriptActorGroup[] {
  const groups = new Map<string, TranscriptActorGroup>();

  events.forEach((event) => {
    const actorAddress = event.TrusteeUserAddress || event.ActorPublicAddress || 'workflow';
    const isTrusteeEvent = Boolean(event.TrusteeDisplayName || event.TrusteeUserAddress);
    const label = isTrusteeEvent
      ? event.TrusteeDisplayName || event.TrusteeUserAddress
      : ownerPublicAddress && event.ActorPublicAddress === ownerPublicAddress
        ? 'Owner / workflow'
        : event.ActorPublicAddress
          ? `Workflow ${event.ActorPublicAddress.slice(0, 10)}...`
          : 'Workflow';
    const meta = isTrusteeEvent
      ? event.TrusteeUserAddress || 'Trustee'
      : event.ActorPublicAddress || 'System event';
    const existing = groups.get(actorAddress);

    if (!existing) {
      groups.set(actorAddress, {
        key: actorAddress,
        label,
        meta,
        latestSummary: event.EventSummary,
        latestAt: event.OccurredAt,
        events: [event],
      });
      return;
    }

    existing.events.push(event);
    existing.latestSummary = event.EventSummary;
    existing.latestAt = event.OccurredAt;
  });

  return Array.from(groups.values()).sort((left, right) => {
    const leftSeconds = Number(left.latestAt?.seconds ?? 0);
    const rightSeconds = Number(right.latestAt?.seconds ?? 0);

    if (leftSeconds !== rightSeconds) {
      return rightSeconds - leftSeconds;
    }

    const leftNanos = left.latestAt?.nanos ?? 0;
    const rightNanos = right.latestAt?.nanos ?? 0;
    return rightNanos - leftNanos;
  });
}

export function CeremonyTranscriptPanel({
  detail,
  className = '',
  defaultExpandLatestActiveGroup = true,
}: CeremonyTranscriptPanelProps) {
  const [expandedVersions, setExpandedVersions] = useState<Record<string, boolean>>({});
  const [expandedActiveActors, setExpandedActiveActors] = useState<Record<string, boolean>>({});
  const activeVersion = useMemo(() => getActiveCeremonyVersion(detail), [detail]);
  const activeEvents = useMemo(
    () => getCeremonyTranscriptEvents(detail, activeVersion?.Id),
    [activeVersion?.Id, detail]
  );
  const activeActorGroups = useMemo(
    () => buildTranscriptActorGroups(activeEvents, detail?.Election?.OwnerPublicAddress),
    [activeEvents, detail?.Election?.OwnerPublicAddress]
  );
  const supersededVersions = useMemo(() => getSupersededCeremonyVersions(detail), [detail]);

  const toggleVersion = (versionId: string) => {
    setExpandedVersions((current) => ({
      ...current,
      [versionId]: !current[versionId],
    }));
  };

  const toggleActiveActor = (actorKey: string) => {
    setExpandedActiveActors((current) => ({
      ...current,
      [actorKey]: !current[actorKey],
    }));
  };

  return (
    <section
      className={`rounded-3xl bg-hush-bg-element/95 p-4 shadow-lg shadow-black/10 ${className}`.trim()}
      data-testid="ceremony-transcript-panel"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Ceremony Transcript</div>
          <p className="mt-1 text-sm text-hush-text-accent">
            Read-only version history, restart reasons, and trustee state changes. Secret payloads
            stay outside this view.
          </p>
        </div>
        <div className="rounded-xl bg-[#151c33] px-3 py-2 text-xs text-hush-text-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_10px_20px_rgba(0,0,0,0.12)]">
          <div className="font-semibold uppercase tracking-[0.2em]">Active fingerprint</div>
          <div className="mt-1 text-hush-text-primary">
            {formatArtifactValue(activeVersion?.TallyPublicKeyFingerprint)}
          </div>
        </div>
      </div>

      {!activeVersion && supersededVersions.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-hush-bg-dark/75 px-4 py-5 text-sm text-hush-text-accent shadow-inner shadow-black/15">
          No ceremony history recorded yet.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {activeVersion ? (
            <div className="rounded-[24px] bg-[#18203a] px-4 py-4 shadow-inner shadow-black/10">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-semibold text-hush-text-primary">
                  Active version KC-{String(activeVersion.VersionNumber).padStart(3, '0')}
                </span>
                <span className="text-hush-text-accent">{activeVersion.ProfileId}</span>
                <span className="text-hush-text-accent">
                  Started {formatTimestamp(activeVersion.StartedAt)}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {activeActorGroups.length > 0 ? (
                  activeActorGroups.map((group, index) => {
                    const isExpanded =
                      expandedActiveActors[group.key] ??
                      (defaultExpandLatestActiveGroup && index === 0);

                    return (
                      <div
                        key={group.key}
                        className="rounded-2xl bg-[#1f2848] px-3 py-3 text-sm shadow-sm shadow-black/10"
                      >
                        <button
                          type="button"
                          onClick={() => toggleActiveActor(group.key)}
                          className="flex w-full items-start justify-between gap-3 text-left"
                          data-testid={`ceremony-active-group-toggle-${group.key}`}
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-hush-text-primary">{group.label}</span>
                              <span className="rounded-full bg-hush-bg-dark/70 px-2 py-0.5 text-[11px] text-hush-text-accent">
                                {group.events.length} event{group.events.length === 1 ? '' : 's'}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-hush-text-accent">
                              {group.meta} | Last event {formatTimestamp(group.latestAt)}
                            </div>
                            <div className="mt-2 text-sm text-hush-text-accent">{group.latestSummary}</div>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="mt-1 h-4 w-4 shrink-0 text-hush-text-accent" />
                          ) : (
                            <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-hush-text-accent" />
                          )}
                        </button>

                        {isExpanded ? (
                          <div className="mt-3 space-y-2 border-t border-hush-bg-light/60 pt-3">
                            {group.events.map((event) => (
                              <div
                                key={event.Id}
                                className="rounded-2xl bg-[#18203a] px-3 py-3 text-sm shadow-inner shadow-black/10"
                              >
                                <div className="flex flex-wrap items-center gap-2 text-xs text-hush-text-accent">
                                  <History className="h-3.5 w-3.5" />
                                  <span>{formatTimestamp(event.OccurredAt)}</span>
                                </div>
                                <div className="mt-2 text-sm text-hush-text-primary">{event.EventSummary}</div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-2xl bg-hush-bg-dark/75 px-3 py-3 text-sm text-hush-text-accent shadow-inner shadow-black/15">
                    No transcript events recorded for the active version yet.
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {supersededVersions.length > 0 ? (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                Superseded versions
              </div>
              {supersededVersions.map((version) => {
                const isExpanded = !!expandedVersions[version.Id];
                const events = getCeremonyTranscriptEvents(detail, version.Id);

                return (
                  <div
                    key={version.Id}
                    className="rounded-[24px] bg-[#18203a] px-4 py-3 shadow-sm shadow-black/10"
                  >
                    <button
                      type="button"
                      onClick={() => toggleVersion(version.Id)}
                      className="flex w-full items-center justify-between gap-3 text-left"
                      data-testid={`ceremony-superseded-toggle-${version.VersionNumber}`}
                    >
                      <div>
                        <div className="text-sm font-medium text-hush-text-primary">
                          KC-{String(version.VersionNumber).padStart(3, '0')}
                        </div>
                        <div className="mt-1 text-xs text-hush-text-accent">
                          {version.SupersededReason || 'Superseded version'} |{' '}
                          {formatTimestamp(version.SupersededAt ?? version.StartedAt)}
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-hush-text-accent" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-hush-text-accent" />
                      )}
                    </button>

                    {isExpanded ? (
                      <div className="mt-3 space-y-2">
                        {events.length > 0 ? (
                          events.map((event) => (
                            <div
                              key={event.Id}
                              className="rounded-2xl bg-[#1f2848] px-3 py-3 text-sm shadow-sm shadow-black/10"
                            >
                              <div className="text-xs text-hush-text-accent">
                                {formatTimestamp(event.OccurredAt)}
                              </div>
                              <div className="mt-1 text-hush-text-primary">{event.EventSummary}</div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-2xl bg-hush-bg-dark/75 px-3 py-3 text-sm text-hush-text-accent shadow-inner shadow-black/15">
                            No non-secret transcript events were recorded for this version.
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
