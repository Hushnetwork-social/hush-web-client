import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import {
  RECEIPT_EXPORT_SCHEMA,
  RECEIPT_EXPORT_SCHEMA_VERSION,
  validateReceiptExport,
  type HushVotingReceiptExport,
} from './contracts';

export const RECEIPT_CHANNEL_PAYLOAD_SCHEMA = 'hushvoting.receipt.channel-payload';
export const RECEIPT_CHANNEL_PAYLOAD_SCHEMA_VERSION = 1;
export const RECEIPT_CHANNEL_PAYLOAD_PREFIX = 'HVR1';
export const RECEIPT_CHANNEL_PAYLOAD_MAX_CHARS = 16000;

const CHECKSUM_HEX_LENGTH = 16;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

export type ReceiptChannelPayloadChannel = 'qr_ready' | 'manual_payload';

export type ReceiptChannelPayloadIssueCode =
  | 'empty_payload'
  | 'payload_too_large'
  | 'invalid_payload_format'
  | 'invalid_payload_encoding'
  | 'checksum_mismatch'
  | 'invalid_payload_json'
  | 'invalid_payload_schema'
  | 'unsupported_payload_version'
  | 'invalid_payload_channel'
  | 'invalid_receipt';

export interface ReceiptChannelPayloadIssue {
  code: ReceiptChannelPayloadIssueCode;
  path: string;
  message: string;
}

export class ReceiptChannelPayloadValidationError extends Error {
  constructor(public readonly issue: ReceiptChannelPayloadIssue) {
    super(issue.message);
    this.name = 'ReceiptChannelPayloadValidationError';
  }
}

export interface HushVotingReceiptChannelPayload {
  schema: typeof RECEIPT_CHANNEL_PAYLOAD_SCHEMA;
  schemaVersion: typeof RECEIPT_CHANNEL_PAYLOAD_SCHEMA_VERSION;
  channel: ReceiptChannelPayloadChannel;
  receiptExport: HushVotingReceiptExport;
}

export interface DecodedReceiptChannelPayload {
  payload: HushVotingReceiptChannelPayload;
  receiptJson: string;
  checksum: string;
}

export function encodeReceiptChannelPayload(
  receiptExport: HushVotingReceiptExport,
  channel: ReceiptChannelPayloadChannel = 'qr_ready',
): string {
  const payload = normalizeReceiptChannelPayload({
    schema: RECEIPT_CHANNEL_PAYLOAD_SCHEMA,
    schemaVersion: RECEIPT_CHANNEL_PAYLOAD_SCHEMA_VERSION,
    channel,
    receiptExport,
  });
  const payloadJson = stringifyReceiptChannelPayload(payload);
  const payloadBytes = TEXT_ENCODER.encode(payloadJson);
  const checksum = checksumForBytes(payloadBytes);

  return [
    RECEIPT_CHANNEL_PAYLOAD_PREFIX,
    bytesToBase64Url(payloadBytes),
    checksum,
  ].join('.');
}

