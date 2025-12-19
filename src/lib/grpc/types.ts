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
}

export interface GetFeedMessagesForAddressReply {
  Messages: FeedMessageEntity[];
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
