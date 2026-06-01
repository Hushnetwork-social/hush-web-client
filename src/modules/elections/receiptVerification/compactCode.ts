import { sha256 } from '@noble/hashes/sha2.js';
import {
  RECEIPT_EXPORTED_BY,
  RECEIPT_EXPORT_SCHEMA,
  RECEIPT_EXPORT_SCHEMA_VERSION,
  type HushVotingReceiptExport,
} from './contracts';
import {
  parseFinalizedPublicPackageZip,
  type AcceptedBallotRecord,
  type FinalizedReceiptPackage,
  type ReceiptVerificationIssue,
  type ReceiptVerificationPackageIdentity,
  type Sp04ReceiptCommitmentRecord,
} from './packageVerifier';

const TEXT_ENCODER = new TextEncoder();
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const COMPACT_CODE_PREFIX = 'HVC1';
const PACKAGE_HINT_LENGTH = 5;
const PROOF_CODE_LENGTH = 12;
const RAW_CODE_LENGTH = PACKAGE_HINT_LENGTH + PROOF_CODE_LENGTH;
const RAW_CODE_PATTERN = /^[A-Z2-7]+$/;
const COMPACT_CODE_EXPORT_TIMESTAMP = '1970-01-01T00:00:00Z';

export type CompactReceiptLookupCategory =
  | 'resolved'
  | 'invalid_receipt'
  | 'wrong_package'
  | 'not_found'
  | 'invalid_package'
  | 'verification_unavailable';

export interface CompactReceiptCodeParts {
  raw: string;
  display: string;
  packageHint: string;
  proofCode: string;
}

export interface CompactReceiptLookupEntry {
  compactCode: string;
  receiptExport: HushVotingReceiptExport;
  receiptJson: string;
  receiptCommitment: string;
  preparedBallotHash: string;
}

export interface CompactReceiptLookupResult {
  category: CompactReceiptLookupCategory;
  issues: ReceiptVerificationIssue[];
  packageIdentity?: ReceiptVerificationPackageIdentity;
  compactCode?: CompactReceiptCodeParts;
  entry?: CompactReceiptLookupEntry;
}

export interface CompactReceiptCodeInput {
  identity: ReceiptVerificationPackageIdentity;
  receiptCommitment: string;
  receiptCommitmentScheme: string;
  preparedBallotHash: string;
}

export type CompactReceiptCodeFactory = (input: CompactReceiptCodeInput) => string;

export function normalizeCompactReceiptCode(source: string): CompactReceiptCodeParts {
  const collapsed = source.toUpperCase().replace(/[\s-]+/g, '');
  const raw = collapsed.startsWith(COMPACT_CODE_PREFIX)
    ? collapsed.slice(COMPACT_CODE_PREFIX.length)
    : collapsed;

  if (raw.length !== RAW_CODE_LENGTH || !RAW_CODE_PATTERN.test(raw)) {
    throw compactCodeIssue(
      'receipt',
      'compact_code_malformed',
      'Compact code must use HVC1 plus 17 base32 characters.',
    );
  }

  return {
    raw,
    display: formatCompactReceiptCode(raw),
    packageHint: raw.slice(0, PACKAGE_HINT_LENGTH),
    proofCode: raw.slice(PACKAGE_HINT_LENGTH),
  };
}

export function computeCompactReceiptCode(input: CompactReceiptCodeInput): string {
  const packageHint = base32Sha256([
    'HushVoting.CompactReceipt.Package.v1',
    input.identity.packageId,
    input.identity.packageHash,
    input.identity.verifierProfileId,
    input.identity.electionId,
  ]).slice(0, PACKAGE_HINT_LENGTH);

  const proofCode = base32Sha256([
    'HushVoting.CompactReceipt.Proof.v1',
    input.identity.packageId,
    input.identity.packageHash,
    input.identity.verifierProfileId,
    input.identity.electionId,
    input.receiptCommitment,
    input.receiptCommitmentScheme,
    input.preparedBallotHash,
  ]).slice(0, PROOF_CODE_LENGTH);

  return formatCompactReceiptCode(`${packageHint}${proofCode}`);
}

