import { describe, expect, it } from 'vitest';
import { parseReceiptExportJson, ReceiptValidationError } from './contracts';
import {
  FEAT136_PACKAGE_FIXTURES,
  FEAT136_RECEIPT_FIXTURES,
  RECEIPT_VERIFICATION_LIMITS,
  scanReceiptFixtureForForbiddenMaterial,
  validateTelemetryFieldPolicy,
} from './fixtures';

const REQUIRED_RECEIPT_FIXTURE_IDS = [
  'receipt-package-bound-good',
  'receipt-package-less-good',
  'receipt-malformed-json',
  'receipt-unknown-proof-field',
  'receipt-wrong-package-binding',
  'receipt-missing',
];

const REQUIRED_PACKAGE_FIXTURE_IDS = [
  'package-good-public-finalized',
  'package-corrupted-zip',
  'package-unsafe-path',
  'package-manifest-mismatch',
  'package-duplicate-matching-evidence',
  'package-wrong-package',
  'package-missing-receipt',
];

describe('FEAT-136 receipt and package fixture definitions', () => {
  it('defines all required receipt fixture cases with expected result categories', () => {
    expect(FEAT136_RECEIPT_FIXTURES.map((fixture) => fixture.fixtureId)).toEqual(
      REQUIRED_RECEIPT_FIXTURE_IDS,
    );
    expect(FEAT136_RECEIPT_FIXTURES.map((fixture) => fixture.expectedResult)).toEqual([
      'verified_included',
      'verified_included_with_warnings',
      'invalid_receipt',
      'invalid_receipt',
      'wrong_package',
      'not_found',
    ]);
  });

  it('defines all required package fixture/tamper cases with expected result categories', () => {
    expect(FEAT136_PACKAGE_FIXTURES.map((fixture) => fixture.fixtureId)).toEqual(
      REQUIRED_PACKAGE_FIXTURE_IDS,
    );
    expect(FEAT136_PACKAGE_FIXTURES.map((fixture) => fixture.expectedResult)).toEqual([
      'verified_included',
      'invalid_package',
      'invalid_package',
      'invalid_package',
      'invalid_package',
      'wrong_package',
      'not_found',
    ]);
  });

  it('keeps good receipt fixtures parseable and package binding explicit', () => {
    const goodReceipts = FEAT136_RECEIPT_FIXTURES.filter((fixture) =>
      fixture.fixtureKind.endsWith('_good'),
    );

    for (const fixture of goodReceipts) {
      const receipt = parseReceiptExportJson(fixture.receiptJson ?? '');
      expect(Boolean(receipt.receiptProof.expectedPackageId)).toBe(fixture.packageBound);
      expect(Boolean(receipt.receiptProof.expectedPackageHash)).toBe(fixture.packageBound);
      expect(Boolean(receipt.receiptProof.expectedVerifierProfileId)).toBe(fixture.packageBound);
    }
  });

  it('keeps malformed/strict-failure receipt fixtures deterministic', () => {
    const invalidReceipts = FEAT136_RECEIPT_FIXTURES.filter(
      (fixture) => fixture.expectedResult === 'invalid_receipt',
    );

    for (const fixture of invalidReceipts) {
      expect(() => parseReceiptExportJson(fixture.receiptJson ?? '')).toThrow(
        ReceiptValidationError,
      );
    }
  });

  it('keeps public receipt fixtures free from forbidden private material', () => {
    const findings = FEAT136_RECEIPT_FIXTURES.flatMap((fixture) =>
      fixture.receiptJson
        ? scanReceiptFixtureForForbiddenMaterial(fixture.receiptJson).map(
            (finding) => `${fixture.fixtureId}:${finding}`,
          )
        : [],
    );

    expect(findings).toEqual([]);
  });

  it('defines bounded v1 browser verification limits', () => {
    expect(RECEIPT_VERIFICATION_LIMITS).toEqual({
      receiptFileMaxBytes: 1024 * 1024,
      packageZipMaxBytes: 50 * 1024 * 1024,
      packageZipMaxEntryCount: 512,
      packageZipMaxEntryBytes: 10 * 1024 * 1024,
      packageJsonMaxBytes: 5 * 1024 * 1024,
    });
  });

  it('keeps telemetry field policy privacy-safe', () => {
    expect(validateTelemetryFieldPolicy()).toEqual([]);
  });
});
