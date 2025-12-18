import { getGrpcClient } from '../client';
import type {
  GetAddressBalanceRequest,
  GetAddressBalanceReply,
  TransferFundsRequest,
  TransferFundsReply,
  GetNftsByAddressRequest,
  GetNftsByAddressReply,
  MintNFTRequest,
  MintNFTReply,
  NftMetadata,
} from '../types';

const SERVICE_NAME = 'rpcHush.HushBank';

export const bankService = {
  /**
   * Get the balance of an address for a specific token
   */
  async getAddressBalance(token: string, address: string): Promise<GetAddressBalanceReply> {
    const client = getGrpcClient();
    const request: GetAddressBalanceRequest = {
      Token: token,
      Address: address,
    };
    return client.unaryCall<GetAddressBalanceRequest, GetAddressBalanceReply>(
      SERVICE_NAME,
      'GetAddressBalance',
      request
    );
  },

  /**
   * Transfer funds between addresses
   */
  async transferFunds(params: {
    id: string;
    feedId: string;
    token: string;
    fromAddress: string;
    toAddress: string;
    amount: string;
    hash: string;
    signature: string;
    feedPublicEncryptAddress: string;
  }): Promise<TransferFundsReply> {
    const client = getGrpcClient();
    const request: TransferFundsRequest = {
      Id: params.id,
      FeedId: params.feedId,
      Token: params.token,
      FromAddress: params.fromAddress,
      ToAddress: params.toAddress,
      Amount: params.amount,
      Hash: params.hash,
      Signature: params.signature,
      FeedPublicEncriptAddress: params.feedPublicEncryptAddress,
    };
    return client.unaryCall<TransferFundsRequest, TransferFundsReply>(
      SERVICE_NAME,
      'TransferFunds',
      request
    );
  },

  /**
   * Get NFTs owned by an address
   */
  async getNftsByAddress(address: string, blockIndex: number = 0): Promise<GetNftsByAddressReply> {
    const client = getGrpcClient();
    const request: GetNftsByAddressRequest = {
      Address: address,
      BlockIndex: blockIndex,
    };
    return client.unaryCall<GetNftsByAddressRequest, GetNftsByAddressReply>(
      SERVICE_NAME,
      'GetNftsByAddress',
      request
    );
  },

  /**
   * Mint a new NFT
   */
  async mintNft(params: {
    nonFungibleTokenId: string;
    publicOwnerAddress: string;
    title: string;
    description: string;
    nonFungibleTokenType: string;
    encryptedContent: boolean;
    hash: string;
    signature: string;
    metadata: NftMetadata[];
  }): Promise<MintNFTReply> {
    const client = getGrpcClient();
    const request: MintNFTRequest = {
      NonFugibleTokenId: params.nonFungibleTokenId,
      PublicOwneAddress: params.publicOwnerAddress,
      Title: params.title,
      Description: params.description,
      NonFugibleTokenType: params.nonFungibleTokenType,
      EncryptedContent: params.encryptedContent,
      Hash: params.hash,
      Signature: params.signature,
      Metadata: params.metadata,
    };
    return client.unaryCall<MintNFTRequest, MintNFTReply>(
      SERVICE_NAME,
      'MintNFT',
      request
    );
  },
};
