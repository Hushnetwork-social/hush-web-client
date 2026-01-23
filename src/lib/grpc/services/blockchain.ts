import { getGrpcClient } from '../client';
import type {
  GetBlockchainHeightRequest,
  GetBlockchainHeightReply,
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
   * Uses Next.js API route which handles protobuf encoding properly
   */
  async submitSignedTransaction(
    signedTransaction: string
  ): Promise<SubmitSignedTransactionReply> {
    const response = await fetch('/api/blockchain/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ signedTransaction }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();

    // Map API response format (lowercase) to expected format (PascalCase)
    return {
      Successfull: data.successful,
      Message: data.message || '',
    };
  },
};
