import type {
  GetIdentityReply,
  SearchByDisplayNameReply,
} from '../types';
import { debugLog } from '@/lib/debug-logger';
import { buildApiUrl } from '@/lib/api-config';

export const identityService = {
  /**
   * Get identity by public signing address
   * Uses API route for proper binary protobuf communication
   */
  async getIdentity(publicSigningAddress: string): Promise<GetIdentityReply> {
    debugLog('[IdentityService] getIdentity:', { address: publicSigningAddress.substring(0, 10) });
    try {
      const url = buildApiUrl(`/api/identity/check?address=${encodeURIComponent(publicSigningAddress)}`);
      debugLog('[IdentityService] getIdentity URL:', url);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        return {
          Successfull: false,
          Message: data.error,
          ProfileName: '',
          PublicSigningAddress: publicSigningAddress,
          PublicEncryptAddress: '',
          IsPublic: false,
        };
      }

      return {
        Successfull: data.exists,
        Message: data.message || '',
        ProfileName: data.identity?.profileName || '',
        PublicSigningAddress: data.identity?.publicSigningAddress || publicSigningAddress,
        PublicEncryptAddress: data.identity?.publicEncryptAddress || '',
        IsPublic: data.identity?.isPublic || false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get identity';
      debugLog('[IdentityService] getIdentity error:', message);
      return {
        Successfull: false,
        Message: message,
        ProfileName: '',
        PublicSigningAddress: publicSigningAddress,
        PublicEncryptAddress: '',
        IsPublic: false,
      };
    }
  },

  /**
   * Search for identities by partial display name
   * Uses API route for proper binary protobuf communication
   */
  async searchByDisplayName(partialDisplayName: string): Promise<SearchByDisplayNameReply> {
    debugLog('[IdentityService] searchByDisplayName:', { query: partialDisplayName });
    try {
      const url = buildApiUrl(`/api/identity/search?name=${encodeURIComponent(partialDisplayName)}`);
      debugLog('[IdentityService] searchByDisplayName URL:', url);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        return { Identities: [] };
      }

      return {
        Identities: (data.identities || []).map((i: { displayName: string; publicSigningAddress: string; publicEncryptAddress: string }) => ({
          DisplayName: i.displayName,
          PublicSigningAddress: i.publicSigningAddress,
          PublicEncryptAddress: i.publicEncryptAddress,
        })),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to search identities';
      debugLog('[IdentityService] searchByDisplayName error:', message);
      return { Identities: [] };
    }
  },
};
