"use client";

import { useMemo } from 'react';
import { CheckCircle2, Lock, ShieldAlert } from 'lucide-react';
import {
  ElectionCloseCountingJobStatusProto,
  ElectionFinalizationSessionPurposeProto,
  ElectionFinalizationShareStatusProto,
  ElectionGovernanceModeProto,
  type GetElectionResponse,
} from '@/lib/grpc';
import {
  getCustodyBoundaryCopy,
  formatArtifactValue,
  formatTimestamp,
  getAcceptedFinalizationShareCount,
  getActiveFinalizationSession,
  getFinalizationSessionPurposeLabel,
  getFinalizationReleaseModeLabel,
  getFinalizationSessionStatusLabel,
  getFinalizationShareStatusLabel,
  getFinalizationShares,
  getGovernancePathLabel,
  getLatestFinalizationReleaseEvidence,
  getLatestFinalizationSession,
  type GovernedActionViewState,
} from './contracts';

type ElectionFinalizationWorkspaceSectionProps = {
  detail: GetElectionResponse | null;
  finalizeActionState: GovernedActionViewState | null;
};

const sectionClass =
  'rounded-2xl bg-hush-bg-element/95 p-5 shadow-lg shadow-black/10';

function formatTrusteeReferenceList(
  trustees:
    | ReadonlyArray<{
        TrusteeDisplayName?: string | null;
        TrusteeUserAddress: string;
      }>
    | null
    | undefined
): string {
  if (!trustees || trustees.length === 0) {
    return 'Not recorded';
  }

  return trustees
    .map((trustee) => trustee.TrusteeDisplayName || trustee.TrusteeUserAddress)
    .join(', ');
}

