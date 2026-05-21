import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  ACCEPTED_BALLOT_SET_PATH,
  AUDIT_PACKAGE_MANIFEST_PATH,
  parseFinalizedPublicPackageZip,
  SP04_EVIDENCE_PATH,
  SP04_RECEIPT_COMMITMENTS_PATH,
  SUPPORTING_VERIFIER_OUTPUT_PATH,
  VERIFIER_INPUT_MANIFEST_PATH,
  VERIFIER_PROFILE_PATH,
  verifyReceiptInPackage,
} from './packageVerifier';
import {
  FEAT136_RECEIPT_FIXTURES,
  FEAT136_SAMPLE_ELECTION_ID,
  FEAT136_SAMPLE_PACKAGE_ID,
  FEAT136_SAMPLE_PREPARED_BALLOT_HASH,
  FEAT136_SAMPLE_RECEIPT_COMMITMENT,
  FEAT136_SAMPLE_RECEIPT_COMMITMENT_SCHEME,
  FEAT136_SAMPLE_VERIFIER_PROFILE_ID,
} from './fixtures';

const encoder = new TextEncoder();

interface PackageFixtureBuildOptions {
  omitReceipt?: boolean;
  duplicateMatchingEvidence?: boolean;
  manifestHashMismatch?: boolean;
  supportingVerifierOutput?: Record<string, unknown>;
}

describe('FEAT-136 package verifier', () => {
  it('returns verified_included for a package-bound receipt', () => {
    const packageFixture = buildPackageZip();
    const receiptJson = receiptJsonWithPackageHash(packageFixture.packageHash);

    const result = verifyReceiptInPackage({
      receiptJson,
      packageZipBytes: packageFixture.bytes,
    });

    expect(result.category).toBe('verified_included');
    expect(result.packageIdentity?.packageHash).toBe(packageFixture.packageHash);
    expect(result.matchedEvidence?.receiptCommitment).toBe(FEAT136_SAMPLE_RECEIPT_COMMITMENT);
  });

  it('returns verified_included_with_warnings for a package-less receipt', () => {
    const packageFixture = buildPackageZip();
    const result = verifyReceiptInPackage({
      receiptJson: getReceiptJson('receipt-package-less-good'),
      packageZipBytes: packageFixture.bytes,
    });

    expect(result.category).toBe('verified_included_with_warnings');
    expect(result.warnings).toContain('receipt_not_package_bound');
  });

  it('keeps inclusion valid when supporting verifier output has a warning status', () => {
    const packageFixture = buildPackageZip({
      supportingVerifierOutput: {
        outputVersion: '1.0',
        overallStatus: 'fail',
        resultCode: 'supporting-output-failed',
      },
    });

    const result = verifyReceiptInPackage({
      receiptJson: receiptJsonWithPackageHash(packageFixture.packageHash),
      packageZipBytes: packageFixture.bytes,
    });

    expect(result.category).toBe('verified_included_with_warnings');
    expect(result.warnings).toContain('supporting_verifier_output_not_pass');
  });

  it('returns not_found when the receipt is absent even if supporting output says pass', () => {
    const packageFixture = buildPackageZip({
      omitReceipt: true,
      supportingVerifierOutput: {
        outputVersion: '1.0',
        overallStatus: 'pass',
      },
    });

    const result = verifyReceiptInPackage({
      receiptJson: receiptJsonWithPackageHash(packageFixture.packageHash),
      packageZipBytes: packageFixture.bytes,
    });

    expect(result.category).toBe('not_found');
    expect(result.issues[0]?.code).toBe('receipt_not_found');
  });

  it('returns wrong_package when the package binding points elsewhere', () => {
    const packageFixture = buildPackageZip();
    const result = verifyReceiptInPackage({
      receiptJson: getReceiptJson('receipt-wrong-package-binding'),
      packageZipBytes: packageFixture.bytes,
    });

    expect(result.category).toBe('wrong_package');
    expect(result.issues[0]?.family).toBe('binding');
  });

  it('returns invalid_receipt for malformed or partial binding receipts', () => {
    const packageFixture = buildPackageZip();
    const partialBinding = JSON.parse(receiptJsonWithPackageHash(packageFixture.packageHash));
    delete partialBinding.receiptProof.expectedPackageHash;

    expect(
      verifyReceiptInPackage({
        receiptJson: getReceiptJson('receipt-malformed-json'),
        packageZipBytes: packageFixture.bytes,
      }).category,
    ).toBe('invalid_receipt');
    expect(
      verifyReceiptInPackage({
        receiptJson: JSON.stringify(partialBinding),
        packageZipBytes: packageFixture.bytes,
      }).category,
    ).toBe('invalid_receipt');
  });

  it('returns package_unavailable when no finalized package is provided', () => {
    const result = verifyReceiptInPackage({
      receiptJson: getReceiptJson('receipt-package-less-good'),
      packageZipBytes: null,
    });

    expect(result.category).toBe('package_unavailable');
  });

  it('returns verification_unavailable for unexpected verifier runtime failures', () => {
    const result = verifyReceiptInPackage({
      receiptJson: getReceiptJson('receipt-package-less-good'),
      packageZipBytes: new Uint8Array([1]),
      packageReader: () => {
        throw new Error('simulated runtime failure');
      },
    });

    expect(result.category).toBe('verification_unavailable');
    expect(result.issues[0]?.family).toBe('runtime');
  });

  it('rejects corrupted ZIP, unsafe paths, duplicate normalized paths, and manifest mismatches', () => {
    expect(
      verifyReceiptInPackage({
        receiptJson: getReceiptJson('receipt-package-less-good'),
        packageZipBytes: new Uint8Array([1, 2, 3]),
      }).category,
    ).toBe('invalid_package');

    expect(() =>
      parseFinalizedPublicPackageZip(zipSync({ '../AuditPackageManifest.json': jsonBytes({}) })),
    ).toThrow(/unsafe file path/i);

    expect(() =>
      parseFinalizedPublicPackageZip(
        zipSync({
          'AuditPackageManifest.json': jsonBytes({}),
          'auditpackagemanifest.json': jsonBytes({}),
        }),
      ),
    ).toThrow(/duplicate normalized/i);

    const manifestMismatch = verifyReceiptInPackage({
      receiptJson: getReceiptJson('receipt-package-less-good'),
      packageZipBytes: buildPackageZip({ manifestHashMismatch: true }).bytes,
    });
    expect(manifestMismatch.category).toBe('invalid_package');
    expect(manifestMismatch.issues[0]?.code).toBe('manifest_hash_mismatch');
  });

  it('rejects duplicate matching evidence as invalid_package', () => {
    const packageFixture = buildPackageZip({ duplicateMatchingEvidence: true });
    const result = verifyReceiptInPackage({
      receiptJson: receiptJsonWithPackageHash(packageFixture.packageHash),
      packageZipBytes: packageFixture.bytes,
    });

    expect(result.category).toBe('invalid_package');
    expect(result.issues[0]?.code).toBe('duplicate_matching_evidence');
  });
});

