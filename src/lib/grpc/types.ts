// gRPC Service Types - matching proto definitions

// Common response structure
export interface GrpcResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============= Blockchain Service Types =============

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GetBlockchainHeightRequest {}

export interface GetBlockchainHeightReply {
  Index: number;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GetElectionEnvelopeContextRequest {}

export interface GetElectionEnvelopeContextReply {
  NodePublicEncryptAddress: string;
  ElectionEnvelopeVersion: string;
}

export interface SubmitSignedTransactionRequest {
  SignedTransaction: string;
}

/**
 * FEAT-057: Transaction status for idempotency responses
 */
export enum TransactionStatus {
  UNSPECIFIED = 0,      // Default for backward compatibility
  ACCEPTED = 1,         // New transaction accepted
  ALREADY_EXISTS = 2,   // Duplicate found in database (already confirmed)
  PENDING = 3,          // Duplicate found in MemPool (still pending)
  REJECTED = 4,         // Transaction validation failed
}

export interface SubmitSignedTransactionReply {
  Successfull: boolean;
  Message: string;
  Status?: TransactionStatus;  // FEAT-057: Idempotency status
  ValidationCode?: string;
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

// FEAT-066: Attachment metadata reference from proto AttachmentRef
export interface AttachmentRefEntity {
  Id: string;
  Hash: string;
  MimeType: string;
  Size: number;
  FileName: string;
}

export interface FeedMessageEntity {
  FeedId: string;
  FeedMessageId: string;
  MessageContent: string;
  IssuerPublicAddress: string;
  IssuerName: string;
  AuthorCommitment?: string;
  TimeStamp: { seconds: number; nanos: number };
  BlockIndex: number;
  ReplyToMessageId?: string;  // Reply to Message: parent message reference
  KeyGeneration?: number;     // FEAT-056: Key generation used to encrypt group messages
  Attachments?: AttachmentRefEntity[];  // FEAT-066: Attachment metadata references
}

export interface GetFeedMessagesForAddressRequest {
  ProfilePublicKey: string;
  BlockIndex: number;
  LastReactionTallyVersion: number;  // Only return tallies newer than this version
  // FEAT-052: Server pagination support
  Limit?: number;                    // Max messages to return (default 100)
  FetchLatest?: boolean;             // Get latest N messages (forward pagination)
  BeforeBlockIndex?: number;         // Get messages before this block (backward pagination)
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
  // FEAT-052: Server pagination support
  HasMoreMessages?: boolean;                       // True if older messages exist
  OldestBlockIndex?: number;                       // Block index of oldest returned message
}

// FEAT-056: GetMessageById - Fetch single message for reply preview
export interface GetMessageByIdRequest {
  FeedId: string;       // Feed containing the message
  MessageId: string;    // ID of the message to retrieve
}

export interface GetMessageByIdResponse {
  Success: boolean;                    // True if message found and accessible
  Message?: FeedMessageEntity;         // The message (undefined if not found)
  Error?: string;                      // Error message if not found
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

// ============= URL Metadata Service Types =============

// Get single URL metadata
export interface GetUrlMetadataRequest {
  Url: string;
}

export interface GetUrlMetadataResponse {
  Success: boolean;
  Title: string;
  Description: string;
  ImageUrl: string;
  ImageBase64: string;
  Domain: string;
  ErrorMessage: string;
}

// Get batch URL metadata
export interface GetUrlMetadataBatchRequest {
  Urls: string[];
}

export interface UrlMetadataResult {
  Url: string;
  Success: boolean;
  Title: string;
  Description: string;
  ImageUrl: string;
  ImageBase64: string;
  Domain: string;
  ErrorMessage: string;
}

export interface GetUrlMetadataBatchResponse {
  Results: UrlMetadataResult[];
}

// ============= Group Feed Service Types =============

// Participant in a group feed creation request
export interface GroupFeedParticipantProto {
  FeedId: string;
  ParticipantPublicAddress: string;
  ParticipantType: number;
  EncryptedFeedKey: string;
  KeyGeneration: number;
}

// Member info from query responses
export interface GroupFeedMemberProto {
  PublicAddress: string;
  ParticipantType: number;
  JoinedAtBlock: number;
}

// Create Group Feed
export interface NewGroupFeedRequest {
  FeedId: string;
  Title: string;
  Description: string;
  IsPublic: boolean;
  Participants: GroupFeedParticipantProto[];
}

export interface NewGroupFeedResponse {
  Success: boolean;
  Message: string;
}

// Join Group Feed
export interface JoinGroupFeedRequest {
  FeedId: string;
  JoiningUserPublicAddress: string;
  InvitationSignature?: string;
}

export interface JoinGroupFeedResponse {
  Success: boolean;
  Message: string;
}

// Leave Group Feed
export interface LeaveGroupFeedRequest {
  FeedId: string;
  LeavingUserPublicAddress: string;
}

export interface LeaveGroupFeedResponse {
  Success: boolean;
  Message: string;
}

// Add Member to Group
export interface AddMemberToGroupFeedRequest {
  FeedId: string;
  AdminPublicAddress: string;
  NewMemberPublicAddress: string;
  NewMemberPublicEncryptKey: string;
}

export interface AddMemberToGroupFeedResponse {
  Success: boolean;
  Message: string;
}

// Block Member
export interface BlockMemberRequest {
  FeedId: string;
  AdminPublicAddress: string;
  BlockedUserPublicAddress: string;
  Reason?: string;
}

export interface BlockMemberResponse {
  Success: boolean;
  Message: string;
}

// Unblock Member
export interface UnblockMemberRequest {
  FeedId: string;
  AdminPublicAddress: string;
  UnblockedUserPublicAddress: string;
}

export interface UnblockMemberResponse {
  Success: boolean;
  Message: string;
}

// Ban Member
export interface BanFromGroupFeedRequest {
  FeedId: string;
  AdminPublicAddress: string;
  BannedUserPublicAddress: string;
  Reason?: string;
}

export interface BanFromGroupFeedResponse {
  Success: boolean;
  Message: string;
}

// Unban Member
export interface UnbanFromGroupFeedRequest {
  FeedId: string;
  AdminPublicAddress: string;
  UnbannedUserPublicAddress: string;
}

export interface UnbanFromGroupFeedResponse {
  Success: boolean;
  Message: string;
}

// Promote to Admin
export interface PromoteToAdminRequest {
  FeedId: string;
  AdminPublicAddress: string;
  MemberPublicAddress: string;
}

export interface PromoteToAdminResponse {
  Success: boolean;
  Message: string;
}

// Update Group Title
export interface UpdateGroupFeedTitleRequest {
  FeedId: string;
  AdminPublicAddress: string;
  NewTitle: string;
}

export interface UpdateGroupFeedTitleResponse {
  Success: boolean;
  Message: string;
}

// Update Group Description
export interface UpdateGroupFeedDescriptionRequest {
  FeedId: string;
  AdminPublicAddress: string;
  NewDescription: string;
}

export interface UpdateGroupFeedDescriptionResponse {
  Success: boolean;
  Message: string;
}

// Delete Group Feed
export interface DeleteGroupFeedRequest {
  FeedId: string;
  AdminPublicAddress: string;
}

export interface DeleteGroupFeedResponse {
  Success: boolean;
  Message: string;
}

// Get Group Feed Info
export interface GetGroupFeedRequest {
  FeedId: string;
}

export interface GetGroupFeedResponse {
  Success?: boolean;
  Message?: string;
  FeedId: string;
  Title: string;
  Description: string;
  IsPublic: boolean;
  MemberCount: number;
  CurrentKeyGeneration: number;
  InviteCode?: string;  // Unique invite code for public groups
}

// Get Group Feed by Invite Code
export interface GetGroupFeedByInviteCodeRequest {
  InviteCode: string;
}

export interface GetGroupFeedByInviteCodeResponse {
  Success: boolean;
  Message: string;
  FeedId: string;
  Title: string;
  Description: string;
  IsPublic: boolean;
  MemberCount: number;
}

// Get Group Members
export interface GetGroupMembersRequest {
  FeedId: string;
}

export interface GetGroupMembersResponse {
  Members: GroupFeedMemberProto[];
}

// Get KeyGenerations for a user
export interface GetKeyGenerationsRequest {
  FeedId: string;
  UserPublicAddress: string;
}

export interface KeyGenerationProto {
  KeyGeneration: number;
  EncryptedKey: string;
  ValidFromBlock: number;
  ValidToBlock?: number;
}

export interface GetKeyGenerationsResponse {
  KeyGenerations: KeyGenerationProto[];
}

// Search Public Groups
export interface SearchPublicGroupsRequest {
  SearchQuery: string;
  MaxResults: number;
}

export interface PublicGroupInfoProto {
  FeedId: string;
  Title: string;
  Description: string;
  MemberCount: number;
  CreatedAtBlock: number;
}

export interface SearchPublicGroupsResponse {
  Success: boolean;
  Message: string;
  Groups: PublicGroupInfoProto[];
}

// ============= Elections Service Types =============

export interface GrpcTimestamp {
  seconds: number;
  nanos: number;
}

export enum ElectionLifecycleStateProto {
  Draft = 0,
  Open = 1,
  Closed = 2,
  Finalized = 3,
}

export enum ElectionClassProto {
  OrganizationalRemoteVoting = 0,
  PrivatePoll = 1,
  SeriousSecretBallotVoting = 2,
}

export enum ElectionBindingStatusProto {
  Binding = 0,
  NonBinding = 1,
}

export enum ElectionGovernanceModeProto {
  AdminOnly = 0,
  TrusteeThreshold = 1,
}

export enum ElectionDisclosureModeProto {
  FinalResultsOnly = 0,
  SeparatedParticipationAndResultReports = 1,
  SeparatedParticipationAndPlaintextBallotReports = 2,
}

export enum ParticipationPrivacyModeProto {
  PublicCheckoffAnonymousBallotPrivateChoice = 0,
}

export enum VoteUpdatePolicyProto {
  SingleSubmissionOnly = 0,
  LatestValidVoteWins = 1,
}

export enum EligibilitySourceTypeProto {
  OrganizationImportedRoster = 0,
}

export enum ElectionRosterContactTypeProto {
  RosterContactEmail = 0,
  RosterContactPhone = 1,
}

export enum ElectionVoterLinkStatusProto {
  VoterLinkUnlinked = 0,
  VoterLinkLinked = 1,
}

export enum ElectionVotingRightStatusProto {
  VotingRightInactive = 0,
  VotingRightActive = 1,
}

export enum ElectionParticipationStatusProto {
  ParticipationDidNotVote = 0,
  ParticipationCountedAsVoted = 1,
  ParticipationBlank = 2,
}

export enum ElectionEligibilityActivationOutcomeProto {
  EligibilityActivationSucceeded = 0,
  EligibilityActivationBlocked = 1,
}

export enum ElectionEligibilityActivationBlockReasonProto {
  EligibilityActivationBlockReasonNone = 0,
  EligibilityActivationBlockReasonRosterEntryNotFound = 1,
  EligibilityActivationBlockReasonNotRosteredAtOpen = 2,
  EligibilityActivationBlockReasonAlreadyActive = 3,
  EligibilityActivationBlockReasonPolicyDisallowsLateActivation = 4,
  EligibilityActivationBlockReasonElectionNotOpen = 5,
  EligibilityActivationBlockReasonNotLinkedToHushAccount = 6,
}

export enum ElectionCommitmentRegistrationFailureReasonProto {
  CommitmentRegistrationFailureReasonNone = 0,
  CommitmentRegistrationFailureReasonValidationFailed = 1,
  CommitmentRegistrationFailureReasonNotFound = 2,
  CommitmentRegistrationFailureReasonNotLinked = 3,
  CommitmentRegistrationFailureReasonNotActive = 4,
  CommitmentRegistrationFailureReasonAlreadyRegistered = 5,
  CommitmentRegistrationFailureReasonElectionNotOpenableForRegistration = 6,
  CommitmentRegistrationFailureReasonClosePersisted = 7,
}

export enum ElectionCastAcceptanceFailureReasonProto {
  CastAcceptanceFailureReasonNone = 0,
  CastAcceptanceFailureReasonValidationFailed = 1,
  CastAcceptanceFailureReasonNotFound = 2,
  CastAcceptanceFailureReasonNotLinked = 3,
  CastAcceptanceFailureReasonNotActive = 4,
  CastAcceptanceFailureReasonCommitmentMissing = 5,
  CastAcceptanceFailureReasonStillProcessing = 6,
  CastAcceptanceFailureReasonAlreadyUsed = 7,
  CastAcceptanceFailureReasonDuplicateNullifier = 8,
  CastAcceptanceFailureReasonWrongElectionContext = 9,
  CastAcceptanceFailureReasonClosePersisted = 10,
  CastAcceptanceFailureReasonAlreadyVoted = 11,
}

export enum ElectionVotingSubmissionStatusProto {
  VotingSubmissionStatusNone = 0,
  VotingSubmissionStatusStillProcessing = 1,
  VotingSubmissionStatusAlreadyUsed = 2,
}

export enum ElectionEligibilitySnapshotTypeProto {
  EligibilitySnapshotOpen = 0,
  EligibilitySnapshotClose = 1,
}

export enum EligibilityMutationPolicyProto {
  FrozenAtOpen = 0,
  LateActivationForRosteredVotersOnly = 1,
}

export enum OutcomeRuleKindProto {
  SingleWinner = 0,
  PassFail = 1,
  TopN = 2,
}

export enum ReportingPolicyProto {
  DefaultPhaseOnePackage = 0,
}

export enum ReviewWindowPolicyProto {
  NoReviewWindow = 0,
  GovernedReviewWindowReserved = 1,
}

export enum OfficialResultVisibilityPolicyProto {
  ParticipantEncryptedOnly = 0,
  PublicPlaintext = 1,
}

export enum ElectionReportPackageStatusProto {
  ReportPackageGenerationFailed = 0,
  ReportPackageSealed = 1,
}

export enum ElectionReportArtifactKindProto {
  ReportArtifactHumanManifest = 0,
  ReportArtifactHumanResultReport = 1,
  ReportArtifactHumanNamedParticipationRoster = 2,
  ReportArtifactHumanAuditProvenanceReport = 3,
  ReportArtifactHumanOutcomeDetermination = 4,
  ReportArtifactHumanDisputeReviewIndex = 5,
  ReportArtifactMachineManifest = 6,
  ReportArtifactMachineEvidenceGraph = 7,
  ReportArtifactMachineResultReportProjection = 8,
  ReportArtifactMachineNamedParticipationRosterProjection = 9,
  ReportArtifactMachineAuditProvenanceReportProjection = 10,
  ReportArtifactMachineOutcomeDeterminationProjection = 11,
  ReportArtifactMachineDisputeReviewIndexProjection = 12,
}

export enum ElectionReportArtifactFormatProto {
  ReportArtifactMarkdown = 0,
  ReportArtifactJson = 1,
}

export enum ElectionReportArtifactAccessScopeProto {
  ReportArtifactOwnerAuditorOnly = 0,
  ReportArtifactOwnerAuditorTrustee = 1,
}

export enum ElectionReportAccessGrantRoleProto {
  ReportAccessGrantDesignatedAuditor = 0,
}

export enum ElectionClosedProgressStatusProto {
  ClosedProgressNone = 0,
  ClosedProgressWaitingForTrusteeShares = 1,
  ClosedProgressTallyCalculationInProgress = 2,
}

export enum ElectionBoundaryArtifactTypeProto {
  OpenArtifact = 0,
  CloseArtifact = 1,
  TallyReadyArtifact = 2,
  FinalizeArtifact = 3,
}

export enum ElectionWarningCodeProto {
  LowAnonymitySet = 0,
  AllTrusteesRequiredFragility = 1,
}

export enum ElectionTrusteeInvitationStatusProto {
  Pending = 0,
  Accepted = 1,
  Rejected = 2,
  Revoked = 3,
}

export enum ElectionGovernedActionTypeProto {
  Open = 0,
  Close = 1,
  Finalize = 2,
}

export enum ElectionGovernedProposalExecutionStatusProto {
  WaitingForApprovals = 0,
  ExecutionSucceeded = 1,
  ExecutionFailed = 2,
}

export enum ElectionCommandErrorCodeProto {
  None = 0,
  NotFound = 1,
  Forbidden = 2,
  InvalidState = 3,
  ValidationFailed = 4,
  DependencyBlocked = 5,
  Conflict = 6,
  NotSupported = 7,
}

export enum ElectionCeremonyVersionStatusProto {
  CeremonyVersionInProgress = 0,
  CeremonyVersionReady = 1,
  CeremonyVersionSuperseded = 2,
}

export enum ElectionCeremonyTranscriptEventTypeProto {
  CeremonyEventVersionStarted = 0,
  CeremonyEventTrusteeTransportKeyPublished = 1,
  CeremonyEventTrusteeJoined = 2,
  CeremonyEventTrusteeSelfTestSucceeded = 3,
  CeremonyEventTrusteeMaterialSubmitted = 4,
  CeremonyEventTrusteeValidationFailed = 5,
  CeremonyEventTrusteeCompleted = 6,
  CeremonyEventTrusteeRemoved = 7,
  CeremonyEventVersionReady = 8,
  CeremonyEventVersionSuperseded = 9,
}

export enum ElectionTrusteeCeremonyStateProto {
  CeremonyStateInvited = 0,
  CeremonyStateAcceptedTrustee = 1,
  CeremonyStateNotStarted = 2,
  CeremonyStateJoined = 3,
  CeremonyStateMaterialSubmitted = 4,
  CeremonyStateValidationFailed = 5,
  CeremonyStateCompleted = 6,
  CeremonyStateRemoved = 7,
}

export enum ElectionCeremonyShareCustodyStatusProto {
  ShareCustodyNotExported = 0,
  ShareCustodyExported = 1,
  ShareCustodyImported = 2,
  ShareCustodyImportFailed = 3,
}

export enum ElectionCeremonyActorRoleProto {
  CeremonyActorUnknown = 0,
  CeremonyActorOwner = 1,
  CeremonyActorTrustee = 2,
  CeremonyActorReadOnly = 3,
}

export enum ElectionCeremonyActionTypeProto {
  CeremonyActionUnknown = 0,
  CeremonyActionStartVersion = 1,
  CeremonyActionRestartVersion = 2,
  CeremonyActionPublishTransportKey = 3,
  CeremonyActionJoinVersion = 4,
  CeremonyActionRunSelfTest = 5,
  CeremonyActionSubmitMaterial = 6,
  CeremonyActionExportShare = 7,
  CeremonyActionImportShare = 8,
}

export enum ElectionFinalizationSessionStatusProto {
  FinalizationSessionAwaitingShares = 0,
  FinalizationSessionCompleted = 1,
}

export enum ElectionFinalizationSessionPurposeProto {
  FinalizationSessionPurposeCloseCounting = 0,
  FinalizationSessionPurposeFinalize = 1,
}

export enum ElectionFinalizationShareStatusProto {
  FinalizationShareAccepted = 0,
  FinalizationShareRejected = 1,
}

export enum ElectionFinalizationTargetTypeProto {
  FinalizationTargetAggregateTally = 0,
  FinalizationTargetSingleBallot = 1,
}

export enum ElectionFinalizationReleaseModeProto {
  FinalizationReleaseAggregateTallyOnly = 0,
}

export enum ElectionResultArtifactKindProto {
  ElectionResultArtifactUnofficial = 0,
  ElectionResultArtifactOfficial = 1,
}

export enum ElectionResultArtifactVisibilityProto {
  ElectionResultArtifactParticipantEncrypted = 0,
  ElectionResultArtifactPublicPlaintext = 1,
}

export interface ApprovedClientApplication {
  ApplicationId: string;
  Version: string;
}

export interface OutcomeRule {
  Kind: OutcomeRuleKindProto;
  TemplateKey: string;
  SeatCount: number;
  BlankVoteCountsForTurnout: boolean;
  BlankVoteExcludedFromWinnerSelection: boolean;
  BlankVoteExcludedFromThresholdDenominator: boolean;
  TieResolutionRule: string;
  CalculationBasis: string;
}

export interface ElectionOption {
  OptionId: string;
  DisplayLabel: string;
  ShortDescription: string;
  BallotOrder: number;
  IsBlankOption: boolean;
}

export interface ElectionMetadata {
  Title: string;
  ShortDescription: string;
  OwnerPublicAddress: string;
  ExternalReferenceCode: string;
}

export interface ElectionFrozenPolicy {
  ElectionClass: ElectionClassProto;
  BindingStatus: ElectionBindingStatusProto;
  GovernanceMode: ElectionGovernanceModeProto;
  DisclosureMode: ElectionDisclosureModeProto;
  ParticipationPrivacyMode: ParticipationPrivacyModeProto;
  VoteUpdatePolicy: VoteUpdatePolicyProto;
  EligibilitySourceType: EligibilitySourceTypeProto;
  EligibilityMutationPolicy: EligibilityMutationPolicyProto;
  OutcomeRule: OutcomeRule;
  ApprovedClientApplications: ApprovedClientApplication[];
  ProtocolOmegaVersion: string;
  ReportingPolicy: ReportingPolicyProto;
  ReviewWindowPolicy: ReviewWindowPolicyProto;
  RequiredApprovalCount?: number;
}

export interface ElectionTrusteeReference {
  TrusteeUserAddress: string;
  TrusteeDisplayName: string;
}

export interface ElectionTrusteeBoundarySnapshot {
  RequiredApprovalCount: number;
  AcceptedTrustees: ElectionTrusteeReference[];
  EveryAcceptedTrusteeMustApprove: boolean;
}

export interface ElectionCeremonyProfile {
  ProfileId: string;
  DisplayName: string;
  Description: string;
  ProviderKey: string;
  ProfileVersion: string;
  TrusteeCount: number;
  RequiredApprovalCount: number;
  DevOnly: boolean;
  RegisteredAt: GrpcTimestamp;
  LastUpdatedAt: GrpcTimestamp;
}

export interface ElectionCeremonyBindingSnapshot {
  CeremonyVersionId: string;
  VersionNumber: number;
  ProfileId: string;
  TrusteeCount: number;
  RequiredApprovalCount: number;
  CompletedTrustees: ElectionTrusteeReference[];
  TallyPublicKeyFingerprint: string;
}

export interface ElectionCeremonyVersion {
  Id: string;
  ElectionId: string;
  VersionNumber: number;
  ProfileId: string;
  Status: ElectionCeremonyVersionStatusProto;
  TrusteeCount: number;
  RequiredApprovalCount: number;
  BoundTrustees: ElectionTrusteeReference[];
  StartedByPublicAddress: string;
  StartedAt: GrpcTimestamp;
  CompletedAt?: GrpcTimestamp;
  SupersededAt?: GrpcTimestamp;
  SupersededReason: string;
  TallyPublicKeyFingerprint: string;
}

export interface ElectionCeremonyTranscriptEvent {
  Id: string;
  ElectionId: string;
  CeremonyVersionId: string;
  VersionNumber: number;
  EventType: ElectionCeremonyTranscriptEventTypeProto;
  ActorPublicAddress: string;
  TrusteeUserAddress: string;
  TrusteeDisplayName: string;
  TrusteeState: ElectionTrusteeCeremonyStateProto;
  EventSummary: string;
  EvidenceReference: string;
  RestartReason: string;
  TallyPublicKeyFingerprint: string;
  OccurredAt: GrpcTimestamp;
  HasTrusteeState: boolean;
}

export interface ElectionCeremonyMessageEnvelope {
  Id: string;
  ElectionId: string;
  CeremonyVersionId: string;
  VersionNumber: number;
  ProfileId: string;
  SenderTrusteeUserAddress: string;
  RecipientTrusteeUserAddress: string;
  MessageType: string;
  PayloadVersion: string;
  EncryptedPayload: string;
  PayloadFingerprint: string;
  SubmittedAt: GrpcTimestamp;
}

export interface ElectionCeremonyTrusteeState {
  Id: string;
  ElectionId: string;
  CeremonyVersionId: string;
  TrusteeUserAddress: string;
  TrusteeDisplayName: string;
  State: ElectionTrusteeCeremonyStateProto;
  TransportPublicKeyFingerprint: string;
  TransportPublicKeyPublishedAt?: GrpcTimestamp;
  JoinedAt?: GrpcTimestamp;
  SelfTestSucceededAt?: GrpcTimestamp;
  MaterialSubmittedAt?: GrpcTimestamp;
  ValidationFailedAt?: GrpcTimestamp;
  ValidationFailureReason: string;
  CompletedAt?: GrpcTimestamp;
  RemovedAt?: GrpcTimestamp;
  ShareVersion: string;
  LastUpdatedAt: GrpcTimestamp;
}

export interface ElectionCeremonyShareCustody {
  Id: string;
  ElectionId: string;
  CeremonyVersionId: string;
  TrusteeUserAddress: string;
  ShareVersion: string;
  PasswordProtected: boolean;
  Status: ElectionCeremonyShareCustodyStatusProto;
  LastExportedAt?: GrpcTimestamp;
  LastImportedAt?: GrpcTimestamp;
  LastImportFailedAt?: GrpcTimestamp;
  LastImportFailureReason: string;
  LastUpdatedAt: GrpcTimestamp;
}

export interface ElectionCeremonyActionAvailability {
  ActionType: ElectionCeremonyActionTypeProto;
  IsAvailable: boolean;
  IsCompleted: boolean;
  Reason: string;
}

export interface ElectionFinalizationSession {
  Id: string;
  ElectionId: string;
  GovernedProposalId: string;
  GovernanceMode: ElectionGovernanceModeProto;
  SessionPurpose: ElectionFinalizationSessionPurposeProto;
  CloseArtifactId: string;
  AcceptedBallotSetHash: string;
  FinalEncryptedTallyHash: string;
  TargetTallyId: string;
  CeremonySnapshot?: ElectionCeremonyBindingSnapshot;
  RequiredShareCount: number;
  EligibleTrustees: ElectionTrusteeReference[];
  Status: ElectionFinalizationSessionStatusProto;
  CreatedAt: GrpcTimestamp;
  CreatedByPublicAddress: string;
  CompletedAt?: GrpcTimestamp;
  ReleaseEvidenceId: string;
  LatestTransactionId: string;
  LatestBlockHeight?: number;
  LatestBlockId: string;
}

export interface ElectionFinalizationShare {
  Id: string;
  FinalizationSessionId: string;
  ElectionId: string;
  TrusteeUserAddress: string;
  TrusteeDisplayName: string;
  SubmittedByPublicAddress: string;
  ShareIndex: number;
  ShareVersion: string;
  TargetType: ElectionFinalizationTargetTypeProto;
  ClaimedCloseArtifactId: string;
  ClaimedAcceptedBallotSetHash: string;
  ClaimedFinalEncryptedTallyHash: string;
  ClaimedTargetTallyId: string;
  ClaimedCeremonyVersionId: string;
  ClaimedTallyPublicKeyFingerprint: string;
  Status: ElectionFinalizationShareStatusProto;
  FailureCode: string;
  FailureReason: string;
  SubmittedAt: GrpcTimestamp;
  SourceTransactionId: string;
  SourceBlockHeight?: number;
  SourceBlockId: string;
}

export interface ElectionFinalizationReleaseEvidence {
  Id: string;
  FinalizationSessionId: string;
  ElectionId: string;
  SessionPurpose: ElectionFinalizationSessionPurposeProto;
  ReleaseMode: ElectionFinalizationReleaseModeProto;
  CloseArtifactId: string;
  AcceptedBallotSetHash: string;
  FinalEncryptedTallyHash: string;
  TargetTallyId: string;
  AcceptedShareCount: number;
  AcceptedTrustees: ElectionTrusteeReference[];
  CompletedAt: GrpcTimestamp;
  CompletedByPublicAddress: string;
  SourceTransactionId: string;
  SourceBlockHeight?: number;
  SourceBlockId: string;
}

export interface ElectionResultOptionCount {
  OptionId: string;
  DisplayLabel: string;
  ShortDescription: string;
  BallotOrder: number;
  Rank: number;
  VoteCount: number;
}

export interface ElectionResultDenominatorEvidence {
  SnapshotType: ElectionEligibilitySnapshotTypeProto;
  EligibilitySnapshotId: string;
  BoundaryArtifactId: string;
  ActiveDenominatorSetHash: string;
}

export interface ElectionResultArtifact {
  Id: string;
  ElectionId: string;
  ArtifactKind: ElectionResultArtifactKindProto;
  Visibility: ElectionResultArtifactVisibilityProto;
  Title: string;
  NamedOptionResults: ElectionResultOptionCount[];
  BlankCount: number;
  TotalVotedCount: number;
  EligibleToVoteCount: number;
  DidNotVoteCount: number;
  DenominatorEvidence: ElectionResultDenominatorEvidence;
  TallyReadyArtifactId: string;
  SourceResultArtifactId: string;
  EncryptedPayload: string;
  PublicPayload: string;
  RecordedAt: GrpcTimestamp;
  RecordedByPublicAddress: string;
}

export interface ElectionReportPackageSummaryView {
  Id: string;
  Status: ElectionReportPackageStatusProto;
  AttemptNumber: number;
  PreviousAttemptId: string;
  FinalizationSessionId: string;
  TallyReadyArtifactId: string;
  UnofficialResultArtifactId: string;
  OfficialResultArtifactId: string;
  FinalizeArtifactId: string;
  CloseBoundaryArtifactId: string;
  CloseEligibilitySnapshotId: string;
  FinalizationReleaseEvidenceId: string;
  FrozenEvidenceHash: Uint8Array;
  FrozenEvidenceFingerprint: string;
  PackageHash: Uint8Array;
  ArtifactCount: number;
  FailureCode: string;
  FailureReason: string;
  AttemptedAt: GrpcTimestamp;
  SealedAt?: GrpcTimestamp;
  HasSealedAt: boolean;
  AttemptedByPublicAddress: string;
}

export interface ElectionReportArtifactView {
  Id: string;
  ReportPackageId: string;
  ElectionId: string;
  ArtifactKind: ElectionReportArtifactKindProto;
  Format: ElectionReportArtifactFormatProto;
  AccessScope: ElectionReportArtifactAccessScopeProto;
  SortOrder: number;
  Title: string;
  FileName: string;
  MediaType: string;
  ContentHash: Uint8Array;
  Content: string;
  PairedArtifactId: string;
  RecordedAt: GrpcTimestamp;
}

export interface ElectionRecordView {
  ElectionId: string;
  Title: string;
  ShortDescription: string;
  OwnerPublicAddress: string;
  ExternalReferenceCode: string;
  LifecycleState: ElectionLifecycleStateProto;
  ElectionClass: ElectionClassProto;
  BindingStatus: ElectionBindingStatusProto;
  GovernanceMode: ElectionGovernanceModeProto;
  DisclosureMode: ElectionDisclosureModeProto;
  ParticipationPrivacyMode: ParticipationPrivacyModeProto;
  VoteUpdatePolicy: VoteUpdatePolicyProto;
  EligibilitySourceType: EligibilitySourceTypeProto;
  EligibilityMutationPolicy: EligibilityMutationPolicyProto;
  OutcomeRule: OutcomeRule;
  ApprovedClientApplications: ApprovedClientApplication[];
  ProtocolOmegaVersion: string;
  ReportingPolicy: ReportingPolicyProto;
  ReviewWindowPolicy: ReviewWindowPolicyProto;
  CurrentDraftRevision: number;
  Options: ElectionOption[];
  AcknowledgedWarningCodes: ElectionWarningCodeProto[];
  RequiredApprovalCount?: number;
  CreatedAt: GrpcTimestamp;
  LastUpdatedAt: GrpcTimestamp;
  OpenedAt?: GrpcTimestamp;
  ClosedAt?: GrpcTimestamp;
  FinalizedAt?: GrpcTimestamp;
  OpenArtifactId: string;
  CloseArtifactId: string;
  FinalizeArtifactId: string;
  TallyReadyAt?: GrpcTimestamp;
  VoteAcceptanceLockedAt?: GrpcTimestamp;
  TallyReadyArtifactId: string;
  OfficialResultVisibilityPolicy: OfficialResultVisibilityPolicyProto;
  ClosedProgressStatus: ElectionClosedProgressStatusProto;
  UnofficialResultArtifactId: string;
  OfficialResultArtifactId: string;
}

export interface ElectionSummary {
  ElectionId: string;
  Title: string;
  OwnerPublicAddress: string;
  LifecycleState: ElectionLifecycleStateProto;
  BindingStatus: ElectionBindingStatusProto;
  GovernanceMode: ElectionGovernanceModeProto;
  CurrentDraftRevision: number;
  LastUpdatedAt: GrpcTimestamp;
}

export interface ElectionDraftSnapshot {
  Id: string;
  ElectionId: string;
  DraftRevision: number;
  Metadata: ElectionMetadata;
  Policy: ElectionFrozenPolicy;
  Options: ElectionOption[];
  AcknowledgedWarningCodes: ElectionWarningCodeProto[];
  SnapshotReason: string;
  RecordedAt: GrpcTimestamp;
  RecordedByPublicAddress: string;
}

export interface ElectionBoundaryArtifact {
  Id: string;
  ElectionId: string;
  ArtifactType: ElectionBoundaryArtifactTypeProto;
  LifecycleState: ElectionLifecycleStateProto;
  SourceDraftRevision: number;
  Metadata: ElectionMetadata;
  Policy: ElectionFrozenPolicy;
  Options: ElectionOption[];
  AcknowledgedWarningCodes: ElectionWarningCodeProto[];
  TrusteeSnapshot?: ElectionTrusteeBoundarySnapshot;
  FrozenEligibleVoterSetHash: string;
  TrusteePolicyExecutionReference: string;
  ReportingPolicyExecutionReference: string;
  ReviewWindowExecutionReference: string;
  AcceptedBallotSetHash: string;
  FinalEncryptedTallyHash: string;
  AcceptedBallotCount?: number;
  PublishedBallotCount?: number;
  PublishedBallotStreamHash: string;
  RecordedAt: GrpcTimestamp;
  RecordedByPublicAddress: string;
  CeremonySnapshot?: ElectionCeremonyBindingSnapshot;
}

export interface ElectionWarningAcknowledgement {
  Id: string;
  ElectionId: string;
  WarningCode: ElectionWarningCodeProto;
  DraftRevision: number;
  AcknowledgedByPublicAddress: string;
  AcknowledgedAt: GrpcTimestamp;
}

export interface ElectionTrusteeInvitation {
  Id: string;
  ElectionId: string;
  TrusteeUserAddress: string;
  TrusteeDisplayName: string;
  InvitedByPublicAddress: string;
  LinkedMessageId: string;
  Status: ElectionTrusteeInvitationStatusProto;
  SentAtDraftRevision: number;
  SentAt: GrpcTimestamp;
  ResolvedAtDraftRevision?: number;
  RespondedAt?: GrpcTimestamp;
  RevokedAt?: GrpcTimestamp;
}

export interface ElectionGovernedProposal {
  Id: string;
  ElectionId: string;
  ActionType: ElectionGovernedActionTypeProto;
  LifecycleStateAtCreation: ElectionLifecycleStateProto;
  ProposedByPublicAddress: string;
  CreatedAt: GrpcTimestamp;
  ExecutionStatus: ElectionGovernedProposalExecutionStatusProto;
  LastExecutionAttemptedAt?: GrpcTimestamp;
  ExecutedAt?: GrpcTimestamp;
  ExecutionFailureReason: string;
  LastExecutionTriggeredByPublicAddress: string;
}

export interface ElectionGovernedProposalApproval {
  Id: string;
  ProposalId: string;
  ElectionId: string;
  ActionType: ElectionGovernedActionTypeProto;
  LifecycleStateAtProposalCreation: ElectionLifecycleStateProto;
  TrusteeUserAddress: string;
  TrusteeDisplayName: string;
  ApprovalNote: string;
  ApprovedAt: GrpcTimestamp;
}

export interface ElectionDraftInput {
  Title: string;
  ShortDescription: string;
  ExternalReferenceCode: string;
  ElectionClass: ElectionClassProto;
  BindingStatus: ElectionBindingStatusProto;
  GovernanceMode: ElectionGovernanceModeProto;
  DisclosureMode: ElectionDisclosureModeProto;
  ParticipationPrivacyMode: ParticipationPrivacyModeProto;
  VoteUpdatePolicy: VoteUpdatePolicyProto;
  EligibilitySourceType: EligibilitySourceTypeProto;
  EligibilityMutationPolicy: EligibilityMutationPolicyProto;
  OutcomeRule: OutcomeRule;
  ApprovedClientApplications: ApprovedClientApplication[];
  ProtocolOmegaVersion: string;
  ReportingPolicy: ReportingPolicyProto;
  ReviewWindowPolicy: ReviewWindowPolicyProto;
  OwnerOptions: ElectionOption[];
  AcknowledgedWarningCodes: ElectionWarningCodeProto[];
  RequiredApprovalCount?: number;
}

export interface CreateElectionDraftRequest {
  OwnerPublicAddress: string;
  ActorPublicAddress: string;
  SnapshotReason: string;
  Draft: ElectionDraftInput;
}

export interface UpdateElectionDraftRequest {
  ElectionId: string;
  ActorPublicAddress: string;
  SnapshotReason: string;
  Draft: ElectionDraftInput;
}

export interface InviteElectionTrusteeRequest {
  ElectionId: string;
  ActorPublicAddress: string;
  TrusteeUserAddress: string;
  TrusteeDisplayName: string;
}

export interface CreateElectionReportAccessGrantRequest {
  ElectionId: string;
  ActorPublicAddress: string;
  DesignatedAuditorPublicAddress: string;
}

export interface ResolveElectionTrusteeInvitationRequest {
  ElectionId: string;
  InvitationId: string;
  ActorPublicAddress: string;
}

export interface StartElectionCeremonyRequest {
  ElectionId: string;
  ActorPublicAddress: string;
  ProfileId: string;
}

export interface RestartElectionCeremonyRequest {
  ElectionId: string;
  ActorPublicAddress: string;
  ProfileId: string;
  RestartReason: string;
}

export interface PublishElectionCeremonyTransportKeyRequest {
  ElectionId: string;
  CeremonyVersionId: string;
  ActorPublicAddress: string;
  TransportPublicKeyFingerprint: string;
}

export interface JoinElectionCeremonyRequest {
  ElectionId: string;
  CeremonyVersionId: string;
  ActorPublicAddress: string;
}

export interface RecordElectionCeremonySelfTestRequest {
  ElectionId: string;
  CeremonyVersionId: string;
  ActorPublicAddress: string;
}

export interface SubmitElectionCeremonyMaterialRequest {
  ElectionId: string;
  CeremonyVersionId: string;
  ActorPublicAddress: string;
  RecipientTrusteeUserAddress: string;
  MessageType: string;
  PayloadVersion: string;
  EncryptedPayload: string;
  PayloadFingerprint: string;
}

export interface RecordElectionCeremonyValidationFailureRequest {
  ElectionId: string;
  CeremonyVersionId: string;
  ActorPublicAddress: string;
  TrusteeUserAddress: string;
  ValidationFailureReason: string;
  EvidenceReference: string;
}

export interface CompleteElectionCeremonyTrusteeRequest {
  ElectionId: string;
  CeremonyVersionId: string;
  ActorPublicAddress: string;
  TrusteeUserAddress: string;
  ShareVersion: string;
  TallyPublicKeyFingerprint: string;
}

export interface SubmitElectionFinalizationShareRequest {
  ElectionId: string;
  FinalizationSessionId: string;
  ActorPublicAddress: string;
  ShareIndex: number;
  ShareVersion: string;
  TargetType: ElectionFinalizationTargetTypeProto;
  ClaimedCloseArtifactId: string;
  ClaimedAcceptedBallotSetHash?: string | null;
  ClaimedFinalEncryptedTallyHash?: string | null;
  ClaimedTargetTallyId: string;
  ClaimedCeremonyVersionId?: string | null;
  ClaimedTallyPublicKeyFingerprint?: string | null;
  ShareMaterial: string;
}

export interface RecordElectionCeremonyShareExportRequest {
  ElectionId: string;
  CeremonyVersionId: string;
  ActorPublicAddress: string;
  ShareVersion: string;
}

export interface RecordElectionCeremonyShareImportRequest {
  ElectionId: string;
  CeremonyVersionId: string;
  ActorPublicAddress: string;
  ImportedElectionId: string;
  ImportedCeremonyVersionId: string;
  ImportedTrusteeUserAddress: string;
  ImportedShareVersion: string;
}

export interface StartElectionGovernedProposalRequest {
  ElectionId: string;
  ActionType: ElectionGovernedActionTypeProto;
  ActorPublicAddress: string;
}

export interface ApproveElectionGovernedProposalRequest {
  ElectionId: string;
  ProposalId: string;
  ActorPublicAddress: string;
  ApprovalNote: string;
}

export interface RetryElectionGovernedProposalExecutionRequest {
  ElectionId: string;
  ProposalId: string;
  ActorPublicAddress: string;
}

export interface GetElectionOpenReadinessRequest {
  ElectionId: string;
  RequiredWarningCodes: ElectionWarningCodeProto[];
}

export interface OpenElectionRequest {
  ElectionId: string;
  ActorPublicAddress: string;
  RequiredWarningCodes: ElectionWarningCodeProto[];
  FrozenEligibleVoterSetHash: string;
  TrusteePolicyExecutionReference: string;
  ReportingPolicyExecutionReference: string;
  ReviewWindowExecutionReference: string;
}

export interface CloseElectionRequest {
  ElectionId: string;
  ActorPublicAddress: string;
  AcceptedBallotSetHash: string;
  FinalEncryptedTallyHash: string;
}

export interface FinalizeElectionRequest {
  ElectionId: string;
  ActorPublicAddress: string;
  AcceptedBallotSetHash: string;
  FinalEncryptedTallyHash: string;
}

export interface RegisterElectionVotingCommitmentRequest {
  ElectionId: string;
  ActorPublicAddress: string;
  CommitmentHash: string;
}

export interface RegisterElectionVotingCommitmentResponse {
  Success: boolean;
  FailureReason: ElectionCommitmentRegistrationFailureReasonProto;
  ErrorMessage: string;
  Election?: ElectionRecordView;
  SelfRosterEntry?: ElectionRosterEntryView;
  CommitmentRegisteredAt?: GrpcTimestamp;
  HasCommitmentRegisteredAt: boolean;
}

export interface AcceptElectionBallotCastRequest {
  ElectionId: string;
  ActorPublicAddress: string;
  IdempotencyKey: string;
  EncryptedBallotPackage: string;
  ProofBundle: string;
  BallotNullifier: string;
  OpenArtifactId: string;
  EligibleSetHash: string;
  CeremonyVersionId: string;
  DkgProfileId: string;
  TallyPublicKeyFingerprint: string;
}

export interface AcceptElectionBallotCastResponse {
  Success: boolean;
  FailureReason: ElectionCastAcceptanceFailureReasonProto;
  ErrorMessage: string;
  Election?: ElectionRecordView;
  SelfRosterEntry?: ElectionRosterEntryView;
  PersonalParticipationStatus: ElectionParticipationStatusProto;
  AcceptedAt?: GrpcTimestamp;
  HasAcceptedAt: boolean;
}

export interface GetElectionRequest {
  ElectionId: string;
}

export interface GetElectionHubViewRequest {
  ActorPublicAddress: string;
}

export interface GetElectionEligibilityViewRequest {
  ElectionId: string;
  ActorPublicAddress: string;
}

export interface GetElectionVotingViewRequest {
  ElectionId: string;
  ActorPublicAddress: string;
  SubmissionIdempotencyKey: string;
}

export interface GetElectionEnvelopeAccessRequest {
  ElectionId: string;
  ActorPublicAddress: string;
}

export interface GetElectionEnvelopeAccessResponse {
  Success: boolean;
  ErrorMessage: string;
  ActorEncryptedElectionPrivateKey: string;
}

export interface GetElectionResultViewRequest {
  ElectionId: string;
  ActorPublicAddress: string;
}

export interface GetElectionReportAccessGrantsRequest {
  ElectionId: string;
  ActorPublicAddress: string;
}

export interface GetElectionResultViewResponse {
  Success: boolean;
  ErrorMessage: string;
  ActorPublicAddress: string;
  CanViewParticipantEncryptedResults: boolean;
  OfficialResultVisibilityPolicy: OfficialResultVisibilityPolicyProto;
  ClosedProgressStatus: ElectionClosedProgressStatusProto;
  UnofficialResult?: ElectionResultArtifact;
  OfficialResult?: ElectionResultArtifact;
  CanViewReportPackage: boolean;
  CanRetryFailedPackageFinalization: boolean;
  LatestReportPackage?: ElectionReportPackageSummaryView;
  VisibleReportArtifacts: ElectionReportArtifactView[];
}

export interface GetElectionCeremonyActionViewRequest {
  ElectionId: string;
  ActorPublicAddress: string;
}

export enum ElectionEligibilityActorRoleProto {
  EligibilityActorUnknown = 0,
  EligibilityActorOwner = 1,
  EligibilityActorRestrictedReviewer = 2,
  EligibilityActorLinkedVoter = 3,
  EligibilityActorReadOnly = 4,
}

export enum ElectionHubNextActionHintProto {
  ElectionHubActionNone = 0,
  ElectionHubActionOwnerManageDraft = 1,
  ElectionHubActionOwnerOpenElection = 2,
  ElectionHubActionOwnerMonitorClosedProgress = 3,
  ElectionHubActionOwnerReviewFinalResult = 4,
  ElectionHubActionVoterClaimIdentity = 5,
  ElectionHubActionVoterCastBallot = 6,
  ElectionHubActionVoterReviewResult = 7,
  ElectionHubActionTrusteeApproveGovernedAction = 8,
  ElectionHubActionTrusteeReviewResult = 9,
  ElectionHubActionAuditorReviewPackage = 10,
}

export interface ElectionApplicationRoleFlagsView {
  IsOwnerAdmin: boolean;
  IsTrustee: boolean;
  IsVoter: boolean;
  IsDesignatedAuditor: boolean;
}

export interface ElectionHubEntryView {
  Election: ElectionSummary;
  ActorRoles: ElectionApplicationRoleFlagsView;
  SuggestedAction: ElectionHubNextActionHintProto;
  SuggestedActionReason: string;
  CanClaimIdentity: boolean;
  CanViewNamedParticipationRoster: boolean;
  CanViewReportPackage: boolean;
  CanViewParticipantResults: boolean;
  ClosedProgressStatus: ElectionClosedProgressStatusProto;
  HasUnofficialResult: boolean;
  HasOfficialResult: boolean;
}

export interface GetElectionHubViewResponse {
  Success: boolean;
  ErrorMessage: string;
  ActorPublicAddress: string;
  Elections: ElectionHubEntryView[];
  HasAnyElectionRoles: boolean;
  EmptyStateReason: string;
}

export interface ElectionReportAccessGrantView {
  Id: string;
  ElectionId: string;
  ActorPublicAddress: string;
  GrantRole: ElectionReportAccessGrantRoleProto;
  GrantedAt: GrpcTimestamp;
  GrantedByPublicAddress: string;
}

export interface GetElectionReportAccessGrantsResponse {
  Success: boolean;
  ErrorMessage: string;
  ActorPublicAddress: string;
  CanManageGrants: boolean;
  DeniedReason: string;
  Grants: ElectionReportAccessGrantView[];
}

export interface ElectionEligibilitySummaryView {
  RosteredCount: number;
  LinkedCount: number;
  ActiveCount: number;
  ActiveAtOpenCount: number;
  CurrentDenominatorCount: number;
  CountedParticipationCount: number;
  BlankCount: number;
  DidNotVoteCount: number;
  ActivationEventCount: number;
}

export interface ElectionRosterEntryView {
  ElectionId: string;
  OrganizationVoterId: string;
  ContactType: ElectionRosterContactTypeProto;
  ContactValueHint: string;
  LinkStatus: ElectionVoterLinkStatusProto;
  VotingRightStatus: ElectionVotingRightStatusProto;
  WasPresentAtOpen: boolean;
  WasActiveAtOpen: boolean;
  InCurrentDenominator: boolean;
  ParticipationStatus: ElectionParticipationStatusProto;
  CountsAsParticipation: boolean;
}

export interface ElectionEligibilityActivationEventView {
  Id: string;
  ElectionId: string;
  OrganizationVoterId: string;
  AttemptedByPublicAddress: string;
  Outcome: ElectionEligibilityActivationOutcomeProto;
  BlockReason: ElectionEligibilityActivationBlockReasonProto;
  OccurredAt: GrpcTimestamp;
}

export interface ElectionEligibilitySnapshotView {
  Id: string;
  ElectionId: string;
  SnapshotType: ElectionEligibilitySnapshotTypeProto;
  EligibilityMutationPolicy: EligibilityMutationPolicyProto;
  RosteredCount: number;
  LinkedCount: number;
  ActiveDenominatorCount: number;
  CountedParticipationCount: number;
  BlankCount: number;
  DidNotVoteCount: number;
  RosteredVoterSetHash: string;
  ActiveDenominatorSetHash: string;
  CountedParticipationSetHash: string;
  BoundaryArtifactId: string;
  RecordedAt: GrpcTimestamp;
  RecordedByPublicAddress: string;
}

export interface GetElectionsByOwnerRequest {
  OwnerPublicAddress: string;
}

export interface ElectionCommandResponse {
  Success: boolean;
  ErrorCode: ElectionCommandErrorCodeProto;
  ErrorMessage: string;
  ValidationErrors: string[];
  Election?: ElectionRecordView;
  DraftSnapshot?: ElectionDraftSnapshot;
  BoundaryArtifact?: ElectionBoundaryArtifact;
  TrusteeInvitation?: ElectionTrusteeInvitation;
  GovernedProposal?: ElectionGovernedProposal;
  GovernedProposalApproval?: ElectionGovernedProposalApproval;
  CeremonyProfile?: ElectionCeremonyProfile;
  CeremonyVersion?: ElectionCeremonyVersion;
  CeremonyTranscriptEvents: ElectionCeremonyTranscriptEvent[];
  CeremonyTrusteeState?: ElectionCeremonyTrusteeState;
  CeremonyMessageEnvelope?: ElectionCeremonyMessageEnvelope;
  CeremonyShareCustody?: ElectionCeremonyShareCustody;
  FinalizationSession?: ElectionFinalizationSession;
  FinalizationShare?: ElectionFinalizationShare;
  FinalizationReleaseEvidence?: ElectionFinalizationReleaseEvidence;
}

export interface GetElectionOpenReadinessResponse {
  IsReadyToOpen: boolean;
  ValidationErrors: string[];
  RequiredWarningCodes: ElectionWarningCodeProto[];
  MissingWarningAcknowledgements: ElectionWarningCodeProto[];
  CeremonySnapshot?: ElectionCeremonyBindingSnapshot;
}

export interface GetElectionResponse {
  Success: boolean;
  ErrorMessage: string;
  Election?: ElectionRecordView;
  LatestDraftSnapshot?: ElectionDraftSnapshot;
  WarningAcknowledgements: ElectionWarningAcknowledgement[];
  TrusteeInvitations: ElectionTrusteeInvitation[];
  BoundaryArtifacts: ElectionBoundaryArtifact[];
  GovernedProposals: ElectionGovernedProposal[];
  GovernedProposalApprovals: ElectionGovernedProposalApproval[];
  CeremonyProfiles: ElectionCeremonyProfile[];
  CeremonyVersions: ElectionCeremonyVersion[];
  CeremonyTranscriptEvents: ElectionCeremonyTranscriptEvent[];
  ActiveCeremonyTrusteeStates: ElectionCeremonyTrusteeState[];
  FinalizationSessions?: ElectionFinalizationSession[];
  FinalizationShares?: ElectionFinalizationShare[];
  FinalizationReleaseEvidenceRecords?: ElectionFinalizationReleaseEvidence[];
  ResultArtifacts?: ElectionResultArtifact[];
}

export interface GetElectionCeremonyActionViewResponse {
  Success: boolean;
  ErrorMessage: string;
  ActorRole: ElectionCeremonyActorRoleProto;
  ActorPublicAddress: string;
  ActiveCeremonyVersion?: ElectionCeremonyVersion;
  OwnerActions: ElectionCeremonyActionAvailability[];
  TrusteeActions: ElectionCeremonyActionAvailability[];
  SelfTrusteeState?: ElectionCeremonyTrusteeState;
  SelfShareCustody?: ElectionCeremonyShareCustody;
  PendingIncomingMessageCount: number;
  BlockedReasons: string[];
}

export interface GetElectionEligibilityViewResponse {
  Success: boolean;
  ErrorMessage: string;
  ActorPublicAddress: string;
  ActorRole: ElectionEligibilityActorRoleProto;
  CanImportRoster: boolean;
  CanActivateRoster: boolean;
  CanReviewRestrictedRoster: boolean;
  CanClaimIdentity: boolean;
  UsesTemporaryVerificationCode: boolean;
  TemporaryVerificationCode: string;
  Summary: ElectionEligibilitySummaryView;
  SelfRosterEntry?: ElectionRosterEntryView;
  RestrictedRosterEntries: ElectionRosterEntryView[];
  ActivationEvents: ElectionEligibilityActivationEventView[];
  EligibilitySnapshots: ElectionEligibilitySnapshotView[];
}

export interface GetElectionVotingViewResponse {
  Success: boolean;
  ErrorMessage: string;
  ActorPublicAddress: string;
  Election?: ElectionRecordView;
  SelfRosterEntry?: ElectionRosterEntryView;
  CommitmentRegistered: boolean;
  CommitmentRegisteredAt?: GrpcTimestamp;
  HasCommitmentRegisteredAt: boolean;
  PersonalParticipationStatus: ElectionParticipationStatusProto;
  AcceptedAt?: GrpcTimestamp;
  HasAcceptedAt: boolean;
  SubmissionStatus: ElectionVotingSubmissionStatusProto;
  OpenArtifactId: string;
  EligibleSetHash: string;
  CeremonyVersionId: string;
  DkgProfileId: string;
  TallyPublicKeyFingerprint: string;
  ReceiptId: string;
  AcceptanceId: string;
  ServerProof: string;
}

export interface GetElectionsByOwnerResponse {
  Elections: ElectionSummary[];
}
