import { getGrpcClient } from '../client';
import type {
  HasPersonalFeedRequest,
  HasPersonalFeedReply,
  IsFeedInBlockchainRequest,
  IsFeedInBlockchainReply,
  GetFeedForAddressRequest,
  GetFeedForAddressReply,
  GetFeedMessagesForAddressRequest,
  GetFeedMessagesForAddressReply,
  GetMessageByIdRequest,
  GetMessageByIdResponse,
} from '../types';

const SERVICE_NAME = 'rpcHush.HushFeed';

export const feedService = {
  /**
   * Check if a personal feed exists for a public key
   */
  async hasPersonalFeed(publicPublicKey: string): Promise<HasPersonalFeedReply> {
    const client = getGrpcClient();
    const request: HasPersonalFeedRequest = {
      PublicPublicKey: publicPublicKey,
    };
    return client.unaryCall<HasPersonalFeedRequest, HasPersonalFeedReply>(
      SERVICE_NAME,
      'HasPersonalFeed',
      request
    );
  },

  /**
   * Check if a feed exists in the blockchain
   */
  async isFeedInBlockchain(feedId: string): Promise<IsFeedInBlockchainReply> {
    const client = getGrpcClient();
    const request: IsFeedInBlockchainRequest = {
      FeedId: feedId,
    };
    return client.unaryCall<IsFeedInBlockchainRequest, IsFeedInBlockchainReply>(
      SERVICE_NAME,
      'IsFeedInBlockchain',
      request
    );
  },

  /**
   * Get all feeds for an address starting from a block index
   */
  async getFeedsForAddress(
    profilePublicKey: string,
    blockIndex: number = 0
  ): Promise<GetFeedForAddressReply> {
    const client = getGrpcClient();
    const request: GetFeedForAddressRequest = {
      ProfilePublicKey: profilePublicKey,
      BlockIndex: blockIndex,
    };
    return client.unaryCall<GetFeedForAddressRequest, GetFeedForAddressReply>(
      SERVICE_NAME,
      'GetFeedsForAddress',
      request
    );
  },

  /**
   * Get all feed messages for an address starting from a block index
   * Also fetches reaction tallies since lastReactionTallyVersion (Protocol Omega)
   */
  async getFeedMessagesForAddress(
    profilePublicKey: string,
    blockIndex: number = 0,
    lastReactionTallyVersion: number = 0
  ): Promise<GetFeedMessagesForAddressReply> {
    const client = getGrpcClient();
    const request: GetFeedMessagesForAddressRequest = {
      ProfilePublicKey: profilePublicKey,
      BlockIndex: blockIndex,
      LastReactionTallyVersion: lastReactionTallyVersion,
    };
    return client.unaryCall<GetFeedMessagesForAddressRequest, GetFeedMessagesForAddressReply>(
      SERVICE_NAME,
      'GetFeedMessagesForAddress',
      request
    );
  },

  /**
   * FEAT-056: Get older messages before a specific block index (backward pagination)
   * Used for "Load More" when user scrolls up in conversation.
   */
  async getOlderMessages(
    profilePublicKey: string,
    beforeBlockIndex: number,
    limit: number = 50
  ): Promise<GetFeedMessagesForAddressReply> {
    const client = getGrpcClient();
    const request: GetFeedMessagesForAddressRequest = {
      ProfilePublicKey: profilePublicKey,
      BlockIndex: 0,  // Not used for backward pagination
      LastReactionTallyVersion: 0,  // Not tracking reactions for older messages
      BeforeBlockIndex: beforeBlockIndex,
      Limit: limit,
    };
    return client.unaryCall<GetFeedMessagesForAddressRequest, GetFeedMessagesForAddressReply>(
      SERVICE_NAME,
      'GetFeedMessagesForAddress',
      request
    );
  },

  /**
   * FEAT-056: Fetch a single message by ID (for reply preview)
   * Used when replied-to message is not in cache.
   */
  async getMessageById(
    feedId: string,
    messageId: string
  ): Promise<GetMessageByIdResponse> {
    const client = getGrpcClient();
    const request: GetMessageByIdRequest = {
      FeedId: feedId,
      MessageId: messageId,
    };
    return client.unaryCall<GetMessageByIdRequest, GetMessageByIdResponse>(
      SERVICE_NAME,
      'GetMessageById',
      request
    );
  },
};
