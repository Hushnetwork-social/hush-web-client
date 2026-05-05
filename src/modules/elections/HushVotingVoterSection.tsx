"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import {
  CheckCircle2,
  Circle,
  Files,
  Loader2,
  ShieldCheck,
  Vote,
  X,
} from 'lucide-react';
import type {
  ElectionHubEntryView,
  GetElectionResultViewResponse,
  GetElectionVotingViewResponse,
  VerifyElectionReceiptResponse,
} from '@/lib/grpc';
import {
  ElectionHubNextActionHintProto,
  ElectionLifecycleStateProto,
} from '@/lib/grpc';
import { electionsService } from '@/lib/grpc/services/elections';
import {
  getClosedProgressNarrative,
  getLifecycleLabel,
  getPublishedResultNarrative,
} from './contracts';
import {
  AvailabilityCard,
  CollapsibleSurfaceSection,
} from './HushVotingWorkspaceShared';
import { ElectionReceiptTruthPanel } from './ElectionReceiptTruthPanel';

type ParsedAcceptedBallotReceipt = {
  electionId: string;
  receiptId: string;
  acceptanceId: string;
  serverProof: string;
  ballotPackageCommitment?: string;
  preparedBallotId?: string;
  preparedBallotHash?: string;
  receiptCommitment?: string;
  receiptCommitmentScheme?: string;
  ballotDefinitionHash?: string;
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
  const preparedBallotId = readField('Prepared Ballot ID');
  const preparedBallotHash = readField('Prepared Ballot Hash');
  const receiptCommitment = readField('Receipt Commitment');
  const receiptCommitmentScheme = readField('Receipt Commitment Scheme');
  const ballotDefinitionHash = readField('Ballot Definition Hash');
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
      preparedBallotId: preparedBallotId || undefined,
      preparedBallotHash: preparedBallotHash || undefined,
      receiptCommitment: receiptCommitment || undefined,
      receiptCommitmentScheme: receiptCommitmentScheme || undefined,
      ballotDefinitionHash: ballotDefinitionHash || undefined,
    },
  };
}

