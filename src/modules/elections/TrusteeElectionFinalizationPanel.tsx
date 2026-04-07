"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import {
  ElectionFinalizationSessionPurposeProto,
  ElectionFinalizationSessionStatusProto,
  ElectionFinalizationShareStatusProto,
  ElectionFinalizationTargetTypeProto,
  ElectionGovernedActionTypeProto,
} from '@/lib/grpc';
import {
  formatArtifactValue,
  formatTimestamp,
  getAcceptedFinalizationShareCount,
  getActiveFinalizationSession,
  getFinalizationSessionPurposeLabel,
  getFinalizationSessionStatusLabel,
  getFinalizationShareStatusLabel,
  getGovernedActionViewStates,
  getLifecycleLabel,
  getLatestFinalizationReleaseEvidence,
  getLatestFinalizationSession,
  getLatestFinalizationShareForTrustee,
} from './contracts';
import { useElectionsStore } from './useElectionsStore';

type TrusteeElectionFinalizationPanelProps = {
  electionId: string;
  actorPublicAddress: string;
  actorEncryptionPublicKey: string;
  actorEncryptionPrivateKey: string;
  actorSigningPrivateKey: string;
};

const sectionClass =
  'rounded-3xl bg-hush-bg-element/95 p-5 shadow-lg shadow-black/10';
const valueWellClass =
  'rounded-2xl bg-[#151c33] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_12px_24px_rgba(0,0,0,0.14)]';
const fieldClass =
  'w-full rounded-xl bg-hush-bg-element/70 px-3 py-3 text-sm outline-none ring-1 ring-inset ring-white/10 transition focus:ring-2 focus:ring-hush-purple/60';

