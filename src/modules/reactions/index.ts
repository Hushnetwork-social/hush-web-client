/**
 * Reactions Module
 *
 * Anonymous reactions with ZK proofs for Protocol Omega.
 */

// Store
export {
  useReactionsStore,
  type EmojiCounts,
  type ReactionEntry,
  type PendingReaction,
  EMPTY_EMOJI_COUNTS,
  getEmojiForIndex,
  getIndexForEmoji,
} from './useReactionsStore';

// Services
export { reactionsServiceInstance } from './ReactionsService';
export { membershipProofManager } from './MembershipProofManager';

// Syncable
export { reactionsSyncable } from './ReactionsSyncable';

// Tally Decryption
export {
  decryptTally,
  decryptTallySync,
  decryptTalliesBatch,
  decryptTallyWithAesKey,
  decryptTalliesBatchWithAesKey,
  type ServerTallyData,
} from './decryptTally';

// Initialization
export {
  initializeReactionsSystem,
  ensureCommitmentRegistered,
  clearRegistrationCache,
  isReactionsInitialized,
} from './initializeReactions';