export function packageHintForIdentity(identity: ReceiptVerificationPackageIdentity): string {
  return base32Sha256([
    'HushVoting.CompactReceipt.Package.v1',
    identity.packageId,
    identity.packageHash,
    identity.verifierProfileId,
    identity.electionId,
  ]).slice(0, PACKAGE_HINT_LENGTH);
}

export function resolveCompactReceiptCode(input: {
  compactCode: string;
  packageZipBytes: ArrayBuffer | Uint8Array;
  codeFactory?: CompactReceiptCodeFactory;
}): CompactReceiptLookupResult {
  let compactCode: CompactReceiptCodeParts;
  try {
    compactCode = normalizeCompactReceiptCode(input.compactCode);
  } catch (error) {
    return {
      category: 'invalid_receipt',
      issues: [mapCompactCodeError(error)],
    };
  }

  let finalizedPackage: FinalizedReceiptPackage;
  try {
    finalizedPackage = parseFinalizedPublicPackageZip(input.packageZipBytes);
  } catch (error) {
    return {
      category: 'invalid_package',
      compactCode,
      issues: [
        {
          family: 'package',
          code: 'compact_code_package_invalid',
          message:
            error instanceof Error
              ? error.message
              : 'Selected package could not be opened for compact-code lookup.',
        },
      ],
    };
  }

  const expectedPackageHint = packageHintForIdentity(finalizedPackage.identity);
  if (compactCode.packageHint !== expectedPackageHint) {
    return {
      category: 'wrong_package',
      compactCode,
      packageIdentity: finalizedPackage.identity,
      issues: [
        {
          family: 'binding',
          code: 'compact_code_wrong_package',
          message: 'Compact code package hint does not match the selected finalized package.',
        },
      ],
    };
  }

  const index = buildCompactReceiptLookupIndex(finalizedPackage, input.codeFactory);
  const matches = index.get(compactCode.display) ?? [];

  if (matches.length > 1) {
    return {
      category: 'invalid_package',
      compactCode,
      packageIdentity: finalizedPackage.identity,
      issues: [
        {
          family: 'package',
          code: 'compact_code_ambiguous',
          message: 'Selected package maps this compact code to more than one receipt proof.',
        },
      ],
    };
  }

  const entry = matches[0];
  if (!entry) {
    return {
      category: 'not_found',
      compactCode,
      packageIdentity: finalizedPackage.identity,
      issues: [
        {
          family: 'inclusion',
          code: 'compact_code_not_found',
          message: 'Compact code was not found in the selected finalized package.',
        },
      ],
    };
  }

  return {
    category: 'resolved',
    compactCode,
    packageIdentity: finalizedPackage.identity,
    entry,
    issues: [],
  };
}

export function buildCompactReceiptLookupIndex(
  finalizedPackage: FinalizedReceiptPackage,
  codeFactory: CompactReceiptCodeFactory = computeCompactReceiptCode,
): Map<string, CompactReceiptLookupEntry[]> {
  const acceptedBallots = new Map<string, AcceptedBallotRecord>();
  for (const ballot of finalizedPackage.acceptedBallotSet.acceptedBallots) {
    acceptedBallots.set(compactProofKey(ballot.receiptCommitment, ballot.preparedBallotHash), ballot);
  }

  const index = new Map<string, CompactReceiptLookupEntry[]>();
  for (const receiptRecord of finalizedPackage.sp04ReceiptCommitments) {
    const acceptedBallot = acceptedBallots.get(
      compactProofKey(receiptRecord.receiptCommitment, receiptRecord.preparedBallotHash),
    );

    const receiptExport = receiptExportFromPackageEvidence(
      finalizedPackage.identity,
      receiptRecord,
      acceptedBallot,
    );
    const compactCode = codeFactory({
      identity: finalizedPackage.identity,
      receiptCommitment: receiptRecord.receiptCommitment,
      receiptCommitmentScheme: receiptRecord.receiptCommitmentScheme,
      preparedBallotHash: receiptRecord.preparedBallotHash,
    });
    const entry: CompactReceiptLookupEntry = {
      compactCode,
      receiptExport,
      receiptJson: JSON.stringify(receiptExport),
      receiptCommitment: receiptRecord.receiptCommitment,
      preparedBallotHash: receiptRecord.preparedBallotHash,
    };
    const entries = index.get(compactCode) ?? [];
    entries.push(entry);
    index.set(compactCode, entries);
  }

  return index;
}

