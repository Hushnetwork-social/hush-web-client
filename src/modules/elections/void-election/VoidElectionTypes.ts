import type {
  ElectionRecordView,
  ElectionVerificationPackageStatusView,
  ElectionVoidPublicationStatusView,
} from '@/lib/grpc';
import {
  ElectionLifecycleStateProto,
  ElectionVoidPublicationAttemptStatusProto,
} from '@/lib/grpc';
import type { ElectionVoidEvidenceReferencePayload } from '../transactionService';

export const MIN_JUSTIFICATION_LENGTH = 10;
export const MAX_JUSTIFICATION_LENGTH = 1000;
export const CONFIRMATION_PHRASE = 'VOID';

export type VoidEvidenceReferenceDraft = {
  line: string;
  error?: string;
  payload?: ElectionVoidEvidenceReferencePayload;
};

export type OwnerVoidDangerZoneSectionProps = {
  election?: ElectionRecordView | null;
  actorPublicAddress: string;
  actorPublicEncryptAddress: string;
  actorPrivateEncryptKeyHex: string;
  signingPrivateKeyHex: string;
  isSubmitting: boolean;
  onVoidElection: (
    publicJustification: string,
    evidenceReferences: ElectionVoidEvidenceReferencePayload[],
    actorPublicEncryptAddress: string,
    actorPrivateEncryptKeyHex: string,
    signingPrivateKeyHex: string,
  ) => Promise<boolean>;
  onRetryVoidPublication: (
    voidDecisionId: string,
    actorPublicEncryptAddress: string,
    actorPrivateEncryptKeyHex: string,
    signingPrivateKeyHex: string,
  ) => Promise<boolean>;
};

export type PublicVoidStatusPanelProps = {
  electionId: string;
  actorPublicAddress: string;
  initialStatus?: ElectionVerificationPackageStatusView | null;
};

export type VoterVoidStatusPanelProps = {
  voteRightConsumed: boolean;
  hasKnownVoteRightStatus: boolean;
};

export type SupersededArtifactNoticeProps = {
  voidDecisionId?: string | null;
  currentVoidPackageRef?: string | null;
  verifierResultCode?: string | null;
};

export function isVoidEligible(lifecycleState?: ElectionLifecycleStateProto): boolean {
  return (
    lifecycleState === ElectionLifecycleStateProto.Draft ||
    lifecycleState === ElectionLifecycleStateProto.Open ||
    lifecycleState === ElectionLifecycleStateProto.Closed
  );
}

export function getLifecycleImpactCopy(lifecycleState?: ElectionLifecycleStateProto): {
  title: string;
  body: string;
} {
  switch (lifecycleState) {
    case ElectionLifecycleStateProto.Draft:
      return {
        title: 'Auditable draft cancellation',
        body:
          'The draft remains in history as VOID. A full public VOID package is created only when public artifacts already exist.',
      };
    case ElectionLifecycleStateProto.Open:
      return {
        title: 'Voting stops at the void point',
        body:
          'New voting stops immediately. Queued or pending ballots after the void point are not processed, and no result/count claim remains current.',
      };
    case ElectionLifecycleStateProto.Closed:
      return {
        title: 'Closed election cannot continue to finalization',
        body:
          'Any historical unofficial result remains preserved as superseded evidence. Public VOID output exposes only safe ids or hashes, not tally totals.',
      };
    case ElectionLifecycleStateProto.Finalized:
      return {
        title: 'Finalized elections cannot be voided in v1',
        body:
          'Once finalized, the election remains finalized in HushVoting v1. Any off-system remedy must happen outside this void action.',
      };
    case ElectionLifecycleStateProto.Voided:
      return {
        title: 'Immutable VOID decision recorded',
        body:
          'A second void decision cannot be created. Publication retry can only refresh the VOID package for the same decision.',
      };
    default:
      return {
        title: 'Select a saved election',
        body: 'Save or load an election before reviewing the owner void action.',
      };
  }
}

