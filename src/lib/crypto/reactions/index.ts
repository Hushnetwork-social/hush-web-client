/**
 * Protocol Omega Crypto Module
 *
 * Cryptographic primitives for anonymous reactions.
 */

// Constants
export {
  BABYJUBJUB,
  IDENTITY,
  EMOJI_COUNT,
  EMOJIS,
  DOMAIN_SEPARATORS,
  CIRCUIT,
  BSGS,
  type EmojiType,
} from './constants';

// Baby JubJub curve operations
export {
  type Point,
  isIdentity,
  isOnCurve,
  addPoints,
  negatePoint,
  subPoints,
  doublePoint,
  scalarMul,
  getGenerator,
  getIdentity,
  pointToKey,
  keyToPoint,
  pointToBytes,
  bytesToPoint,
  bigintToBytes,
  bytesToBigint,
  pointToBase64,
  base64ToPoint,
  randomScalar,
} from './babyjubjub';

// Poseidon hash
export {
  poseidonHash,
  poseidonHashSync,
  computeCommitment,
  computeNullifier,
  computeBackupKey,
  uuidToBigint,
  bigintToUuid,
  deriveFeedElGamalKey,
} from './poseidon';

// ElGamal encryption
export {
  type Ciphertext,
  type VectorCiphertext,
  encrypt,
  encryptVector,
  decrypt,
  addCiphertexts,
  subCiphertexts,
  encryptZero,
  isZeroCiphertext,
  vectorCiphertextToGrpc,
  grpcToVectorCiphertext,
  grpcToCiphertext,
} from './elgamal';

// BSGS discrete log solver
export {
  bsgsManager,
  solveDiscreteLog,
} from './bsgs';

// Tally decryption
export {
  decryptReactionTally,
  initializeBsgs,
  isBsgsReady,
  type DecryptedEmojiCounts,
  EMPTY_DECRYPTED_COUNTS,
} from './decryptTally';

// Cross-device recovery
export {
  encryptEmojiBackup,
  decryptEmojiBackup,
  deriveReactionSecret,
  localReactionCache,
  LocalReactionCache,
} from './recovery';
