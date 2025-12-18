import { getGrpcClient } from '../client';
import type {
  GetBlockchainHeightRequest,
  GetBlockchainHeightReply,
  SubmitSignedTransactionRequest,
  SubmitSignedTransactionReply,
} from '../types';

const SERVICE_NAME = 'rpcHush.HushBlockchain';

export const blockchainService = {
  /**
   * Get the current blockchain height
   */
  async getBlockchainHeight(): Promise<GetBlockchainHeightReply> {
    const client = getGrpcClient();
    const request: GetBlockchainHeightRequest = {};
    return client.unaryCall<GetBlockchainHeightRequest, GetBlockchainHeightReply>(
      SERVICE_NAME,
      'GetBlockchainHeight',
      request
    );
  },

  /**
   * Submit a signed transaction to the blockchain
   */
  async submitSignedTransaction(
    signedTransaction: string
  ): Promise<SubmitSignedTransactionReply> {
    const client = getGrpcClient();
    const request: SubmitSignedTransactionRequest = {
      SignedTransaction: signedTransaction,
    };
    return client.unaryCall<SubmitSignedTransactionRequest, SubmitSignedTransactionReply>(
      SERVICE_NAME,
      'SubmitSignedTransaction',
      request
    );
  },
};