export function validatePublicJustification(value: string): string[] {
  const normalized = value.trim();
  const errors: string[] = [];

  if (normalized.length < MIN_JUSTIFICATION_LENGTH) {
    errors.push('Enter at least 10 characters for the public VOID justification.');
  }

  if (normalized.length > MAX_JUSTIFICATION_LENGTH) {
    errors.push('The public VOID justification must be 1000 characters or less.');
  }

  const restrictedPatterns = [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
    /\b(password|secret|private key|seed phrase|mnemonic|kms key|aws_access_key|aws_secret)\b/i,
    /\barn:aws:kms:/i,
    /\bAKIA[0-9A-Z]{16}\b/i,
  ];

  if (restrictedPatterns.some((pattern) => pattern.test(normalized))) {
    errors.push(
      'Public justification cannot include secrets, private keys, passwords, KMS data, or raw operational credentials.',
    );
  }

  const personalDataPatterns = [
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    /\b(?:\+?\d[\d\s().-]{7,}\d)\b/,
  ];

  if (personalDataPatterns.some((pattern) => pattern.test(normalized))) {
    errors.push(
      'Public justification cannot include personal contact data, voter identities, vote choices, or raw support logs.',
    );
  }

  return errors;
}

export function buildEvidenceReferencePayloads(rawValue: string): VoidEvidenceReferenceDraft[] {
  return rawValue
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => buildEvidenceReferencePayload(line, index));
}

function buildEvidenceReferencePayload(line: string, index: number): VoidEvidenceReferenceDraft {
  const id = `void-evidence-ref-${index + 1}`;
  const lowerLine = line.toLowerCase();
  const knownPrefixMap: Array<[string, number]> = [
    ['anomaly:', 0],
    ['continuity:', 1],
    ['incident:', 2],
    ['support:', 3],
  ];
  const knownPrefix = knownPrefixMap.find(([prefix]) => lowerLine.startsWith(prefix));
  const recordedAt = new Date().toISOString();

  if (!knownPrefix) {
    return {
      line,
      payload: {
        Id: id,
        ReferenceKind: 4,
        ReferenceId: line,
        InternalRecordId: null,
        ExternalReference: line,
        ReferenceHash: null,
        Visibility: 0,
        RecordedAt: recordedAt,
      },
    };
  }

  const referenceId = line.slice(knownPrefix[0].length).trim();
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(referenceId)) {
    return {
      line,
      error:
        'Known Hush refs must use prefix:uuid format, for example anomaly:00000000-0000-4000-8000-000000000000.',
    };
  }

  return {
    line,
    payload: {
      Id: id,
      ReferenceKind: knownPrefix[1],
      ReferenceId: line,
      InternalRecordId: referenceId,
      ExternalReference: null,
      ReferenceHash: null,
      Visibility: 1,
      RecordedAt: recordedAt,
    },
  };
}

export function getVoidPublicationStatusLabel(status?: ElectionVoidPublicationAttemptStatusProto): {
  label: string;
  toneClass: string;
} {
  switch (status) {
    case ElectionVoidPublicationAttemptStatusProto.VoidPublicationSealed:
      return { label: 'VOID publication sealed', toneClass: 'bg-green-500/12 text-green-100' };
    case ElectionVoidPublicationAttemptStatusProto.VoidPublicationGenerationFailed:
      return { label: 'VOID publication failed', toneClass: 'bg-red-500/12 text-red-100' };
    case ElectionVoidPublicationAttemptStatusProto.VoidPublicationPending:
    default:
      return { label: 'VOID publication pending', toneClass: 'bg-amber-500/12 text-amber-100' };
  }
}

export function getVoidPublicationStatus(
  status?: ElectionVerificationPackageStatusView | null,
): ElectionVoidPublicationStatusView | null {
  return status?.VoidPublicationStatus ?? null;
}