function getReceiptJson(fixtureId: string): string {
  const fixture = FEAT136_RECEIPT_FIXTURES.find((item) => item.fixtureId === fixtureId);
  if (!fixture?.receiptJson) {
    throw new Error(`Missing receipt fixture ${fixtureId}.`);
  }

  return fixture.receiptJson;
}

function receiptJsonWithPackageHash(packageHash: string): string {
  const receipt = JSON.parse(getReceiptJson('receipt-package-bound-good'));
  receipt.receiptProof.expectedPackageHash = packageHash;
  return JSON.stringify(receipt);
}

function buildPackageZip(options: PackageFixtureBuildOptions = {}): {
  bytes: Uint8Array;
  packageHash: string;
} {
  const acceptedBallots = [
    acceptedBallot('nullifier-a', FEAT136_SAMPLE_RECEIPT_COMMITMENT),
    acceptedBallot('nullifier-b', 'receipt-b', 'prepared-final-b'),
  ];
  if (options.duplicateMatchingEvidence) {
    acceptedBallots.push(acceptedBallot('nullifier-c', FEAT136_SAMPLE_RECEIPT_COMMITMENT));
  }

  const receiptCommitments = options.omitReceipt
    ? [receiptCommitment('receipt-b', 'prepared-final-b')]
    : [receiptCommitment(FEAT136_SAMPLE_RECEIPT_COMMITMENT)];
  if (options.duplicateMatchingEvidence) {
    receiptCommitments.push(
      receiptCommitment(
        FEAT136_SAMPLE_RECEIPT_COMMITMENT,
        FEAT136_SAMPLE_PREPARED_BALLOT_HASH,
        'f0b6f3f8-0b67-478f-9857-9ac6dd9a1afb',
        'be08cb9d-647a-4c31-9359-57c2f2c563fa',
      ),
    );
  }

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

  if (options.supportingVerifierOutput) {
    files[SUPPORTING_VERIFIER_OUTPUT_PATH] = jsonBytes(options.supportingVerifierOutput);
  }

  const manifestEntries = Object.entries(files).map(([path, bytes]) => ({
    path,
    sha256Hash: options.manifestHashMismatch && path === ACCEPTED_BALLOT_SET_PATH
      ? '0'.repeat(64)
      : sha256Hex(bytes),
    sizeBytes: bytes.byteLength,
    mediaType: 'application/json',
    visibility: 'public',
    requirement: 'required',
    requiredProfileIds: [FEAT136_SAMPLE_VERIFIER_PROFILE_ID],
  }));

  const auditManifest = {
    manifestVersion: '1.0',
    packageId: FEAT136_SAMPLE_PACKAGE_ID,
    electionId: FEAT136_SAMPLE_ELECTION_ID,
    packageView: 'publicAnonymous',
    verifierProfileId: FEAT136_SAMPLE_VERIFIER_PROFILE_ID,
    createdAt: '2026-05-21T10:00:00Z',
    entries: manifestEntries,
  };
  files[AUDIT_PACKAGE_MANIFEST_PATH] = jsonBytes(auditManifest);
  files[VERIFIER_INPUT_MANIFEST_PATH] = jsonBytes({
    manifestVersion: '1.0',
    packageId: FEAT136_SAMPLE_PACKAGE_ID,
    electionId: FEAT136_SAMPLE_ELECTION_ID,
    packageView: 'publicAnonymous',
    verifierProfileId: FEAT136_SAMPLE_VERIFIER_PROFILE_ID,
    auditPackageManifestHash: sha256Hex(files[AUDIT_PACKAGE_MANIFEST_PATH]),
  });

  return {
    bytes: zipSync(files),
    packageHash: packageDirectoryHash(files),
  };
}

