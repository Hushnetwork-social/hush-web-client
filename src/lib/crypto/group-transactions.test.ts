/**
 * Group Transaction Functions Tests
 *
 * Tests for:
 * 1. createGroup() - Create group with encrypted keys
 * 2. joinPublicGroup() - Join public group
 * 3. leaveGroup() - Leave group
 * 4. addMemberToGroup() - Add member with identity lookup
 * 5. blockMember() / unblockMember() - Block/unblock member
 * 6. banMember() / unbanMember() - Ban/unban member
 * 7. promoteMember() - Promote to admin
 * 8. updateGroupTitle() / updateGroupDescription() - Update metadata
 * 9. deleteGroup() - Delete group
 * 10. processKeyGeneration() - Decrypt received key
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createGroup,
  joinPublicGroup,
  leaveGroup,
  addMemberToGroup,
  blockMember,
  unblockMember,
  banMember,
  unbanMember,
  promoteMember,
  updateGroupTitle,
  updateGroupDescription,
  deleteGroup,
  processKeyGeneration,
} from './group-transactions';

// Mock the gRPC services
vi.mock('@/lib/grpc/services/group', () => ({
  groupService: {
    createGroup: vi.fn(),
    joinGroup: vi.fn(),
    leaveGroup: vi.fn(),
    addMember: vi.fn(),
    blockMember: vi.fn(),
    unblockMember: vi.fn(),
    banMember: vi.fn(),
    unbanMember: vi.fn(),
    promoteToAdmin: vi.fn(),
    updateTitle: vi.fn(),
    updateDescription: vi.fn(),
    deleteGroup: vi.fn(),
  },
}));

vi.mock('@/lib/grpc/services/blockchain', () => ({
  blockchainService: {
    submitSignedTransaction: vi.fn(),
  },
}));

vi.mock('@/lib/grpc/services/identity', () => ({
  identityService: {
    getIdentity: vi.fn(),
  },
}));

// Mock the crypto functions
vi.mock('./transactions', () => ({
  createGroupFeedTransaction: vi.fn(),
  createJoinGroupFeedTransaction: vi.fn(),
}));

vi.mock('./group-crypto', () => ({
  decryptKeyGeneration: vi.fn(),
}));

// Mock debug logger
vi.mock('@/lib/debug-logger', () => ({
  debugLog: vi.fn(),
  debugError: vi.fn(),
}));

// Import mocked modules
import { groupService } from '@/lib/grpc/services/group';
import { blockchainService } from '@/lib/grpc/services/blockchain';
import { identityService } from '@/lib/grpc/services/identity';
import { createGroupFeedTransaction, createJoinGroupFeedTransaction } from './transactions';
import { decryptKeyGeneration } from './group-crypto';

describe('Group Transaction Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createGroup', () => {
    const mockGroupData = {
      name: 'Test Group',
      description: 'A test group',
      isPublic: true,
      memberAddresses: ['member1', 'member2'],
    };
    const mockCreatorAddress = 'creator_address';
    const mockCreatorEncrypt = 'creator_encrypt';
    const mockParticipants = [
      { publicSigningAddress: 'member1', publicEncryptAddress: 'encrypt1' },
      { publicSigningAddress: 'member2', publicEncryptAddress: 'encrypt2' },
    ];
    const mockSigningKey = new Uint8Array(32);

    it('should create a group successfully via signed transaction', async () => {
      const mockFeedId = 'test-feed-id';
      const mockAesKey = 'mock-aes-key-base64';
      const mockSignedTx = JSON.stringify({
        Payload: {
          Participants: [
            { FeedId: mockFeedId, ParticipantPublicAddress: 'creator_address' },
          ],
        },
      });

      vi.mocked(createGroupFeedTransaction).mockResolvedValue({
        signedTransaction: mockSignedTx,
        feedId: mockFeedId,
        feedAesKey: mockAesKey,
      });

      vi.mocked(blockchainService.submitSignedTransaction).mockResolvedValue({
        Successfull: true,
        Message: 'Transaction accepted',
      });

      const result = await createGroup(
        mockGroupData,
        mockCreatorAddress,
        mockCreatorEncrypt,
        mockParticipants,
        mockSigningKey
      );

      expect(result.success).toBe(true);
      expect(result.feedId).toBe(mockFeedId);
      expect(result.feedAesKey).toBe(mockAesKey);
      expect(createGroupFeedTransaction).toHaveBeenCalledWith(
        mockGroupData.name,
        mockGroupData.description,
        mockGroupData.isPublic,
        mockCreatorAddress,
        mockCreatorEncrypt,
        mockParticipants,
        mockSigningKey
      );
      expect(blockchainService.submitSignedTransaction).toHaveBeenCalledWith(mockSignedTx);
    });

    it('should return error when transaction is rejected', async () => {
      vi.mocked(createGroupFeedTransaction).mockResolvedValue({
        signedTransaction: JSON.stringify({ Payload: { Participants: [] } }),
        feedId: 'test-id',
        feedAesKey: 'test-key',
      });

      vi.mocked(blockchainService.submitSignedTransaction).mockResolvedValue({
        Successfull: false,
        Message: 'Server error',
      });

      const result = await createGroup(
        mockGroupData,
        mockCreatorAddress,
        mockCreatorEncrypt,
        mockParticipants,
        mockSigningKey
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Server error');
    });

    it('should handle transaction creation failure', async () => {
      vi.mocked(createGroupFeedTransaction).mockRejectedValue(
        new Error('Crypto error')
      );

      const result = await createGroup(
        mockGroupData,
        mockCreatorAddress,
        mockCreatorEncrypt,
        mockParticipants,
        mockSigningKey
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Crypto error');
    });
  });

  describe('joinPublicGroup', () => {
    const mockSigningKey = new Uint8Array(32);

    it('should join group successfully via signed transaction', async () => {
      const mockSignedTx = '{"Payload":{"FeedId":"feed-123"}}';

      vi.mocked(createJoinGroupFeedTransaction).mockResolvedValue({
        signedTransaction: mockSignedTx,
      });

      vi.mocked(blockchainService.submitSignedTransaction).mockResolvedValue({
        Successfull: true,
        Message: 'Transaction accepted',
      });

      const result = await joinPublicGroup('feed-123', 'user-address', mockSigningKey);

      expect(result.success).toBe(true);
      expect(result.data?.feedId).toBe('feed-123');
      expect(createJoinGroupFeedTransaction).toHaveBeenCalledWith(
        'feed-123',
        'user-address',
        mockSigningKey
      );
      expect(blockchainService.submitSignedTransaction).toHaveBeenCalledWith(mockSignedTx);
    });

    it('should return error when transaction is rejected', async () => {
      const mockSignedTx = '{"Payload":{"FeedId":"invalid-feed"}}';

      vi.mocked(createJoinGroupFeedTransaction).mockResolvedValue({
        signedTransaction: mockSignedTx,
      });

      vi.mocked(blockchainService.submitSignedTransaction).mockResolvedValue({
        Successfull: false,
        Message: 'Group not found',
      });

      const result = await joinPublicGroup('invalid-feed', 'user-address', mockSigningKey);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Group not found');
    });

    it('should return error when transaction creation fails', async () => {
      vi.mocked(createJoinGroupFeedTransaction).mockRejectedValue(
        new Error('Failed to sign transaction')
      );

      const result = await joinPublicGroup('feed-123', 'user-address', mockSigningKey);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to sign transaction');
    });
  });

  describe('leaveGroup', () => {
    it('should leave group successfully', async () => {
      vi.mocked(groupService.leaveGroup).mockResolvedValue({
        success: true,
        data: { message: 'Left group' },
      });

      const result = await leaveGroup('feed-123', 'user-address');

      expect(result.success).toBe(true);
      expect(groupService.leaveGroup).toHaveBeenCalledWith('feed-123', 'user-address');
    });

    it('should return error when leave fails', async () => {
      vi.mocked(groupService.leaveGroup).mockResolvedValue({
        success: false,
        error: 'Not a member',
      });

      const result = await leaveGroup('feed-123', 'user-address');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not a member');
    });
  });

  describe('addMemberToGroup', () => {
    it('should add member successfully after fetching identity', async () => {
      vi.mocked(identityService.getIdentity).mockResolvedValue({
        Successfull: true,
        Message: 'Found',
        ProfileName: 'New Member',
        PublicSigningAddress: 'member-address',
        PublicEncryptAddress: 'member-encrypt-key',
        IsPublic: true,
      });

      vi.mocked(groupService.addMember).mockResolvedValue({
        success: true,
        data: { message: 'Member added' },
      });

      const result = await addMemberToGroup('feed-123', 'admin-address', 'member-address');

      expect(result.success).toBe(true);
      expect(identityService.getIdentity).toHaveBeenCalledWith('member-address');
      expect(groupService.addMember).toHaveBeenCalledWith(
        'feed-123',
        'admin-address',
        'member-address',
        'member-encrypt-key'
      );
    });

    it('should return error when identity lookup fails', async () => {
      vi.mocked(identityService.getIdentity).mockResolvedValue({
        Successfull: false,
        Message: 'Identity not found',
        ProfileName: '',
        PublicSigningAddress: '',
        PublicEncryptAddress: '',
        IsPublic: false,
      });

      const result = await addMemberToGroup('feed-123', 'admin-address', 'unknown-member');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Identity not found');
    });

    it('should return error when member has no encryption key', async () => {
      vi.mocked(identityService.getIdentity).mockResolvedValue({
        Successfull: true,
        Message: 'Found',
        ProfileName: 'Member',
        PublicSigningAddress: 'member-address',
        PublicEncryptAddress: '', // No encrypt key
        IsPublic: true,
      });

      const result = await addMemberToGroup('feed-123', 'admin-address', 'member-address');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Member has no encryption key registered');
    });
  });

  describe('blockMember', () => {
    it('should block member successfully', async () => {
      vi.mocked(groupService.blockMember).mockResolvedValue({
        success: true,
        data: { message: 'Member blocked' },
      });

      const result = await blockMember('feed-123', 'admin-address', 'member-address', 'Spam');

      expect(result.success).toBe(true);
      expect(groupService.blockMember).toHaveBeenCalledWith(
        'feed-123',
        'admin-address',
        'member-address',
        'Spam'
      );
    });

    it('should return error when block fails', async () => {
      vi.mocked(groupService.blockMember).mockResolvedValue({
        success: false,
        error: 'Not authorized',
      });

      const result = await blockMember('feed-123', 'user-address', 'member-address');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authorized');
    });
  });

  describe('unblockMember', () => {
    it('should unblock member successfully', async () => {
      vi.mocked(groupService.unblockMember).mockResolvedValue({
        success: true,
        data: { message: 'Member unblocked' },
      });

      const result = await unblockMember('feed-123', 'admin-address', 'member-address');

      expect(result.success).toBe(true);
    });
  });

  describe('banMember', () => {
    it('should ban member successfully', async () => {
      vi.mocked(groupService.banMember).mockResolvedValue({
        success: true,
        data: { message: 'Member banned' },
      });

      const result = await banMember('feed-123', 'admin-address', 'member-address', 'Violation');

      expect(result.success).toBe(true);
      expect(groupService.banMember).toHaveBeenCalledWith(
        'feed-123',
        'admin-address',
        'member-address',
        'Violation'
      );
    });

    it('should return error when ban fails', async () => {
      vi.mocked(groupService.banMember).mockResolvedValue({
        success: false,
        error: 'Cannot ban admin',
      });

      const result = await banMember('feed-123', 'admin-address', 'other-admin');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot ban admin');
    });
  });

  describe('unbanMember', () => {
    it('should unban member successfully', async () => {
      vi.mocked(groupService.unbanMember).mockResolvedValue({
        success: true,
        data: { message: 'Member unbanned' },
      });

      const result = await unbanMember('feed-123', 'admin-address', 'member-address');

      expect(result.success).toBe(true);
    });
  });

  describe('promoteMember', () => {
    it('should promote member to admin successfully', async () => {
      vi.mocked(groupService.promoteToAdmin).mockResolvedValue({
        success: true,
        data: { message: 'Member promoted' },
      });

      const result = await promoteMember('feed-123', 'admin-address', 'member-address');

      expect(result.success).toBe(true);
      expect(groupService.promoteToAdmin).toHaveBeenCalledWith(
        'feed-123',
        'admin-address',
        'member-address'
      );
    });

    it('should return error when not authorized', async () => {
      vi.mocked(groupService.promoteToAdmin).mockResolvedValue({
        success: false,
        error: 'Not authorized',
      });

      const result = await promoteMember('feed-123', 'member-address', 'other-member');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authorized');
    });
  });

  describe('updateGroupTitle', () => {
    it('should update title successfully', async () => {
      vi.mocked(groupService.updateTitle).mockResolvedValue({
        success: true,
        data: { message: 'Title updated' },
      });

      const result = await updateGroupTitle('feed-123', 'admin-address', 'New Title');

      expect(result.success).toBe(true);
      expect(groupService.updateTitle).toHaveBeenCalledWith(
        'feed-123',
        'admin-address',
        'New Title'
      );
    });
  });

  describe('updateGroupDescription', () => {
    it('should update description successfully', async () => {
      vi.mocked(groupService.updateDescription).mockResolvedValue({
        success: true,
        data: { message: 'Description updated' },
      });

      const result = await updateGroupDescription('feed-123', 'admin-address', 'New description');

      expect(result.success).toBe(true);
      expect(groupService.updateDescription).toHaveBeenCalledWith(
        'feed-123',
        'admin-address',
        'New description'
      );
    });
  });

  describe('deleteGroup', () => {
    it('should delete group successfully', async () => {
      vi.mocked(groupService.deleteGroup).mockResolvedValue({
        success: true,
        data: { message: 'Group deleted' },
      });

      const result = await deleteGroup('feed-123', 'admin-address');

      expect(result.success).toBe(true);
      expect(groupService.deleteGroup).toHaveBeenCalledWith('feed-123', 'admin-address');
    });

    it('should return error when not last admin', async () => {
      vi.mocked(groupService.deleteGroup).mockResolvedValue({
        success: false,
        error: 'Other admins exist',
      });

      const result = await deleteGroup('feed-123', 'admin-address');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Other admins exist');
    });
  });

  describe('processKeyGeneration', () => {
    it('should decrypt key generation successfully', async () => {
      vi.mocked(decryptKeyGeneration).mockResolvedValue({
        success: true,
        data: 'decrypted-aes-key',
      });

      const result = await processKeyGeneration('encrypted-key', 'private-key-hex');

      expect(result.success).toBe(true);
      expect(result.aesKey).toBe('decrypted-aes-key');
      expect(decryptKeyGeneration).toHaveBeenCalledWith('encrypted-key', 'private-key-hex');
    });

    it('should return error when decryption fails', async () => {
      vi.mocked(decryptKeyGeneration).mockResolvedValue({
        success: false,
        error: 'Decryption failed',
      });

      const result = await processKeyGeneration('bad-key', 'wrong-private-key');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Decryption failed');
    });
  });

  describe('Error handling', () => {
    it('should handle network errors gracefully', async () => {
      const mockSigningKey = new Uint8Array(32);

      vi.mocked(createJoinGroupFeedTransaction).mockResolvedValue({
        signedTransaction: '{}',
      });

      vi.mocked(blockchainService.submitSignedTransaction).mockRejectedValue(new Error('Network error'));

      const result = await joinPublicGroup('feed-123', 'user-address', mockSigningKey);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle non-Error exceptions', async () => {
      vi.mocked(groupService.leaveGroup).mockRejectedValue('Unknown error');

      const result = await leaveGroup('feed-123', 'user-address');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to leave group');
    });
  });
});
