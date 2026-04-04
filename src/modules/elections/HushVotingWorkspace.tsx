"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  Circle,
  CheckCircle2,
  Files,
  Loader2,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
  Vote,
  X,
} from 'lucide-react';
import type {
  ElectionGovernedProposal,
  ElectionHubEntryView,
  GetElectionResponse,
  GetElectionResultViewResponse,
  VerifyElectionReceiptResponse,
} from '@/lib/grpc';
import {
  ElectionCeremonyVersionStatusProto,
  ElectionGovernanceModeProto,
  ElectionLifecycleStateProto,
  ElectionTrusteeInvitationStatusProto,
} from '@/lib/grpc';
import { electionsService } from '@/lib/grpc/services/elections';
import { ClosedProgressBanner } from './ClosedProgressBanner';
import { ElectionAccessBoundaryNotice } from './ElectionAccessBoundaryNotice';
import { ElectionHubList } from './ElectionHubList';
import { ElectionResultArtifactsSection } from './ElectionResultArtifactsSection';
import { ElectionWorkspaceHeader } from './ElectionWorkspaceHeader';
import { ReadOnlyGovernedActionSummary } from './ReadOnlyGovernedActionSummary';
import {
  createDraftFromElectionDetail,
  formatTimestamp,
  getActiveCeremonyVersion,
  getCeremonyVersionStatusLabel,
  getDraftOpenValidationErrors,
  getDraftSaveValidationErrors,
  getElectionWorkspaceSectionOrder,
  getFinalizationSessionPurposeLabel,
  getFinalizationSessionStatusLabel,
  getGovernedActionLabel,
  getGovernedProposalExecutionStatusLabel,
  getLatestFinalizationSession,
  getLifecycleLabel,
  getSummaryBadge,
} from './contracts';
import { useElectionsStore } from './useElectionsStore';

type HushVotingWorkspaceProps = {
  actorPublicAddress: string;
  actorEncryptionPublicKey: string;
  actorEncryptionPrivateKey: string;
  actorSigningPrivateKey: string;
  initialElectionId?: string;
};

const sectionClass =
  'rounded-3xl bg-hush-bg-element/95 p-5 shadow-lg shadow-black/10';

async function loadElectionResultViewSafely(
  electionId: string,
  actorPublicAddress: string,
): Promise<GetElectionResultViewResponse | null> {
  try {
    return await electionsService.getElectionResultView({
      ElectionId: electionId,
      ActorPublicAddress: actorPublicAddress,
    });
  } catch {
    return null;
  }
}

function timestampToMillis(timestamp?: { seconds?: number; nanos?: number }): number {
  if (!timestamp) {
    return 0;
  }

  return (timestamp.seconds ?? 0) * 1000 + Math.floor((timestamp.nanos ?? 0) / 1_000_000);
}

function getLatestProposal(detail: GetElectionResponse | null): ElectionGovernedProposal | null {
  const proposals = (detail?.GovernedProposals ?? [])
    .slice()
    .sort((left, right) => timestampToMillis(right.CreatedAt) - timestampToMillis(left.CreatedAt));

  return proposals[0] ?? null;
}

function AvailabilityCard({
  label,
  value,
  accentClass,
}: {
  label: string;
  value: string;
  accentClass?: string;
}) {
  return (
    <div className="rounded-2xl bg-hush-bg-dark/70 p-4 shadow-sm shadow-black/10">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
        {label}
      </div>
      <div className={`mt-2 text-sm font-medium ${accentClass ?? 'text-hush-text-primary'}`}>
        {value}
      </div>
    </div>
  );
}

type ParsedAcceptedBallotReceipt = {
  electionId: string;
  receiptId: string;
  acceptanceId: string;
  serverProof: string;
  ballotPackageCommitment?: string;
};

type HubReceiptVerificationFeedback = {
  tone: 'success' | 'warning' | 'error';
  title: string;
  detail: string;
  verifiedAt: string;
  statusItems?: Array<{
    label: string;
    complete: boolean;
  }>;
};

function parseAcceptedBallotReceipt(receiptText: string): {
  receipt?: ParsedAcceptedBallotReceipt;
  error?: string;
} {
  const normalized = receiptText.trim();
  if (!normalized) {
    return { error: 'Paste the receipt text or upload the downloaded receipt file first.' };
  }

  const readField = (label: string): string =>
    normalized.match(new RegExp(`^${label}:\\s*(.+)$`, 'im'))?.[1]?.trim() ?? '';

  const electionId = readField('Election ID');
  const receiptId = readField('Receipt ID');
  const acceptanceId = readField('Acceptance ID');
  const ballotPackageCommitment = readField('Ballot Package Commitment');
  const serverProof = readField('Server Proof');

  if (!electionId || !receiptId || !acceptanceId || !serverProof) {
    return {
      error:
        'The provided text is not a complete accepted-ballot receipt. Keep the original receipt format with Election ID, Receipt ID, Acceptance ID, and Server Proof.',
    };
  }

  return {
    receipt: {
      electionId,
      receiptId,
      acceptanceId,
      serverProof,
      ballotPackageCommitment:
        ballotPackageCommitment &&
        ballotPackageCommitment !== '(not retained on this device)'
          ? ballotPackageCommitment
          : undefined,
    },
  };
}

function loadRetainedReceiptCommitment(electionId: string): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const storageKey = `feat099:receipt:${electionId}`;
  const rawValue =
    window.localStorage.getItem(storageKey) ?? window.sessionStorage.getItem(storageKey);
  if (!rawValue) {
    return '';
  }

  try {
    const parsed = JSON.parse(rawValue) as { ballotPackageCommitment?: string };
    return parsed.ballotPackageCommitment?.trim() ?? '';
  } catch {
    return '';
  }
}

