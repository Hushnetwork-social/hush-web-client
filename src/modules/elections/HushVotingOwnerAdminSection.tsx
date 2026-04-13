"use client";

import Link from 'next/link';
import { useMemo } from 'react';
import { AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import type { ElectionHubEntryView, GetElectionResponse } from '@/lib/grpc';
import {
  ElectionCeremonyVersionStatusProto,
  ElectionGovernanceModeProto,
  ElectionTrusteeInvitationStatusProto,
} from '@/lib/grpc';
import {
  createDraftFromElectionDetail,
  formatTimestamp,
  getActiveCeremonyVersion,
  getCeremonyVersionStatusLabel,
  getDraftOpenValidationErrors,
  getDraftSaveValidationErrors,
  getGovernedActionLabel,
  getGovernedProposalExecutionStatusLabel,
  getSummaryBadge,
} from './contracts';
import {
  AvailabilityCard,
  CollapsibleSurfaceSection,
  getLatestProposal,
} from './HushVotingWorkspaceShared';

type OwnerAdminWorkspaceSummaryProps = {
  entry: ElectionHubEntryView;
  detail: GetElectionResponse | null;
};

export function OwnerAdminWorkspaceSummary({
  entry,
  detail,
}: OwnerAdminWorkspaceSummaryProps) {
  const latestProposal = useMemo(() => getLatestProposal(detail), [detail]);
  const activeCeremonyVersion = useMemo(() => getActiveCeremonyVersion(detail), [detail]);
  const savedDraft = useMemo(() => createDraftFromElectionDetail(detail), [detail]);
  const saveValidationErrors = useMemo(
    () => (detail ? getDraftSaveValidationErrors(savedDraft) : []),
    [detail, savedDraft]
  );
  const openValidationErrors = useMemo(
    () => (detail ? getDraftOpenValidationErrors(savedDraft) : []),
    [detail, savedDraft]
  );
  const acceptedTrustees = useMemo(
    () =>
      (detail?.TrusteeInvitations ?? []).filter(
        (invitation) => invitation.Status === ElectionTrusteeInvitationStatusProto.Accepted
      ),
    [detail?.TrusteeInvitations]
  );
  const pendingTrustees = useMemo(
    () =>
      (detail?.TrusteeInvitations ?? []).filter(
        (invitation) => invitation.Status === ElectionTrusteeInvitationStatusProto.Pending
      ),
    [detail?.TrusteeInvitations]
  );
  const governanceMode = detail?.Election?.GovernanceMode ?? entry.Election.GovernanceMode;
  const requiredApprovalCount = detail?.Election?.RequiredApprovalCount ?? 0;
  const usesTrustees = governanceMode === ElectionGovernanceModeProto.TrusteeThreshold;
  const hasAcceptedTrusteeRoster =
    !usesTrustees || acceptedTrustees.length >= Math.max(1, requiredApprovalCount || 1);
  const isCeremonyReady =
    !usesTrustees ||
    activeCeremonyVersion?.Status === ElectionCeremonyVersionStatusProto.CeremonyVersionReady;
  const readinessItems = [
    {
      label: 'Saved draft checks',
      isReady: detail ? saveValidationErrors.length === 0 : false,
      detail: detail
        ? saveValidationErrors.length === 0
          ? 'The saved draft metadata and policy are complete enough for owner workflow.'
          : 'The saved draft still has blocking metadata or policy issues.'
        : 'Load the saved election detail before checking draft readiness.',
    },
    {
      label: 'Open prerequisites',
      isReady: detail ? openValidationErrors.length === 0 : false,
      detail: detail
        ? openValidationErrors.length === 0
          ? 'Ballot and local pre-open checks are clear.'
          : 'The saved draft still needs ballot or local open-preparation work.'
        : 'Open-preparation checks appear after the election detail loads.',
    },
    ...(usesTrustees
      ? [
          {
            label: 'Accepted trustees',
            isReady: hasAcceptedTrusteeRoster,
            detail: hasAcceptedTrusteeRoster
              ? `${acceptedTrustees.length} accepted trustee(s) cover the ${Math.max(
                  1,
                  requiredApprovalCount || 1
                )}-of-N threshold.`
              : `Need at least ${Math.max(
                  1,
                  requiredApprovalCount || 1
                )} accepted trustee(s) before open can proceed.`,
          },
          {
            label: 'Key ceremony',
            isReady: isCeremonyReady,
            detail: isCeremonyReady
              ? activeCeremonyVersion
                ? `Version ${activeCeremonyVersion.VersionNumber} is ${getCeremonyVersionStatusLabel(
                    activeCeremonyVersion.Status
                  ).toLowerCase()}.`
                : 'The trustee ceremony is ready.'
              : activeCeremonyVersion
                ? `Version ${activeCeremonyVersion.VersionNumber} is ${getCeremonyVersionStatusLabel(
                    activeCeremonyVersion.Status
                  ).toLowerCase()}.`
                : 'No key ceremony version is ready yet.',
          },
        ]
      : []),
  ];
  const readinessBlockerCount = readinessItems.filter((item) => !item.isReady).length;
  const readinessBlockers = Array.from(
    new Set([
      ...saveValidationErrors,
      ...openValidationErrors,
      ...(usesTrustees && !hasAcceptedTrusteeRoster
        ? [
            `Accepted trustees recorded: ${acceptedTrustees.length} of ${Math.max(
              1,
              requiredApprovalCount || 1
            )}.`,
          ]
        : []),
      ...(usesTrustees && !isCeremonyReady
        ? [
            activeCeremonyVersion
              ? `Key ceremony status is ${getCeremonyVersionStatusLabel(activeCeremonyVersion.Status)}.`
              : 'Key ceremony has not reached Ready status yet.',
          ]
        : []),
    ])
  );
  const ownerSummary = readinessBlockerCount === 0 ? (
    <>
      <span className="font-semibold text-hush-text-primary">
        {usesTrustees ? 'Ready for open proposal.' : 'Ready in owner workspace.'}
      </span>{' '}
      {usesTrustees
        ? 'Saved draft checks, trustee acceptance, and the key ceremony are clear. Open can continue from the Owner Workspace.'
        : 'Saved draft checks are clear. Open can continue from the Owner Workspace.'}
    </>
  ) : (
    <>
      <span className="font-semibold text-hush-text-primary">Not ready:</span>{' '}
      {readinessItems
        .filter((item) => !item.isReady)
        .map((item) => item.label.toLowerCase())
        .join(', ')}
      . Expand for the blocking details.
    </>
  );

  return (
    <CollapsibleSurfaceSection
      testId="hush-voting-section-owner-admin"
      toggleTestId="hush-voting-owner-admin-toggle"
      eyebrow="Owner / Admin Surface"
      title="Election lifecycle management"
      description="This shell now shows owner-facing trustee and open-readiness status only. Draft edits, auditor grants, ceremony work, and the actual open action stay inside the Owner Workspace."
      summary={ownerSummary}
      defaultExpanded={false}
      actions={
        <Link
          href={`/elections/owner?electionId=${entry.Election.ElectionId}`}
          className="inline-flex self-start items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-hush-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Owner Workspace</span>
        </Link>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <AvailabilityCard label="Summary" value={getSummaryBadge(entry.Election)} />
        <AvailabilityCard
          label="Draft revision"
          value={
            detail?.Election
              ? `${detail.Election.CurrentDraftRevision}`
              : `${entry.Election.CurrentDraftRevision}`
          }
        />
        <AvailabilityCard
          label="Ready to open"
          value={
            readinessBlockerCount === 0
              ? usesTrustees
                ? 'Ready for open proposal'
                : 'Ready in owner workspace'
              : `${readinessBlockerCount} blocker(s) remaining`
          }
          accentClass={readinessBlockerCount === 0 ? 'text-green-100' : 'text-amber-100'}
        />
        <AvailabilityCard
          label="Trustees"
          value={
            usesTrustees
              ? `${acceptedTrustees.length} accepted | ${pendingTrustees.length} pending`
              : 'Admin-only flow'
          }
        />
        <AvailabilityCard
          label="Last updated"
          value={formatTimestamp(detail?.Election?.LastUpdatedAt ?? entry.Election.LastUpdatedAt)}
        />
      </div>

      <div className="rounded-2xl bg-hush-bg-dark/70 p-4 shadow-sm shadow-black/10">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-hush-text-accent">
              Ready-to-open snapshot
            </div>
            <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
              Use this as the quick answer to &quot;can I open yet?&quot;. Auditor management moved to the Owner Workspace, and trustee-threshold elections also require the key ceremony there.
            </p>
          </div>
          <div className="rounded-xl border border-hush-bg-light px-3 py-2 text-xs text-hush-text-accent">
            {usesTrustees ? 'Trustee-threshold path' : 'Admin-only path'}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {readinessItems.map((item) => (
            <div
              key={item.label}
              className={`rounded-xl border px-4 py-3 ${
                item.isReady
                  ? 'border-green-500/30 bg-green-500/10 text-green-100'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-100'
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                {item.isReady ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <span>{item.label}</span>
              </div>
              <div className="mt-2 text-sm">{item.detail}</div>
            </div>
          ))}
        </div>

        {readinessBlockers.length > 0 ? (
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-hush-text-accent">
            {readinessBlockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        ) : (
          <div className="mt-4 text-sm text-green-100">
            {usesTrustees
              ? 'The next step is to open the election from Governed Actions in the Owner Workspace.'
              : 'The next step is to open the election from the Owner Workspace.'}
          </div>
        )}
      </div>

      {latestProposal ? (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-hush-text-accent">Latest governed proposal</div>
          <div className="text-sm text-hush-text-accent">
            {getGovernedActionLabel(latestProposal.ActionType)} proposal is{' '}
            <span className="text-hush-text-primary">
              {getGovernedProposalExecutionStatusLabel(latestProposal.ExecutionStatus)}
            </span>
            .
          </div>
        </div>
      ) : null}
    </CollapsibleSurfaceSection>
  );
}
