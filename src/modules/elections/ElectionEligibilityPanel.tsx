"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Loader2, ShieldAlert, ShieldCheck, UserRoundCheck } from 'lucide-react';
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
      return 'Owner';
    case ElectionEligibilityActorRoleProto.EligibilityActorRestrictedReviewer:
      return 'Restricted reviewer';
    case ElectionEligibilityActorRoleProto.EligibilityActorLinkedVoter:
      return 'Linked voter';
    case ElectionEligibilityActorRoleProto.EligibilityActorReadOnly:
      return 'Read-only';
    default:
      return 'Unknown';
  }
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
      <div className="flex min-h-screen items-center justify-center bg-hush-bg-dark">
        <div className="flex items-center gap-3 text-sm text-hush-text-accent">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading election eligibility...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hush-bg-dark px-4 py-8 text-hush-text-primary">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <Link
              href="/account/elections"
              className="text-sm text-hush-text-accent transition-colors hover:text-hush-text-primary"
            >
              Back to elections
            </Link>
            <h1 className="mt-2 text-3xl font-semibold">{election?.Title || 'Election eligibility'}</h1>
            <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
              FEAT-095 keeps the named checkoff layer explicit. Claim-linking is not voting, and restricted roster review never exposes ballot identity.
            </p>
          </div>
          <div className="rounded-2xl border border-hush-purple/30 bg-hush-purple/10 px-4 py-3 text-sm text-hush-text-primary">
            Role: {getRoleLabel(eligibilityView?.ActorRole ?? ElectionEligibilityActorRoleProto.EligibilityActorUnknown)}
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
              <div className="rounded-2xl border border-hush-bg-light bg-hush-bg-element/95 p-5 shadow-sm shadow-black/10">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">Rostered</div>
                <div className="mt-2 text-3xl font-semibold">{eligibilityView.Summary.RosteredCount}</div>
              </div>
              <div className="rounded-2xl border border-hush-bg-light bg-hush-bg-element/95 p-5 shadow-sm shadow-black/10">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">Linked</div>
                <div className="mt-2 text-3xl font-semibold">{eligibilityView.Summary.LinkedCount}</div>
              </div>
              <div className="rounded-2xl border border-hush-bg-light bg-hush-bg-element/95 p-5 shadow-sm shadow-black/10">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">Denominator</div>
                <div className="mt-2 text-3xl font-semibold">{eligibilityView.Summary.CurrentDenominatorCount}</div>
              </div>
              <div className="rounded-2xl border border-hush-bg-light bg-hush-bg-element/95 p-5 shadow-sm shadow-black/10">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">Counted participation</div>
                <div className="mt-2 text-3xl font-semibold">{eligibilityView.Summary.CountedParticipationCount}</div>
              </div>
            </div>

            {(eligibilityView.CanClaimIdentity || eligibilityView.SelfRosterEntry) ? (
              <section className="rounded-2xl border border-hush-bg-light bg-hush-bg-element/95 p-5 shadow-sm shadow-black/10">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Your election identity</h2>
                    <p className="mt-1 text-sm text-hush-text-accent">
                      The temporary verification code is <span className="font-semibold text-hush-text-primary">{eligibilityView.TemporaryVerificationCode}</span>. This links your imported identity only. It does not mean you have already voted.
                    </p>
                  </div>
                  <ShieldCheck className="h-5 w-5 text-hush-purple" />
                </div>

                {eligibilityView.SelfRosterEntry ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">Linked voter id</div>
                      <div className="mt-2 font-mono text-lg">{eligibilityView.SelfRosterEntry.OrganizationVoterId}</div>
                      <div className="mt-3 text-sm text-hush-text-accent">{eligibilityView.SelfRosterEntry.ContactValueHint}</div>
                    </div>
                    <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">Participation status</div>
                      <div className="mt-2 text-lg font-semibold">
                        {getParticipationLabel(
                          eligibilityView.SelfRosterEntry.ParticipationStatus,
                          election?.LifecycleState === 1,
                          eligibilityView.SelfRosterEntry.InCurrentDenominator
                        )}
                      </div>
                      <div className="mt-3 text-sm text-hush-text-accent">
                        Voting right: {eligibilityView.SelfRosterEntry.VotingRightStatus === 1 ? 'Active' : 'Inactive'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-[1fr_0.9fr]">
                    <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
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
                    <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
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
              <section className="rounded-2xl border border-hush-bg-light bg-hush-bg-element/95 p-5 shadow-sm shadow-black/10">
                <div className="mb-4 flex items-start justify-between gap-3">
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
