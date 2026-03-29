import { buildApiUrl } from '@/lib/api-config';
import { getGrpcClient } from '../client';
import type {
  GetBlockchainHeightRequest,
  GetBlockchainHeightReply,
  GetElectionEnvelopeContextReply,
  SubmitSignedTransactionReply,
  TransactionStatus,
} from '../types';

const SERVICE_NAME = 'rpcHush.HushBlockchain';
let electionEnvelopeContextPromise: Promise<GetElectionEnvelopeContextReply> | null = null;

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

  async getElectionEnvelopeContext(): Promise<GetElectionEnvelopeContextReply> {
    if (!electionEnvelopeContextPromise) {
      electionEnvelopeContextPromise = fetch(buildApiUrl('/api/blockchain/election-envelope-context'))
        .then(async (response) => {
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
          }

          const data = await response.json();
          return {
            NodePublicEncryptAddress: data.nodePublicEncryptAddress ?? '',
            ElectionEnvelopeVersion: data.electionEnvelopeVersion ?? '',
          };
        })
        .catch((error) => {
          electionEnvelopeContextPromise = null;
          throw error;
        });
    }

    return electionEnvelopeContextPromise;
  },

  /**
   * Submit a signed transaction to the blockchain
   * Uses Next.js API route which handles protobuf encoding properly
   */
  async submitSignedTransaction(
    signedTransaction: string
  ): Promise<SubmitSignedTransactionReply> {
    const response = await fetch(buildApiUrl('/api/blockchain/submit'), {
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
      Status: data.status as TransactionStatus,  // FEAT-057: Include transaction status
      ValidationCode: data.validationCode || '',
    };
  },
};
