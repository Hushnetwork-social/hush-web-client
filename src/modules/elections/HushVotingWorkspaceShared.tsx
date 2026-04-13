"use client";

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type {
  ElectionGovernedProposal,
  ElectionTrusteeInvitation,
  GetElectionResponse,
} from '@/lib/grpc';
import { ElectionTrusteeInvitationStatusProto } from '@/lib/grpc';

export const sectionClass =
  'rounded-3xl bg-hush-bg-element/95 p-5 shadow-lg shadow-black/10';

export type CollapsibleSurfaceSectionProps = {
  testId: string;
  toggleTestId?: string;
  eyebrow: string;
  title: string;
  description: string;
  summary: ReactNode;
  defaultExpanded: boolean;
  actions?: ReactNode;
  children: ReactNode;
};

export function CollapsibleSurfaceSection({
  testId,
  toggleTestId,
  eyebrow,
  title,
  description,
  summary,
  defaultExpanded,
  actions,
  children,
}: CollapsibleSurfaceSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const previousDefaultExpanded = useRef(defaultExpanded);

  useEffect(() => {
    if (previousDefaultExpanded.current !== defaultExpanded) {
      setIsExpanded(defaultExpanded);
      previousDefaultExpanded.current = defaultExpanded;
    }
  }, [defaultExpanded]);

  return (
    <section
      className="space-y-4 border-t border-white/5 pt-5 md:pt-6"
      data-testid={testId}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-hush-text-accent">
            {eyebrow}
          </div>
          <h2 className="mt-2 text-xl font-semibold text-hush-text-primary">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">{description}</p>
          <div className="mt-3 max-w-3xl text-sm leading-7 text-hush-text-accent">{summary}</div>
        </div>

        <div className="flex w-full shrink-0 flex-wrap items-center gap-3 xl:w-auto xl:justify-end">
          {actions}

          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-transparent px-4 py-2 text-sm font-medium text-hush-text-primary transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
            aria-expanded={isExpanded}
            data-testid={toggleTestId ?? `${testId}-toggle`}
          >
            <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {isExpanded ? children : null}
    </section>
  );
}

export function AvailabilityCard({
  label,
  value,
  accentClass,
  valueClassName,
}: {
  label: string;
  value: string;
  accentClass?: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl bg-hush-bg-dark/70 p-4 shadow-sm shadow-black/10">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
        {label}
      </div>
      <div
        className={`mt-2 text-sm font-medium ${accentClass ?? 'text-hush-text-primary'} ${valueClassName ?? ''}`}
      >
        {value}
      </div>
    </div>
  );
}

export function timestampToMillis(timestamp?: { seconds?: number; nanos?: number }): number {
  if (!timestamp) {
    return 0;
  }

  return (timestamp.seconds ?? 0) * 1000 + Math.floor((timestamp.nanos ?? 0) / 1_000_000);
}

export function getLatestProposal(detail: GetElectionResponse | null): ElectionGovernedProposal | null {
  const proposals = (detail?.GovernedProposals ?? [])
    .slice()
    .sort((left, right) => timestampToMillis(right.CreatedAt) - timestampToMillis(left.CreatedAt));

  return proposals[0] ?? null;
}

export function isSameActorAddress(left?: string, right?: string): boolean {
  const normalizedLeft = left?.trim().toLowerCase() ?? '';
  const normalizedRight = right?.trim().toLowerCase() ?? '';

  return normalizedLeft.length > 0 && normalizedLeft === normalizedRight;
}

export function getPendingSelfTrusteeInvitation(
  detail: GetElectionResponse | null,
  actorPublicAddress: string
): ElectionTrusteeInvitation | null {
  return (
    (detail?.TrusteeInvitations ?? [])
      .filter(
        (invitation) =>
          invitation.Status === ElectionTrusteeInvitationStatusProto.Pending &&
          isSameActorAddress(invitation.TrusteeUserAddress, actorPublicAddress)
      )
      .sort((left, right) => timestampToMillis(right.SentAt) - timestampToMillis(left.SentAt))[0] ??
    null
  );
}
