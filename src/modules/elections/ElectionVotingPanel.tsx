"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  Loader2,
  Lock,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { generateGuid } from '@/lib/crypto';
import {
  ElectionLifecycleStateProto,
  ElectionParticipationStatusProto,
  ElectionVotingRightStatusProto,
  ElectionVotingSubmissionStatusProto,
  TransactionStatus,
  type GetElectionResponse,
  type GetElectionVotingViewResponse,
} from '@/lib/grpc';
import { electionsService } from '@/lib/grpc/services/elections';
import { submitTransaction } from '@/modules/blockchain/BlockchainService';
import {
  createAcceptElectionBallotCastTransaction,
  createRegisterElectionVotingCommitmentTransaction,
} from './transactionService';

type ElectionVotingPanelProps = {
  electionId: string;
  actorPublicAddress: string;
  actorEncryptionPublicKey: string;
  actorEncryptionPrivateKey: string;
  actorSigningPrivateKey: string;
};

type VotingFeedback = {
  tone: 'success' | 'error';
  message: string;
};

type PendingSubmissionState = {
  idempotencyKey: string;
  ballotPackageCommitment: string;
  submittedAt: string;
};

type LocalReceipt = {
  electionId: string;
  receiptId: string;
  acceptanceId: string;
  acceptedAt: string;
  ballotPackageCommitment: string;
  serverProof: string;
};

type CastDraft = {
  encryptedBallotPackage: string;
  proofBundle: string;
  ballotNullifier: string;
};

const pendingStorageKey = (electionId: string) => `feat099:pending:${electionId}`;
const receiptStorageKey = (electionId: string) => `feat099:receipt:${electionId}`;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForVotingViewMatch(
  electionId: string,
  actorPublicAddress: string,
  submissionIdempotencyKey: string,
  isMatch: (response: GetElectionVotingViewResponse) => boolean,
  maxAttempts: number = 12,
  delayMs: number = 500,
): Promise<GetElectionVotingViewResponse | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await electionsService.getElectionVotingView({
        ElectionId: electionId,
        ActorPublicAddress: actorPublicAddress,
        SubmissionIdempotencyKey: submissionIdempotencyKey,
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

function formatTimestamp(timestamp?: { seconds?: number; nanos?: number }): string {
  if (!timestamp?.seconds) {
    return 'Not yet available';
  }

  return new Date(timestamp.seconds * 1000).toLocaleString();
}

function truncateMiddle(value: string, keep: number = 8): string {
  if (!value || value.length <= keep * 2 + 3) {
    return value || 'Not available';
  }

  return `${value.slice(0, keep)}...${value.slice(-keep)}`;
}

function getParticipationLabel(
  participationStatus: ElectionParticipationStatusProto,
  hasOpenElection: boolean,
  inCurrentDenominator: boolean,
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

async function hashText(value: string): Promise<string> {
  const normalized = value.trim();
  if (!normalized) {
    return '';
  }

  if (globalThis.crypto?.subtle) {
    const data = new TextEncoder().encode(normalized);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  return Array.from(new TextEncoder().encode(normalized))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 64);
}

function loadPendingSubmission(electionId: string): PendingSubmissionState | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(pendingStorageKey(electionId));
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as PendingSubmissionState;
  } catch {
    window.sessionStorage.removeItem(pendingStorageKey(electionId));
    return null;
  }
}

function savePendingSubmission(electionId: string, pendingSubmission: PendingSubmissionState): void {
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(pendingStorageKey(electionId), JSON.stringify(pendingSubmission));
  }
}

function clearPendingSubmission(electionId: string): void {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(pendingStorageKey(electionId));
  }
}

function loadLocalReceipt(electionId: string): LocalReceipt | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(receiptStorageKey(electionId));
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as LocalReceipt;
  } catch {
    window.sessionStorage.removeItem(receiptStorageKey(electionId));
    return null;
  }
}

function saveLocalReceipt(electionId: string, receipt: LocalReceipt): void {
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(receiptStorageKey(electionId), JSON.stringify(receipt));
  }
}

function buildReceiptText(receipt: LocalReceipt): string {
  return [
    'FEAT-099 Accepted Ballot Receipt',
    `Election ID: ${receipt.electionId}`,
    `Receipt ID: ${receipt.receiptId}`,
    `Acceptance ID: ${receipt.acceptanceId}`,
    `Accepted At: ${receipt.acceptedAt}`,
    `Ballot Package Commitment: ${receipt.ballotPackageCommitment}`,
    `Server Proof: ${receipt.serverProof}`,
  ].join('\n');
}