export function TrusteeElectionFinalizationPanel({
  electionId,
  actorPublicAddress,
  actorEncryptionPublicKey,
  actorEncryptionPrivateKey,
  actorSigningPrivateKey,
}: TrusteeElectionFinalizationPanelProps) {
  const {
    error,
    feedback,
    isLoadingDetail,
    isSubmitting,
    loadElection,
    reset,
    selectedElection,
    submitFinalizationShare,
  } = useElectionsStore();
  const [shareVersion, setShareVersion] = useState('share-v1');
  const [shareMaterial, setShareMaterial] = useState('aggregate-finalization-share');

  useEffect(() => {
    void loadElection(electionId);
  }, [electionId, loadElection]);

  useEffect(() => () => reset(), [reset]);

  const election = selectedElection?.Election;
  const session = useMemo(
    () => getActiveFinalizationSession(selectedElection) ?? getLatestFinalizationSession(selectedElection),
    [selectedElection]
  );
  const releaseEvidence = useMemo(
    () => getLatestFinalizationReleaseEvidence(selectedElection, session?.Id),
    [selectedElection, session?.Id]
  );
  const actorShare = useMemo(
    () => getLatestFinalizationShareForTrustee(selectedElection, actorPublicAddress, session?.Id),
    [actorPublicAddress, selectedElection, session?.Id]
  );
  const finalizeActionState = useMemo(
    () =>
      getGovernedActionViewStates(selectedElection ?? null).find(
        (state) => state.actionType === ElectionGovernedActionTypeProto.Finalize
      ) ?? null,
    [selectedElection]
  );
  const sessionPurpose =
    session?.SessionPurpose ??
    ElectionFinalizationSessionPurposeProto.FinalizationSessionPurposeFinalize;
  const isCloseCountingSession =
    sessionPurpose ===
    ElectionFinalizationSessionPurposeProto.FinalizationSessionPurposeCloseCounting;
  const eligibleTrustee = useMemo(
    () =>
      session?.EligibleTrustees.find(
        (trustee) => trustee.TrusteeUserAddress === actorPublicAddress
      ) ?? null,
    [actorPublicAddress, session?.EligibleTrustees]
  );
  const shareIndex = useMemo(() => {
    if (!session) {
      return 0;
    }

    const index = session.EligibleTrustees.findIndex(
      (trustee) => trustee.TrusteeUserAddress === actorPublicAddress
    );
    return index >= 0 ? index + 1 : 0;
  }, [actorPublicAddress, session]);
  const acceptedShareCount = useMemo(
    () => getAcceptedFinalizationShareCount(selectedElection, session?.Id),
    [selectedElection, session?.Id]
  );
  const canSubmit =
    Boolean(session) &&
    session!.Status === ElectionFinalizationSessionStatusProto.FinalizationSessionAwaitingShares &&
    Boolean(eligibleTrustee) &&
    actorShare?.Status !== ElectionFinalizationShareStatusProto.FinalizationShareAccepted &&
    !releaseEvidence;

  const handleSubmit = async () => {
    if (!session || !shareIndex) {
      return;
    }

    const didSubmit = await submitFinalizationShare(
      {
        ElectionId: electionId,
        FinalizationSessionId: session.Id,
        ActorPublicAddress: actorPublicAddress,
        ShareIndex: shareIndex,
        ShareVersion: shareVersion.trim(),
        TargetType: ElectionFinalizationTargetTypeProto.FinalizationTargetAggregateTally,
        ClaimedCloseArtifactId: session.CloseArtifactId,
        ClaimedAcceptedBallotSetHash: session.AcceptedBallotSetHash,
        ClaimedFinalEncryptedTallyHash: session.FinalEncryptedTallyHash,
        ClaimedTargetTallyId: session.TargetTallyId,
        ClaimedCeremonyVersionId: session.CeremonySnapshot?.CeremonyVersionId || null,
        ClaimedTallyPublicKeyFingerprint: session.CeremonySnapshot?.TallyPublicKeyFingerprint || null,
        ShareMaterial: shareMaterial.trim(),
      },
      actorEncryptionPublicKey,
      actorEncryptionPrivateKey,
      actorSigningPrivateKey,
    );

    if (didSubmit) {
      setShareMaterial('aggregate-finalization-share');
    }
  };

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
          <h1 className="text-2xl font-semibold">
            {isCloseCountingSession ? 'Trustee Close Counting Share' : 'Trustee Finalization Share'}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
            Submit one trustee share for the exact aggregate-tally release target. This page does
            not provide arbitrary ballot-inspection or single-ballot decryption controls.
          </p>
        </div>

        {feedback ? (
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
            {feedback.details.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {feedback.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        {isLoadingDetail && !selectedElection ? (
          <div className={`${sectionClass} flex items-center gap-3`}>
            <Loader2 className="h-5 w-5 animate-spin text-hush-purple" />
            <span className="text-sm text-hush-text-accent">Loading finalization context...</span>
          </div>
        ) : !election ? (
          <div className={sectionClass}>
            <div className="flex items-center gap-2 text-sm font-medium text-red-100">
              <AlertCircle className="h-4 w-4" />
              <span>Finalization context not found for this election.</span>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <section className={sectionClass} data-testid="trustee-finalization-summary">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Election
                  </div>
                  <h2 className="mt-2 text-xl font-semibold">{election.Title}</h2>
                  <div className="mt-2 text-sm text-hush-text-accent">
                    Lifecycle state: {getLifecycleLabel(election.LifecycleState)}
                  </div>
                </div>
                <div className="rounded-xl bg-[#151c33] px-3 py-2 text-xs text-hush-text-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_10px_20px_rgba(0,0,0,0.12)]">
                  {session
                    ? `${getFinalizationSessionPurposeLabel(session.SessionPurpose)} | ${getFinalizationSessionStatusLabel(session.Status)}`
                    : finalizeActionState?.reason || 'No active share session'}
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <div className={valueWellClass}>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Session purpose
                  </div>
                  <div className="mt-2 text-sm text-hush-text-primary">
                    {session ? getFinalizationSessionPurposeLabel(session.SessionPurpose) : 'Not available'}
                  </div>
                </div>
                <div className={valueWellClass}>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Session id
                  </div>
                  <div className="mt-2 font-mono text-sm text-hush-text-primary">
                    {session ? formatArtifactValue(session.Id) : 'Not available'}
                  </div>
                </div>
                <div className={valueWellClass}>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Close target
                  </div>
                  <div className="mt-2 font-mono text-sm text-hush-text-primary">
                    {session ? formatArtifactValue(session.CloseArtifactId) : 'Not available'}
                  </div>
                </div>
                <div className={valueWellClass}>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Aggregate progress
                  </div>
                  <div className="mt-2 text-sm text-hush-text-primary">
                    {session ? `${acceptedShareCount} of ${session.RequiredShareCount}` : 'Not available'}
                  </div>
                </div>
                <div className={valueWellClass}>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Ceremony version
                  </div>
                  <div className="mt-2 text-sm text-hush-text-primary">
                    {session?.CeremonySnapshot?.CeremonyVersionId || 'Not recorded'}
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
                <div className="flex items-center gap-2 font-medium">
                  <ShieldAlert className="h-4 w-4" />
                  <span>Authority boundary</span>
                </div>
                <p className="mt-2">
                  Your share is bound to the election&apos;s exact aggregate tally target. It is not
                  reusable as general decryption authority.
                </p>
              </div>

              {actorShare ? (
                <div
                  className={`mt-5 rounded-xl border p-4 text-sm ${
                    actorShare.Status === ElectionFinalizationShareStatusProto.FinalizationShareAccepted
                      ? 'border-green-500/40 bg-green-500/10 text-green-100'
                      : 'border-red-500/40 bg-red-500/10 text-red-100'
                  }`}
                >
                  Latest share status: {getFinalizationShareStatusLabel(actorShare.Status)} at{' '}
                  {formatTimestamp(actorShare.SubmittedAt)}
                  {actorShare.FailureReason ? ` - ${actorShare.FailureReason}` : ''}
                </div>
              ) : null}

              {releaseEvidence ? (
                <div className="mt-5 rounded-xl border border-green-500/40 bg-green-500/10 p-4 text-sm text-green-100">
                  Aggregate release evidence was recorded at {formatTimestamp(releaseEvidence.CompletedAt)}.
                </div>
              ) : null}
            </section>

            <section className={sectionClass} data-testid="trustee-finalization-panel">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">
                  {isCloseCountingSession ? 'Close Counting Share Submission' : 'Aggregate Share Submission'}
                </h2>
                <p className="mt-1 text-sm text-hush-text-accent">
                  Submit one exact share for the bound session. The client fixes the
                  target to the final aggregate tally and does not expose a single-ballot option.
                </p>
              </div>

              {!session ? (
                <div
                  className="rounded-2xl bg-hush-bg-dark/75 px-4 py-3 text-sm text-hush-text-accent shadow-inner shadow-black/15"
                  data-testid="trustee-finalization-blocked"
                >
                  {finalizeActionState?.reason ||
                    'A close-counting or finalization share session is not available for this election yet.'}
                </div>
              ) : !eligibleTrustee ? (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  Your trustee address is not part of this bound finalization roster.
                </div>
              ) : releaseEvidence || session.Status === ElectionFinalizationSessionStatusProto.FinalizationSessionCompleted ? (
                <div className="rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-100">
                  Aggregate release is already complete for this session.
                </div>
              ) : actorShare?.Status === ElectionFinalizationShareStatusProto.FinalizationShareAccepted ? (
                <div className="rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-100">
                  Your accepted share is already recorded for this session.
                </div>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2" data-testid="trustee-finalization-target-grid">
                    <div className={valueWellClass}>
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                        Target tally id
                      </div>
                      <div className="mt-2 font-mono text-sm text-hush-text-primary">
                        {formatArtifactValue(session.TargetTallyId)}
                      </div>
                    </div>
                    <div className={valueWellClass}>
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                        Trustee slot
                      </div>
                      <div className="mt-2 text-sm text-hush-text-primary">
                        Share index {shareIndex}
                      </div>
                    </div>
                  </div>

                  <label className="mt-5 block text-sm" htmlFor="trustee-finalization-share-version">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                      Share version
                    </span>
                    <input
                      id="trustee-finalization-share-version"
                      value={shareVersion}
                      onChange={(event) => setShareVersion(event.target.value)}
                      className={fieldClass}
                      data-testid="trustee-finalization-share-version"
                    />
                  </label>

                  <label className="mt-5 block text-sm" htmlFor="trustee-finalization-share-material">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                      Share material
                    </span>
                    <textarea
                      id="trustee-finalization-share-material"
                      value={shareMaterial}
                      onChange={(event) => setShareMaterial(event.target.value)}
                      className={`min-h-28 ${fieldClass}`}
                      data-testid="trustee-finalization-share-material"
                    />
                  </label>

                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => void handleSubmit()}
                      disabled={isSubmitting || !canSubmit}
                      className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent"
                      data-testid="trustee-finalization-submit-button"
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      <span>{isCloseCountingSession ? 'Submit counting share' : 'Submit aggregate share'}</span>
                    </button>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
