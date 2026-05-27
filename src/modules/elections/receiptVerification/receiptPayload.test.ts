import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { describe, expect, it } from 'vitest';
import { parseReceiptExportJson } from './contracts';
import { FEAT136_RECEIPT_FIXTURES } from './fixtures';
import {
  decodeReceiptChannelPayload,
  encodeReceiptChannelPayload,
  ReceiptChannelPayloadValidationError,
} from './receiptPayload';

function packageBoundReceiptJson(): string {
  const fixture = FEAT136_RECEIPT_FIXTURES.find(
    (item) => item.fixtureId === 'receipt-package-bound-good',
  );
  if (!fixture?.receiptJson) {
    throw new Error('Missing package-bound receipt fixture.');
  }

  return fixture.receiptJson;
}

function expectPayloadError(action: () => unknown): ReceiptChannelPayloadValidationError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(ReceiptChannelPayloadValidationError);
    return error as ReceiptChannelPayloadValidationError;
  }

  throw new Error('Expected a receipt payload validation error.');
}

describe('FEAT-152 receipt channel payload contract', () => {
  it('encodes QR-ready payloads and decodes them back into the FEAT-136 receipt export', () => {
    const receipt = parseReceiptExportJson(packageBoundReceiptJson());
    const encoded = encodeReceiptChannelPayload(receipt, 'qr_ready');

    expect(encoded.startsWith('HVR1.')).toBe(true);

    const decoded = decodeReceiptChannelPayload(encoded);

    expect(decoded.payload.channel).toBe('qr_ready');
    expect(JSON.parse(decoded.receiptJson)).toEqual(JSON.parse(JSON.stringify(receipt)));
  });

  it('accepts manually segmented payload text with whitespace between chunks', () => {
    const receipt = parseReceiptExportJson(packageBoundReceiptJson());
    const encoded = encodeReceiptChannelPayload(receipt, 'manual_payload');
    const segmented = encoded.match(/.{1,24}/g)?.join('\n') ?? encoded;

    const decoded = decodeReceiptChannelPayload(segmented);

    expect(decoded.payload.channel).toBe('manual_payload');
    expect(JSON.parse(decoded.receiptJson).receiptProof.receiptCommitment).toBe('receipt-a');
  });

  it('rejects checksum drift before receipt verification runs', () => {
    const receipt = parseReceiptExportJson(packageBoundReceiptJson());
    const encoded = encodeReceiptChannelPayload(receipt, 'qr_ready');
    const corrupted = `${encoded.slice(0, -1)}${encoded.endsWith('0') ? '1' : '0'}`;

    const error = expectPayloadError(() => decodeReceiptChannelPayload(corrupted));

    expect(error.issue.code).toBe('checksum_mismatch');
  });

  it('rejects unsupported payload schema versions deterministically', () => {
    const receipt = parseReceiptExportJson(packageBoundReceiptJson());
    const encoded = encodeReceiptChannelPayload(receipt, 'qr_ready');
    const decoded = decodeReceiptChannelPayload(encoded);
    const payload = {
      ...decoded.payload,
      schemaVersion: 2,
    };
    const unsupported = encodeRawPayloadForTest(payload);

    const error = expectPayloadError(() => decodeReceiptChannelPayload(unsupported));

    expect(error.issue.code).toBe('unsupported_payload_version');
  });
});

function encodeRawPayloadForTest(payload: unknown): string {
  const payloadJson = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(payloadJson);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  const encoded = globalThis
    .btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  const checksum = checksumForTest(bytes);

  return `HVR1.${encoded}.${checksum}`;
}

function checksumForTest(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes)).slice(0, 16);
}
