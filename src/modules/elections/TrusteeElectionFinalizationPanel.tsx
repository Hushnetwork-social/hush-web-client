"use client";

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import {
  ElectionCloseCountingJobStatusProto,
  type ElectionFinalizationShare,
  ElectionFinalizationSessionPurposeProto,
  ElectionFinalizationSessionStatusProto,
  ElectionFinalizationShareStatusProto,
  ElectionFinalizationTargetTypeProto,
  ElectionGovernedActionTypeProto,
  ElectionGovernedProposalExecutionStatusProto,
} from '@/lib/grpc';
import { useBlockchainStore } from '@/modules/blockchain/useBlockchainStore';
import { useAppStore } from '@/stores/useAppStore';
import {
  formatArtifactValue,
  formatTimestamp,
  getAcceptedFinalizationShareCount,
  getActiveFinalizationSession,
  getBindingLabel,
  getCloseCountingJobStatusLabel,
  getFinalizationSessionPurposeLabel,
  getFinalizationSessionStatusLabel,
  getFinalizationShareStatusLabel,
  getGovernedActionViewStates,
  getLifecycleLabel,
  getLatestFinalizationReleaseEvidence,
  getLatestFinalizationSession,
  getLatestFinalizationShareForTrustee,
  getModeProfileFamilyLabel,
  getSelectedProfileFamilyLabel,
  shortenProtocolPackageHash,
} from './contracts';
import {
  decryptStoredTrusteeShareVaultEnvelope,
  extractTrusteeCloseCountingShare,
} from './trusteeShareVault';
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
const EMPTY_MNEMONIC: string[] = [];

type VaultShareState =
  | { status: 'pending'; detail: string }
  | { status: 'missing'; detail: string }
  | { status: 'unreadable'; detail: string }
  | {
      status: 'ready';
      detail: string;
      shareVersion: string;
      shareMaterial: string;
      shareMaterialHash: string;
    };

type CloseCountingJobState = {
  tone: 'info' | 'warning' | 'success' | 'error';
  title: string;
  description: string;
};

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

