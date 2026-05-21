export const RECEIPT_EXPORT_SCHEMA = 'hushvoting.receipt.export';
export const RECEIPT_EXPORT_SCHEMA_VERSION = 1;
export const RECEIPT_EXPORT_FILE_EXTENSION = '.hush-receipt.json';
export const RECEIPT_EXPORTED_BY = 'HushVoting';

export const RECEIPT_FILE_MAX_BYTES = 1024 * 1024;
export const PACKAGE_ZIP_MAX_BYTES = 50 * 1024 * 1024;
export const PACKAGE_ZIP_MAX_ENTRY_COUNT = 512;
export const PACKAGE_ZIP_MAX_ENTRY_BYTES = 10 * 1024 * 1024;
export const PACKAGE_JSON_MAX_BYTES = 5 * 1024 * 1024;

export const RECEIPT_PROOF_FIELD_ORDER = [
  'electionId',
  'receiptCommitment',
  'receiptCommitmentScheme',
  'preparedBallotHash',
  'ballotDefinitionVersion',
  'ballotDefinitionHash',
  'expectedPackageId',
  'expectedPackageHash',
  'expectedVerifierProfileId',
] as const;

export const RECEIPT_TOP_LEVEL_FIELDS = [
  'schema',
  'schemaVersion',
  'receiptProof',
  'exportEnvelope',
] as const;

export const RECEIPT_EXPORT_ENVELOPE_FIELDS = [
  'receiptGeneratedAt',
  'exportedBy',
  'exporterVersion',
] as const;

export const RECEIPT_PACKAGE_BINDING_UNAVAILABLE_REASONS = [
  'not_finalized',
  'receipt_proof_missing',
  'public_package_unavailable',
  'protocol_refs_blocked',
  'package_export_failed',
] as const;

export type ReceiptPackageBindingUnavailableReason =
  typeof RECEIPT_PACKAGE_BINDING_UNAVAILABLE_REASONS[number];

export type ReceiptProofField = typeof RECEIPT_PROOF_FIELD_ORDER[number];

export type ReceiptVerificationResultCategory =
  | 'verified_included'
  | 'verified_included_with_warnings'
  | 'not_found'
  | 'wrong_package'
  | 'invalid_receipt'
  | 'invalid_package'
  | 'package_unavailable'
  | 'verification_unavailable';

export type ReceiptValidationIssueCode =
  | 'duplicate_json_key'
  | 'invalid_json'
  | 'invalid_receipt_schema'
  | 'unsupported_schema_version'
  | 'unknown_field'
  | 'missing_required_field'
  | 'invalid_field_type'
  | 'invalid_field_value';

export interface HushVotingReceiptProof {
  electionId: string;
  receiptCommitment: string;
  receiptCommitmentScheme: string;
  preparedBallotHash: string;
  ballotDefinitionVersion?: number;
  ballotDefinitionHash?: string;
  expectedPackageId?: string;
  expectedPackageHash?: string;
  expectedVerifierProfileId?: string;
}

export interface HushVotingReceiptExportEnvelope {
  receiptGeneratedAt: string;
  exportedBy: typeof RECEIPT_EXPORTED_BY;
  exporterVersion?: string;
}

export interface HushVotingReceiptExport {
  schema: typeof RECEIPT_EXPORT_SCHEMA;
  schemaVersion: typeof RECEIPT_EXPORT_SCHEMA_VERSION;
  receiptProof: HushVotingReceiptProof;
  exportEnvelope: HushVotingReceiptExportEnvelope;
}

export interface ReceiptValidationIssue {
  code: ReceiptValidationIssueCode;
  path: string;
  message: string;
}

export class ReceiptValidationError extends Error {
  constructor(public readonly issue: ReceiptValidationIssue) {
    super(issue.message);
    this.name = 'ReceiptValidationError';
  }
}

const SHA256_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/i;
const SAFE_TEXT_PATTERN = /^[A-Za-z0-9._:@|/+=()[\]-]+$/;
const UTC_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;

