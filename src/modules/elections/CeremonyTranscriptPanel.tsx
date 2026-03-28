"use client";

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, History } from 'lucide-react';
import type { GetElectionResponse } from '@/lib/grpc';
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
};

export function CeremonyTranscriptPanel({
  detail,
  className = '',
}: CeremonyTranscriptPanelProps) {
  const [expandedVersions, setExpandedVersions] = useState<Record<string, boolean>>({});
  const activeVersion = useMemo(() => getActiveCeremonyVersion(detail), [detail]);
  const activeEvents = useMemo(
    () => getCeremonyTranscriptEvents(detail, activeVersion?.Id),
    [activeVersion?.Id, detail]
  );
  const supersededVersions = useMemo(() => getSupersededCeremonyVersions(detail), [detail]);

  const toggleVersion = (versionId: string) => {
    setExpandedVersions((current) => ({
      ...current,
      [versionId]: !current[versionId],
    }));
  };

  return (
    <section
      className={`rounded-2xl border border-hush-bg-light bg-hush-bg-dark/80 p-4 ${className}`.trim()}
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
        <div className="rounded-xl border border-hush-bg-light bg-hush-bg-element/60 px-3 py-2 text-xs text-hush-text-accent">
          <div className="font-semibold uppercase tracking-[0.2em]">Active fingerprint</div>
          <div className="mt-1 text-hush-text-primary">
            {formatArtifactValue(activeVersion?.TallyPublicKeyFingerprint)}
          </div>
        </div>
      </div>

      {!activeVersion && supersededVersions.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-hush-bg-light px-4 py-5 text-sm text-hush-text-accent">
          No ceremony history recorded yet.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {activeVersion ? (
            <div className="rounded-xl border border-hush-purple/30 bg-hush-purple/5 px-4 py-4">
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
                {activeEvents.length > 0 ? (
                  activeEvents.map((event) => (
                    <div
                      key={event.Id}
                      className="rounded-xl border border-hush-bg-light/70 bg-hush-bg-dark/80 px-3 py-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs text-hush-text-accent">
                        <History className="h-3.5 w-3.5" />
                        <span>{formatTimestamp(event.OccurredAt)}</span>
                        {event.TrusteeDisplayName ? (
                          <span className="text-hush-text-primary">{event.TrusteeDisplayName}</span>
                        ) : null}
                      </div>
                      <div className="mt-2 text-sm text-hush-text-primary">{event.EventSummary}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-hush-bg-light px-3 py-3 text-sm text-hush-text-accent">
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
                    className="rounded-xl border border-hush-bg-light bg-hush-bg-dark px-4 py-3"
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
                          {version.SupersededReason || 'Superseded version'} •{' '}
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
                              className="rounded-xl border border-hush-bg-light/70 bg-hush-bg-element/70 px-3 py-3 text-sm"
                            >
                              <div className="text-xs text-hush-text-accent">
                                {formatTimestamp(event.OccurredAt)}
                              </div>
                              <div className="mt-1 text-hush-text-primary">{event.EventSummary}</div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-xl border border-dashed border-hush-bg-light px-3 py-3 text-sm text-hush-text-accent">
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
