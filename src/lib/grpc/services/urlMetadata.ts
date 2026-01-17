import { getGrpcClient } from '../client';
import type {
  GetUrlMetadataRequest,
  GetUrlMetadataResponse,
  GetUrlMetadataBatchRequest,
  GetUrlMetadataBatchResponse,
} from '../types';

const SERVICE_NAME = 'rpcHush.HushUrlMetadata';

export const urlMetadataService = {
  /**
   * Get metadata for a single URL
   */
  async getUrlMetadata(url: string): Promise<GetUrlMetadataResponse> {
    const client = getGrpcClient();
    const request: GetUrlMetadataRequest = {
      Url: url,
    };
    return client.unaryCall<GetUrlMetadataRequest, GetUrlMetadataResponse>(
      SERVICE_NAME,
      'GetUrlMetadata',
      request
    );
  },

  /**
   * Get metadata for multiple URLs (batch request, max 10 URLs)
   */
  async getUrlMetadataBatch(urls: string[]): Promise<GetUrlMetadataBatchResponse> {
    const client = getGrpcClient();
    const request: GetUrlMetadataBatchRequest = {
      Urls: urls,
    };
    return client.unaryCall<GetUrlMetadataBatchRequest, GetUrlMetadataBatchResponse>(
      SERVICE_NAME,
      'GetUrlMetadataBatch',
      request
    );
  },
};
