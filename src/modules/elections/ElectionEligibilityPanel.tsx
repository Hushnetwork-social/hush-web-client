"use client";

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleHelp, Loader2, ShieldAlert, ShieldCheck, UserRoundCheck } from 'lucide-react';
import {
  ElectionEligibilityActorRoleProto,
  ElectionParticipationStatusProto,
  type GetElectionEligibilityViewResponse,
  type GetElectionResponse,
} from '@/lib/grpc';
import { electionsService } from '@/lib/grpc/services/elections';
import { submitTransaction } from '@/modules/blockchain/BlockchainService';
import { createClaimElectionRosterEntryTransaction } from './transactionService';

type ElectionEligibilityPanelProps = {
  electionId: string;
  actorPublicAddress: string;
  actorEncryptionPublicKey: string;
  actorEncryptionPrivateKey: string;
  actorSigningPrivateKey: string;
};

type EligibilityFeedback = {
  tone: 'success' | 'error';
  message: string;
};

const insetCardClass = 'rounded-2xl bg-hush-bg-element/92 px-5 py-4 shadow-sm shadow-black/10';
const valueFieldClass = 'mt-4 flex h-24 items-center rounded-2xl border border-hush-bg-light/70 bg-hush-bg-dark px-6 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForEligibilityViewMatch(
  electionId: string,
  actorPublicAddress: string,
  isMatch: (response: GetElectionEligibilityViewResponse) => boolean,
  maxAttempts: number = 12,
  delayMs: number = 500
): Promise<GetElectionEligibilityViewResponse | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await electionsService.getElectionEligibilityView({
        ElectionId: electionId,
        ActorPublicAddress: actorPublicAddress,
      });
      if (response.Success && isMatch(response)) {
        return response;
      }
    } catch {
      // Query indexing is eventually consistent after submission.
    }

    if (attempt < maxAttempts - 1) {
      await delay(delayMs);
    }
  }

  return null;
}

function getRoleLabel(role: ElectionEligibilityActorRoleProto): string {
  switch (role) {
    case ElectionEligibilityActorRoleProto.EligibilityActorOwner:
      return 'Admin';
    case ElectionEligibilityActorRoleProto.EligibilityActorRestrictedReviewer:
      return 'Auditor';
    case ElectionEligibilityActorRoleProto.EligibilityActorLinkedVoter:
      return 'Voter';
    case ElectionEligibilityActorRoleProto.EligibilityActorReadOnly:
      return 'Viewer';
    default:
      return 'Access';
  }
}

function getRoleLabels(
  role: ElectionEligibilityActorRoleProto,
  hasLinkedIdentity: boolean
): string[] {
  const labels = [getRoleLabel(role)];

  if (
    hasLinkedIdentity &&
    role !== ElectionEligibilityActorRoleProto.EligibilityActorLinkedVoter &&
    !labels.includes('Voter')
  ) {
    labels.push('Voter');
  }

  return labels;
}

function getEligibilityIntroCopy(
  hasLinkedIdentity: boolean,
  canClaimIdentity: boolean,
  canReviewRestrictedRoster: boolean,
  actorRole: ElectionEligibilityActorRoleProto
): string {
  if (hasLinkedIdentity) {
    return 'Review the voter record linked to this Hush account and open the voter detail when you are ready.';
  }

  if (actorRole === ElectionEligibilityActorRoleProto.EligibilityActorOwner && canReviewRestrictedRoster) {
    return 'Review the named participation roster, or link this Hush account to a voter record for this election.';
  }

  if (canClaimIdentity) {
    return 'Enter your organization voter ID and verification code to link this Hush account to the election.';
  }

  if (canReviewRestrictedRoster) {
    return 'Review the named participation roster and current linking status for this election.';
  }

  return 'This screen shows whether this Hush account can review roster details or link a voter record for this election.';
}

function getParticipationLabel(
  participationStatus: ElectionParticipationStatusProto,
  hasOpenElection: boolean,
  inCurrentDenominator: boolean
): string {
  if (participationStatus === ElectionParticipationStatusProto.ParticipationCountedAsVoted) {
    return 'Counted as voted';
  }

  if (participationStatus === ElectionParticipationStatusProto.ParticipationBlank) {
    return 'Blank';
  }

  if (hasOpenElection && inCurrentDenominator) {
    return 'Not yet voted';
  }

  return 'Did not vote';
}