function buildCountedSetStatusItem({
  lifecycleState,
  hasOfficialResult,
  isCounted,
}: {
  lifecycleState?: ElectionLifecycleStateProto;
  hasOfficialResult: boolean;
  isCounted: boolean;
}): {
  label: string;
  complete: boolean;
} {
  if (lifecycleState === ElectionLifecycleStateProto.Finalized && hasOfficialResult) {
    return {
      label: 'This accepted vote is included in the finalized counted set used for the official result.',
      complete: isCounted,
    };
  }

  if (
    lifecycleState === ElectionLifecycleStateProto.Closed ||
    lifecycleState === ElectionLifecycleStateProto.Finalized
  ) {
    return {
      label: 'Counted-set confirmation will appear once the official result is sealed for this election.',
      complete: false,
    };
  }

  return {
    label: 'Counted-set confirmation will be available after the election is finalized.',
    complete: false,
  };
}

function buildHubReceiptVerificationFeedbackFromResponse(
  response: VerifyElectionReceiptResponse,
  resultView: GetElectionResultViewResponse | null,
  ballotPackageCommitment?: string,
  retainedBallotPackageCommitment?: string
): HubReceiptVerificationFeedback {
  const verifiedAt = new Date().toLocaleString();
  const finalCountStatusItem = buildCountedSetStatusItem({
    lifecycleState: response.LifecycleState,
    hasOfficialResult: Boolean(resultView?.OfficialResult),
    isCounted: response.ParticipationCountedAsVoted,
  });
  const hasProvidedCommitment = Boolean(ballotPackageCommitment);
  const hasRetainedCommitment = Boolean(retainedBallotPackageCommitment);
  const isPostCloseReceipt =
    response.LifecycleState === ElectionLifecycleStateProto.Closed ||
    response.LifecycleState === ElectionLifecycleStateProto.Finalized;
  const requiresCommitmentConfirmation =
    isPostCloseReceipt || hasProvidedCommitment || hasRetainedCommitment;
  const commitmentMatchesRetainedRecord =
    hasProvidedCommitment &&
    hasRetainedCommitment &&
    ballotPackageCommitment === retainedBallotPackageCommitment;
  const commitmentStatusItem = requiresCommitmentConfirmation
    ? {
        label: 'The ballot commitment line is independently confirmed on this device.',
        complete: commitmentMatchesRetainedRecord,
      }
    : null;

  if (!response.Success) {
    return {
      tone: 'error',
      title: 'Verification could not be completed',
      detail:
        response.ErrorMessage || 'The server could not check this receipt right now.',
      verifiedAt,
    };
  }

  if (!response.HasAcceptedCheckoff) {
    return {
      tone: 'error',
      title: 'No recorded vote found yet',
      detail:
        'This voter is not currently shown as voted in this election, so the receipt cannot be confirmed yet.',
      verifiedAt,
      statusItems: [
        {
          label: 'This voter is marked as voted in this election.',
          complete: false,
        },
        finalCountStatusItem,
      ],
    };
  }

  if (!response.ReceiptMatchesAcceptedCheckoff) {
    return {
      tone: 'error',
      title: 'This receipt does not match this voter',
      detail:
        'The receipt you provided does not match the recorded vote for this voter in this election.',
      verifiedAt,
    };
  }

  if (hasProvidedCommitment && hasRetainedCommitment && !commitmentMatchesRetainedRecord) {
    return {
      tone: 'error',
      title: 'Receipt commitment does not match this device record',
      detail:
        'The pasted Ballot Package Commitment does not match the receipt retained on this device for this accepted vote. The receipt text may have been changed.',
      verifiedAt,
      statusItems: [
        {
          label: 'This voter is marked as voted in this election.',
          complete: response.ParticipationCountedAsVoted,
        },
        finalCountStatusItem,
        ...(commitmentStatusItem ? [commitmentStatusItem] : []),
      ],
    };
  }

  if (requiresCommitmentConfirmation && !commitmentMatchesRetainedRecord) {
    const warningDetail = response.ParticipationCountedAsVoted
      ? hasProvidedCommitment && !hasRetainedCommitment
        ? 'The core receipt fields match the current vote record for this voter, and that accepted vote is included in the finalized counted set. This device could not independently confirm the Ballot Package Commitment line from the pasted receipt.'
        : !hasProvidedCommitment && hasRetainedCommitment
          ? 'The core receipt fields match the current vote record for this voter, and that accepted vote is included in the finalized counted set. This device retains a Ballot Package Commitment for this accepted vote, but the pasted receipt text does not include that line.'
          : 'The core receipt fields match the current vote record for this voter, and that accepted vote is included in the finalized counted set. The pasted receipt text does not include a confirmable Ballot Package Commitment line.'
      : hasProvidedCommitment && !hasRetainedCommitment
        ? 'The receipt matches this voter, but this device could not independently confirm the Ballot Package Commitment line from the pasted receipt.'
        : !hasProvidedCommitment && hasRetainedCommitment
          ? 'The receipt matches this voter, but the pasted receipt text does not include the Ballot Package Commitment retained on this device.'
          : 'The receipt matches this voter, but the pasted receipt text does not include a confirmable Ballot Package Commitment line.';

    return {
      tone: 'warning',
      title: response.ParticipationCountedAsVoted
        ? 'Receipt verified with incomplete commitment confirmation'
        : 'Receipt matches this voter, but commitment confirmation is incomplete',
      detail: warningDetail,
      verifiedAt,
      statusItems: [
        {
          label: 'This voter is marked as voted in this election.',
          complete: response.ParticipationCountedAsVoted,
        },
        finalCountStatusItem,
        ...(commitmentStatusItem ? [commitmentStatusItem] : []),
      ],
    };
  }

  return {
    tone: 'success',
    title: response.ParticipationCountedAsVoted
      ? 'This voter is marked as voted'
      : 'Receipt matches this voter',
    detail: response.ParticipationCountedAsVoted
      ? finalCountStatusItem.complete
        ? 'The receipt matches the current vote record for this voter, and that accepted vote is included in the finalized counted set for this election.'
        : 'The receipt matches the current vote record for this voter in this election.'
      : 'The receipt matches this voter, but the election is not showing the voter as marked as voted yet.',
    verifiedAt,
    statusItems: [
      {
        label: 'This voter is marked as voted in this election.',
        complete: response.ParticipationCountedAsVoted,
      },
      finalCountStatusItem,
      ...(commitmentStatusItem
        ? [
            {
              ...commitmentStatusItem,
              complete: true,
            },
          ]
        : []),
    ],
  };
}

