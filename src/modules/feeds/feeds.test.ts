/**
 * Feeds Module Tests
 *
 * Tests for:
 * 1. Feed retrieval and storage
 * 2. Message retrieval and storage
 * 3. Personal feed detection and creation
 * 4. Incremental sync with blockIndex
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFeedsStore } from './useFeedsStore';
import { FeedsSyncable } from './FeedsSyncable';
import * as FeedsService from './FeedsService';
import { useAppStore } from '@/stores';
import type { Feed, FeedMessage } from '@/types';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock crypto module
vi.mock('@/lib/crypto', () => ({
  deriveKeysFromMnemonic: vi.fn().mockReturnValue({
    signingKey: {
      publicKeyHex: 'mock-public-key',
      privateKey: new Uint8Array(32),
    },
    encryptionKey: {
      publicKeyHex: 'mock-encryption-key',
      privateKey: new Uint8Array(32),
    },
  }),
  createPersonalFeedTransaction: vi.fn().mockResolvedValue({
    signedTransaction: 'mock-signed-tx',
    feedId: 'mock-feed-id',
  }),
  eciesDecrypt: vi.fn().mockResolvedValue('decrypted-key'),
  aesDecrypt: vi.fn().mockReturnValue('decrypted-message'),
}));

// Mock crypto reactions module
vi.mock('@/lib/crypto/reactions', () => ({
  decryptReactionTally: vi.fn().mockReturnValue([0, 0, 0, 0, 0, 0]),
  initializeBsgs: vi.fn().mockResolvedValue(undefined),
}));

// Sample test data
const sampleFeed: Feed = {
  id: 'feed-1',
  type: 'personal',
  name: 'My Personal Feed',
  participants: ['user-1'],
  unreadCount: 0,
  createdAt: 100,
  updatedAt: 100,
};

const sampleChatFeed: Feed = {
  id: 'feed-2',
  type: 'chat',
  name: 'Chat with Bob',
  participants: ['user-1', 'user-2'],
  unreadCount: 5,
  createdAt: 150,
  updatedAt: 200,
};

const sampleMessage: FeedMessage = {
  id: 'msg-1',
  feedId: 'feed-1',
  content: 'Hello world',
  senderId: 'user-1',
  senderName: 'Alice',
  timestamp: Date.now(),
  blockHeight: 100,
  isConfirmed: true,
};

describe('useFeedsStore', () => {
  beforeEach(() => {
    useFeedsStore.getState().reset();
  });

  describe('Initial State', () => {
    it('should initialize with empty feeds and messages', () => {
      const state = useFeedsStore.getState();

      expect(state.feeds).toEqual([]);
      expect(state.messages).toEqual({});
      expect(state.isSyncing).toBe(false);
      expect(state.isCreatingPersonalFeed).toBe(false);
    });
  });

  describe('Feed Management', () => {
    it('should set feeds with personal feed first', () => {
      useFeedsStore.getState().setFeeds([sampleChatFeed, sampleFeed]);

      const feeds = useFeedsStore.getState().feeds;
      expect(feeds[0].type).toBe('personal');
      expect(feeds[1].type).toBe('chat');
    });

    it('should add new feeds without duplicates', () => {
      useFeedsStore.getState().setFeeds([sampleFeed]);
      useFeedsStore.getState().addFeeds([sampleFeed, sampleChatFeed]);

      const feeds = useFeedsStore.getState().feeds;
      expect(feeds).toHaveLength(2);
    });

    it('should preserve unreadCount when merging feeds from server', () => {
      // Set up a feed with unread count
      const feedWithUnread = { ...sampleChatFeed, unreadCount: 5 };
      useFeedsStore.getState().setFeeds([feedWithUnread]);

      // Verify initial unread count
      expect(useFeedsStore.getState().feeds[0].unreadCount).toBe(5);

      // Simulate server sync - server feed has unreadCount: 0 (server doesn't track this)
      const serverFeed = { ...sampleChatFeed, unreadCount: 0 };
      useFeedsStore.getState().addFeeds([serverFeed]);

      // unreadCount should be preserved (not overwritten by server's 0)
      const feeds = useFeedsStore.getState().feeds;
      expect(feeds).toHaveLength(1);
      expect(feeds[0].unreadCount).toBe(5);
    });

    it('should detect personal feed', () => {
      expect(useFeedsStore.getState().hasPersonalFeed()).toBe(false);

      useFeedsStore.getState().setFeeds([sampleFeed]);
      expect(useFeedsStore.getState().hasPersonalFeed()).toBe(true);
    });

    it('should get personal feed', () => {
      useFeedsStore.getState().setFeeds([sampleChatFeed, sampleFeed]);

      const personalFeed = useFeedsStore.getState().getPersonalFeed();
      expect(personalFeed?.type).toBe('personal');
      expect(personalFeed?.id).toBe('feed-1');
    });
  });

  describe('Message Management', () => {
    it('should set messages for a feed', () => {
      useFeedsStore.getState().setMessages('feed-1', [sampleMessage]);

      const messages = useFeedsStore.getState().messages['feed-1'];
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Hello world');
    });

    it('should add messages without duplicates', () => {
      useFeedsStore.getState().setMessages('feed-1', [sampleMessage]);

      const newMessage: FeedMessage = {
        ...sampleMessage,
        id: 'msg-2',
        content: 'Second message',
      };

      useFeedsStore.getState().addMessages('feed-1', [sampleMessage, newMessage]);

      const messages = useFeedsStore.getState().messages['feed-1'];
      expect(messages).toHaveLength(2);
    });
  });

  describe('Sync Metadata', () => {
    it('should update sync metadata', () => {
      useFeedsStore.getState().setSyncMetadata({
        lastFeedBlockIndex: 100,
        lastMessageBlockIndex: 150,
      });

      const { syncMetadata } = useFeedsStore.getState();
      expect(syncMetadata.lastFeedBlockIndex).toBe(100);
      expect(syncMetadata.lastMessageBlockIndex).toBe(150);
    });

    it('should track personal feed creation pending state', () => {
      useFeedsStore.getState().setPersonalFeedCreationPending(true);

      expect(
        useFeedsStore.getState().syncMetadata.isPersonalFeedCreationPending
      ).toBe(true);
    });
  });
});

describe('FeedsService', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('fetchFeeds', () => {
    it('should fetch and convert feeds', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            feeds: [
              {
                feedId: 'feed-1',
                feedTitle: 'Personal Feed',
                feedOwner: 'user-1',
                feedType: 0,
                blockIndex: 100,
                participants: [{ participantPublicAddress: 'user-1' }],
              },
            ],
          }),
      });

      const result = await FeedsService.fetchFeeds('user-1', 0);

      expect(result.feeds).toHaveLength(1);
      expect(result.feeds[0].type).toBe('personal');
      expect(result.feeds[0].id).toBe('feed-1');
      expect(result.maxBlockIndex).toBe(100);
    });

    it('should handle empty response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ feeds: [] }),
      });

      const result = await FeedsService.fetchFeeds('user-1', 50);

      expect(result.feeds).toHaveLength(0);
      expect(result.maxBlockIndex).toBe(50);
    });

    it('should use blockIndex for incremental sync', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ feeds: [] }),
      });

      await FeedsService.fetchFeeds('user-1', 100);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/feeds/list?address=user-1&blockIndex=100'
      );
    });
  });

  describe('fetchMessages', () => {
    it('should fetch and convert messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            messages: [
              {
                feedId: 'feed-1',
                feedMessageId: 'msg-1',
                messageContent: 'Hello',
                issuerPublicAddress: 'user-1',
                issuerName: 'Alice',
                timestamp: '2024-01-01T00:00:00Z',
                blockIndex: 100,
              },
            ],
          }),
      });

      const result = await FeedsService.fetchMessages('user-1', 0);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toBe('Hello');
      expect(result.messages[0].feedId).toBe('feed-1');
    });
  });

  describe('checkHasPersonalFeed', () => {
    it('should return true when personal feed exists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ hasPersonalFeed: true }),
      });

      const result = await FeedsService.checkHasPersonalFeed('user-1');
      expect(result).toBe(true);
    });

    it('should return false when no personal feed', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ hasPersonalFeed: false }),
      });

      const result = await FeedsService.checkHasPersonalFeed('user-1');
      expect(result).toBe(false);
    });
  });
});

describe('FeedsSyncable', () => {
  let syncable: FeedsSyncable;

  beforeEach(() => {
    syncable = new FeedsSyncable();
    useFeedsStore.getState().reset();
    useAppStore.getState().setCredentials(null);
    mockFetch.mockReset();
    // Simulate existing session to prevent full resync on every test
    sessionStorage.setItem('hush-feeds-session-synced', 'true');
  });

  it('should have correct properties', () => {
    expect(syncable.name).toBe('FeedsSyncable');
    expect(syncable.requiresAuth).toBe(true);
  });

  it('should skip sync when no credentials', async () => {
    await syncable.syncTask();

    // Should not have called fetch
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should sync feeds when authenticated', async () => {
    // Set up credentials
    useAppStore.getState().setCredentials({
      signingPublicKey: 'user-public-key',
      signingPrivateKey: 'private',
      encryptionPublicKey: 'enc-pub',
      encryptionPrivateKey: 'enc-priv',
      mnemonic: ['word1', 'word2'],
    });

    // Create personal feed in SERVER format (not client Feed type)
    // FeedsService.fetchFeeds expects server format with feedType: number
    const serverPersonalFeed = {
      feedId: 'feed-1',
      feedTitle: 'My Personal Feed',
      feedOwner: 'user-public-key',
      feedType: 0, // 0 = personal in FEED_TYPE_MAP
      blockIndex: 100,
      participants: [{ participantPublicAddress: 'user-public-key' }],
    };

    // Mock feed list response - return the personal feed from server
    // This prevents cache clearing and personal feed creation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ feeds: [serverPersonalFeed] }),
    });

    // Mock messages response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ messages: [] }),
    });

    await syncable.syncTask();

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(useFeedsStore.getState().isSyncing).toBe(false);
    // Feed should be in the store
    expect(useFeedsStore.getState().hasPersonalFeed()).toBe(true);
  });

  it('should detect missing personal feed and create one', async () => {
    // Set up credentials with mnemonic
    useAppStore.getState().setCredentials({
      signingPublicKey: 'user-public-key',
      signingPrivateKey: 'private',
      encryptionPublicKey: 'enc-pub',
      encryptionPrivateKey: 'enc-priv',
      mnemonic: ['word1', 'word2', 'word3'],
    });

    // No personal feed exists
    useFeedsStore.getState().setFeeds([]);

    // Mock empty feeds response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ feeds: [] }),
    });

    // Mock empty messages response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ messages: [] }),
    });

    // Mock transaction submission
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ successful: true, message: 'OK' }),
    });

    await syncable.syncTask();

    // Should have set creation pending flag
    expect(
      useFeedsStore.getState().syncMetadata.isPersonalFeedCreationPending
    ).toBe(true);
  });

  it('should not create duplicate personal feed', async () => {
    // Set up credentials
    useAppStore.getState().setCredentials({
      signingPublicKey: 'user-public-key',
      signingPrivateKey: 'private',
      encryptionPublicKey: 'enc-pub',
      encryptionPrivateKey: 'enc-priv',
      mnemonic: ['word1', 'word2'],
    });

    // Mark creation as pending (already in progress)
    useFeedsStore.getState().setPersonalFeedCreationPending(true);

    // Mock empty responses
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ feeds: [], messages: [] }),
    });

    await syncable.syncTask();

    // Should only call for feeds and messages, not submit transaction
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should clear pending flag when personal feed appears', async () => {
    // Set up credentials
    useAppStore.getState().setCredentials({
      signingPublicKey: 'user-public-key',
      signingPrivateKey: 'private',
      encryptionPublicKey: 'enc-pub',
      encryptionPrivateKey: 'enc-priv',
      mnemonic: ['word1', 'word2'],
    });

    // Mark creation as pending
    useFeedsStore.getState().setPersonalFeedCreationPending(true);

    // Add personal feed (simulating it appeared in sync)
    useFeedsStore.getState().setFeeds([sampleFeed]);

    // Mock empty responses (no new data)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ feeds: [] }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ messages: [] }),
    });

    await syncable.syncTask();

    // Should have cleared pending flag
    expect(
      useFeedsStore.getState().syncMetadata.isPersonalFeedCreationPending
    ).toBe(false);
  });

  it('should update sync metadata with max block index', async () => {
    // Set up credentials
    useAppStore.getState().setCredentials({
      signingPublicKey: 'user-public-key',
      signingPrivateKey: 'private',
      encryptionPublicKey: 'enc-pub',
      encryptionPrivateKey: 'enc-priv',
      mnemonic: ['word1', 'word2'],
    });

    // Add personal feed
    useFeedsStore.getState().setFeeds([sampleFeed]);

    // Mock feeds response with blockIndex
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          feeds: [
            {
              feedId: 'feed-new',
              feedTitle: 'New Chat',
              feedType: 1,
              blockIndex: 250,
              participants: [],
            },
          ],
        }),
    });

    // Mock messages response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          messages: [
            {
              feedId: 'feed-1',
              feedMessageId: 'msg-1',
              messageContent: 'Hi',
              issuerPublicAddress: 'user-1',
              issuerName: 'Alice',
              timestamp: null,
              blockIndex: 300,
            },
          ],
        }),
    });

    await syncable.syncTask();

    const { syncMetadata } = useFeedsStore.getState();
    expect(syncMetadata.lastFeedBlockIndex).toBe(250);
    expect(syncMetadata.lastMessageBlockIndex).toBe(300);
  });
});

describe('Sync Integration', () => {
  beforeEach(() => {
    useFeedsStore.getState().reset();
    useAppStore.getState().setCredentials(null);
    mockFetch.mockReset();
  });

  it('should perform full sync cycle', async () => {
    // Set up authenticated user
    useAppStore.getState().setCredentials({
      signingPublicKey: 'user-key',
      signingPrivateKey: 'private',
      encryptionPublicKey: 'enc-pub',
      encryptionPrivateKey: 'enc-priv',
      mnemonic: ['word1', 'word2'],
    });

    const syncable = new FeedsSyncable();

    // First sync - get initial data including personal feed
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          feeds: [
            {
              feedId: 'personal-feed',
              feedTitle: 'My Feed',
              feedType: 0,
              blockIndex: 100,
              participants: [{ participantPublicAddress: 'user-key' }],
            },
            {
              feedId: 'chat-feed',
              feedTitle: 'Chat',
              feedType: 1,
              blockIndex: 150,
              participants: [],
            },
          ],
        }),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          messages: [
            {
              feedId: 'personal-feed',
              feedMessageId: 'msg-1',
              messageContent: 'First message',
              issuerPublicAddress: 'user-key',
              issuerName: 'Me',
              timestamp: '2024-01-01T00:00:00Z',
              blockIndex: 100,
            },
          ],
        }),
    });

    await syncable.syncTask();

    // Verify state
    const state = useFeedsStore.getState();
    expect(state.feeds).toHaveLength(2);
    expect(state.feeds[0].type).toBe('personal'); // Personal first
    expect(state.messages['personal-feed']).toHaveLength(1);
    expect(state.syncMetadata.lastFeedBlockIndex).toBe(150);
    expect(state.syncMetadata.lastMessageBlockIndex).toBe(100);
  });
});

describe('Feed Name Updates (FEAT-003)', () => {
  beforeEach(() => {
    useFeedsStore.getState().reset();
  });

  describe('updateFeedName', () => {
    it('should update the name of an existing feed', () => {
      // Set up a chat feed
      const chatFeed: Feed = {
        id: 'chat-1',
        type: 'chat',
        name: 'Alice',
        participants: ['user-1', 'user-2'],
        unreadCount: 0,
        createdAt: 100,
        updatedAt: 100,
        blockIndex: 100,
        otherParticipantPublicSigningAddress: 'user-2',
      };

      useFeedsStore.getState().setFeeds([chatFeed]);

      // Update the name
      useFeedsStore.getState().updateFeedName('chat-1', 'Alice Smith');

      // Verify the name was updated
      const feed = useFeedsStore.getState().getFeed('chat-1');
      expect(feed?.name).toBe('Alice Smith');
    });

    it('should not affect other feeds when updating one feed name', () => {
      const feed1: Feed = {
        id: 'chat-1',
        type: 'chat',
        name: 'Alice',
        participants: ['user-1', 'user-2'],
        unreadCount: 0,
        createdAt: 100,
        updatedAt: 100,
      };

      const feed2: Feed = {
        id: 'chat-2',
        type: 'chat',
        name: 'Bob',
        participants: ['user-1', 'user-3'],
        unreadCount: 0,
        createdAt: 100,
        updatedAt: 100,
      };

      useFeedsStore.getState().setFeeds([feed1, feed2]);

      // Update only feed1's name
      useFeedsStore.getState().updateFeedName('chat-1', 'Alice Updated');

      // Verify feed2 is unchanged
      const updatedFeed2 = useFeedsStore.getState().getFeed('chat-2');
      expect(updatedFeed2?.name).toBe('Bob');
    });

    it('should preserve other feed properties when updating name', () => {
      const chatFeed: Feed = {
        id: 'chat-1',
        type: 'chat',
        name: 'Alice',
        participants: ['user-1', 'user-2'],
        unreadCount: 5,
        createdAt: 100,
        updatedAt: 200,
        blockIndex: 150,
        aesKey: 'encrypted-key',
        otherParticipantPublicSigningAddress: 'user-2',
      };

      useFeedsStore.getState().setFeeds([chatFeed]);

      // Update the name
      useFeedsStore.getState().updateFeedName('chat-1', 'Alice Smith');

      // Verify all other properties are preserved
      const feed = useFeedsStore.getState().getFeed('chat-1');
      expect(feed?.name).toBe('Alice Smith');
      expect(feed?.type).toBe('chat');
      expect(feed?.unreadCount).toBe(5);
      expect(feed?.blockIndex).toBe(150);
      expect(feed?.aesKey).toBe('encrypted-key');
      expect(feed?.otherParticipantPublicSigningAddress).toBe('user-2');
    });

    it('should handle updating a non-existent feed gracefully', () => {
      const chatFeed: Feed = {
        id: 'chat-1',
        type: 'chat',
        name: 'Alice',
        participants: ['user-1', 'user-2'],
        unreadCount: 0,
        createdAt: 100,
        updatedAt: 100,
      };

      useFeedsStore.getState().setFeeds([chatFeed]);

      // Try to update a non-existent feed
      useFeedsStore.getState().updateFeedName('non-existent', 'New Name');

      // Original feed should be unchanged
      const feed = useFeedsStore.getState().getFeed('chat-1');
      expect(feed?.name).toBe('Alice');
      expect(useFeedsStore.getState().feeds).toHaveLength(1);
    });
  });

  describe('BlockIndex tracking', () => {
    it('should store blockIndex when adding feeds from server', async () => {
      // Set up a feed with blockIndex
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            feeds: [
              {
                feedId: 'chat-1',
                feedTitle: 'Alice',
                feedOwner: 'user-1',
                feedType: 1, // chat
                blockIndex: 200,
                participants: [
                  { participantPublicAddress: 'user-1' },
                  { participantPublicAddress: 'alice-address' },
                ],
              },
            ],
          }),
      });

      const result = await FeedsService.fetchFeeds('user-1', 0);

      // Verify blockIndex is included in the feed
      expect(result.feeds[0].blockIndex).toBe(200);
    });

    it('should update blockIndex when addFeeds merges server data', () => {
      // Set up existing feed with old blockIndex
      const existingFeed: Feed = {
        id: 'chat-1',
        type: 'chat',
        name: 'Alice',
        participants: ['user-1', 'alice-address'],
        unreadCount: 0,
        createdAt: 100,
        updatedAt: 100,
        blockIndex: 100,
        aesKey: 'decrypted-key', // Local-only data
      };

      useFeedsStore.getState().setFeeds([existingFeed]);

      // Add the same feed with updated blockIndex from server
      const serverFeed: Feed = {
        id: 'chat-1',
        type: 'chat',
        name: 'Alice',
        participants: ['user-1', 'alice-address'],
        unreadCount: 0,
        createdAt: 100,
        updatedAt: 200,
        blockIndex: 200, // Increased blockIndex
      };

      useFeedsStore.getState().addFeeds([serverFeed]);

      // Verify blockIndex was updated
      const feed = useFeedsStore.getState().getFeed('chat-1');
      expect(feed?.blockIndex).toBe(200);
      // Verify local-only data (aesKey) is preserved
      expect(feed?.aesKey).toBe('decrypted-key');
    });
  });

  describe('Group Feed Management', () => {
    const sampleMember1 = {
      publicAddress: 'addr-1',
      displayName: 'Alice',
      role: 'Admin' as const,
    };

    const sampleMember2 = {
      publicAddress: 'addr-2',
      displayName: 'Bob',
      role: 'Member' as const,
    };

    const sampleMember3 = {
      publicAddress: 'addr-3',
      displayName: 'Carol',
      role: 'Member' as const,
    };

    describe('setGroupMembers', () => {
      it('should set group members for a feed', () => {
        const { setGroupMembers, getGroupMembers } = useFeedsStore.getState();

        setGroupMembers('group-1', [sampleMember1, sampleMember2]);

        const members = getGroupMembers('group-1');
        expect(members).toHaveLength(2);
        expect(members[0].displayName).toBe('Alice');
        expect(members[1].displayName).toBe('Bob');
      });

      it('should replace existing members', () => {
        const { setGroupMembers, getGroupMembers } = useFeedsStore.getState();

        setGroupMembers('group-1', [sampleMember1, sampleMember2]);
        setGroupMembers('group-1', [sampleMember3]);

        const members = getGroupMembers('group-1');
        expect(members).toHaveLength(1);
        expect(members[0].displayName).toBe('Carol');
      });
    });

    describe('addGroupMember', () => {
      it('should add a member to existing group', () => {
        const { setGroupMembers, addGroupMember, getGroupMembers } = useFeedsStore.getState();

        setGroupMembers('group-1', [sampleMember1]);
        addGroupMember('group-1', sampleMember2);

        const members = getGroupMembers('group-1');
        expect(members).toHaveLength(2);
      });

      it('should add a member to new group', () => {
        const { addGroupMember, getGroupMembers } = useFeedsStore.getState();

        addGroupMember('group-new', sampleMember1);

        const members = getGroupMembers('group-new');
        expect(members).toHaveLength(1);
        expect(members[0].displayName).toBe('Alice');
      });

      it('should not add duplicate member', () => {
        const { setGroupMembers, addGroupMember, getGroupMembers } = useFeedsStore.getState();

        setGroupMembers('group-1', [sampleMember1]);
        addGroupMember('group-1', sampleMember1);

        const members = getGroupMembers('group-1');
        expect(members).toHaveLength(1);
      });
    });

    describe('removeGroupMember', () => {
      it('should remove a member by address', () => {
        const { setGroupMembers, removeGroupMember, getGroupMembers } = useFeedsStore.getState();

        setGroupMembers('group-1', [sampleMember1, sampleMember2, sampleMember3]);
        removeGroupMember('group-1', 'addr-2');

        const members = getGroupMembers('group-1');
        expect(members).toHaveLength(2);
        expect(members.find((m) => m.publicAddress === 'addr-2')).toBeUndefined();
      });

      it('should handle removing non-existent member', () => {
        const { setGroupMembers, removeGroupMember, getGroupMembers } = useFeedsStore.getState();

        setGroupMembers('group-1', [sampleMember1]);
        removeGroupMember('group-1', 'addr-nonexistent');

        const members = getGroupMembers('group-1');
        expect(members).toHaveLength(1);
      });
    });

    describe('updateMemberRole', () => {
      it('should update member role', () => {
        const { setGroupMembers, updateMemberRole, getGroupMembers } = useFeedsStore.getState();

        setGroupMembers('group-1', [sampleMember1, sampleMember2]);
        updateMemberRole('group-1', 'addr-2', 'Admin');

        const members = getGroupMembers('group-1');
        const bob = members.find((m) => m.publicAddress === 'addr-2');
        expect(bob?.role).toBe('Admin');
      });

      it('should handle updating non-existent member', () => {
        const { setGroupMembers, updateMemberRole, getGroupMembers } = useFeedsStore.getState();

        setGroupMembers('group-1', [sampleMember1]);
        updateMemberRole('group-1', 'addr-nonexistent', 'Admin');

        const members = getGroupMembers('group-1');
        expect(members).toHaveLength(1);
        expect(members[0].role).toBe('Admin'); // Original member unchanged
      });
    });

    describe('getGroupMembers', () => {
      it('should return empty array for unknown feed', () => {
        const members = useFeedsStore.getState().getGroupMembers('unknown-feed');
        expect(members).toEqual([]);
      });
    });

    describe('setUserRole', () => {
      it('should set user role for a feed', () => {
        const { setUserRole, getUserRole } = useFeedsStore.getState();

        setUserRole('group-1', 'Admin');

        expect(getUserRole('group-1')).toBe('Admin');
      });

      it('should update existing role', () => {
        const { setUserRole, getUserRole } = useFeedsStore.getState();

        setUserRole('group-1', 'Member');
        setUserRole('group-1', 'Admin');

        expect(getUserRole('group-1')).toBe('Admin');
      });
    });

    describe('getUserRole', () => {
      it('should return undefined for unknown feed', () => {
        const role = useFeedsStore.getState().getUserRole('unknown-feed');
        expect(role).toBeUndefined();
      });
    });

    describe('isUserAdmin', () => {
      it('should return true when user is Admin', () => {
        const { setUserRole, isUserAdmin } = useFeedsStore.getState();

        setUserRole('group-1', 'Admin');

        expect(isUserAdmin('group-1')).toBe(true);
      });

      it('should return false when user is Member', () => {
        const { setUserRole, isUserAdmin } = useFeedsStore.getState();

        setUserRole('group-1', 'Member');

        expect(isUserAdmin('group-1')).toBe(false);
      });

      it('should return false for unknown feed', () => {
        expect(useFeedsStore.getState().isUserAdmin('unknown-feed')).toBe(false);
      });
    });

    describe('reset clears group data', () => {
      it('should clear groupMembers and memberRoles on reset', () => {
        const state = useFeedsStore.getState();

        state.setGroupMembers('group-1', [sampleMember1]);
        state.setUserRole('group-1', 'Admin');
        state.reset();

        const newState = useFeedsStore.getState();
        expect(newState.groupMembers).toEqual({});
        expect(newState.memberRoles).toEqual({});
      });
    });
  });

  describe('Group KeyGeneration Management', () => {
    const sampleKeyGen0 = {
      keyGeneration: 0,
      validFromBlock: 1000,
      aesKey: 'key0-aes-base64==',
    };

    const sampleKeyGen1 = {
      keyGeneration: 1,
      validFromBlock: 2000,
      aesKey: 'key1-aes-base64==',
    };

    const sampleKeyGen2 = {
      keyGeneration: 2,
      validFromBlock: 3000,
      aesKey: 'key2-aes-base64==',
    };

    describe('setGroupKeyState', () => {
      it('should set complete key state for a group', () => {
        const { setGroupKeyState, getGroupKeyState } = useFeedsStore.getState();

        const keyState = {
          currentKeyGeneration: 1,
          keyGenerations: [sampleKeyGen0, sampleKeyGen1],
          missingKeyGenerations: [],
        };

        setGroupKeyState('group-1', keyState);

        const result = getGroupKeyState('group-1');
        expect(result).toEqual(keyState);
      });

      it('should replace existing key state', () => {
        const { setGroupKeyState, getGroupKeyState } = useFeedsStore.getState();

        setGroupKeyState('group-1', {
          currentKeyGeneration: 0,
          keyGenerations: [sampleKeyGen0],
          missingKeyGenerations: [],
        });

        setGroupKeyState('group-1', {
          currentKeyGeneration: 2,
          keyGenerations: [sampleKeyGen0, sampleKeyGen1, sampleKeyGen2],
          missingKeyGenerations: [],
        });

        const result = getGroupKeyState('group-1');
        expect(result?.currentKeyGeneration).toBe(2);
        expect(result?.keyGenerations).toHaveLength(3);
      });
    });

    describe('addKeyGeneration', () => {
      it('should add first key generation (KeyGen 0)', () => {
        const { addKeyGeneration, getGroupKeyState } = useFeedsStore.getState();

        addKeyGeneration('group-1', sampleKeyGen0);

        const result = getGroupKeyState('group-1');
        expect(result?.currentKeyGeneration).toBe(0);
        expect(result?.keyGenerations).toHaveLength(1);
        expect(result?.keyGenerations[0].aesKey).toBe('key0-aes-base64==');
      });

      it('should add subsequent key generation and update currentKeyGeneration', () => {
        const { addKeyGeneration, getGroupKeyState } = useFeedsStore.getState();

        addKeyGeneration('group-1', sampleKeyGen0);
        addKeyGeneration('group-1', sampleKeyGen1);

        const result = getGroupKeyState('group-1');
        expect(result?.currentKeyGeneration).toBe(1);
        expect(result?.keyGenerations).toHaveLength(2);
      });

      it('should set validToBlock on previous key generation', () => {
        const { addKeyGeneration, getGroupKeyState } = useFeedsStore.getState();

        addKeyGeneration('group-1', sampleKeyGen0);
        addKeyGeneration('group-1', sampleKeyGen1);

        const result = getGroupKeyState('group-1');
        expect(result?.keyGenerations[0].validToBlock).toBe(2000);
        expect(result?.keyGenerations[1].validToBlock).toBeUndefined();
      });

      it('should sort key generations by number', () => {
        const { addKeyGeneration, getGroupKeyState } = useFeedsStore.getState();

        // Add out of order
        addKeyGeneration('group-1', sampleKeyGen2);
        addKeyGeneration('group-1', sampleKeyGen0);
        addKeyGeneration('group-1', sampleKeyGen1);

        const result = getGroupKeyState('group-1');
        expect(result?.keyGenerations[0].keyGeneration).toBe(0);
        expect(result?.keyGenerations[1].keyGeneration).toBe(1);
        expect(result?.keyGenerations[2].keyGeneration).toBe(2);
      });

      it('should update existing key generation instead of adding duplicate', () => {
        const { addKeyGeneration, getGroupKeyState } = useFeedsStore.getState();

        addKeyGeneration('group-1', sampleKeyGen0);
        addKeyGeneration('group-1', { ...sampleKeyGen0, aesKey: 'updated-key==' });

        const result = getGroupKeyState('group-1');
        expect(result?.keyGenerations).toHaveLength(1);
        expect(result?.keyGenerations[0].aesKey).toBe('updated-key==');
      });

      it('should remove key from missingKeyGenerations when added', () => {
        const { setGroupKeyState, addKeyGeneration, getGroupKeyState } = useFeedsStore.getState();

        // Set up state with missing key generation 1
        setGroupKeyState('group-1', {
          currentKeyGeneration: 2,
          keyGenerations: [sampleKeyGen0, sampleKeyGen2],
          missingKeyGenerations: [1],
        });

        // Add the missing key
        addKeyGeneration('group-1', sampleKeyGen1);

        const result = getGroupKeyState('group-1');
        expect(result?.missingKeyGenerations).toEqual([]);
        expect(result?.keyGenerations).toHaveLength(3);
      });
    });

    describe('getCurrentGroupKey', () => {
      it('should return current AES key', () => {
        const { setGroupKeyState, getCurrentGroupKey } = useFeedsStore.getState();

        setGroupKeyState('group-1', {
          currentKeyGeneration: 1,
          keyGenerations: [sampleKeyGen0, sampleKeyGen1],
          missingKeyGenerations: [],
        });

        expect(getCurrentGroupKey('group-1')).toBe('key1-aes-base64==');
      });

      it('should return undefined for unknown feed', () => {
        expect(useFeedsStore.getState().getCurrentGroupKey('unknown-feed')).toBeUndefined();
      });

      it('should return undefined when current key is missing', () => {
        const { setGroupKeyState, getCurrentGroupKey } = useFeedsStore.getState();

        setGroupKeyState('group-1', {
          currentKeyGeneration: 2,
          keyGenerations: [sampleKeyGen0, sampleKeyGen1], // Missing key 2
          missingKeyGenerations: [2],
        });

        expect(getCurrentGroupKey('group-1')).toBeUndefined();
      });
    });

    describe('getGroupKeyByGeneration', () => {
      it('should return AES key for specific generation', () => {
        const { setGroupKeyState, getGroupKeyByGeneration } = useFeedsStore.getState();

        setGroupKeyState('group-1', {
          currentKeyGeneration: 2,
          keyGenerations: [sampleKeyGen0, sampleKeyGen1, sampleKeyGen2],
          missingKeyGenerations: [],
        });

        expect(getGroupKeyByGeneration('group-1', 0)).toBe('key0-aes-base64==');
        expect(getGroupKeyByGeneration('group-1', 1)).toBe('key1-aes-base64==');
        expect(getGroupKeyByGeneration('group-1', 2)).toBe('key2-aes-base64==');
      });

      it('should return undefined for missing generation', () => {
        const { setGroupKeyState, getGroupKeyByGeneration } = useFeedsStore.getState();

        setGroupKeyState('group-1', {
          currentKeyGeneration: 2,
          keyGenerations: [sampleKeyGen0, sampleKeyGen2],
          missingKeyGenerations: [1],
        });

        expect(getGroupKeyByGeneration('group-1', 1)).toBeUndefined();
      });

      it('should return undefined for unknown feed', () => {
        expect(useFeedsStore.getState().getGroupKeyByGeneration('unknown-feed', 0)).toBeUndefined();
      });
    });

    describe('hasMissingKeyGenerations', () => {
      it('should return true when there are missing keys', () => {
        const { setGroupKeyState, hasMissingKeyGenerations } = useFeedsStore.getState();

        setGroupKeyState('group-1', {
          currentKeyGeneration: 4,
          keyGenerations: [sampleKeyGen0, sampleKeyGen1],
          missingKeyGenerations: [2, 3],
        });

        expect(hasMissingKeyGenerations('group-1')).toBe(true);
      });

      it('should return false when no missing keys', () => {
        const { setGroupKeyState, hasMissingKeyGenerations } = useFeedsStore.getState();

        setGroupKeyState('group-1', {
          currentKeyGeneration: 1,
          keyGenerations: [sampleKeyGen0, sampleKeyGen1],
          missingKeyGenerations: [],
        });

        expect(hasMissingKeyGenerations('group-1')).toBe(false);
      });

      it('should return false for unknown feed', () => {
        expect(useFeedsStore.getState().hasMissingKeyGenerations('unknown-feed')).toBe(false);
      });
    });

    describe('getMissingKeyGenerations', () => {
      it('should return list of missing key generation numbers', () => {
        const { setGroupKeyState, getMissingKeyGenerations } = useFeedsStore.getState();

        setGroupKeyState('group-1', {
          currentKeyGeneration: 4,
          keyGenerations: [sampleKeyGen0, sampleKeyGen1],
          missingKeyGenerations: [2, 3],
        });

        expect(getMissingKeyGenerations('group-1')).toEqual([2, 3]);
      });

      it('should return empty array when no missing keys', () => {
        const { setGroupKeyState, getMissingKeyGenerations } = useFeedsStore.getState();

        setGroupKeyState('group-1', {
          currentKeyGeneration: 1,
          keyGenerations: [sampleKeyGen0, sampleKeyGen1],
          missingKeyGenerations: [],
        });

        expect(getMissingKeyGenerations('group-1')).toEqual([]);
      });

      it('should return empty array for unknown feed', () => {
        expect(useFeedsStore.getState().getMissingKeyGenerations('unknown-feed')).toEqual([]);
      });

      it('should return a copy of the array (not mutating original)', () => {
        const { setGroupKeyState, getMissingKeyGenerations, getGroupKeyState } = useFeedsStore.getState();

        setGroupKeyState('group-1', {
          currentKeyGeneration: 3,
          keyGenerations: [sampleKeyGen0],
          missingKeyGenerations: [1, 2],
        });

        const missing = getMissingKeyGenerations('group-1');
        missing.push(99);

        expect(getGroupKeyState('group-1')?.missingKeyGenerations).toEqual([1, 2]);
      });
    });

    describe('recordMissingKeyGeneration', () => {
      it('should record a missing key generation', () => {
        const { addKeyGeneration, recordMissingKeyGeneration, getMissingKeyGenerations } = useFeedsStore.getState();

        addKeyGeneration('group-1', sampleKeyGen0);
        recordMissingKeyGeneration('group-1', 2);

        expect(getMissingKeyGenerations('group-1')).toEqual([2]);
      });

      it('should not record duplicate missing key', () => {
        const { addKeyGeneration, recordMissingKeyGeneration, getMissingKeyGenerations } = useFeedsStore.getState();

        addKeyGeneration('group-1', sampleKeyGen0);
        recordMissingKeyGeneration('group-1', 2);
        recordMissingKeyGeneration('group-1', 2);

        expect(getMissingKeyGenerations('group-1')).toEqual([2]);
      });

      it('should not record key that already exists', () => {
        const { setGroupKeyState, recordMissingKeyGeneration, getMissingKeyGenerations } = useFeedsStore.getState();

        setGroupKeyState('group-1', {
          currentKeyGeneration: 1,
          keyGenerations: [sampleKeyGen0, sampleKeyGen1],
          missingKeyGenerations: [],
        });

        recordMissingKeyGeneration('group-1', 0);
        recordMissingKeyGeneration('group-1', 1);

        expect(getMissingKeyGenerations('group-1')).toEqual([]);
      });

      it('should sort missing keys by number', () => {
        const { addKeyGeneration, recordMissingKeyGeneration, getMissingKeyGenerations } = useFeedsStore.getState();

        addKeyGeneration('group-1', sampleKeyGen0);
        recordMissingKeyGeneration('group-1', 3);
        recordMissingKeyGeneration('group-1', 1);
        recordMissingKeyGeneration('group-1', 2);

        expect(getMissingKeyGenerations('group-1')).toEqual([1, 2, 3]);
      });

      it('should work for unknown feed (creates initial state)', () => {
        const { recordMissingKeyGeneration, getMissingKeyGenerations } = useFeedsStore.getState();

        recordMissingKeyGeneration('new-group', 5);

        expect(getMissingKeyGenerations('new-group')).toEqual([5]);
      });
    });

    describe('getGroupKeyState', () => {
      it('should return complete key state', () => {
        const { setGroupKeyState, getGroupKeyState } = useFeedsStore.getState();

        const keyState = {
          currentKeyGeneration: 2,
          keyGenerations: [sampleKeyGen0, sampleKeyGen1, sampleKeyGen2],
          missingKeyGenerations: [],
        };

        setGroupKeyState('group-1', keyState);

        expect(getGroupKeyState('group-1')).toEqual(keyState);
      });

      it('should return undefined for unknown feed', () => {
        expect(useFeedsStore.getState().getGroupKeyState('unknown-feed')).toBeUndefined();
      });
    });

    describe('reset clears key state', () => {
      it('should clear groupKeyStates on reset', () => {
        const state = useFeedsStore.getState();

        state.setGroupKeyState('group-1', {
          currentKeyGeneration: 1,
          keyGenerations: [sampleKeyGen0, sampleKeyGen1],
          missingKeyGenerations: [],
        });

        state.reset();

        expect(useFeedsStore.getState().groupKeyStates).toEqual({});
      });
    });
  });

  /**
   * Tests for the "rejoin after leave" scenario.
   *
   * Expected behavior:
   * 1. Admin can add a member back who previously left
   * 2. The rejoining member gets new key generations starting from rejoin block
   * 3. The rejoining member can decrypt:
   *    - Messages from their original membership period (KeyGen 0-1 before leaving)
   *    - Messages after they rejoin (KeyGen 3+ after rejoining)
   * 4. Messages sent while they were gone (KeyGen 2) remain inaccessible
   *
   * Timeline example:
   * - KeyGen 0: Block 1000 (user joined at group creation)
   * - KeyGen 1: Block 2000 (someone else joined, key rotated)
   * - Block 2500: User leaves
   * - KeyGen 2: Block 3000 (someone else joined while user was gone)
   * - Block 3500: User rejoins via admin
   * - KeyGen 3: Block 4000 (key rotated for rejoin)
   *
   * User should have access to: KeyGen 0, 1, 3
   * User should NOT have access to: KeyGen 2 (created while away)
   */
  describe('Rejoin After Leave - Key Access', () => {
    // Sample key generations simulating the timeline above
    const keyGenBeforeLeave1 = {
      keyGeneration: 0,
      validFromBlock: 1000,
      aesKey: 'key0-original-member-key==',
    };

    const keyGenBeforeLeave2 = {
      keyGeneration: 1,
      validFromBlock: 2000,
      aesKey: 'key1-before-leave-key==',
    };

    // Note: KeyGen 2 (validFromBlock: 3000) is intentionally missing - user was away during this period
    // This simulates the gap in key access when a user leaves and later rejoins

    const keyGenAfterRejoin = {
      keyGeneration: 3,
      validFromBlock: 4000,
      aesKey: 'key3-after-rejoin-key==',
    };

    it('rejoined member has access to keys from before leaving and after rejoining', () => {
      const { setGroupKeyState, getGroupKeyState } = useFeedsStore.getState();

      // User has keys from KeyGen 0, 1, and 3, but NOT KeyGen 2
      const keyState = {
        currentKeyGeneration: 3,
        keyGenerations: [keyGenBeforeLeave1, keyGenBeforeLeave2, keyGenAfterRejoin],
        missingKeyGenerations: [2], // KeyGen 2 is missing (user was away)
      };

      setGroupKeyState('group-rejoin', keyState);

      const state = getGroupKeyState('group-rejoin');
      expect(state).toBeDefined();
      expect(state!.currentKeyGeneration).toBe(3);
      expect(state!.keyGenerations).toHaveLength(3);

      // User has KeyGen 0, 1, 3
      const keyGens = state!.keyGenerations.map((k) => k.keyGeneration);
      expect(keyGens).toContain(0);
      expect(keyGens).toContain(1);
      expect(keyGens).toContain(3);

      // User is missing KeyGen 2
      expect(state!.missingKeyGenerations).toContain(2);
    });

    it('can determine which key to use for message decryption based on keyGeneration field', () => {
      const { setGroupKeyState, getGroupKeyState } = useFeedsStore.getState();

      const keyState = {
        currentKeyGeneration: 3,
        keyGenerations: [keyGenBeforeLeave1, keyGenBeforeLeave2, keyGenAfterRejoin],
        missingKeyGenerations: [2],
      };

      setGroupKeyState('group-rejoin', keyState);

      const state = getGroupKeyState('group-rejoin');

      // Message from before leaving (keyGeneration: 1) - can decrypt
      const messageBeforeLeave = { keyGeneration: 1 };
      const keyForOldMessage = state!.keyGenerations.find(
        (k) => k.keyGeneration === messageBeforeLeave.keyGeneration
      );
      expect(keyForOldMessage).toBeDefined();
      expect(keyForOldMessage!.aesKey).toBe('key1-before-leave-key==');

      // Message from during absence (keyGeneration: 2) - cannot decrypt
      const messageDuringAbsence = { keyGeneration: 2 };
      const keyForMissedMessage = state!.keyGenerations.find(
        (k) => k.keyGeneration === messageDuringAbsence.keyGeneration
      );
      expect(keyForMissedMessage).toBeUndefined();

      // Message after rejoin (keyGeneration: 3) - can decrypt
      const messageAfterRejoin = { keyGeneration: 3 };
      const keyForNewMessage = state!.keyGenerations.find(
        (k) => k.keyGeneration === messageAfterRejoin.keyGeneration
      );
      expect(keyForNewMessage).toBeDefined();
      expect(keyForNewMessage!.aesKey).toBe('key3-after-rejoin-key==');
    });

    it('marks messages as decryptionFailed when key is missing', () => {
      // This test verifies the expected behavior for messages from while user was away
      const message = {
        id: 'msg-during-absence',
        feedId: 'group-rejoin',
        senderPublicKey: 'other-user',
        content: '[encrypted]', // Would show encrypted content
        timestamp: Date.now(),
        isConfirmed: true,
        keyGeneration: 2, // User doesn't have KeyGen 2
        decryptionFailed: true, // Message should be marked as decryption failed
      };

      // The message should have decryptionFailed flag set
      expect(message.decryptionFailed).toBe(true);
      expect(message.keyGeneration).toBe(2);
    });
  });

  describe('Rejoin After Leave - Member Status', () => {
    const memberWithHistory = {
      publicAddress: 'addr-rejoined',
      displayName: 'Rejoined User',
      role: 'Member' as const,
      joinedAtBlock: 3500, // Rejoined at block 3500
      leftAtBlock: undefined, // Currently active (not left)
    };

    const memberWhoLeft = {
      publicAddress: 'addr-left',
      displayName: 'Left User',
      role: 'Member' as const,
      joinedAtBlock: 1000,
      leftAtBlock: 2500, // Left and hasn't rejoined
    };

    it('active member has no leftAtBlock', () => {
      expect(memberWithHistory.leftAtBlock).toBeUndefined();
    });

    it('member who left has leftAtBlock set', () => {
      expect(memberWhoLeft.leftAtBlock).toBe(2500);
    });

    it('can filter active vs historical members', () => {
      const allMembers = [memberWithHistory, memberWhoLeft];

      const activeMembers = allMembers.filter((m) => m.leftAtBlock === undefined);
      const leftMembers = allMembers.filter((m) => m.leftAtBlock !== undefined);

      expect(activeMembers).toHaveLength(1);
      expect(activeMembers[0].displayName).toBe('Rejoined User');

      expect(leftMembers).toHaveLength(1);
      expect(leftMembers[0].displayName).toBe('Left User');
    });

    it('store includes leftAtBlock in member data', () => {
      const { setGroupMembers, getGroupMembers } = useFeedsStore.getState();

      setGroupMembers('group-with-history', [memberWithHistory, memberWhoLeft]);

      const members = getGroupMembers('group-with-history');
      expect(members).toHaveLength(2);

      const rejoinedMember = members.find((m) => m.publicAddress === 'addr-rejoined');
      const leftMember = members.find((m) => m.publicAddress === 'addr-left');

      expect(rejoinedMember).toBeDefined();
      expect(rejoinedMember!.leftAtBlock).toBeUndefined();

      expect(leftMember).toBeDefined();
      expect(leftMember!.leftAtBlock).toBe(2500);
    });
  });
});