function acceptedBallot(
  ballotNullifier: string,
  receiptCommitmentValue: string,
  preparedBallotHash = FEAT136_SAMPLE_PREPARED_BALLOT_HASH,
): Record<string, unknown> {
  return {
    ballotNullifier,
    encryptedBallotPackage: `ballot-${ballotNullifier}`,
    proofBundle: `proof-${ballotNullifier}`,
    preparedBallotHash,
    receiptCommitment: receiptCommitmentValue,
    receiptCommitmentScheme: FEAT136_SAMPLE_RECEIPT_COMMITMENT_SCHEME,
    ballotDefinitionVersion: 1,
    ballotDefinitionHash: 'NRASoflgGqzNd3Y/lR7Haz1FDI2k5Pzhj5YChdYFfHc=',
  };
}

function receiptCommitment(
  receiptCommitmentValue: string,
  preparedBallotHash = FEAT136_SAMPLE_PREPARED_BALLOT_HASH,
  acceptedBallotId = 'ab2e6a0b-62b9-4a2a-a07d-65da60d3e3ab',
  preparedBallotId = 'e1be878a-cc73-4abd-a428-898745de47bc',
): Record<string, unknown> {
  return {
    acceptedBallotId,
    preparedBallotId,
    acceptedAt: '2026-05-19T23:34:00Z',
    preparedBallotHash,
    receiptCommitment: receiptCommitmentValue,
    receiptCommitmentScheme: FEAT136_SAMPLE_RECEIPT_COMMITMENT_SCHEME,
  };
}

function acceptedBallotInventoryHash(ballots: Record<string, unknown>[]): string {
  const payload = ballots
    .slice()
    .sort((left, right) =>
      compareOrdinal(String(left.ballotNullifier), String(right.ballotNullifier)),
    )
    .map((ballot) =>
      [
        ballot.ballotNullifier,
        sha256UpperHex(String(ballot.encryptedBallotPackage)),
        sha256UpperHex(String(ballot.proofBundle)),
      ].join('|'),
    )
    .join('\n');

  return sha256Hex(encoder.encode(payload));
}

function receiptCommitmentSetHash(records: Record<string, unknown>[]): string {
  const payload = records
    .slice()
    .sort((left, right) =>
      compareOrdinal(stripUuidDashes(String(left.acceptedBallotId)), stripUuidDashes(String(right.acceptedBallotId))),
    )
    .map((record) =>
      [
        stripUuidDashes(String(record.acceptedBallotId)),
        stripUuidDashes(String(record.preparedBallotId)),
        record.preparedBallotHash,
        record.receiptCommitment,
        record.receiptCommitmentScheme,
        '2026-05-19T23:34:00.0000000Z',
      ].join('|'),
    )
    .join('\n');

  return sha256UpperHex(payload);
}

function packageDirectoryHash(files: Record<string, Uint8Array>): string {
  const payload = Object.entries(files)
    .sort(([left], [right]) => compareOrdinal(left, right))
    .map(([path, bytes]) => `${path}|sha256:${sha256Hex(bytes)}`)
    .join('\n');

  return `sha256:${sha256Hex(encoder.encode(`${payload}\n`))}`;
}

function jsonBytes(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value, null, 2));
}

function sha256Hex(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}

function sha256UpperHex(value: string): string {
  return sha256Hex(encoder.encode(value)).toUpperCase();
}

function stripUuidDashes(value: string): string {
  return value.replace(/-/g, '').toLowerCase();
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
