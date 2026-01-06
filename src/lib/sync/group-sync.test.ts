/**
 * Group Sync Functions Tests
 *
 * Tests for:
 * 1. syncGroupMembers() - Sync member list with identity resolution
 * 2. syncKeyGenerations() - Sync and decrypt KeyGenerations
 * 3. detectMissingKeyGenerations() - Detect gaps from ban periods
 * 4. syncGroupFeedData() - Combined sync function
 * 5. isGroupFeed() / getGroupFeedsNeedingSync() - Helper functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  syncGroupMembers,
  syncKeyGenerations,
  syncGroupFeedData,
  isGroupFeed,
  getGroupFeedsNeedingSync,
} from './group-sync';

// Mock the gRPC services
vi.mock('@/lib/grpc/services/group', () => ({
  groupService: {
    getGroupMembers: vi.fn(),
    getKeyGenerations: vi.fn(),
  },
}));

vi.mock('@/lib/grpc/services/identity', () => ({
  identityService: {
    getIdentity: vi.fn(),
  },
}));

// Mock the crypto functions
vi.mock('@/lib/crypto/group-crypto', () => ({
  decryptKeyGeneration: vi.fn(),
}));

// Mock debug logger
vi.mock('@/lib/debug-logger', () => ({
  debugLog: vi.fn(),
  debugError: vi.fn(),
  debugWarn: vi.fn(),
}));

// Mock useFeedsStore
const mockSetGroupMembers = vi.fn();
const mockSetUserRole = vi.fn();
const mockSetGroupKeyState = vi.fn();
const mockGetFeed = vi.fn();
const mockGetGroupMembers = vi.fn().mockReturnValue([]);
const mockFeeds: Array<{ id: string; type: string; needsSync: boolean }> = [];

vi.mock('@/modules/feeds/useFeedsStore', () => ({
  useFeedsStore: {
    getState: () => ({
      setGroupMembers: mockSetGroupMembers,
      setUserRole: mockSetUserRole,
      setGroupKeyState: mockSetGroupKeyState,
      getFeed: mockGetFeed,
      getGroupMembers: mockGetGroupMembers,
      feeds: mockFeeds,
    }),
  },
}));

// Import mocked modules
import { groupService } from '@/lib/grpc/services/group';
import { identityService } from '@/lib/grpc/services/identity';
import { decryptKeyGeneration } from '@/lib/crypto/group-crypto';

describe('Group Sync Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFeeds.length = 0;
    // Reset getGroupMembers to return empty array by default
    mockGetGroupMembers.mockReturnValue([]);
  });

  describe('syncGroupMembers', () => {
    const feedId = 'test-feed-id';
    const userAddress = 'user-address';

    it('should sync members and resolve display names', async () => {
      const mockMembers = [
        { publicAddress: 'addr1', role: 'Admin' as const, joinedAtBlock: 100 },
        { publicAddress: 'addr2', role: 'Member' as const, joinedAtBlock: 200 },
      ];

      vi.mocked(groupService.getGroupMembers).mockResolvedValue(mockMembers);
      vi.mocked(identityService.getIdentity).mockImplementation(async (address: string) => ({
        Successfull: true,
        ProfileName: `Name for ${address}`,
        PublicSigningAddress: address,
        PublicEncryptAddress: 'encrypt',
        IsPublic: true,
        Message: '',
      }));

      const result = await syncGroupMembers(feedId, userAddress);

      expect(result.success).toBe(true);
      expect(result.members).toHaveLength(2);
      expect(result.members![0].displayName).toBe('Name for addr1');
      expect(result.members![1].displayName).toBe('Name for addr2');
      expect(result.newMembers).toEqual([]); // First sync, no new members detected
      expect(mockSetGroupMembers).toHaveBeenCalledWith(feedId, expect.any(Array));
    });

    it('should handle empty member list', async () => {
      vi.mocked(groupService.getGroupMembers).mockResolvedValue([]);

      const result = await syncGroupMembers(feedId, userAddress);

      expect(result.success).toBe(true);
      expect(result.members).toEqual([]);
      expect(result.newMembers).toEqual([]);
    });

    it('should use truncated address when identity lookup fails', async () => {
      const mockMembers = [
        { publicAddress: 'abcdefghij12345', role: 'Admin' as const, joinedAtBlock: 100 },
      ];

      vi.mocked(groupService.getGroupMembers).mockResolvedValue(mockMembers);
      vi.mocked(identityService.getIdentity).mockRejectedValue(new Error('Not found'));

      const result = await syncGroupMembers(feedId, userAddress);

      expect(result.success).toBe(true);
      expect(result.members![0].displayName).toBe('abcdefghij');
    });

    it('should detect new members on subsequent syncs', async () => {
      // Setup: Existing members in store
      mockGetGroupMembers.mockReturnValue([
        { publicAddress: 'addr1', displayName: 'Alice', role: 'Admin' },
      ]);

      // New member list includes addr1 + new member addr2
      const mockMembers = [
        { publicAddress: 'addr1', role: 'Admin' as const, joinedAtBlock: 100 },
        { publicAddress: 'addr2', role: 'Member' as const, joinedAtBlock: 200 },
      ];

      vi.mocked(groupService.getGroupMembers).mockResolvedValue(mockMembers);
      vi.mocked(identityService.getIdentity).mockImplementation(async (address: string) => ({
        Successfull: true,
        ProfileName: `Name for ${address}`,
        PublicSigningAddress: address,
        PublicEncryptAddress: 'encrypt',
        IsPublic: true,
        Message: '',
      }));

      const result = await syncGroupMembers(feedId, userAddress);

      expect(result.success).toBe(true);
      expect(result.members).toHaveLength(2);
      expect(result.newMembers).toHaveLength(1);
      expect(result.newMembers![0].publicAddress).toBe('addr2');
    });

    it('should not report current user as new member', async () => {
      // Setup: Existing members in store (just one other member)
      mockGetGroupMembers.mockReturnValue([
        { publicAddress: 'other-addr', displayName: 'Other', role: 'Admin' },
      ]);

      // Current user joins the group
      const mockMembers = [
        { publicAddress: 'other-addr', role: 'Admin' as const, joinedAtBlock: 100 },
        { publicAddress: userAddress, role: 'Member' as const, joinedAtBlock: 200 },
      ];

      vi.mocked(groupService.getGroupMembers).mockResolvedValue(mockMembers);
      vi.mocked(identityService.getIdentity).mockImplementation(async (address: string) => ({
        Successfull: true,
        ProfileName: `Name for ${address}`,
        PublicSigningAddress: address,
        PublicEncryptAddress: 'encrypt',
        IsPublic: true,
        Message: '',
      }));

      const result = await syncGroupMembers(feedId, userAddress);

      expect(result.success).toBe(true);
      expect(result.newMembers).toHaveLength(0); // Current user excluded from new members
    });

    it('should set user role when user is in member list', async () => {
      const mockMembers = [
        { publicAddress: userAddress, role: 'Admin' as const, joinedAtBlock: 100 },
      ];

      vi.mocked(groupService.getGroupMembers).mockResolvedValue(mockMembers);
      vi.mocked(identityService.getIdentity).mockResolvedValue({
        Successfull: true,
        ProfileName: 'User',
        PublicSigningAddress: userAddress,
        PublicEncryptAddress: 'encrypt',
        IsPublic: true,
        Message: '',
      });

      await syncGroupMembers(feedId, userAddress);

      expect(mockSetUserRole).toHaveBeenCalledWith(feedId, 'Admin');
    });

    it('should return error on service failure', async () => {
      vi.mocked(groupService.getGroupMembers).mockRejectedValue(new Error('Network error'));

      const result = await syncGroupMembers(feedId, userAddress);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('syncKeyGenerations', () => {
    const feedId = 'test-feed-id';
    const userAddress = 'user-address';
    const privateKeyHex = '0123456789abcdef';

    it('should sync and decrypt KeyGenerations', async () => {
      const mockKeyGens = [
        { KeyGeneration: 0, EncryptedKey: 'enc0', ValidFromBlock: 100 },
        { KeyGeneration: 1, EncryptedKey: 'enc1', ValidFromBlock: 200 },
      ];

      vi.mocked(groupService.getKeyGenerations).mockResolvedValue(mockKeyGens);
      vi.mocked(decryptKeyGeneration).mockImplementation(async (encKey: string) => ({
        success: true,
        data: `decrypted-${encKey}`,
      }));

      const result = await syncKeyGenerations(feedId, userAddress, privateKeyHex);

      expect(result.success).toBe(true);
      expect(result.data?.keyGenerations).toHaveLength(2);
      expect(result.data?.currentKeyGeneration).toBe(1);
      expect(result.data?.missingKeyGenerations).toEqual([]);
      expect(mockSetGroupKeyState).toHaveBeenCalled();
    });

    it('should handle empty KeyGenerations response', async () => {
      vi.mocked(groupService.getKeyGenerations).mockResolvedValue([]);

      const result = await syncKeyGenerations(feedId, userAddress, privateKeyHex);

      expect(result.success).toBe(true);
      expect(result.data).toBeUndefined();
    });

    it('should detect missing KeyGenerations (unban gap)', async () => {
      // User has KeyGens 0, 1, and 4 - missing 2, 3 (ban period)
      const mockKeyGens = [
        { KeyGeneration: 0, EncryptedKey: 'enc0', ValidFromBlock: 100 },
        { KeyGeneration: 1, EncryptedKey: 'enc1', ValidFromBlock: 200 },
        { KeyGeneration: 4, EncryptedKey: 'enc4', ValidFromBlock: 500 },
      ];

      vi.mocked(groupService.getKeyGenerations).mockResolvedValue(mockKeyGens);
      vi.mocked(decryptKeyGeneration).mockResolvedValue({ success: true, data: 'decrypted' });

      const result = await syncKeyGenerations(feedId, userAddress, privateKeyHex);

      expect(result.success).toBe(true);
      expect(result.data?.missingKeyGenerations).toEqual([2, 3]);
      expect(result.data?.currentKeyGeneration).toBe(4);
    });

    it('should continue when single key decryption fails', async () => {
      const mockKeyGens = [
        { KeyGeneration: 0, EncryptedKey: 'enc0', ValidFromBlock: 100 },
        { KeyGeneration: 1, EncryptedKey: 'enc1', ValidFromBlock: 200 },
      ];

      vi.mocked(groupService.getKeyGenerations).mockResolvedValue(mockKeyGens);
      vi.mocked(decryptKeyGeneration).mockImplementation(async (encKey: string) => {
        if (encKey === 'enc0') {
          return { success: false, error: 'Decryption failed' };
        }
        return { success: true, data: 'decrypted' };
      });

      const result = await syncKeyGenerations(feedId, userAddress, privateKeyHex);

      expect(result.success).toBe(true);
      expect(result.data?.keyGenerations).toHaveLength(1);
      expect(result.data?.keyGenerations[0].keyGeneration).toBe(1);
    });

    it('should return error on service failure', async () => {
      vi.mocked(groupService.getKeyGenerations).mockRejectedValue(new Error('Network error'));

      const result = await syncKeyGenerations(feedId, userAddress, privateKeyHex);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('syncGroupFeedData', () => {
    const feedId = 'test-feed-id';
    const userAddress = 'user-address';
    const privateKeyHex = '0123456789abcdef';

    it('should sync members and keys in parallel', async () => {
      vi.mocked(groupService.getGroupMembers).mockResolvedValue([
        { publicAddress: 'addr1', role: 'Admin' as const, joinedAtBlock: 100 },
      ]);
      vi.mocked(identityService.getIdentity).mockResolvedValue({
        Successfull: true,
        ProfileName: 'User',
        PublicSigningAddress: 'addr1',
        PublicEncryptAddress: 'encrypt',
        IsPublic: true,
        Message: '',
      });
      vi.mocked(groupService.getKeyGenerations).mockResolvedValue([
        { KeyGeneration: 0, EncryptedKey: 'enc0', ValidFromBlock: 100 },
      ]);
      vi.mocked(decryptKeyGeneration).mockResolvedValue({ success: true, data: 'decrypted' });

      const result = await syncGroupFeedData(feedId, userAddress, privateKeyHex);

      expect(result.success).toBe(true);
      expect(groupService.getGroupMembers).toHaveBeenCalledWith(feedId);
      expect(groupService.getKeyGenerations).toHaveBeenCalledWith(feedId, userAddress);
    });

    it('should return error if members sync fails', async () => {
      vi.mocked(groupService.getGroupMembers).mockRejectedValue(new Error('Members error'));
      vi.mocked(groupService.getKeyGenerations).mockResolvedValue([]);

      const result = await syncGroupFeedData(feedId, userAddress, privateKeyHex);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Members error');
    });

    it('should return error if keys sync fails', async () => {
      vi.mocked(groupService.getGroupMembers).mockResolvedValue([]);
      vi.mocked(groupService.getKeyGenerations).mockRejectedValue(new Error('Keys error'));

      const result = await syncGroupFeedData(feedId, userAddress, privateKeyHex);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Keys error');
    });
  });

  describe('isGroupFeed', () => {
    it('should return true for group feeds', () => {
      mockGetFeed.mockReturnValue({ id: 'feed1', type: 'group' });

      expect(isGroupFeed('feed1')).toBe(true);
    });

    it('should return false for non-group feeds', () => {
      mockGetFeed.mockReturnValue({ id: 'feed1', type: 'chat' });

      expect(isGroupFeed('feed1')).toBe(false);
    });

    it('should return false for non-existent feeds', () => {
      mockGetFeed.mockReturnValue(undefined);

      expect(isGroupFeed('feed1')).toBe(false);
    });
  });

  describe('getGroupFeedsNeedingSync', () => {
    it('should return group feeds that need sync', () => {
      mockFeeds.push(
        { id: 'feed1', type: 'group', needsSync: true },
        { id: 'feed2', type: 'group', needsSync: false },
        { id: 'feed3', type: 'chat', needsSync: true },
        { id: 'feed4', type: 'group', needsSync: true }
      );

      const result = getGroupFeedsNeedingSync();

      expect(result).toEqual(['feed1', 'feed4']);
    });

    it('should return empty array when no group feeds need sync', () => {
      mockFeeds.push(
        { id: 'feed1', type: 'group', needsSync: false },
        { id: 'feed2', type: 'chat', needsSync: true }
      );

      const result = getGroupFeedsNeedingSync();

      expect(result).toEqual([]);
    });
  });
});
