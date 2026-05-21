import {
  PACKAGE_JSON_MAX_BYTES,
  PACKAGE_ZIP_MAX_BYTES,
  PACKAGE_ZIP_MAX_ENTRY_BYTES,
  PACKAGE_ZIP_MAX_ENTRY_COUNT,
  RECEIPT_EXPORTED_BY,
  RECEIPT_EXPORT_SCHEMA,
  RECEIPT_EXPORT_SCHEMA_VERSION,
  RECEIPT_FILE_MAX_BYTES,
  type ReceiptVerificationResultCategory,
} from './contracts';

export const FEAT136_SAMPLE_ELECTION_ID = '13e6fa69-1d53-4968-8b1c-397333458253';
export const FEAT136_SAMPLE_PACKAGE_ID =
  'HushElectionPackage-13e6fa69-1d53-4968-8b1c-397333458253';
export const FEAT136_SAMPLE_PACKAGE_HASH =
  'sha256:2d94eb9148d97744c53658514b9af663aa80315303e08ba1cd9ca567fb321f36';
export const FEAT136_SAMPLE_VERIFIER_PROFILE_ID = 'public_anonymous_v1';
export const FEAT136_SAMPLE_RECEIPT_COMMITMENT = 'receipt-a';
export const FEAT136_SAMPLE_RECEIPT_COMMITMENT_SCHEME =
  'hushvoting-sp04-receipt-commitment-sha256-v1';
export const FEAT136_SAMPLE_PREPARED_BALLOT_HASH = 'prepared-final-a';
export const FEAT136_SAMPLE_BALLOT_DEFINITION_HASH =
  'NRASoflgGqzNd3Y/lR7Haz1FDI2k5Pzhj5YChdYFfHc=';

export type ReceiptFixtureKind =
  | 'package_bound_good'
  | 'package_less_good'
  | 'malformed_receipt'
  | 'unknown_proof_field'
  | 'wrong_package_binding'
  | 'missing_receipt';

export type PackageFixtureKind =
  | 'good_public_package'
  | 'corrupted_zip'
  | 'unsafe_zip_path'
  | 'manifest_mismatch'
  | 'duplicate_matching_evidence'
  | 'wrong_package'
  | 'missing_receipt';

export interface ReceiptFixtureCase {
  fixtureId: string;
  fixtureKind: ReceiptFixtureKind;
  receiptJson: string | null;
  expectedResult: ReceiptVerificationResultCategory;
  packageBound: boolean;
  notes: string;
}

export interface PackageFixtureCase {
  fixtureId: string;
  fixtureKind: PackageFixtureKind;
  packageRef: string;
  expectedResult: ReceiptVerificationResultCategory;
  notes: string;
}

export const RECEIPT_VERIFICATION_LIMITS = {
  receiptFileMaxBytes: RECEIPT_FILE_MAX_BYTES,
  packageZipMaxBytes: PACKAGE_ZIP_MAX_BYTES,
  packageZipMaxEntryCount: PACKAGE_ZIP_MAX_ENTRY_COUNT,
  packageZipMaxEntryBytes: PACKAGE_ZIP_MAX_ENTRY_BYTES,
  packageJsonMaxBytes: PACKAGE_JSON_MAX_BYTES,
} as const;

export const RECEIPT_VERIFICATION_TELEMETRY_EVENTS = {
  receiptStatusChecked: {
    eventName: 'receipt_status_checked',
    allowedFields: ['lifecycle', 'outcome'],
  },
  receiptExportRequested: {
    eventName: 'receipt_export_requested',
    allowedFields: ['receiptType'],
  },
  publicReceiptVerifierOpened: {
    eventName: 'public_receipt_verifier_opened',
    allowedFields: [],
  },
  publicReceiptFileSelected: {
    eventName: 'public_receipt_file_selected',
    allowedFields: ['schemaVersion', 'validationOutcome'],
  },
  publicPackageZipSelected: {
    eventName: 'public_package_zip_selected',
    allowedFields: ['validationOutcome'],
  },
  publicReceiptVerificationCompleted: {
    eventName: 'public_receipt_verification_completed',
    allowedFields: ['resultCategory', 'warningCount', 'durationBucket'],
  },
  publicReceiptVerificationFailed: {
    eventName: 'public_receipt_verification_failed',
    allowedFields: ['resultCategory', 'failureFamily'],
  },
} as const;

