/**
 * Identity Service
 *
 * Handles API calls for identity operations.
 */

import type { ProfileSearchResult } from '@/types';
import { buildApiUrl } from '@/lib/api-config';

export interface IdentityInfo {
  exists: boolean;
  profileName?: string;
  publicSigningAddress?: string;
  publicEncryptAddress?: string;
  isPublic?: boolean;
}

/**
 * Checks if an identity exists in the blockchain.
 */
export async function checkIdentityExists(address: string): Promise<IdentityInfo> {
  const url = buildApiUrl(`/api/identity/check?address=${encodeURIComponent(address)}`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to check identity: HTTP ${response.status}`);
  }

  const data = await response.json();

  return {
    exists: data.exists === true,
    profileName: data.identity?.profileName,
    publicSigningAddress: data.identity?.publicSigningAddress,
    publicEncryptAddress: data.identity?.publicEncryptAddress,
    isPublic: data.identity?.isPublic,
  };
}

/**
 * Submits a transaction to the blockchain.
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

/**
 * Searches for identities by partial display name.
 */
export async function searchByDisplayName(partialName: string): Promise<ProfileSearchResult[]> {
  if (!partialName || partialName.trim().length === 0) {
    return [];
  }

  const url = buildApiUrl(`/api/identity/search?name=${encodeURIComponent(partialName.trim())}`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to search identities: HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!data.identities || !Array.isArray(data.identities)) {
    return [];
  }

  return data.identities.map((identity: {
    displayName: string;
    publicSigningAddress: string;
    publicEncryptAddress: string;
  }) => ({
    displayName: identity.displayName,
    publicSigningAddress: identity.publicSigningAddress,
    publicEncryptAddress: identity.publicEncryptAddress,
  }));
}
