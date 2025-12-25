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
});
