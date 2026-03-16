/**
 * Membership service client.
 *
 * Uses the Next.js API proxy so browser callers avoid direct gRPC hops to
 * `host.docker.internal`, which are unstable in Playwright E2E runs.
 */

import { debugLog, debugError } from '@/lib/debug-logger';
import { buildApiUrl } from '@/lib/api-config';
import type {
  RegisterCommitmentResponse,
  IsCommitmentRegisteredResponse,
  GetMembershipProofResponse,
} from '../types';

const MEMBERSHIP_PROXY_URL = '/api/reactions/membership';

export interface GlobalMembershipDerivationResult {
  userSecretHex: string;
  userCommitmentHex: string;
  userCommitmentBase64: string;
}

export const membershipServiceBinary = {
  async deriveGlobalMembership(
    publicAddress: string
  ): Promise<GlobalMembershipDerivationResult> {
    try {
      const requestUrl = buildApiUrl(MEMBERSHIP_PROXY_URL);
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'derive-global',
          publicAddress,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Membership proxy derive-global failed: ${response.status} ${text}`);
      }

      const payload = await response.json() as {
        success?: boolean;
        globalMembership?: GlobalMembershipDerivationResult;
      };

      if (!payload.globalMembership?.userSecretHex || !payload.globalMembership?.userCommitmentHex) {
        throw new Error('Membership proxy derive-global returned incomplete membership data');
      }

      return payload.globalMembership;
    } catch (error) {
      console.error('[MembershipService] deriveGlobalMembership failed:', error);
      debugError('[MembershipService] deriveGlobalMembership failed:', error);
      throw error;
    }
  },

  /**
   * Register anonymous commitment for a feed.
   * Uses the Next.js proxy to avoid unstable direct browser gRPC hops in E2E.
   */
  async registerCommitment(
    feedIdBase64: string,
    userCommitmentBase64: string
  ): Promise<RegisterCommitmentResponse> {
    try {
      const requestUrl = buildApiUrl(MEMBERSHIP_PROXY_URL);
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'register',
          feedId: feedIdBase64,
          userCommitment: userCommitmentBase64,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Membership proxy register failed: ${response.status} ${text}`);
      }

      const payload = await response.json() as {
        success?: boolean;
        registerCommitment?: {
          success?: boolean;
          alreadyRegistered?: boolean;
          newMerkleRoot?: string;
        };
      };

      return {
        Success: payload.registerCommitment?.success ?? false,
        AlreadyRegistered: payload.registerCommitment?.alreadyRegistered ?? false,
        NewMerkleRoot: payload.registerCommitment?.newMerkleRoot ?? '',
      };
    } catch (error) {
      console.error('[MembershipService] RegisterCommitment failed:', error);
      debugError('[MembershipService] RegisterCommitment failed:', error);
      throw error;
    }
  },

  /**
   * Check if a commitment is already registered for a feed.
   * Uses the Next.js proxy to avoid unstable direct browser gRPC hops in E2E.
   */
  async isCommitmentRegistered(
    feedIdBase64: string,
    userCommitmentBase64: string
  ): Promise<IsCommitmentRegisteredResponse> {
    try {
      debugLog('[MembershipService] IsCommitmentRegistered');
      const requestUrl = buildApiUrl(MEMBERSHIP_PROXY_URL);
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'is-registered',
          feedId: feedIdBase64,
          userCommitment: userCommitmentBase64,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Membership proxy is-registered failed: ${response.status} ${text}`);
      }

      const payload = await response.json() as {
        success?: boolean;
        isRegistered?: boolean;
      };

      const isRegistered = payload.isRegistered ?? false;
      console.log(`[MembershipService] IsCommitmentRegistered result: ${isRegistered}`);

      debugLog(`[MembershipService] IsCommitmentRegistered result: ${isRegistered}`);

      return { IsRegistered: isRegistered };
    } catch (error) {
      console.error('[MembershipService] IsCommitmentRegistered failed:', error);
      debugError('[MembershipService] IsCommitmentRegistered failed:', error);
      throw error;
    }
  },

  /**
   * Get user's Merkle proof for a feed.
   * Uses the Next.js proxy to avoid unstable direct browser gRPC hops in E2E.
   */
  async getMembershipProof(
    feedIdBase64: string,
    userCommitmentBase64: string
  ): Promise<GetMembershipProofResponse> {
    try {
      debugLog('[MembershipService] GetMembershipProof');
      const requestUrl = buildApiUrl(MEMBERSHIP_PROXY_URL);
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'proof',
          feedId: feedIdBase64,
          userCommitment: userCommitmentBase64,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Membership proxy proof failed: ${response.status} ${text}`);
      }

      const payload = await response.json() as {
        success?: boolean;
        membershipProof?: {
          isMember?: boolean;
          merkleRoot?: string;
          pathElements?: string[];
          pathIndices?: boolean[];
          treeDepth?: number;
          rootBlockHeight?: number;
        };
      };

      const result: GetMembershipProofResponse = {
        IsMember: payload.membershipProof?.isMember ?? false,
        MerkleRoot: payload.membershipProof?.merkleRoot ?? '',
        PathElements: payload.membershipProof?.pathElements ?? [],
        PathIndices: payload.membershipProof?.pathIndices ?? [],
        TreeDepth: payload.membershipProof?.treeDepth ?? 0,
        RootBlockHeight: payload.membershipProof?.rootBlockHeight ?? 0,
      };

      debugLog(`[MembershipService] GetMembershipProof result: isMember=${result.IsMember}`);

      return result;
    } catch (error) {
      debugError('[MembershipService] GetMembershipProof failed:', error);
      throw error;
    }
  },
};
