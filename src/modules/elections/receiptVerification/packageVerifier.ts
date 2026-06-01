import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { unzipSync } from 'fflate';
import {
  assertNoDuplicateJsonKeys,
  hasReceiptPackageBinding,
  PACKAGE_JSON_MAX_BYTES,
  PACKAGE_ZIP_MAX_BYTES,
  PACKAGE_ZIP_MAX_ENTRY_BYTES,
  PACKAGE_ZIP_MAX_ENTRY_COUNT,
  parseReceiptExportJson,
  ReceiptValidationError,
  type HushVotingReceiptExport,
  type HushVotingReceiptProof,
  type ReceiptVerificationResultCategory,
} from './contracts';

export const AUDIT_PACKAGE_MANIFEST_PATH = 'AuditPackageManifest.json';
export const VERIFIER_INPUT_MANIFEST_PATH = 'VerifierInputManifest.json';
export const VERIFIER_PROFILE_PATH = 'VerifierProfile.json';
export const ACCEPTED_BALLOT_SET_PATH = 'artifacts/election-record/accepted-ballot-set.json';
export const SP04_RECEIPT_COMMITMENTS_PATH =
  'artifacts/election-record/sp04-receipt-commitments.json';
export const SP04_EVIDENCE_PATH = 'artifacts/election-record/sp04-evidence.json';
export const SUPPORTING_VERIFIER_OUTPUT_PATH = 'verifier-output/VerifierOutput.json';

const TEXT_DECODER = new TextDecoder();
const UUID_WITH_DASHES_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ReceiptVerificationIssueFamily =
  | 'receipt'
  | 'package'
  | 'binding'
  | 'inclusion'
  | 'runtime';

export interface ReceiptVerificationIssue {
  family: ReceiptVerificationIssueFamily;
  code: string;
  path?: string;
  message: string;
}

export interface ReceiptVerificationPackageIdentity {
  packageId: string;
  packageHash: string;
  electionId: string;
  verifierProfileId: string;
}

export interface ReceiptVerificationMatchedEvidence {
  receiptCommitment: string;
  receiptCommitmentScheme: string;
  preparedBallotHash: string;
}

export interface ReceiptVerificationResult {
  category: ReceiptVerificationResultCategory;
  issues: ReceiptVerificationIssue[];
  warnings: string[];
  receipt?: HushVotingReceiptExport;
  packageIdentity?: ReceiptVerificationPackageIdentity;
  matchedEvidence?: ReceiptVerificationMatchedEvidence;
  supportingVerifierOutput?: unknown;
}

interface ZipEntryMap {
  entries: Map<string, Uint8Array>;
  packageHash: string;
}

interface AuditPackageManifest {
  manifestVersion: string;
  packageId: string;
  electionId: string;
  packageView: string;
  verifierProfileId: string;
  entries: AuditPackageManifestEntry[];
}

interface AuditPackageManifestEntry {
  path: string;
  sha256Hash: string;
  sizeBytes?: number;
}

interface VerifierInputManifest {
  manifestVersion: string;
  packageId: string;
  electionId: string;
  packageView: string;
  verifierProfileId: string;
  auditPackageManifestHash: string;
}

interface VerifierProfile {
  profileId: string;
}

export interface AcceptedBallotSet {
  electionId: string;
  acceptedBallotCount: number;
  acceptedBallotInventoryHash: string;
  acceptedBallots: AcceptedBallotRecord[];
}

export interface AcceptedBallotRecord {
  ballotNullifier: string;
  encryptedBallotPackage: string;
  proofBundle: string;
  preparedBallotHash?: string;
  receiptCommitment?: string;
  receiptCommitmentScheme?: string;
  ballotDefinitionVersion?: number;
  ballotDefinitionHash?: string;
}

export interface Sp04ReceiptCommitmentRecord {
  acceptedBallotId: string;
  preparedBallotId: string;
  acceptedAt: string;
  preparedBallotHash: string;
  receiptCommitment: string;
  receiptCommitmentScheme: string;
}

