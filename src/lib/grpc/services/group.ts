/**
 * Group Feed gRPC Service
 *
 * Client-side service functions for group feed operations.
 * Communicates with HushFeed gRPC service on the Node.
 */

import { getGrpcClient } from '../client';
import { debugLog } from '@/lib/debug-logger';
import { buildApiUrl } from '@/lib/api-config';
import type {
  NewGroupFeedRequest,
  NewGroupFeedResponse,
  BlockMemberRequest,
  BlockMemberResponse,
  UnblockMemberRequest,
  UnblockMemberResponse,
  BanFromGroupFeedRequest,
  BanFromGroupFeedResponse,
  UnbanFromGroupFeedRequest,
  UnbanFromGroupFeedResponse,
  PromoteToAdminRequest,
  PromoteToAdminResponse,
  UpdateGroupFeedTitleRequest,
  UpdateGroupFeedTitleResponse,
  UpdateGroupFeedDescriptionRequest,
  UpdateGroupFeedDescriptionResponse,
  DeleteGroupFeedRequest,
  DeleteGroupFeedResponse,
  GetGroupFeedResponse,
  KeyGenerationProto,
  GroupFeedParticipantProto,
} from '../types';
import type { GroupCreationData, GroupOperationResult, GroupFeedMember, PublicGroupInfo } from '@/types';

const SERVICE_NAME = 'rpcHush.HushFeed';

/**
 * Result wrapper for group operations
 */
function wrapResult(
  success: boolean,
  data?: { feedId?: string; message?: string },
  error?: string
): GroupOperationResult {
  return { success, data, error };
}

