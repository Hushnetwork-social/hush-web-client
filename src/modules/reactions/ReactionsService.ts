/**
 * Reactions Service
 *
 * High-level service for submitting and fetching anonymous reactions.
 * Coordinates crypto, ZK proofs, and blockchain transaction submission.
 *
 * IMPORTANT: Reactions are now submitted as blockchain transactions,
 * not directly via gRPC. This ensures reactions are part of the blockchain
 * and can be replayed for data recovery.
 */

import { reactionsService } from '@/lib/grpc/services/reactions'; // For non-critical methods (getBackup, etc.)
import { getTallies as getTalliesBinary } from '@/lib/grpc/services/reactions-binary';
import {
  encryptVector,
  vectorCiphertextToGrpc,
  decrypt,
  bigintToBytes,
  bytesToBigint,
  EMOJIS,
  EMOJI_COUNT,
} from '@/lib/crypto/reactions';
import {
  computeNullifier,
  computeCommitment,
  computeBackupKey,
  uuidToBigint,
} from '@/lib/crypto/reactions/poseidon';
import {
  encryptEmojiBackup,
  decryptEmojiBackup,
  localReactionCache,
} from '@/lib/crypto/reactions/recovery';
import { bsgsManager, solveDiscreteLog } from '@/lib/crypto/reactions/bsgs';
import { generateProof } from '@/lib/zk';
import { circuitManager } from '@/lib/zk/circuitManager';
import { membershipProofManager } from './MembershipProofManager';
import { useReactionsStore, type EmojiCounts, EMPTY_EMOJI_COUNTS } from './useReactionsStore';
import { useAppStore } from '@/stores';
import { createReactionTransaction, hexToBytes } from '@/lib/crypto';
import { submitTransaction } from '@/modules/blockchain/BlockchainService';
import type { CircuitInputs } from '@/lib/zk/types';
import type { Point } from '@/lib/crypto/reactions/babyjubjub';

/**
 * Reactions Service Class
 */
class ReactionsServiceClass {
  /**
   * Submit a reaction to a message as a blockchain transaction
   *
   * @param feedId - The feed UUID
   * @param messageId - The message UUID
   * @param emojiIndex - 0-5 for emoji, 6+ for removal
   * @param feedPublicKey - The feed's public key for encryption
   * @param authorCommitment - The message author's commitment (for author exclusion)
   */
  async submitReaction(
    feedId: string,
    messageId: string,
    emojiIndex: number,
    feedPublicKey: Point,
    authorCommitment: bigint
  ): Promise<string> {
    const store = useReactionsStore.getState();
    const credentials = useAppStore.getState().credentials;

    // Get user secret
    const userSecret = store.getUserSecret();
    if (!userSecret) {
      throw new Error('User secret not set. Please log in.');
    }

    const userCommitment = store.getUserCommitment();
    if (!userCommitment) {
      throw new Error('User commitment not set.');
    }

    // Check signing credentials
    if (!credentials?.signingPrivateKey || !credentials?.signingPublicKey) {
      throw new Error('Signing credentials not available. Please log in.');
    }

    // Set generating proof status
    store.setGeneratingProof(true);

    try {
      // 1. Encrypt emoji as one-hot vector
      const { ciphertext, nonces } = encryptVector(emojiIndex, feedPublicKey);

      // 2. Compute nullifier
      const feedIdBigint = uuidToBigint(feedId);
      const messageIdBigint = uuidToBigint(messageId);
      const nullifier = await computeNullifier(userSecret, messageIdBigint, feedIdBigint);

      // 3. Compute backup for cross-device recovery
      const backupKey = await computeBackupKey(userSecret, messageIdBigint);
      const encryptedBackup = encryptEmojiBackup(emojiIndex, backupKey);

      // 4. Get membership proof
      const membershipProof = await membershipProofManager.getProof(feedId, userCommitment);

      // 5. Generate ZK proof
      const circuitInputs: CircuitInputs = {
        nullifier: nullifier.toString(),
        ciphertext_c1: ciphertext.c1.map((p) => [p.x.toString(), p.y.toString()]),
        ciphertext_c2: ciphertext.c2.map((p) => [p.x.toString(), p.y.toString()]),
        message_id: messageIdBigint.toString(),
        feed_id: feedIdBigint.toString(),
        feed_pk: [feedPublicKey.x.toString(), feedPublicKey.y.toString()],
        members_root: membershipProof.root.toString(),
        author_commitment: authorCommitment.toString(),
        user_secret: userSecret.toString(),
        emoji_index: emojiIndex.toString(),
        encryption_nonces: nonces.map((n) => n.toString()),
        merkle_path: membershipProof.pathElements.map((e) => e.toString()),
        merkle_indices: membershipProof.pathIndices.map((i) => (i ? 1 : 0)),
      };

      const proofResult = await generateProof(circuitInputs);

      // 6. Convert ciphertext to base64 format for blockchain
      const grpcCiphertext = vectorCiphertextToGrpc(ciphertext);

      // 7. Create and sign the blockchain transaction
      const privateKeyBytes = hexToBytes(credentials.signingPrivateKey);
      const { signedTransaction, transactionId } = await createReactionTransaction(
        feedId,
        messageId,
        bigintToBytes(nullifier),
        grpcCiphertext.CiphertextC1,
        grpcCiphertext.CiphertextC2,
        proofResult.proof,
        proofResult.circuitVersion,
        encryptedBackup,
        privateKeyBytes,
        credentials.signingPublicKey
      );

      // 8. Submit to blockchain
      const result = await submitTransaction(signedTransaction);

      if (!result.successful) {
        throw new Error(result.message || 'Failed to submit reaction transaction');
      }

      console.log(`[ReactionsService] Reaction submitted to blockchain, txId=${transactionId}`);

      // 9. Store locally for fast access
      localReactionCache.set(messageId, emojiIndex);

      return transactionId;
    } finally {
      store.setGeneratingProof(false);
    }
  }

