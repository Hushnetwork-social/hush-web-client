import { describe, expect, it } from 'vitest';
import {
  canonicalizeReceiptProof,
  hasReceiptPackageBinding,
  parseReceiptExportJson,
  ReceiptValidationError,
} from './contracts';
import {
  FEAT136_RECEIPT_FIXTURES,
  FEAT136_SAMPLE_PACKAGE_HASH,
} from './fixtures';

function getReceipt(fixtureId: string): string {
  const fixture = FEAT136_RECEIPT_FIXTURES.find((item) => item.fixtureId === fixtureId);
  if (!fixture?.receiptJson) {
    throw new Error(`Fixture ${fixtureId} does not contain receipt JSON.`);
  }

  return fixture.receiptJson;
}

function expectReceiptValidationError(action: () => unknown): ReceiptValidationError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(ReceiptValidationError);
    return error as ReceiptValidationError;
  }

  throw new Error('Expected a ReceiptValidationError.');
}

describe('FEAT-136 receipt contract', () => {
  it('parses a package-bound receipt and normalizes package hash casing', () => {
    const receipt = parseReceiptExportJson(
      getReceipt('receipt-package-bound-good').replace(
        FEAT136_SAMPLE_PACKAGE_HASH,
        FEAT136_SAMPLE_PACKAGE_HASH.toUpperCase(),
      ),
    );

    expect(receipt.schema).toBe('hushvoting.receipt.export');
    expect(receipt.schemaVersion).toBe(1);
    expect(receipt.receiptProof.expectedPackageHash).toBe(FEAT136_SAMPLE_PACKAGE_HASH);
    expect(hasReceiptPackageBinding(receipt.receiptProof)).toBe(true);
  });

  it('parses a package-less receipt without producing package binding', () => {
    const receipt = parseReceiptExportJson(getReceipt('receipt-package-less-good'));

    expect(receipt.receiptProof.expectedPackageId).toBeUndefined();
    expect(receipt.receiptProof.expectedPackageHash).toBeUndefined();
    expect(receipt.receiptProof.expectedVerifierProfileId).toBeUndefined();
    expect(hasReceiptPackageBinding(receipt.receiptProof)).toBe(false);
  });

  it('canonicalizes receiptProof only and ignores envelope timestamp changes', () => {
    const base = parseReceiptExportJson(getReceipt('receipt-package-bound-good'));
    const changedEnvelope = parseReceiptExportJson(
      getReceipt('receipt-package-bound-good').replace(
        '2026-05-21T10:00:00Z',
        '2026-05-21T11:30:00Z',
      ),
    );

    expect(canonicalizeReceiptProof(base.receiptProof)).toBe(
      canonicalizeReceiptProof(changedEnvelope.receiptProof),
    );
    expect(canonicalizeReceiptProof(base.receiptProof)).not.toContain('receiptGeneratedAt');
  });

  it('rejects unknown fields inside receiptProof', () => {
    const error = expectReceiptValidationError(() =>
      parseReceiptExportJson(getReceipt('receipt-unknown-proof-field')),
    );

    expect(error.issue.code).toBe('unknown_field');
    expect(error.issue.path).toBe('$.receiptProof.unexpectedProofField');
  });

  it('rejects duplicate JSON keys before accepting a receipt', () => {
    const duplicated = getReceipt('receipt-package-less-good').replace(
      '"receiptCommitment": "receipt-a",',
      '"receiptCommitment": "receipt-a",\n    "receiptCommitment": "receipt-b",',
    );

    const error = expectReceiptValidationError(() => parseReceiptExportJson(duplicated));

    expect(error.issue.code).toBe('duplicate_json_key');
    expect(error.issue.path).toBe('$.receiptProof.receiptCommitment');
  });

  it('rejects unsupported schema versions', () => {
    const unsupported = getReceipt('receipt-package-less-good').replace(
      '"schemaVersion": 1',
      '"schemaVersion": 2',
    );

    const error = expectReceiptValidationError(() => parseReceiptExportJson(unsupported));

    expect(error.issue.code).toBe('unsupported_schema_version');
  });

  it('rejects malformed expected package hash values', () => {
    const invalidHash = getReceipt('receipt-package-bound-good').replace(
      FEAT136_SAMPLE_PACKAGE_HASH,
      'sha256:not-a-hash',
    );

    const error = expectReceiptValidationError(() => parseReceiptExportJson(invalidHash));

    expect(error.issue.code).toBe('invalid_field_value');
    expect(error.issue.path).toBe('$.receiptProof.expectedPackageHash');
  });

  it('rejects malformed receipt JSON', () => {
    const fixture = FEAT136_RECEIPT_FIXTURES.find(
      (item) => item.fixtureId === 'receipt-malformed-json',
    );

    const error = expectReceiptValidationError(() =>
      parseReceiptExportJson(fixture?.receiptJson ?? ''),
    );

    expect(error.issue.code).toBe('invalid_json');
  });
});