function createReceiptFromVotingView(
  electionId: string,
  votingView: GetElectionVotingViewResponse,
  pendingSubmission: PendingSubmissionState | null,
): LocalReceipt | null {
  if (
    !votingView.HasAcceptedAt ||
    !votingView.AcceptanceId ||
    !votingView.ReceiptId ||
    !votingView.ServerProof ||
    !pendingSubmission?.ballotPackageCommitment
  ) {
    return null;
  }

  return {
    electionId,
    receiptId: votingView.ReceiptId,
    acceptanceId: votingView.AcceptanceId,
    acceptedAt: formatTimestamp(votingView.AcceptedAt),
    ballotPackageCommitment: pendingSubmission.ballotPackageCommitment,
    serverProof: votingView.ServerProof,
  };
}

function getCastFailureCopy(code: string, fallbackMessage: string): string {
  switch (code) {
    case 'election_cast_still_processing':
      return 'This submission identity is already pending. Keep checking the same submission instead of creating a new cast.';
    case 'election_cast_already_used':
      return 'This submission identity was already used for this election. The server will not replay the receipt.';
    case 'election_cast_duplicate_nullifier':
      return 'This ballot nullifier already exists for the election.';
    case 'election_cast_wrong_election_context':
      return 'The prepared ballot package is bound to a different election boundary. Refresh the view and rebuild it.';
    case 'election_cast_close_persisted':
      return 'The election is already closed. No vote can be accepted after that block.';
    case 'election_cast_commitment_missing':
      return 'Register your voting commitment before the final cast.';
    case 'election_cast_not_linked':
      return 'The authenticated Hush account is not linked to this election roster.';
    case 'election_cast_not_active':
      return 'This voter does not currently hold an active voting right.';
    case 'election_cast_already_voted':
      return 'This voter is already counted as voted for this election.';
    default:
      return fallbackMessage || 'The final cast was rejected before it entered processing.';
  }
}

