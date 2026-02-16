// Crypto module exports

export {
  generateMnemonic,
  validateMnemonic,
  deriveKeysFromMnemonic,
  signData,
  verifySignature,
  bytesToHex,
  hexToBytes,
  bytesToBase64,
  base64ToBytes,
  type KeyPair,
  type DerivedKeys,
} from './keys';

export {
  // Constants
  PAYLOAD_GUIDS,
  FEED_TYPES,
  // Utility functions
  generateGuid,
  // Transaction creation
  createUnsignedTransaction,
  // Transaction signing
  signByUser,
  // Payload factory functions
  createIdentityPayload,
  createPersonalFeedPayload,
  // High-level transaction functions
  createIdentityTransaction,
  createUpdateIdentityTransaction,
  createPersonalFeedTransaction,
  createFeedMessageTransaction,
  createChatFeedTransaction,
  createReactionTransaction,
  // Types
  type SignatureInfo,
  type UnsignedTransaction,
  type SignedTransaction,
  type SigningCredentials,
  type FullIdentityPayload,
  type UpdateIdentityPayload,
  type NewPersonalFeedPayload,
  type NewFeedMessagePayload,
  type ChatFeedParticipant,
  type NewChatFeedPayload,
  type NewReactionPayload,
  type AttachmentRefPayload,
} from './transactions';

export {
  generateAesKey,
  eciesEncrypt,
  eciesDecrypt,
  aesEncrypt,
  aesDecrypt,
  aesEncryptBytes,
  aesDecryptBytes,
} from './encryption';

export {
  exportToEncryptedBytes,
  importFromEncryptedBytes,
  downloadCredentialsFile,
  type PortableCredentials,
} from './credentialsFile';
