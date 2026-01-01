/**
 * Membership Proof Manager
 *
 * Manages caching and fetching of Merkle proofs for ZK reactions.
 * Proofs are cached with a TTL to avoid repeated server calls.
 */

import { membershipServiceBinary } from '@/lib/grpc/services/membership-binary';
import type { MerkleProofData } from '@/lib/zk/types';
import { bytesToBigint, bigintToBytes } from '@/lib/crypto/reactions/babyjubjub';
import { debugLog, debugError } from '@/lib/debug-logger';

/**
 * Cached proof entry
 */
interface CachedProof {
  proof: MerkleProofData;
  feedId: string;
  userCommitment: bigint;
  fetchedAt: number;
}

/**
 * Membership Proof Manager
 */
class MembershipProofManagerClass {
  private cache: Map<string, CachedProof> = new Map();
  private readonly CACHE_TTL_MS = 60_000; // 1 minute

  /**
   * Get a membership proof for a user in a feed
   *
   * @param feedId - The feed UUID
   * @param userCommitment - The user's commitment (Poseidon(userSecret))
   * @returns Merkle proof data for ZK circuit
   */
  async getProof(feedId: string, userCommitment: bigint): Promise<MerkleProofData> {
    const cacheKey = this.getCacheKey(feedId, userCommitment);
    const cached = this.cache.get(cacheKey);

    // Return cached proof if still valid
    if (cached && Date.now() - cached.fetchedAt < this.CACHE_TTL_MS) {
      console.log('[MembershipProofManager] Using cached proof');
      return cached.proof;
    }

    // Fetch fresh proof from server
    console.log('[MembershipProofManager] Fetching fresh proof');
    const proof = await this.fetchProof(feedId, userCommitment);

    // Cache the proof
    this.cache.set(cacheKey, {
      proof,
      feedId,
      userCommitment,
      fetchedAt: Date.now(),
    });

    return proof;
  }

  /**
   * Fetch proof from server
   */
  private async fetchProof(feedId: string, userCommitment: bigint): Promise<MerkleProofData> {
    // Convert to base64 for gRPC
    const feedIdBytes = this.uuidToBytes(feedId);
    const commitmentBytes = bigintToBytes(userCommitment);

    const feedIdBase64 = btoa(String.fromCharCode(...feedIdBytes));
    const commitmentBase64 = btoa(String.fromCharCode(...commitmentBytes));

    const response = await membershipServiceBinary.getMembershipProof(feedIdBase64, commitmentBase64);

    if (!response.IsMember) {
      throw new Error('User is not a member of this feed');
    }

    // Parse response
    const merkleRoot = response.MerkleRoot ? this.base64ToBigint(response.MerkleRoot) : 0n;
    const pathElements = response.PathElements?.map((e) => this.base64ToBigint(e)) || [];
    const pathIndices = response.PathIndices || [];
    const depth = response.TreeDepth || 0;
    const rootBlockHeight = response.RootBlockHeight || 0;

    return {
      root: merkleRoot,
      pathElements,
      pathIndices,
      depth,
      rootBlockHeight,
    };
  }

  /**
   * Invalidate cached proofs for a feed
   */
  invalidateCache(feedId: string): void {
    for (const [key, entry] of this.cache) {
      if (entry.feedId === feedId) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cached proofs
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Check if user is a member of a feed
   */
  async isMember(feedId: string, userCommitment: bigint): Promise<boolean> {
    try {
      const feedIdBytes = this.uuidToBytes(feedId);
      const commitmentBytes = bigintToBytes(userCommitment);

      const feedIdBase64 = btoa(String.fromCharCode(...feedIdBytes));
      const commitmentBase64 = btoa(String.fromCharCode(...commitmentBytes));

      const response = await membershipServiceBinary.isCommitmentRegistered(feedIdBase64, commitmentBase64);

      return response.IsRegistered;
    } catch (error) {
      debugError('[MembershipProofManager] Failed to check membership:', error);
      return false;
    }
  }

  /**
   * Register user's commitment for a feed
   */
  async registerCommitment(feedId: string, userCommitment: bigint): Promise<boolean> {
    try {
      const feedIdBytes = this.uuidToBytes(feedId);
      const commitmentBytes = bigintToBytes(userCommitment);

      const feedIdBase64 = btoa(String.fromCharCode(...feedIdBytes));
      const commitmentBase64 = btoa(String.fromCharCode(...commitmentBytes));

      console.log(`[MembershipProofManager] Registering commitment for feed ${feedId.substring(0, 8)}...`);
      console.log(`[MembershipProofManager] FeedId base64: ${feedIdBase64.substring(0, 20)}...`);
      console.log(`[MembershipProofManager] Commitment base64: ${commitmentBase64.substring(0, 20)}...`);
      debugLog(`[MembershipProofManager] Registering commitment for feed ${feedId.substring(0, 8)}...`);

      const response = await membershipServiceBinary.registerCommitment(feedIdBase64, commitmentBase64);

      console.log(`[MembershipProofManager] RegisterCommitment response:`, response);

      if (response.Success) {
        // Invalidate cache since tree changed
        this.invalidateCache(feedId);
        console.log(`[MembershipProofManager] Commitment registered successfully`);
        debugLog(`[MembershipProofManager] Commitment registered successfully`);
      } else if (response.AlreadyRegistered) {
        console.log(`[MembershipProofManager] Commitment already registered`);
      } else {
        console.warn(`[MembershipProofManager] RegisterCommitment failed: Success=false`);
      }

      return response.Success || response.AlreadyRegistered;
    } catch (error) {
      console.error('[MembershipProofManager] Failed to register commitment:', error);
      debugError('[MembershipProofManager] Failed to register commitment:', error);
      return false;
    }
  }

  /**
   * Get recent Merkle roots for grace period verification
   * Note: Not yet implemented in binary service - returns empty for now
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getRecentRoots(_feedId: string, _count: number = 3): Promise<bigint[]> {
    // TODO: Implement getRecentMerkleRoots in membership-binary.ts when needed
    debugLog('[MembershipProofManager] getRecentRoots not yet implemented');
    return [];
  }

  /**
   * Generate cache key
   */
  private getCacheKey(feedId: string, userCommitment: bigint): string {
    return `${feedId}:${userCommitment.toString(16)}`;
  }

  /**
   * Convert UUID string to bytes
   */
  private uuidToBytes(uuid: string): Uint8Array {
    const hex = uuid.replace(/-/g, '');
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  /**
   * Convert base64 string to bigint
   */
  private base64ToBigint(base64: string): bigint {
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytesToBigint(bytes);
  }
}

// Singleton instance
export const membershipProofManager = new MembershipProofManagerClass();