function hasAcceptedFinalizationShare(
  share: ElectionFinalizationShare | null
): boolean {
  return (
    share?.Status ===
    ElectionFinalizationShareStatusProto.FinalizationShareAccepted
  );
}

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
    ceremonyActionView,
    loadCeremonyActionView,
  } = useElectionsStore();
  const trusteeMnemonic = useAppStore((state) => state.credentials?.mnemonic ?? EMPTY_MNEMONIC);
  const [vaultShareState, setVaultShareState] = useState<VaultShareState>({
    status: 'pending',
    detail: 'Loading the trustee-owned close-counting share from your private vault.',
  });
  const blockHeight = useBlockchainStore((state) => state.blockHeight);
  const lastObservedBlockHeightRef = useRef(blockHeight);

  useEffect(() => {
    void loadElection(electionId);
    void loadCeremonyActionView(actorPublicAddress, electionId);
  }, [actorPublicAddress, electionId, loadCeremonyActionView, loadElection]);

  useEffect(() => () => reset(), [reset]);

  const election = selectedElection?.Election;
  const session = useMemo(
    () => getActiveFinalizationSession(selectedElection) ?? getLatestFinalizationSession(selectedElection),
    [selectedElection]
  );
  const latestVaultEnvelope = useMemo(
    () => (ceremonyActionView?.SelfVaultEnvelopes ?? [])[0] ?? null,
    [ceremonyActionView?.SelfVaultEnvelopes]
  );
  const releaseEvidence = useMemo(
    () => getLatestFinalizationReleaseEvidence(selectedElection, session?.Id),
    [selectedElection, session?.Id]
  );
  const protocolPackageBinding = selectedElection?.ProtocolPackageBinding ?? null;
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
  const closeActionState = useMemo(
    () =>
      getGovernedActionViewStates(selectedElection ?? null).find(
        (state) => state.actionType === ElectionGovernedActionTypeProto.Close
      ) ?? null,
    [selectedElection]
  );
  const sessionPurpose =
    session?.SessionPurpose ??
    ElectionFinalizationSessionPurposeProto.FinalizationSessionPurposeFinalize;
  const isCloseCountingSession =
    sessionPurpose ===
    ElectionFinalizationSessionPurposeProto.FinalizationSessionPurposeCloseCounting;
  const closeProposalId = closeActionState?.proposal?.Id ?? null;
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
  const eligibleTrusteeCount = session?.EligibleTrustees.length ?? 0;
  const pendingEligibleTrusteeCount = useMemo(() => {
    if (!session) {
      return 0;
    }

    return session.EligibleTrustees.filter(
      (trustee) =>
        !hasAcceptedFinalizationShare(
          getLatestFinalizationShareForTrustee(
            selectedElection,
            trustee.TrusteeUserAddress,
            session.Id
          )
      )
    ).length;
  }, [selectedElection, session]);
  const expectedTrusteeCount = session?.TrusteeCount ?? eligibleTrusteeCount;
  const requiredTrusteeThreshold = session?.TrusteeThreshold ?? session?.RequiredShareCount ?? 0;
  const acceptedReleaseArtifactCount =
    session?.AcceptedReleaseArtifactCount ?? acceptedShareCount;
  const missingReleaseArtifactCount =
    session?.MissingReleaseArtifactCount ?? pendingEligibleTrusteeCount;
  const rejectedReleaseArtifactCount =
    session?.RejectedReleaseArtifactCount ??
    (selectedElection?.FinalizationShares ?? []).filter(
      (share) =>
        share.FinalizationSessionId === session?.Id &&
        share.Status ===
          ElectionFinalizationShareStatusProto.FinalizationShareRejected
    ).length;
  const belowTrusteeThreshold =
    Boolean(session) &&
    requiredTrusteeThreshold > 0 &&
    acceptedReleaseArtifactCount < requiredTrusteeThreshold;
  const missingNonRequiredTrusteesVisible =
    Boolean(session) &&
    !belowTrusteeThreshold &&
    missingReleaseArtifactCount > 0;
  const protocolPackageRef = protocolPackageBinding
    ? `${protocolPackageBinding.PackageVersion} | ${shortenProtocolPackageHash(
        protocolPackageBinding.ReleaseManifestHash ||
          protocolPackageBinding.SpecPackageHash ||
          protocolPackageBinding.ProofPackageHash,
      )}`
    : 'Not recorded';
  const hasRecordedCloseApproval = useMemo(() => {
    if (!closeProposalId) {
      return false;
    }

    return (selectedElection?.GovernedProposalApprovals ?? []).some(
      (approval) =>
        approval.ProposalId === closeProposalId &&
        approval.TrusteeUserAddress === actorPublicAddress
    );
  }, [actorPublicAddress, closeProposalId, selectedElection?.GovernedProposalApprovals]);
  const waitingForCloseThreshold =
    !session &&
    closeActionState?.proposal?.ExecutionStatus ===
      ElectionGovernedProposalExecutionStatusProto.WaitingForApprovals;
  const waitingForCloseCountingSession =
    !session &&
    closeActionState?.proposal?.ExecutionStatus ===
      ElectionGovernedProposalExecutionStatusProto.ExecutionSucceeded;
  const waitingForShares =
    Boolean(session) &&
    session!.Status === ElectionFinalizationSessionStatusProto.FinalizationSessionAwaitingShares &&
    !releaseEvidence;
  const recoverableCloseCountingFailure =
    Boolean(session) &&
    isCloseCountingSession &&
    session!.CloseCountingJobStatus ===
      ElectionCloseCountingJobStatusProto.CloseCountingJobFailed &&
    !releaseEvidence &&
    pendingEligibleTrusteeCount > 0;
  const closeCountingJobState = useMemo<CloseCountingJobState | null>(() => {
    if (!session || !isCloseCountingSession) {
      return null;
    }

    switch (session.CloseCountingJobStatus) {
      case ElectionCloseCountingJobStatusProto.CloseCountingJobPending:
        return {
          tone: 'info',
          title: 'Executor pending',
          description:
            'The bound close-counting job exists, but the tally executor has not started the release pass yet.',
        };
      case ElectionCloseCountingJobStatusProto.CloseCountingJobAwaitingShares:
        return {
          tone: 'warning',
          title: 'Awaiting trustee shares',
          description:
            'The tally executor is armed for this session, but it cannot start until enough exact trustee submissions are accepted.',
        };
      case ElectionCloseCountingJobStatusProto.CloseCountingJobThresholdReached:
        return {
          tone: 'info',
          title: 'Threshold reached',
          description:
            'The required trustee shares are recorded. The tally executor will pick up the bound close-counting job on its next worker pass.',
        };
      case ElectionCloseCountingJobStatusProto.CloseCountingJobRunning:
        return {
          tone: 'info',
          title: 'Executor running',
          description:
            'The tally executor is decrypting the bound submissions, validating the exact target, and combining the aggregate tally now.',
        };
      case ElectionCloseCountingJobStatusProto.CloseCountingJobPublishing:
        return {
          tone: 'info',
          title: 'Publishing unofficial result',
          description:
            'Aggregate release succeeded. The tally executor is sealing tally-ready and unofficial-result artifacts now.',
        };
      case ElectionCloseCountingJobStatusProto.CloseCountingJobCompleted:
        return {
          tone: 'success',
          title: 'Close-counting completed',
          description:
            'Release evidence is recorded for this session. Trustee share submission no longer needs any follow-up.',
        };
      case ElectionCloseCountingJobStatusProto.CloseCountingJobFailed:
        return recoverableCloseCountingFailure
          ? {
              tone: 'warning',
              title: 'Executor stalled on the current share set',
              description:
                `Threshold is met, but none of the accepted ${session.RequiredShareCount}-share subsets reconstruct the bound tally yet. Pending eligible trustees can still submit on this same session, and the executor will retry automatically after the next accepted share.`,
            }
          : {
              tone: 'error',
              title: 'Executor failed',
              description:
                'The bound close-counting job failed. Review the latest failure evidence or retry path before expecting a result.',
            };
      case ElectionCloseCountingJobStatusProto.CloseCountingJobSuperseded:
        return {
          tone: 'warning',
          title: 'Executor superseded',
          description:
            'This close-counting job is no longer active. Follow the latest session and result artifacts for the current state.',
        };
      default:
        return null;
    }
  }, [isCloseCountingSession, recoverableCloseCountingFailure, session]);
  const vaultShareReady = vaultShareState.status === 'ready';
  const canSubmit =
    Boolean(session) &&
    isCloseCountingSession &&
    session!.Status === ElectionFinalizationSessionStatusProto.FinalizationSessionAwaitingShares &&
    Boolean(eligibleTrustee) &&
    actorShare?.Status !== ElectionFinalizationShareStatusProto.FinalizationShareAccepted &&
    !releaseEvidence &&
    vaultShareReady;
  const shouldRefreshOnBlockAdvance =
    waitingForCloseThreshold || waitingForCloseCountingSession || waitingForShares;

  useEffect(() => {
    let cancelled = false;

    if (!latestVaultEnvelope?.EncryptedPayload) {
      setVaultShareState({
        status: 'missing',
        detail: 'No trustee-owned vault package is available for this election on this account.',
      });
      return () => {
        cancelled = true;
      };
    }

    if (!actorEncryptionPrivateKey) {
      setVaultShareState({
        status: 'unreadable',
        detail: 'This device does not have the trustee decryption key required to open the private share package.',
      });
      return () => {
        cancelled = true;
      };
    }

    setVaultShareState({
      status: 'pending',
      detail: 'Opening the trustee-owned close-counting share from your private vault.',
    });

    void (async () => {
      try {
        const decryptedVault = await decryptStoredTrusteeShareVaultEnvelope(
          latestVaultEnvelope.EncryptedPayload,
          actorEncryptionPrivateKey,
          trusteeMnemonic
        );
        const resolvedShare = extractTrusteeCloseCountingShare(decryptedVault);

        if (!cancelled) {
          setVaultShareState({
            status: 'ready',
            detail: `Loaded share ${resolvedShare.shareVersion} from your private trustee package.`,
            shareVersion: resolvedShare.shareVersion,
            shareMaterial: resolvedShare.shareMaterial,
            shareMaterialHash: resolvedShare.shareMaterialHash,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setVaultShareState({
            status: 'unreadable',
            detail:
              error instanceof Error
                ? error.message
                : 'The trustee vault package could not be opened on this device.',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    actorEncryptionPrivateKey,
    latestVaultEnvelope?.EncryptedPayload,
    trusteeMnemonic,
  ]);

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

  const handleSubmit = async () => {
    if (!session || !shareIndex || vaultShareState.status !== 'ready') {
      return;
    }

    const didSubmit = await submitFinalizationShare(
      {
        ElectionId: electionId,
        FinalizationSessionId: session.Id,
        ActorPublicAddress: actorPublicAddress,
        ShareIndex: shareIndex,
        TargetType: ElectionFinalizationTargetTypeProto.FinalizationTargetAggregateTally,
        ClaimedCloseArtifactId: session.CloseArtifactId,
        ClaimedAcceptedBallotSetHash: session.AcceptedBallotSetHash,
        ClaimedFinalEncryptedTallyHash: session.FinalEncryptedTallyHash,
        ClaimedTargetTallyId: session.TargetTallyId,
        ClaimedCeremonyVersionId: session.CeremonySnapshot?.CeremonyVersionId || null,
        ClaimedTallyPublicKeyFingerprint: session.CeremonySnapshot?.TallyPublicKeyFingerprint || null,
        CloseCountingJobId: session.CloseCountingJobId || null,
        ExecutorSessionPublicKey: session.ExecutorSessionPublicKey || null,
        ExecutorKeyAlgorithm: session.ExecutorKeyAlgorithm || null,
        ShareVersion: vaultShareState.shareVersion,
        ShareMaterial: vaultShareState.shareMaterial,
      },
      actorEncryptionPublicKey,
      actorEncryptionPrivateKey,
      actorSigningPrivateKey,
    );

    if (!didSubmit) {
      return;
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
          <h1 className="text-2xl font-semibold">Trustee Tally Share Workspace</h1>
          <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
            {isCloseCountingSession
              ? 'Submit one trustee share for the exact aggregate-tally release target. This page does not provide arbitrary ballot-inspection or single-ballot decryption controls.'
              : 'This workspace unlocks only for the exact close-counting session after a governed close reaches trustee threshold. Finalize remains approval-only.'}
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
                    ? `${getFinalizationSessionPurposeLabel(session.SessionPurpose)} | ${
                        isCloseCountingSession
                          ? getCloseCountingJobStatusLabel(session.CloseCountingJobStatus)
                          : getFinalizationSessionStatusLabel(session.Status)
                      }`
                    : waitingForCloseThreshold
                      ? hasRecordedCloseApproval
                        ? 'Waiting for trustee threshold'
                        : 'Close approval still pending'
                      : waitingForCloseCountingSession
                        ? 'Indexing close-counting session'
                        : finalizeActionState?.proposal?.ExecutionStatus ===
                              ElectionGovernedProposalExecutionStatusProto.WaitingForApprovals
                          ? 'Finalize is approval-only'
                          : closeActionState?.reason || finalizeActionState?.reason || 'No active share session'}
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
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
                    {session
                      ? `${acceptedShareCount} accepted / ${eligibleTrusteeCount} eligible`
                      : 'Not available'}
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
                <div className={valueWellClass}>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Executor job
                  </div>
                  <div className="mt-2 text-sm text-hush-text-primary">
                    {session && isCloseCountingSession
                      ? getCloseCountingJobStatusLabel(session.CloseCountingJobStatus)
                      : 'Not available'}
                  </div>
                </div>
              </div>

              <div
                className={`mt-5 ${valueWellClass}`}
                data-testid="trustee-finalization-exact-target"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                      Exact target refs
                    </div>
                    <p className="mt-2 text-sm text-hush-text-accent">
                      These refs are the public context for the trustee release artifact. They bind
                      this device to one election, one session, one sealed ballot definition, and
                      one aggregate tally.
                    </p>
                  </div>
                  <div
                    className={`inline-flex items-center gap-2 self-start rounded-full px-3 py-1 text-xs font-semibold ${
                      belowTrusteeThreshold
                        ? 'bg-red-500/12 text-red-100'
                        : missingNonRequiredTrusteesVisible || rejectedReleaseArtifactCount > 0
                          ? 'bg-amber-500/12 text-amber-100'
                          : 'bg-green-500/12 text-green-100'
                    }`}
                  >
                    {belowTrusteeThreshold
                      ? 'Fail closed'
                      : missingNonRequiredTrusteesVisible
                        ? 'Threshold met with missing evidence visible'
                        : 'Threshold state ready'}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-hush-text-accent/80">
                      Election id
                    </div>
                    <div className="mt-1 break-all font-mono text-sm text-hush-text-primary">
                      {formatArtifactValue(election.ElectionId)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-hush-text-accent/80">
                      Session id
                    </div>
                    <div className="mt-1 break-all font-mono text-sm text-hush-text-primary">
                      {session ? formatArtifactValue(session.Id) : 'Not available'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-hush-text-accent/80">
                      Ballot definition hash
                    </div>
                    <div className="mt-1 break-all font-mono text-sm text-hush-text-primary">
                      {formatArtifactValue(election.BallotDefinitionHash)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-hush-text-accent/80">
                      Protocol package ref
                    </div>
                    <div className="mt-1 break-all font-mono text-sm text-hush-text-primary">
                      {protocolPackageRef}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-hush-text-accent/80">
                      Accepted ballot set
                    </div>
                    <div className="mt-1 break-all font-mono text-sm text-hush-text-primary">
                      {session ? formatArtifactValue(session.AcceptedBallotSetHash) : 'Not available'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-hush-text-accent/80">
                      Final encrypted tally
                    </div>
                    <div className="mt-1 break-all font-mono text-sm text-hush-text-primary">
                      {session ? formatArtifactValue(session.FinalEncryptedTallyHash) : 'Not available'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-hush-text-accent/80">
                      Control domain
                    </div>
                    <div className="mt-1 text-sm text-hush-text-primary">
                      {session?.ControlDomainProfileId
                        ? `${session.ControlDomainProfileId}${
                            session.ControlDomainProfileVersion
                              ? ` ${session.ControlDomainProfileVersion}`
                              : ''
                          }`
                        : 'Not recorded'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-hush-text-accent/80">
                      Artifact status
                    </div>
                    <div className="mt-1 text-sm text-hush-text-primary">
                      {actorShare
                        ? getFinalizationShareStatusLabel(actorShare.Status)
                        : eligibleTrustee
                          ? 'Missing'
                          : 'Not in trustee roster'}
                    </div>
                  </div>
                </div>

                {session ? (
                  <div className="mt-4 text-sm text-hush-text-accent">
                    SP-06 threshold: {acceptedReleaseArtifactCount} accepted,{' '}
                    {missingReleaseArtifactCount} missing, {rejectedReleaseArtifactCount} rejected;
                    requires {requiredTrusteeThreshold} of {expectedTrusteeCount}.
                  </div>
                ) : null}
              </div>

              <div
                className={`mt-5 ${valueWellClass}`}
                data-testid="trustee-finalization-boundary-context"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                  Mode and custody truth
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-hush-text-accent/80">
                      Election mode
                    </div>
                    <div className="mt-1 text-sm text-hush-text-primary">
                      {getBindingLabel(election.BindingStatus)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-hush-text-accent/80">
                      Allowed circuit families
                    </div>
                    <div className="mt-1 text-sm text-hush-text-primary">
                      {getModeProfileFamilyLabel(election.BindingStatus)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-hush-text-accent/80">
                      Selected circuit family
                    </div>
                    <div className="mt-1 text-sm text-hush-text-primary">
                      {getSelectedProfileFamilyLabel(election.SelectedProfileDevOnly)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-hush-text-accent/80">
                      Bound ceremony profile
                    </div>
                    <div className="mt-1 text-sm text-hush-text-primary">
                      {session?.CeremonySnapshot?.ProfileId || 'Pending bound close-counting session'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-hush-text-accent/80">
                      Tally key fingerprint
                    </div>
                    <div className="mt-1 break-all font-mono text-sm text-hush-text-primary">
                      {session?.CeremonySnapshot?.TallyPublicKeyFingerprint ||
                        'Pending bound close-counting session'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-hush-text-accent/80">
                      Executor custody
                    </div>
                    <div className="mt-1 text-sm text-hush-text-primary">
                      {session?.ExecutorSessionPublicKey
                        ? 'Bound session public key issued'
                        : 'Pending bound executor session'}
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-7 text-hush-text-accent">
                  This trustee surface only arms an exact aggregate-tally release for the bound
                  close-counting session. It does not expose single-ballot decryption authority or
                  reusable executor key material.
                </p>
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

              {closeCountingJobState && !releaseEvidence ? (
                <div
                  className={`mt-5 rounded-xl border p-4 text-sm ${
                    closeCountingJobState.tone === 'success'
                      ? 'border-green-500/40 bg-green-500/10 text-green-100'
                      : closeCountingJobState.tone === 'error'
                        ? 'border-red-500/40 bg-red-500/10 text-red-100'
                        : closeCountingJobState.tone === 'warning'
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
                          : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-100'
                  }`}
                  data-testid="trustee-finalization-executor-state"
                >
                  <div className="font-medium">{closeCountingJobState.title}</div>
                  <p className="mt-2">{closeCountingJobState.description}</p>
                </div>
              ) : null}

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
                  {actorShare.FailureCode ? ` - ${actorShare.FailureCode}` : ''}
                  {actorShare.FailureReason ? `: ${actorShare.FailureReason}` : ''}
                  {recoverableCloseCountingFailure &&
                  actorShare.Status ===
                    ElectionFinalizationShareStatusProto.FinalizationShareAccepted
                    ? ` Pending eligible trustees: ${pendingEligibleTrusteeCount}.`
                    : ''}
                  {actorShare.Status ===
                  ElectionFinalizationShareStatusProto.FinalizationShareRejected ? (
                    <div className="mt-2">
                      Recovery: reload the exact target refs, rebuild the release artifact from
                      the current trustee vault, and submit again only if the session id and tally
                      hashes match.
                    </div>
                  ) : null}
                </div>
              ) : null}

              {releaseEvidence ? (
                <div className="mt-5 rounded-xl border border-green-500/40 bg-green-500/10 p-4 text-sm text-green-100">
                  Aggregate release evidence was recorded at {formatTimestamp(releaseEvidence.CompletedAt)}.
                  <div className="mt-2">
                    Release subset: {formatTrusteeReferenceList(releaseEvidence.AcceptedTrustees)}.
                  </div>
                </div>
              ) : null}
            </section>

            <section className={sectionClass} data-testid="trustee-finalization-panel">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Close Counting Share Status</h2>
                <p className="mt-1 text-sm text-hush-text-accent">
                  {isCloseCountingSession
                    ? 'Submit one exact share for the bound close-counting session. The client fixes the target to the final aggregate tally and does not expose a single-ballot option.'
                    : 'This workspace reflects the second protocol step only after governed close threshold execution creates the bound close-counting session.'}
                </p>
              </div>

              {!session ? (
                <div
                  className="rounded-2xl bg-hush-bg-dark/75 px-4 py-3 text-sm text-hush-text-accent shadow-inner shadow-black/15"
                  data-testid="trustee-finalization-blocked"
                >
                  {waitingForCloseThreshold
                    ? hasRecordedCloseApproval
                      ? 'Your close approval is recorded. Share submission stays disabled until the proposal reaches threshold and the server creates the bound close-counting session.'
                      : 'Close approval is still pending. A close-counting share can be submitted only after the proposal reaches trustee threshold.'
                    : waitingForCloseCountingSession
                      ? 'Close reached trustee threshold. The server is indexing the bound close-counting session now, and this workspace refreshes automatically as new blocks arrive.'
                      : finalizeActionState?.proposal?.ExecutionStatus ===
                            ElectionGovernedProposalExecutionStatusProto.WaitingForApprovals
                        ? 'Finalize is approval-only in Protocol Omega. No trustee share is requested for that action.'
                        : closeActionState?.reason ||
                          finalizeActionState?.reason ||
                          'A close-counting share session is not available for this election yet.'}
                </div>
              ) : !isCloseCountingSession ? (
                <div
                  className="rounded-2xl bg-hush-bg-dark/75 px-4 py-3 text-sm text-hush-text-accent shadow-inner shadow-black/15"
                  data-testid="trustee-finalization-non-closecounting"
                >
                  Only close-counting sessions accept trustee shares in this rollout. Finalize is
                  approval-only and does not unlock a share submission path.
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

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <div
                      className={valueWellClass}
                      data-testid="trustee-finalization-vault-status"
                    >
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                        Trustee vault
                      </div>
                      <div className="mt-2 text-sm text-hush-text-primary">
                        {vaultShareState.status === 'ready'
                          ? 'Loaded'
                          : vaultShareState.status === 'pending'
                            ? 'Loading'
                            : vaultShareState.status === 'missing'
                              ? 'Missing'
                              : 'Unreadable'}
                      </div>
                      <div className="mt-2 text-xs text-hush-text-accent">
                        {vaultShareState.detail}
                      </div>
                    </div>
                    <div
                      className={valueWellClass}
                      data-testid="trustee-finalization-share-version"
                    >
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                        Share version
                      </div>
                      <div className="mt-2 text-sm text-hush-text-primary">
                        {vaultShareState.status === 'ready'
                          ? vaultShareState.shareVersion
                          : 'Not available'}
                      </div>
                    </div>
                    <div
                      className={valueWellClass}
                      data-testid="trustee-finalization-share-material-hash"
                    >
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                        Share material hash
                      </div>
                      <div className="mt-2 font-mono text-sm text-hush-text-primary">
                        {vaultShareState.status === 'ready'
                          ? formatArtifactValue(vaultShareState.shareMaterialHash)
                          : 'Not available'}
                      </div>
                    </div>
                  </div>

                  {vaultShareState.status !== 'ready' ? (
                    <div
                      className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
                        vaultShareState.status === 'pending'
                          ? 'border-white/10 bg-hush-bg-dark/75 text-hush-text-accent'
                          : 'border-red-500/40 bg-red-500/10 text-red-100'
                      }`}
                      data-testid="trustee-finalization-vault-blocked"
                    >
                      {vaultShareState.detail}
                    </div>
                  ) : (
                    <div className="mt-5 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-100">
                      The trustee close-counting share is loaded locally from your private vault. The
                      raw share is not displayed in this workspace.
                    </div>
                  )}

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
                      <span>Submit counting share</span>
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