const packageBoundReceipt = {
  schema: RECEIPT_EXPORT_SCHEMA,
  schemaVersion: RECEIPT_EXPORT_SCHEMA_VERSION,
  receiptProof: {
    electionId: FEAT136_SAMPLE_ELECTION_ID,
    receiptCommitment: FEAT136_SAMPLE_RECEIPT_COMMITMENT,
    receiptCommitmentScheme: FEAT136_SAMPLE_RECEIPT_COMMITMENT_SCHEME,
    preparedBallotHash: FEAT136_SAMPLE_PREPARED_BALLOT_HASH,
    ballotDefinitionVersion: 1,
    ballotDefinitionHash: FEAT136_SAMPLE_BALLOT_DEFINITION_HASH,
    expectedPackageId: FEAT136_SAMPLE_PACKAGE_ID,
    expectedPackageHash: FEAT136_SAMPLE_PACKAGE_HASH,
    expectedVerifierProfileId: FEAT136_SAMPLE_VERIFIER_PROFILE_ID,
  },
  exportEnvelope: {
    receiptGeneratedAt: '2026-05-21T10:00:00Z',
    exportedBy: RECEIPT_EXPORTED_BY,
    exporterVersion: 'feat-136-test-fixture',
  },
};

const packageLessReceipt = {
  ...packageBoundReceipt,
  receiptProof: {
    electionId: FEAT136_SAMPLE_ELECTION_ID,
    receiptCommitment: FEAT136_SAMPLE_RECEIPT_COMMITMENT,
    receiptCommitmentScheme: FEAT136_SAMPLE_RECEIPT_COMMITMENT_SCHEME,
    preparedBallotHash: FEAT136_SAMPLE_PREPARED_BALLOT_HASH,
    ballotDefinitionVersion: 1,
    ballotDefinitionHash: FEAT136_SAMPLE_BALLOT_DEFINITION_HASH,
  },
};