function loadRetainedReceiptCommitment(electionId: string): {
  ballotPackageCommitment: string;
  receiptCommitment: string;
} {
  if (typeof window === 'undefined') {
    return { ballotPackageCommitment: '', receiptCommitment: '' };
  }

  const storageKey = `feat099:receipt:${electionId}`;
  const rawValue =
    window.localStorage.getItem(storageKey) ?? window.sessionStorage.getItem(storageKey);
  if (!rawValue) {
    return { ballotPackageCommitment: '', receiptCommitment: '' };
  }

  try {
    const parsed = JSON.parse(rawValue) as {
      ballotPackageCommitment?: string;
      receiptCommitment?: string;
    };
    return {
      ballotPackageCommitment: parsed.ballotPackageCommitment?.trim() ?? '',
      receiptCommitment: parsed.receiptCommitment?.trim() ?? '',
    };
  } catch {
    return { ballotPackageCommitment: '', receiptCommitment: '' };
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
  retainedBallotPackageCommitment?: string,
  receiptCommitment?: string,
  retainedReceiptCommitment?: string,
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
  const hasProvidedBoundReceipt = Boolean(receiptCommitment);
  const hasRetainedBoundReceipt = Boolean(retainedReceiptCommitment);
  const serverConfirmedBoundReceipt =
    response.HasBoundReceipt &&
    response.ReceiptCommitmentInAcceptedSet &&
    (!receiptCommitment || response.VerifiedReceiptCommitment === receiptCommitment);
  const boundReceiptMatchesRetainedRecord =
    hasProvidedBoundReceipt &&
    hasRetainedBoundReceipt &&
    receiptCommitment === retainedReceiptCommitment;
  const boundReceiptStatusItem = response.HasBoundReceipt || hasProvidedBoundReceipt
    ? {
        label: 'The bound receipt commitment is confirmed in the accepted set.',
        complete: serverConfirmedBoundReceipt,
      }
    : null;
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
        ...(boundReceiptStatusItem ? [boundReceiptStatusItem] : []),
        ...(commitmentStatusItem ? [commitmentStatusItem] : []),
      ],
    };
  }

  if (
    hasProvidedBoundReceipt &&
    hasRetainedBoundReceipt &&
    !boundReceiptMatchesRetainedRecord
  ) {
    return {
      tone: 'error',
      title: 'Bound receipt does not match this device record',
      detail:
        'The pasted Receipt Commitment does not match the receipt retained on this device for this accepted vote.',
      verifiedAt,
      statusItems: [
        {
          label: 'This voter is marked as voted in this election.',
          complete: response.ParticipationCountedAsVoted,
        },
        ...(boundReceiptStatusItem ? [boundReceiptStatusItem] : []),
        finalCountStatusItem,
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
        ...(boundReceiptStatusItem ? [boundReceiptStatusItem] : []),
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
      ...(boundReceiptStatusItem
        ? [
            {
              ...boundReceiptStatusItem,
              complete: serverConfirmedBoundReceipt,
            },
          ]
        : []),
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

type VoterWorkspaceSummaryProps = {
  entry: ElectionHubEntryView;
  actorPublicAddress: string;
  resultView: GetElectionResultViewResponse | null;
};

export function VoterWorkspaceSummary({
  entry,
  actorPublicAddress,
  resultView,
}: VoterWorkspaceSummaryProps) {
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
  const [receiptVotingView, setReceiptVotingView] = useState<GetElectionVotingViewResponse | null>(
    null,
  );
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false);
  const [receiptInput, setReceiptInput] = useState('');
  const [receiptSourceLabel, setReceiptSourceLabel] = useState('');
  const [isVerifyingReceipt, setIsVerifyingReceipt] = useState(false);
  const [receiptVerification, setReceiptVerification] =
    useState<HubReceiptVerificationFeedback | null>(null);
  const publishedResultState = useMemo(
    () => getPublishedResultNarrative(entry, 'voter'),
    [entry]
  );
  const closedVoterState = useMemo(
    () => getClosedProgressNarrative(entry, 'voter'),
    [entry]
  );
  const needsVoterAction =
    entry.CanClaimIdentity ||
    entry.SuggestedAction === ElectionHubNextActionHintProto.ElectionHubActionVoterClaimIdentity ||
    entry.SuggestedAction === ElectionHubNextActionHintProto.ElectionHubActionVoterCastBallot ||
    (isOpenElection && !hasAcceptedReceipt);
  const receiptContextBindingStatus =
    receiptVotingView?.Election?.BindingStatus ?? entry.Election.BindingStatus;
  const receiptContextSelectedProfileDevOnly =
    receiptVotingView?.Election?.SelectedProfileDevOnly;
  const receiptContextProfileId =
    resultView?.CeremonySnapshot?.ProfileId ?? receiptVotingView?.DkgProfileId;
  const receiptContextTallyKeyFingerprint =
    resultView?.CeremonySnapshot?.TallyPublicKeyFingerprint ??
    receiptVotingView?.TallyPublicKeyFingerprint;
  const receiptContextOfficialVisibility =
    resultView?.OfficialResultVisibilityPolicy ??
    receiptVotingView?.Election?.OfficialResultVisibilityPolicy;
  const sp04CeremonyValue = receiptVotingView?.Sp04Required
    ? receiptVotingView.ChallengeSatisfied
      ? 'Challenge satisfied'
      : receiptVotingView.Sp04BlockerMessage || 'Challenge required before cast'
    : 'Standard cast path';
  const sp04CeremonyAccent = receiptVotingView?.Sp04Required
    ? receiptVotingView.ChallengeSatisfied
      ? 'text-green-100'
      : 'text-amber-100'
    : undefined;

  const voterSurfaceSummary = useMemo(() => {
    if (entry.CanClaimIdentity) {
      return (
        <>
          <span className="font-semibold text-hush-text-primary">Eligibility action required.</span>{' '}
          Link the voter identity before this actor can continue into the ballot flow.
        </>
      );
    }

    if (isOpenElection && !hasAcceptedReceipt) {
      return (
        <>
          <span className="font-semibold text-hush-text-primary">Ballot action available.</span> The election is open and
          waiting for this voter to continue into the ballot workflow.
        </>
      );
    }

    if (publishedResultState) {
      return (
        <>
          <span className="font-semibold text-hush-text-primary">{publishedResultState.title}.</span>{' '}
          {publishedResultState.description}
        </>
      );
    }

    if (isOpenElection && hasAcceptedReceipt) {
      return (
        <>
          <span className="font-semibold text-hush-text-primary">Vote already submitted.</span> No voter action is pending
          until the election publishes a result for review.
        </>
      );
    }

    if (entry.Election.LifecycleState === ElectionLifecycleStateProto.Closed) {
      return (
        <>
          <span className="font-semibold text-hush-text-primary">
            {closedVoterState?.title ?? 'Waiting for the unofficial result'}.
          </span>{' '}
          {closedVoterState?.description ??
            'Voting is closed. This section can stay collapsed until results are published.'}
        </>
      );
    }

    return (
      <>
        <span className="font-semibold text-hush-text-primary">No voter action right now.</span> This voter surface is
        available for reference, but it does not need attention yet.
      </>
    );
  }, [
    entry.CanClaimIdentity,
    entry.Election.LifecycleState,
    hasAcceptedReceipt,
    isOpenElection,
    publishedResultState,
    closedVoterState,
  ]);

  useEffect(() => {
    let isActive = true;

    async function loadAcceptedReceiptState(): Promise<void> {
      if (entry.CanClaimIdentity) {
        setHasAcceptedReceipt(false);
        setReceiptVotingView(null);
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

        setReceiptVotingView(votingView.Success ? votingView : null);
        setHasAcceptedReceipt(votingView.Success && votingView.HasAcceptedAt);
      } catch {
        if (isActive) {
          setReceiptVotingView(null);
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
      const retainedCommitments = loadRetainedReceiptCommitment(entry.Election.ElectionId);
      const verificationRequest = {
        ElectionId: entry.Election.ElectionId,
        ActorPublicAddress: actorPublicAddress,
        ReceiptId: parsed.receipt.receiptId,
        AcceptanceId: parsed.receipt.acceptanceId,
        ServerProof: parsed.receipt.serverProof,
        ...(parsed.receipt.receiptCommitment
          ? { ReceiptCommitment: parsed.receipt.receiptCommitment }
          : {}),
        ...(parsed.receipt.preparedBallotId
          ? { PreparedBallotId: parsed.receipt.preparedBallotId }
          : {}),
      };
      const verification = await electionsService.verifyElectionReceipt(verificationRequest);
      setReceiptVerification(
        buildHubReceiptVerificationFeedbackFromResponse(
          verification,
          resultView,
          parsed.receipt.ballotPackageCommitment,
          retainedCommitments.ballotPackageCommitment,
          parsed.receipt.receiptCommitment,
          retainedCommitments.receiptCommitment,
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
    <CollapsibleSurfaceSection
      testId="hush-voting-section-voter"
      toggleTestId="hush-voting-voter-toggle"
      eyebrow="Voter Surface"
      title="Participation and result review"
      description={
        entry.CanClaimIdentity
          ? 'This election still needs a voter identity or eligibility review before the ballot surface can open.'
          : isOpenElection
            ? 'The election is open for this voter. Open the ballot screen to review options and continue with the current ballot-submission flow for this build.'
            : 'Voting controls are no longer active. This surface stays available only for voter-specific context and receipt verification.'
      }
      summary={voterSurfaceSummary}
      defaultExpanded={needsVoterAction}
      actions={
        <>
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
        </>
      }
    >
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

      {receiptVotingView?.Sp04Required ? (
        <div
          className="mt-4 rounded-2xl bg-hush-bg-dark/70 p-4"
          data-testid="hush-voting-sp04-voter-summary"
        >
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
            Voter ceremony
          </div>
          <div className={`mt-2 text-sm font-semibold ${sp04CeremonyAccent ?? 'text-hush-text-primary'}`}>
            {sp04CeremonyValue}
          </div>
          <div className="mt-2 text-sm leading-6 text-hush-text-accent">
            Receipt and inclusion checks stay in this voter surface after a ballot is accepted.
          </div>
        </div>
      ) : null}

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
                <div className="space-y-4">
                  <ElectionReceiptTruthPanel
                    bindingStatus={receiptContextBindingStatus}
                    selectedProfileDevOnly={receiptContextSelectedProfileDevOnly}
                    officialResultVisibilityPolicy={receiptContextOfficialVisibility}
                    profileId={receiptContextProfileId}
                    tallyPublicKeyFingerprint={receiptContextTallyKeyFingerprint}
                    testId="hush-voting-receipt-context"
                  />
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
                </div>
              ) : (
                <div className="space-y-4">
                  <ElectionReceiptTruthPanel
                    bindingStatus={receiptContextBindingStatus}
                    selectedProfileDevOnly={receiptContextSelectedProfileDevOnly}
                    officialResultVisibilityPolicy={receiptContextOfficialVisibility}
                    profileId={receiptContextProfileId}
                    tallyPublicKeyFingerprint={receiptContextTallyKeyFingerprint}
                    testId="hush-voting-receipt-context"
                  />
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
    </CollapsibleSurfaceSection>
  );
}
