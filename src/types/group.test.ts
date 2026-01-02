/**
 * Unit tests for group types and type guards
 */

import { describe, it, expect } from 'vitest';
import {
  isGroupMemberRole,
  isGroupFeedMember,
  isPublicGroupInfo,
  isGroupCreationData,
  type GroupFeedMember,
  type PublicGroupInfo,
  type GroupCreationData,
} from './group';

describe('isGroupMemberRole', () => {
  it('should return true for Admin', () => {
    expect(isGroupMemberRole('Admin')).toBe(true);
  });

  it('should return true for Member', () => {
    expect(isGroupMemberRole('Member')).toBe(true);
  });

  it('should return true for Blocked', () => {
    expect(isGroupMemberRole('Blocked')).toBe(true);
  });

  it('should return false for invalid role', () => {
    expect(isGroupMemberRole('Owner')).toBe(false);
    expect(isGroupMemberRole('admin')).toBe(false);
    expect(isGroupMemberRole('')).toBe(false);
  });

  it('should return false for non-string values', () => {
    expect(isGroupMemberRole(null)).toBe(false);
    expect(isGroupMemberRole(undefined)).toBe(false);
    expect(isGroupMemberRole(123)).toBe(false);
    expect(isGroupMemberRole({})).toBe(false);
  });
});

describe('isGroupFeedMember', () => {
  const validMember: GroupFeedMember = {
    publicAddress: 'addr123',
    displayName: 'Alice',
    role: 'Admin',
  };

  it('should return true for valid GroupFeedMember', () => {
    expect(isGroupFeedMember(validMember)).toBe(true);
  });

  it('should return true for member with optional joinedAtBlock', () => {
    const memberWithBlock = { ...validMember, joinedAtBlock: 12345 };
    expect(isGroupFeedMember(memberWithBlock)).toBe(true);
  });

  it('should return true for all valid roles', () => {
    expect(isGroupFeedMember({ ...validMember, role: 'Admin' })).toBe(true);
    expect(isGroupFeedMember({ ...validMember, role: 'Member' })).toBe(true);
    expect(isGroupFeedMember({ ...validMember, role: 'Blocked' })).toBe(true);
  });

  it('should return false for invalid role value', () => {
    const invalidRole = { ...validMember, role: 'InvalidRole' };
    expect(isGroupFeedMember(invalidRole)).toBe(false);
  });

  it('should return false for missing publicAddress', () => {
    const { publicAddress: _, ...withoutAddress } = validMember;
    expect(isGroupFeedMember(withoutAddress)).toBe(false);
  });

  it('should return false for missing displayName', () => {
    const { displayName: _, ...withoutName } = validMember;
    expect(isGroupFeedMember(withoutName)).toBe(false);
  });

  it('should return false for missing role', () => {
    const { role: _, ...withoutRole } = validMember;
    expect(isGroupFeedMember(withoutRole)).toBe(false);
  });

  it('should return false for null', () => {
    expect(isGroupFeedMember(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isGroupFeedMember(undefined)).toBe(false);
  });

  it('should return false for non-object values', () => {
    expect(isGroupFeedMember('string')).toBe(false);
    expect(isGroupFeedMember(123)).toBe(false);
    expect(isGroupFeedMember([])).toBe(false);
  });

  it('should return false for wrong field types', () => {
    expect(isGroupFeedMember({ ...validMember, publicAddress: 123 })).toBe(false);
    expect(isGroupFeedMember({ ...validMember, displayName: null })).toBe(false);
  });
});

describe('isPublicGroupInfo', () => {
  const validGroup: PublicGroupInfo = {
    feedId: 'feed123',
    name: 'Test Group',
    memberCount: 5,
    isPublic: true,
  };

  it('should return true for valid PublicGroupInfo', () => {
    expect(isPublicGroupInfo(validGroup)).toBe(true);
  });

  it('should return true with optional description', () => {
    const withDesc = { ...validGroup, description: 'A test group' };
    expect(isPublicGroupInfo(withDesc)).toBe(true);
  });

  it('should return true with empty description', () => {
    const withEmptyDesc = { ...validGroup, description: '' };
    expect(isPublicGroupInfo(withEmptyDesc)).toBe(true);
  });

  it('should return false for missing feedId', () => {
    const { feedId: _, ...withoutId } = validGroup;
    expect(isPublicGroupInfo(withoutId)).toBe(false);
  });

  it('should return false for missing name', () => {
    const { name: _, ...withoutName } = validGroup;
    expect(isPublicGroupInfo(withoutName)).toBe(false);
  });

  it('should return false for missing memberCount', () => {
    const { memberCount: _, ...withoutCount } = validGroup;
    expect(isPublicGroupInfo(withoutCount)).toBe(false);
  });

  it('should return false for missing isPublic', () => {
    const { isPublic: _, ...withoutPublic } = validGroup;
    expect(isPublicGroupInfo(withoutPublic)).toBe(false);
  });

  it('should return false for wrong memberCount type', () => {
    expect(isPublicGroupInfo({ ...validGroup, memberCount: '5' })).toBe(false);
  });

  it('should return false for wrong description type', () => {
    expect(isPublicGroupInfo({ ...validGroup, description: 123 })).toBe(false);
  });

  it('should return false for null', () => {
    expect(isPublicGroupInfo(null)).toBe(false);
  });
});

describe('isGroupCreationData', () => {
  const validData: GroupCreationData = {
    name: 'New Group',
    isPublic: false,
    memberAddresses: ['addr1', 'addr2'],
  };

  it('should return true for valid GroupCreationData', () => {
    expect(isGroupCreationData(validData)).toBe(true);
  });

  it('should return true with optional description', () => {
    const withDesc = { ...validData, description: 'Group description' };
    expect(isGroupCreationData(withDesc)).toBe(true);
  });

  it('should return true for single member', () => {
    const singleMember = { ...validData, memberAddresses: ['addr1'] };
    expect(isGroupCreationData(singleMember)).toBe(true);
  });

  it('should return true for 100 character name', () => {
    const longName = { ...validData, name: 'a'.repeat(100) };
    expect(isGroupCreationData(longName)).toBe(true);
  });

  it('should return false for empty name', () => {
    const emptyName = { ...validData, name: '' };
    expect(isGroupCreationData(emptyName)).toBe(false);
  });

  it('should return false for name over 100 characters', () => {
    const tooLong = { ...validData, name: 'a'.repeat(101) };
    expect(isGroupCreationData(tooLong)).toBe(false);
  });

  it('should return false for empty memberAddresses', () => {
    const noMembers = { ...validData, memberAddresses: [] };
    expect(isGroupCreationData(noMembers)).toBe(false);
  });

  it('should return false for description over 500 characters', () => {
    const longDesc = { ...validData, description: 'a'.repeat(501) };
    expect(isGroupCreationData(longDesc)).toBe(false);
  });

  it('should return true for 500 character description', () => {
    const maxDesc = { ...validData, description: 'a'.repeat(500) };
    expect(isGroupCreationData(maxDesc)).toBe(true);
  });

  it('should return false for non-string in memberAddresses', () => {
    const invalidMember = { ...validData, memberAddresses: ['addr1', 123] };
    expect(isGroupCreationData(invalidMember)).toBe(false);
  });

  it('should return false for null', () => {
    expect(isGroupCreationData(null)).toBe(false);
  });

  it('should return false for missing isPublic', () => {
    const { isPublic: _, ...withoutPublic } = validData;
    expect(isGroupCreationData(withoutPublic)).toBe(false);
  });
});