export function parseReceiptExportJson(source: string): HushVotingReceiptExport {
  try {
    assertNoDuplicateJsonKeys(source);
  } catch (error) {
    if (error instanceof ReceiptValidationError) {
      throw error;
    }

    throw new ReceiptValidationError({
      code: 'invalid_json',
      path: '$',
      message: error instanceof Error ? error.message : 'Receipt JSON is malformed.',
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new ReceiptValidationError({
      code: 'invalid_json',
      path: '$',
      message: error instanceof Error ? error.message : 'Receipt JSON is malformed.',
    });
  }

  return validateReceiptExport(parsed);
}

export function validateReceiptExport(value: unknown): HushVotingReceiptExport {
  const root = expectPlainObject(value, '$');
  assertAllowedKeys(root, RECEIPT_TOP_LEVEL_FIELDS, '$');

  const schema = readRequiredString(root, 'schema', '$.schema');
  if (schema !== RECEIPT_EXPORT_SCHEMA) {
    throw issue('invalid_receipt_schema', '$.schema', 'Receipt schema is not supported.');
  }

  const schemaVersion = root.schemaVersion;
  if (schemaVersion !== RECEIPT_EXPORT_SCHEMA_VERSION) {
    throw issue(
      'unsupported_schema_version',
      '$.schemaVersion',
      'Receipt schema version is not supported.',
    );
  }

  const receiptProof = validateReceiptProof(root.receiptProof);
  const exportEnvelope = validateReceiptExportEnvelope(root.exportEnvelope);

  return {
    schema: RECEIPT_EXPORT_SCHEMA,
    schemaVersion: RECEIPT_EXPORT_SCHEMA_VERSION,
    receiptProof,
    exportEnvelope,
  };
}

export function validateReceiptProof(value: unknown): HushVotingReceiptProof {
  const proof = expectPlainObject(value, '$.receiptProof');
  assertAllowedKeys(proof, RECEIPT_PROOF_FIELD_ORDER, '$.receiptProof');

  const result: HushVotingReceiptProof = {
    electionId: readSafeRequiredString(proof, 'electionId', '$.receiptProof.electionId'),
    receiptCommitment: readSafeRequiredString(
      proof,
      'receiptCommitment',
      '$.receiptProof.receiptCommitment',
    ),
    receiptCommitmentScheme: readSafeRequiredString(
      proof,
      'receiptCommitmentScheme',
      '$.receiptProof.receiptCommitmentScheme',
    ),
    preparedBallotHash: readSafeRequiredString(
      proof,
      'preparedBallotHash',
      '$.receiptProof.preparedBallotHash',
    ),
  };

  const ballotDefinitionVersion = readOptionalInteger(
    proof,
    'ballotDefinitionVersion',
    '$.receiptProof.ballotDefinitionVersion',
  );
  if (ballotDefinitionVersion !== undefined) {
    result.ballotDefinitionVersion = ballotDefinitionVersion;
  }

  const optionalFields = [
    ['ballotDefinitionHash', '$.receiptProof.ballotDefinitionHash'],
    ['expectedPackageId', '$.receiptProof.expectedPackageId'],
    ['expectedVerifierProfileId', '$.receiptProof.expectedVerifierProfileId'],
  ] as const;

  for (const [fieldName, path] of optionalFields) {
    const fieldValue = readSafeOptionalString(proof, fieldName, path);
    if (fieldValue !== undefined) {
      result[fieldName] = fieldValue;
    }
  }

  const expectedPackageHash = readSafeOptionalString(
    proof,
    'expectedPackageHash',
    '$.receiptProof.expectedPackageHash',
  );
  if (expectedPackageHash !== undefined) {
    if (!SHA256_HASH_PATTERN.test(expectedPackageHash)) {
      throw issue(
        'invalid_field_value',
        '$.receiptProof.expectedPackageHash',
        'Expected package hash must use sha256:<64 hex> format.',
      );
    }

    result.expectedPackageHash = expectedPackageHash.toLowerCase();
  }

  return result;
}

export function validateReceiptExportEnvelope(value: unknown): HushVotingReceiptExportEnvelope {
  const envelope = expectPlainObject(value, '$.exportEnvelope');
  assertAllowedKeys(envelope, RECEIPT_EXPORT_ENVELOPE_FIELDS, '$.exportEnvelope');

  const receiptGeneratedAt = readRequiredString(
    envelope,
    'receiptGeneratedAt',
    '$.exportEnvelope.receiptGeneratedAt',
  );
  if (
    !UTC_TIMESTAMP_PATTERN.test(receiptGeneratedAt) ||
    Number.isNaN(Date.parse(receiptGeneratedAt))
  ) {
    throw issue(
      'invalid_field_value',
      '$.exportEnvelope.receiptGeneratedAt',
      'Receipt generated time must be an ISO UTC timestamp.',
    );
  }

  const exportedBy = readRequiredString(envelope, 'exportedBy', '$.exportEnvelope.exportedBy');
  if (exportedBy !== RECEIPT_EXPORTED_BY) {
    throw issue(
      'invalid_field_value',
      '$.exportEnvelope.exportedBy',
      'Receipt exporter is not recognized.',
    );
  }

  const exporterVersion = readSafeOptionalString(
    envelope,
    'exporterVersion',
    '$.exportEnvelope.exporterVersion',
  );

  return exporterVersion === undefined
    ? { receiptGeneratedAt, exportedBy: RECEIPT_EXPORTED_BY }
    : { receiptGeneratedAt, exportedBy: RECEIPT_EXPORTED_BY, exporterVersion };
}

export function canonicalizeReceiptProof(proof: HushVotingReceiptProof): string {
  return JSON.stringify(toCanonicalReceiptProofObject(proof));
}

export function toCanonicalReceiptProofObject(
  proof: HushVotingReceiptProof,
): Partial<Record<ReceiptProofField, string | number>> {
  const canonical: Partial<Record<ReceiptProofField, string | number>> = {};
  for (const field of RECEIPT_PROOF_FIELD_ORDER) {
    const value = proof[field];
    if (value !== undefined) {
      canonical[field] = value;
    }
  }
  return canonical;
}

export function hasReceiptPackageBinding(proof: HushVotingReceiptProof): boolean {
  return Boolean(
    proof.expectedPackageId &&
      proof.expectedPackageHash &&
      proof.expectedVerifierProfileId,
  );
}

function assertAllowedKeys(
  value: Record<string, unknown>,
  allowedFields: readonly string[],
  path: string,
): void {
  const allowed = new Set(allowedFields);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw issue('unknown_field', `${path}.${key}`, `Unknown field '${key}'.`);
    }
  }
}

