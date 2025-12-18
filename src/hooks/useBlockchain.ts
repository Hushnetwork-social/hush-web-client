'use client';

import { useState, useCallback } from 'react';
import { blockchainService } from '@/lib/grpc';

/**
 * Hook for submitting transactions to the blockchain
 *
 * Note: Block height polling is now handled by the sync architecture.
 * Use useBlockchainStore from @/modules/blockchain for block height state.
 */
export function useSubmitTransaction() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitTransaction = useCallback(async (signedTransaction: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await blockchainService.submitSignedTransaction(signedTransaction);
      if (!response.Successfull) {
        throw new Error(response.Message || 'Transaction submission failed');
      }
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transaction submission failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return {
    submitTransaction,
    isSubmitting,
    error,
  };
}
