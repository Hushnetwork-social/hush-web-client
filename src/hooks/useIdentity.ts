'use client';

import { useState, useCallback } from 'react';
import { identityService, type Identity as GrpcIdentity, type GetIdentityReply } from '@/lib/grpc';

export function useIdentityLookup() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookupIdentity = useCallback(async (publicSigningAddress: string): Promise<GetIdentityReply | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await identityService.getIdentity(publicSigningAddress);
      if (!response.Successfull) {
        throw new Error(response.Message || 'Identity not found');
      }
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to lookup identity';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    lookupIdentity,
    isLoading,
    error,
  };
}

export function useIdentitySearch() {
  const [results, setResults] = useState<GrpcIdentity[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (partialDisplayName: string) => {
    if (!partialDisplayName.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    setError(null);
    try {
      const response = await identityService.searchByDisplayName(partialDisplayName);
      setResults(response.Identities || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Search failed';
      setError(errorMessage);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return {
    results,
    isSearching,
    error,
    search,
    clearResults,
  };
}