export interface Sp04Evidence {
  electionId: string;
  acceptedBoundReceiptCount: number;
  receiptCommitmentSetHash: string;
}

export interface FinalizedReceiptPackage {
  identity: ReceiptVerificationPackageIdentity;
  acceptedBallotSet: AcceptedBallotSet;
  sp04ReceiptCommitments: Sp04ReceiptCommitmentRecord[];
  sp04Evidence: Sp04Evidence;
  supportingVerifierOutput?: unknown;
}

class PackageValidationError extends Error {
  constructor(public readonly issue: ReceiptVerificationIssue) {
    super(issue.message);
    this.name = 'PackageValidationError';
  }
}

export function verifyReceiptInPackage(input: {
  receiptJson: string;
  packageZipBytes?: ArrayBuffer | Uint8Array | null;
  packageReader?: (packageZipBytes: ArrayBuffer | Uint8Array) => FinalizedReceiptPackage;
}): ReceiptVerificationResult {
  let receipt: HushVotingReceiptExport;
  try {
    receipt = parseReceiptExportJson(input.receiptJson);
    assertPackageBindingIsCompleteOrAbsent(receipt.receiptProof);
  } catch (error) {
    return {
      category: 'invalid_receipt',
      warnings: [],
      issues: [mapReceiptValidationIssue(error)],
    };
  }

  if (!input.packageZipBytes || input.packageZipBytes.byteLength === 0) {
    return {
      category: 'package_unavailable',
      receipt,
      warnings: [],
      issues: [
        {
          family: 'package',
          code: 'package_unavailable',
          message: 'No finalized public package ZIP was provided.',
        },
      ],
    };
  }

  let finalizedPackage: FinalizedReceiptPackage;
  try {
    finalizedPackage = (input.packageReader ?? parseFinalizedPublicPackageZip)(
      input.packageZipBytes,
    );
  } catch (error) {
    if (error instanceof PackageValidationError) {
      return {
        category: 'invalid_package',
        receipt,
        warnings: [],
        issues: [error.issue],
      };
    }

    return {
      category: 'verification_unavailable',
      receipt,
      warnings: [],
      issues: [
        {
          family: 'runtime',
          code: 'unexpected_verification_error',
          message: error instanceof Error ? error.message : 'Receipt verification failed.',
        },
      ],
    };
  }

  const packageBindingIssue = comparePackageBinding(receipt.receiptProof, finalizedPackage.identity);
  if (packageBindingIssue) {
    return {
      category: 'wrong_package',
      receipt,
      packageIdentity: finalizedPackage.identity,
      warnings: [],
      issues: [packageBindingIssue],
      supportingVerifierOutput: finalizedPackage.supportingVerifierOutput,
    };
  }

  const duplicateIssue = findDuplicateMatchingEvidence(receipt.receiptProof, finalizedPackage);
  if (duplicateIssue) {
    return {
      category: 'invalid_package',
      receipt,
      packageIdentity: finalizedPackage.identity,
      warnings: [],
      issues: [duplicateIssue],
      supportingVerifierOutput: finalizedPackage.supportingVerifierOutput,
    };
  }

  const matchedEvidence = findReceiptMatch(receipt.receiptProof, finalizedPackage);
  if (!matchedEvidence) {
    return {
      category: 'not_found',
      receipt,
      packageIdentity: finalizedPackage.identity,
      warnings: [],
      issues: [
        {
          family: 'inclusion',
          code: 'receipt_not_found',
          message: 'The receipt proof was not found in the selected finalized package.',
        },
      ],
      supportingVerifierOutput: finalizedPackage.supportingVerifierOutput,
    };
  }

  const warnings = collectVerificationWarnings(receipt.receiptProof, finalizedPackage);
  return {
    category: warnings.length > 0 ? 'verified_included_with_warnings' : 'verified_included',
    receipt,
    packageIdentity: finalizedPackage.identity,
    matchedEvidence,
    warnings,
    issues: [],
    supportingVerifierOutput: finalizedPackage.supportingVerifierOutput,
  };
}

