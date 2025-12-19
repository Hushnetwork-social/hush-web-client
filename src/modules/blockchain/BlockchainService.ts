/**
 * Blockchain Service
 *
 * Handles API calls for blockchain-related operations.
 *
 * See MemoryBank/HushWebClient/SYNC_ARCHITECTURE.md for full documentation.
 */

import { buildApiUrl } from '@/lib/api-config';

/**
 * Fetches the current blockchain height from the API.
 * @returns The current block index
 * @throws Error if the API call fails
 */
export async function fetchBlockHeight(): Promise<number> {
  const response = await fetch(buildApiUrl('/api/blockchain/height'));

  if (!response.ok) {
    throw new Error(`Failed to fetch block height: HTTP ${response.status}`);
  }

  const data = await response.json();

  if (typeof data.height !== 'number') {
    throw new Error('Invalid response: missing height');
  }

  return data.height;
}

/**
 * Submits a signed transaction to the blockchain.
 * @param signedTransaction - The JSON-serialized signed transaction
 * @returns Whether the submission was successful
 */
export async function submitTransaction(signedTransaction: string): Promise<{
  successful: boolean;
  message: string;
}> {
  const response = await fetch(buildApiUrl('/api/blockchain/submit'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signedTransaction }),
  });

  if (!response.ok) {
    throw new Error(`Failed to submit transaction: HTTP ${response.status}`);
  }

  const data = await response.json();

  return {
    successful: data.successful ?? false,
    message: data.message ?? data.error ?? '',
  };
}
