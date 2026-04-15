"use client";

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Clock3,
  Files,
  Loader2,
} from 'lucide-react';
import type {
  ElectionFinalizationSession,
  ElectionFinalizationShare,
  ElectionGovernedProposal,
  GetElectionResponse,
} from '@/lib/grpc';
import {
  ElectionFinalizationSessionPurposeProto,
  ElectionFinalizationSessionStatusProto,
  ElectionGovernedActionTypeProto,
  ElectionGovernedProposalExecutionStatusProto,
} from '@/lib/grpc';
import { useBlockchainStore } from '@/modules/blockchain/useBlockchainStore';
import {
  formatTimestamp,
  getAcceptedFinalizationShareCount,
  getFinalizationSessionStatusLabel,
  getFinalizationShareStatusLabel,
  getGovernedActionLabel,
  getGovernedProposalExecutionStatusLabel,
  getGovernedProposalProgress,
  getLifecycleLabel,
  getLatestFinalizationShareForTrustee,
} from './contracts';
import { isSameActorAddress, sectionClass } from './HushVotingWorkspaceShared';
import { useElectionsStore } from './useElectionsStore';

type TrusteeGovernedActionsPanelProps = {
  electionId: string;
  actorPublicAddress: string;
};

type TrusteeGovernedActionState = {
  statusLabel: string;
  summary: string;
  toneClass: string;
  defaultExpanded: boolean;
  actorApproval: ReturnType<typeof getGovernedProposalProgress>['approvals'][number] | null;
  closeCountingSession: ElectionFinalizationSession | null;
  actorCloseShare: ElectionFinalizationShare | null;
  acceptedShareCount: number;
  primaryAction:
    | {
        href: string;
        label: string;
        icon: 'review' | 'share';
      }
    | null;
};

function timestampToMillis(timestamp?: { seconds?: number; nanos?: number }): number {
  if (!timestamp) {
    return 0;
  }

  return (timestamp.seconds ?? 0) * 1000 + Math.floor((timestamp.nanos ?? 0) / 1_000_000);
}

function getBoundCloseCountingSession(
  detail: GetElectionResponse | null,
  proposalId: string
): ElectionFinalizationSession | null {
  return (
    (detail?.FinalizationSessions ?? [])
      .filter(
        (session) =>
          session.SessionPurpose ===
            ElectionFinalizationSessionPurposeProto.FinalizationSessionPurposeCloseCounting &&
          session.GovernedProposalId === proposalId
      )
      .sort((left, right) => timestampToMillis(right.CreatedAt) - timestampToMillis(left.CreatedAt))[0] ??
    null
  );
}