export function parseFinalizedPublicPackageZip(
  packageZipBytes: ArrayBuffer | Uint8Array,
): FinalizedReceiptPackage {
  const zip = readSafeZipEntries(packageZipBytes);
  const auditManifestBytes = readRequiredEntry(zip.entries, AUDIT_PACKAGE_MANIFEST_PATH);
  const auditManifest = readJsonEntry<AuditPackageManifest>(
    zip.entries,
    AUDIT_PACKAGE_MANIFEST_PATH,
  );
  const inputManifest = readJsonEntry<VerifierInputManifest>(
    zip.entries,
    VERIFIER_INPUT_MANIFEST_PATH,
  );
  const profile = readJsonEntry<VerifierProfile>(zip.entries, VERIFIER_PROFILE_PATH);

  validatePackageIdentity(auditManifest, inputManifest, profile, sha256Hex(auditManifestBytes));
  validateManifestEntries(auditManifest, zip.entries);

  const acceptedBallotSet = readJsonEntry<AcceptedBallotSet>(
    zip.entries,
    ACCEPTED_BALLOT_SET_PATH,
  );
  const sp04ReceiptCommitments = readJsonEntry<Sp04ReceiptCommitmentRecord[]>(
    zip.entries,
    SP04_RECEIPT_COMMITMENTS_PATH,
  );
  const sp04Evidence = readJsonEntry<Sp04Evidence>(zip.entries, SP04_EVIDENCE_PATH);

  validateAcceptedBallotSet(acceptedBallotSet, auditManifest.electionId);
  validateSp04Evidence(sp04Evidence, sp04ReceiptCommitments, auditManifest.electionId);

  return {
    identity: {
      packageId: auditManifest.packageId,
      packageHash: zip.packageHash,
      electionId: auditManifest.electionId,
      verifierProfileId: auditManifest.verifierProfileId,
    },
    acceptedBallotSet,
    sp04ReceiptCommitments,
    sp04Evidence,
    supportingVerifierOutput: readOptionalJsonEntry(zip.entries, SUPPORTING_VERIFIER_OUTPUT_PATH),
  };
}

export function normalizeZipPath(path: string): string {
  return normalizeZipPathForPackageHash(path).toLowerCase();
}

function normalizeZipPathForPackageHash(path: string): string {
  const normalized = path.replace(/\\/g, '/').trim();
  if (
    !normalized ||
    normalized.startsWith('/') ||
    normalized.startsWith('\\') ||
    normalized.includes('\0') ||
    /^[a-z]:\//i.test(normalized)
  ) {
    throw packageIssue('unsafe_zip_path', path, 'Package ZIP contains an unsafe file path.');
  }

  const segments = normalized.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw packageIssue('unsafe_zip_path', path, 'Package ZIP contains an unsafe file path.');
  }

  return normalized;
}

function readSafeZipEntries(packageZipBytes: ArrayBuffer | Uint8Array): ZipEntryMap {
  const bytes = toUint8Array(packageZipBytes);
  if (bytes.byteLength > PACKAGE_ZIP_MAX_BYTES) {
    throw packageIssue('zip_too_large', undefined, 'Package ZIP is too large.');
  }

  let rawEntries: Record<string, Uint8Array>;
  try {
    rawEntries = unzipSync(bytes);
  } catch (error) {
    throw packageIssue(
      'corrupted_zip',
      undefined,
      error instanceof Error ? error.message : 'Package ZIP could not be opened.',
    );
  }

  const sourceEntries = Object.entries(rawEntries).filter(([, entryBytes]) => entryBytes !== null);
  if (sourceEntries.length > PACKAGE_ZIP_MAX_ENTRY_COUNT) {
    throw packageIssue('zip_too_many_entries', undefined, 'Package ZIP contains too many files.');
  }

  const entries = new Map<string, Uint8Array>();
  const packageHashEntries: Array<[string, Uint8Array]> = [];
  for (const [sourcePath, entryBytes] of sourceEntries) {
    const packageHashPath = normalizeZipPathForPackageHash(sourcePath);
    const lookupPath = packageHashPath.toLowerCase();
    if (entries.has(lookupPath)) {
      throw packageIssue(
        'duplicate_zip_path',
        sourcePath,
        'Package ZIP contains duplicate normalized file paths.',
      );
    }

    if (entryBytes.byteLength > PACKAGE_ZIP_MAX_ENTRY_BYTES) {
      throw packageIssue('zip_entry_too_large', sourcePath, 'Package ZIP contains an oversized file.');
    }

    entries.set(lookupPath, entryBytes);
    packageHashEntries.push([packageHashPath, entryBytes]);
  }

  return {
    entries,
    packageHash: computeExtractedPackageHash(packageHashEntries),
  };
}