export const groupService = {
  /**
   * Create a new group feed
   */
  async createGroup(
    data: GroupCreationData,
    feedId: string,
    participants: GroupFeedParticipantProto[]
  ): Promise<GroupOperationResult> {
    debugLog('[GroupService] createGroup:', { name: data.name, isPublic: data.isPublic });
    try {
      const client = getGrpcClient();
      const request: NewGroupFeedRequest = {
        FeedId: feedId,
        Title: data.name,
        Description: data.description || '',
        IsPublic: data.isPublic,
        Participants: participants,
      };

      const response = await client.unaryCall<NewGroupFeedRequest, NewGroupFeedResponse>(
        SERVICE_NAME,
        'CreateGroupFeed',
        request
      );

      if (response.Success) {
        return wrapResult(true, { feedId, message: response.Message });
      }
      return wrapResult(false, undefined, response.Message);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create group';
      debugLog('[GroupService] createGroup error:', message);
      return wrapResult(false, undefined, message);
    }
  },

  /**
   * Join a public group feed
   * Uses API route for proper binary protobuf communication
   */
  async joinGroup(feedId: string, userAddress: string): Promise<GroupOperationResult> {
    debugLog('[GroupService] joinGroup:', { feedId, userAddress });
    try {
      const url = buildApiUrl('/api/groups/join');
      debugLog('[GroupService] joinGroup URL:', url);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          feedId,
          joiningUserPublicAddress: userAddress,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      debugLog('[GroupService] joinGroup result:', data);

      if (data.error && !data.success) {
        return wrapResult(false, undefined, data.error);
      }

      if (data.success) {
        return wrapResult(true, { feedId, message: data.message });
      }
      return wrapResult(false, undefined, data.message || 'Failed to join group');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to join group';
      debugLog('[GroupService] joinGroup error:', message);
      return wrapResult(false, undefined, message);
    }
  },

  /**
   * Leave a group feed
   * Uses API route for proper binary protobuf communication
   */
  async leaveGroup(feedId: string, userAddress: string): Promise<GroupOperationResult> {
    debugLog('[GroupService] leaveGroup:', { feedId, userAddress });
    try {
      const url = buildApiUrl('/api/groups/leave');
      debugLog('[GroupService] leaveGroup URL:', url);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          feedId,
          leavingUserPublicAddress: userAddress,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      debugLog('[GroupService] leaveGroup result:', data);

      if (data.error && !data.success) {
        return wrapResult(false, undefined, data.error);
      }

      if (data.success) {
        return wrapResult(true, { message: data.message });
      }
      return wrapResult(false, undefined, data.message || 'Failed to leave group');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to leave group';
      debugLog('[GroupService] leaveGroup error:', message);
      return wrapResult(false, undefined, message);
    }
  },

  /**
   * Add a member to a group (admin only)
   * Uses API route for proper binary protobuf communication
   */
  async addMember(
    feedId: string,
    adminAddress: string,
    memberAddress: string,
    memberEncryptKey: string
  ): Promise<GroupOperationResult> {
    debugLog('[GroupService] addMember:', { feedId, memberAddress });
    try {
      const url = buildApiUrl('/api/groups/add-member');
      debugLog('[GroupService] addMember URL:', url);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          feedId,
          adminPublicAddress: adminAddress,
          newMemberPublicAddress: memberAddress,
          newMemberPublicEncryptKey: memberEncryptKey,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      debugLog('[GroupService] addMember result:', data);

      if (data.error && !data.success) {
        return wrapResult(false, undefined, data.error);
      }

      if (data.success) {
        return wrapResult(true, { message: data.message });
      }
      return wrapResult(false, undefined, data.message || 'Failed to add member');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add member';
      debugLog('[GroupService] addMember error:', message);
      return wrapResult(false, undefined, message);
    }
  },

  /**
   * Block a member (admin only) - member can still view but not post
   */
  async blockMember(
    feedId: string,
    adminAddress: string,
    memberAddress: string,
    reason?: string
  ): Promise<GroupOperationResult> {
    debugLog('[GroupService] blockMember:', { feedId, memberAddress });
    try {
      const client = getGrpcClient();
      const request: BlockMemberRequest = {
        FeedId: feedId,
        AdminPublicAddress: adminAddress,
        BlockedUserPublicAddress: memberAddress,
        Reason: reason,
      };

      const response = await client.unaryCall<BlockMemberRequest, BlockMemberResponse>(
        SERVICE_NAME,
        'BlockMember',
        request
      );

      if (response.Success) {
        return wrapResult(true, { message: response.Message });
      }
      return wrapResult(false, undefined, response.Message);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to block member';
      debugLog('[GroupService] blockMember error:', message);
      return wrapResult(false, undefined, message);
    }
  },

  /**
   * Unblock a member (admin only)
   */
  async unblockMember(
    feedId: string,
    adminAddress: string,
    memberAddress: string
  ): Promise<GroupOperationResult> {
    debugLog('[GroupService] unblockMember:', { feedId, memberAddress });
    try {
      const client = getGrpcClient();
      const request: UnblockMemberRequest = {
        FeedId: feedId,
        AdminPublicAddress: adminAddress,
        UnblockedUserPublicAddress: memberAddress,
      };

      const response = await client.unaryCall<UnblockMemberRequest, UnblockMemberResponse>(
        SERVICE_NAME,
        'UnblockMember',
        request
      );

      if (response.Success) {
        return wrapResult(true, { message: response.Message });
      }
      return wrapResult(false, undefined, response.Message);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to unblock member';
      debugLog('[GroupService] unblockMember error:', message);
      return wrapResult(false, undefined, message);
    }
  },

  /**
   * Ban a member (admin only) - completely removes from group
   */
  async banMember(
    feedId: string,
    adminAddress: string,
    memberAddress: string,
    reason?: string
  ): Promise<GroupOperationResult> {
    debugLog('[GroupService] banMember:', { feedId, memberAddress });
    try {
      const client = getGrpcClient();
      const request: BanFromGroupFeedRequest = {
        FeedId: feedId,
        AdminPublicAddress: adminAddress,
        BannedUserPublicAddress: memberAddress,
        Reason: reason,
      };

      const response = await client.unaryCall<BanFromGroupFeedRequest, BanFromGroupFeedResponse>(
        SERVICE_NAME,
        'BanFromGroupFeed',
        request
      );

      if (response.Success) {
        return wrapResult(true, { message: response.Message });
      }
      return wrapResult(false, undefined, response.Message);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to ban member';
      debugLog('[GroupService] banMember error:', message);
      return wrapResult(false, undefined, message);
    }
  },

  /**
   * Unban a member (admin only)
   */
  async unbanMember(
    feedId: string,
    adminAddress: string,
    memberAddress: string
  ): Promise<GroupOperationResult> {
    debugLog('[GroupService] unbanMember:', { feedId, memberAddress });
    try {
      const client = getGrpcClient();
      const request: UnbanFromGroupFeedRequest = {
        FeedId: feedId,
        AdminPublicAddress: adminAddress,
        UnbannedUserPublicAddress: memberAddress,
      };

      const response = await client.unaryCall<UnbanFromGroupFeedRequest, UnbanFromGroupFeedResponse>(
        SERVICE_NAME,
        'UnbanFromGroupFeed',
        request
      );

      if (response.Success) {
        return wrapResult(true, { message: response.Message });
      }
      return wrapResult(false, undefined, response.Message);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to unban member';
      debugLog('[GroupService] unbanMember error:', message);
      return wrapResult(false, undefined, message);
    }
  },

  /**
   * Promote a member to admin (admin only)
   */
  async promoteToAdmin(
    feedId: string,
    adminAddress: string,
    memberAddress: string
  ): Promise<GroupOperationResult> {
    debugLog('[GroupService] promoteToAdmin:', { feedId, memberAddress });
    try {
      const client = getGrpcClient();
      const request: PromoteToAdminRequest = {
        FeedId: feedId,
        AdminPublicAddress: adminAddress,
        MemberPublicAddress: memberAddress,
      };

      const response = await client.unaryCall<PromoteToAdminRequest, PromoteToAdminResponse>(
        SERVICE_NAME,
        'PromoteToAdmin',
        request
      );

      if (response.Success) {
        return wrapResult(true, { message: response.Message });
      }
      return wrapResult(false, undefined, response.Message);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to promote member';
      debugLog('[GroupService] promoteToAdmin error:', message);
      return wrapResult(false, undefined, message);
    }
  },

  /**
   * Update group title (admin only)
   */
  async updateTitle(
    feedId: string,
    adminAddress: string,
    newTitle: string
  ): Promise<GroupOperationResult> {
    debugLog('[GroupService] updateTitle:', { feedId, newTitle });
    try {
      const client = getGrpcClient();
      const request: UpdateGroupFeedTitleRequest = {
        FeedId: feedId,
        AdminPublicAddress: adminAddress,
        NewTitle: newTitle,
      };

      const response = await client.unaryCall<UpdateGroupFeedTitleRequest, UpdateGroupFeedTitleResponse>(
        SERVICE_NAME,
        'UpdateGroupFeedTitle',
        request
      );

      if (response.Success) {
        return wrapResult(true, { message: response.Message });
      }
      return wrapResult(false, undefined, response.Message);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update title';
      debugLog('[GroupService] updateTitle error:', message);
      return wrapResult(false, undefined, message);
    }
  },

  /**
   * Update group description (admin only)
   */
  async updateDescription(
    feedId: string,
    adminAddress: string,
    newDescription: string
  ): Promise<GroupOperationResult> {
    debugLog('[GroupService] updateDescription:', { feedId });
    try {
      const client = getGrpcClient();
      const request: UpdateGroupFeedDescriptionRequest = {
        FeedId: feedId,
        AdminPublicAddress: adminAddress,
        NewDescription: newDescription,
      };

      const response = await client.unaryCall<UpdateGroupFeedDescriptionRequest, UpdateGroupFeedDescriptionResponse>(
        SERVICE_NAME,
        'UpdateGroupFeedDescription',
        request
      );

      if (response.Success) {
        return wrapResult(true, { message: response.Message });
      }
      return wrapResult(false, undefined, response.Message);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update description';
      debugLog('[GroupService] updateDescription error:', message);
      return wrapResult(false, undefined, message);
    }
  },

  /**
   * Update group settings (title, description, visibility) in a single call (admin only)
   * Only provided fields will be updated
   */
  async updateSettings(
    feedId: string,
    adminAddress: string,
    settings: {
      newTitle?: string;
      newDescription?: string;
      isPublic?: boolean;
    }
  ): Promise<GroupOperationResult> {
    debugLog('[GroupService] updateSettings:', { feedId, settings });
    try {
      const url = buildApiUrl('/api/groups/settings');
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedId,
          adminPublicAddress: adminAddress,
          ...settings,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      debugLog('[GroupService] updateSettings result:', result);
      if (result.success) {
        return wrapResult(true, { message: result.message });
      }
      return wrapResult(false, undefined, result.message || result.error);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update settings';
      debugLog('[GroupService] updateSettings error:', message);
      return wrapResult(false, undefined, message);
    }
  },

  /**
   * Delete a group feed (admin only)
   */
  async deleteGroup(feedId: string, adminAddress: string): Promise<GroupOperationResult> {
    debugLog('[GroupService] deleteGroup:', { feedId });
    try {
      const client = getGrpcClient();
      const request: DeleteGroupFeedRequest = {
        FeedId: feedId,
        AdminPublicAddress: adminAddress,
      };

      const response = await client.unaryCall<DeleteGroupFeedRequest, DeleteGroupFeedResponse>(
        SERVICE_NAME,
        'DeleteGroupFeed',
        request
      );

      if (response.Success) {
        return wrapResult(true, { message: response.Message });
      }
      return wrapResult(false, undefined, response.Message);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete group';
      debugLog('[GroupService] deleteGroup error:', message);
      return wrapResult(false, undefined, message);
    }
  },

  /**
   * Get group feed information
   * Uses API route for proper binary protobuf communication
   */
  async getGroupInfo(feedId: string): Promise<GetGroupFeedResponse | null> {
    debugLog('[GroupService] getGroupInfo:', { feedId });
    try {
      const url = buildApiUrl(`/api/groups/info?feedId=${encodeURIComponent(feedId)}`);
      debugLog('[GroupService] getGroupInfo URL:', url);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Map API response to GetGroupFeedResponse type (PascalCase)
      const result: GetGroupFeedResponse = {
        Success: data.success,
        Message: data.message || '',
        FeedId: data.feedId || '',
        Title: data.title || '',
        Description: data.description || '',
        IsPublic: data.isPublic || false,
        MemberCount: data.memberCount || 0,
        CurrentKeyGeneration: data.currentKeyGeneration || 0,
      };

      debugLog('[GroupService] getGroupInfo result:', { success: result.Success, title: result.Title });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get group info';
      debugLog('[GroupService] getGroupInfo error:', message);
      return null;
    }
  },

  /**
   * Get group members
   * Uses API route for proper binary protobuf communication
   */
  async getGroupMembers(feedId: string): Promise<GroupFeedMember[]> {
    debugLog('[GroupService] getGroupMembers:', { feedId });
    try {
      const url = buildApiUrl(`/api/groups/members?feedId=${encodeURIComponent(feedId)}`);
      debugLog('[GroupService] getGroupMembers URL:', url);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Map API response to GroupFeedMember type
      // Server now returns displayName and leftAtBlock for historical membership tracking
      const members = (data.members || []).map((m: {
        publicAddress: string;
        participantType: number;
        joinedAtBlock: number;
        leftAtBlock?: number;
        displayName?: string;
      }) => ({
        publicAddress: m.publicAddress,
        displayName: m.displayName || '', // Server provides display name now
        role: mapParticipantTypeToRole(m.participantType),
        joinedAtBlock: m.joinedAtBlock,
        leftAtBlock: m.leftAtBlock, // For historical "member left" events
      }));

      debugLog('[GroupService] getGroupMembers result:', { count: members.length });
      return members;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get group members';
      debugLog('[GroupService] getGroupMembers error:', message);
      return [];
    }
  },

  /**
   * Get KeyGenerations for a user in a group
   * Uses API route for proper binary protobuf communication
   *
   * Returns all KeyGenerations the user has access to. The server only returns
   * KeyGenerations where the user was an active member when the key was created.
   * Gaps in KeyGeneration numbers indicate periods when the user was banned.
   */
  async getKeyGenerations(feedId: string, userAddress: string): Promise<KeyGenerationProto[]> {
    debugLog('[GroupService] getKeyGenerations:', { feedId: feedId.substring(0, 8), userAddress: userAddress.substring(0, 8) });
    try {
      const url = buildApiUrl(`/api/groups/key-generations?feedId=${encodeURIComponent(feedId)}&userAddress=${encodeURIComponent(userAddress)}`);
      debugLog('[GroupService] getKeyGenerations URL:', url);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Map API response to KeyGenerationProto type
      const keyGenerations = (data.keyGenerations || []).map((kg: { keyGeneration: number; encryptedKey: string; validFromBlock: number; validToBlock?: number }) => ({
        KeyGeneration: kg.keyGeneration,
        EncryptedKey: kg.encryptedKey,
        ValidFromBlock: kg.validFromBlock,
        ValidToBlock: kg.validToBlock,
      }));

      debugLog('[GroupService] getKeyGenerations result:', { count: keyGenerations.length });
      return keyGenerations;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get key generations';
      debugLog('[GroupService] getKeyGenerations error:', message);
      return [];
    }
  },

  /**
   * Search for public groups by title or description
   * Uses API route for proper binary protobuf communication
   */
  async searchPublicGroups(searchQuery: string, maxResults: number = 20): Promise<PublicGroupInfo[]> {
    debugLog('[GroupService] searchPublicGroups:', { searchQuery, maxResults });
    try {
      const url = buildApiUrl(`/api/groups/search?query=${encodeURIComponent(searchQuery)}&maxResults=${maxResults}`);
      debugLog('[GroupService] searchPublicGroups URL:', url);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      debugLog('[GroupService] searchPublicGroups response:', { success: data.success, count: data.groups?.length ?? 0 });

      if (!data.success) {
        debugLog('[GroupService] searchPublicGroups failed:', data.message);
        return [];
      }

      // Map API response to PublicGroupInfo type
      const groups: PublicGroupInfo[] = (data.groups || []).map((g: { feedId: string; title: string; description?: string; memberCount: number }) => ({
        feedId: g.feedId,
        name: g.title,
        description: g.description || undefined,
        memberCount: g.memberCount,
        isPublic: true, // Search only returns public groups
      }));

      debugLog('[GroupService] searchPublicGroups result:', { count: groups.length });
      return groups;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to search public groups';
      debugLog('[GroupService] searchPublicGroups error:', message);
      return [];
    }
  },
};

/**
 * Map ParticipantType enum to GroupMemberRole
 *
 * Server-side ParticipantType enum:
 *   Owner = 0, Member = 1, Guest = 2, Admin = 3, Blocked = 4, Banned = 5
 */
function mapParticipantTypeToRole(participantType: number): 'Admin' | 'Member' | 'Blocked' {
  switch (participantType) {
    case 0: // Owner
    case 3: // Admin
      return 'Admin';
    case 4: // Blocked
      return 'Blocked';
    case 1: // Member
    case 2: // Guest
    default:
      return 'Member';
  }
}