function receiptExportFromPackageEvidence(
  identity: ReceiptVerificationPackageIdentity,
  receiptRecord: Sp04ReceiptCommitmentRecord,
  acceptedBallot?: AcceptedBallotRecord,
): HushVotingReceiptExport {
  const ballotDefinitionVersion = acceptedBallot?.ballotDefinitionVersion;
  const ballotDefinitionHash = acceptedBallot?.ballotDefinitionHash;

  return {
    schema: RECEIPT_EXPORT_SCHEMA,
    schemaVersion: RECEIPT_EXPORT_SCHEMA_VERSION,
    receiptProof: {
      electionId: identity.electionId,
      receiptCommitment: receiptRecord.receiptCommitment,
      receiptCommitmentScheme: receiptRecord.receiptCommitmentScheme,
      preparedBallotHash: receiptRecord.preparedBallotHash,
      ...(ballotDefinitionVersion === undefined ? {} : { ballotDefinitionVersion }),
      ...(ballotDefinitionHash ? { ballotDefinitionHash } : {}),
      expectedPackageId: identity.packageId,
      expectedPackageHash: identity.packageHash,
      expectedVerifierProfileId: identity.verifierProfileId,
    },
    exportEnvelope: {
      receiptGeneratedAt: COMPACT_CODE_EXPORT_TIMESTAMP,
      exportedBy: RECEIPT_EXPORTED_BY,
      exporterVersion: 'compact-code-v1',
    },
  };
}

function formatCompactReceiptCode(raw: string): string {
  return [
    COMPACT_CODE_PREFIX,
    raw.slice(0, PACKAGE_HINT_LENGTH),
    raw.slice(PACKAGE_HINT_LENGTH, PACKAGE_HINT_LENGTH + 4),
    raw.slice(PACKAGE_HINT_LENGTH + 4, PACKAGE_HINT_LENGTH + 8),
    raw.slice(PACKAGE_HINT_LENGTH + 8),
  ].join('-');
}

function compactProofKey(
  receiptCommitment: string | undefined,
  preparedBallotHash: string | undefined,
): string {
  return `${receiptCommitment ?? ''}|${preparedBallotHash ?? ''}`;
}

function base32Sha256(parts: readonly string[]): string {
  return base32Encode(sha256(TEXT_ENCODER.encode(parts.join('|'))));
}

function base32Encode(bytes: Uint8Array): string {
  let output = '';
  let buffer = 0;
  let bitsLeft = 0;

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bitsLeft += 8;

    while (bitsLeft >= 5) {
      output += BASE32_ALPHABET[(buffer >>> (bitsLeft - 5)) & 31];
      bitsLeft -= 5;
    }
  }

  if (bitsLeft > 0) {
    output += BASE32_ALPHABET[(buffer << (5 - bitsLeft)) & 31];
  }

  return output;
}

function compactCodeIssue(
  family: ReceiptVerificationIssue['family'],
  code: string,
  message: string,
): CompactReceiptCodeValidationError {
  return new CompactReceiptCodeValidationError({
    family,
    code,
    message,
  });
}

function mapCompactCodeError(error: unknown): ReceiptVerificationIssue {
  if (error instanceof CompactReceiptCodeValidationError) {
    return error.issue;
  }

  return {
    family: 'receipt',
    code: 'compact_code_malformed',
    message: error instanceof Error ? error.message : 'Compact code is malformed.',
  };
}

class CompactReceiptCodeValidationError extends Error {
  constructor(readonly issue: ReceiptVerificationIssue) {
    super(issue.message);
    this.name = 'CompactReceiptCodeValidationError';
  }
}