function validatePackageIdentity(
  auditManifest: AuditPackageManifest,
  inputManifest: VerifierInputManifest,
  profile: VerifierProfile,
  auditManifestHash: string,
): void {
  for (const [path, value] of [
    ['$.AuditPackageManifest.packageId', auditManifest.packageId],
    ['$.AuditPackageManifest.electionId', auditManifest.electionId],
    ['$.AuditPackageManifest.verifierProfileId', auditManifest.verifierProfileId],
    ['$.VerifierInputManifest.auditPackageManifestHash', inputManifest.auditPackageManifestHash],
    ['$.VerifierProfile.profileId', profile.profileId],
  ] as const) {
    if (typeof value !== 'string' || !value.trim()) {
      throw packageIssue('invalid_package_identity', path, 'Package identity field is missing.');
    }
  }

  if (
    auditManifest.packageId !== inputManifest.packageId ||
    auditManifest.electionId !== inputManifest.electionId ||
    auditManifest.packageView !== inputManifest.packageView ||
    auditManifest.verifierProfileId !== inputManifest.verifierProfileId ||
    auditManifest.verifierProfileId !== profile.profileId
  ) {
    throw packageIssue(
      'package_identity_mismatch',
      '$.VerifierInputManifest',
      'Package identity fields do not match across package manifests.',
    );
  }

  if (!hashMatches(inputManifest.auditPackageManifestHash, auditManifestHash)) {
    throw packageIssue(
      'audit_manifest_hash_mismatch',
      '$.VerifierInputManifest.auditPackageManifestHash',
      'Verifier input manifest does not match the audit package manifest hash.',
    );
  }
}

function validateManifestEntries(
  auditManifest: AuditPackageManifest,
  entries: Map<string, Uint8Array>,
): void {
  if (!Array.isArray(auditManifest.entries)) {
    throw packageIssue('invalid_manifest_entries', '$.entries', 'Package manifest entries are invalid.');
  }

  const manifestPaths = new Set<string>();
  for (const entry of auditManifest.entries) {
    const normalizedPath = normalizeZipPath(readManifestEntryPath(entry));
    if (manifestPaths.has(normalizedPath)) {
      throw packageIssue(
        'duplicate_manifest_path',
        entry.path,
        'Package manifest contains duplicate normalized file paths.',
      );
    }
    manifestPaths.add(normalizedPath);

    const bytes = entries.get(normalizedPath);
    if (!bytes) {
      throw packageIssue('manifest_entry_missing', entry.path, 'Manifest-listed package file is missing.');
    }

    if (entry.sizeBytes !== undefined && entry.sizeBytes !== bytes.byteLength) {
      throw packageIssue('manifest_size_mismatch', entry.path, 'Manifest-listed file size does not match.');
    }

    if (!hashMatches(entry.sha256Hash, sha256Hex(bytes))) {
      throw packageIssue('manifest_hash_mismatch', entry.path, 'Manifest-listed file hash does not match.');
    }
  }

  for (const requiredPath of [
    VERIFIER_PROFILE_PATH,
    ACCEPTED_BALLOT_SET_PATH,
    SP04_RECEIPT_COMMITMENTS_PATH,
    SP04_EVIDENCE_PATH,
  ]) {
    if (!manifestPaths.has(requiredPath.toLowerCase())) {
      throw packageIssue('required_manifest_entry_missing', requiredPath, 'Required package artifact is not listed in the manifest.');
    }
  }
}

