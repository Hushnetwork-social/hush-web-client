"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Circle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  Loader2,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import { base64ToBytes, generateGuid } from '@/lib/crypto';
import {
  FEAT107_CIRCUIT_VERSION_BY_PROFILE,
  FEAT107_PROOF_PROFILES,
  encryptOneHotElectionBallot,
  serializePoint,
  serializeVectorCiphertext,
} from '@/lib/crypto/elections';
import { bytesToBigint, type Point } from '@/lib/crypto/reactions/babyjubjub';
import {
  ElectionBindingStatusProto,
  ElectionLifecycleStateProto,
  ElectionParticipationStatusProto,
  ElectionVotingRightStatusProto,
  ElectionVotingSubmissionStatusProto,
  TransactionStatus,
  type GetElectionResponse,
  type GetElectionResultViewResponse,
  type GetElectionVotingViewResponse,
} from '@/lib/grpc';
import { infoLog } from '@/lib/debug-logger';
import { electionsService } from '@/lib/grpc/services/elections';
import { submitTransaction } from '@/modules/blockchain/BlockchainService';
import {
  createAcceptElectionBallotCastTransaction,
  createRegisterPreparedBallotCommitmentTransaction,
  createRegisterElectionVotingCommitmentTransaction,
  createSpoilPreparedBallotTransaction,
} from './transactionService';
import { ElectionReceiptTruthPanel } from './ElectionReceiptTruthPanel';
import { ElectionResultArtifactsSection } from './ElectionResultArtifactsSection';
import { getLifecycleLabel } from './contracts';

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

type ReceiptVerificationFeedback = {
  tone: 'success' | 'warning' | 'error';
  title: string;
  detail: string;
  verifiedAt: string;
  statusItems?: Array<{
    label: string;
    complete: boolean;
  }>;
};

type PendingSubmissionState = {
  idempotencyKey: string;
  ballotPackageCommitment: string;
  submittedAt: string;
  preparedBallotId?: string;
  preparedBallotHash?: string;
  ballotDefinitionHash?: string;
  ballotDefinitionVersion?: number;
  receiptCommitment?: string;
  receiptCommitmentScheme?: string;
};

type LocalReceipt = {
  electionId: string;
  receiptId: string;
  acceptanceId: string;
  acceptedAt: string;
  ballotPackageCommitment: string;
  serverProof: string;
  preparedBallotId?: string;
  preparedBallotHash?: string;
  ballotDefinitionHash?: string;
  ballotDefinitionVersion?: number;
  receiptCommitment?: string;
  receiptCommitmentScheme?: string;
};

type CastDraft = {
  encryptedBallotPackage: string;
  proofBundle: string;
  ballotNullifier: string;
};

type Sp04CastBinding = {
  preparedBallotId: string;
  preparedBallotHash: string;
  receiptCommitment: string;
  receiptCommitmentScheme: string;
  ballotDefinitionVersion: number;
  ballotDefinitionHash: string;
};

type Sp04PreparedPackage = {
  electionId: string;
  preparedBallotId: string;
  preparedBallotHash: string;
  optionId: string;
  optionLabel: string;
  ballotDefinitionHash: string;
  ballotDefinitionVersion: number;
  proofStatementId: string;
  precommittedAt: string;
  expiresAt: string;
  castDraft: CastDraft;
  commitmentHash: string;
  transcriptText: string;
  purpose: 'challenge' | 'final';
};

type Sp04ChallengeState = {
  status: 'not_started' | 'reset' | 'pending' | 'passed' | 'failed';
  optionId?: string;
  optionLabel?: string;
  verifiedAt?: string;
  spoiledTranscriptHash?: string;
  spoilRecordHash?: string;
  transcriptText?: string;
  reason?: string;
};

