"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import {
  ElectionGovernedActionTypeProto,
  ElectionGovernedProposalExecutionStatusProto,
} from '@/lib/grpc';
import {
  formatTimestamp,
  getGovernedActionLabel,
  getGovernedProposalExecutionStatusLabel,
  getGovernedProposalProgress,
} from './contracts';
import { useElectionsStore } from './useElectionsStore';

type TrusteeGovernedProposalPanelProps = {
  electionId: string;
  proposalId: string;
  actorPublicAddress: string;
  actorEncryptionPublicKey: string;
  actorEncryptionPrivateKey: string;
  actorSigningPrivateKey: string;
};

const sectionClass =
  'rounded-2xl border border-hush-bg-light bg-hush-bg-element/95 p-5 shadow-sm shadow-black/10';

export function TrusteeGovernedProposalPanel({
  electionId,
  proposalId,
  actorPublicAddress,
  actorEncryptionPublicKey,
  actorEncryptionPrivateKey,
  actorSigningPrivateKey,
}: TrusteeGovernedProposalPanelProps) {
  const {
    approveGovernedProposal,
    feedback,
    error,
    isLoadingDetail,
    isSubmitting,
    loadElection,
    reset,
    selectedElection,
  } = useElectionsStore();
  const [approvalNote, setApprovalNote] = useState('');

  useEffect(() => {
    void loadElection(electionId);
  }, [electionId, loadElection]);

  useEffect(() => () => reset(), [reset]);

  const election = selectedElection?.Election;
  const proposal = useMemo(
    () => selectedElection?.GovernedProposals.find((candidate) => candidate.Id === proposalId) ?? null,
    [proposalId, selectedElection]
  );
  const progress = useMemo(
    () =>
      proposal
        ? getGovernedProposalProgress(selectedElection ?? null, proposal.Id)
        : {
            approvalCount: 0,
            requiredApprovalCount: election?.RequiredApprovalCount ?? null,
            approvals: [],
          },
    [election?.RequiredApprovalCount, proposal, selectedElection]
  );
  const hasCurrentActorApproved = progress.approvals.some(
    (approval) => approval.TrusteeUserAddress === actorPublicAddress
  );
  const canApprove =
    proposal?.ExecutionStatus === ElectionGovernedProposalExecutionStatusProto.WaitingForApprovals &&
    !hasCurrentActorApproved;

  const handleApprove = async () => {
    const didApprove = await approveGovernedProposal(
      proposalId,
      actorPublicAddress,
      actorEncryptionPublicKey,
      actorEncryptionPrivateKey,
      actorSigningPrivateKey,
      approvalNote
    );
    if (didApprove) {
      setApprovalNote('');
    }
  };

  return (
    <div className="min-h-screen bg-hush-bg-dark text-hush-text-primary">
      <div className="mx-auto max-w-4xl p-4 md:p-6">
        <div className="mb-6">
          <Link
            href="/account/elections"
            className="mb-3 inline-flex items-center gap-2 text-sm text-hush-text-accent transition-colors hover:text-hush-purple"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to elections</span>
          </Link>
          <h1 className="text-2xl font-semibold">Trustee Proposal Approval</h1>
          <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
            Review one exact FEAT-096 governed action and record a single immutable approval.
          </p>
        </div>

        {feedback && (
          <div
            className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
              feedback.tone === 'success'
                ? 'border-green-500/40 bg-green-500/10 text-green-100'
                : 'border-red-500/40 bg-red-500/10 text-red-100'
            }`}
            role="status"
          >
            <div className="flex items-center gap-2 font-medium">
              {feedback.tone === 'success' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <span>{feedback.message}</span>
            </div>
            {feedback.details.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {feedback.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {isLoadingDetail && !selectedElection ? (
          <div className={`${sectionClass} flex items-center gap-3`}>
            <Loader2 className="h-5 w-5 animate-spin text-hush-purple" />
            <span className="text-sm text-hush-text-accent">Loading proposal context...</span>
          </div>
        ) : !proposal || !election ? (
          <div className={sectionClass}>
            <div className="flex items-center gap-2 text-sm font-medium text-red-100">
              <AlertCircle className="h-4 w-4" />
              <span>Proposal not found for this election.</span>
            </div>
            <p className="mt-3 text-sm text-hush-text-accent">
              Check the election and proposal identifiers, then refresh from the owner workspace.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <section className={sectionClass} data-testid="trustee-proposal-summary">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Election
                  </div>
                  <h2 className="mt-2 text-xl font-semibold">{election.Title}</h2>
                  <div className="mt-2 text-sm text-hush-text-accent">
                    {getGovernedActionLabel(proposal.ActionType)} proposal for election{' '}
                    <span className="font-mono text-hush-text-primary">{election.ElectionId}</span>
                  </div>
                </div>
                <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-2 text-xs text-hush-text-accent">
                  Execution state: {getGovernedProposalExecutionStatusLabel(proposal.ExecutionStatus)}
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Proposal id
                  </div>
                  <div className="mt-2 break-all font-mono text-sm">{proposal.Id}</div>
                </div>
                <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Created
                  </div>
                  <div className="mt-2 text-sm">{formatTimestamp(proposal.CreatedAt)}</div>
                </div>
                <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Approval progress
                  </div>
                  <div className="mt-2 text-sm">
                    {progress.requiredApprovalCount !== null
                      ? `${progress.approvalCount} of ${progress.requiredApprovalCount}`
                      : `${progress.approvalCount} approvals`}
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
                <div className="flex items-center gap-2 font-medium">
                  <ShieldAlert className="h-4 w-4" />
                  <span>Approval meaning</span>
                </div>
                <p className="mt-2">
                  This approval is not a general ballot-decryption permission. It applies only to
                  this exact election action and proposal record.
                </p>
              </div>

              {proposal.ExecutionStatus ===
                ElectionGovernedProposalExecutionStatusProto.ExecutionFailed && (
                <div className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
                  {proposal.ExecutionFailureReason || 'Execution failed after approval threshold.'}
                </div>
              )}

              {proposal.ActionType === ElectionGovernedActionTypeProto.Finalize ? (
                <div className="mt-5 rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4 text-sm text-hush-text-accent">
                  <div className="font-medium text-hush-text-primary">Finalize follow-up</div>
                  <p className="mt-2">
                    This proposal can authorize one exact FEAT-098 finalization session. The
                    follow-up page shows the bound session and aggregate-only share action once
                    execution succeeds.
                  </p>
                  <Link
                    href={`/account/elections/trustee/${electionId}/finalization`}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl border border-hush-bg-light px-4 py-2 text-sm transition-colors hover:border-hush-purple"
                    data-testid="trustee-proposal-finalization-link"
                  >
                    <span>Open finalization page</span>
                  </Link>
                </div>
              ) : null}
            </section>

            <section className={sectionClass} data-testid="trustee-proposal-approval-panel">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Trustee Approval</h2>
                <p className="mt-1 text-sm text-hush-text-accent">
                  Trustees can approve or do nothing in FEAT-096. Reject and abstain controls are
                  intentionally absent in this rollout.
                </p>
              </div>

              {progress.approvals.length > 0 && (
                <div className="mb-5 space-y-2">
                  {progress.approvals.map((approval) => (
                    <div
                      key={approval.Id}
                      className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 px-4 py-3 text-sm"
                    >
                      <div className="font-medium">
                        {approval.TrusteeDisplayName || approval.TrusteeUserAddress}
                      </div>
                      <div className="mt-1 text-xs text-hush-text-accent">
                        Approved at {formatTimestamp(approval.ApprovedAt)}
                      </div>
                      {approval.ApprovalNote ? (
                        <div className="mt-2 text-sm text-hush-text-accent">
                          Note: {approval.ApprovalNote}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              {hasCurrentActorApproved ? (
                <div className="rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-100">
                  Your approval is already recorded for this proposal.
                </div>
              ) : canApprove ? (
                <>
                  <label className="block text-sm">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                      Optional note
                    </span>
                    <textarea
                      value={approvalNote}
                      onChange={(event) => setApprovalNote(event.target.value)}
                      className="min-h-28 w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-3 py-3 text-sm outline-none transition-colors focus:border-hush-purple"
                      placeholder="Add a short trustee note for the durable record..."
                      data-testid="trustee-approval-note"
                    />
                  </label>

                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => void handleApprove()}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent"
                      data-testid="trustee-approve-button"
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      <span>Approve proposal</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark px-4 py-3 text-sm text-hush-text-accent">
                  {proposal.ExecutionStatus ===
                  ElectionGovernedProposalExecutionStatusProto.ExecutionSucceeded
                    ? 'This proposal has already executed successfully.'
                    : 'This proposal is not currently accepting approvals.'}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