  /**
   * Remove a reaction from a message
   */
  async removeReaction(
    feedId: string,
    messageId: string,
    feedPublicKey: Point,
    authorCommitment: bigint
  ): Promise<string> {
    // Emoji index 6 signals removal (zero vector)
    return this.submitReaction(feedId, messageId, 6, feedPublicKey, authorCommitment);
  }

  /**
   * Submit a reaction in DEV MODE (without ZK proof) as a blockchain transaction.
   *
   * WARNING: This bypasses ZK proof verification and should ONLY be used
   * during development when the server has Reactions:DevMode=true.
   *
   * @param feedId - The feed UUID
   * @param messageId - The message UUID
   * @param emojiIndex - 0-5 for emoji, 6+ for removal
   * @param feedPublicKey - The feed's public key for encryption
   */
  async submitReactionDevMode(
    feedId: string,
    messageId: string,
    emojiIndex: number,
    feedPublicKey: Point
  ): Promise<string> {
    const store = useReactionsStore.getState();
    const credentials = useAppStore.getState().credentials;

    // Get user secret
    const userSecret = store.getUserSecret();
    if (!userSecret) {
      throw new Error('User secret not set. Please log in.');
    }

    // Check signing credentials
    if (!credentials?.signingPrivateKey || !credentials?.signingPublicKey) {
      throw new Error('Signing credentials not available. Please log in.');
    }

    console.log(`[ReactionsService] DEV MODE: Submitting reaction for message ${messageId.substring(0, 8)}..., emoji=${emojiIndex}`);

    try {
      // 1. Encrypt emoji as one-hot vector (still needed for homomorphic tally)
      const { ciphertext } = encryptVector(emojiIndex, feedPublicKey);

      // 2. Compute nullifier (still needed for idempotency)
      const feedIdBigint = uuidToBigint(feedId);
      const messageIdBigint = uuidToBigint(messageId);
      const nullifier = await computeNullifier(userSecret, messageIdBigint, feedIdBigint);

      // 3. Compute backup for cross-device recovery
      const backupKey = await computeBackupKey(userSecret, messageIdBigint);
      const encryptedBackup = encryptEmojiBackup(emojiIndex, backupKey);

      // 4. Create a dummy ZK proof (256 bytes of zeros)
      // The server's DevModeVerifier will accept this
      const dummyProof = new Uint8Array(256);

      // 5. Convert ciphertext to base64 format for blockchain
      const grpcCiphertext = vectorCiphertextToGrpc(ciphertext);

      // 6. Create and sign the blockchain transaction
      const privateKeyBytes = hexToBytes(credentials.signingPrivateKey);
      const { signedTransaction, transactionId } = await createReactionTransaction(
        feedId,
        messageId,
        bigintToBytes(nullifier),
        grpcCiphertext.CiphertextC1,
        grpcCiphertext.CiphertextC2,
        dummyProof,
        'dev-mode-v1',
        encryptedBackup,
        privateKeyBytes,
        credentials.signingPublicKey
      );

      // 7. Submit to blockchain
      const result = await submitTransaction(signedTransaction);

      if (!result.successful) {
        throw new Error(result.message || 'Failed to submit reaction transaction');
      }

      console.log(`[ReactionsService] DEV MODE: Reaction submitted to blockchain, txId=${transactionId}`);

      // 8. Store locally for fast access
      localReactionCache.set(messageId, emojiIndex);

      return transactionId;
    } catch (error) {
      console.error('[ReactionsService] DEV MODE: Failed to submit reaction:', error);
      throw error;
    }
  }

