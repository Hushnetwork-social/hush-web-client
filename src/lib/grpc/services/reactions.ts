/**
 * Reactions gRPC Service
 *
 * Handles anonymous reactions with ZK proofs.
 * See MemoryBank/ProtocolOmega/ for full documentation.
 */

import { getGrpcClient } from '../client';
import type {
  SubmitReactionRequest,
  SubmitReactionResponse,
  GetTalliesRequest,
  GetTalliesResponse,
  NullifierExistsRequest,
  NullifierExistsResponse,
  GetReactionBackupRequest,
  GetReactionBackupResponse,
} from '../types';

const SERVICE_NAME = 'rpcHush.HushReactions';

export const reactionsService = {
  /**
   * Submit a new reaction or update existing.
   * ZK proof proves feed membership without revealing identity.
   */
  async submitReaction(request: SubmitReactionRequest): Promise<SubmitReactionResponse> {
    const client = getGrpcClient();
    return client.unaryCall<SubmitReactionRequest, SubmitReactionResponse>(
      SERVICE_NAME,
      'SubmitReaction',
      request
    );
  },

  /**
   * Get aggregated tallies for multiple messages.
   * Returns encrypted tallies that must be decrypted with feed private key.
   */
  async getTallies(request: GetTalliesRequest): Promise<GetTalliesResponse> {
    const client = getGrpcClient();
    return client.unaryCall<GetTalliesRequest, GetTalliesResponse>(
      SERVICE_NAME,
      'GetReactionTallies',
      request
    );
  },

  /**
   * Check if a nullifier exists (for client state recovery).
   * Client computes nullifier = Poseidon(user_secret, message_id, feed_id, DOMAIN).
   */
  async nullifierExists(request: NullifierExistsRequest): Promise<NullifierExistsResponse> {
    const client = getGrpcClient();
    return client.unaryCall<NullifierExistsRequest, NullifierExistsResponse>(
      SERVICE_NAME,
      'NullifierExists',
      request
    );
  },

  /**
   * Get reaction backup for cross-device recovery.
   * Returns encrypted emoji index that only the user can decrypt.
   */
  async getReactionBackup(request: GetReactionBackupRequest): Promise<GetReactionBackupResponse> {
    const client = getGrpcClient();
    return client.unaryCall<GetReactionBackupRequest, GetReactionBackupResponse>(
      SERVICE_NAME,
      'GetReactionBackup',
      request
    );
  },
};
