"use client";

import { Loader2, ShieldCheck, X } from 'lucide-react';
import type { ElectionTrusteeInvitation } from '@/lib/grpc';
import { formatTimestamp } from './contracts';
import { AvailabilityCard, sectionClass } from './HushVotingWorkspaceShared';

type PendingTrusteeInvitationSummaryProps = {
  electionTitle: string;
  invitation: ElectionTrusteeInvitation;
  isSubmitting: boolean;
  onAccept: () => void;
  onReject: () => void;
};

export function PendingTrusteeInvitationSummary({
  electionTitle,
  invitation,
  isSubmitting,
  onAccept,
  onReject,
}: PendingTrusteeInvitationSummaryProps) {
  const trusteeLabel = invitation.TrusteeDisplayName || invitation.TrusteeUserAddress;

  return (
    <section className={`${sectionClass} space-y-4`} data-testid="hush-voting-pending-trustee-invitation">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-hush-text-accent">
            Trustee Invitation
          </div>
          <h2 className="mt-2 text-xl font-semibold text-hush-text-primary">
            Respond before trustee work unlocks
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
            {trusteeLabel} has been invited to join <span className="text-hush-text-primary">{electionTitle}</span>{' '}
            as a trustee. Accept to unlock the ceremony, governed proposal, and share workflows
            for this election.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 lg:ml-6">
          <button
            type="button"
            onClick={onAccept}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            <span>Accept invitation</span>
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl bg-hush-bg-dark/80 px-4 py-2 text-sm font-medium text-hush-text-primary transition-colors hover:bg-hush-bg-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            <span>Decline invitation</span>
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <AvailabilityCard label="Status" value="Pending your response" accentClass="text-amber-100" />
        <AvailabilityCard label="Invited as" value={trusteeLabel} />
        <AvailabilityCard
          label="Invited by"
          value={invitation.InvitedByPublicAddress || 'Owner not recorded'}
          valueClassName="break-all font-mono text-xs leading-relaxed"
        />
        <AvailabilityCard label="Draft revision" value={`${invitation.SentAtDraftRevision}`} />
      </div>

      <div className="rounded-2xl bg-hush-bg-dark/70 px-4 py-3 text-sm text-hush-text-accent">
        Sent {formatTimestamp(invitation.SentAt)}. Declining removes this election from the
        trustee hub until a new invitation is issued.
      </div>
    </section>
  );
}