function VoterWorkspaceSummary({
  entry,
  actorPublicAddress,
  resultView,
}: {
  entry: ElectionHubEntryView;
  actorPublicAddress: string;
  resultView: GetElectionResultViewResponse | null;
}) {
  const isOpenElection = entry.Election.LifecycleState === ElectionLifecycleStateProto.Open;
  const showCommitmentFieldInReceiptTemplate =
    entry.Election.LifecycleState === ElectionLifecycleStateProto.Closed ||
    entry.Election.LifecycleState === ElectionLifecycleStateProto.Finalized;
  const primaryHref = entry.CanClaimIdentity
    ? `/elections/${entry.Election.ElectionId}/eligibility`
    : `/elections/${entry.Election.ElectionId}/voter`;
  const primaryLabel = entry.CanClaimIdentity
    ? 'Open identity and eligibility'
    : isOpenElection
      ? 'Open ballot workflow'
      : 'Voter Details';
  const [hasAcceptedReceipt, setHasAcceptedReceipt] = useState(false);
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false);
  const [receiptInput, setReceiptInput] = useState('');
  const [receiptSourceLabel, setReceiptSourceLabel] = useState('');
  const [isVerifyingReceipt, setIsVerifyingReceipt] = useState(false);
  const [receiptVerification, setReceiptVerification] =
    useState<HubReceiptVerificationFeedback | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadAcceptedReceiptState(): Promise<void> {
      if (entry.CanClaimIdentity) {
        setHasAcceptedReceipt(false);
        return;
      }

      try {
        const votingView = await electionsService.getElectionVotingView({
          ElectionId: entry.Election.ElectionId,
          ActorPublicAddress: actorPublicAddress,
          SubmissionIdempotencyKey: '',
        });

        if (!isActive) {
          return;
        }

        setHasAcceptedReceipt(votingView.Success && votingView.HasAcceptedAt);
      } catch {
        if (isActive) {
          setHasAcceptedReceipt(false);
        }
      }
    }

    void loadAcceptedReceiptState();

    return () => {
      isActive = false;
    };
  }, [actorPublicAddress, entry.CanClaimIdentity, entry.Election.ElectionId]);

  useEffect(() => {
    if (isReceiptDialogOpen) {
      return;
    }

    setReceiptInput('');
    setReceiptSourceLabel('');
    setReceiptVerification(null);
    setIsVerifyingReceipt(false);
  }, [isReceiptDialogOpen]);

  useEffect(() => {
    if (!isReceiptDialogOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsReceiptDialogOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isReceiptDialogOpen]);

  async function handleReceiptFileChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    setReceiptInput(text);
    setReceiptSourceLabel(file.name);
    setReceiptVerification(null);
  }

  async function handleVerifyReceipt(): Promise<void> {
    const parsed = parseAcceptedBallotReceipt(receiptInput);
    if (!parsed.receipt) {
      setReceiptVerification({
        tone: 'error',
        title: 'Receipt could not be parsed',
        detail: parsed.error || 'The provided receipt could not be parsed.',
        verifiedAt: new Date().toLocaleString(),
      });
      return;
    }

    if (parsed.receipt.electionId !== entry.Election.ElectionId) {
      setReceiptVerification({
        tone: 'error',
        title: 'Receipt belongs to a different election',
        detail:
          'The Election ID inside the provided receipt does not match the currently selected election in HushVoting! Hub.',
        verifiedAt: new Date().toLocaleString(),
      });
      return;
    }

    setIsVerifyingReceipt(true);
    try {
      const retainedBallotPackageCommitment = loadRetainedReceiptCommitment(entry.Election.ElectionId);
      const verification = await electionsService.verifyElectionReceipt({
        ElectionId: entry.Election.ElectionId,
        ActorPublicAddress: actorPublicAddress,
        ReceiptId: parsed.receipt.receiptId,
        AcceptanceId: parsed.receipt.acceptanceId,
        ServerProof: parsed.receipt.serverProof,
      });
      setReceiptVerification(
        buildHubReceiptVerificationFeedbackFromResponse(
          verification,
          resultView,
          parsed.receipt.ballotPackageCommitment,
          retainedBallotPackageCommitment,
        ),
      );
    } catch (error) {
      setReceiptVerification({
        tone: 'error',
        title: 'Verification request failed',
        detail:
          error instanceof Error
            ? error.message
            : 'The server-side receipt verification request failed.',
        verifiedAt: new Date().toLocaleString(),
      });
    } finally {
      setIsVerifyingReceipt(false);
    }
  }

  return (
    <section className="space-y-4 pt-4 md:pt-6" data-testid="hush-voting-section-voter">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="lg:min-w-0 lg:flex-1">
          <h2 className="text-base font-semibold uppercase tracking-[0.28em] text-hush-text-primary md:text-lg">
            Voter Surface
          </h2>
          <h3 className="mt-3 text-lg font-semibold text-hush-text-accent md:text-xl">
            Participation and result review
          </h3>
          <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
            {entry.CanClaimIdentity
              ? 'This election still needs a voter identity or eligibility review before the ballot surface can open.'
              : isOpenElection
                ? 'The election is open for this voter. Open the ballot screen to review options and continue with the current ballot-submission flow for this build.'
                : 'Voting controls are no longer active, but this actor can still review the voter detail surface for election-specific context.'}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3 sm:flex-nowrap lg:ml-6">
          <Link
            href={primaryHref}
            className="inline-flex self-start items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-hush-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
          >
            <Vote className="h-4 w-4" />
            <span>{primaryLabel}</span>
          </Link>

          {hasAcceptedReceipt ? (
            <button
              type="button"
              onClick={() => setIsReceiptDialogOpen(true)}
              className="inline-flex self-start items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-medium whitespace-nowrap text-green-100 transition-colors hover:bg-green-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-300 focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
              data-testid="hush-voting-verify-receipt-trigger"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Verify receipt</span>
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <AvailabilityCard label="Lifecycle" value={getLifecycleLabel(entry.Election.LifecycleState)} />
        <AvailabilityCard
          label="Eligibility"
          value={entry.CanClaimIdentity ? 'Needs identity claim' : 'Ready or already linked'}
          accentClass={entry.CanClaimIdentity ? 'text-amber-100' : 'text-green-100'}
        />
        <AvailabilityCard
          label="Results"
          value={
            entry.HasOfficialResult
              ? 'Official result available'
              : entry.HasUnofficialResult
                ? 'Participant result available'
                : 'No result artifact yet'
          }
          accentClass={entry.HasOfficialResult || entry.HasUnofficialResult ? 'text-green-100' : undefined}
        />
      </div>

      {isReceiptDialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hub-receipt-verification-title"
          data-testid="hush-voting-receipt-dialog"
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsReceiptDialogOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-2xl rounded-2xl border border-hush-bg-element bg-hush-bg-dark p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setIsReceiptDialogOpen(false)}
              className="absolute right-4 top-4 text-hush-text-accent transition-colors hover:text-hush-text-primary"
              aria-label="Close receipt verification dialog"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500/15 text-green-300">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                  Receipt verification
                </div>
                <h3
                  id="hub-receipt-verification-title"
                  className="mt-2 text-xl font-semibold text-hush-text-primary"
                >
                  Verify vote receipt
                </h3>
                <p className="mt-3 text-sm leading-7 text-hush-text-accent">
                  Paste the receipt text or upload the downloaded receipt file. This check confirms
                  whether this voter is already marked as voted in this election. After finalization,
                  it can confirm whether the accepted vote is included in the counted set used for
                  the official result. If this device retained the original receipt, it also checks
                  the ballot commitment line locally.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <label
                  htmlFor="hush-voting-receipt-file"
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-hush-bg-hover bg-hush-bg-element/70 px-4 py-2.5 text-sm font-medium text-hush-text-primary transition-colors hover:bg-hush-bg-element"
                >
                  <Files className="h-4 w-4" />
                  <span>Upload receipt file</span>
                </label>
                <input
                  id="hush-voting-receipt-file"
                  type="file"
                  accept=".txt,text/plain"
                  className="hidden"
                  onChange={(event) => void handleReceiptFileChange(event)}
                  data-testid="hush-voting-receipt-file"
                />
                {receiptSourceLabel ? (
                  <div className="text-sm text-hush-text-accent">Loaded file: {receiptSourceLabel}</div>
                ) : (
                  <div className="text-sm text-hush-text-accent">
                    Or paste the copied receipt text below.
                  </div>
                )}
              </div>

              <textarea
                value={receiptInput}
                onChange={(event) => {
                  setReceiptInput(event.target.value);
                  setReceiptVerification(null);
                }}
                rows={10}
                className="w-full rounded-2xl border border-hush-bg-hover bg-hush-bg-element/70 px-4 py-3 text-sm leading-6 text-hush-text-primary placeholder-hush-text-accent/60 focus:outline-none focus:ring-2 focus:ring-hush-purple"
                placeholder={
                  showCommitmentFieldInReceiptTemplate
                    ? `Accepted Ballot Receipt\nElection ID: ${entry.Election.ElectionId}\nReceipt ID: ...\nAcceptance ID: ...\nAccepted At: ...\nBallot Package Commitment: ...\nServer Proof: ...`
                    : `Accepted Ballot Receipt\nElection ID: ${entry.Election.ElectionId}\nReceipt ID: ...\nAcceptance ID: ...\nAccepted At: ...\nServer Proof: ...`
                }
                data-testid="hush-voting-receipt-input"
              />

              {receiptVerification ? (
                <div
                  className={`rounded-2xl px-4 py-4 text-sm ${
                    receiptVerification.tone === 'success'
                      ? 'border border-green-500/30 bg-green-500/10 text-green-100'
                      : receiptVerification.tone === 'warning'
                        ? 'border border-amber-500/30 bg-amber-500/10 text-amber-100'
                      : 'border border-red-500/30 bg-red-500/10 text-red-100'
                  }`}
                  data-testid="hush-voting-receipt-result"
                >
                  <div className="font-semibold">{receiptVerification.title}</div>
                  <div className="mt-2 leading-7">{receiptVerification.detail}</div>
                  {receiptVerification.statusItems?.length ? (
                    <div className="mt-4 space-y-3">
                      {receiptVerification.statusItems.map((item) => (
                        <div key={item.label} className="flex items-start gap-3">
                          {item.complete ? (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                          ) : (
                            <Circle className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                          )}
                          <div className="leading-6">{item.label}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-3 text-xs uppercase tracking-[0.18em] opacity-80">
                    Verified at {receiptVerification.verifiedAt}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-hush-bg-element/70 px-4 py-4 text-sm text-hush-text-accent">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Circle className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                      <div>Confirm whether this voter is marked as voted in this election.</div>
                    </div>
                    {!showCommitmentFieldInReceiptTemplate ? (
                      <div className="flex items-start gap-3">
                        <Circle className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                        <div>Open-election receipts include only the fields needed for this check.</div>
                      </div>
                    ) : null}
                    {showCommitmentFieldInReceiptTemplate ? (
                      <div className="flex items-start gap-3">
                        <Circle className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                        <div>
                          If this device retained the original receipt, the ballot commitment line is
                          checked locally as well.
                        </div>
                      </div>
                    ) : null}
                    <div className="flex items-start gap-3">
                      <Circle className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                      <div>
                        After finalization, confirm whether the accepted vote is included in the
                        counted set used for the official result.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsReceiptDialogOpen(false)}
                className="rounded-xl border border-hush-bg-hover px-4 py-2.5 text-sm font-medium text-hush-text-accent transition-colors hover:bg-hush-bg-element"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleVerifyReceipt()}
                disabled={isVerifyingReceipt}
                className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-300 focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="hush-voting-verify-receipt-submit"
              >
                {isVerifyingReceipt ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                <span>Verify receipt</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function OwnerAdminWorkspaceSummary({
  entry,
  detail,
}: {
  entry: ElectionHubEntryView;
  detail: GetElectionResponse | null;
}) {
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

  return (
    <section className="space-y-4 pt-4 md:pt-6" data-testid="hush-voting-section-owner-admin">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-base font-semibold uppercase tracking-[0.28em] text-hush-text-primary md:text-lg">
            Owner / Admin Surface
          </h2>
          <h3 className="mt-3 text-lg font-semibold text-hush-text-primary md:text-xl">
            Election lifecycle management
          </h3>
          <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
            This shell now shows owner-facing trustee and open-readiness status only. Draft edits,
            auditor grants, ceremony work, and the actual open action stay inside the Owner
            Workspace.
          </p>
        </div>

        <Link
          href="/elections/owner"
          className="inline-flex self-start items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-hush-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark lg:ml-6"
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Owner Workspace</span>
        </Link>
      </div>

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
              Use this as the quick answer to “can I open yet?”. Auditor management moved to the
              Owner Workspace, and trustee-threshold elections also require the key ceremony there.
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

    </section>
  );
}

function TrusteeWorkspaceSummary({
  entry,
  detail,
}: {
  entry: ElectionHubEntryView;
  detail: GetElectionResponse | null;
}) {
  const latestProposal = useMemo(() => getLatestProposal(detail), [detail]);
  const activeCeremonyVersion = useMemo(() => getActiveCeremonyVersion(detail), [detail]);
  const latestFinalizationSession = useMemo(() => getLatestFinalizationSession(detail), [detail]);

  return (
    <section className={sectionClass} data-testid="hush-voting-section-trustee">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-hush-text-accent">
            Trustee Surface
          </div>
          <h2 className="mt-2 text-xl font-semibold text-hush-text-primary">
            Governed action, ceremony, and share follow-up
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
            Trustee actions stay on their explicit pages. This shell keeps the election-specific
            ceremony and approval context visible before you jump into the bound action route.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/account/elections/trustee/${entry.Election.ElectionId}/ceremony`}
            className="inline-flex items-center gap-2 rounded-xl border border-hush-bg-light px-4 py-2 text-sm font-medium text-hush-text-primary transition-colors hover:border-hush-purple hover:text-hush-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Open ceremony workspace</span>
          </Link>
          <Link
            href={`/account/elections/trustee/${entry.Election.ElectionId}/finalization`}
            className="inline-flex items-center gap-2 rounded-xl border border-hush-bg-light px-4 py-2 text-sm font-medium text-hush-text-primary transition-colors hover:border-hush-purple hover:text-hush-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
          >
            <Files className="h-4 w-4" />
            <span>Open share workspace</span>
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <AvailabilityCard
          label="Latest proposal"
          value={
            latestProposal
              ? `${getGovernedActionLabel(latestProposal.ActionType)} | ${getGovernedProposalExecutionStatusLabel(latestProposal.ExecutionStatus)}`
              : 'No governed proposal recorded'
          }
        />
        <AvailabilityCard
          label="Ceremony"
          value={
            activeCeremonyVersion
              ? `Version ${activeCeremonyVersion.VersionNumber} | ${formatTimestamp(activeCeremonyVersion.StartedAt)}`
              : 'No active ceremony version'
          }
        />
        <AvailabilityCard
          label="Latest share session"
          value={
            latestFinalizationSession
              ? `${getFinalizationSessionPurposeLabel(latestFinalizationSession.SessionPurpose)} | ${getFinalizationSessionStatusLabel(latestFinalizationSession.Status)}`
              : 'No finalization session recorded'
          }
        />
      </div>

      {latestProposal ? (
        <div className="mt-4">
          <Link
            href={`/account/elections/trustee/${entry.Election.ElectionId}/proposal/${latestProposal.Id}`}
            className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
          >
            <ArrowRight className="h-4 w-4" />
            <span>Open latest trustee proposal</span>
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function AuditorWorkspaceSummary({
  entry,
  detail,
  resultView,
  isLoadingResultView,
}: {
  entry: ElectionHubEntryView;
  detail: GetElectionResponse | null;
  resultView: GetElectionResultViewResponse | null;
  isLoadingResultView: boolean;
}) {
  const hasReportPackage = Boolean(resultView?.CanViewReportPackage && resultView?.LatestReportPackage);
  const resultTargetId = resultView?.OfficialResult
    ? 'hush-voting-official-result'
    : resultView?.UnofficialResult
      ? 'hush-voting-unofficial-result'
      : null;

  return (
    <section className="space-y-5 pt-4 md:pt-6" data-testid="hush-voting-section-auditor">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-hush-text-accent">
          Auditor Surface
        </div>
        <h2 className="mt-2 text-xl font-semibold text-hush-text-primary">
          Read-only governance and package access
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
          Designated-auditor access stays read-only here. The shell mirrors server-approved
          package and governance visibility without introducing any auditor-only mutation path.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <AvailabilityCard
          label="Report package"
          value={entry.CanViewReportPackage ? 'Granted' : 'Not granted'}
          accentClass={entry.CanViewReportPackage ? 'text-green-100' : undefined}
        />
        <AvailabilityCard
          label="Named roster"
          value={entry.CanViewNamedParticipationRoster ? 'Visible' : 'Restricted'}
          accentClass={entry.CanViewNamedParticipationRoster ? 'text-green-100' : undefined}
        />
        <AvailabilityCard
          label="Participant results"
          value={entry.CanViewParticipantResults ? 'Visible' : 'Restricted'}
          accentClass={entry.CanViewParticipantResults ? 'text-green-100' : undefined}
        />
      </div>

      {isLoadingResultView ? (
        <div className="rounded-2xl bg-hush-bg-dark/60 px-4 py-3 text-sm text-hush-text-accent">
          Loading the auditor-visible package and result surfaces for this election.
        </div>
      ) : hasReportPackage || resultTargetId ? (
        <div className="flex flex-wrap gap-3">
          {hasReportPackage ? (
            <a
              href="#hush-voting-report-package"
              className="inline-flex items-center gap-2 rounded-full bg-[#1b2544] px-4 py-2 text-sm font-medium text-hush-text-primary transition-colors hover:bg-[#243158]"
              data-testid="hush-voting-open-report-package"
            >
              <Files className="h-4 w-4" />
              <span>Open report package</span>
            </a>
          ) : null}
          {resultTargetId ? (
            <a
              href={`#${resultTargetId}`}
              className="inline-flex items-center gap-2 rounded-full bg-[#1b2544] px-4 py-2 text-sm font-medium text-hush-text-primary transition-colors hover:bg-[#243158]"
              data-testid="hush-voting-open-auditor-result"
            >
              <Vote className="h-4 w-4" />
              <span>{resultView?.OfficialResult ? 'Open official result' : 'Open unofficial result'}</span>
            </a>
          ) : null}
        </div>
      ) : null}

      {detail ? (
        <ReadOnlyGovernedActionSummary detail={detail} />
      ) : null}
    </section>
  );
}

function ResultsWorkspaceSummary({
  entry,
  detail,
  resultView,
  isLoadingResultView,
}: {
  entry: ElectionHubEntryView;
  detail: GetElectionResponse | null;
  resultView: GetElectionResultViewResponse | null;
  isLoadingResultView: boolean;
}) {
  const hasAnyResults =
    entry.HasUnofficialResult ||
    entry.HasOfficialResult ||
    Boolean(resultView?.UnofficialResult || resultView?.OfficialResult);
  const hasReportPackage = Boolean(resultView?.CanViewReportPackage && resultView?.LatestReportPackage);
  const canOpenResultDetail = entry.ActorRoles.IsVoter && hasAnyResults;
  const resultTargetId = resultView?.OfficialResult
    ? '#hush-voting-official-result'
    : resultView?.UnofficialResult
      ? '#hush-voting-unofficial-result'
      : null;
  const [isExpanded, setIsExpanded] = useState(hasAnyResults || hasReportPackage);

  useEffect(() => {
    if (hasAnyResults || hasReportPackage) {
      setIsExpanded(true);
    }
  }, [hasAnyResults, hasReportPackage]);

  return (
    <section className="space-y-4 pt-4 md:pt-6" data-testid="hush-voting-section-results">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold uppercase tracking-[0.28em] text-hush-text-primary md:text-lg">
            Results and Boundary Artifacts
          </h2>
          <h3 className="mt-3 text-lg font-semibold text-hush-text-accent md:text-xl">
            Result and package availability
          </h3>
          <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
            {hasAnyResults || hasReportPackage
              ? 'Result or report-package access is available for this election.'
              : 'No unofficial result, official result, or report package is available yet. Expand this section only if you need the access boundaries.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
          aria-expanded={isExpanded}
          data-testid="hush-voting-results-toggle"
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {isExpanded ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="text-sm text-hush-text-accent">
              These indicators come directly from the actor-scoped hub response so the client does not
              overstate result, roster, or report-package access.
            </div>

            <div className="flex flex-wrap gap-3 lg:ml-6">
              {entry.ActorRoles.IsVoter ? (
                canOpenResultDetail ? (
                  <Link
                    href={`/elections/${entry.Election.ElectionId}/voter`}
                    className="inline-flex self-start items-center gap-2 rounded-full bg-[#1b2544] px-4 py-2 text-sm font-medium whitespace-nowrap text-hush-text-primary transition-colors hover:bg-[#243158] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
                  >
                    <Vote className="h-4 w-4" />
                    <span>Result details</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex self-start items-center gap-2 rounded-full bg-[#1b2544]/70 px-4 py-2 text-sm font-medium whitespace-nowrap text-hush-text-accent/80 opacity-60 cursor-not-allowed"
                  >
                    <Vote className="h-4 w-4" />
                    <span>Result details</span>
                  </button>
                )
              ) : null}

              {hasReportPackage ? (
                <a
                  href="#hush-voting-report-package"
                  className="inline-flex self-start items-center gap-2 rounded-full bg-[#1b2544] px-4 py-2 text-sm font-medium whitespace-nowrap text-hush-text-primary transition-colors hover:bg-[#243158] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
                  data-testid="hush-voting-results-open-report-package"
                >
                  <Files className="h-4 w-4" />
                  <span>Open report package</span>
                </a>
              ) : null}

              {resultTargetId ? (
                <a
                  href={resultTargetId}
                  className="inline-flex self-start items-center gap-2 rounded-full bg-[#1b2544] px-4 py-2 text-sm font-medium whitespace-nowrap text-hush-text-primary transition-colors hover:bg-[#243158] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
                  data-testid="hush-voting-results-open-result"
                >
                  <Vote className="h-4 w-4" />
                  <span>{resultView?.OfficialResult ? 'Open official result' : 'Open unofficial result'}</span>
                </a>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <AvailabilityCard
              label="Unofficial result"
              value={entry.HasUnofficialResult ? 'Available' : 'Pending'}
              accentClass={entry.HasUnofficialResult ? 'text-green-100' : undefined}
            />
            <AvailabilityCard
              label="Official result"
              value={entry.HasOfficialResult ? 'Available' : 'Pending'}
              accentClass={entry.HasOfficialResult ? 'text-green-100' : undefined}
            />
            <AvailabilityCard
              label="Report package"
              value={entry.CanViewReportPackage ? 'Allowed' : 'Not allowed'}
              accentClass={entry.CanViewReportPackage ? 'text-green-100' : undefined}
            />
            <AvailabilityCard
              label="Named participation roster"
              value={entry.CanViewNamedParticipationRoster ? 'Allowed' : 'Not allowed'}
              accentClass={entry.CanViewNamedParticipationRoster ? 'text-green-100' : undefined}
            />
          </div>

          {detail?.ResultArtifacts?.length ? (
            <div className="rounded-2xl bg-hush-bg-dark/70 p-4 shadow-sm shadow-black/10">
              <div className="text-sm font-semibold text-hush-text-primary">Persisted result artifacts</div>
              <div className="mt-2 text-sm text-hush-text-accent">
                {detail.ResultArtifacts.length} artifact
                {detail.ResultArtifacts.length === 1 ? '' : 's'} currently visible on the election
                detail record.
              </div>
            </div>
          ) : null}

          {isLoadingResultView ? (
            <div className="rounded-2xl bg-hush-bg-dark/60 px-4 py-3 text-sm text-hush-text-accent">
              Loading result and report-package details for this actor.
            </div>
          ) : null}

          {detail?.Election ? (
            <ElectionResultArtifactsSection election={detail.Election} resultView={resultView} />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function HushVotingWorkspace({
  actorPublicAddress,
  initialElectionId,
}: HushVotingWorkspaceProps) {
  const router = useRouter();
  const [resultView, setResultView] = useState<GetElectionResultViewResponse | null>(null);
  const [isLoadingResultView, setIsLoadingResultView] = useState(false);
  const {
    clearGrantCandidateSearch,
    feedback,
    error,
    hubEntries,
    hubView,
    isLoadingDetail,
    isLoadingHub,
    loadElectionHub,
    reset,
    selectedElection,
    selectedElectionId,
    selectedHubEntry,
    selectHubElection,
  } = useElectionsStore();

  useEffect(() => {
    void loadElectionHub(actorPublicAddress);
  }, [actorPublicAddress, loadElectionHub]);

  useEffect(() => () => reset(), [reset]);

  useEffect(() => {
    if (!selectedElectionId) {
      return;
    }

    clearGrantCandidateSearch();
  }, [clearGrantCandidateSearch, selectedElectionId]);

  const requestedEntry = useMemo(
    () =>
      initialElectionId
        ? hubEntries.find((entry) => entry.Election.ElectionId === initialElectionId) ?? null
        : null,
    [hubEntries, initialElectionId]
  );

  useEffect(() => {
    if (!initialElectionId || !requestedEntry || selectedElectionId === initialElectionId) {
      return;
    }

    void selectHubElection(actorPublicAddress, initialElectionId);
  }, [
    actorPublicAddress,
    initialElectionId,
    requestedEntry,
    selectedElectionId,
    selectHubElection,
  ]);

  const activeEntry = useMemo(() => {
    if (initialElectionId) {
      return requestedEntry;
    }

    if (selectedHubEntry) {
      return selectedHubEntry;
    }

    return (
      hubEntries.find((entry) => entry.Election.ElectionId === selectedElectionId) ??
      hubEntries[0] ??
      null
    );
  }, [hubEntries, initialElectionId, requestedEntry, selectedElectionId, selectedHubEntry]);

  const activeDetail = useMemo(
    () =>
      activeEntry && selectedElection?.Election?.ElectionId === activeEntry.Election.ElectionId
        ? selectedElection
        : null,
    [activeEntry, selectedElection]
  );

  const requestedEntryMissing = Boolean(initialElectionId && !isLoadingHub && hubView && !requestedEntry);
  const sectionOrder = getElectionWorkspaceSectionOrder(activeEntry);
  const hasVisibleSections = sectionOrder.length > 0;
  const isDetailRoute = Boolean(initialElectionId);

  useEffect(() => {
    if (!isDetailRoute || !activeEntry) {
      setResultView(null);
      setIsLoadingResultView(false);
      return;
    }

    const shouldLoadResultView =
      activeEntry.CanViewParticipantResults ||
      activeEntry.CanViewReportPackage ||
      activeEntry.HasUnofficialResult ||
      activeEntry.HasOfficialResult;

    if (!shouldLoadResultView) {
      setResultView(null);
      setIsLoadingResultView(false);
      return;
    }

    let isCancelled = false;
    setIsLoadingResultView(true);

    void loadElectionResultViewSafely(activeEntry.Election.ElectionId, actorPublicAddress).then(
      (response) => {
        if (isCancelled) {
          return;
        }

        setResultView(response?.Success ? response : null);
        setIsLoadingResultView(false);
      }
    );

    return () => {
      isCancelled = true;
    };
  }, [
    activeEntry,
    actorPublicAddress,
    isDetailRoute,
  ]);

  const handleSelectElection = (electionId: string) => {
    if (electionId !== initialElectionId) {
      router.push(`/elections/${electionId}`);
    }
  };

  const emptyStateReason =
    error ||
    hubView?.EmptyStateReason ||
    'This account does not currently hold any election role.';

  if (!isDetailRoute) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto text-hush-text-primary">
        <div className="flex w-full min-w-0 flex-col gap-5 p-4 md:p-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-hush-text-accent">
              Protocol Omega
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-hush-text-primary">HushVoting! Hub</h1>
            <p className="mt-2 max-w-4xl text-sm text-hush-text-accent">
              Open a linked election card to continue into its dedicated HushVoting! detail view.
            </p>
          </div>

          {feedback ? (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
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

          {hubEntries.length === 0 && isLoadingHub ? (
            <div className={`${sectionClass} flex items-center gap-3`}>
              <Loader2 className="h-5 w-5 animate-spin text-hush-purple" />
              <span className="text-sm text-hush-text-accent">Loading actor-scoped election hub...</span>
            </div>
          ) : hubEntries.length === 0 ? (
            <ElectionAccessBoundaryNotice
              title="No linked election surfaces available"
              message={emptyStateReason}
              details={[
                'Use Search Election from the left menu to find an election before claim-linking your organization voter identifier.',
                'Use Create Election from the left menu to start a new owner draft.',
                'After the eligibility claim succeeds, the election will appear in this hub.',
              ]}
              primaryHref={null}
              primaryLabel={null}
            />
          ) : (
            <div className="pt-2 md:pt-3">
              <ElectionHubList
                entries={hubEntries}
                selectedElectionId={null}
                onSelect={handleSelectElection}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto text-hush-text-primary">
      <div className="flex w-full min-w-0 flex-col gap-5 p-4 md:p-5">
        {feedback ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
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

        {requestedEntryMissing ? (
          <ElectionAccessBoundaryNotice
            title="Requested election is not available here"
            message={`The route for election ${initialElectionId} does not resolve to a visible workspace for this account.`}
            details={[
              'Return to HushVoting! Hub to choose another linked election.',
              'This route only opens elections that the current actor can access.',
            ]}
          />
        ) : !activeEntry ? (
          <div className={`${sectionClass} flex items-center gap-3`}>
            <Loader2 className="h-5 w-5 animate-spin text-hush-purple" />
            <span className="text-sm text-hush-text-accent">Preparing election workspace...</span>
          </div>
        ) : (
          <>
            <ElectionWorkspaceHeader entry={activeEntry} />
            <ClosedProgressBanner entry={activeEntry} />

            {!hasVisibleSections ? (
              <ElectionAccessBoundaryNotice
                title="No workspace surface is available"
                message={
                  activeEntry.SuggestedActionReason ||
                  'This actor does not currently have an owner, trustee, voter, auditor, or result-review surface for the selected election.'
                }
                primaryLabel="Back to HushVoting! Hub"
              />
            ) : null}

            {isLoadingDetail && !activeDetail ? (
              <div className={`${sectionClass} flex items-center gap-3`}>
                <Loader2 className="h-5 w-5 animate-spin text-hush-purple" />
                <span className="text-sm text-hush-text-accent">
                  Loading detailed context for {activeEntry.Election.Title || activeEntry.Election.ElectionId}...
                </span>
              </div>
            ) : null}

            {sectionOrder.includes('voter') ? (
              <VoterWorkspaceSummary
                entry={activeEntry}
                actorPublicAddress={actorPublicAddress}
                resultView={resultView}
              />
            ) : null}

            {sectionOrder.includes('owner-admin') ? (
              <OwnerAdminWorkspaceSummary
                entry={activeEntry}
                detail={activeDetail}
              />
            ) : null}

            {sectionOrder.includes('trustee') ? (
              <TrusteeWorkspaceSummary entry={activeEntry} detail={activeDetail} />
            ) : null}

            {sectionOrder.includes('auditor') ? (
              <AuditorWorkspaceSummary
                entry={activeEntry}
                detail={activeDetail}
                resultView={resultView}
                isLoadingResultView={isLoadingResultView}
              />
            ) : null}

            {sectionOrder.includes('results') ? (
              <ResultsWorkspaceSummary
                entry={activeEntry}
                detail={activeDetail}
                resultView={resultView}
                isLoadingResultView={isLoadingResultView}
              />
            ) : null}

            {activeEntry.CanViewReportPackage && !sectionOrder.includes('auditor') ? (
              <section className={sectionClass}>
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-blue-500/10 p-3 text-blue-100">
                    <LockKeyhole className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-hush-text-primary">
                      Report package visibility granted
                    </div>
                    <p className="mt-2 text-sm text-hush-text-accent">
                      The server marks this actor as report-package eligible for the selected
                      election. Phase 5 keeps that boundary visible here without inventing any
                      package action the server did not authorize.
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            {!sectionOrder.includes('results') && activeEntry.HasOfficialResult ? (
              <section className={sectionClass}>
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-green-500/10 p-3 text-green-100">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-hush-text-primary">
                      Official result exists
                    </div>
                    <p className="mt-2 text-sm text-hush-text-accent">
                      The election record already carries an official result, but this actor does
                      not currently have a result-review surface for it.
                    </p>
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