export function decodeReceiptChannelPayload(source: string): DecodedReceiptChannelPayload {
  const normalized = normalizeReceiptChannelPayloadSource(source);
  const [prefix, encodedPayload, checksum] = normalized.split('.');

  if (
    prefix !== RECEIPT_CHANNEL_PAYLOAD_PREFIX ||
    !encodedPayload ||
    !checksum ||
    normalized.split('.').length !== 3
  ) {
    throw payloadIssue(
      'invalid_payload_format',
      '$',
      `Receipt payload must use ${RECEIPT_CHANNEL_PAYLOAD_PREFIX}.<payload>.<checksum> format.`,
    );
  }

  if (!BASE64URL_PATTERN.test(encodedPayload) || !/^[a-f0-9]{16}$/i.test(checksum)) {
    throw payloadIssue('invalid_payload_encoding', '$', 'Receipt payload encoding is invalid.');
  }

  const payloadBytes = base64UrlToBytes(encodedPayload);
  const expectedChecksum = checksumForBytes(payloadBytes);
  if (checksum.toLowerCase() !== expectedChecksum) {
    throw payloadIssue('checksum_mismatch', '$.checksum', 'Receipt payload checksum does not match.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(TEXT_DECODER.decode(payloadBytes));
  } catch {
    throw payloadIssue('invalid_payload_json', '$', 'Receipt payload JSON is malformed.');
  }

  const payload = normalizeReceiptChannelPayload(parsed);
  return {
    payload,
    receiptJson: JSON.stringify(payload.receiptExport),
    checksum: expectedChecksum,
  };
}

export function normalizeReceiptChannelPayloadSource(source: string): string {
  const normalized = source.replace(/\s/g, '').trim();
  if (!normalized) {
    throw payloadIssue('empty_payload', '$', 'Receipt payload cannot be empty.');
  }

  if (normalized.length > RECEIPT_CHANNEL_PAYLOAD_MAX_CHARS) {
    throw payloadIssue('payload_too_large', '$', 'Receipt payload is too large.');
  }

  return normalized;
}

function normalizeReceiptChannelPayload(value: unknown): HushVotingReceiptChannelPayload {
  if (!isRecord(value)) {
    throw payloadIssue('invalid_payload_schema', '$', 'Receipt payload must be an object.');
  }

  if (value.schema !== RECEIPT_CHANNEL_PAYLOAD_SCHEMA) {
    throw payloadIssue('invalid_payload_schema', '$.schema', 'Receipt payload schema is not supported.');
  }

  if (value.schemaVersion !== RECEIPT_CHANNEL_PAYLOAD_SCHEMA_VERSION) {
    throw payloadIssue(
      'unsupported_payload_version',
      '$.schemaVersion',
      'Receipt payload schema version is not supported.',
    );
  }

  if (value.channel !== 'qr_ready' && value.channel !== 'manual_payload') {
    throw payloadIssue('invalid_payload_channel', '$.channel', 'Receipt payload channel is invalid.');
  }

  let receiptExport: HushVotingReceiptExport;
  try {
    receiptExport = validateReceiptExport(value.receiptExport);
  } catch (error) {
    throw payloadIssue(
      'invalid_receipt',
      '$.receiptExport',
      error instanceof Error ? error.message : 'Receipt payload does not contain a valid receipt.',
    );
  }

  return {
    schema: RECEIPT_CHANNEL_PAYLOAD_SCHEMA,
    schemaVersion: RECEIPT_CHANNEL_PAYLOAD_SCHEMA_VERSION,
    channel: value.channel,
    receiptExport,
  };
}

function stringifyReceiptChannelPayload(payload: HushVotingReceiptChannelPayload): string {
  const proof = payload.receiptExport.receiptProof;
  const envelope = payload.receiptExport.exportEnvelope;

  return JSON.stringify({
    schema: RECEIPT_CHANNEL_PAYLOAD_SCHEMA,
    schemaVersion: RECEIPT_CHANNEL_PAYLOAD_SCHEMA_VERSION,
    channel: payload.channel,
    receiptExport: {
      schema: RECEIPT_EXPORT_SCHEMA,
      schemaVersion: RECEIPT_EXPORT_SCHEMA_VERSION,
      receiptProof: {
        electionId: proof.electionId,
        receiptCommitment: proof.receiptCommitment,
        receiptCommitmentScheme: proof.receiptCommitmentScheme,
        preparedBallotHash: proof.preparedBallotHash,
        ...(proof.ballotDefinitionVersion !== undefined
          ? { ballotDefinitionVersion: proof.ballotDefinitionVersion }
          : {}),
        ...(proof.ballotDefinitionHash ? { ballotDefinitionHash: proof.ballotDefinitionHash } : {}),
        ...(proof.expectedPackageId ? { expectedPackageId: proof.expectedPackageId } : {}),
        ...(proof.expectedPackageHash ? { expectedPackageHash: proof.expectedPackageHash } : {}),
        ...(proof.expectedVerifierProfileId
          ? { expectedVerifierProfileId: proof.expectedVerifierProfileId }
          : {}),
      },
      exportEnvelope: {
        receiptGeneratedAt: envelope.receiptGeneratedAt,
        exportedBy: envelope.exportedBy,
        ...(envelope.exporterVersion ? { exporterVersion: envelope.exporterVersion } : {}),
      },
    },
  });
}

function checksumForBytes(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes)).slice(0, CHECKSUM_HEX_LENGTH);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return globalThis
    .btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`;
  let binary: string;
  try {
    binary = globalThis.atob(padded);
  } catch {
    throw payloadIssue('invalid_payload_encoding', '$.payload', 'Receipt payload is not valid base64url.');
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function payloadIssue(
  code: ReceiptChannelPayloadIssueCode,
  path: string,
  message: string,
): ReceiptChannelPayloadValidationError {
  return new ReceiptChannelPayloadValidationError({ code, path, message });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