const pendingStorageKey = (electionId: string) => `feat099:pending:${electionId}`;
const receiptStorageKey = (electionId: string) => `feat099:receipt:${electionId}`;
const SP04_LOCAL_VERIFIER_VERSION = 'hushvoting-sp04-local-verifier-v1';
const SP04_RECEIPT_COMMITMENT_SCHEME = 'hushvoting-sp04-receipt-commitment-sha256-v1';
const SP04_PREPARED_PACKAGE_TTL_MS = 15 * 60 * 1000;
const sectionClass = 'rounded-3xl bg-hush-bg-element/90 px-6 py-5 shadow-lg shadow-black/10';
const insetCardClass = 'rounded-2xl bg-hush-bg-dark/72 px-5 py-4 shadow-sm shadow-black/10';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldIncludeReceiptCommitment(
  lifecycleState?: ElectionLifecycleStateProto,
): boolean {
  return (
    lifecycleState === ElectionLifecycleStateProto.Closed ||
    lifecycleState === ElectionLifecycleStateProto.Finalized
  );
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

function normalizeArtifactHash(value?: Uint8Array | string | null): string {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  return Array.from(value)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function formatCountdown(milliseconds: number): string {
  if (milliseconds <= 0) {
    return '00:00';
  }

  const totalSeconds = Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function buildSp04ProofStatementId({
  ceremonyProfileId,
  ballotDefinitionVersion,
  ballotDefinitionHash,
}: {
  ceremonyProfileId: string;
  ballotDefinitionVersion: number;
  ballotDefinitionHash: string;
}): string {
  return [
    'sp04',
    ceremonyProfileId || 'default-profile',
    `ballot-definition-v${ballotDefinitionVersion}`,
    truncateMiddle(ballotDefinitionHash, 12),
  ].join(':');
}

async function buildSp04PreparedPackageHash({
  electionId,
  ballotDefinitionHash,
  ballotDefinitionVersion,
  castDraft,
}: {
  electionId: string;
  ballotDefinitionHash: string;
  ballotDefinitionVersion: number;
  castDraft: CastDraft;
}): Promise<string> {
  const packageFingerprint = {
    version: 'sp04-prepared-ballot-hash-v1',
    electionId,
    ballotDefinitionHash,
    ballotDefinitionVersion,
    encryptedBallotPackageHash: await hashText(castDraft.encryptedBallotPackage),
    proofBundleHash: await hashText(castDraft.proofBundle),
    ballotNullifierHash: await hashText(castDraft.ballotNullifier),
  };

  return hashText(JSON.stringify(packageFingerprint));
}

function buildSp04TranscriptText(preparedPackage: Sp04PreparedPackage): string {
  return [
    'HushVoting SP-04 Spoiled Prepared Package Transcript',
    `Prepared Ballot ID: ${preparedPackage.preparedBallotId}`,
    `Prepared Ballot Hash: ${preparedPackage.preparedBallotHash}`,
    `Election ID: ${preparedPackage.electionId}`,
    `Ballot Definition Hash: ${preparedPackage.ballotDefinitionHash}`,
    `Ballot Definition Version: ${preparedPackage.ballotDefinitionVersion}`,
    `Challenged Option: ${preparedPackage.optionLabel}`,
    `Precommitted At: ${preparedPackage.precommittedAt}`,
    `Expires At: ${preparedPackage.expiresAt}`,
    '',
    'Encrypted Ballot Package:',
    preparedPackage.castDraft.encryptedBallotPackage,
    '',
    'Proof Bundle:',
    preparedPackage.castDraft.proofBundle,
    '',
    'Ballot Nullifier:',
    preparedPackage.castDraft.ballotNullifier,
  ].join('\n');
}

function getCastValidationErrors(castDraft: CastDraft, hasBoundaryContext: boolean): string[] {
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
}

function getMissingBoundaryFields(votingResponse: GetElectionVotingViewResponse | null): string[] {
  const missingFields: string[] = [];

  if (!votingResponse?.OpenArtifactId) {
    missingFields.push('OpenArtifactId');
  }
  if (!votingResponse?.EligibleSetHash) {
    missingFields.push('EligibleSetHash');
  }
  if (!votingResponse?.CeremonyVersionId) {
    missingFields.push('CeremonyVersionId');
  }
  if (!votingResponse?.DkgProfileId) {
    missingFields.push('DkgProfileId');
  }
  if (!votingResponse?.TallyPublicKeyFingerprint) {
    missingFields.push('TallyPublicKeyFingerprint');
  }

  return missingFields;
}

function logVotingBoundaryContext(
  source: 'initial-load' | 'refresh' | 'submit-blocked',
  electionId: string,
  detailResponse: GetElectionResponse | null,
  votingResponse: GetElectionVotingViewResponse | null,
): void {
  const openArtifactId = detailResponse?.Election?.OpenArtifactId || '';
  const openArtifact =
    detailResponse?.BoundaryArtifacts?.find((artifact) => artifact.Id === openArtifactId) ?? null;
  const missingFields = getMissingBoundaryFields(votingResponse);
  const detailOpenArtifactHasStoredSnapshot = Boolean(openArtifact?.CeremonySnapshot);
  const detailBoundaryArtifactCount = detailResponse?.BoundaryArtifacts?.length ?? 0;
  const boundaryContextComplete = missingFields.length === 0;

  infoLog(
    `[ElectionBoundarySummary] source=${source} electionId=${electionId} ` +
      `detailLoadSucceeded=${detailResponse?.Success ?? false} ` +
      `detailLifecycleState=${detailResponse?.Election?.LifecycleState ?? 'null'} ` +
      `detailOpenArtifactId=${openArtifactId || 'null'} ` +
      `detailOpenArtifactHasStoredSnapshot=${detailOpenArtifactHasStoredSnapshot} ` +
      `detailBoundaryArtifactCount=${detailBoundaryArtifactCount} ` +
      `votingViewSucceeded=${votingResponse?.Success ?? false} ` +
      `votingOpenArtifactId=${votingResponse?.OpenArtifactId || 'null'} ` +
      `votingEligibleSetHashPresent=${Boolean(votingResponse?.EligibleSetHash)} ` +
      `votingCeremonyVersionIdPresent=${Boolean(votingResponse?.CeremonyVersionId)} ` +
      `votingDkgProfileIdPresent=${Boolean(votingResponse?.DkgProfileId)} ` +
      `votingTallyPublicKeyFingerprintPresent=${Boolean(votingResponse?.TallyPublicKeyFingerprint)} ` +
      `boundaryContextComplete=${boundaryContextComplete} ` +
      `missingFields=${missingFields.join('|') || 'none'}`,
  );

  infoLog('[ElectionBoundary]', {
    source,
    electionId,
    detailLoadSucceeded: detailResponse?.Success ?? false,
    detailLifecycleState: detailResponse?.Election?.LifecycleState ?? null,
    detailOpenArtifactId: openArtifactId || null,
    detailOpenArtifactHasStoredSnapshot,
    detailBoundaryArtifactCount,
    votingViewSucceeded: votingResponse?.Success ?? false,
    votingOpenArtifactId: votingResponse?.OpenArtifactId || null,
    votingEligibleSetHashPresent: Boolean(votingResponse?.EligibleSetHash),
    votingCeremonyVersionIdPresent: Boolean(votingResponse?.CeremonyVersionId),
    votingDkgProfileIdPresent: Boolean(votingResponse?.DkgProfileId),
    votingTallyPublicKeyFingerprintPresent: Boolean(votingResponse?.TallyPublicKeyFingerprint),
    boundaryContextComplete,
    missingFields,
  });
}

async function buildElectionDevModeArtifacts({
  electionId,
  selectedOption,
  openArtifactId,
  eligibleSetHash,
  ceremonyVersionId,
  dkgProfileId,
  tallyPublicKeyFingerprint,
}: {
  electionId: string;
  selectedOption: {
    OptionId: string;
    DisplayLabel: string;
    ShortDescription?: string;
    BallotOrder: number;
    IsBlankOption?: boolean;
  };
  openArtifactId: string;
  eligibleSetHash: string;
  ceremonyVersionId: string;
  dkgProfileId: string;
  tallyPublicKeyFingerprint: string;
}): Promise<CastDraft & { commitmentHash: string }> {
  const devArtifactSeed = generateGuid();
  const commitmentHash = await hashText(
    `election-dev-commitment:v2:${electionId}:${devArtifactSeed}:commitment`,
  );
  const ballotNullifier = await hashText(
    `election-dev-nullifier:v2:${electionId}:${devArtifactSeed}:nullifier`,
  );
  const selectionFingerprint = await hashText(
    `election-dev-selection:v1:${electionId}:${selectedOption.OptionId}:${selectedOption.DisplayLabel}`,
  );
  const ballotPackage = JSON.stringify({
    mode: 'election-dev-mode-v1',
    packageType: 'dev-protected-ballot',
    electionId,
    optionId: selectedOption.OptionId,
    optionLabel: selectedOption.DisplayLabel,
    optionDescription: selectedOption.ShortDescription || '',
    ballotOrder: selectedOption.BallotOrder,
    isBlankOption: selectedOption.IsBlankOption ?? false,
    selectionFingerprint,
  });
  const ballotPackageHash = await hashText(ballotPackage);

  return {
    commitmentHash,
    encryptedBallotPackage: ballotPackage,
    proofBundle: JSON.stringify({
      mode: 'election-dev-mode-v1',
      proofType: 'dev-election-proof',
      electionId,
      optionId: selectedOption.OptionId,
      ballotPackageHash,
      openArtifactId,
      eligibleSetHash,
      ceremonyVersionId,
      dkgProfileId,
      tallyPublicKeyFingerprint,
    }),
    ballotNullifier,
  };
}

async function deriveControlledScalarSeed(...parts: string[]): Promise<bigint> {
  const digest = await hashText(parts.join(':'));
  return BigInt(`0x${digest || '1'}`);
}

function grpcPointToElectionPoint(point: { X?: string; Y?: string } | null | undefined): Point {
  if (!point?.X || !point?.Y) {
    throw new Error('The ceremony tally public key is missing from the voting boundary context.');
  }

  return {
    x: bytesToBigint(base64ToBytes(point.X)),
    y: bytesToBigint(base64ToBytes(point.Y)),
  };
}

function resolveCircuitVersionForDkgProfile(dkgProfileId: string): string {
  return dkgProfileId.toLowerCase().includes('dev')
    ? FEAT107_CIRCUIT_VERSION_BY_PROFILE.DEV_SMOKE_PROFILE
    : FEAT107_CIRCUIT_VERSION_BY_PROFILE.PRODUCTION_LIKE_PROFILE;
}

function resolveProofProfileForDkgProfile(dkgProfileId: string): string {
  return dkgProfileId.toLowerCase().includes('dev')
    ? FEAT107_PROOF_PROFILES.DEV_SMOKE_PROFILE
    : FEAT107_PROOF_PROFILES.PRODUCTION_LIKE_PROFILE;
}

async function buildBindingProtectedBallotArtifacts({
  electionId,
  selectedOption,
  selectedOptionIndex,
  selectionCount,
  openArtifactId,
  eligibleSetHash,
  ceremonyVersionId,
  dkgProfileId,
  tallyPublicKey,
  tallyPublicKeyFingerprint,
}: {
  electionId: string;
  selectedOption: {
    OptionId: string;
    DisplayLabel: string;
  };
  selectedOptionIndex: number;
  selectionCount: number;
  openArtifactId: string;
  eligibleSetHash: string;
  ceremonyVersionId: string;
  dkgProfileId: string;
  tallyPublicKey: Point;
  tallyPublicKeyFingerprint: string;
}): Promise<CastDraft & { commitmentHash: string }> {
  const artifactSeed = generateGuid();
  const profileId = dkgProfileId;
  const proofProfile = resolveProofProfileForDkgProfile(dkgProfileId);
  const circuitVersion = resolveCircuitVersionForDkgProfile(dkgProfileId);
  const { ciphertext } = encryptOneHotElectionBallot(selectedOptionIndex, tallyPublicKey, {
    nonceSeed: await deriveControlledScalarSeed(
      'feat105-binding-ballot-nonces-v1',
      electionId,
      selectedOption.OptionId,
      artifactSeed,
      openArtifactId,
      ceremonyVersionId,
      dkgProfileId,
    ),
    selectionCount,
  });

  const encryptedBallotPackage = JSON.stringify({
    version: 'omega-binding-ballot-v1',
    packageType: 'binding-protected-ballot',
    electionId,
    profileId,
    circuitVersion,
    publicKey: serializePoint(tallyPublicKey),
    selectionCount,
    ciphertext: serializeVectorCiphertext(ciphertext),
  });
  const ballotPackageHash = await hashText(encryptedBallotPackage);

  return {
    commitmentHash: await hashText(
      [
        'feat105-binding-commitment-v1',
        electionId,
        openArtifactId,
        ceremonyVersionId,
        artifactSeed,
        ballotPackageHash,
      ].join(':'),
    ),
    encryptedBallotPackage,
    proofBundle: JSON.stringify({
      version: 'omega-binding-proof-v1',
      proofType: 'binding-circuit-envelope',
      proofProfile,
      circuitVersion,
      artifactShape: 'opaque-one-hot-elgamal',
      ballotPackageHash,
      openArtifactId,
      eligibleSetHash,
      ceremonyVersionId,
      dkgProfileId,
      tallyPublicKeyFingerprint,
    }),
    ballotNullifier: await hashText(
      [
        'feat105-binding-nullifier-v1',
        electionId,
        openArtifactId,
        artifactSeed,
        ballotPackageHash,
      ].join(':'),
    ),
  };
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

  const storageKey = receiptStorageKey(electionId);
  const rawValue =
    window.localStorage.getItem(storageKey) ?? window.sessionStorage.getItem(storageKey);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as LocalReceipt;
    window.localStorage.setItem(storageKey, JSON.stringify(parsed));
    window.sessionStorage.removeItem(storageKey);
    return parsed;
  } catch {
    window.localStorage.removeItem(storageKey);
    window.sessionStorage.removeItem(storageKey);
    return null;
  }
}

function saveLocalReceipt(electionId: string, receipt: LocalReceipt): void {
  if (typeof window !== 'undefined') {
    const storageKey = receiptStorageKey(electionId);
    window.localStorage.setItem(storageKey, JSON.stringify(receipt));
    window.sessionStorage.removeItem(storageKey);
  }
}

function buildReceiptText(
  receipt: LocalReceipt,
  lifecycleState?: ElectionLifecycleStateProto,
): string {
  const lines = [
    'Accepted Ballot Receipt',
    `Election ID: ${receipt.electionId}`,
    `Receipt ID: ${receipt.receiptId}`,
    `Acceptance ID: ${receipt.acceptanceId}`,
    `Accepted At: ${receipt.acceptedAt}`,
    `Server Proof: ${receipt.serverProof}`,
  ];

  if (shouldIncludeReceiptCommitment(lifecycleState)) {
    lines.splice(
      5,
      0,
      `Ballot Package Commitment: ${receipt.ballotPackageCommitment || '(not retained on this device)'}`,
    );
  }

  if (receipt.ballotDefinitionHash) {
    lines.push(`Ballot Definition Hash: ${receipt.ballotDefinitionHash}`);
  }
  if (receipt.ballotDefinitionVersion !== undefined) {
    lines.push(`Ballot Definition Version: ${receipt.ballotDefinitionVersion}`);
  }
  if (receipt.preparedBallotId) {
    lines.push(`Prepared Ballot ID: ${receipt.preparedBallotId}`);
  }
  if (receipt.preparedBallotHash) {
    lines.push(`Prepared Ballot Hash: ${receipt.preparedBallotHash}`);
  }
  if (receipt.receiptCommitment) {
    lines.push(`Receipt Commitment: ${receipt.receiptCommitment}`);
  }
  if (receipt.receiptCommitmentScheme) {
    lines.push(`Receipt Commitment Scheme: ${receipt.receiptCommitmentScheme}`);
  }

  return lines.join('\n');
}

function createReceiptFromVotingView(
  electionId: string,
  votingView: GetElectionVotingViewResponse,
  pendingSubmission: PendingSubmissionState | null,
  existingReceipt: LocalReceipt | null,
): LocalReceipt | null {
  if (
    !votingView.HasAcceptedAt ||
    !votingView.AcceptanceId ||
    !votingView.ReceiptId ||
    !votingView.ServerProof
  ) {
    return null;
  }

  return {
    electionId,
    receiptId: votingView.ReceiptId,
    acceptanceId: votingView.AcceptanceId,
    acceptedAt: formatTimestamp(votingView.AcceptedAt),
    ballotPackageCommitment:
      pendingSubmission?.ballotPackageCommitment ??
      existingReceipt?.ballotPackageCommitment ??
      '',
    serverProof: votingView.ServerProof,
    preparedBallotId:
      votingView.PreparedBallotId || pendingSubmission?.preparedBallotId || existingReceipt?.preparedBallotId,
    preparedBallotHash:
      votingView.PreparedBallotHash || pendingSubmission?.preparedBallotHash || existingReceipt?.preparedBallotHash,
    ballotDefinitionHash:
      normalizeArtifactHash(votingView.BallotDefinitionHash) ||
      pendingSubmission?.ballotDefinitionHash ||
      existingReceipt?.ballotDefinitionHash,
    ballotDefinitionVersion:
      votingView.BallotDefinitionVersion ||
      pendingSubmission?.ballotDefinitionVersion ||
      existingReceipt?.ballotDefinitionVersion,
    receiptCommitment:
      votingView.ReceiptCommitment ||
      pendingSubmission?.receiptCommitment ||
      existingReceipt?.receiptCommitment,
    receiptCommitmentScheme:
      votingView.ReceiptCommitmentScheme ||
      pendingSubmission?.receiptCommitmentScheme ||
      existingReceipt?.receiptCommitmentScheme,
  };
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

function buildReceiptVerificationFeedback({
  localReceipt,
  votingView,
  lifecycleState,
  resultView,
}: {
  localReceipt: LocalReceipt;
  votingView: GetElectionVotingViewResponse;
  lifecycleState?: ElectionLifecycleStateProto;
  resultView: GetElectionResultViewResponse | null;
}): ReceiptVerificationFeedback {
  const verifiedAt = new Date().toLocaleString();
  const receiptMatches =
    votingView.HasAcceptedAt &&
    votingView.ReceiptId === localReceipt.receiptId &&
    votingView.AcceptanceId === localReceipt.acceptanceId &&
    votingView.ServerProof === localReceipt.serverProof;
  const localReceiptCommitment = localReceipt.receiptCommitment?.trim() ?? '';
  const votingReceiptCommitment = votingView.ReceiptCommitment?.trim() ?? '';
  const hasBoundReceipt = Boolean(localReceiptCommitment || votingReceiptCommitment);
  const boundReceiptMatches =
    !hasBoundReceipt ||
    Boolean(localReceiptCommitment && votingReceiptCommitment && localReceiptCommitment === votingReceiptCommitment);

  if (!receiptMatches || !boundReceiptMatches) {
    return {
      tone: 'error',
      title: boundReceiptMatches
        ? 'This receipt does not match this voter'
        : 'This bound receipt does not match this voter',
      detail:
        boundReceiptMatches
          ? 'The stored receipt on this device does not match the current vote record for this voter.'
          : 'The stored receipt commitment on this device does not match the current accepted vote record for this voter.',
      verifiedAt,
    };
  }

  const isCounted =
    votingView.PersonalParticipationStatus ===
    ElectionParticipationStatusProto.ParticipationCountedAsVoted;
  const finalCountStatusItem = buildCountedSetStatusItem({
    lifecycleState,
    hasOfficialResult: Boolean(resultView?.OfficialResult),
    isCounted,
  });

  if (isCounted) {
    return {
      tone: 'success',
      title: 'This voter is marked as voted',
      detail: finalCountStatusItem.complete
        ? 'This receipt matches the current vote record for this voter, and that accepted vote is included in the finalized counted set for this election.'
        : 'This receipt matches the current vote record for this voter in this election.',
      verifiedAt,
      statusItems: [
        {
          label: 'This voter is marked as voted in this election.',
          complete: true,
        },
        ...(hasBoundReceipt
          ? [
              {
                label: 'The bound receipt commitment matches the accepted vote record.',
                complete: true,
              },
            ]
          : []),
        finalCountStatusItem,
      ],
    };
  }

  return {
    tone: 'warning',
    title: 'Receipt matches this voter',
    detail:
      'This receipt matches this voter, but the election is not showing the voter as marked as voted yet.',
    verifiedAt,
    statusItems: [
      {
        label: 'This voter is marked as voted in this election.',
        complete: false,
      },
      ...(hasBoundReceipt
        ? [
            {
              label: 'The bound receipt commitment matches the accepted vote record.',
              complete: true,
            },
          ]
        : []),
      finalCountStatusItem,
    ],
  };
}

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

function SummaryValueCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className={`${insetCardClass} flex min-h-[128px] flex-col justify-between`}>
      <div className="text-xs uppercase tracking-[0.2em] text-hush-text-accent">{label}</div>
      <div className="mt-6 text-2xl font-semibold leading-tight text-hush-text-primary">{value}</div>
    </div>
  );
}

function WorkflowStatusCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className={`${insetCardClass} flex min-h-[108px] flex-col justify-between`}>
      <div className="text-xs uppercase tracking-[0.2em] text-hush-text-accent">{label}</div>
      <div className="mt-4 text-lg font-semibold leading-snug text-hush-text-primary">{value}</div>
    </div>
  );
}

