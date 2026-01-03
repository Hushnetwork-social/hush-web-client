/**
 * Group Feed gRPC Service
 *
 * Client-side service functions for group feed operations.
 * Communicates with HushFeed gRPC service on the Node.
 */

import { getGrpcClient } from '../client';
import { debugLog } from '@/lib/debug-logger';
import type {
  NewGroupFeedRequest,
  NewGroupFeedResponse,
  JoinGroupFeedRequest,
  JoinGroupFeedResponse,
  LeaveGroupFeedRequest,
  LeaveGroupFeedResponse,
  AddMemberToGroupFeedRequest,
  AddMemberToGroupFeedResponse,
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
  GetGroupFeedRequest,
  GetGroupFeedResponse,
  GetGroupMembersRequest,
  GetGroupMembersResponse,
  GetKeyGenerationsRequest,
  GetKeyGenerationsResponse,
  KeyGenerationProto,
  GroupFeedParticipantProto,
} from '../types';
import type { GroupCreationData, GroupOperationResult, GroupFeedMember } from '@/types';

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
   */
  async joinGroup(feedId: string, userAddress: string): Promise<GroupOperationResult> {
    debugLog('[GroupService] joinGroup:', { feedId, userAddress });
    try {
      const client = getGrpcClient();
      const request: JoinGroupFeedRequest = {
        FeedId: feedId,
        JoiningUserPublicAddress: userAddress,
      };

      const response = await client.unaryCall<JoinGroupFeedRequest, JoinGroupFeedResponse>(
        SERVICE_NAME,
        'JoinGroupFeed',
        request
      );

      if (response.Success) {
        return wrapResult(true, { feedId, message: response.Message });
      }
      return wrapResult(false, undefined, response.Message);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to join group';
      debugLog('[GroupService] joinGroup error:', message);
      return wrapResult(false, undefined, message);
    }
  },

  /**
   * Leave a group feed
   */
  async leaveGroup(feedId: string, userAddress: string): Promise<GroupOperationResult> {
    debugLog('[GroupService] leaveGroup:', { feedId, userAddress });
    try {
      const client = getGrpcClient();
      const request: LeaveGroupFeedRequest = {
        FeedId: feedId,
        LeavingUserPublicAddress: userAddress,
      };

      const response = await client.unaryCall<LeaveGroupFeedRequest, LeaveGroupFeedResponse>(
        SERVICE_NAME,
        'LeaveGroupFeed',
        request
      );

      if (response.Success) {
        return wrapResult(true, { message: response.Message });
      }
      return wrapResult(false, undefined, response.Message);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to leave group';
      debugLog('[GroupService] leaveGroup error:', message);
      return wrapResult(false, undefined, message);
    }
  },

  /**
   * Add a member to a group (admin only)
   */
  async addMember(
    feedId: string,
    adminAddress: string,
    memberAddress: string,
    memberEncryptKey: string
  ): Promise<GroupOperationResult> {
    debugLog('[GroupService] addMember:', { feedId, memberAddress });
    try {
      const client = getGrpcClient();
      const request: AddMemberToGroupFeedRequest = {
        FeedId: feedId,
        AdminPublicAddress: adminAddress,
        NewMemberPublicAddress: memberAddress,
        NewMemberPublicEncryptKey: memberEncryptKey,
      };

      const response = await client.unaryCall<AddMemberToGroupFeedRequest, AddMemberToGroupFeedResponse>(
        SERVICE_NAME,
        'AddMemberToGroupFeed',
        request
      );

      if (response.Success) {
        return wrapResult(true, { message: response.Message });
      }
      return wrapResult(false, undefined, response.Message);
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
   */
  async getGroupInfo(feedId: string): Promise<GetGroupFeedResponse | null> {
    debugLog('[GroupService] getGroupInfo:', { feedId });
    try {
      const client = getGrpcClient();
      const request: GetGroupFeedRequest = {
        FeedId: feedId,
      };

      const response = await client.unaryCall<GetGroupFeedRequest, GetGroupFeedResponse>(
        SERVICE_NAME,
        'GetGroupFeed',
        request
      );

      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get group info';
      debugLog('[GroupService] getGroupInfo error:', message);
      return null;
    }
  },

  /**
   * Get group members
   */
  async getGroupMembers(feedId: string): Promise<GroupFeedMember[]> {
    debugLog('[GroupService] getGroupMembers:', { feedId });
    try {
      const client = getGrpcClient();
      const request: GetGroupMembersRequest = {
        FeedId: feedId,
      };

      const response = await client.unaryCall<GetGroupMembersRequest, GetGroupMembersResponse>(
        SERVICE_NAME,
        'GetGroupMembers',
        request
      );

      // Map proto response to GroupFeedMember type
      return response.Members.map((m) => ({
        publicAddress: m.PublicAddress,
        displayName: '', // Will be populated by identity lookup
        role: mapParticipantTypeToRole(m.ParticipantType),
        joinedAtBlock: m.JoinedAtBlock,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get group members';
      debugLog('[GroupService] getGroupMembers error:', message);
      return [];
    }
  },

  /**
   * Get KeyGenerations for a user in a group
   *
   * Returns all KeyGenerations the user has access to. The server only returns
   * KeyGenerations where the user was an active member when the key was created.
   * Gaps in KeyGeneration numbers indicate periods when the user was banned.
   */
  async getKeyGenerations(feedId: string, userAddress: string): Promise<KeyGenerationProto[]> {
    debugLog('[GroupService] getKeyGenerations:', { feedId: feedId.substring(0, 8), userAddress: userAddress.substring(0, 8) });
    try {
      const client = getGrpcClient();
      const request: GetKeyGenerationsRequest = {
        FeedId: feedId,
        UserPublicAddress: userAddress,
      };

      const response = await client.unaryCall<GetKeyGenerationsRequest, GetKeyGenerationsResponse>(
        SERVICE_NAME,
        'GetKeyGenerations',
        request
      );

      debugLog('[GroupService] getKeyGenerations result:', { count: response.KeyGenerations?.length ?? 0 });
      return response.KeyGenerations ?? [];
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get key generations';
      debugLog('[GroupService] getKeyGenerations error:', message);
      return [];
    }
  },
};

/**
 * Map ParticipantType enum to GroupMemberRole
 */
function mapParticipantTypeToRole(participantType: number): 'Admin' | 'Member' | 'Blocked' {
  switch (participantType) {
    case 0: // Owner
    case 2: // Admin
      return 'Admin';
    case 3: // Blocked (if we add this to enum)
      return 'Blocked';
    default:
      return 'Member';
  }
}
