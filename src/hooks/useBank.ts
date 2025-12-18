'use client';

import { useState, useCallback, useEffect } from 'react';
import { bankService } from '@/lib/grpc';
import { useAppStore } from '@/stores';

const DEFAULT_TOKEN = 'HUSH';

export function useBalance(address?: string) {
  const { balance, setBalance, credentials } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async (targetAddress?: string) => {
    const addr = targetAddress || address || credentials?.signingPublicKey;
    if (!addr) {
      setError('No address provided');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await bankService.getAddressBalance(DEFAULT_TOKEN, addr);
      const balanceValue = parseFloat(response.Balance) || 0;
      setBalance({
        available: balanceValue,
        pending: 0,
        currency: DEFAULT_TOKEN,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch balance';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [address, credentials?.signingPublicKey, setBalance]);

  // Auto-fetch when address is available
  useEffect(() => {
    const addr = address || credentials?.signingPublicKey;
    if (addr) {
      fetchBalance(addr);
    }
  }, [address, credentials?.signingPublicKey, fetchBalance]);

  return {
    balance,
    isLoading,
    error,
    refresh: fetchBalance,
  };
}

export function useTransferFunds() {
  const [isTransferring, setIsTransferring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transfer = useCallback(async (params: {
    id: string;
    feedId: string;
    token: string;
    fromAddress: string;
    toAddress: string;
    amount: string;
    hash: string;
    signature: string;
    feedPublicEncryptAddress: string;
  }) => {
    setIsTransferring(true);
    setError(null);
    try {
      const response = await bankService.transferFunds(params);
      if (!response.Successfull) {
        throw new Error(response.Message || 'Transfer failed');
      }
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transfer failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsTransferring(false);
    }
  }, []);

  return {
    transfer,
    isTransferring,
    error,
  };
}
