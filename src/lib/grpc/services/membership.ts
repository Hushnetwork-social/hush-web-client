/**
 * Membership gRPC Service
 *
 * Handles Merkle tree operations for ZK proofs.
 * See MemoryBank/ProtocolOmega/ for full documentation.
 */

import { getGrpcClient } from '../client';
import type {
  GetMembershipProofRequest,
  GetMembershipProofResponse,
  GetRecentRootsRequest,
  GetRecentRootsResponse,
  RegisterCommitmentRequest,
  RegisterCommitmentResponse,
  IsCommitmentRegisteredRequest,
  IsCommitmentRegisteredResponse,
} from '../types';

const SERVICE_NAME = 'rpcHush.HushMembership';

export const membershipService = {
  /**
   * Get user's Merkle proof for a feed.
   * Returns path elements and indices for ZK circuit input.
   */
  async getMembershipProof(request: GetMembershipProofRequest): Promise<GetMembershipProofResponse> {
    const client = getGrpcClient();
    return client.unaryCall<GetMembershipProofRequest, GetMembershipProofResponse>(
      SERVICE_NAME,
      'GetMembershipProof',
      request
    );
  },

  /**
   * Get recent Merkle roots for grace period verification.
   * Allows proofs against recent roots while tree updates.
   */
  async getRecentMerkleRoots(request: GetRecentRootsRequest): Promise<GetRecentRootsResponse> {
    const client = getGrpcClient();
    return client.unaryCall<GetRecentRootsRequest, GetRecentRootsResponse>(
      SERVICE_NAME,
      'GetRecentMerkleRoots',
      request
    );
  },

  /**
   * Register anonymous commitment for a feed.
   * Commitment = Poseidon(user_secret) - no identity linkage.
   */
  async registerCommitment(request: RegisterCommitmentRequest): Promise<RegisterCommitmentResponse> {
    const client = getGrpcClient();
    return client.unaryCall<RegisterCommitmentRequest, RegisterCommitmentResponse>(
      SERVICE_NAME,
      'RegisterCommitment',
      request
    );
  },

  /**
   * Check if a commitment is already registered for a feed.
   * Used to avoid duplicate registration.
   */
  async isCommitmentRegistered(request: IsCommitmentRegisteredRequest): Promise<IsCommitmentRegisteredResponse> {
    const client = getGrpcClient();
    return client.unaryCall<IsCommitmentRegisteredRequest, IsCommitmentRegisteredResponse>(
      SERVICE_NAME,
      'IsCommitmentRegistered',
      request
    );
  },
};
