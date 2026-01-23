/**
 * Group Feed Transaction Functions
 *
 * High-level transaction functions that combine crypto operations with gRPC calls.
 * These functions orchestrate the complete flow for group operations:
 * - Join/Leave group
 * - Admin operations (add member, block, ban, promote, etc.)
 *
 * Key Concepts:
 * - Key Rotation: Ban/Unban operations trigger key rotation on the server
 * - KeyGeneration: After key rotation, users receive new encrypted keys
 * - These functions call groupService (gRPC) and handle local state updates
 */

import { groupService } from '@/lib/grpc/services/group';
import { identityService } from '@/lib/grpc/services/identity';
import { blockchainService } from '@/lib/grpc/services/blockchain';
import { createGroupFeedTransaction, createJoinGroupFeedTransaction, type GroupParticipantInput } from './transactions';
import { decryptKeyGeneration } from './group-crypto';
import type { GroupOperationResult, GroupCreationData } from '@/types';
import type { GroupFeedParticipantProto } from '@/lib/grpc/types';
import { debugLog, debugError } from '@/lib/debug-logger';

/**
 * Result type for group transaction operations
 * Extends GroupOperationResult with additional crypto data
 */
export interface GroupTransactionResult extends GroupOperationResult {
  /** Feed ID for create operations */
  feedId?: string;
  /** Decrypted AES key for local storage */
  feedAesKey?: string;
  /** Signed transaction for debugging/verification */
  signedTransaction?: string;
}

/**
 * Create a new group feed with encrypted keys for all participants
 *
 * Flow:
 * 1. Generate AES key for the group
 * 2. ECIES encrypt the key for each participant
 * 3. Create and sign the transaction
 * 4. Submit via SubmitSignedTransaction gRPC
 * 5. Transaction goes to mempool, then to blockchain
 * 6. NewGroupFeedTransactionHandler processes it during indexing
 * 7. Return feedId and feedAesKey for local storage
 *
 * @param data - Group creation data (name, description, isPublic, memberAddresses)
 * @param creatorSigningAddress - Creator's public signing address
 * @param creatorEncryptAddress - Creator's public encryption address
 * @param participantData - Array of participant public keys (signing + encrypt)
 * @param signingPrivateKey - Creator's private signing key
 * @returns GroupTransactionResult with feedId and feedAesKey
 */