function buildGovernedActionState(
  detail: GetElectionResponse | null,
  proposal: ElectionGovernedProposal,
  actorPublicAddress: string
): TrusteeGovernedActionState {
  const progress = getGovernedProposalProgress(detail, proposal.Id);
  const actorApproval =
    progress.approvals.find((approval) =>
      isSameActorAddress(approval.TrusteeUserAddress, actorPublicAddress)
    ) ?? null;
  const isCloseProposal = proposal.ActionType === ElectionGovernedActionTypeProto.Close;
  const closeCountingSession = isCloseProposal
    ? getBoundCloseCountingSession(detail, proposal.Id)
    : null;
  const actorCloseShare = closeCountingSession
    ? getLatestFinalizationShareForTrustee(detail, actorPublicAddress, closeCountingSession.Id)
    : null;
  const acceptedShareCount = closeCountingSession
    ? getAcceptedFinalizationShareCount(detail, closeCountingSession.Id)
    : 0;
  const actionLabel = getGovernedActionLabel(proposal.ActionType).toLowerCase();

  if (isCloseProposal && closeCountingSession && !actorCloseShare) {
    return {
      statusLabel: 'Tally share required',
      summary: actorApproval
        ? 'Your close approval is recorded. The bound close-counting session is ready, and this trustee still needs to submit the tally share.'
        : 'Close already executed without your approval, but this trustee can still contribute the bound tally share for close-counting.',
      toneClass: 'border-green-500/40 bg-green-500/10 text-green-100',
      defaultExpanded: true,
      actorApproval,
      closeCountingSession,
      actorCloseShare,
      acceptedShareCount,
      primaryAction: {
        href: `/elections/${proposal.ElectionId}/trustee/finalization`,
        label: 'Open tally share workspace',
        icon: 'share',
      },
    };
  }

  if (isCloseProposal && closeCountingSession && actorCloseShare) {
    return {
      statusLabel: 'Tally share recorded',
      summary: `Your bound tally share is ${getFinalizationShareStatusLabel(actorCloseShare.Status).toLowerCase()} for this close-counting session.`,
      toneClass: 'border-green-500/40 bg-green-500/10 text-green-100',
      defaultExpanded: false,
      actorApproval,
      closeCountingSession,
      actorCloseShare,
      acceptedShareCount,
      primaryAction: null,
    };
  }

  if (proposal.ExecutionStatus === ElectionGovernedProposalExecutionStatusProto.WaitingForApprovals) {
    if (actorApproval) {
      return {
        statusLabel: 'Approval recorded',
        summary: `Your ${actionLabel} approval is recorded. The proposal is still waiting for the remaining trustee approvals.`,
        toneClass: 'border-blue-500/40 bg-blue-500/10 text-blue-100',
        defaultExpanded: false,
        actorApproval,
        closeCountingSession,
        actorCloseShare,
        acceptedShareCount,
        primaryAction: null,
      };
    }

    return {
      statusLabel: 'Approval required',
      summary: `Review and approve this exact ${actionLabel} proposal. Doing nothing leaves the governed action pending.`,
      toneClass: 'border-amber-500/40 bg-amber-500/10 text-amber-100',
      defaultExpanded: true,
      actorApproval,
      closeCountingSession,
      actorCloseShare,
      acceptedShareCount,
      primaryAction: {
        href: `/elections/${proposal.ElectionId}/trustee/proposal/${proposal.Id}`,
        label: 'Review and approve',
        icon: 'review',
      },
    };
  }

  if (proposal.ExecutionStatus === ElectionGovernedProposalExecutionStatusProto.ExecutionFailed) {
    return {
      statusLabel: 'Execution failed',
      summary:
        proposal.ExecutionFailureReason || 'This governed action reached threshold but execution failed.',
      toneClass: 'border-red-500/40 bg-red-500/10 text-red-100',
      defaultExpanded: false,
      actorApproval,
      closeCountingSession,
      actorCloseShare,
      acceptedShareCount,
      primaryAction: null,
    };
  }

  if (actorApproval) {
    return {
      statusLabel: 'Approved and executed',
      summary: `Your ${actionLabel} approval is on record and the proposal already executed.`,
      toneClass: 'border-hush-purple/40 bg-hush-purple/10 text-hush-purple',
      defaultExpanded: false,
      actorApproval,
      closeCountingSession,
      actorCloseShare,
      acceptedShareCount,
      primaryAction: null,
    };
  }

  return {
    statusLabel: 'Missed after execution',
    summary: `You did not approve before this ${actionLabel} proposal executed. The election has already moved past that governed action.`,
    toneClass: 'border-red-500/40 bg-red-500/10 text-red-100',
    defaultExpanded: false,
    actorApproval,
    closeCountingSession,
    actorCloseShare,
    acceptedShareCount,
    primaryAction: null,
  };
}

type TrusteeGovernedProposalSectionProps = {
  proposal: ElectionGovernedProposal;
  detail: GetElectionResponse;
  actorPublicAddress: string;
  forceExpanded?: boolean;
};