const wrongPackageReceipt = {
  ...packageBoundReceipt,
  receiptProof: {
    ...packageBoundReceipt.receiptProof,
    expectedPackageId: 'HushElectionPackage-wrong-election',
    expectedPackageHash:
      'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  },
};

const unknownProofFieldReceipt = {
  ...packageLessReceipt,
  receiptProof: {
    ...packageLessReceipt.receiptProof,
    unexpectedProofField: 'unexpected',
  },
};

export const FEAT136_RECEIPT_FIXTURES: ReceiptFixtureCase[] = [
  {
    fixtureId: 'receipt-package-bound-good',
    fixtureKind: 'package_bound_good',
    receiptJson: JSON.stringify(packageBoundReceipt, null, 2),
    expectedResult: 'verified_included',
    packageBound: true,
    notes: 'Good receipt with expected public package id/hash/profile.',
  },
  {
    fixtureId: 'receipt-package-less-good',
    fixtureKind: 'package_less_good',
    receiptJson: JSON.stringify(packageLessReceipt, null, 2),
    expectedResult: 'verified_included_with_warnings',
    packageBound: false,
    notes: 'Good inclusion receipt without package binding.',
  },
  {
    fixtureId: 'receipt-malformed-json',
    fixtureKind: 'malformed_receipt',
    receiptJson: '{"schema":"hushvoting.receipt.export","receiptProof":',
    expectedResult: 'invalid_receipt',
    packageBound: false,
    notes: 'Malformed JSON must fail before package checks.',
  },
  {
    fixtureId: 'receipt-unknown-proof-field',
    fixtureKind: 'unknown_proof_field',
    receiptJson: JSON.stringify(unknownProofFieldReceipt, null, 2),
    expectedResult: 'invalid_receipt',
    packageBound: false,
    notes: 'Unknown strict receiptProof fields must fail.',
  },
  {
    fixtureId: 'receipt-wrong-package-binding',
    fixtureKind: 'wrong_package_binding',
    receiptJson: JSON.stringify(wrongPackageReceipt, null, 2),
    expectedResult: 'wrong_package',
    packageBound: true,
    notes: 'Receipt package binding points to another package.',
  },
  {
    fixtureId: 'receipt-missing',
    fixtureKind: 'missing_receipt',
    receiptJson: null,
    expectedResult: 'not_found',
    packageBound: false,
    notes: 'Package is valid but the supplied receipt commitment is absent.',
  },
];

export const FEAT136_PACKAGE_FIXTURES: PackageFixtureCase[] = [
  {
    fixtureId: 'package-good-public-finalized',
    fixtureKind: 'good_public_package',
    packageRef:
      'HushVoting-Verifier-Corpus/hushvoting-v1/v0.1.0/packages/sample-good-finalized-election',
    expectedResult: 'verified_included',
    notes: 'Baseline public anonymous package shape from FEAT-135.',
  },
  {
    fixtureId: 'package-corrupted-zip',
    fixtureKind: 'corrupted_zip',
    packageRef: 'test-fixture:corrupted-zip-bytes',
    expectedResult: 'invalid_package',
    notes: 'ZIP reader cannot open archive.',
  },
  {
    fixtureId: 'package-unsafe-path',
    fixtureKind: 'unsafe_zip_path',
    packageRef: 'test-fixture:zip-with-parent-traversal',
    expectedResult: 'invalid_package',
    notes: 'Archive contains absolute, drive-letter, or parent-traversal path.',
  },
  {
    fixtureId: 'package-manifest-mismatch',
    fixtureKind: 'manifest_mismatch',
    packageRef:
      'HushVoting-Verifier-Corpus/hushvoting-v1/v0.1.0/packages/tamper-artifact-hash',
    expectedResult: 'invalid_package',
    notes: 'Manifest-listed artifact hash does not match content.',
  },
  {
    fixtureId: 'package-duplicate-matching-evidence',
    fixtureKind: 'duplicate_matching_evidence',
    packageRef: 'test-fixture:duplicate-receipt-commitment-match',
    expectedResult: 'invalid_package',
    notes: 'Duplicate matching receipt/accepted-ballot evidence is a package integrity failure.',
  },
  {
    fixtureId: 'package-wrong-package',
    fixtureKind: 'wrong_package',
    packageRef:
      'HushVoting-Verifier-Corpus/hushvoting-v1/v0.1.0/packages/tamper-wrong-election-id',
    expectedResult: 'wrong_package',
    notes: 'Receipt binding does not match selected package identity.',
  },
  {
    fixtureId: 'package-missing-receipt',
    fixtureKind: 'missing_receipt',
    packageRef: 'test-fixture:valid-package-without-receipt',
    expectedResult: 'not_found',
    notes: 'Selected package is valid but does not contain the receipt proof.',
  },
];

export const FORBIDDEN_RECEIPT_FIXTURE_PATTERNS = [
  /organizationVoterId/i,
  /selectedOption/i,
  /optionLabel/i,
  /plaintextBallot/i,
  /castTimestamp/i,
  /castAt/i,
  /receiptSecret/i,
  /randomness/i,
  /privateAudit/i,
  /privateKey/i,
  /kms/i,
  /supportCase/i,
  /localPath/i,
  /C:\\/i,
  /\/Users\//i,
];

export const FORBIDDEN_TELEMETRY_FIELDS = [
  'receiptCommitment',
  'preparedBallotHash',
  'packageHash',
  'voterIdentity',
  'selectedOption',
  'localPath',
];

export function scanReceiptFixtureForForbiddenMaterial(receiptJson: string): string[] {
  return FORBIDDEN_RECEIPT_FIXTURE_PATTERNS
    .filter((pattern) => pattern.test(receiptJson))
    .map((pattern) => pattern.source);
}

export function validateTelemetryFieldPolicy(): string[] {
  const forbidden = new Set(FORBIDDEN_TELEMETRY_FIELDS.map((field) => field.toLowerCase()));
  return Object.values(RECEIPT_VERIFICATION_TELEMETRY_EVENTS).flatMap((event) =>
    event.allowedFields.filter((field) => forbidden.has(field.toLowerCase())),
  );
}
