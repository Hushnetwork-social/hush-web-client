/**
 * Group Feed Transaction Tests
 *
 * Tests for:
 * 1. createGroupFeedTransaction() with multiple participants
 * 2. Correct payload structure matching server's NewGroupFeedPayload
 * 3. ECIES encryption of AES key for all participants
 * 4. Creator as Owner, others as Members
 * 5. Transaction signing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PAYLOAD_GUIDS,
  PARTICIPANT_TYPES,
  createGroupFeedTransaction,
  createUnsignedTransaction,
  type NewGroupFeedPayload,
  type GroupParticipantInput,
} from './transactions';

// Mock the keys module
vi.mock('./keys', () => ({
  signData: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])),
  bytesToBase64: vi.fn().mockReturnValue('dGVzdFNpZ25hdHVyZQ=='),
  deriveKeysFromMnemonic: vi.fn(),
}));

// Track ECIES encryption calls to verify per-participant encryption
let eciesEncryptCalls: { message: string; publicKey: string }[] = [];

// Counter for unique encrypted keys
let eciesEncryptCounter = 0;

// Mock the encryption module
vi.mock('./encryption', () => ({
  generateAesKey: vi.fn().mockReturnValue('bW9ja0Flc0tleUJhc2U2NEVuY29kZWQ='),
  eciesEncrypt: vi.fn().mockImplementation((message: string, publicKey: string) => {
    eciesEncryptCalls.push({ message, publicKey });
    eciesEncryptCounter++;
    // Return unique encrypted key based on counter and public key for verification
    return Promise.resolve(`encrypted_${eciesEncryptCounter}_${publicKey.substring(0, 8)}`);
  }),
  aesEncrypt: vi.fn(),
}));

describe('Group Feed Transaction', () => {
  // Test fixtures
  const mockPrivateKey = new Uint8Array(32).fill(1);
  const creatorPublicSigningAddress = '04creator_signing_address_hex';
  const creatorPublicEncryptAddress = '04creator_encrypt_address_hex';

  const participant1: GroupParticipantInput = {
    publicSigningAddress: '04participant1_signing_hex',
    publicEncryptAddress: '04participant1_encrypt_hex',
  };

  const participant2: GroupParticipantInput = {
    publicSigningAddress: '04participant2_signing_hex',
    publicEncryptAddress: '04participant2_encrypt_hex',
  };

  beforeEach(() => {
    eciesEncryptCalls = [];
    eciesEncryptCounter = 0;
    vi.clearAllMocks();
  });

  describe('PAYLOAD_GUIDS', () => {
    it('should have NEW_GROUP_FEED GUID defined', () => {
      expect(PAYLOAD_GUIDS.NEW_GROUP_FEED).toBeDefined();
      expect(PAYLOAD_GUIDS.NEW_GROUP_FEED).toBe('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d');
    });

    it('should have correct GUID format for NEW_GROUP_FEED', () => {
      expect(PAYLOAD_GUIDS.NEW_GROUP_FEED).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });
  });

  describe('PARTICIPANT_TYPES', () => {
    it('should have OWNER = 0', () => {
      expect(PARTICIPANT_TYPES.OWNER).toBe(0);
    });

    it('should have MEMBER = 1', () => {
      expect(PARTICIPANT_TYPES.MEMBER).toBe(1);
    });

    it('should have all participant types defined', () => {
      expect(PARTICIPANT_TYPES.OWNER).toBeDefined();
      expect(PARTICIPANT_TYPES.MEMBER).toBeDefined();
      expect(PARTICIPANT_TYPES.GUEST).toBeDefined();
      expect(PARTICIPANT_TYPES.ADMIN).toBeDefined();
      expect(PARTICIPANT_TYPES.BLOCKED).toBeDefined();
      expect(PARTICIPANT_TYPES.BANNED).toBeDefined();
    });
  });

  describe('createUnsignedTransaction with NewGroupFeedPayload', () => {
    it('should create transaction with NEW_GROUP_FEED PayloadKind', () => {
      const payload: NewGroupFeedPayload = {
        FeedId: '12345678-1234-1234-1234-123456789012',
        Title: 'Test Group',
        Description: 'Test Description',
        IsPublic: false,
        Participants: [],
      };

      const unsignedTx = createUnsignedTransaction(PAYLOAD_GUIDS.NEW_GROUP_FEED, payload);

      expect(unsignedTx.PayloadKind).toBe(PAYLOAD_GUIDS.NEW_GROUP_FEED);
    });

    it('should include correct payload fields', () => {
      const payload: NewGroupFeedPayload = {
        FeedId: '12345678-1234-1234-1234-123456789012',
        Title: 'My Group',
        Description: 'Group description',
        IsPublic: true,
        Participants: [
          {
            FeedId: '12345678-1234-1234-1234-123456789012',
            ParticipantPublicAddress: '04abc123',
            ParticipantType: 0,
            EncryptedFeedKey: 'encryptedKey',
            KeyGeneration: 0,
          },
        ],
      };

      const unsignedTx = createUnsignedTransaction(PAYLOAD_GUIDS.NEW_GROUP_FEED, payload);

      expect(unsignedTx.Payload.FeedId).toBe(payload.FeedId);
      expect(unsignedTx.Payload.Title).toBe(payload.Title);
      expect(unsignedTx.Payload.Description).toBe(payload.Description);
      expect(unsignedTx.Payload.IsPublic).toBe(payload.IsPublic);
      expect(unsignedTx.Payload.Participants).toHaveLength(1);
    });
  });

  describe('createGroupFeedTransaction', () => {
    it('should return signed transaction, feedId, and feedAesKey', async () => {
      const result = await createGroupFeedTransaction(
        'Test Group',
        'Description',
        false,
        creatorPublicSigningAddress,
        creatorPublicEncryptAddress,
        [participant1],
        mockPrivateKey
      );

      expect(result.signedTransaction).toBeDefined();
      expect(result.feedId).toBeDefined();
      expect(result.feedAesKey).toBeDefined();
    });

    it('should generate valid feedId GUID', async () => {
      const result = await createGroupFeedTransaction(
        'Test Group',
        'Description',
        false,
        creatorPublicSigningAddress,
        creatorPublicEncryptAddress,
        [],
        mockPrivateKey
      );

      expect(result.feedId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should return the generated AES key', async () => {
      const result = await createGroupFeedTransaction(
        'Test Group',
        'Description',
        false,
        creatorPublicSigningAddress,
        creatorPublicEncryptAddress,
        [],
        mockPrivateKey
      );

      expect(result.feedAesKey).toBe('bW9ja0Flc0tleUJhc2U2NEVuY29kZWQ=');
    });

    it('should use NEW_GROUP_FEED PayloadKind', async () => {
      const result = await createGroupFeedTransaction(
        'Test Group',
        'Description',
        false,
        creatorPublicSigningAddress,
        creatorPublicEncryptAddress,
        [],
        mockPrivateKey
      );

      const transaction = JSON.parse(result.signedTransaction);
      expect(transaction.PayloadKind).toBe(PAYLOAD_GUIDS.NEW_GROUP_FEED);
    });

    it('should include title and description in payload', async () => {
      const title = 'My Awesome Group';
      const description = 'This is a great group for testing';

      const result = await createGroupFeedTransaction(
        title,
        description,
        false,
        creatorPublicSigningAddress,
        creatorPublicEncryptAddress,
        [],
        mockPrivateKey
      );

      const transaction = JSON.parse(result.signedTransaction);
      expect(transaction.Payload.Title).toBe(title);
      expect(transaction.Payload.Description).toBe(description);
    });

    it('should set IsPublic correctly for public group', async () => {
      const result = await createGroupFeedTransaction(
        'Public Group',
        'Description',
        true,
        creatorPublicSigningAddress,
        creatorPublicEncryptAddress,
        [],
        mockPrivateKey
      );

      const transaction = JSON.parse(result.signedTransaction);
      expect(transaction.Payload.IsPublic).toBe(true);
    });

    it('should set IsPublic correctly for private group', async () => {
      const result = await createGroupFeedTransaction(
        'Private Group',
        'Description',
        false,
        creatorPublicSigningAddress,
        creatorPublicEncryptAddress,
        [],
        mockPrivateKey
      );

      const transaction = JSON.parse(result.signedTransaction);
      expect(transaction.Payload.IsPublic).toBe(false);
    });

    it('should set creator as Owner (ParticipantType = 0)', async () => {
      const result = await createGroupFeedTransaction(
        'Test Group',
        'Description',
        false,
        creatorPublicSigningAddress,
        creatorPublicEncryptAddress,
        [participant1],
        mockPrivateKey
      );

      const transaction = JSON.parse(result.signedTransaction);
      const creatorParticipant = transaction.Payload.Participants[0];

      expect(creatorParticipant.ParticipantPublicAddress).toBe(creatorPublicSigningAddress);
      expect(creatorParticipant.ParticipantType).toBe(PARTICIPANT_TYPES.OWNER);
    });

    it('should set other participants as Members (ParticipantType = 1)', async () => {
      const result = await createGroupFeedTransaction(
        'Test Group',
        'Description',
        false,
        creatorPublicSigningAddress,
        creatorPublicEncryptAddress,
        [participant1, participant2],
        mockPrivateKey
      );

      const transaction = JSON.parse(result.signedTransaction);

      // First participant should be creator (Owner)
      expect(transaction.Payload.Participants[0].ParticipantType).toBe(PARTICIPANT_TYPES.OWNER);

      // Second and third participants should be Members
      expect(transaction.Payload.Participants[1].ParticipantType).toBe(PARTICIPANT_TYPES.MEMBER);
      expect(transaction.Payload.Participants[1].ParticipantPublicAddress).toBe(
        participant1.publicSigningAddress
      );

      expect(transaction.Payload.Participants[2].ParticipantType).toBe(PARTICIPANT_TYPES.MEMBER);
      expect(transaction.Payload.Participants[2].ParticipantPublicAddress).toBe(
        participant2.publicSigningAddress
      );
    });

    it('should include correct number of participants (creator + others)', async () => {
      const result = await createGroupFeedTransaction(
        'Test Group',
        'Description',
        false,
        creatorPublicSigningAddress,
        creatorPublicEncryptAddress,
        [participant1, participant2],
        mockPrivateKey
      );

      const transaction = JSON.parse(result.signedTransaction);
      // Creator + 2 other participants = 3
      expect(transaction.Payload.Participants).toHaveLength(3);
    });

    it('should set KeyGeneration to 0 for all participants', async () => {
      const result = await createGroupFeedTransaction(
        'Test Group',
        'Description',
        false,
        creatorPublicSigningAddress,
        creatorPublicEncryptAddress,
        [participant1, participant2],
        mockPrivateKey
      );

      const transaction = JSON.parse(result.signedTransaction);

      for (const participant of transaction.Payload.Participants) {
        expect(participant.KeyGeneration).toBe(0);
      }
    });

    it('should set FeedId in all participants matching the group feedId', async () => {
      const result = await createGroupFeedTransaction(
        'Test Group',
        'Description',
        false,
        creatorPublicSigningAddress,
        creatorPublicEncryptAddress,
        [participant1],
        mockPrivateKey
      );

      const transaction = JSON.parse(result.signedTransaction);

      for (const participant of transaction.Payload.Participants) {
        expect(participant.FeedId).toBe(transaction.Payload.FeedId);
      }
    });

    it('should encrypt AES key for each participant using their encryption address', async () => {
      await createGroupFeedTransaction(
        'Test Group',
        'Description',
        false,
        creatorPublicSigningAddress,
        creatorPublicEncryptAddress,
        [participant1, participant2],
        mockPrivateKey
      );

      // Should have encrypted for creator + 2 participants = 3 calls
      expect(eciesEncryptCalls).toHaveLength(3);

      // Verify encryption used correct public encryption addresses
      expect(eciesEncryptCalls[0].publicKey).toBe(creatorPublicEncryptAddress);
      expect(eciesEncryptCalls[1].publicKey).toBe(participant1.publicEncryptAddress);
      expect(eciesEncryptCalls[2].publicKey).toBe(participant2.publicEncryptAddress);
    });

    it('should encrypt the same AES key for all participants', async () => {
      await createGroupFeedTransaction(
        'Test Group',
        'Description',
        false,
        creatorPublicSigningAddress,
        creatorPublicEncryptAddress,
        [participant1],
        mockPrivateKey
      );

      // All encryption calls should use the same AES key (the generated one)
      const aesKey = eciesEncryptCalls[0].message;
      for (const call of eciesEncryptCalls) {
        expect(call.message).toBe(aesKey);
      }
    });

    it('should have unique encrypted keys per participant', async () => {
      const result = await createGroupFeedTransaction(
        'Test Group',
        'Description',
        false,
        creatorPublicSigningAddress,
        creatorPublicEncryptAddress,
        [participant1, participant2],
        mockPrivateKey
      );

      const transaction = JSON.parse(result.signedTransaction);
      const encryptedKeys = transaction.Payload.Participants.map(
        (p: { EncryptedFeedKey: string }) => p.EncryptedFeedKey
      );

      // Each participant should have a unique encrypted key
      const uniqueKeys = new Set(encryptedKeys);
      expect(uniqueKeys.size).toBe(encryptedKeys.length);
    });

    it('should include UserSignature with correct Signatory', async () => {
      const result = await createGroupFeedTransaction(
        'Test Group',
        'Description',
        false,
        creatorPublicSigningAddress,
        creatorPublicEncryptAddress,
        [],
        mockPrivateKey
      );

      const transaction = JSON.parse(result.signedTransaction);
      expect(transaction.UserSignature).toBeDefined();
      expect(transaction.UserSignature.Signatory).toBe(creatorPublicSigningAddress);
    });

    it('should include Signature in UserSignature', async () => {
      const result = await createGroupFeedTransaction(
        'Test Group',
        'Description',
        false,
        creatorPublicSigningAddress,
        creatorPublicEncryptAddress,
        [],
        mockPrivateKey
      );

      const transaction = JSON.parse(result.signedTransaction);
      expect(transaction.UserSignature.Signature).toBeDefined();
      expect(typeof transaction.UserSignature.Signature).toBe('string');
    });

    it('should include valid TransactionId', async () => {
      const result = await createGroupFeedTransaction(
        'Test Group',
        'Description',
        false,
        creatorPublicSigningAddress,
        creatorPublicEncryptAddress,
        [],
        mockPrivateKey
      );

      const transaction = JSON.parse(result.signedTransaction);
      expect(transaction.TransactionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should include valid TransactionTimeStamp', async () => {
      const result = await createGroupFeedTransaction(
        'Test Group',
        'Description',
        false,
        creatorPublicSigningAddress,
        creatorPublicEncryptAddress,
        [],
        mockPrivateKey
      );

      const transaction = JSON.parse(result.signedTransaction);
      expect(transaction.TransactionTimeStamp).toBeDefined();
      expect(new Date(transaction.TransactionTimeStamp).toISOString()).toBe(
        transaction.TransactionTimeStamp
      );
    });

    it('should work with no additional participants (creator only)', async () => {
      const result = await createGroupFeedTransaction(
        'Solo Group',
        'Just me',
        false,
        creatorPublicSigningAddress,
        creatorPublicEncryptAddress,
        [],
        mockPrivateKey
      );

      const transaction = JSON.parse(result.signedTransaction);
      expect(transaction.Payload.Participants).toHaveLength(1);
      expect(transaction.Payload.Participants[0].ParticipantType).toBe(PARTICIPANT_TYPES.OWNER);
    });

    it('should handle unicode characters in title and description', async () => {
      const title = 'Test Group 🚀 日本語';
      const description = '描述 emoji 🎉';

      const result = await createGroupFeedTransaction(
        title,
        description,
        false,
        creatorPublicSigningAddress,
        creatorPublicEncryptAddress,
        [],
        mockPrivateKey
      );

      const transaction = JSON.parse(result.signedTransaction);
      expect(transaction.Payload.Title).toBe(title);
      expect(transaction.Payload.Description).toBe(description);
    });

    it('should handle empty title and description', async () => {
      const result = await createGroupFeedTransaction(
        '',
        '',
        false,
        creatorPublicSigningAddress,
        creatorPublicEncryptAddress,
        [],
        mockPrivateKey
      );

      const transaction = JSON.parse(result.signedTransaction);
      expect(transaction.Payload.Title).toBe('');
      expect(transaction.Payload.Description).toBe('');
    });
  });
});
