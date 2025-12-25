/**
 * UpdateIdentity Transaction Tests
 *
 * Tests for:
 * 1. Transaction creation with correct payload
 * 2. Proper signing of transaction
 * 3. Correct PayloadKind GUID
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PAYLOAD_GUIDS,
  createUpdateIdentityTransaction,
  createUnsignedTransaction,
} from './transactions';

// Mock the signByUser function to avoid crypto issues in test environment
vi.mock('./keys', () => ({
  signData: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])),
  bytesToBase64: vi.fn().mockReturnValue('dGVzdFNpZ25hdHVyZQ=='),
  deriveKeysFromMnemonic: vi.fn(),
}));

describe('UpdateIdentity Transaction', () => {
  describe('PAYLOAD_GUIDS', () => {
    it('should have UPDATE_IDENTITY GUID', () => {
      expect(PAYLOAD_GUIDS.UPDATE_IDENTITY).toBeDefined();
      expect(PAYLOAD_GUIDS.UPDATE_IDENTITY).toBe('a7e3c4b2-1f8d-4e5a-9c6b-2d3e4f5a6b7c');
    });

    it('should have correct GUID format', () => {
      // GUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      expect(PAYLOAD_GUIDS.UPDATE_IDENTITY).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });
  });

  describe('createUnsignedTransaction', () => {
    it('should create transaction with UPDATE_IDENTITY PayloadKind', () => {
      const payload = { NewAlias: 'TestUser' };
      const unsignedTx = createUnsignedTransaction(PAYLOAD_GUIDS.UPDATE_IDENTITY, payload);

      expect(unsignedTx.PayloadKind).toBe(PAYLOAD_GUIDS.UPDATE_IDENTITY);
    });

    it('should include correct NewAlias in payload', () => {
      const newAlias = 'MyNewDisplayName';
      const payload = { NewAlias: newAlias };
      const unsignedTx = createUnsignedTransaction(PAYLOAD_GUIDS.UPDATE_IDENTITY, payload);

      expect(unsignedTx.Payload.NewAlias).toBe(newAlias);
    });

    it('should generate valid TransactionId', () => {
      const payload = { NewAlias: 'TestUser' };
      const unsignedTx = createUnsignedTransaction(PAYLOAD_GUIDS.UPDATE_IDENTITY, payload);

      // GUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      expect(unsignedTx.TransactionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should include valid TransactionTimeStamp', () => {
      const payload = { NewAlias: 'TestUser' };
      const unsignedTx = createUnsignedTransaction(PAYLOAD_GUIDS.UPDATE_IDENTITY, payload);

      expect(unsignedTx.TransactionTimeStamp).toBeDefined();
      // Should be valid ISO 8601 timestamp
      expect(new Date(unsignedTx.TransactionTimeStamp).toISOString()).toBe(
        unsignedTx.TransactionTimeStamp
      );
    });

    it('should calculate PayloadSize correctly', () => {
      const payload = { NewAlias: 'TestUser' };
      const unsignedTx = createUnsignedTransaction(PAYLOAD_GUIDS.UPDATE_IDENTITY, payload);

      expect(unsignedTx.PayloadSize).toBeGreaterThan(0);
      // PayloadSize should be the byte length of the payload JSON
      const expectedSize = new TextEncoder().encode(JSON.stringify(payload)).length;
      expect(unsignedTx.PayloadSize).toBe(expectedSize);
    });
  });

  describe('createUpdateIdentityTransaction', () => {
    const mockPrivateKey = new Uint8Array(32).fill(1);
    const mockPublicAddress = '04abc123def456';

    it('should create a transaction with correct PayloadKind', async () => {
      const newAlias = 'NewDisplayName';

      const transactionJson = await createUpdateIdentityTransaction(
        newAlias,
        mockPrivateKey,
        mockPublicAddress
      );

      const transaction = JSON.parse(transactionJson);
      expect(transaction.PayloadKind).toBe(PAYLOAD_GUIDS.UPDATE_IDENTITY);
    });

    it('should create a transaction with correct NewAlias in payload', async () => {
      const newAlias = 'TestAlias123';

      const transactionJson = await createUpdateIdentityTransaction(
        newAlias,
        mockPrivateKey,
        mockPublicAddress
      );

      const transaction = JSON.parse(transactionJson);
      expect(transaction.Payload.NewAlias).toBe(newAlias);
    });

    it('should include valid TransactionId', async () => {
      const transactionJson = await createUpdateIdentityTransaction(
        'TestAlias',
        mockPrivateKey,
        mockPublicAddress
      );

      const transaction = JSON.parse(transactionJson);
      // GUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      expect(transaction.TransactionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should include UserSignature with correct Signatory', async () => {
      const transactionJson = await createUpdateIdentityTransaction(
        'TestAlias',
        mockPrivateKey,
        mockPublicAddress
      );

      const transaction = JSON.parse(transactionJson);
      expect(transaction.UserSignature).toBeDefined();
      expect(transaction.UserSignature.Signatory).toBe(mockPublicAddress);
    });

    it('should include Signature in UserSignature', async () => {
      const transactionJson = await createUpdateIdentityTransaction(
        'TestAlias',
        mockPrivateKey,
        mockPublicAddress
      );

      const transaction = JSON.parse(transactionJson);
      expect(transaction.UserSignature.Signature).toBeDefined();
      expect(typeof transaction.UserSignature.Signature).toBe('string');
    });

    it('should include PayloadSize', async () => {
      const transactionJson = await createUpdateIdentityTransaction(
        'TestAlias',
        mockPrivateKey,
        mockPublicAddress
      );

      const transaction = JSON.parse(transactionJson);
      expect(transaction.PayloadSize).toBeGreaterThan(0);
    });

    it('should include TransactionTimeStamp', async () => {
      const transactionJson = await createUpdateIdentityTransaction(
        'TestAlias',
        mockPrivateKey,
        mockPublicAddress
      );

      const transaction = JSON.parse(transactionJson);
      expect(transaction.TransactionTimeStamp).toBeDefined();
      // ISO 8601 format
      expect(new Date(transaction.TransactionTimeStamp).toISOString()).toBe(
        transaction.TransactionTimeStamp
      );
    });

    it('should handle empty alias', async () => {
      const transactionJson = await createUpdateIdentityTransaction(
        '',
        mockPrivateKey,
        mockPublicAddress
      );

      const transaction = JSON.parse(transactionJson);
      expect(transaction.Payload.NewAlias).toBe('');
    });

    it('should handle unicode characters in alias', async () => {
      const unicodeAlias = 'Test🚀User 日本語';

      const transactionJson = await createUpdateIdentityTransaction(
        unicodeAlias,
        mockPrivateKey,
        mockPublicAddress
      );

      const transaction = JSON.parse(transactionJson);
      expect(transaction.Payload.NewAlias).toBe(unicodeAlias);
    });
  });
});