function validateAcceptedBallotSet(accepted: AcceptedBallotSet, electionId: string): void {
  if (accepted.electionId !== electionId || !Array.isArray(accepted.acceptedBallots)) {
    throw packageIssue(
      'accepted_ballot_set_invalid',
      ACCEPTED_BALLOT_SET_PATH,
      'Accepted ballot set does not match the package election.',
    );
  }

  if (accepted.acceptedBallotCount !== accepted.acceptedBallots.length) {
    throw packageIssue(
      'accepted_ballot_count_mismatch',
      ACCEPTED_BALLOT_SET_PATH,
      'Accepted ballot count does not match accepted ballot records.',
    );
  }

  const expectedHash = computeAcceptedBallotInventoryHash(accepted.acceptedBallots);
  if (!hashMatches(accepted.acceptedBallotInventoryHash, expectedHash)) {
    throw packageIssue(
      'accepted_ballot_inventory_hash_mismatch',
      ACCEPTED_BALLOT_SET_PATH,
      'Accepted ballot inventory hash does not match accepted ballot records.',
    );
  }
}

function validateSp04Evidence(
  evidence: Sp04Evidence,
  commitments: Sp04ReceiptCommitmentRecord[],
  electionId: string,
): void {
  if (evidence.electionId !== electionId || !Array.isArray(commitments)) {
    throw packageIssue(
      'sp04_evidence_invalid',
      SP04_EVIDENCE_PATH,
      'SP-04 evidence does not match the package election.',
    );
  }

  if (evidence.acceptedBoundReceiptCount !== commitments.length) {
    throw packageIssue(
      'sp04_receipt_count_mismatch',
      SP04_EVIDENCE_PATH,
      'SP-04 receipt count does not match receipt commitment records.',
    );
  }

  const expectedHash = computeReceiptCommitmentSetHash(commitments);
  if (!hashMatches(evidence.receiptCommitmentSetHash, expectedHash)) {
    throw packageIssue(
      'sp04_receipt_set_hash_mismatch',
      SP04_EVIDENCE_PATH,
      'SP-04 receipt commitment set hash does not match receipt records.',
    );
  }
}

function comparePackageBinding(
  proof: HushVotingReceiptProof,
  identity: ReceiptVerificationPackageIdentity,
): ReceiptVerificationIssue | null {
  if (proof.electionId !== identity.electionId) {
    return {
      family: 'binding',
      code: 'wrong_election',
      message: 'Receipt election id does not match the selected package.',
    };
  }

  if (proof.expectedPackageId && proof.expectedPackageId !== identity.packageId) {
    return {
      family: 'binding',
      code: 'wrong_package_id',
      message: 'Receipt package id does not match the selected package.',
    };
  }

  if (
    proof.expectedPackageHash &&
    proof.expectedPackageHash.toLowerCase() !== identity.packageHash.toLowerCase()
  ) {
    return {
      family: 'binding',
      code: 'wrong_package_hash',
      message: 'Receipt package hash does not match the selected package.',
    };
  }

  if (
    proof.expectedVerifierProfileId &&
    proof.expectedVerifierProfileId !== identity.verifierProfileId
  ) {
    return {
      family: 'binding',
      code: 'wrong_verifier_profile',
      message: 'Receipt verifier profile does not match the selected package.',
    };
  }

  return null;
}

function findDuplicateMatchingEvidence(
  proof: HushVotingReceiptProof,
  finalizedPackage: FinalizedReceiptPackage,
): ReceiptVerificationIssue | null {
  const receiptMatches = finalizedPackage.sp04ReceiptCommitments.filter((record) =>
    receiptRecordMatchesProof(record, proof),
  );
  const acceptedMatches = finalizedPackage.acceptedBallotSet.acceptedBallots.filter((record) =>
    acceptedBallotMatchesProof(record, proof),
  );

  if (receiptMatches.length > 1 || acceptedMatches.length > 1) {
    return {
      family: 'package',
      code: 'duplicate_matching_evidence',
      message: 'Package contains duplicate matching receipt or accepted ballot evidence.',
    };
  }

  return null;
}