export function ElectionVotingPanel({
  electionId,
  actorPublicAddress,
  actorEncryptionPublicKey,
  actorEncryptionPrivateKey,
  actorSigningPrivateKey,
}: ElectionVotingPanelProps) {
  const [detail, setDetail] = useState<GetElectionResponse | null>(null);
  const [votingView, setVotingView] = useState<GetElectionVotingViewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingCommitment, setIsSubmittingCommitment] = useState(false);
  const [isSubmittingCast, setIsSubmittingCast] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [feedback, setFeedback] = useState<VotingFeedback | null>(null);
  const [commitmentHash, setCommitmentHash] = useState('');
  const [castDraft, setCastDraft] = useState<CastDraft>({
    encryptedBallotPackage: '',
    proofBundle: '',
    ballotNullifier: '',
  });
  const [isReviewingCast, setIsReviewingCast] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState<PendingSubmissionState | null>(null);
  const [localReceipt, setLocalReceipt] = useState<LocalReceipt | null>(null);
  const [castFailure, setCastFailure] = useState<string | null>(null);

  useEffect(() => {
    setPendingSubmission(loadPendingSubmission(electionId));
    setLocalReceipt(loadLocalReceipt(electionId));
  }, [electionId]);

  async function refreshContext(submissionIdempotencyKey?: string): Promise<GetElectionVotingViewResponse> {
    const storedPending = loadPendingSubmission(electionId);
    const resolvedKey =
      submissionIdempotencyKey ?? storedPending?.idempotencyKey ?? pendingSubmission?.idempotencyKey ?? '';
    const [detailResponse, votingResponse] = await Promise.all([
      electionsService.getElection({ ElectionId: electionId }),
      electionsService.getElectionVotingView({
        ElectionId: electionId,
        ActorPublicAddress: actorPublicAddress,
        SubmissionIdempotencyKey: resolvedKey,
      }),
    ]);

    setDetail(detailResponse);
    setVotingView(votingResponse);

    if (votingResponse.Success && votingResponse.HasAcceptedAt) {
      const createdReceipt = createReceiptFromVotingView(
        electionId,
        votingResponse,
        storedPending ?? pendingSubmission,
      );
      if (createdReceipt) {
        saveLocalReceipt(electionId, createdReceipt);
        setLocalReceipt(createdReceipt);
      } else {
        setLocalReceipt(loadLocalReceipt(electionId));
      }
      clearPendingSubmission(electionId);
      setPendingSubmission(null);
    }

    return votingResponse;
  }

  useEffect(() => {
    let isActive = true;

    async function load(): Promise<void> {
      setIsLoading(true);
      try {
        const storedPending = loadPendingSubmission(electionId);
        const resolvedKey = storedPending?.idempotencyKey ?? '';
        const [detailResponse, votingResponse] = await Promise.all([
          electionsService.getElection({ ElectionId: electionId }),
          electionsService.getElectionVotingView({
            ElectionId: electionId,
            ActorPublicAddress: actorPublicAddress,
            SubmissionIdempotencyKey: resolvedKey,
          }),
        ]);

        if (!isActive) {
          return;
        }

        setDetail(detailResponse);
        setVotingView(votingResponse);

        if (votingResponse.Success && votingResponse.HasAcceptedAt) {
          const createdReceipt = createReceiptFromVotingView(
            electionId,
            votingResponse,
            storedPending,
          );
          if (createdReceipt) {
            saveLocalReceipt(electionId, createdReceipt);
            setLocalReceipt(createdReceipt);
          } else {
            setLocalReceipt(loadLocalReceipt(electionId));
          }
          clearPendingSubmission(electionId);
          setPendingSubmission(null);
        }
      } catch (error) {
        if (isActive) {
          setFeedback({
            tone: 'error',
            message:
              error instanceof Error ? error.message : 'Failed to load election voting view.',
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

  const election = detail?.Election;
  const selfRosterEntry = votingView?.SelfRosterEntry;
  const isOpenElection = election?.LifecycleState === ElectionLifecycleStateProto.Open;
  const isLinked = !!selfRosterEntry;
  const isActiveVoter =
    selfRosterEntry?.VotingRightStatus === ElectionVotingRightStatusProto.VotingRightActive;
  const isCommitmentRegistered = votingView?.CommitmentRegistered ?? false;
  const isAccepted =
    votingView?.HasAcceptedAt === true &&
    votingView.PersonalParticipationStatus ===
      ElectionParticipationStatusProto.ParticipationCountedAsVoted;
  const canRegisterCommitment = isOpenElection && isLinked && isActiveVoter && !isCommitmentRegistered;
  const canPrepareCast = isOpenElection && isLinked && isActiveVoter && isCommitmentRegistered && !isAccepted;
  const hasBoundaryContext = !!(
    votingView?.OpenArtifactId &&
    votingView?.EligibleSetHash &&
    votingView?.CeremonyVersionId &&
    votingView?.DkgProfileId &&
    votingView?.TallyPublicKeyFingerprint
  );
  const participationLabel = getParticipationLabel(
    votingView?.PersonalParticipationStatus ?? ElectionParticipationStatusProto.ParticipationDidNotVote,
    isOpenElection,
    selfRosterEntry?.InCurrentDenominator ?? false,
  );
  const submissionStatusLabel = useMemo(() => {
    if (isCheckingStatus) {
      return 'Checking chain state';
    }

    if (votingView?.SubmissionStatus === ElectionVotingSubmissionStatusProto.VotingSubmissionStatusStillProcessing) {
      return 'Pending in mempool';
    }

    if (votingView?.SubmissionStatus === ElectionVotingSubmissionStatusProto.VotingSubmissionStatusAlreadyUsed) {
      return 'Committed key already used';
    }

    return pendingSubmission ? 'Pending local recovery' : 'No pending submission';
  }, [isCheckingStatus, pendingSubmission, votingView?.SubmissionStatus]);
  const fieldValidationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!castDraft.encryptedBallotPackage.trim()) {
      errors.push('Encrypted ballot package is required.');
    }
    if (!castDraft.proofBundle.trim()) {
      errors.push('Proof bundle is required.');
    }
    if (!castDraft.ballotNullifier.trim()) {
      errors.push('Ballot nullifier is required.');
    }
    if (!hasBoundaryContext) {
      errors.push('The election boundary context is incomplete.');
    }
    return errors;
  }, [castDraft, hasBoundaryContext]);

  async function handleRegisterCommitment(): Promise<void> {
    if (!commitmentHash.trim()) {
      setFeedback({ tone: 'error', message: 'Enter a commitment hash before registering.' });
      return;
    }

    setIsSubmittingCommitment(true);
    setFeedback(null);
    setCastFailure(null);
    try {
      const { signedTransaction } = await createRegisterElectionVotingCommitmentTransaction(
        electionId,
        actorPublicAddress,
        actorEncryptionPublicKey,
        actorEncryptionPrivateKey,
        commitmentHash.trim(),
        actorSigningPrivateKey,
      );
      const submitResult = await submitTransaction(signedTransaction);
      if (
        !submitResult.successful &&
        submitResult.status !== TransactionStatus.ACCEPTED &&
        submitResult.status !== TransactionStatus.PENDING
      ) {
        throw new Error(submitResult.message || 'Commitment registration was rejected.');
      }

      const awaitedView = await waitForVotingViewMatch(
        electionId,
        actorPublicAddress,
        '',
        (response) => response.CommitmentRegistered,
      );
      if (awaitedView) {
        setVotingView(awaitedView);
      } else {
        await refreshContext();
      }

      setCommitmentHash('');
      setFeedback({
        tone: 'success',
        message: 'Voting commitment registered. This step does not mean you have already voted.',
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error ? error.message : 'Voting commitment registration failed.',
      });
    } finally {
      setIsSubmittingCommitment(false);
    }
  }

  async function handleCastSubmit(): Promise<void> {
    if (!votingView || fieldValidationErrors.length > 0) {
      setFeedback({
        tone: 'error',
        message: fieldValidationErrors[0] || 'The election cast is not ready to submit.',
      });
      return;
    }

    const submissionIdempotencyKey = generateGuid();
    const nextPendingSubmission: PendingSubmissionState = {
      idempotencyKey: submissionIdempotencyKey,
      ballotPackageCommitment: await hashText(castDraft.encryptedBallotPackage),
      submittedAt: new Date().toISOString(),
    };

    setIsSubmittingCast(true);
    setIsCheckingStatus(true);
    setFeedback(null);
    setCastFailure(null);

    try {
      const { signedTransaction } = await createAcceptElectionBallotCastTransaction(
        electionId,
        actorPublicAddress,
        actorEncryptionPublicKey,
        actorEncryptionPrivateKey,
        submissionIdempotencyKey,
        castDraft.encryptedBallotPackage.trim(),
        castDraft.proofBundle.trim(),
        castDraft.ballotNullifier.trim(),
        votingView.OpenArtifactId,
        votingView.EligibleSetHash,
        votingView.CeremonyVersionId,
        votingView.DkgProfileId,
        votingView.TallyPublicKeyFingerprint,
        actorSigningPrivateKey,
      );
      savePendingSubmission(electionId, nextPendingSubmission);
      setPendingSubmission(nextPendingSubmission);
      const submitResult = await submitTransaction(signedTransaction);
      if (
        !submitResult.successful &&
        submitResult.status !== TransactionStatus.ACCEPTED &&
        submitResult.status !== TransactionStatus.PENDING
      ) {
        const failureMessage = getCastFailureCopy(submitResult.validationCode, submitResult.message);
        setCastFailure(failureMessage);
        setFeedback({ tone: 'error', message: failureMessage });
        if (
          submitResult.validationCode !== 'election_cast_still_processing' &&
          submitResult.validationCode !== 'election_cast_already_used'
        ) {
          clearPendingSubmission(electionId);
          setPendingSubmission(null);
        }
        return;
      }

      const awaitedView = await waitForVotingViewMatch(
        electionId,
        actorPublicAddress,
        submissionIdempotencyKey,
        (response) =>
          response.HasAcceptedAt ||
          response.SubmissionStatus !== ElectionVotingSubmissionStatusProto.VotingSubmissionStatusNone,
        14,
        600,
      );

      if (awaitedView?.HasAcceptedAt) {
        const createdReceipt = createReceiptFromVotingView(
          electionId,
          awaitedView,
          nextPendingSubmission,
        );
        if (createdReceipt) {
          saveLocalReceipt(electionId, createdReceipt);
          setLocalReceipt(createdReceipt);
        }
        clearPendingSubmission(electionId);
        setPendingSubmission(null);
        setVotingView(awaitedView);
        setCastDraft({ encryptedBallotPackage: '', proofBundle: '', ballotNullifier: '' });
        setIsReviewingCast(false);
        setFeedback({
          tone: 'success',
          message: 'Ballot accepted. Keep the local receipt from this device.',
        });
        return;
      }

      await refreshContext(submissionIdempotencyKey);
      setFeedback({
        tone: 'success',
        message: 'Submission sent. Keep checking the same submission identity.',
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? `${error.message} Keep checking the same submission identity.`
            : 'The submission outcome is uncertain. Keep checking the same submission identity.',
      });
    } finally {
      setIsSubmittingCast(false);
      setIsCheckingStatus(false);
    }
  }

  async function handleCheckStatusAgain(): Promise<void> {
    if (!pendingSubmission?.idempotencyKey) {
      return;
    }

    setIsCheckingStatus(true);
    setFeedback(null);
    try {
      const refreshedView = await refreshContext(pendingSubmission.idempotencyKey);
      if (refreshedView.HasAcceptedAt) {
        setFeedback({ tone: 'success', message: 'Accepted ballot is now indexed.' });
      } else {
        setFeedback({ tone: 'success', message: 'Submission is still pending.' });
      }
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to refresh the current submission.',
      });
    } finally {
      setIsCheckingStatus(false);
    }
  }

  async function handleCopyReceipt(): Promise<void> {
    if (!localReceipt) {
      return;
    }

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard access is unavailable on this device.');
      }
      await navigator.clipboard.writeText(buildReceiptText(localReceipt));
      setFeedback({ tone: 'success', message: 'Receipt copied locally.' });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to copy the local receipt.',
      });
    }
  }

  function handleDownloadReceipt(): void {
    if (!localReceipt || typeof window === 'undefined') {
      return;
    }

    const blob = new Blob([buildReceiptText(localReceipt)], { type: 'text/plain;charset=utf-8' });
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `feat099-receipt-${localReceipt.receiptId}.txt`;
    link.click();
    window.URL.revokeObjectURL(objectUrl);
    setFeedback({ tone: 'success', message: 'Receipt downloaded locally.' });
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-hush-bg-dark">
        <div className="flex items-center gap-3 text-sm text-hush-text-accent">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading election voting view...</span>
        </div>
      </div>
    );
  }

  if (!votingView?.Success) {
    return (
      <div className="min-h-screen bg-hush-bg-dark px-4 py-8 text-hush-text-primary">
        <div className="mx-auto max-w-5xl rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-5 text-sm text-red-100">
          {votingView?.ErrorMessage || 'Voting data is unavailable.'}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hush-bg-dark px-4 py-8 text-hush-text-primary">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <Link
              href="/account/elections"
              className="inline-flex items-center gap-2 text-sm text-hush-text-accent transition-colors hover:text-hush-text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to elections</span>
            </Link>
            <h1 className="mt-2 text-3xl font-semibold">
              {election?.Title || 'Election cast acceptance'}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
              FEAT-099 keeps commitment registration, cast acceptance, pending recovery, and local receipt retention explicit.
            </p>
          </div>
          <Link
            href={`/account/elections/${electionId}/eligibility`}
            className="inline-flex items-center gap-2 rounded-xl border border-hush-bg-light px-4 py-2 text-sm transition-colors hover:border-hush-purple"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Open eligibility view</span>
          </Link>
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

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-hush-bg-light bg-hush-bg-element/95 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-hush-text-accent">Lifecycle</div>
            <div className="mt-2 text-xl font-semibold">{isOpenElection ? 'Open' : 'Not open'}</div>
          </div>
          <div className="rounded-2xl border border-hush-bg-light bg-hush-bg-element/95 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-hush-text-accent">Identity</div>
            <div className="mt-2 text-xl font-semibold">{isLinked ? 'Linked' : 'Unlinked'}</div>
          </div>
          <div className="rounded-2xl border border-hush-bg-light bg-hush-bg-element/95 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-hush-text-accent">Commitment</div>
            <div className="mt-2 text-xl font-semibold">{isCommitmentRegistered ? 'Registered' : 'Missing'}</div>
          </div>
          <div className="rounded-2xl border border-hush-bg-light bg-hush-bg-element/95 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-hush-text-accent">Participation</div>
            <div className="mt-2 text-xl font-semibold">{participationLabel}</div>
          </div>
        </div>

        <section className="rounded-2xl border border-hush-bg-light bg-hush-bg-element/95 p-5">
          <div className="text-sm font-semibold">Current election boundary</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 px-4 py-3 text-sm text-hush-text-accent">
              Open artifact: <span className="font-mono text-hush-text-primary">{truncateMiddle(votingView.OpenArtifactId)}</span>
            </div>
            <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 px-4 py-3 text-sm text-hush-text-accent">
              Eligible set hash: <span className="font-mono text-hush-text-primary">{truncateMiddle(votingView.EligibleSetHash)}</span>
            </div>
            <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 px-4 py-3 text-sm text-hush-text-accent">
              Ceremony: <span className="font-mono text-hush-text-primary">{truncateMiddle(votingView.CeremonyVersionId)}</span>
            </div>
            <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 px-4 py-3 text-sm text-hush-text-accent">
              Tally key: <span className="font-mono text-hush-text-primary">{truncateMiddle(votingView.TallyPublicKeyFingerprint)}</span>
            </div>
          </div>
        </section>

        {!isLinked ? (
          <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-100">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5" />
              <div>Link your roster identity before FEAT-099 cast acceptance.</div>
            </div>
          </section>
        ) : null}

        {isLinked && !isActiveVoter ? (
          <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-100">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5" />
              <div>This linked identity does not currently hold an active voting right.</div>
            </div>
          </section>
        ) : null}

        {canRegisterCommitment ? (
          <section className="rounded-2xl border border-hush-bg-light bg-hush-bg-element/95 p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Step 1: Register commitment</div>
                <div className="mt-1 text-sm text-hush-text-accent">Commitment registration does not mean you already voted.</div>
              </div>
              <Lock className="h-5 w-5 text-hush-purple" />
            </div>
            <textarea
              value={commitmentHash}
              onChange={(event) => setCommitmentHash(event.target.value)}
              rows={3}
              className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-4 py-3 font-mono text-sm text-hush-text-primary outline-none transition-colors focus:border-hush-purple"
              placeholder="Paste the opaque election commitment hash"
              data-testid="voting-commitment-input"
            />
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => void handleRegisterCommitment()}
                disabled={isSubmittingCommitment}
                className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent"
                data-testid="voting-commitment-submit"
              >
                {isSubmittingCommitment ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                <span>Register commitment</span>
              </button>
            </div>
          </section>
        ) : null}

        {pendingSubmission ? (
          <section className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5 text-blue-100" data-testid="voting-pending-panel">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2 text-sm">
                <div className="font-semibold">Pending or uncertain submission</div>
                <div>Status: {submissionStatusLabel}</div>
                <div>Submitted at: {new Date(pendingSubmission.submittedAt).toLocaleString()}</div>
                <div>Ballot commitment: <span className="font-mono">{truncateMiddle(pendingSubmission.ballotPackageCommitment)}</span></div>
              </div>
              <button
                type="button"
                onClick={() => void handleCheckStatusAgain()}
                disabled={isCheckingStatus}
                className="inline-flex items-center gap-2 rounded-xl border border-blue-200/30 px-4 py-2 text-sm font-medium text-blue-50 transition-colors hover:border-blue-200/60 disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="voting-check-status"
              >
                {isCheckingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                <span>Check status again</span>
              </button>
            </div>
          </section>
        ) : null}

        {castFailure ? (
          <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-100">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5" />
              <div>{castFailure}</div>
            </div>
          </section>
        ) : null}

        {canPrepareCast ? (
          <section className="rounded-2xl border border-hush-bg-light bg-hush-bg-element/95 p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Step 2: Final ballot cast</div>
                <div className="mt-1 text-sm text-hush-text-accent">The server accepts one election-scoped submission identity and does not replay the receipt later.</div>
              </div>
              <div className="rounded-xl border border-hush-purple/30 bg-hush-purple/10 px-3 py-2 text-xs text-hush-text-primary">Hush-authenticated request</div>
            </div>

            {!isReviewingCast ? (
              <div className="grid gap-4">
                <textarea
                  value={castDraft.encryptedBallotPackage}
                  onChange={(event) => setCastDraft((current) => ({ ...current, encryptedBallotPackage: event.target.value }))}
                  rows={4}
                  className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-4 py-3 font-mono text-sm text-hush-text-primary outline-none transition-colors focus:border-hush-purple"
                  placeholder="Encrypted ballot package"
                  data-testid="voting-cast-package"
                />
                <textarea
                  value={castDraft.proofBundle}
                  onChange={(event) => setCastDraft((current) => ({ ...current, proofBundle: event.target.value }))}
                  rows={3}
                  className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-4 py-3 font-mono text-sm text-hush-text-primary outline-none transition-colors focus:border-hush-purple"
                  placeholder="Proof bundle"
                  data-testid="voting-cast-proof"
                />
                <input
                  value={castDraft.ballotNullifier}
                  onChange={(event) => setCastDraft((current) => ({ ...current, ballotNullifier: event.target.value }))}
                  className="w-full rounded-xl border border-hush-bg-light bg-hush-bg-dark px-4 py-3 font-mono text-sm text-hush-text-primary outline-none transition-colors focus:border-hush-purple"
                  placeholder="Ballot nullifier"
                  data-testid="voting-cast-nullifier"
                />
                {fieldValidationErrors.length > 0 ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
                    {fieldValidationErrors[0]}
                  </div>
                ) : null}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsReviewingCast(true)}
                    disabled={fieldValidationErrors.length > 0 || !!pendingSubmission}
                    className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent"
                    data-testid="voting-cast-review"
                  >
                    <Lock className="h-4 w-4" />
                    <span>Review atomic cast</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4" data-testid="voting-cast-review-panel">
                <div className="rounded-xl border border-hush-bg-light bg-hush-bg-dark/80 p-4 text-sm text-hush-text-accent">
                  <div>Encrypted package: <span className="font-mono text-hush-text-primary">{truncateMiddle(castDraft.encryptedBallotPackage)}</span></div>
                  <div className="mt-2">Proof bundle: <span className="font-mono text-hush-text-primary">{truncateMiddle(castDraft.proofBundle)}</span></div>
                  <div className="mt-2">Nullifier: <span className="font-mono text-hush-text-primary">{truncateMiddle(castDraft.ballotNullifier)}</span></div>
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsReviewingCast(false)}
                    className="rounded-xl border border-hush-bg-light px-4 py-2 text-sm text-hush-text-accent transition-colors hover:border-hush-purple hover:text-hush-text-primary"
                  >
                    Edit prepared package
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCastSubmit()}
                    disabled={isSubmittingCast || !!pendingSubmission}
                    className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent"
                    data-testid="voting-cast-confirm"
                  >
                    {isSubmittingCast ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    <span>Submit atomic cast</span>
                  </button>
                </div>
              </div>
            )}
          </section>
        ) : null}

        {isAccepted ? (
          <section className="rounded-2xl border border-green-500/30 bg-green-500/10 p-5 text-green-100" data-testid="voting-accepted-panel">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5" />
              <div>
                <div className="font-semibold">Accepted ballot</div>
                <div className="mt-2 text-sm">Accepted at: {formatTimestamp(votingView.AcceptedAt)}</div>
                <div className="mt-1 text-sm">Receipt id: <span className="font-mono">{truncateMiddle(votingView.ReceiptId)}</span></div>
                <div className="mt-1 text-sm">Acceptance id: <span className="font-mono">{truncateMiddle(votingView.AcceptanceId)}</span></div>
              </div>
            </div>
            {localReceipt ? (
              <div className="mt-4 rounded-xl border border-green-300/20 bg-green-950/10 p-4">
                <div className="text-sm font-semibold">Local receipt retained on this device</div>
                <div className="mt-3 space-y-2 text-sm">
                  <div>Ballot commitment: <span className="font-mono">{truncateMiddle(localReceipt.ballotPackageCommitment)}</span></div>
                  <div>Server proof: <span className="font-mono">{truncateMiddle(localReceipt.serverProof)}</span></div>
                </div>
                <div className="mt-4 flex gap-3">
                  <button type="button" onClick={() => void handleCopyReceipt()} className="inline-flex items-center gap-2 rounded-xl border border-green-200/30 px-4 py-2 text-sm font-medium text-green-50 transition-colors hover:border-green-200/60" data-testid="voting-copy-receipt">
                    <Copy className="h-4 w-4" />
                    <span>Copy receipt</span>
                  </button>
                  <button type="button" onClick={handleDownloadReceipt} className="inline-flex items-center gap-2 rounded-xl border border-green-200/30 px-4 py-2 text-sm font-medium text-green-50 transition-colors hover:border-green-200/60" data-testid="voting-download-receipt">
                    <Download className="h-4 w-4" />
                    <span>Download receipt</span>
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
