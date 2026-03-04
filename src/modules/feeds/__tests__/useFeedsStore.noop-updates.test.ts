import { beforeEach, describe, expect, it } from 'vitest';
import { useFeedsStore } from '../useFeedsStore';
import type { Feed, GroupFeedMember } from '@/types';

function createFeed(overrides: Partial<Feed> = {}): Feed {
  return {
    id: 'feed-1',
    type: 'group',
    name: 'Inner Circle',
    participants: ['owner', 'member-a'],
    unreadCount: 0,
    createdAt: 1,
    updatedAt: 1,
    blockIndex: 10,
    ...overrides,
  };
}

describe('FEAT-092: no-change store updates', () => {
  beforeEach(() => {
    useFeedsStore.getState().reset();
  });

  it('addFeeds does not replace feeds array when projection did not change', () => {
    const baseFeed = createFeed();
    useFeedsStore.getState().setFeeds([baseFeed]);
    const beforeRef = useFeedsStore.getState().feeds;

    useFeedsStore.getState().addFeeds([createFeed()]);

    const afterRef = useFeedsStore.getState().feeds;
    expect(afterRef).toBe(beforeRef);
  });

  it('setGroupMembers does not replace groupMembers map for identical members', () => {
    const members: GroupFeedMember[] = [
      {
        publicAddress: 'member-a',
        displayName: 'Member A',
        role: 'Member',
        joinedAtBlock: 5,
      },
    ];

    useFeedsStore.getState().setGroupMembers('feed-1', members);
    const beforeRef = useFeedsStore.getState().groupMembers;

    useFeedsStore.getState().setGroupMembers('feed-1', [
      {
        publicAddress: 'member-a',
        displayName: 'Member A',
        role: 'Member',
        joinedAtBlock: 5,
      },
    ]);

    const afterRef = useFeedsStore.getState().groupMembers;
    expect(afterRef).toBe(beforeRef);
  });
});