  /**
   * Remove a reaction in DEV MODE
   */
  async removeReactionDevMode(
    feedId: string,
    messageId: string,
    feedPublicKey: Point
  ): Promise<string> {
    return this.submitReactionDevMode(feedId, messageId, 6, feedPublicKey);
  }

  /**
   * Fetch and decrypt reaction tallies for messages
   *
   * @param feedId - The feed UUID
   * @param messageIds - List of message UUIDs
   * @param feedPrivateKey - The feed's private key for decryption
   */
  async getTallies(
    feedId: string,
    messageIds: string[],
    feedPrivateKey: bigint
  ): Promise<Map<string, EmojiCounts>> {
    // Ensure BSGS is loaded for decryption
    await bsgsManager.ensureLoaded();

    // Fetch tallies from server using binary gRPC
    const tallies = await getTalliesBinary(feedId, messageIds);

    const results = new Map<string, EmojiCounts>();

    // Decrypt each tally
    for (const tally of tallies) {
      const counts: EmojiCounts = { ...EMPTY_EMOJI_COUNTS };

      // Decrypt each emoji slot
      for (let i = 0; i < EMOJI_COUNT; i++) {
        if (tally.tallyC1[i] && tally.tallyC2[i]) {
          // Convert ECPointBytes to Point
          const c1: Point = {
            x: bytesToBigint(tally.tallyC1[i].x),
            y: bytesToBigint(tally.tallyC1[i].y),
          };
          const c2: Point = {
            x: bytesToBigint(tally.tallyC2[i].x),
            y: bytesToBigint(tally.tallyC2[i].y),
          };
          const decrypted = decrypt({ c1, c2 }, feedPrivateKey);

          // Solve discrete log to get count
          const count = await solveDiscreteLog(decrypted);
          if (count !== null) {
            counts[EMOJIS[i]] = count;
          }
        }
      }

      results.set(tally.messageId, counts);
    }

    // Update store
    const talliesObject: Record<string, EmojiCounts> = {};
    for (const [id, counts] of results) {
      talliesObject[id] = counts;
    }
    useReactionsStore.getState().setTallies(talliesObject);

    return results;
  }

  /**
   * Get user's own reaction for a message (from cache or server)
   */
  async getMyReaction(feedId: string, messageId: string): Promise<number | null> {
    const store = useReactionsStore.getState();
    const userSecret = store.getUserSecret();

    if (!userSecret) {
      return null;
    }

    // Check local cache first
    const cached = localReactionCache.get(messageId);
    if (cached !== undefined) {
      return cached;
    }

    // Check store
    const stored = store.getReaction(messageId);
    if (stored?.myReaction !== null && stored?.myReaction !== undefined) {
      return stored.myReaction;
    }

    // Try to recover from server
    try {
      const feedIdBigint = uuidToBigint(feedId);
      const messageIdBigint = uuidToBigint(messageId);
      const nullifier = await computeNullifier(userSecret, messageIdBigint, feedIdBigint);

      const response = await reactionsService.getReactionBackup({
        Nullifier: btoa(String.fromCharCode(...bigintToBytes(nullifier))),
      });

      if (!response.Exists) {
        return null;
      }

      if (!response.EncryptedEmojiBackup || response.EncryptedEmojiBackup.length === 0) {
        // Legacy reaction without backup
        return -1; // "Reacted" but unknown emoji
      }

      // Decrypt the backup
      const backupKey = await computeBackupKey(userSecret, messageIdBigint);
      const encryptedBytes = this.base64ToBytes(response.EncryptedEmojiBackup);
      const emojiIndex = decryptEmojiBackup(encryptedBytes, backupKey);

      // Cache locally
      localReactionCache.set(messageId, emojiIndex);
      store.setMyReaction(messageId, emojiIndex);

      return emojiIndex;
    } catch (error) {
      console.error('[ReactionsService] Failed to recover reaction:', error);
      return null;
    }
  }

  /**
   * Check if a nullifier exists (user has reacted)
   */
  async checkNullifierExists(
    feedId: string,
    messageId: string,
    userSecret: bigint
  ): Promise<boolean> {
    const feedIdBigint = uuidToBigint(feedId);
    const messageIdBigint = uuidToBigint(messageId);
    const nullifier = await computeNullifier(userSecret, messageIdBigint, feedIdBigint);

    const response = await reactionsService.nullifierExists({
      Nullifier: btoa(String.fromCharCode(...bigintToBytes(nullifier))),
    });

    return response.Exists;
  }