function TrusteeGovernedProposalSection({
  proposal,
  detail,
  actorPublicAddress,
  forceExpanded = false,
}: TrusteeGovernedProposalSectionProps) {
  const state = useMemo(
    () => buildGovernedActionState(detail, proposal, actorPublicAddress),
    [actorPublicAddress, detail, proposal]
  );
  const [isExpanded, setIsExpanded] = useState(forceExpanded || state.defaultExpanded);
  const previousDefaultExpanded = useRef(forceExpanded || state.defaultExpanded);

  useEffect(() => {
    const nextDefaultExpanded = forceExpanded || state.defaultExpanded;
    if (previousDefaultExpanded.current !== nextDefaultExpanded) {
      setIsExpanded(nextDefaultExpanded);
      previousDefaultExpanded.current = nextDefaultExpanded;
    }
  }, [forceExpanded, state.defaultExpanded]);

  return (
    <section
      className={sectionClass}
      data-testid={`trustee-governed-section-${proposal.Id}`}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-hush-text-accent">
            Governed action
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold text-hush-text-primary">
              {getGovernedActionLabel(proposal.ActionType)} proposal
            </h2>
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${state.toneClass}`}
            >
              {state.statusLabel}
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">{state.summary}</p>
        </div>

        <div className="flex w-full shrink-0 flex-wrap items-center gap-3 xl:w-auto xl:justify-end">
          {state.primaryAction ? (
            <Link
              href={state.primaryAction.href}
              className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
              data-testid={`trustee-governed-action-${proposal.Id}`}
            >
              {state.primaryAction.icon === 'share' ? (
                <Files className="h-4 w-4" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              <span>{state.primaryAction.label}</span>
            </Link>
          ) : null}

          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-transparent px-4 py-2 text-sm font-medium text-hush-text-primary transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
            aria-expanded={isExpanded}
            data-testid={`trustee-governed-toggle-${proposal.Id}`}
          >
            <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {isExpanded ? (
        <div className="mt-5 space-y-4 border-t border-white/5 pt-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-hush-bg-dark/80 p-4 shadow-sm shadow-black/10">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                Proposal id
              </div>
              <div className="mt-2 break-all font-mono text-sm text-hush-text-primary">
                {proposal.Id}
              </div>
            </div>
            <div className="rounded-2xl bg-hush-bg-dark/80 p-4 shadow-sm shadow-black/10">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                Created
              </div>
              <div className="mt-2 text-sm text-hush-text-primary">
                {formatTimestamp(proposal.CreatedAt)}
              </div>
            </div>
            <div className="rounded-2xl bg-hush-bg-dark/80 p-4 shadow-sm shadow-black/10">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                Approval progress
              </div>
              <div className="mt-2 text-sm text-hush-text-primary">
                {detail.Election.RequiredApprovalCount > 0
                  ? `${getGovernedProposalProgress(detail, proposal.Id).approvalCount} of ${detail.Election.RequiredApprovalCount}`
                  : `${getGovernedProposalProgress(detail, proposal.Id).approvalCount} approvals`}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-hush-bg-dark/80 p-4 shadow-sm shadow-black/10">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
              Execution state
            </div>
            <div className="mt-2 text-sm text-hush-text-primary">
              {getGovernedProposalExecutionStatusLabel(proposal.ExecutionStatus)}
            </div>
            {proposal.ExecutionFailureReason ? (
              <p className="mt-2 text-sm text-red-100">{proposal.ExecutionFailureReason}</p>
            ) : null}
          </div>

          <div
            className={`rounded-2xl p-4 shadow-sm shadow-black/10 ${
              state.actorApproval
                ? 'bg-hush-bg-dark/80'
                : state.statusLabel === 'Missed after execution'
                  ? 'bg-red-500/10 text-red-100'
                  : 'bg-hush-bg-dark/80'
            }`}
          >
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
              Your participation
            </div>
            {state.actorApproval ? (
              <>
                <div className="mt-2 text-sm font-medium text-hush-text-primary">
                  Approval recorded at {formatTimestamp(state.actorApproval.ApprovedAt)}
                </div>
                {state.actorApproval.ApprovalNote ? (
                  <p className="mt-2 text-sm text-hush-text-accent">
                    Note: {state.actorApproval.ApprovalNote}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-hush-text-accent">
                    No trustee note was attached to this approval.
                  </p>
                )}
              </>
            ) : proposal.ExecutionStatus ===
              ElectionGovernedProposalExecutionStatusProto.WaitingForApprovals ? (
              <p className="mt-2 text-sm text-hush-text-accent">
                No approval is recorded yet for this trustee.
              </p>
            ) : (
              <p className="mt-2 text-sm">
                This trustee did not approve before the governed action completed.
              </p>
            )}
          </div>

          {proposal.ActionType === ElectionGovernedActionTypeProto.Close ? (
            <div
              className="rounded-2xl bg-hush-bg-dark/80 p-4 shadow-sm shadow-black/10"
              data-testid={`trustee-governed-close-follow-up-${proposal.Id}`}
            >
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                Close-counting follow-up
              </div>
              {state.closeCountingSession ? (
                <div className="mt-3 space-y-3">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl bg-hush-bg-light/60 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                        Session status
                      </div>
                      <div className="mt-2 text-sm text-hush-text-primary">
                        {getFinalizationSessionStatusLabel(state.closeCountingSession.Status)}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-hush-bg-light/60 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                        Share progress
                      </div>
                      <div className="mt-2 text-sm text-hush-text-primary">
                        {state.acceptedShareCount} of {state.closeCountingSession.RequiredShareCount}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-hush-bg-light/60 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                        Your tally share
                      </div>
                      <div className="mt-2 text-sm text-hush-text-primary">
                        {state.actorCloseShare
                          ? getFinalizationShareStatusLabel(state.actorCloseShare.Status)
                          : 'Not submitted'}
                      </div>
                    </div>
                  </div>

                  {state.actorCloseShare ? (
                    <p className="text-sm text-hush-text-accent">
                      Submitted at {formatTimestamp(state.actorCloseShare.SubmittedAt)}.
                    </p>
                  ) : state.closeCountingSession.Status ===
                    ElectionFinalizationSessionStatusProto.FinalizationSessionAwaitingShares ? (
                    <p className="text-sm text-hush-text-accent">
                      This session is active now. Continue in the tally share workspace to submit the
                      bound close-counting share.
                    </p>
                  ) : null}
                </div>
              ) : proposal.ExecutionStatus ===
                ElectionGovernedProposalExecutionStatusProto.WaitingForApprovals ? (
                <p className="mt-3 text-sm text-hush-text-accent">
                  Close uses one trustee workflow over two protocol steps. The bound tally-share step
                  will unlock only after close reaches threshold and the server creates the
                  close-counting session.
                </p>
              ) : (
                <p className="mt-3 text-sm text-hush-text-accent">
                  Close executed, and the server is still indexing the bound close-counting session.
                  This page refreshes automatically as new blocks arrive.
                </p>
              )}
            </div>
          ) : null}

          <div className="flex items-center justify-end">
            <Link
              href={`/elections/${proposal.ElectionId}/trustee/proposal/${proposal.Id}`}
              className="inline-flex items-center gap-2 rounded-xl bg-hush-bg-dark px-4 py-2 text-sm font-medium text-hush-text-primary transition-colors hover:bg-hush-bg-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
            >
              <ArrowRight className="h-4 w-4" />
              <span>Open exact proposal detail</span>
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function TrusteeGovernedActionsPanel({
  electionId,
  actorPublicAddress,
}: TrusteeGovernedActionsPanelProps) {
  const { error, isLoadingDetail, loadElection, reset, selectedElection } = useElectionsStore();
  const blockHeight = useBlockchainStore((state) => state.blockHeight);
  const lastObservedBlockHeightRef = useRef(blockHeight);

  useEffect(() => {
    void loadElection(electionId);
  }, [electionId, loadElection]);

  useEffect(() => () => reset(), [reset]);

  const proposals = useMemo(
    () =>
      (selectedElection?.GovernedProposals ?? [])
        .slice()
        .sort((left, right) => timestampToMillis(right.CreatedAt) - timestampToMillis(left.CreatedAt)),
    [selectedElection?.GovernedProposals]
  );
  const activeProposalId = useMemo(() => {
    const activeApprovalProposal = proposals.find((proposal) => {
      if (
        proposal.ExecutionStatus !== ElectionGovernedProposalExecutionStatusProto.WaitingForApprovals
      ) {
        return false;
      }

      const actorApproval = getGovernedProposalProgress(selectedElection ?? null, proposal.Id).approvals.find(
        (approval) => isSameActorAddress(approval.TrusteeUserAddress, actorPublicAddress)
      );
      return !actorApproval;
    });

    if (activeApprovalProposal) {
      return activeApprovalProposal.Id;
    }

    return (
      proposals.find((proposal) => {
        if (proposal.ActionType !== ElectionGovernedActionTypeProto.Close) {
          return false;
        }

        const session = getBoundCloseCountingSession(selectedElection ?? null, proposal.Id);
        if (!session) {
          return false;
        }

        const actorShare = getLatestFinalizationShareForTrustee(
          selectedElection ?? null,
          actorPublicAddress,
          session.Id
        );
        return !actorShare;
      })?.Id ?? null
    );
  }, [actorPublicAddress, proposals, selectedElection]);
  const shouldRefreshOnBlockAdvance = useMemo(() => {
    const hasPendingProposal = proposals.some(
      (proposal) =>
        proposal.ExecutionStatus ===
        ElectionGovernedProposalExecutionStatusProto.WaitingForApprovals
    );
    const hasCloseSessionIndexing = proposals.some((proposal) => {
      if (proposal.ActionType !== ElectionGovernedActionTypeProto.Close) {
        return false;
      }

      return (
        proposal.ExecutionStatus ===
          ElectionGovernedProposalExecutionStatusProto.ExecutionSucceeded &&
        !getBoundCloseCountingSession(selectedElection ?? null, proposal.Id)
      );
    });
    const hasActiveCloseCountingSession = (selectedElection?.FinalizationSessions ?? []).some(
      (session) =>
        session.SessionPurpose ===
          ElectionFinalizationSessionPurposeProto.FinalizationSessionPurposeCloseCounting &&
        session.Status ===
          ElectionFinalizationSessionStatusProto.FinalizationSessionAwaitingShares
    );

    return hasPendingProposal || hasCloseSessionIndexing || hasActiveCloseCountingSession;
  }, [proposals, selectedElection]);

  useEffect(() => {
    if (blockHeight <= 0) {
      lastObservedBlockHeightRef.current = blockHeight;
      return;
    }

    if (!shouldRefreshOnBlockAdvance || blockHeight === lastObservedBlockHeightRef.current) {
      return;
    }

    lastObservedBlockHeightRef.current = blockHeight;
    void loadElection(electionId, { silent: true });
  }, [blockHeight, electionId, loadElection, shouldRefreshOnBlockAdvance]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-hush-bg-dark text-hush-text-primary">
      <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col p-4 md:p-6">
        <div className="mb-6">
          <Link
            href={`/elections/${electionId}`}
            className="mb-3 inline-flex items-center gap-2 text-sm text-hush-text-accent transition-colors hover:text-hush-purple"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to election</span>
          </Link>
          <h1 className="text-2xl font-semibold">Trustee Governed Actions</h1>
          <p className="mt-2 max-w-4xl text-sm text-hush-text-accent">
            Review the governed-action history for this election, keep the current trustee action at
            the top, and inspect the proof already recorded for earlier approvals.
          </p>
        </div>

        {isLoadingDetail && !selectedElection ? (
          <div className={`${sectionClass} flex items-center gap-3`}>
            <Loader2 className="h-5 w-5 animate-spin text-hush-purple" />
            <span className="text-sm text-hush-text-accent">
              Loading trustee governed actions...
            </span>
          </div>
        ) : error ? (
          <div className={`${sectionClass} rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100`}>
            <div className="flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </div>
        ) : !selectedElection?.Election ? (
          <div className={sectionClass}>
            <div className="flex items-center gap-2 text-sm font-medium text-red-100">
              <AlertCircle className="h-4 w-4" />
              <span>Election details are unavailable for this trustee.</span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <section className={sectionClass}>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-hush-text-accent">
                Election
              </div>
              <h2 className="mt-2 text-xl font-semibold">{selectedElection.Election.Title}</h2>
              <p className="mt-2 max-w-4xl text-sm text-hush-text-accent">
                Current required actions expand automatically. Earlier governed approvals stay here
                as collapsed proof sections so this trustee can see what was approved, missed, or
                handed off to tally-share follow-up.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-hush-bg-dark/80 p-4 shadow-sm shadow-black/10">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Lifecycle
                  </div>
                  <div className="mt-2 text-sm text-hush-text-primary">
                    {getLifecycleLabel(selectedElection.Election.LifecycleState)}
                  </div>
                </div>
                <div className="rounded-2xl bg-hush-bg-dark/80 p-4 shadow-sm shadow-black/10">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Governed actions
                  </div>
                  <div className="mt-2 text-sm text-hush-text-primary">
                    {proposals.length === 1 ? '1 recorded proposal' : `${proposals.length} recorded proposals`}
                  </div>
                </div>
                <div className="rounded-2xl bg-hush-bg-dark/80 p-4 shadow-sm shadow-black/10">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Current trustee focus
                  </div>
                  <div className="mt-2 text-sm text-hush-text-primary">
                    {activeProposalId ? 'Current action highlighted below' : 'No trustee governed action is currently pending'}
                  </div>
                </div>
              </div>
            </section>

            {proposals.length === 0 ? (
              <section className={sectionClass} data-testid="trustee-governed-empty-state">
                <div className="flex items-center gap-2 text-sm font-medium text-hush-text-primary">
                  <Clock3 className="h-4 w-4 text-hush-text-accent" />
                  <span>No governed actions are recorded for this election yet.</span>
                </div>
                <p className="mt-2 text-sm text-hush-text-accent">
                  When the owner starts `open`, `close`, or `finalize`, that governed action will
                  appear here and become the trustee review entry point.
                </p>
              </section>
            ) : (
              proposals.map((proposal) => (
                <TrusteeGovernedProposalSection
                  key={proposal.Id}
                  proposal={proposal}
                  detail={selectedElection}
                  actorPublicAddress={actorPublicAddress}
                  forceExpanded={proposal.Id === activeProposalId}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