function PreparedPackageTimer({
  expiresAt,
  nowMs,
}: {
  expiresAt?: string;
  nowMs: number;
}) {
  const expiresAtMs = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  const remainingMs = Number.isFinite(expiresAtMs) ? expiresAtMs - nowMs : 0;
  const isExpired = remainingMs <= 0;

  return (
    <div
      className={`rounded-2xl px-4 py-3 text-sm ${
        isExpired
          ? 'bg-red-500/12 text-red-100'
          : 'bg-cyan-500/12 text-cyan-100'
      }`}
      role="status"
      aria-live="polite"
      data-testid="voting-sp04-prepared-timer"
    >
      <div className="flex items-center gap-2 font-semibold">
        <Clock3 className="h-4 w-4" />
        <span>{isExpired ? 'Prepared package expired' : 'Prepared package timer'}</span>
      </div>
      <div className="mt-2 font-mono text-lg tabular-nums">
        {isExpired ? '00:00' : formatCountdown(remainingMs)}
      </div>
    </div>
  );
}

function ChallengeVerificationSummary({
  challenge,
  currentOptionId,
}: {
  challenge: Sp04ChallengeState;
  currentOptionId: string;
}) {
  const challengeIsCurrent = challenge.status === 'passed' && challenge.optionId === currentOptionId;
  const isFailure = challenge.status === 'failed';
  const isReset = challenge.status === 'reset' || (
    challenge.status === 'passed' &&
    Boolean(currentOptionId) &&
    challenge.optionId !== currentOptionId
  );
  const className = challengeIsCurrent
    ? 'bg-green-500/12 text-green-100'
    : isFailure
      ? 'bg-red-500/12 text-red-100'
      : isReset
        ? 'bg-amber-500/12 text-amber-100'
        : 'bg-hush-bg-dark/70 text-hush-text-accent';
  const title = challengeIsCurrent
    ? 'Challenge verification passed'
    : isFailure
      ? 'Challenge verification failed'
      : isReset
        ? 'Challenge reset'
        : 'Challenge required';
  const detail = challengeIsCurrent
    ? 'The challenged package opened to the current selection. Final cast will use a fresh prepared package.'
    : isFailure
      ? challenge.reason || 'Local challenge verification failed for this prepared package.'
      : isReset
        ? 'The previous challenge was for another selection. Run a new challenge for the current selection.'
        : 'Final cast stays blocked until the current selected option has passed local challenge verification.';

  return (
    <div
      className={`rounded-2xl px-4 py-4 text-sm ${className}`}
      role="status"
      aria-live="polite"
      data-testid="voting-sp04-challenge-summary"
    >
      <div className="flex items-center gap-2 font-semibold">
        {challengeIsCurrent ? <CheckCircle2 className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
        <span>{title}</span>
      </div>
      <div className="mt-2 leading-6">{detail}</div>
      {challenge.spoiledTranscriptHash ? (
        <div className="mt-3 font-mono text-xs">
          Spoiled transcript hash: {truncateMiddle(challenge.spoiledTranscriptHash)}
        </div>
      ) : null}
    </div>
  );
}

function getVotingIntroCopy({
  lifecycleState,
  associatedNumber,
  isLinked,
  isActiveVoter,
}: {
  lifecycleState?: ElectionLifecycleStateProto;
  associatedNumber: string | null;
  isLinked: boolean;
  isActiveVoter: boolean;
}): string {
  const linkedIdentityCopy = associatedNumber
    ? `Associated number ${associatedNumber} is linked to this Hush account.`
    : isLinked
      ? 'A voter identity is linked to this Hush account.'
      : 'This Hush account is not linked to an associated number yet.';

  switch (lifecycleState) {
    case ElectionLifecycleStateProto.Draft:
      return `${linkedIdentityCopy} This election is still being prepared, so voting is not available yet. When it opens, this screen will show the steps to cast the vote.`;
    case ElectionLifecycleStateProto.Open:
      if (isLinked && isActiveVoter) {
        return `${linkedIdentityCopy} This election is open and this voter record is active. Choose your ballot option here, then continue with the protected ballot steps below.`;
      }

      return `${linkedIdentityCopy} This election is open, but this voter record is not ready to cast a vote yet. Review the voter status below to see what is missing.`;
    case ElectionLifecycleStateProto.Closed:
      return `${linkedIdentityCopy} Voting is closed for this election. This screen now shows the final voter status and any information still available to this voter.`;
    case ElectionLifecycleStateProto.Finalized:
      return `${linkedIdentityCopy} This election is finalized. This screen now shows the final voter status and any result or receipt information available to this voter.`;
    default:
      return `${linkedIdentityCopy} This screen shows the current voter status for the selected election.`;
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
  const [resultView, setResultView] = useState<GetElectionResultViewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingCommitment, setIsSubmittingCommitment] = useState(false);
  const [isSubmittingCast, setIsSubmittingCast] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [feedback, setFeedback] = useState<VotingFeedback | null>(null);
  const [pendingSubmission, setPendingSubmission] = useState<PendingSubmissionState | null>(null);
  const [localReceipt, setLocalReceipt] = useState<LocalReceipt | null>(null);
  const [receiptVerification, setReceiptVerification] =
    useState<ReceiptVerificationFeedback | null>(null);
  const [castFailure, setCastFailure] = useState<string | null>(null);
  const [selectedBallotOptionId, setSelectedBallotOptionId] = useState('');
  const [isVerifyingReceipt, setIsVerifyingReceipt] = useState(false);
  const [sp04PreparedPackage, setSp04PreparedPackage] = useState<Sp04PreparedPackage | null>(null);
  const [sp04Challenge, setSp04Challenge] = useState<Sp04ChallengeState>({
    status: 'not_started',
  });
  const [isPreparingSp04Package, setIsPreparingSp04Package] = useState(false);
  const [isSpoilingSp04Package, setIsSpoilingSp04Package] = useState(false);
  const [sp04NowMs, setSp04NowMs] = useState(() => Date.now());

  useEffect(() => {
    setPendingSubmission(loadPendingSubmission(electionId));
    setLocalReceipt(loadLocalReceipt(electionId));
  }, [electionId]);

  useEffect(() => {
    setReceiptVerification(null);
  }, [electionId, localReceipt?.receiptId, localReceipt?.acceptanceId, localReceipt?.serverProof]);

  useEffect(() => {
    if (!receiptVerification) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setReceiptVerification(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [receiptVerification]);

  useEffect(() => {
    if (!sp04PreparedPackage) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setSp04NowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [sp04PreparedPackage]);

  async function refreshContext(submissionIdempotencyKey?: string): Promise<GetElectionVotingViewResponse> {
    const storedPending = loadPendingSubmission(electionId);
    const resolvedKey =
      submissionIdempotencyKey ?? storedPending?.idempotencyKey ?? pendingSubmission?.idempotencyKey ?? '';
    const [detailResponse, votingResponse, resultResponse] = await Promise.all([
      electionsService.getElection({ ElectionId: electionId }),
      electionsService.getElectionVotingView({
        ElectionId: electionId,
        ActorPublicAddress: actorPublicAddress,
        SubmissionIdempotencyKey: resolvedKey,
      }),
      loadElectionResultViewSafely(electionId, actorPublicAddress),
    ]);

    setDetail(detailResponse);
    setVotingView(votingResponse);
    setResultView(resultResponse);
    logVotingBoundaryContext('refresh', electionId, detailResponse, votingResponse);

    if (votingResponse.Success && votingResponse.HasAcceptedAt) {
      const existingReceipt = loadLocalReceipt(electionId);
      const createdReceipt = createReceiptFromVotingView(
        electionId,
        votingResponse,
        storedPending ?? pendingSubmission,
        existingReceipt,
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
        const [detailResponse, votingResponse, resultResponse] = await Promise.all([
          electionsService.getElection({ ElectionId: electionId }),
          electionsService.getElectionVotingView({
            ElectionId: electionId,
            ActorPublicAddress: actorPublicAddress,
            SubmissionIdempotencyKey: resolvedKey,
          }),
          loadElectionResultViewSafely(electionId, actorPublicAddress),
        ]);

        if (!isActive) {
          return;
        }

        setDetail(detailResponse);
        setVotingView(votingResponse);
        setResultView(resultResponse);
        logVotingBoundaryContext('initial-load', electionId, detailResponse, votingResponse);

        if (votingResponse.Success && votingResponse.HasAcceptedAt) {
          const existingReceipt = loadLocalReceipt(electionId);
          const createdReceipt = createReceiptFromVotingView(
            electionId,
            votingResponse,
            storedPending,
            existingReceipt,
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
  const hasVotingAccess = votingView?.Success === true;
  const selfRosterEntry = votingView?.SelfRosterEntry;
  const isOpenElection = election?.LifecycleState === ElectionLifecycleStateProto.Open;
  const hasResultArtifacts = Boolean(resultView?.UnofficialResult || resultView?.OfficialResult);
  const isLinked = !!selfRosterEntry;
  const associatedNumber = selfRosterEntry?.OrganizationVoterId?.trim() || null;
  const isActiveVoter =
    selfRosterEntry?.VotingRightStatus === ElectionVotingRightStatusProto.VotingRightActive;
  const isCommitmentRegistered = votingView?.CommitmentRegistered ?? false;
  const hasAcceptedReceipt = votingView?.HasAcceptedAt === true;
  const isAccepted = hasAcceptedReceipt;
  const isSp04Required = votingView?.Sp04Required === true;
  const ballotDefinitionHash = normalizeArtifactHash(votingView?.BallotDefinitionHash);
  const ballotDefinitionVersion = votingView?.BallotDefinitionVersion ?? 0;
  const isBallotDefinitionSealed =
    !isSp04Required ||
    Boolean(votingView?.HasBallotDefinitionSealedAt && ballotDefinitionHash);
  const ceremonyProfileId =
    votingView?.CeremonyProfileId?.trim() ||
    votingView?.DkgProfileId?.trim() ||
    election?.SelectedProfileId?.trim() ||
    '';
  const actionableReceipt = useMemo(
    () =>
      votingView?.HasAcceptedAt
        ? createReceiptFromVotingView(electionId, votingView, pendingSubmission, localReceipt)
        : null,
    [electionId, localReceipt, pendingSubmission, votingView],
  );
  const hasRetainedBallotCommitment = Boolean(actionableReceipt?.ballotPackageCommitment);
  const shouldShowReceiptCommitment = shouldIncludeReceiptCommitment(
    election?.LifecycleState,
  );
  const hasBoundaryContext = !!(
    votingView?.OpenArtifactId &&
    votingView?.EligibleSetHash &&
    votingView?.CeremonyVersionId &&
    votingView?.DkgProfileId &&
    votingView?.TallyPublicKeyFingerprint
  );
  const bindingStatus =
    election?.BindingStatus ?? votingView?.Election?.BindingStatus ?? ElectionBindingStatusProto.Binding;
  const activeProfileId =
    votingView?.DkgProfileId ??
    resultView?.CeremonySnapshot?.ProfileId ??
    election?.SelectedProfileId;
  const selectedProfileDevOnly =
    election?.SelectedProfileDevOnly ??
    detail?.LatestDraftSnapshot?.Policy.SelectedProfileDevOnly ??
    detail?.CeremonyProfiles?.find((profile) => profile.ProfileId === activeProfileId)?.DevOnly;
  const receiptContextProfileId =
    resultView?.CeremonySnapshot?.ProfileId ?? votingView?.DkgProfileId;
  const receiptContextTallyKeyFingerprint =
    resultView?.CeremonySnapshot?.TallyPublicKeyFingerprint ??
    votingView?.TallyPublicKeyFingerprint;
  const receiptContextOfficialVisibility =
    resultView?.OfficialResultVisibilityPolicy ?? election?.OfficialResultVisibilityPolicy;
  const usesOpenAuditBallotPath = selectedProfileDevOnly === true;
  const ballotOptions = useMemo(
    () =>
      (election?.Options ?? [])
        .slice()
        .sort((left, right) => left.BallotOrder - right.BallotOrder)
        .map((option) => ({
          ...option,
          DisplayLabel:
            option.DisplayLabel?.trim() ||
            (option.IsBlankOption ? 'Blank vote' : `Option ${option.BallotOrder}`),
          ShortDescription: option.ShortDescription?.trim() || '',
        })),
    [election?.Options],
  );
  const selectedBallotOption = useMemo(
    () =>
      ballotOptions.find((option) => option.OptionId === selectedBallotOptionId) ?? null,
    [ballotOptions, selectedBallotOptionId],
  );
  const effectiveParticipationStatus = hasAcceptedReceipt
    ? ElectionParticipationStatusProto.ParticipationCountedAsVoted
    : votingView?.PersonalParticipationStatus ??
      ElectionParticipationStatusProto.ParticipationDidNotVote;
  const participationLabel = getParticipationLabel(
    effectiveParticipationStatus,
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
  const shouldExpandSnapshotByDefault =
    !hasResultArtifacts && (isOpenElection || !!pendingSubmission || isAccepted);
  const [isSnapshotExpanded, setIsSnapshotExpanded] = useState(shouldExpandSnapshotByDefault);
  const shouldExpandAcceptedPanelByDefault = isAccepted && !hasResultArtifacts;
  const [acceptedPanelExpansionOverride, setAcceptedPanelExpansionOverride] = useState<
    boolean | null
  >(null);
  const isAcceptedPanelExpanded =
    acceptedPanelExpansionOverride ?? shouldExpandAcceptedPanelByDefault;
  const hasAdvancedBoundaryContext = Boolean(
    isOpenElection &&
      (votingView?.OpenArtifactId || votingView?.EligibleSetHash || votingView?.TallyPublicKeyFingerprint),
  );
  const shouldShowAdvancedContext = hasAdvancedBoundaryContext || !!pendingSubmission;
  const [isAdvancedContextExpanded, setIsAdvancedContextExpanded] = useState(
    !hasResultArtifacts && (isCommitmentRegistered || !!pendingSubmission),
  );
  const isSubmissionInFlight = isSubmittingCommitment || isSubmittingCast;
  const showBallotWorkflow =
    hasVotingAccess &&
    isOpenElection &&
    isLinked &&
    isActiveVoter &&
    !isAccepted &&
    !pendingSubmission &&
    !isSubmissionInFlight;
  const commitmentStatusValue = isCommitmentRegistered
    ? 'Registered'
    : usesOpenAuditBallotPath
      ? 'Created during submit'
      : 'Created by protected circuit';
  const finalSubmitStatusValue = pendingSubmission
    ? 'Pending chain check'
    : isSp04Required
      ? sp04Challenge.status === 'passed' && sp04Challenge.optionId === selectedBallotOptionId
        ? 'Challenge passed'
        : 'Challenge required'
      : selectedBallotOption
        ? 'Ready to submit'
        : 'Choose an option first';
  const sp04PreparedPackageExpired = Boolean(
    sp04PreparedPackage && Date.parse(sp04PreparedPackage.expiresAt) <= sp04NowMs,
  );
  const sp04ChallengePassedForCurrentSelection =
    !isSp04Required ||
    Boolean(
      selectedBallotOptionId &&
        sp04Challenge.status === 'passed' &&
        sp04Challenge.optionId === selectedBallotOptionId,
    );
  const sp04CastBlocker = useMemo(() => {
    if (!isSp04Required) {
      return '';
    }

    if (!isBallotDefinitionSealed) {
      return votingView?.Sp04BlockerMessage || 'Ballot definition is not sealed for this election.';
    }

    if (!selectedBallotOptionId) {
      return 'Choose an option first.';
    }

    if (sp04Challenge.status === 'failed') {
      return sp04Challenge.reason || 'Local challenge verification failed.';
    }

    if (!sp04ChallengePassedForCurrentSelection) {
      return votingView?.Sp04BlockerMessage || 'Challenge required for current selection.';
    }

    return '';
  }, [
    isBallotDefinitionSealed,
    isSp04Required,
    selectedBallotOptionId,
    sp04Challenge.reason,
    sp04Challenge.status,
    sp04ChallengePassedForCurrentSelection,
    votingView?.Sp04BlockerMessage,
  ]);
  const submitButtonDisabled =
    !selectedBallotOption ||
    !!pendingSubmission ||
    isSubmittingCommitment ||
    isSubmittingCast ||
    isPreparingSp04Package ||
    isSpoilingSp04Package ||
    Boolean(sp04CastBlocker);
  const shouldShowSubmissionPrivacyPanel =
    (isSubmissionInFlight || !!pendingSubmission) && !isAccepted;
  const submissionPrivacyStatus = isSubmittingCommitment
    ? usesOpenAuditBallotPath
      ? 'Preparing open-audit ballot'
      : 'Preparing protected ballot'
    : isSubmittingCast
      ? 'Waiting for acceptance receipt'
      : submissionStatusLabel;
  const ballotTransportLabel = usesOpenAuditBallotPath
    ? 'Open-audit ballot'
    : bindingStatus === ElectionBindingStatusProto.NonBinding
      ? 'Protected ballot on non-binding election'
      : 'Protected ballot';
  const votePreparationCopy = usesOpenAuditBallotPath
    ? 'Choosing a ballot option here prepares a local preview. Submit vote will record the explicit open-ballot audit artifact for this selected open-audit circuit.'
    : bindingStatus === ElectionBindingStatusProto.NonBinding
      ? 'Choosing a ballot option here prepares a local preview. This non-binding election still uses a protected non-dev circuit, so submit vote will generate the protected ballot package and opaque proof envelope on this device.'
      : 'Choosing a ballot option here prepares a local preview. Submit vote will generate the protected ballot package and opaque proof envelope on this device.';
  const submitPanelTitle = isSp04Required
    ? 'Challenge-gated final cast'
    : usesOpenAuditBallotPath
      ? 'Submit vote will record an open-audit ballot'
      : 'Protected submit is ready on this device';
  const submitPanelBody = isSp04Required
    ? sp04CastBlocker || 'The current selection has passed challenge verification. Final cast will prepare a fresh bound package.'
    : usesOpenAuditBallotPath
      ? 'This election keeps the canonical workflow but uses the selected open-audit circuit. The recorded artifact stays intentionally readable for audit and customer review.'
      : bindingStatus === ElectionBindingStatusProto.NonBinding
        ? 'This non-binding election still freezes the same lifecycle and audit boundaries, but the selected circuit is protected and keeps ballot content opaque on persisted surfaces.'
        : 'The raw manual commitment and proof fields stay hidden from voters. Submit vote now sends an opaque ballot package and proof envelope instead of the old plaintext binding artifact.';
  const submitPanelClass = isSp04Required
    ? sp04CastBlocker
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
      : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
    : usesOpenAuditBallotPath
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
      : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100';
  const submitPanelBodyClass = isSp04Required
    ? sp04CastBlocker
      ? 'text-amber-100/90'
      : 'text-emerald-100/90'
    : usesOpenAuditBallotPath
      ? 'text-amber-100/90'
      : 'text-emerald-100/90';

  useEffect(() => {
    if (shouldExpandSnapshotByDefault) {
      setIsSnapshotExpanded(true);
    }
  }, [shouldExpandSnapshotByDefault]);

  useEffect(() => {
    if ((isCommitmentRegistered || pendingSubmission) && !hasResultArtifacts) {
      setIsAdvancedContextExpanded(true);
    }
  }, [hasResultArtifacts, isCommitmentRegistered, pendingSubmission]);

  useEffect(() => {
    if (hasResultArtifacts) {
      setAcceptedPanelExpansionOverride(false);
      setIsSnapshotExpanded(false);
      setIsAdvancedContextExpanded(false);
    }
  }, [hasResultArtifacts]);

  useEffect(() => {
    setSelectedBallotOptionId('');
    setSp04PreparedPackage(null);
    setSp04Challenge({ status: 'not_started' });
    setAcceptedPanelExpansionOverride(null);
  }, [electionId]);

  useEffect(() => {
    if (!isAccepted) {
      setAcceptedPanelExpansionOverride(null);
    }
  }, [isAccepted]);

  useEffect(() => {
    if (
      selectedBallotOptionId &&
      !ballotOptions.some((option) => option.OptionId === selectedBallotOptionId)
    ) {
      setSelectedBallotOptionId('');
    }
  }, [ballotOptions, selectedBallotOptionId]);

  function handleSelectBallotOption(optionId: string): void {
    if (optionId === selectedBallotOptionId) {
      return;
    }

    const nextOption = ballotOptions.find((option) => option.OptionId === optionId);
    setSelectedBallotOptionId(optionId);

    if (!isSp04Required) {
      return;
    }

    setSp04PreparedPackage(null);
    if (sp04Challenge.status === 'passed' || sp04Challenge.status === 'failed') {
      setSp04Challenge({
        status: 'reset',
        optionId,
        optionLabel: nextOption?.DisplayLabel,
        reason: 'Selection changed after the previous challenge.',
      });
    } else if (sp04Challenge.status !== 'not_started') {
      setSp04Challenge({ status: 'not_started' });
    }
  }

  async function submitCommitmentHash(
    nextCommitmentHash: string,
    options?: {
      showSuccessFeedback?: boolean;
      successMessage?: string;
    },
  ): Promise<boolean> {
    const normalizedCommitmentHash = nextCommitmentHash.trim();
    if (!normalizedCommitmentHash) {
      setFeedback({ tone: 'error', message: 'Enter a commitment hash before registering.' });
      return false;
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
        normalizedCommitmentHash,
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

      if (options?.showSuccessFeedback !== false) {
        setFeedback({
          tone: 'success',
          message:
            options?.successMessage ||
            'Voting commitment registered. This step does not mean you have already voted.',
        });
      }
      return true;
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error ? error.message : 'Voting commitment registration failed.',
      });
      return false;
    } finally {
      setIsSubmittingCommitment(false);
    }
  }

  async function buildSelectedCastArtifacts(): Promise<{
    castDraft: CastDraft;
    commitmentHash: string;
  }> {
    if (!selectedBallotOption) {
      throw new Error('Choose a ballot option before preparing the vote.');
    }

    if (!votingView || !hasBoundaryContext) {
      logVotingBoundaryContext('submit-blocked', electionId, detail, votingView);
      throw new Error('The election boundary context is incomplete.');
    }

    if (usesOpenAuditBallotPath) {
      const openBallotArtifacts = await buildElectionDevModeArtifacts({
        electionId,
        selectedOption: selectedBallotOption,
        openArtifactId: votingView.OpenArtifactId,
        eligibleSetHash: votingView.EligibleSetHash,
        ceremonyVersionId: votingView.CeremonyVersionId,
        dkgProfileId: votingView.DkgProfileId,
        tallyPublicKeyFingerprint: votingView.TallyPublicKeyFingerprint,
      });

      return {
        castDraft: {
          encryptedBallotPackage: openBallotArtifacts.encryptedBallotPackage,
          proofBundle: openBallotArtifacts.proofBundle,
          ballotNullifier: openBallotArtifacts.ballotNullifier,
        },
        commitmentHash: openBallotArtifacts.commitmentHash,
      };
    }

    const selectedOptionIndex = ballotOptions.findIndex(
      (option) => option.OptionId === selectedBallotOption.OptionId,
    );
    if (selectedOptionIndex < 0) {
      throw new Error('The selected ballot option is no longer available.');
    }

    const tallyPublicKey = grpcPointToElectionPoint(votingView.TallyPublicKey);
    const protectedArtifacts = await buildBindingProtectedBallotArtifacts({
      electionId,
      selectedOption: selectedBallotOption,
      selectedOptionIndex,
      selectionCount: ballotOptions.length,
      openArtifactId: votingView.OpenArtifactId,
      eligibleSetHash: votingView.EligibleSetHash,
      ceremonyVersionId: votingView.CeremonyVersionId,
      dkgProfileId: votingView.DkgProfileId,
      tallyPublicKey,
      tallyPublicKeyFingerprint: votingView.TallyPublicKeyFingerprint,
    });

    return {
      castDraft: {
        encryptedBallotPackage: protectedArtifacts.encryptedBallotPackage,
        proofBundle: protectedArtifacts.proofBundle,
        ballotNullifier: protectedArtifacts.ballotNullifier,
      },
      commitmentHash: protectedArtifacts.commitmentHash,
    };
  }

  async function submitCastDraft(
    nextCastDraft: CastDraft,
    sp04Binding?: Sp04CastBinding,
  ): Promise<void> {
    const validationErrors = getCastValidationErrors(nextCastDraft, hasBoundaryContext);
    if (!votingView || validationErrors.length > 0) {
      setFeedback({
        tone: 'error',
        message: validationErrors[0] || 'The election cast is not ready to submit.',
      });
      return;
    }

    const submissionIdempotencyKey = generateGuid();
    const nextPendingSubmission: PendingSubmissionState = {
      idempotencyKey: submissionIdempotencyKey,
      ballotPackageCommitment: await hashText(nextCastDraft.encryptedBallotPackage),
      submittedAt: new Date().toISOString(),
      preparedBallotId: sp04Binding?.preparedBallotId,
      preparedBallotHash: sp04Binding?.preparedBallotHash,
      ballotDefinitionHash: sp04Binding?.ballotDefinitionHash,
      ballotDefinitionVersion: sp04Binding?.ballotDefinitionVersion,
      receiptCommitment: sp04Binding?.receiptCommitment,
      receiptCommitmentScheme: sp04Binding?.receiptCommitmentScheme,
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
        nextCastDraft.encryptedBallotPackage.trim(),
        nextCastDraft.proofBundle.trim(),
        nextCastDraft.ballotNullifier.trim(),
        votingView.OpenArtifactId,
        votingView.EligibleSetHash,
        votingView.CeremonyVersionId,
        votingView.DkgProfileId,
        votingView.TallyPublicKeyFingerprint,
        actorSigningPrivateKey,
        sp04Binding,
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
        24,
        750,
      );

      if (awaitedView?.HasAcceptedAt) {
        const createdReceipt = createReceiptFromVotingView(
          electionId,
          awaitedView,
          nextPendingSubmission,
          localReceipt,
        );
        if (createdReceipt) {
          saveLocalReceipt(electionId, createdReceipt);
          setLocalReceipt(createdReceipt);
        }
        clearPendingSubmission(electionId);
        setPendingSubmission(null);
        setVotingView(awaitedView);
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

  async function prepareSp04Package(purpose: 'challenge' | 'final'): Promise<Sp04PreparedPackage | null> {
    if (!selectedBallotOption) {
      setFeedback({ tone: 'error', message: 'Choose a ballot option before preparing a package.' });
      return null;
    }

    if (!votingView || !isBallotDefinitionSealed || !ballotDefinitionHash) {
      setFeedback({
        tone: 'error',
        message: votingView?.Sp04BlockerMessage || 'Ballot definition is not sealed for this election.',
      });
      return null;
    }

    setIsPreparingSp04Package(true);
    setFeedback(null);
    setCastFailure(null);

    try {
      const { castDraft, commitmentHash } = await buildSelectedCastArtifacts();
      if (!isCommitmentRegistered) {
        const commitmentAccepted = await submitCommitmentHash(commitmentHash, {
          showSuccessFeedback: false,
        });
        if (!commitmentAccepted) {
          return null;
        }
      }

      const preparedBallotId = `${generateGuid()}-${purpose}-${Date.now().toString(36)}`;
      const preparedBallotHash = await buildSp04PreparedPackageHash({
        electionId,
        ballotDefinitionHash,
        ballotDefinitionVersion,
        castDraft,
      });
      const proofStatementId = buildSp04ProofStatementId({
        ceremonyProfileId,
        ballotDefinitionHash,
        ballotDefinitionVersion,
      });
      const precommittedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + SP04_PREPARED_PACKAGE_TTL_MS).toISOString();
      const preparedPackage: Sp04PreparedPackage = {
        electionId,
        preparedBallotId,
        preparedBallotHash,
        optionId: selectedBallotOption.OptionId,
        optionLabel: selectedBallotOption.DisplayLabel,
        ballotDefinitionHash,
        ballotDefinitionVersion,
        proofStatementId,
        precommittedAt,
        expiresAt,
        castDraft,
        commitmentHash,
        transcriptText: '',
        purpose,
      };
      preparedPackage.transcriptText = buildSp04TranscriptText(preparedPackage);

      const { signedTransaction } = await createRegisterPreparedBallotCommitmentTransaction(
        electionId,
        actorPublicAddress,
        actorEncryptionPublicKey,
        actorEncryptionPrivateKey,
        preparedBallotId,
        preparedBallotHash,
        ballotDefinitionVersion,
        ballotDefinitionHash,
        ceremonyProfileId,
        proofStatementId,
        actorSigningPrivateKey,
      );
      const submitResult = await submitTransaction(signedTransaction);
      if (
        !submitResult.successful &&
        submitResult.status !== TransactionStatus.ACCEPTED &&
        submitResult.status !== TransactionStatus.PENDING
      ) {
        throw new Error(submitResult.message || 'Prepared package precommit was rejected.');
      }

      setSp04NowMs(Date.now());
      setSp04PreparedPackage(preparedPackage);
      if (purpose === 'challenge') {
        setSp04Challenge({ status: 'pending', optionId: selectedBallotOption.OptionId, optionLabel: selectedBallotOption.DisplayLabel });
        setFeedback({
          tone: 'success',
          message: 'Prepared package precommitted. Run the challenge before final cast.',
        });
      }

      return preparedPackage;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Prepared package precommit failed.';
      setFeedback({ tone: 'error', message });
      if (purpose === 'challenge') {
        setSp04Challenge({ status: 'failed', optionId: selectedBallotOption.OptionId, optionLabel: selectedBallotOption.DisplayLabel, reason: message });
      }
      return null;
    } finally {
      setIsPreparingSp04Package(false);
    }
  }

  async function handlePrepareSp04ChallengePackage(): Promise<void> {
    await prepareSp04Package('challenge');
  }

  async function handleChallengeSpoilPreparedPackage(): Promise<void> {
    if (!sp04PreparedPackage || !selectedBallotOption) {
      setFeedback({ tone: 'error', message: 'Prepare a package before running the challenge.' });
      return;
    }

    if (sp04PreparedPackage.optionId !== selectedBallotOption.OptionId) {
      setSp04Challenge({
        status: 'reset',
        optionId: selectedBallotOption.OptionId,
        optionLabel: selectedBallotOption.DisplayLabel,
        reason: 'Selection changed after this prepared package was created.',
      });
      setFeedback({ tone: 'error', message: 'Prepare a new package for the current selection.' });
      return;
    }

    if (sp04PreparedPackageExpired) {
      setSp04Challenge({
        status: 'failed',
        optionId: selectedBallotOption.OptionId,
        optionLabel: selectedBallotOption.DisplayLabel,
        reason: 'The prepared package expired before challenge verification.',
      });
      setFeedback({ tone: 'error', message: 'Prepared package expired. Prepare again.' });
      return;
    }

    setIsSpoilingSp04Package(true);
    setFeedback(null);

    try {
      const spoiledTranscriptHash = await hashText(sp04PreparedPackage.transcriptText);
      const spoilRecordHash = await hashText(
        JSON.stringify({
          version: 'sp04-spoil-record-v1',
          electionId,
          preparedBallotId: sp04PreparedPackage.preparedBallotId,
          preparedBallotHash: sp04PreparedPackage.preparedBallotHash,
          spoiledTranscriptHash,
          verifier: SP04_LOCAL_VERIFIER_VERSION,
        }),
      );
      const { signedTransaction } = await createSpoilPreparedBallotTransaction(
        electionId,
        actorPublicAddress,
        actorEncryptionPublicKey,
        actorEncryptionPrivateKey,
        sp04PreparedPackage.preparedBallotId,
        sp04PreparedPackage.preparedBallotHash,
        spoiledTranscriptHash,
        spoilRecordHash,
        SP04_LOCAL_VERIFIER_VERSION,
        actorSigningPrivateKey,
      );
      const submitResult = await submitTransaction(signedTransaction);
      if (
        !submitResult.successful &&
        submitResult.status !== TransactionStatus.ACCEPTED &&
        submitResult.status !== TransactionStatus.PENDING
      ) {
        throw new Error(submitResult.message || 'Spoiled challenge record was rejected.');
      }

      setSp04Challenge({
        status: 'passed',
        optionId: selectedBallotOption.OptionId,
        optionLabel: selectedBallotOption.DisplayLabel,
        verifiedAt: new Date().toISOString(),
        spoiledTranscriptHash,
        spoilRecordHash,
        transcriptText: sp04PreparedPackage.transcriptText,
      });
      setFeedback({
        tone: 'success',
        message: 'Challenge passed for the current selection. Final cast will use a fresh package.',
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Challenge verification failed.';
      setSp04Challenge({
        status: 'failed',
        optionId: selectedBallotOption.OptionId,
        optionLabel: selectedBallotOption.DisplayLabel,
        reason: message,
      });
      setFeedback({ tone: 'error', message });
    } finally {
      setIsSpoilingSp04Package(false);
    }
  }

  function handleDownloadSpoiledTranscript(): void {
    if (!sp04Challenge.transcriptText || typeof window === 'undefined') {
      return;
    }

    const blob = new Blob([sp04Challenge.transcriptText], {
      type: 'text/plain;charset=utf-8',
    });
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `sp04-spoiled-transcript-${electionId}-${sp04Challenge.optionId || 'selection'}.txt`;
    link.click();
    window.URL.revokeObjectURL(objectUrl);
    setFeedback({ tone: 'success', message: 'Spoiled transcript downloaded locally.' });
  }

  async function handleSubmitSp04FinalCast(): Promise<void> {
    if (!selectedBallotOption) {
      setFeedback({ tone: 'error', message: 'Choose a ballot option before submitting the vote.' });
      return;
    }

    if (sp04CastBlocker) {
      setFeedback({ tone: 'error', message: sp04CastBlocker });
      return;
    }

    const finalPreparedPackage = await prepareSp04Package('final');
    if (!finalPreparedPackage) {
      return;
    }

    const receiptCommitment = await hashText(
      JSON.stringify({
        version: 'sp04-receipt-commitment-v1',
        electionId,
        preparedBallotId: finalPreparedPackage.preparedBallotId,
        preparedBallotHash: finalPreparedPackage.preparedBallotHash,
        ballotDefinitionHash: finalPreparedPackage.ballotDefinitionHash,
        ballotDefinitionVersion: finalPreparedPackage.ballotDefinitionVersion,
        scheme: SP04_RECEIPT_COMMITMENT_SCHEME,
      }),
    );

    await submitCastDraft(finalPreparedPackage.castDraft, {
      preparedBallotId: finalPreparedPackage.preparedBallotId,
      preparedBallotHash: finalPreparedPackage.preparedBallotHash,
      receiptCommitment,
      receiptCommitmentScheme: SP04_RECEIPT_COMMITMENT_SCHEME,
      ballotDefinitionVersion: finalPreparedPackage.ballotDefinitionVersion,
      ballotDefinitionHash: finalPreparedPackage.ballotDefinitionHash,
    });
  }

  async function handleSubmitNonBindingOpenVote(): Promise<void> {
    if (!selectedBallotOption) {
      setFeedback({
        tone: 'error',
        message: 'Choose a ballot option before submitting the open ballot.',
      });
      return;
    }

    if (!votingView || !hasBoundaryContext) {
      logVotingBoundaryContext('submit-blocked', electionId, detail, votingView);
      setFeedback({
        tone: 'error',
        message: 'The election boundary context is incomplete.',
      });
      return;
    }

    try {
      const openBallotArtifacts = await buildElectionDevModeArtifacts({
        electionId,
        selectedOption: selectedBallotOption,
        openArtifactId: votingView.OpenArtifactId,
        eligibleSetHash: votingView.EligibleSetHash,
        ceremonyVersionId: votingView.CeremonyVersionId,
        dkgProfileId: votingView.DkgProfileId,
        tallyPublicKeyFingerprint: votingView.TallyPublicKeyFingerprint,
      });

      if (!isCommitmentRegistered) {
        const commitmentAccepted = await submitCommitmentHash(openBallotArtifacts.commitmentHash, {
          showSuccessFeedback: false,
        });
        if (!commitmentAccepted) {
          return;
        }
      }

      await submitCastDraft({
        encryptedBallotPackage: openBallotArtifacts.encryptedBallotPackage,
        proofBundle: openBallotArtifacts.proofBundle,
        ballotNullifier: openBallotArtifacts.ballotNullifier,
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to prepare the non-binding open ballot.',
      });
    }
  }

  async function handleSubmitBindingProtectedVote(): Promise<void> {
    if (!selectedBallotOption) {
      setFeedback({
        tone: 'error',
        message: 'Choose a ballot option before submitting the protected ballot.',
      });
      return;
    }

    if (!votingView || !hasBoundaryContext) {
      logVotingBoundaryContext('submit-blocked', electionId, detail, votingView);
      setFeedback({
        tone: 'error',
        message: 'The election boundary context is incomplete.',
      });
      return;
    }

    const selectedOptionIndex = ballotOptions.findIndex(
      (option) => option.OptionId === selectedBallotOption.OptionId,
    );
    if (selectedOptionIndex < 0) {
      setFeedback({
        tone: 'error',
        message: 'The selected ballot option is no longer available.',
      });
      return;
    }

    try {
      const tallyPublicKey = grpcPointToElectionPoint(votingView.TallyPublicKey);
      const protectedArtifacts = await buildBindingProtectedBallotArtifacts({
        electionId,
        selectedOption: selectedBallotOption,
        selectedOptionIndex,
        selectionCount: ballotOptions.length,
        openArtifactId: votingView.OpenArtifactId,
        eligibleSetHash: votingView.EligibleSetHash,
        ceremonyVersionId: votingView.CeremonyVersionId,
        dkgProfileId: votingView.DkgProfileId,
        tallyPublicKey,
        tallyPublicKeyFingerprint: votingView.TallyPublicKeyFingerprint,
      });

      if (!isCommitmentRegistered) {
        const commitmentAccepted = await submitCommitmentHash(protectedArtifacts.commitmentHash, {
          showSuccessFeedback: false,
        });
        if (!commitmentAccepted) {
          return;
        }
      }

      await submitCastDraft({
        encryptedBallotPackage: protectedArtifacts.encryptedBallotPackage,
        proofBundle: protectedArtifacts.proofBundle,
        ballotNullifier: protectedArtifacts.ballotNullifier,
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to prepare the protected binding ballot.',
      });
    }
  }

  async function handleSubmitVote(): Promise<void> {
    if (!selectedBallotOption) {
      setFeedback({
        tone: 'error',
        message: 'Choose a ballot option before submitting the vote.',
      });
      return;
    }

    if (isSp04Required) {
      await handleSubmitSp04FinalCast();
      return;
    }

    if (usesOpenAuditBallotPath) {
      await handleSubmitNonBindingOpenVote();
      return;
    }

    await handleSubmitBindingProtectedVote();
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
    if (!actionableReceipt) {
      return;
    }

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard access is unavailable on this device.');
      }
      await navigator.clipboard.writeText(
        buildReceiptText(actionableReceipt, detail?.Election?.LifecycleState),
      );
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
    if (!actionableReceipt || typeof window === 'undefined') {
      return;
    }

    const blob = new Blob(
      [buildReceiptText(actionableReceipt, detail?.Election?.LifecycleState)],
      { type: 'text/plain;charset=utf-8' },
    );
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `accepted-ballot-receipt-${actionableReceipt.receiptId}.txt`;
    link.click();
    window.URL.revokeObjectURL(objectUrl);
    setFeedback({ tone: 'success', message: 'Receipt downloaded locally.' });
  }

  async function handleVerifyReceipt(): Promise<void> {
    if (!actionableReceipt) {
      setReceiptVerification({
        tone: 'error',
        title: 'Verification needs a receipt',
        detail:
          'This device does not currently have a receipt to check.',
        verifiedAt: new Date().toLocaleString(),
      });
      return;
    }

    setIsVerifyingReceipt(true);
    try {
      const refreshedView = await refreshContext();
      if (!refreshedView.Success) {
        throw new Error(refreshedView.ErrorMessage || 'Failed to refresh the current election state.');
      }

      setReceiptVerification(
        buildReceiptVerificationFeedback({
          localReceipt: actionableReceipt,
          votingView: refreshedView,
          lifecycleState: detail?.Election?.LifecycleState,
          resultView,
        }),
      );
    } catch (error) {
      setReceiptVerification({
        tone: 'error',
        title: 'Verification could not be completed',
        detail:
          error instanceof Error
            ? error.message
            : 'Failed to re-check the current election state for this receipt.',
        verifiedAt: new Date().toLocaleString(),
      });
    } finally {
      setIsVerifyingReceipt(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-hush-bg-dark">
        <div className="flex items-center gap-3 text-sm text-hush-text-accent">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading election voting view...</span>
        </div>
      </div>
    );
  }

  if (!detail?.Success || !election) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto bg-hush-bg-dark px-4 py-5 text-hush-text-primary md:px-5">
        <div className="w-full rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-5 text-sm text-red-100">
          {detail?.ErrorMessage || 'Election data is unavailable.'}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-hush-bg-dark px-4 pb-6 pt-8 text-hush-text-primary md:px-5">
      <div className="flex w-full min-w-0 flex-col gap-8">
        <header className="flex flex-col gap-6">
          <div className="space-y-4">
            <Link
              href={`/elections/${electionId}`}
              className="inline-flex items-center gap-2 text-sm text-hush-text-accent transition-colors hover:text-hush-text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to election</span>
            </Link>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight">
                {election?.Title || 'Election cast acceptance'}
              </h1>
              <p className="max-w-4xl text-base leading-7 text-hush-text-accent">
                {getVotingIntroCopy({
                  lifecycleState: election.LifecycleState,
                  associatedNumber,
                  isLinked,
                  isActiveVoter,
                })}
              </p>
            </div>
          </div>
        </header>

        {feedback && !showBallotWorkflow ? (
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

        <ElectionResultArtifactsSection
          election={election}
          resultView={resultView}
          showReportPackage={false}
        />

        {isAccepted ? (
          <section
            className="rounded-2xl border border-green-500/30 bg-green-500/10 p-5 text-green-100"
            data-testid="voting-accepted-panel"
          >
            <button
              type="button"
              onClick={() =>
                setAcceptedPanelExpansionOverride((current) => {
                  const expanded = current ?? shouldExpandAcceptedPanelByDefault;
                  return !expanded;
                })
              }
              className="flex w-full items-start justify-between gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-200 focus-visible:ring-offset-2 focus-visible:ring-offset-green-950/10"
              aria-expanded={isAcceptedPanelExpanded}
              data-testid="voting-accepted-panel-toggle"
            >
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5" />
                <div>
                  <div className="font-semibold">Accepted ballot</div>
                  <div className="mt-2 text-sm text-green-100/85">
                    Accepted at: {formatTimestamp(votingView.AcceptedAt)}
                  </div>
                  {!isAcceptedPanelExpanded ? (
                    <div className="mt-2 space-y-1 text-sm text-green-100/75">
                      <div>
                        Receipt id:{' '}
                        <span className="font-mono">{truncateMiddle(votingView.ReceiptId)}</span>
                      </div>
                      <div>
                        Acceptance id:{' '}
                        <span className="font-mono">{truncateMiddle(votingView.AcceptanceId)}</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              <span className="mt-1 inline-flex items-center gap-2 whitespace-nowrap text-xs font-semibold uppercase tracking-[0.2em] text-green-100/80">
                {isAcceptedPanelExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <span>{isAcceptedPanelExpanded ? 'Collapse' : 'Expand'}</span>
              </span>
            </button>

            {isAcceptedPanelExpanded ? (
              <>
                <div className="mt-6 grid gap-6 xl:grid-cols-3">
                  <div className="space-y-3">
                    <div className="text-sm">
                      Receipt id:{' '}
                      <span className="font-mono">{truncateMiddle(votingView.ReceiptId)}</span>
                    </div>
                    <div className="text-sm">
                      Acceptance id:{' '}
                      <span className="font-mono">{truncateMiddle(votingView.AcceptanceId)}</span>
                    </div>
                  </div>

                  <div className="space-y-3 xl:border-l xl:border-green-100/10 xl:pl-6">
                    <div className="font-semibold">Local receipt retained on this device</div>
                    {actionableReceipt ? (
                      <div className="space-y-2 text-sm">
                        <div>
                          Server proof:{' '}
                          <span className="font-mono">{truncateMiddle(actionableReceipt.serverProof)}</span>
                        </div>
                        {actionableReceipt.receiptCommitment ? (
                          <div>
                            Receipt commitment:{' '}
                            <span className="font-mono">
                              {truncateMiddle(actionableReceipt.receiptCommitment)}
                            </span>
                          </div>
                        ) : null}
                        {actionableReceipt.preparedBallotHash ? (
                          <div>
                            Prepared ballot hash:{' '}
                            <span className="font-mono">
                              {truncateMiddle(actionableReceipt.preparedBallotHash)}
                            </span>
                          </div>
                        ) : null}
                        {actionableReceipt.ballotDefinitionHash ? (
                          <div>
                            Ballot definition:{' '}
                            <span className="font-mono">
                              {truncateMiddle(actionableReceipt.ballotDefinitionHash)}
                            </span>
                          </div>
                        ) : null}
                        {actionableReceipt.receiptCommitment ? (
                          <div className="text-green-100/80">
                            This receipt proves acceptance and later inclusion. It does not prove
                            which option was selected.
                          </div>
                        ) : null}
                        {shouldShowReceiptCommitment ? (
                          <div>
                            Ballot commitment:{' '}
                            <span className="font-mono">
                              {hasRetainedBallotCommitment
                                ? truncateMiddle(actionableReceipt.ballotPackageCommitment)
                                : '(not retained on this device)'}
                            </span>
                          </div>
                        ) : null}
                        {shouldShowReceiptCommitment && !hasRetainedBallotCommitment ? (
                          <div className="text-green-100/80">
                            This device can still export and verify the receipt for this voter, even
                            though the original local ballot commitment was not retained here.
                          </div>
                        ) : null}
                        {!shouldShowReceiptCommitment ? (
                          <div className="text-green-100/80">
                            Open-election receipts stay compact and include only the fields used for
                            this check. Additional receipt details appear after the election closes.
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="text-sm text-green-100/80">
                        This device does not currently hold a usable receipt for this accepted ballot.
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 xl:border-l xl:border-green-100/10 xl:pl-6">
                    <div className="flex items-center gap-2 font-semibold">
                      <ShieldCheck className="h-4 w-4" />
                      <span>Verification</span>
                    </div>
                    <div className="space-y-2 text-sm text-green-100/85">
                      <p>
                        Use the receipt to confirm whether this voter is marked as voted in this
                        election.
                      </p>
                      <p className="text-green-100/70">
                        After the election closes, a separate check can confirm whether the vote was
                        included in the final count.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleVerifyReceipt()}
                      disabled={isVerifyingReceipt || !actionableReceipt}
                      className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:ring-offset-2 focus-visible:ring-offset-green-950/10 disabled:cursor-not-allowed disabled:opacity-50"
                      data-testid="voting-verify-receipt"
                    >
                      {isVerifyingReceipt ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                      <span>Verify receipt</span>
                    </button>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3 border-t border-green-100/10 pt-5">
                  <button
                    type="button"
                    onClick={() => void handleCopyReceipt()}
                    disabled={!actionableReceipt}
                    className="inline-flex items-center gap-2 rounded-xl bg-green-500 px-4 py-2.5 text-sm font-medium text-green-950 transition-colors hover:bg-green-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-200 focus-visible:ring-offset-2 focus-visible:ring-offset-green-950/10 disabled:cursor-not-allowed disabled:opacity-50"
                    data-testid="voting-copy-receipt"
                  >
                    <Copy className="h-4 w-4" />
                    <span>Copy receipt</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadReceipt}
                    disabled={!actionableReceipt}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-green-950/10 disabled:cursor-not-allowed disabled:opacity-50"
                    data-testid="voting-download-receipt"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download receipt</span>
                  </button>
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        {shouldShowSubmissionPrivacyPanel ? (
          <section className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5 text-blue-100" data-testid="voting-pending-panel">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2 text-sm">
                <div className="font-semibold">
                  {pendingSubmission ? 'Vote submitted from this device' : 'Submitting vote from this device'}
                </div>
                <div>Status: {submissionPrivacyStatus}</div>
                {pendingSubmission ? (
                  <>
                    <div>Submitted at: {new Date(pendingSubmission.submittedAt).toLocaleString()}</div>
                    <div>Ballot commitment: <span className="font-mono">{truncateMiddle(pendingSubmission.ballotPackageCommitment)}</span></div>
                  </>
                ) : null}
                <div className="text-blue-100/90">
                  The selected ballot option is now hidden on this screen while the acceptance receipt is reconciled.
                </div>
              </div>
              {pendingSubmission && !isSubmissionInFlight ? (
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
              ) : (
                <div className="inline-flex items-center gap-2 rounded-xl border border-blue-200/20 px-4 py-2 text-sm font-medium text-blue-50/90">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Protecting local vote privacy</span>
                </div>
              )}
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

        {showBallotWorkflow ? (
          <section className={sectionClass} data-testid="voting-ballot-workflow">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-hush-text-accent">
                  Ballot workflow
                </div>
                <h2 className="mt-3 text-2xl font-semibold text-hush-text-primary">
                  Choose your vote
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-hush-text-accent">
                  Pick the ballot option you intend to cast on this device. This workflow owns the
                  single vote-submit action for both the current dev-only path and the later
                  production protected-circuit path.
                </p>
              </div>
              <div className="self-start rounded-full border border-hush-purple/30 bg-hush-purple/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-primary">
                {selectedBallotOption ? 'Vote selected' : 'Choose a ballot option'}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <WorkflowStatusCard
                label="Ballot choice"
                value={selectedBallotOption?.DisplayLabel || 'Choose below'}
              />
              <WorkflowStatusCard
                label="Commitment"
                value={commitmentStatusValue}
              />
              <WorkflowStatusCard
                label={ballotTransportLabel}
                value={finalSubmitStatusValue}
              />
            </div>

            {isSp04Required ? (
              <div
                className="mt-6 rounded-3xl bg-[#111a2f] p-5 shadow-sm shadow-black/10"
                data-testid="voting-sp04-ceremony"
              >
                <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-2xl bg-cyan-500/10 px-4 py-4 text-cyan-100">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      {isBallotDefinitionSealed ? (
                        <ShieldCheck className="h-4 w-4" />
                      ) : (
                        <ShieldAlert className="h-4 w-4" />
                      )}
                      <span>
                        {isBallotDefinitionSealed
                          ? 'Sealed ballot definition'
                          : 'Ballot definition missing'}
                      </span>
                    </div>
                    <div className="mt-3 break-all font-mono text-sm">
                      {ballotDefinitionHash
                        ? truncateMiddle(ballotDefinitionHash, 12)
                        : 'Hash not available'}
                    </div>
                    <div className="mt-2 text-xs uppercase tracking-[0.18em] text-cyan-100/70">
                      Version {ballotDefinitionVersion || 0}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl bg-hush-bg-dark/70 px-4 py-4 text-sm text-hush-text-accent">
                      <div className="font-semibold text-hush-text-primary">
                        Current ceremony gate
                      </div>
                      <div className="mt-2 leading-6">
                        {sp04CastBlocker ||
                          'Current selection has passed the challenge gate.'}
                      </div>
                      <div className="mt-3 text-xs uppercase tracking-[0.18em] text-hush-text-accent">
                        Required challenges: {votingView?.RequiredChallengeCount || 1}
                      </div>
                    </div>

                    {sp04PreparedPackage ? (
                      <PreparedPackageTimer
                        expiresAt={sp04PreparedPackage.expiresAt}
                        nowMs={sp04NowMs}
                      />
                    ) : (
                      <div
                        className="rounded-2xl bg-hush-bg-dark/70 px-4 py-4 text-sm text-hush-text-accent"
                        data-testid="voting-sp04-prepared-empty"
                      >
                        <div className="font-semibold text-hush-text-primary">
                          Prepared package
                        </div>
                        <div className="mt-2 leading-6">
                          Not started for the current selection.
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                  <ChallengeVerificationSummary
                    challenge={sp04Challenge}
                    currentOptionId={selectedBallotOptionId}
                  />

                  <div className="rounded-2xl bg-hush-bg-dark/70 px-4 py-4 text-sm text-hush-text-accent">
                    <div className="font-semibold text-hush-text-primary">
                      Challenge actions
                    </div>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => void handlePrepareSp04ChallengePackage()}
                        disabled={
                          !selectedBallotOption ||
                          !isBallotDefinitionSealed ||
                          isPreparingSp04Package ||
                          isSpoilingSp04Package
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-hush-purple px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent"
                        data-testid="voting-sp04-prepare-action"
                      >
                        {isPreparingSp04Package ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ShieldCheck className="h-4 w-4" />
                        )}
                        <span>
                          {sp04PreparedPackageExpired || sp04PreparedPackage
                            ? 'Prepare again'
                            : 'Prepare package'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleChallengeSpoilPreparedPackage()}
                        disabled={
                          !sp04PreparedPackage ||
                          sp04PreparedPackageExpired ||
                          sp04PreparedPackage.optionId !== selectedBallotOptionId ||
                          isPreparingSp04Package ||
                          isSpoilingSp04Package
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent"
                        data-testid="voting-sp04-challenge-action"
                      >
                        {isSpoilingSp04Package ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ShieldAlert className="h-4 w-4" />
                        )}
                        <span>Challenge / spoil</span>
                      </button>
                    </div>

                    {sp04Challenge.transcriptText ? (
                      <div className="mt-4 rounded-2xl bg-amber-500/12 p-4 text-amber-100">
                        <div className="font-semibold">Spoiled transcript available</div>
                        <div className="mt-2 leading-6">
                          The file may contain the challenged selection and witnesses. Download
                          it only when local dispute evidence is needed.
                        </div>
                        <button
                          type="button"
                          onClick={handleDownloadSpoiledTranscript}
                          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950 transition-colors hover:bg-amber-400"
                          data-testid="voting-sp04-download-transcript"
                        >
                          <Download className="h-4 w-4" />
                          <span>Download spoiled transcript</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-6">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                Official ballot options
              </div>
              {ballotOptions.length > 0 ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {ballotOptions.map((option) => {
                    const isSelected = selectedBallotOptionId === option.OptionId;

                    return (
                      <button
                        key={option.OptionId}
                        type="button"
                        onClick={() => handleSelectBallotOption(option.OptionId)}
                        className={`rounded-2xl border px-5 py-4 text-left transition-colors ${
                          isSelected
                            ? 'border-hush-purple bg-hush-purple/10 shadow-lg shadow-hush-purple/10'
                            : 'border-hush-bg-light bg-hush-bg-dark/72 hover:border-hush-purple/40 hover:bg-hush-bg-dark'
                        }`}
                        data-testid={`voting-option-${option.OptionId}`}
                        aria-pressed={isSelected}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-lg font-semibold text-hush-text-primary">
                              {option.DisplayLabel}
                            </div>
                            <div className="mt-2 text-sm leading-6 text-hush-text-accent">
                              {option.ShortDescription ||
                                (option.IsBlankOption
                                  ? 'Choose this if you want to cast an explicit blank vote.'
                                  : 'Official ballot option')}
                            </div>
                          </div>
                          <div className="rounded-full border border-hush-bg-light bg-hush-bg-element px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-hush-text-accent">
                            {option.IsBlankOption ? 'Blank vote' : `Option ${option.BallotOrder}`}
                          </div>
                        </div>
                        {isSelected ? (
                          <div className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-hush-text-primary">
                            Selected on this device
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
                  Official ballot options are not available on this device yet, so the vote cannot
                  be submitted from this surface.
                </div>
              )}
            </div>

            {selectedBallotOption ? (
              <div
                className="mt-4 rounded-2xl border border-hush-purple/30 bg-hush-purple/10 px-4 py-4 text-sm text-hush-text-primary"
                data-testid="voting-selected-option-summary"
              >
                <div className="font-semibold">Local ballot preview</div>
                <div className="mt-2">
                  {selectedBallotOption.DisplayLabel}
                  {selectedBallotOption.ShortDescription
                    ? `: ${selectedBallotOption.ShortDescription}`
                    : ''}
                </div>
                <div className="mt-2 text-hush-text-accent">
                  This is only a local choice on this device. Your vote is not submitted yet.
                </div>
              </div>
            ) : null}

            <div className="mt-4 rounded-2xl border border-blue-500/30 bg-blue-500/10 px-4 py-4 text-sm text-blue-100">
              <div className="font-semibold">Your vote is not submitted yet</div>
              <div className="mt-2 leading-6 text-blue-100/90">
                {votePreparationCopy}
              </div>
            </div>

            <div
              className={`mt-4 rounded-2xl border px-4 py-4 text-sm ${submitPanelClass}`}
              data-testid="voting-submit-panel"
            >
              <div className="font-semibold">
                {submitPanelTitle}
              </div>
              <div
                className={`mt-2 leading-6 ${submitPanelBodyClass}`}
              >
                {submitPanelBody}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleSubmitVote()}
                  disabled={submitButtonDisabled}
                  className="inline-flex items-center gap-2 rounded-xl bg-hush-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hush-purple/90 disabled:cursor-not-allowed disabled:bg-hush-bg-light disabled:text-hush-text-accent"
                  data-testid="voting-submit"
                >
                  {isSubmittingCommitment || isSubmittingCast ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  <span>
                    {selectedBallotOption
                      ? isSp04Required
                        ? 'Prepare final package and cast'
                        : 'Submit vote'
                      : 'Choose an option first'}
                  </span>
                </button>
              </div>
              {feedback ? (
                <div
                  className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                    feedback.tone === 'success'
                      ? 'border-green-500/40 bg-green-500/10 text-green-100'
                      : 'border-red-500/40 bg-red-500/10 text-red-100'
                  }`}
                  data-testid="voting-submit-feedback"
                >
                  {feedback.message}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {hasVotingAccess && shouldShowAdvancedContext ? (
          <section className={sectionClass}>
            <button
              type="button"
              onClick={() => setIsAdvancedContextExpanded((current) => !current)}
              className="flex w-full items-start justify-between gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
              aria-expanded={isAdvancedContextExpanded}
              data-testid="voting-advanced-context-toggle"
            >
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-hush-text-accent">
                  Advanced voting context
                </div>
                <h2 className="mt-2 text-xl font-semibold text-hush-text-primary">
                  Technical election boundary
                </h2>
                <p className="mt-2 max-w-3xl text-sm text-hush-text-accent">
                  These identifiers are only useful when troubleshooting an active voting flow.
                </p>
              </div>
              <span className="mt-1 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                {isAdvancedContextExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span>{isAdvancedContextExpanded ? 'Collapse' : 'Expand'}</span>
              </span>
            </button>

            {isAdvancedContextExpanded ? (
              <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                <SummaryValueCard
                  label="Open artifact"
                  value={truncateMiddle(votingView.OpenArtifactId)}
                />
                <SummaryValueCard
                  label="Eligible set hash"
                  value={truncateMiddle(votingView.EligibleSetHash)}
                />
                <SummaryValueCard
                  label="Tally key"
                  value={truncateMiddle(votingView.TallyPublicKeyFingerprint)}
                />
              </div>
            ) : null}
          </section>
        ) : null}

        <section className={sectionClass} data-testid="voting-summary-section">
          <button
            type="button"
            onClick={() => setIsSnapshotExpanded((current) => !current)}
            className="flex w-full items-start justify-between gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
            aria-expanded={isSnapshotExpanded}
            data-testid="voting-summary-toggle"
          >
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-hush-text-accent">
                Voter status snapshot
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-hush-text-accent">
                Review lifecycle, associated number, commitment, and participation for this voter.
              </p>
            </div>
            <span className="mt-1 inline-flex items-center gap-2 whitespace-nowrap text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
              {isSnapshotExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <span>{isSnapshotExpanded ? 'Collapse' : 'Expand'}</span>
            </span>
          </button>

          {isSnapshotExpanded ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryValueCard
                label="Lifecycle"
                value={getLifecycleLabel(election.LifecycleState)}
              />
              <SummaryValueCard
                label={hasVotingAccess ? (associatedNumber ? 'Associated number' : 'Identity') : 'Result access'}
                value={
                  hasVotingAccess
                    ? associatedNumber ?? (isLinked ? 'Linked' : 'Unlinked')
                    : (resultView?.CanViewParticipantEncryptedResults ? 'Participant' : 'Public only')
                }
              />
              <SummaryValueCard
                label={hasVotingAccess ? 'Commitment' : 'Unofficial result'}
                value={
                  hasVotingAccess
                    ? (isCommitmentRegistered ? 'Registered' : 'Missing')
                    : (resultView?.UnofficialResult ? 'Available' : 'Pending')
                }
              />
              <SummaryValueCard
                label={hasVotingAccess ? 'Participation' : 'Official result'}
                value={
                  hasVotingAccess
                    ? participationLabel
                    : (resultView?.OfficialResult ? 'Available' : 'Pending')
                }
              />
            </div>
          ) : null}
        </section>

        {!hasVotingAccess && hasResultArtifacts ? (
          <section className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5 text-blue-100">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5" />
              <div>
                Vote-cast controls are not available for this actor on the current query surface,
                but result visibility is available for your election role.
              </div>
            </div>
          </section>
        ) : null}

        {!hasVotingAccess && !hasResultArtifacts ? (
          <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-100">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5" />
              <div>{votingView?.ErrorMessage || 'Voting data is unavailable for this actor.'}</div>
            </div>
          </section>
        ) : null}

        {!isLinked ? (
          <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-100">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5" />
              <div>Link your roster identity before voting.</div>
            </div>
          </section>
        ) : null}

        {hasVotingAccess && isLinked && !isActiveVoter ? (
          <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-100">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5" />
              <div>This linked identity is not active for this election yet.</div>
            </div>
          </section>
        ) : null}

        <div className="pt-2">
          <Link
            href={`/elections/${electionId}/eligibility`}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-hush-bg-light bg-hush-bg-element/80 px-4 py-3 text-sm font-semibold text-hush-text-accent transition-colors hover:border-hush-purple/40 hover:text-hush-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hush-purple focus-visible:ring-offset-2 focus-visible:ring-offset-hush-bg-dark"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>View eligibility details</span>
          </Link>
        </div>

        {receiptVerification ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-verification-title"
            data-testid="voting-receipt-verification-dialog"
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setReceiptVerification(null)}
              aria-hidden="true"
            />
            <div className="relative w-full max-w-xl rounded-2xl border border-hush-bg-element bg-hush-bg-dark p-6 shadow-2xl">
              <button
                type="button"
                onClick={() => setReceiptVerification(null)}
                className="absolute right-4 top-4 text-hush-text-accent transition-colors hover:text-hush-text-primary"
                aria-label="Close verification dialog"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    receiptVerification.tone === 'success'
                      ? 'bg-green-500/15 text-green-300'
                      : receiptVerification.tone === 'warning'
                        ? 'bg-amber-500/15 text-amber-300'
                        : 'bg-red-500/15 text-red-300'
                  }`}
                >
                  {receiptVerification.tone === 'error' ? (
                    <ShieldAlert className="h-5 w-5" />
                  ) : (
                    <ShieldCheck className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-hush-text-accent">
                    Receipt verification
                  </div>
                  <h3
                    id="receipt-verification-title"
                    className="mt-2 text-xl font-semibold text-hush-text-primary"
                  >
                    {receiptVerification.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-hush-text-accent">
                    {receiptVerification.detail}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <ElectionReceiptTruthPanel
                  bindingStatus={bindingStatus}
                  selectedProfileDevOnly={selectedProfileDevOnly}
                  officialResultVisibilityPolicy={receiptContextOfficialVisibility}
                  profileId={receiptContextProfileId}
                  tallyPublicKeyFingerprint={receiptContextTallyKeyFingerprint}
                  testId="voting-receipt-context"
                />
              </div>

              <div className="mt-4 rounded-2xl bg-hush-bg-element/70 px-5 py-4 text-sm text-hush-text-accent">
                {receiptVerification.statusItems?.length ? (
                  <div className="space-y-3">
                    {receiptVerification.statusItems.map((item) => (
                      <div key={item.label} className="flex items-start gap-3">
                        {item.complete ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-300" />
                        ) : (
                          <Circle className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
                        )}
                        <div className="leading-6">{item.label}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div>
                    Verification compares the stored receipt on this device with the current vote
                    record for this voter.
                  </div>
                )}
                <div className="mt-3 text-xs uppercase tracking-[0.18em] text-hush-text-accent/80">
                  Verified at {receiptVerification.verifiedAt}
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setReceiptVerification(null)}
                  className="rounded-xl bg-hush-purple px-4 py-2.5 text-sm font-medium text-hush-bg-dark transition-colors hover:bg-hush-purple/90"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
