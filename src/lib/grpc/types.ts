// gRPC Service Types - matching proto definitions

// Common response structure
export interface GrpcResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============= Blockchain Service Types =============

export interface GetBlockchainHeightRequest {}

export interface GetBlockchainHeightReply {
  Index: number;
}

export interface SubmitSignedTransactionRequest {
  SignedTransaction: string;
}

export interface SubmitSignedTransactionReply {
  Successfull: boolean;
  Message: string;
}

// ============= Identity Service Types =============

export interface GetIdentityRequest {
  PublicSigningAddress: string;
}

export interface GetIdentityReply {
  Successfull: boolean;
  Message: string;
  ProfileName: string;
  PublicSigningAddress: string;
  PublicEncryptAddress: string;
  IsPublic: boolean;
}

export interface SearchByDisplayNameRequest {
  PartialDisplayName: string;
}

export interface Identity {
  DisplayName: string;
  PublicSigningAddress: string;
  PublicEncryptAddress: string;
}

export interface SearchByDisplayNameReply {
  Identities: Identity[];
}

// ============= Bank Service Types =============

export interface GetAddressBalanceRequest {
  Token: string;
  Address: string;
}

export interface GetAddressBalanceReply {
  Balance: string;
}

export interface TransferFundsRequest {
  Id: string;
  FeedId: string;
  Token: string;
  FromAddress: string;
  ToAddress: string;
  Amount: string;
  Hash: string;
  Signature: string;
  FeedPublicEncriptAddress: string;
}

export interface TransferFundsReply {
  Successfull: boolean;
  Message: string;
}

export interface NftMetadata {
  Key: string;
  Value: string;
}

export interface NftEntity {
  NonFugibleTokenId: string;
  PublicOwneAddress: string;
  Title: string;
  Description: string;
  NonFugibleTokenType: string;
  EncryptedContent: boolean;
  BlockIndex: number;
  Metadata: NftMetadata[];
}

export interface GetNftsByAddressRequest {
  Address: string;
  BlockIndex: number;
}

export interface GetNftsByAddressReply {
  Nfts: NftEntity[];
}

export interface MintNFTRequest {
  NonFugibleTokenId: string;
  PublicOwneAddress: string;
  Title: string;
  Description: string;
  NonFugibleTokenType: string;
  EncryptedContent: boolean;
  Hash: string;
  Signature: string;
  Metadata: NftMetadata[];
}

export interface MintNFTReply {
  Successfull: boolean;
  Message: string;
}

// ============= Feed Service Types =============

export interface HasPersonalFeedRequest {
  PublicPublicKey: string;
}

export interface HasPersonalFeedReply {
  FeedAvailable: boolean;
}

export interface IsFeedInBlockchainRequest {
  FeedId: string;
}

export interface IsFeedInBlockchainReply {
  FeedAvailable: boolean;
}

export interface FeedParticipant {
  FeedId: string;
  ParticipantPublicAddress: string;
  ParticipantType: number;
  EncryptedFeedKey: string;
}

export interface FeedEntity {
  FeedId: string;
  FeedTitle: string;
  FeedOWner: string;
  FeedType: number;
  BlockIndex: number;
  FeedParticipants: FeedParticipant[];
}

export interface GetFeedForAddressRequest {
  ProfilePublicKey: string;
  BlockIndex: number;
}

export interface GetFeedForAddressReply {
  Feeds: FeedEntity[];
}

export interface FeedMessageEntity {
  FeedId: string;
  FeedMessageId: string;
  MessageContent: string;
  IssuerPublicAddress: string;
  IssuerName: string;
  TimeStamp: { seconds: number; nanos: number };
  BlockIndex: number;
}

export interface GetFeedMessagesForAddressRequest {
  ProfilePublicKey: string;
  BlockIndex: number;
  LastReactionTallyVersion: number;  // Only return tallies newer than this version
}

// Reaction tally returned with feed messages (Protocol Omega)
export interface MessageReactionTallyEntity {
  MessageId: string;
  TallyC1: ECPoint[];    // 6 aggregated C1 points
  TallyC2: ECPoint[];    // 6 aggregated C2 points
  TallyVersion: number;  // Monotonic counter for cache invalidation
  ReactionCount: number; // Total reactions (for quick "has reactions" check)
}

export interface GetFeedMessagesForAddressReply {
  Messages: FeedMessageEntity[];
  ReactionTallies: MessageReactionTallyEntity[];  // Tallies for messages with reactions
  MaxReactionTallyVersion: number;                 // For incremental sync
}

// ============= Feed Type Enum =============

export enum FeedType {
  Personal = 0,
  Chat = 1,
  Group = 2,
  Broadcast = 3,
}

export enum ParticipantType {
  Owner = 0,
  Participant = 1,
  Admin = 2,
}

// ============= Notification Service Types =============