function expectPlainObject(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw issue('invalid_field_type', path, 'Expected an object.');
  }

  return value as Record<string, unknown>;
}

function readRequiredString(
  source: Record<string, unknown>,
  key: string,
  path: string,
): string {
  if (!(key in source)) {
    throw issue('missing_required_field', path, `Missing required field '${key}'.`);
  }

  const value = source[key];
  if (typeof value !== 'string') {
    throw issue('invalid_field_type', path, `Field '${key}' must be a string.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw issue('invalid_field_value', path, `Field '${key}' cannot be empty.`);
  }

  return trimmed;
}

function readSafeRequiredString(
  source: Record<string, unknown>,
  key: string,
  path: string,
): string {
  const value = readRequiredString(source, key, path);
  assertSafePortableText(value, path);
  return value;
}

function readSafeOptionalString(
  source: Record<string, unknown>,
  key: string,
  path: string,
): string | undefined {
  if (!(key in source) || source[key] === undefined || source[key] === null) {
    return undefined;
  }

  const value = source[key];
  if (typeof value !== 'string') {
    throw issue('invalid_field_type', path, `Field '${key}' must be a string.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  assertSafePortableText(trimmed, path);
  return trimmed;
}

function readOptionalInteger(
  source: Record<string, unknown>,
  key: string,
  path: string,
): number | undefined {
  if (!(key in source) || source[key] === undefined || source[key] === null) {
    return undefined;
  }

  const value = source[key];
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw issue('invalid_field_type', path, `Field '${key}' must be a non-negative integer.`);
  }

  return Number(value);
}

function assertSafePortableText(value: string, path: string): void {
  if (value.length > 512 || !SAFE_TEXT_PATTERN.test(value)) {
    throw issue('invalid_field_value', path, 'Field contains unsupported characters.');
  }
}

function issue(
  code: ReceiptValidationIssueCode,
  path: string,
  message: string,
): ReceiptValidationError {
  return new ReceiptValidationError({ code, path, message });
}

export function assertNoDuplicateJsonKeys(source: string): void {
  const parser = new DuplicateKeyJsonParser(source);
  parser.parse();
}

class DuplicateKeyJsonParser {
  private index = 0;

  constructor(private readonly source: string) {}

  parse(): void {
    this.skipWhitespace();
    this.parseValue('$');
    this.skipWhitespace();
    if (this.index !== this.source.length) {
      throw issue('invalid_json', '$', 'Receipt JSON contains trailing content.');
    }
  }

  private parseValue(path: string): void {
    this.skipWhitespace();
    const char = this.peek();
    if (char === '{') {
      this.parseObject(path);
      return;
    }

    if (char === '[') {
      this.parseArray(path);
      return;
    }

    if (char === '"') {
      this.parseString();
      return;
    }

    if (char === '-' || isDigit(char)) {
      this.parseNumber();
      return;
    }

    if (this.consumeLiteral('true') || this.consumeLiteral('false') || this.consumeLiteral('null')) {
      return;
    }

    throw issue('invalid_json', path, 'Receipt JSON is malformed.');
  }

  private parseObject(path: string): void {
    this.expect('{', path);
    this.skipWhitespace();
    const keys = new Set<string>();
    if (this.peek() === '}') {
      this.index += 1;
      return;
    }

    while (this.index < this.source.length) {
      this.skipWhitespace();
      if (this.peek() !== '"') {
        throw issue('invalid_json', path, 'Object keys must be strings.');
      }

      const key = this.parseString();
      const keyPath = `${path}.${key}`;
      if (keys.has(key)) {
        throw issue('duplicate_json_key', keyPath, `Duplicate JSON key '${key}'.`);
      }
      keys.add(key);

      this.skipWhitespace();
      this.expect(':', keyPath);
      this.parseValue(keyPath);
      this.skipWhitespace();

      const separator = this.peek();
      if (separator === '}') {
        this.index += 1;
        return;
      }

      if (separator !== ',') {
        throw issue('invalid_json', path, 'Object entries must be comma separated.');
      }

      this.index += 1;
    }

    throw issue('invalid_json', path, 'Object is not closed.');
  }

  private parseArray(path: string): void {
    this.expect('[', path);
    this.skipWhitespace();
    if (this.peek() === ']') {
      this.index += 1;
      return;
    }

    let itemIndex = 0;
    while (this.index < this.source.length) {
      this.parseValue(`${path}[${itemIndex}]`);
      this.skipWhitespace();
      const separator = this.peek();
      if (separator === ']') {
        this.index += 1;
        return;
      }

      if (separator !== ',') {
        throw issue('invalid_json', path, 'Array entries must be comma separated.');
      }

      this.index += 1;
      itemIndex += 1;
    }

    throw issue('invalid_json', path, 'Array is not closed.');
  }

  private parseString(): string {
    const start = this.index;
    this.index += 1;
    while (this.index < this.source.length) {
      const char = this.source[this.index];
      if (char === '"') {
        this.index += 1;
        return JSON.parse(this.source.slice(start, this.index)) as string;
      }

      if (char === '\\') {
        this.index += 2;
        continue;
      }

      if (char < ' ') {
        throw issue('invalid_json', '$', 'String contains a control character.');
      }

      this.index += 1;
    }

    throw issue('invalid_json', '$', 'String is not closed.');
  }

  private parseNumber(): void {
    const numberPattern = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
    numberPattern.lastIndex = this.index;
    const match = numberPattern.exec(this.source);
    if (!match) {
      throw issue('invalid_json', '$', 'Number is malformed.');
    }

    this.index = numberPattern.lastIndex;
  }

  private consumeLiteral(literal: string): boolean {
    if (!this.source.startsWith(literal, this.index)) {
      return false;
    }

    this.index += literal.length;
    return true;
  }

  private expect(expected: string, path: string): void {
    if (this.peek() !== expected) {
      throw issue('invalid_json', path, `Expected '${expected}'.`);
    }

    this.index += 1;
  }

  private skipWhitespace(): void {
    while (/\s/.test(this.peek())) {
      this.index += 1;
    }
  }

  private peek(): string {
    return this.source[this.index] ?? '';
  }
}

function isDigit(value: string): boolean {
  return value >= '0' && value <= '9';
}
