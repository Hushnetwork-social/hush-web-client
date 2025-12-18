import { getGrpcClient } from '../client';
import type {
  GetIdentityRequest,
  GetIdentityReply,
  SearchByDisplayNameRequest,
  SearchByDisplayNameReply,
} from '../types';

const SERVICE_NAME = 'rpcHush.HushIdentity';

export const identityService = {
  /**
   * Get identity by public signing address
   */
  async getIdentity(publicSigningAddress: string): Promise<GetIdentityReply> {
    const client = getGrpcClient();
    const request: GetIdentityRequest = {
      PublicSigningAddress: publicSigningAddress,
    };
    return client.unaryCall<GetIdentityRequest, GetIdentityReply>(
      SERVICE_NAME,
      'GetIdentity',
      request
    );
  },

  /**
   * Search for identities by partial display name
   */
  async searchByDisplayName(partialDisplayName: string): Promise<SearchByDisplayNameReply> {
    const client = getGrpcClient();
    const request: SearchByDisplayNameRequest = {
      PartialDisplayName: partialDisplayName,
    };
    return client.unaryCall<SearchByDisplayNameRequest, SearchByDisplayNameReply>(
      SERVICE_NAME,
      'SearchByDisplayName',
      request
    );
  },
};