  /**
   * Initialize the reactions system
   */
  async initialize(): Promise<void> {
    const store = useReactionsStore.getState();

    try {
      // Initialize circuit manager and ZK prover
      await circuitManager.initialize();
      store.setProverReady(true);

      // Initialize BSGS table (for decryption)
      await bsgsManager.ensureLoaded();
      store.setBsgsReady(true);

      console.log('[ReactionsService] Initialized');
    } catch (error) {
      console.error('[ReactionsService] Failed to initialize:', error);
      store.setError('Failed to initialize reactions system');
    }
  }

  /**
   * Set user credentials for reactions
   */
  async setUserCredentials(userSecret: bigint): Promise<void> {
    const store = useReactionsStore.getState();
    store.setUserSecret(userSecret);

    // Compute commitment
    const commitment = await computeCommitment(userSecret);
    store.setUserCommitment(commitment);

    console.log('[ReactionsService] User credentials set');
  }

  // ============= Helper Methods =============

  /**
   * Convert UUID string to bytes in .NET GUID format.
   * .NET GUIDs use mixed-endian: first 4 bytes little-endian, next 2 little-endian,
   * next 2 little-endian, remaining 8 bytes big-endian.
   * Example: "7a23cf83-f727-4831-bc93-b5b6e0185bcb"
   * Standard hex: 7a23cf83 f727 4831 bc93 b5b6e0185bcb
   * .NET bytes:   83cf237a 27f7 3148 bc93 b5b6e0185bcb
   */
  private uuidToBytes(uuid: string): Uint8Array {
    const parts = uuid.split('-');
    const bytes = new Uint8Array(16);

    // Part 1: 4 bytes, little-endian (reverse)
    const p1 = parts[0];
    bytes[0] = parseInt(p1.substring(6, 8), 16);
    bytes[1] = parseInt(p1.substring(4, 6), 16);
    bytes[2] = parseInt(p1.substring(2, 4), 16);
    bytes[3] = parseInt(p1.substring(0, 2), 16);

    // Part 2: 2 bytes, little-endian (reverse)
    const p2 = parts[1];
    bytes[4] = parseInt(p2.substring(2, 4), 16);
    bytes[5] = parseInt(p2.substring(0, 2), 16);

    // Part 3: 2 bytes, little-endian (reverse)
    const p3 = parts[2];
    bytes[6] = parseInt(p3.substring(2, 4), 16);
    bytes[7] = parseInt(p3.substring(0, 2), 16);

    // Part 4: 2 bytes, big-endian (as-is)
    const p4 = parts[3];
    bytes[8] = parseInt(p4.substring(0, 2), 16);
    bytes[9] = parseInt(p4.substring(2, 4), 16);

    // Part 5: 6 bytes, big-endian (as-is)
    const p5 = parts[4];
    bytes[10] = parseInt(p5.substring(0, 2), 16);
    bytes[11] = parseInt(p5.substring(2, 4), 16);
    bytes[12] = parseInt(p5.substring(4, 6), 16);
    bytes[13] = parseInt(p5.substring(6, 8), 16);
    bytes[14] = parseInt(p5.substring(8, 10), 16);
    bytes[15] = parseInt(p5.substring(10, 12), 16);

    return bytes;
  }

  /**
   * Convert bytes from .NET GUID format to UUID string.
   * Reverses the mixed-endian format used by .NET.
   */
  private bytesToUuid(bytes: Uint8Array): string {
    // Part 1: bytes 0-3, reverse (little-endian to big-endian)
    const p1 = [bytes[3], bytes[2], bytes[1], bytes[0]]
      .map(b => b.toString(16).padStart(2, '0')).join('');

    // Part 2: bytes 4-5, reverse
    const p2 = [bytes[5], bytes[4]]
      .map(b => b.toString(16).padStart(2, '0')).join('');

    // Part 3: bytes 6-7, reverse
    const p3 = [bytes[7], bytes[6]]
      .map(b => b.toString(16).padStart(2, '0')).join('');

    // Part 4: bytes 8-9, as-is (big-endian)
    const p4 = [bytes[8], bytes[9]]
      .map(b => b.toString(16).padStart(2, '0')).join('');

    // Part 5: bytes 10-15, as-is (big-endian)
    const p5 = [bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]]
      .map(b => b.toString(16).padStart(2, '0')).join('');

    return `${p1}-${p2}-${p3}-${p4}-${p5}`;
  }

  private base64ToBytes(base64: string): Uint8Array {
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
  }
}

// Singleton instance
export const reactionsServiceInstance = new ReactionsServiceClass();