function findReceiptMatch(
  proof: HushVotingReceiptProof,
  finalizedPackage: FinalizedReceiptPackage,
): ReceiptVerificationMatchedEvidence | null {
  const receiptMatch = finalizedPackage.sp04ReceiptCommitments.find((record) =>
    receiptRecordMatchesProof(record, proof),
  );
  const acceptedMatch = finalizedPackage.acceptedBallotSet.acceptedBallots.find((record) =>
    acceptedBallotMatchesProof(record, proof),
  );

  if (!receiptMatch || !acceptedMatch) {
    return null;
  }

  if (proof.ballotDefinitionVersion !== undefined) {
    if (acceptedMatch.ballotDefinitionVersion !== proof.ballotDefinitionVersion) {
      return null;
    }
  }

  if (proof.ballotDefinitionHash && acceptedMatch.ballotDefinitionHash !== proof.ballotDefinitionHash) {
    return null;
  }

  return {
    receiptCommitment: proof.receiptCommitment,
    receiptCommitmentScheme: proof.receiptCommitmentScheme,
    preparedBallotHash: proof.preparedBallotHash,
  };
}

function collectVerificationWarnings(
  proof: HushVotingReceiptProof,
  finalizedPackage: FinalizedReceiptPackage,
): string[] {
  const warnings: string[] = [];
  if (!hasReceiptPackageBinding(proof)) {
    warnings.push('receipt_not_package_bound');
  }

  const output = finalizedPackage.supportingVerifierOutput;
  if (isRecord(output) && output.overallStatus && output.overallStatus !== 'pass') {
    warnings.push('supporting_verifier_output_not_pass');
  }

  return warnings;
}

function receiptRecordMatchesProof(
  record: Sp04ReceiptCommitmentRecord,
  proof: HushVotingReceiptProof,
): boolean {
  return (
    record.receiptCommitment === proof.receiptCommitment &&
    record.receiptCommitmentScheme === proof.receiptCommitmentScheme &&
    record.preparedBallotHash === proof.preparedBallotHash
  );
}

function acceptedBallotMatchesProof(
  record: AcceptedBallotRecord,
  proof: HushVotingReceiptProof,
): boolean {
  return (
    record.receiptCommitment === proof.receiptCommitment &&
    record.receiptCommitmentScheme === proof.receiptCommitmentScheme &&
    record.preparedBallotHash === proof.preparedBallotHash
  );
}

function assertPackageBindingIsCompleteOrAbsent(proof: HushVotingReceiptProof): void {
  const presentCount = [
    proof.expectedPackageId,
    proof.expectedPackageHash,
    proof.expectedVerifierProfileId,
  ].filter(Boolean).length;

  if (presentCount > 0 && presentCount < 3) {
    throw new ReceiptValidationError({
      code: 'missing_required_field',
      path: '$.receiptProof.expectedPackageId',
      message: 'Package binding fields must be present together or omitted together.',
    });
  }
}

function readJsonEntry<T>(entries: Map<string, Uint8Array>, path: string): T {
  const bytes = readRequiredEntry(entries, path);
  if (bytes.byteLength > PACKAGE_JSON_MAX_BYTES) {
    throw packageIssue('json_entry_too_large', path, 'Package JSON artifact is too large.');
  }

  const source = TEXT_DECODER.decode(bytes);
  try {
    assertNoDuplicateJsonKeys(source);
    return JSON.parse(source) as T;
  } catch (error) {
    throw packageIssue(
      'invalid_package_json',
      path,
      error instanceof Error ? error.message : 'Package JSON artifact is malformed.',
    );
  }
}

function readOptionalJsonEntry(
  entries: Map<string, Uint8Array>,
  path: string,
): unknown | undefined {
  if (!entries.has(path.toLowerCase())) {
    return undefined;
  }

  return readJsonEntry<unknown>(entries, path);
}

function readRequiredEntry(entries: Map<string, Uint8Array>, path: string): Uint8Array {
  const bytes = entries.get(path.toLowerCase());
  if (!bytes) {
    throw packageIssue('required_file_missing', path, 'Required package file is missing.');
  }

  return bytes;
}