export async function createGroup(
  data: GroupCreationData,
  creatorSigningAddress: string,
  creatorEncryptAddress: string,
  participantData: GroupParticipantInput[],
  signingPrivateKey: Uint8Array
): Promise<GroupTransactionResult> {
  debugLog('[GroupTransactions] createGroup:', { name: data.name, isPublic: data.isPublic });

  try {
    // Step 1-3: Create the transaction with encrypted keys
    const { signedTransaction, feedId, feedAesKey } = await createGroupFeedTransaction(
      data.name,
      data.description || '',
      data.isPublic,
      creatorSigningAddress,
      creatorEncryptAddress,
      participantData,
      signingPrivateKey
    );

    debugLog('[GroupTransactions] createGroup: transaction created, submitting...');

    // Step 4: Submit via SubmitSignedTransaction
    const result = await blockchainService.submitSignedTransaction(signedTransaction);

    if (!result.Successfull) {
      debugError('[GroupTransactions] createGroup: transaction rejected:', result.Message);
      return {
        success: false,
        error: result.Message || 'Transaction rejected by server',
      };
    }

    debugLog('[GroupTransactions] createGroup: transaction submitted successfully');

    // Step 5: Return success with crypto data
    return {
      success: true,
      feedId,
      feedAesKey,
      signedTransaction,
      data: { feedId, message: 'Group creation transaction submitted - will be processed in next block' },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create group';
    debugError('[GroupTransactions] createGroup error:', message);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Join a public group feed
 *
 * Flow:
 * 1. Create and sign a JoinGroupFeed transaction
 * 2. Submit via SubmitSignedTransaction gRPC
 * 3. Transaction goes to mempool, then to blockchain
 * 4. JoinGroupFeedTransactionHandler processes it during indexing
 * 5. Server triggers key rotation
 * 6. The new KeyGeneration will be received during next sync
 *
 * Note: The encrypted key is not immediately available.
 * The FeedsSyncable will pick up the new feed and key during sync.
 *
 * @param feedId - Group feed ID to join
 * @param userAddress - User's public signing address
 * @param signingPrivateKey - User's private signing key for transaction signing
 * @returns GroupOperationResult
 */
export async function joinPublicGroup(
  feedId: string,
  userAddress: string,
  signingPrivateKey: Uint8Array
): Promise<GroupOperationResult> {
  debugLog('[GroupTransactions] joinPublicGroup:', { feedId, userAddress });

  try {
    // Step 1: Create and sign the JoinGroupFeed transaction
    const { signedTransaction } = await createJoinGroupFeedTransaction(
      feedId,
      userAddress,
      signingPrivateKey
    );

    debugLog('[GroupTransactions] joinPublicGroup: transaction created, submitting...');

    // Step 2: Submit via SubmitSignedTransaction
    const result = await blockchainService.submitSignedTransaction(signedTransaction);

    if (!result.Successfull) {
      debugError('[GroupTransactions] joinPublicGroup: transaction rejected:', result.Message);
      return {
        success: false,
        error: result.Message || 'Transaction rejected by server',
      };
    }

    debugLog('[GroupTransactions] joinPublicGroup: transaction submitted successfully');

    // Key will be received during sync after block is indexed
    return {
      success: true,
      data: { feedId, message: 'Join transaction submitted - will be processed in next block' },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to join group';
    debugError('[GroupTransactions] joinPublicGroup error:', message);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Leave a group feed
 *
 * Flow:
 * 1. Submit leave request via gRPC
 * 2. Server triggers key rotation (excluding leaving user)
 * 3. User keeps old keys for historical messages
 *
 * Note: If user is the last admin, the group will be deleted.
 *
 * @param feedId - Group feed ID to leave
 * @param userAddress - User's public signing address
 * @returns GroupOperationResult
 */
export async function leaveGroup(
  feedId: string,
  userAddress: string
): Promise<GroupOperationResult> {
  debugLog('[GroupTransactions] leaveGroup:', { feedId, userAddress });

  try {
    const result = await groupService.leaveGroup(feedId, userAddress);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to leave group',
      };
    }

    return {
      success: true,
      data: { message: result.data?.message || 'Left group successfully' },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to leave group';
    debugError('[GroupTransactions] leaveGroup error:', message);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Add a member to a private group (admin only)
 *
 * Flow:
 * 1. Fetch new member's public encrypt key from identity service
 * 2. Submit add member request via gRPC
 * 3. Server triggers key rotation (including new member)
 *
 * @param feedId - Group feed ID
 * @param adminAddress - Admin's public signing address
 * @param memberAddress - New member's public signing address
 * @returns GroupOperationResult
 */
export async function addMemberToGroup(
  feedId: string,
  adminAddress: string,
  memberAddress: string
): Promise<GroupOperationResult> {
  debugLog('[GroupTransactions] addMemberToGroup:', { feedId, memberAddress });

  try {
    // Step 1: Fetch new member's public encrypt key
    const identity = await identityService.getIdentity(memberAddress);

    if (!identity.Successfull) {
      return {
        success: false,
        error: identity.Message || 'Failed to fetch member identity',
      };
    }

    if (!identity.PublicEncryptAddress) {
      return {
        success: false,
        error: 'Member has no encryption key registered',
      };
    }

    // Step 2: Submit add member request
    const result = await groupService.addMember(
      feedId,
      adminAddress,
      memberAddress,
      identity.PublicEncryptAddress
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to add member',
      };
    }

    return {
      success: true,
      data: { message: result.data?.message || 'Member added successfully' },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add member';
    debugError('[GroupTransactions] addMemberToGroup error:', message);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Block a member (admin only)
 * Member can still view messages but cannot send new ones.
 * Does NOT trigger key rotation.
 *
 * @param feedId - Group feed ID
 * @param adminAddress - Admin's public signing address
 * @param memberAddress - Member's public signing address to block
 * @param reason - Optional reason for blocking
 * @returns GroupOperationResult
 */
export async function blockMember(
  feedId: string,
  adminAddress: string,
  memberAddress: string,
  reason?: string
): Promise<GroupOperationResult> {
  debugLog('[GroupTransactions] blockMember:', { feedId, memberAddress });

  try {
    const result = await groupService.blockMember(feedId, adminAddress, memberAddress, reason);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to block member',
      };
    }

    return {
      success: true,
      data: { message: result.data?.message || 'Member blocked successfully' },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to block member';
    debugError('[GroupTransactions] blockMember error:', message);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Unblock a member (admin only)
 * Member can send messages again.
 * Does NOT trigger key rotation.
 *
 * @param feedId - Group feed ID
 * @param adminAddress - Admin's public signing address
 * @param memberAddress - Member's public signing address to unblock
 * @returns GroupOperationResult
 */
export async function unblockMember(
  feedId: string,
  adminAddress: string,
  memberAddress: string
): Promise<GroupOperationResult> {
  debugLog('[GroupTransactions] unblockMember:', { feedId, memberAddress });

  try {
    const result = await groupService.unblockMember(feedId, adminAddress, memberAddress);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to unblock member',
      };
    }

    return {
      success: true,
      data: { message: result.data?.message || 'Member unblocked successfully' },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to unblock member';
    debugError('[GroupTransactions] unblockMember error:', message);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Ban a member (admin only)
 * Completely removes member from group. TRIGGERS KEY ROTATION.
 * Banned member loses access to future messages.
 *
 * @param feedId - Group feed ID
 * @param adminAddress - Admin's public signing address
 * @param memberAddress - Member's public signing address to ban
 * @param reason - Optional reason for banning
 * @returns GroupOperationResult
 */
export async function banMember(
  feedId: string,
  adminAddress: string,
  memberAddress: string,
  reason?: string
): Promise<GroupOperationResult> {
  debugLog('[GroupTransactions] banMember:', { feedId, memberAddress });

  try {
    const result = await groupService.banMember(feedId, adminAddress, memberAddress, reason);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to ban member',
      };
    }

    // Note: Key rotation happens on server. New keys will be received during sync.
    return {
      success: true,
      data: { message: result.data?.message || 'Member banned successfully' },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to ban member';
    debugError('[GroupTransactions] banMember error:', message);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Unban a member (admin only)
 * Allows member to rejoin. TRIGGERS KEY ROTATION.
 * Unbanned member gets new key but cannot decrypt messages from ban period.
 *
 * @param feedId - Group feed ID
 * @param adminAddress - Admin's public signing address
 * @param memberAddress - Member's public signing address to unban
 * @returns GroupOperationResult
 */
export async function unbanMember(
  feedId: string,
  adminAddress: string,
  memberAddress: string
): Promise<GroupOperationResult> {
  debugLog('[GroupTransactions] unbanMember:', { feedId, memberAddress });

  try {
    const result = await groupService.unbanMember(feedId, adminAddress, memberAddress);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to unban member',
      };
    }

    // Note: Key rotation happens on server. New keys will be received during sync.
    return {
      success: true,
      data: { message: result.data?.message || 'Member unbanned successfully' },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to unban member';
    debugError('[GroupTransactions] unbanMember error:', message);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Promote a member to admin (admin only)
 * Does NOT trigger key rotation.
 *
 * @param feedId - Group feed ID
 * @param adminAddress - Current admin's public signing address
 * @param memberAddress - Member's public signing address to promote
 * @returns GroupOperationResult
 */
export async function promoteMember(
  feedId: string,
  adminAddress: string,
  memberAddress: string
): Promise<GroupOperationResult> {
  debugLog('[GroupTransactions] promoteMember:', { feedId, memberAddress });

  try {
    const result = await groupService.promoteToAdmin(feedId, adminAddress, memberAddress);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to promote member',
      };
    }

    return {
      success: true,
      data: { message: result.data?.message || 'Member promoted to admin successfully' },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to promote member';
    debugError('[GroupTransactions] promoteMember error:', message);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Update group title (admin only)
 *
 * @param feedId - Group feed ID
 * @param adminAddress - Admin's public signing address
 * @param newTitle - New title for the group
 * @returns GroupOperationResult
 */
export async function updateGroupTitle(
  feedId: string,
  adminAddress: string,
  newTitle: string
): Promise<GroupOperationResult> {
  debugLog('[GroupTransactions] updateGroupTitle:', { feedId, newTitle });

  try {
    const result = await groupService.updateTitle(feedId, adminAddress, newTitle);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to update title',
      };
    }

    return {
      success: true,
      data: { message: result.data?.message || 'Title updated successfully' },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update title';
    debugError('[GroupTransactions] updateGroupTitle error:', message);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Update group description (admin only)
 *
 * @param feedId - Group feed ID
 * @param adminAddress - Admin's public signing address
 * @param newDescription - New description for the group
 * @returns GroupOperationResult
 */
export async function updateGroupDescription(
  feedId: string,
  adminAddress: string,
  newDescription: string
): Promise<GroupOperationResult> {
  debugLog('[GroupTransactions] updateGroupDescription:', { feedId });

  try {
    const result = await groupService.updateDescription(feedId, adminAddress, newDescription);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to update description',
      };
    }

    return {
      success: true,
      data: { message: result.data?.message || 'Description updated successfully' },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update description';
    debugError('[GroupTransactions] updateGroupDescription error:', message);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Delete a group (admin only)
 * Only the last admin can delete a group.
 *
 * @param feedId - Group feed ID
 * @param adminAddress - Admin's public signing address
 * @returns GroupOperationResult
 */
export async function deleteGroup(
  feedId: string,
  adminAddress: string
): Promise<GroupOperationResult> {
  debugLog('[GroupTransactions] deleteGroup:', { feedId });

  try {
    const result = await groupService.deleteGroup(feedId, adminAddress);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to delete group',
      };
    }

    return {
      success: true,
      data: { message: result.data?.message || 'Group deleted successfully' },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete group';
    debugError('[GroupTransactions] deleteGroup error:', message);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Process a received KeyGeneration after key rotation
 * Decrypts the encrypted key and returns the AES key for storage
 *
 * @param encryptedKey - ECIES-encrypted AES key
 * @param privateEncryptKeyHex - User's private encryption key (hex)
 * @returns Decrypted AES key or error
 */
export async function processKeyGeneration(
  encryptedKey: string,
  privateEncryptKeyHex: string
): Promise<{ success: boolean; aesKey?: string; error?: string }> {
  debugLog('[GroupTransactions] processKeyGeneration');

  const result = await decryptKeyGeneration(encryptedKey, privateEncryptKeyHex);

  if (!result.success) {
    debugError('[GroupTransactions] processKeyGeneration error:', result.error);
    return {
      success: false,
      error: result.error || 'Failed to decrypt KeyGeneration',
    };
  }

  return {
    success: true,
    aesKey: result.data,
  };
}