function SummaryInfoFlyout({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event: MouseEvent): void {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={`About ${label}`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-hush-purple/35 bg-hush-purple/10 text-hush-purple transition-colors hover:bg-hush-purple/20"
      >
        <CircleHelp className="h-3.5 w-3.5" />
      </button>
      {isOpen ? (
        <div
          role="dialog"
          aria-label={`${label} explanation`}
          className="absolute left-0 top-full z-20 mt-2 w-80 rounded-2xl border border-hush-purple/30 bg-hush-bg-dark px-4 py-3 text-left normal-case font-normal tracking-normal shadow-xl shadow-black/30"
        >
          <p className="m-0 text-sm font-normal leading-6 tracking-normal text-hush-text-accent normal-case">
            {description}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function SummaryValueCard({
  label,
  value,
  infoText,
}: {
  label: string;
  value: string | number;
  infoText?: string;
}) {
  return (
    <div className="rounded-2xl bg-hush-bg-element/92 px-5 py-4 shadow-sm shadow-black/10">
      <div className="flex items-center gap-2">
        {infoText ? (
          <SummaryInfoFlyout
            label={label}
            description={infoText}
          />
        ) : null}
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
          {label}
        </span>
      </div>
      <div className={valueFieldClass}>
        <span className="text-3xl font-semibold leading-none text-hush-text-primary">{value}</span>
      </div>
    </div>
  );
}

export function ElectionEligibilityPanel({
  electionId,
  actorPublicAddress,
  actorEncryptionPublicKey,
  actorEncryptionPrivateKey,
  actorSigningPrivateKey,
}: ElectionEligibilityPanelProps) {
  const [detail, setDetail] = useState<GetElectionResponse | null>(null);
  const [eligibilityView, setEligibilityView] = useState<GetElectionEligibilityViewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<EligibilityFeedback | null>(null);
  const [organizationVoterId, setOrganizationVoterId] = useState('');
  const [verificationCode, setVerificationCode] = useState('1111');

  const election = detail?.Election;
  const actorRole = eligibilityView?.ActorRole ?? ElectionEligibilityActorRoleProto.EligibilityActorUnknown;
  const roleLabels = getRoleLabels(actorRole, Boolean(eligibilityView?.SelfRosterEntry));
  const canOwnerSelfLinkIdentity =
    actorRole === ElectionEligibilityActorRoleProto.EligibilityActorOwner
    && !eligibilityView?.SelfRosterEntry;
  const canLinkIdentity = Boolean(eligibilityView?.CanClaimIdentity || canOwnerSelfLinkIdentity);

  const restrictedRows = useMemo(
    () => eligibilityView?.RestrictedRosterEntries ?? [],
    [eligibilityView?.RestrictedRosterEntries]
  );

  useEffect(() => {
    let isActive = true;

    async function load(): Promise<void> {
      setIsLoading(true);
      try {
        const [detailResponse, eligibilityResponse] = await Promise.all([
          electionsService.getElection({ ElectionId: electionId }),
          electionsService.getElectionEligibilityView({
            ElectionId: electionId,
            ActorPublicAddress: actorPublicAddress,
          }),
        ]);

        if (isActive) {
          setDetail(detailResponse);
          setEligibilityView(eligibilityResponse);
        }
      } catch (error) {
        if (isActive) {
          setFeedback({
            tone: 'error',
            message: error instanceof Error ? error.message : 'Failed to load election eligibility view.',
          });
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      isActive = false;
    };
  }, [actorPublicAddress, electionId]);

  async function refreshContext(nextView?: GetElectionEligibilityViewResponse | null): Promise<void> {
    const [detailResponse, eligibilityResponse] = await Promise.all([
      electionsService.getElection({ ElectionId: electionId }),
      nextView
        ? Promise.resolve(nextView)
        : electionsService.getElectionEligibilityView({
          ElectionId: electionId,
          ActorPublicAddress: actorPublicAddress,
        }),
    ]);

    setDetail(detailResponse);
    setEligibilityView(eligibilityResponse);
  }

  async function handleClaim(): Promise<void> {
    if (!organizationVoterId.trim() || !verificationCode.trim()) {
      setFeedback({
        tone: 'error',
        message: 'Enter both organization voter id and verification code.',
      });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const { signedTransaction } = await createClaimElectionRosterEntryTransaction(
        electionId,
        actorPublicAddress,
        actorEncryptionPublicKey,
        organizationVoterId.trim(),
        verificationCode.trim(),
        actorSigningPrivateKey,
        actorEncryptionPrivateKey
      );
      const submitResult = await submitTransaction(signedTransaction);
      if (!submitResult.successful) {
        throw new Error(submitResult.message || 'Claim submission failed.');
      }

      const awaitedView = await waitForEligibilityViewMatch(
        electionId,
        actorPublicAddress,
        (response) => response.SelfRosterEntry?.OrganizationVoterId === organizationVoterId.trim()
      );

      await refreshContext(awaitedView);
      setFeedback({
        tone: 'success',
        message: `Linked roster identity ${organizationVoterId.trim()} to this Hush account.`,
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Claim-linking failed.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-hush-bg-dark">
        <div className="flex items-center gap-3 text-sm text-hush-text-accent">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading election eligibility...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto text-hush-text-primary">
      <div className="flex w-full min-w-0 flex-col gap-6 p-4 md:p-5">
        <div className="flex flex-col gap-5 md:flex-row md:items-start">
          <div className="min-w-0 flex-1">
            <Link
              href="/elections"
              className="text-sm text-hush-text-accent transition-colors hover:text-hush-text-primary"
            >
              Back to HushVoting! Hub
            </Link>
            <h1 className="mt-2 text-3xl font-semibold">{election?.Title || 'Election eligibility'}</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-hush-text-accent">
              {getEligibilityIntroCopy(
                Boolean(eligibilityView?.SelfRosterEntry),
                canLinkIdentity,
                Boolean(eligibilityView?.CanReviewRestrictedRoster),
                actorRole
              )}
            </p>
          </div>
          <div className="flex min-h-32 min-w-[184px] items-center justify-center self-start rounded-3xl border border-hush-purple/40 bg-hush-purple/10 px-6 py-5 text-center shadow-lg shadow-black/15 md:ml-auto md:shrink-0">
            <div className="flex flex-col items-center gap-1 text-hush-purple">
              {roleLabels.map((label) => (
                <span key={label} className="text-3xl font-bold leading-tight tracking-tight">
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {feedback ? (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              feedback.tone === 'success'
                ? 'border-green-500/40 bg-green-500/10 text-green-100'
                : 'border-red-500/40 bg-red-500/10 text-red-100'
            }`}
          >
            {feedback.message}
          </div>
        ) : null}

        {!eligibilityView?.Success ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-5 text-sm text-red-100">
            {eligibilityView?.ErrorMessage || 'Eligibility data is unavailable.'}
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryValueCard
                label="Rostered"
                value={eligibilityView.Summary.RosteredCount}
                infoText="Rostered voters are all members listed on this election roster, whether they are currently eligible to vote or not."
              />
              <SummaryValueCard
                label="Linked"
                value={eligibilityView.Summary.LinkedCount}
              />
              <SummaryValueCard
                label="Denominator"
                value={eligibilityView.Summary.CurrentDenominatorCount}
                infoText="Denominator is the subset of rostered voters currently counted as eligible for turnout and result calculations. Rostered but inactive members are excluded."
              />
              <SummaryValueCard
                label="Counted participation"
                value={eligibilityView.Summary.CountedParticipationCount}
              />
            </div>

            {(canLinkIdentity || eligibilityView.SelfRosterEntry) ? (
              <section className="space-y-4">
                <div>
                  <h2 className="text-2xl font-semibold">Election identity</h2>
                  <p className="mt-2 text-sm leading-6 text-hush-text-accent">
                    {eligibilityView.SelfRosterEntry
                      ? 'This Hush account is already linked to a voter record for this election.'
                      : 'Use your organization voter ID and verification code to link this Hush account to the election.'}
                  </p>
                </div>

                {eligibilityView.SelfRosterEntry ? (
                  <div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className={`${insetCardClass} flex flex-col`}>
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">Associated number</div>
                        <div className={valueFieldClass}>
                          <span className="font-mono text-3xl font-semibold leading-none text-hush-text-primary">
                            {eligibilityView.SelfRosterEntry.OrganizationVoterId}
                          </span>
                        </div>
                        {eligibilityView.SelfRosterEntry.ContactValueHint ? (
                          <div className="mt-4 text-sm text-hush-text-accent">{eligibilityView.SelfRosterEntry.ContactValueHint}</div>
                        ) : null}
                      </div>
                      <div className={`${insetCardClass} flex flex-col`}>
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">Participation</div>
                        <div className={valueFieldClass}>
                          <span className="text-3xl font-semibold leading-tight text-hush-text-primary">
                            {getParticipationLabel(
                              eligibilityView.SelfRosterEntry.ParticipationStatus,
                              election?.LifecycleState === 1,
                              eligibilityView.SelfRosterEntry.InCurrentDenominator
                            )}
                          </span>
                        </div>
                        <div className="mt-4 text-sm text-hush-text-accent">
                          Voting right {eligibilityView.SelfRosterEntry.VotingRightStatus === 1 ? 'active' : 'inactive'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap justify-end gap-3">
                      <Link
                        href={`/elections/${electionId}/voter`}
                        className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2.5 text-sm font-semibold text-hush-bg-dark transition-colors hover:bg-hush-purple/90"
                        data-testid="eligibility-open-voting-detail"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        <span>Open voting detail</span>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-[1fr_0.9fr]">
                    <div className={insetCardClass}>
                      <label className="block text-sm font-medium text-hush-text-primary">
                        Organization voter id
                        <input
                          value={organizationVoterId}
                          onChange={(event) => setOrganizationVoterId(event.target.value)}
                          className="mt-2 w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-4 py-3 font-mono text-sm text-hush-text-primary outline-none transition-colors focus:border-hush-purple"
                          placeholder="10042"
                          data-testid="eligibility-claim-org-id"
                        />
                      </label>
                    </div>
                    <div className={insetCardClass}>
                      <label className="block text-sm font-medium text-hush-text-primary">
                        Verification code
                        <input
                          value={verificationCode}
                          onChange={(event) => setVerificationCode(event.target.value)}
                          className="mt-2 w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-4 py-3 font-mono text-sm text-hush-text-primary outline-none transition-colors focus:border-hush-purple"
                          placeholder="1111"
                          data-testid="eligibility-claim-code"
                        />
                      </label>
                    </div>
                  </div>
                )}

                {!eligibilityView.SelfRosterEntry ? (
                  <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => void handleClaim()}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent"
                      data-testid="eligibility-claim-submit"
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRoundCheck className="h-4 w-4" />}
                      <span>Verify and link</span>
                    </button>
                  </div>
                ) : null}
              </section>
            ) : null}

            {eligibilityView.CanReviewRestrictedRoster ? (
              <section className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Restricted participation roster</h2>
                    <p className="mt-1 text-sm text-hush-text-accent">
                      This review surface is derived from the checkoff layer only and never exposes ballot identifiers or vote choices.
                    </p>
                  </div>
                  <div className="rounded-xl border border-hush-purple/30 bg-hush-purple/10 px-3 py-2 text-xs text-hush-text-primary">
                    Authorized role
                  </div>
                </div>

                {restrictedRows.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-hush-bg-light px-4 py-5 text-sm text-hush-text-accent">
                    No restricted roster rows are available yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-xs uppercase tracking-[0.18em] text-hush-text-accent">
                        <tr>
                          <th className="pb-3 pr-4 font-medium">Org voter id</th>
                          <th className="pb-3 pr-4 font-medium">Contact</th>
                          <th className="pb-3 pr-4 font-medium">Voting right</th>
                          <th className="pb-3 font-medium">Participation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {restrictedRows.map((row) => (
                          <tr key={row.OrganizationVoterId} className="border-t border-hush-bg-light/70">
                            <td className="py-3 pr-4 font-mono text-hush-text-primary">{row.OrganizationVoterId}</td>
                            <td className="py-3 pr-4 text-hush-text-accent">{row.ContactValueHint}</td>
                            <td className="py-3 pr-4 text-hush-text-accent">
                              {row.VotingRightStatus === 1 ? 'Active' : 'Inactive'}
                            </td>
                            <td className="py-3 text-hush-text-accent">
                              {getParticipationLabel(
                                row.ParticipationStatus,
                                election?.LifecycleState === 1,
                                row.InCurrentDenominator
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ) : null}

            {!eligibilityView.CanReviewRestrictedRoster
            && !eligibilityView.CanClaimIdentity
            && !eligibilityView.SelfRosterEntry ? (
              <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-100">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="mt-0.5 h-5 w-5" />
                  <div>
                    <div className="font-semibold">Restricted participation data is not available for this actor.</div>
                    <div className="mt-2 text-sm">
                      Ordinary read-only users can only access claim-linking when the election is still in draft or open and a rostered identity exists for their account.
                    </div>
                  </div>
                </div>
              </section>
              ) : null}
          </>
        )}
      </div>
    </div>
  );
}