export enum EventType {
  Unspecified = 0,
  NewMessage = 1,
  MessagesRead = 2,
  UnreadCountSync = 3,
}

export interface SubscribeToEventsRequest {
  UserId: string;
  DeviceId?: string;
  Platform?: string;
}

export interface FeedEvent {
  Type: EventType;
  FeedId: string;
  SenderName?: string;
  MessagePreview?: string;
  UnreadCount: number;
  AllCounts?: Record<string, number>;
  TimestampUnixMs: number;
}

export interface MarkFeedAsReadRequest {
  UserId: string;
  FeedId: string;
}

export interface MarkFeedAsReadReply {
  Success: boolean;
}

export interface GetUnreadCountsRequest {
  UserId: string;
}

export interface GetUnreadCountsReply {
  Counts: Record<string, number>;
}

// ============= Reactions Service Types =============

// Elliptic curve point (Baby JubJub)
export interface ECPoint {
  X: string;  // Base64 encoded 32 bytes (big-endian)
  Y: string;  // Base64 encoded 32 bytes (big-endian)
}

// Submit Reaction
export interface SubmitReactionRequest {
  FeedId: string;                    // Base64 encoded 16 bytes (UUID)
  MessageId: string;                 // Base64 encoded 16 bytes (UUID)
  Nullifier: string;                 // Base64 encoded 32 bytes (Poseidon hash)
  CiphertextC1: ECPoint[];           // 6 points (one per emoji)
  CiphertextC2: ECPoint[];           // 6 points (one per emoji)
  ZkProof: string;                   // Base64 encoded ~256 bytes (Groth16 proof)
  EncryptedEmojiBackup: string;      // Base64 encoded ~32 bytes
  CircuitVersion: string;            // e.g., "omega-v1.0.0"
}

export interface SubmitReactionResponse {
  Success: boolean;
  ErrorMessage: string;
  TransactionId: string;             // Base64 encoded 16 bytes (UUID)
}

// Get Tallies
export interface GetTalliesRequest {
  FeedId: string;                    // Base64 encoded 16 bytes (UUID)
  MessageIds: string[];              // List of Base64 encoded message UUIDs
}

export interface MessageTally {
  MessageId: string;                 // Base64 encoded 16 bytes (UUID)
  TallyC1: ECPoint[];                // 6 aggregated C1 points
  TallyC2: ECPoint[];                // 6 aggregated C2 points
  TotalCount: number;                // Total reactions (quick stat)
}

export interface GetTalliesResponse {
  Tallies: MessageTally[];
}

// Nullifier Check
export interface NullifierExistsRequest {
  Nullifier: string;                 // Base64 encoded 32 bytes
}

export interface NullifierExistsResponse {
  Exists: boolean;
}

// Cross-Device Recovery
export interface GetReactionBackupRequest {
  Nullifier: string;                 // Base64 encoded 32 bytes
}

export interface GetReactionBackupResponse {
  Exists: boolean;
  EncryptedEmojiBackup: string;      // Base64 encoded (empty if legacy)
}

// ============= Membership Service Types =============

// Get Membership Proof
export interface GetMembershipProofRequest {
  FeedId: string;                    // Base64 encoded 16 bytes (UUID)
  UserCommitment: string;            // Base64 encoded 32 bytes - Poseidon(user_secret)
}

export interface GetMembershipProofResponse {
  IsMember: boolean;
  MerkleRoot: string;                // Base64 encoded 32 bytes
  PathElements: string[];            // Array of Base64 encoded 32-byte sibling hashes
  PathIndices: boolean[];            // Left(false)/Right(true) indicators
  TreeDepth: number;                 // Tree depth (typically 20)
  RootBlockHeight: number;           // Block height when root was computed
}

// Get Recent Merkle Roots
export interface GetRecentRootsRequest {
  FeedId: string;                    // Base64 encoded 16 bytes (UUID)
  Count: number;                     // How many recent roots (default: 3, max: 10)
}

export interface MerkleRootInfo {
  Root: string;                      // Base64 encoded 32 bytes
  BlockHeight: number;
  Timestamp: number;                 // Unix timestamp in milliseconds
}

export interface GetRecentRootsResponse {
  Roots: MerkleRootInfo[];
}

// Commitment Registration
export interface RegisterCommitmentRequest {
  FeedId: string;                    // Base64 encoded 16 bytes (UUID)
  UserCommitment: string;            // Base64 encoded 32 bytes - Poseidon(user_secret)
}

export interface RegisterCommitmentResponse {
  Success: boolean;
  NewMerkleRoot: string;             // Base64 encoded 32 bytes
  AlreadyRegistered: boolean;
}

export interface IsCommitmentRegisteredRequest {
  FeedId: string;                    // Base64 encoded 16 bytes (UUID)
  UserCommitment: string;            // Base64 encoded 32 bytes
}

export interface IsCommitmentRegisteredResponse {
  IsRegistered: boolean;
}