function readManifestEntryPath(entry: AuditPackageManifestEntry): string {
  if (!entry || typeof entry.path !== 'string' || !entry.path.trim()) {
    throw packageIssue('invalid_manifest_entry_path', '$.entries[].path', 'Manifest entry path is invalid.');
  }

  if (typeof entry.sha256Hash !== 'string' || !entry.sha256Hash.trim()) {
    throw packageIssue('invalid_manifest_entry_hash', entry.path, 'Manifest entry hash is invalid.');
  }

  return entry.path;
}

function computeAcceptedBallotInventoryHash(ballots: AcceptedBallotRecord[]): string {
  const payload = ballots
    .slice()
    .sort((left, right) => compareOrdinal(left.ballotNullifier, right.ballotNullifier))
    .map((ballot) =>
      [
        ballot.ballotNullifier,
        sha256UpperHexFromText(ballot.encryptedBallotPackage),
        sha256UpperHexFromText(ballot.proofBundle),
      ].join('|'),
    )
    .join('\n');

  return sha256Hex(new TextEncoder().encode(payload));
}

export function computeReceiptCommitmentSetHash(
  commitments: Sp04ReceiptCommitmentRecord[],
): string {
  const payload = commitments
    .slice()
    .sort((left, right) =>
      compareOrdinal(stripUuidDashes(left.acceptedBallotId), stripUuidDashes(right.acceptedBallotId)),
    )
    .map((record) =>
      [
        stripUuidDashes(record.acceptedBallotId),
        stripUuidDashes(record.preparedBallotId),
        record.preparedBallotHash,
        record.receiptCommitment,
        record.receiptCommitmentScheme,
        toDotNetRoundTripUtc(record.acceptedAt),
      ].join('|'),
    )
    .join('\n');

  return sha256UpperHexFromText(payload);
}

function computeExtractedPackageHash(entries: Array<[string, Uint8Array]>): string {
  const payload = entries
    .slice()
    .sort(([left], [right]) => compareOrdinal(left, right))
    .map(([path, bytes]) => `${path}|${sha256PrefixedHex(bytes)}`)
    .join('\n');

  return sha256PrefixedHex(new TextEncoder().encode(`${payload}\n`));
}

function compareOrdinal(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

function stripUuidDashes(value: string): string {
  if (!UUID_WITH_DASHES_PATTERN.test(value)) {
    throw packageIssue('invalid_uuid', value, 'Package receipt commitment id is invalid.');
  }

  return value.replace(/-/g, '').toLowerCase();
}

function toDotNetRoundTripUtc(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw packageIssue('invalid_timestamp', value, 'Package timestamp is invalid.');
  }

  return parsed.toISOString().replace('.000Z', '.0000000Z');
}

function hashMatches(left: string, right: string): boolean {
  return normalizeHash(left) === normalizeHash(right);
}

function normalizeHash(value: string): string {
  return value.toLowerCase().replace(/^sha256:/, '');
}

function sha256Hex(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}

function sha256PrefixedHex(bytes: Uint8Array): string {
  return `sha256:${sha256Hex(bytes)}`;
}

function sha256UpperHexFromText(value: string): string {
  return sha256Hex(new TextEncoder().encode(value ?? '')).toUpperCase();
}

function toUint8Array(bytes: ArrayBuffer | Uint8Array): Uint8Array {
  return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function mapReceiptValidationIssue(error: unknown): ReceiptVerificationIssue {
  if (error instanceof ReceiptValidationError) {
    return {
      family: 'receipt',
      code: error.issue.code,
      path: error.issue.path,
      message: error.issue.message,
    };
  }

  return {
    family: 'receipt',
    code: 'invalid_receipt',
    message: error instanceof Error ? error.message : 'Receipt JSON is invalid.',
  };
}

function packageIssue(
  code: string,
  path: string | undefined,
  message: string,
): PackageValidationError {
  return new PackageValidationError({
    family: 'package',
    code,
    path,
    message,
  });
}