export function ElectionFinalizationWorkspaceSection({
  detail,
  finalizeActionState,
}: ElectionFinalizationWorkspaceSectionProps) {
  const governanceMode =
    detail?.Election?.GovernanceMode ?? ElectionGovernanceModeProto.AdminOnly;
  const usesTrustees = governanceMode === ElectionGovernanceModeProto.TrusteeThreshold;
  const session = useMemo(
    () => getActiveFinalizationSession(detail) ?? getLatestFinalizationSession(detail),
    [detail]
  );
  const shares = useMemo(() => getFinalizationShares(detail, session?.Id), [detail, session?.Id]);
  const releaseEvidence = useMemo(
    () => getLatestFinalizationReleaseEvidence(detail, session?.Id),
    [detail, session?.Id]
  );
  const acceptedShareCount = useMemo(
    () => getAcceptedFinalizationShareCount(detail, session?.Id),
    [detail, session?.Id]
  );
  const eligibleTrusteeCount = session?.EligibleTrustees.length ?? 0;
  const trusteeProgress = useMemo(() => {
    if (!session) {
      return [];
    }

    return session.EligibleTrustees.map((trustee) => {
      const latestShare = shares.find((share) => share.TrusteeUserAddress === trustee.TrusteeUserAddress);

      return {
        trustee,
        latestShare,
      };
    });
  }, [session, shares]);
  const pendingEligibleTrusteeCount = trusteeProgress.filter(
    ({ latestShare }) =>
      latestShare?.Status !== ElectionFinalizationShareStatusProto.FinalizationShareAccepted
  ).length;
  const recoverableCloseCountingFailure =
    session?.SessionPurpose ===
      ElectionFinalizationSessionPurposeProto.FinalizationSessionPurposeCloseCounting &&
    session.CloseCountingJobStatus ===
      ElectionCloseCountingJobStatusProto.CloseCountingJobFailed &&
    !releaseEvidence &&
    pendingEligibleTrusteeCount > 0;

  return (
    <section className={sectionClass} data-testid="elections-finalization-section">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Counting And Finalization</h2>
          <p className="mt-1 text-sm text-hush-text-accent">
            {usesTrustees
              ? 'Close-counting share sessions appear before tally readiness, while this view keeps the aggregate-only release boundary for the exact target session.'
              : 'Admin-only finalization keeps the protected custody story visible here so the owner can verify the release boundary without implying ballot inspection authority.'}
          </p>
        </div>
        {session ? (
          <div className="rounded-xl border border-hush-purple/30 bg-hush-purple/10 px-3 py-2 text-xs text-hush-text-primary">
            {getFinalizationSessionPurposeLabel(session.SessionPurpose)} |{' '}
            {getFinalizationSessionStatusLabel(session.Status)}
          </div>
        ) : (
          <div className="rounded-xl border border-hush-purple/30 bg-hush-purple/10 px-3 py-2 text-xs text-hush-text-primary">
            {getGovernancePathLabel(governanceMode)}
          </div>
        )}
      </div>

      {!session ? (
        <div
          className="rounded-xl border border-dashed border-hush-bg-light bg-hush-bg-dark/60 px-4 py-5 text-sm text-hush-text-accent"
          data-testid="elections-finalization-blocked"
        >
          <div className="flex items-center gap-2 font-medium text-hush-text-primary">
            <Lock className="h-4 w-4" />
            <span>
              {usesTrustees
                ? `${finalizeActionState?.label || 'Finalize'} has not created a bound session yet.`
                : 'Admin-only protected custody is waiting for the finalization boundary.'}
            </span>
          </div>
          <p className="mt-2">
            {usesTrustees
              ? finalizeActionState?.reason || 'The finalization target is not available yet.'
              : `${getCustodyBoundaryCopy(governanceMode)} ${
                  finalizeActionState?.reason || 'The finalization target is not available yet.'
                }`}
          </p>
        </div>
      ) : (
        <div className="space-y-5" data-testid="elections-finalization-session">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                Session purpose
              </div>
              <div className="mt-2 text-sm text-hush-text-primary">
                {getFinalizationSessionPurposeLabel(session.SessionPurpose)}
              </div>
            </div>
            <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                Close artifact
              </div>
              <div className="mt-2 font-mono text-sm text-hush-text-primary">
                {formatArtifactValue(session.CloseArtifactId)}
              </div>
            </div>
            <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                Aggregate target
              </div>
              <div className="mt-2 font-mono text-sm text-hush-text-primary">
                {formatArtifactValue(session.TargetTallyId)}
              </div>
            </div>
            <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                Share progress
              </div>
              <div className="mt-2 text-sm text-hush-text-primary">
                {acceptedShareCount} accepted / {eligibleTrusteeCount} eligible
              </div>
            </div>
            <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                Created
              </div>
              <div className="mt-2 text-sm text-hush-text-primary">
                {formatTimestamp(session.CreatedAt)}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
              <div className="text-sm font-semibold text-hush-text-primary">Binding summary</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Ceremony version
                  </div>
                  <div className="mt-1 text-sm text-hush-text-primary">
                    {session.CeremonySnapshot?.CeremonyVersionId || 'Not recorded'}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Profile
                  </div>
                  <div className="mt-1 text-sm text-hush-text-primary">
                    {session.CeremonySnapshot?.ProfileId || 'Not recorded'}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Threshold
                  </div>
                  <div className="mt-1 text-sm text-hush-text-primary">
                    {session.RequiredShareCount} of {session.EligibleTrustees.length}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Tally fingerprint
                  </div>
                  <div className="mt-1 text-sm text-hush-text-primary">
                    {session.CeremonySnapshot?.TallyPublicKeyFingerprint || 'Not recorded'}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
              <div className="flex items-center gap-2 font-medium">
                <ShieldAlert className="h-4 w-4" />
                <span>Aggregate-only boundary</span>
              </div>
              <p className="mt-2">
                This release path is bound to the closed election&apos;s final aggregate tally. It
                does not authorize arbitrary ballot inspection or single-ballot decryption.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-hush-bg-light bg-hush-bg-dark/80 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-hush-text-primary">Trustee progress</div>
              <div className="text-xs text-hush-text-accent">
                Threshold: {session.RequiredShareCount} shares
              </div>
            </div>

            {recoverableCloseCountingFailure ? (
              <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                Threshold is met, but none of the accepted {session.RequiredShareCount}-share subsets reconstruct the bound tally yet. Pending eligible trustees can still submit on this same session, and the executor will retry automatically after the next accepted share.
              </div>
            ) : null}

            <div className="mt-4 space-y-3">
              {trusteeProgress.map(({ trustee, latestShare }) => (
                <div
                  key={trustee.TrusteeUserAddress}
                  className="rounded-xl border border-hush-bg-light/70 bg-hush-bg-element/60 px-4 py-3"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-medium text-hush-text-primary">
                        {trustee.TrusteeDisplayName || trustee.TrusteeUserAddress}
                      </div>
                      <div className="mt-1 text-xs text-hush-text-accent">
                        {trustee.TrusteeUserAddress}
                      </div>
                    </div>
                    <div className="text-sm text-hush-text-primary">
                      {latestShare
                        ? getFinalizationShareStatusLabel(latestShare.Status)
                        : 'Pending'}
                    </div>
                  </div>

                  {latestShare ? (
                    <div className="mt-2 text-xs text-hush-text-accent">
                      Submitted {formatTimestamp(latestShare.SubmittedAt)}
                      {latestShare.Status ===
                      ElectionFinalizationShareStatusProto.FinalizationShareRejected
                        ? ` - ${latestShare.FailureCode || 'Rejected'}`
                        : ''}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {releaseEvidence ? (
            <div className="rounded-2xl border border-green-500/40 bg-green-500/10 p-4 text-sm text-green-100">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                <span>Release evidence recorded</span>
              </div>
              <div className="mt-2">
                {getFinalizationReleaseModeLabel(releaseEvidence.ReleaseMode)} completed with{' '}
                {releaseEvidence.AcceptedShareCount} accepted trustee shares at{' '}
                {formatTimestamp(releaseEvidence.CompletedAt)}.
              </div>
              <div className="mt-2">
                Release subset: {formatTrusteeReferenceList(releaseEvidence.AcceptedTrustees)}.
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
