import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  ACCEPTED_BALLOT_SET_PATH,
  AUDIT_PACKAGE_MANIFEST_PATH,
  SP04_EVIDENCE_PATH,
  SP04_RECEIPT_COMMITMENTS_PATH,
  VERIFIER_INPUT_MANIFEST_PATH,
  VERIFIER_PROFILE_PATH,
  parseFinalizedPublicPackageZip,
  verifyReceiptInPackage,
} from './packageVerifier';
import {
  buildCompactReceiptLookupIndex,
  computeCompactReceiptCode,
  normalizeCompactReceiptCode,
  packageHintForIdentity,
  resolveCompactReceiptCode,
} from './compactCode';
import {
  FEAT136_SAMPLE_BALLOT_DEFINITION_HASH,
  FEAT136_SAMPLE_ELECTION_ID,
  FEAT136_SAMPLE_PACKAGE_ID,
  FEAT136_SAMPLE_PREPARED_BALLOT_HASH,
  FEAT136_SAMPLE_RECEIPT_COMMITMENT,
  FEAT136_SAMPLE_RECEIPT_COMMITMENT_SCHEME,
  FEAT136_SAMPLE_VERIFIER_PROFILE_ID,
} from './fixtures';

const encoder = new TextEncoder();

describe('FEAT-159 package-bound compact receipt code', () => {
  it('normalizes human-entered compact codes', () => {
    const packageFixture = buildPackageZip();
    const finalizedPackage = parseFinalizedPublicPackageZip(packageFixture.bytes);
    const code = computeCompactReceiptCode({
      identity: finalizedPackage.identity,
      receiptCommitment: FEAT136_SAMPLE_RECEIPT_COMMITMENT,
      receiptCommitmentScheme: FEAT136_SAMPLE_RECEIPT_COMMITMENT_SCHEME,
      preparedBallotHash: FEAT136_SAMPLE_PREPARED_BALLOT_HASH,
    });

    expect(normalizeCompactReceiptCode(code.toLowerCase().replace(/-/g, ' '))).toEqual(
      normalizeCompactReceiptCode(code),
    );
  });

  it('resolves a compact code into a package-bound receipt proof', () => {
    const packageFixture = buildPackageZip();
    const finalizedPackage = parseFinalizedPublicPackageZip(packageFixture.bytes);
    const code = computeCompactReceiptCode({
      identity: finalizedPackage.identity,
      receiptCommitment: FEAT136_SAMPLE_RECEIPT_COMMITMENT,
      receiptCommitmentScheme: FEAT136_SAMPLE_RECEIPT_COMMITMENT_SCHEME,
      preparedBallotHash: FEAT136_SAMPLE_PREPARED_BALLOT_HASH,
    });

    const lookup = resolveCompactReceiptCode({
      compactCode: code,
      packageZipBytes: packageFixture.bytes,
    });

    expect(lookup.category).toBe('resolved');
    expect(lookup.entry?.receiptCommitment).toBe(FEAT136_SAMPLE_RECEIPT_COMMITMENT);
    expect(lookup.entry?.receiptExport.receiptProof.expectedPackageHash).toBe(
      finalizedPackage.identity.packageHash,
    );

    const verification = verifyReceiptInPackage({
      receiptJson: lookup.entry?.receiptJson ?? '',
      packageZipBytes: packageFixture.bytes,
    });
    expect(verification.category).toBe('verified_included');
  });

  it('fails malformed compact codes before package lookup', () => {
    const result = resolveCompactReceiptCode({
      compactCode: 'not-a-compact-code',
      packageZipBytes: buildPackageZip().bytes,
    });

    expect(result.category).toBe('invalid_receipt');
    expect(result.issues[0]?.code).toBe('compact_code_malformed');
  });

  it('returns wrong_package when the package hint differs', () => {
    const packageFixture = buildPackageZip();
    const finalizedPackage = parseFinalizedPublicPackageZip(packageFixture.bytes);
    const code = computeCompactReceiptCode({
      identity: {
        ...finalizedPackage.identity,
        packageHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
      receiptCommitment: FEAT136_SAMPLE_RECEIPT_COMMITMENT,
      receiptCommitmentScheme: FEAT136_SAMPLE_RECEIPT_COMMITMENT_SCHEME,
      preparedBallotHash: FEAT136_SAMPLE_PREPARED_BALLOT_HASH,
    });

    const result = resolveCompactReceiptCode({
      compactCode: code,
      packageZipBytes: packageFixture.bytes,
    });

    expect(result.category).toBe('wrong_package');
    expect(result.issues[0]?.code).toBe('compact_code_wrong_package');
  });

  it('returns not_found for a well-formed code with the selected package hint but no matching proof', () => {
    const packageFixture = buildPackageZip();
    const finalizedPackage = parseFinalizedPublicPackageZip(packageFixture.bytes);
    const packageHint = packageHintForIdentity(finalizedPackage.identity);

    const result = resolveCompactReceiptCode({
      compactCode: `HVC1-${packageHint}-AAAA-AAAA-AAAA`,
      packageZipBytes: packageFixture.bytes,
    });

    expect(result.category).toBe('not_found');
    expect(result.issues[0]?.code).toBe('compact_code_not_found');
  });

  it('detects ambiguous compact-code mappings in package evidence', () => {
    const packageFixture = buildPackageZip();
    const finalizedPackage = parseFinalizedPublicPackageZip(packageFixture.bytes);
    const duplicateCode = computeCompactReceiptCode({
      identity: finalizedPackage.identity,
      receiptCommitment: FEAT136_SAMPLE_RECEIPT_COMMITMENT,
      receiptCommitmentScheme: FEAT136_SAMPLE_RECEIPT_COMMITMENT_SCHEME,
      preparedBallotHash: FEAT136_SAMPLE_PREPARED_BALLOT_HASH,
    });

    const duplicateIndex = buildCompactReceiptLookupIndex(finalizedPackage, () => duplicateCode);
    expect(duplicateIndex.get(duplicateCode)).toHaveLength(2);

    const result = resolveCompactReceiptCode({
      compactCode: duplicateCode,
      packageZipBytes: packageFixture.bytes,
      codeFactory: () => duplicateCode,
    });

    expect(result.category).toBe('invalid_package');
    expect(result.issues[0]?.code).toBe('compact_code_ambiguous');
  });
});

function buildPackageZip(): {
  bytes: Uint8Array;
  packageHash: string;
} {
  const acceptedBallots = [
    acceptedBallot('nullifier-a', FEAT136_SAMPLE_RECEIPT_COMMITMENT),
    acceptedBallot('nullifier-b', 'receipt-b', 'prepared-final-b'),
  ];
  const receiptCommitments = [
    receiptCommitment(FEAT136_SAMPLE_RECEIPT_COMMITMENT),
    receiptCommitment('receipt-b', 'prepared-final-b'),
  ];
  const files: Record<string, Uint8Array> = {
    'ElectionRecord.json': jsonBytes({
      electionId: FEAT136_SAMPLE_ELECTION_ID,
      lifecycleState: 'Finalized',
    }),
    [VERIFIER_PROFILE_PATH]: jsonBytes({
      profileId: FEAT136_SAMPLE_VERIFIER_PROFILE_ID,
      displayName: FEAT136_SAMPLE_VERIFIER_PROFILE_ID,
    }),
    [ACCEPTED_BALLOT_SET_PATH]: jsonBytes({
      electionId: FEAT136_SAMPLE_ELECTION_ID,
      acceptedBallotCount: acceptedBallots.length,
      acceptedBallotInventoryHash: acceptedBallotInventoryHash(acceptedBallots),
      acceptedBallots,
    }),
    [SP04_RECEIPT_COMMITMENTS_PATH]: jsonBytes(receiptCommitments),
    [SP04_EVIDENCE_PATH]: jsonBytes({
      electionId: FEAT136_SAMPLE_ELECTION_ID,
      acceptedBoundReceiptCount: receiptCommitments.length,
      receiptCommitmentSetHash: receiptCommitmentSetHash(receiptCommitments),
    }),
  };

  const auditManifest = {
    manifestVersion: '1.0',
    packageId: FEAT136_SAMPLE_PACKAGE_ID,
    electionId: FEAT136_SAMPLE_ELECTION_ID,
    packageView: 'public',
    verifierProfileId: FEAT136_SAMPLE_VERIFIER_PROFILE_ID,
    entries: Object.entries(files).map(([path, bytes]) => ({
      path,
      sha256Hash: sha256Hex(bytes),
      sizeBytes: bytes.byteLength,
    })),
  };
  const auditManifestBytes = jsonBytes(auditManifest);
  const verifierInputManifest = {
    manifestVersion: '1.0',
    packageId: FEAT136_SAMPLE_PACKAGE_ID,
    electionId: FEAT136_SAMPLE_ELECTION_ID,
    packageView: 'public',
    verifierProfileId: FEAT136_SAMPLE_VERIFIER_PROFILE_ID,
    auditPackageManifestHash: sha256Hex(auditManifestBytes),
  };

  const zipEntries = {
    ...files,
    [AUDIT_PACKAGE_MANIFEST_PATH]: auditManifestBytes,
    [VERIFIER_INPUT_MANIFEST_PATH]: jsonBytes(verifierInputManifest),
  };
  const bytes = zipSync(zipEntries);
  return {
    bytes,
    packageHash: packageHash(zipEntries),
  };
}

function acceptedBallot(
  ballotNullifier: string,
  receiptCommitment: string,
  preparedBallotHash: string = FEAT136_SAMPLE_PREPARED_BALLOT_HASH,
): Record<string, unknown> {
  return {
    ballotNullifier,
    encryptedBallotPackage: `encrypted-${ballotNullifier}`,
    proofBundle: `proof-${ballotNullifier}`,
    preparedBallotHash,
    receiptCommitment,
    receiptCommitmentScheme: FEAT136_SAMPLE_RECEIPT_COMMITMENT_SCHEME,
    ballotDefinitionVersion: 1,
    ballotDefinitionHash: FEAT136_SAMPLE_BALLOT_DEFINITION_HASH,
  };
}

function receiptCommitment(
  receiptCommitmentValue: string,
  preparedBallotHash: string = FEAT136_SAMPLE_PREPARED_BALLOT_HASH,
): Record<string, unknown> {
  return {
    acceptedBallotId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    preparedBallotId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    acceptedAt: '2026-05-21T10:00:00.0000000Z',
    preparedBallotHash,
    receiptCommitment: receiptCommitmentValue,
    receiptCommitmentScheme: FEAT136_SAMPLE_RECEIPT_COMMITMENT_SCHEME,
  };
}

function acceptedBallotInventoryHash(ballots: Array<Record<string, unknown>>): string {
  const payload = ballots
    .slice()
    .sort((left, right) =>
      String(left.ballotNullifier).localeCompare(String(right.ballotNullifier)),
    )
    .map((ballot) =>
      [
        ballot.ballotNullifier,
        sha256UpperHexFromText(String(ballot.encryptedBallotPackage)),
        sha256UpperHexFromText(String(ballot.proofBundle)),
      ].join('|'),
    )
    .join('\n');

  return sha256Hex(encoder.encode(payload));
}

function receiptCommitmentSetHash(commitments: Array<Record<string, unknown>>): string {
  const payload = commitments
    .slice()
    .sort((left, right) =>
      stripUuidDashes(String(left.acceptedBallotId)).localeCompare(
        stripUuidDashes(String(right.acceptedBallotId)),
      ),
    )
    .map((record) =>
      [
        stripUuidDashes(String(record.acceptedBallotId)),
        stripUuidDashes(String(record.preparedBallotId)),
        record.preparedBallotHash,
        record.receiptCommitment,
        record.receiptCommitmentScheme,
        String(record.acceptedAt),
      ].join('|'),
    )
    .join('\n');

  return sha256UpperHexFromText(payload);
}

function packageHash(entries: Record<string, Uint8Array>): string {
  const payload = Object.entries(entries)
    .slice()
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, bytes]) => `${path}|sha256:${sha256Hex(bytes)}`)
    .join('\n');

  return `sha256:${sha256Hex(encoder.encode(`${payload}\n`))}`;
}

function jsonBytes(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value));
}

function sha256Hex(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}

function sha256UpperHexFromText(value: string): string {
  return sha256Hex(encoder.encode(value)).toUpperCase();
}

function stripUuidDashes(value: string): string {
  return value.replace(/-/g, '').toLowerCase();
}
