/**
 * Group Feed Types
 *
 * TypeScript interfaces for group feed functionality.
 * Used for group creation, member management, and group discovery.
 */

/**
 * Valid member roles in a group feed
 */
export type GroupMemberRole = 'Admin' | 'Member' | 'Blocked';

/**
 * A member of a group feed with their role and identity
 */
export interface GroupFeedMember {
  /** Public signing address of the member */
  publicAddress: string;
  /** Display name of the member */
  displayName: string;
  /** Role of the member in the group */
  role: GroupMemberRole;
  /** Block height when the member joined (optional) */
  joinedAtBlock?: number;
  /** Block height when the member left/was banned (optional, only for historical members) */
  leftAtBlock?: number;
}

/**
 * Information about a public group for discovery/search results
 */
export interface PublicGroupInfo {
  /** Unique identifier for the group feed */
  feedId: string;
  /** Display name of the group */
  name: string;
  /** Optional description of the group */
  description?: string;
  /** Number of members in the group */
  memberCount: number;
  /** Whether the group is public (always true for search results) */
  isPublic: boolean;
}

/**
 * Data required to create a new group feed
 */
export interface GroupCreationData {
  /** Group name (1-100 characters) */
  name: string;
  /** Optional group description (max 500 characters) */
  description?: string;
  /** Whether the group is public (default: false) */
  isPublic: boolean;
  /** Public addresses of initial members (minimum 1 required) */
  memberAddresses: string[];
}

/**
 * Result of a group operation (create, join, leave, etc.)
 */
export interface GroupOperationResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Optional data returned from the operation */
  data?: {
    feedId?: string;
    message?: string;
  };
  /** Error message if operation failed */
  error?: string;
}

/**
 * Participant data for group creation (includes encryption key)
 */
export interface GroupParticipantData {
  /** Public signing address */
  publicAddress: string;
  /** Public encryption address for key exchange */
  publicEncryptAddress: string;
  /** Display name */
  displayName: string;
}

// Type guards for runtime validation

/**
 * Check if a value is a valid GroupMemberRole
 */
export function isGroupMemberRole(value: unknown): value is GroupMemberRole {
  return value === 'Admin' || value === 'Member' || value === 'Blocked';
}

/**
 * Check if an object is a valid GroupFeedMember
 */
export function isGroupFeedMember(obj: unknown): obj is GroupFeedMember {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  const candidate = obj as Record<string, unknown>;
  return (
    typeof candidate.publicAddress === 'string' &&
    typeof candidate.displayName === 'string' &&
    isGroupMemberRole(candidate.role)
  );
}

/**
 * Check if an object is a valid PublicGroupInfo
 */
export function isPublicGroupInfo(obj: unknown): obj is PublicGroupInfo {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  const candidate = obj as Record<string, unknown>;
  return (
    typeof candidate.feedId === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.memberCount === 'number' &&
    typeof candidate.isPublic === 'boolean' &&
    (candidate.description === undefined || typeof candidate.description === 'string')
  );
}

/**
 * Check if an object is valid GroupCreationData
 */
export function isGroupCreationData(obj: unknown): obj is GroupCreationData {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  const candidate = obj as Record<string, unknown>;
  return (
    typeof candidate.name === 'string' &&
    candidate.name.length >= 1 &&
    candidate.name.length <= 100 &&
    typeof candidate.isPublic === 'boolean' &&
    Array.isArray(candidate.memberAddresses) &&
    candidate.memberAddresses.length >= 1 &&
    candidate.memberAddresses.every((addr) => typeof addr === 'string') &&
    (candidate.description === undefined ||
      (typeof candidate.description === 'string' && candidate.description.length <= 500))
  );
}
