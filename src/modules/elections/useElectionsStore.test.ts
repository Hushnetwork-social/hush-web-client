import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ElectionHubEntryView,
  ElectionRecordView,
  ElectionReportAccessGrantView,
  ElectionSummary,
  GetElectionHubViewResponse,
  GetElectionReportAccessGrantsResponse,
  GetElectionResponse,
} from '@/lib/grpc';
import {
  ElectionBindingStatusProto,
  ElectionClosedProgressStatusProto,
  ElectionGovernanceModeProto,
  ElectionHubNextActionHintProto,
  ElectionLifecycleStateProto,
  ElectionReportAccessGrantRoleProto,
} from '@/lib/grpc';
import { useElectionsStore } from './useElectionsStore';

const { electionsServiceMock, identityServiceMock, blockchainServiceMock, transactionServiceMock } =
  vi.hoisted(() => ({
    electionsServiceMock: {
      getElection: vi.fn(),
      getElectionHubView: vi.fn(),
      getElectionReportAccessGrants: vi.fn(),
    },
    identityServiceMock: {
      searchByDisplayName: vi.fn(),
    },
    blockchainServiceMock: {
      submitTransaction: vi.fn(),
    },
    transactionServiceMock: {
      createElectionReportAccessGrantTransaction: vi.fn(),
    },
  }));

vi.mock('@/lib/grpc/services/elections', () => ({
  electionsService: electionsServiceMock,
}));

vi.mock('@/lib/grpc/services/identity', () => ({
  identityService: identityServiceMock,
}));

vi.mock('@/modules/blockchain/BlockchainService', () => ({
  submitTransaction: (...args: unknown[]) => blockchainServiceMock.submitTransaction(...args),
}));

vi.mock('./transactionService', async () => {
  const actual = await vi.importActual<typeof import('./transactionService')>('./transactionService');
  return {
    ...actual,
    createElectionReportAccessGrantTransaction: (...args: unknown[]) =>
      transactionServiceMock.createElectionReportAccessGrantTransaction(...args),
  };
});

const timestamp = { seconds: 1_711_410_000, nanos: 0 };

function createSummary(
  electionId: string,
  lifecycleState: ElectionLifecycleStateProto,
  title: string
): ElectionSummary {
  return {
    ElectionId: electionId,
    Title: title,
    OwnerPublicAddress: 'actor-address',
    LifecycleState: lifecycleState,
    BindingStatus: ElectionBindingStatusProto.Binding,
    GovernanceMode: ElectionGovernanceModeProto.AdminOnly,
    CurrentDraftRevision: 1,
    LastUpdatedAt: timestamp,
  };
}

function createHubEntry(
  electionId: string,
  lifecycleState: ElectionLifecycleStateProto,
  title: string
): ElectionHubEntryView {
  return {
    Election: createSummary(electionId, lifecycleState, title),
    ActorRoles: {
      IsOwnerAdmin: true,
      IsTrustee: false,
      IsVoter: lifecycleState === ElectionLifecycleStateProto.Open,
      IsDesignatedAuditor: false,
    },
    SuggestedAction: ElectionHubNextActionHintProto.ElectionHubActionOwnerManageDraft,
    SuggestedActionReason: '',
    CanClaimIdentity: false,
    CanViewNamedParticipationRoster: true,
    CanViewReportPackage: true,
    CanViewParticipantResults: true,
    ClosedProgressStatus: ElectionClosedProgressStatusProto.ClosedProgressNone,
    HasUnofficialResult: false,
    HasOfficialResult: false,
  };
}

function createElectionRecord(
  electionId: string,
  lifecycleState: ElectionLifecycleStateProto,
  title: string
): ElectionRecordView {
  return {
    ElectionId: electionId,
    Title: title,
    ShortDescription: 'Election description',
    OwnerPublicAddress: 'actor-address',
    ExternalReferenceCode: 'ORG-2026-01',
    LifecycleState: lifecycleState,
    ElectionClass: 0,
    BindingStatus: ElectionBindingStatusProto.Binding,
    GovernanceMode: ElectionGovernanceModeProto.AdminOnly,
    DisclosureMode: 0,
    ParticipationPrivacyMode: 0,
    VoteUpdatePolicy: 0,
    EligibilitySourceType: 0,
    EligibilityMutationPolicy: 0,
    OutcomeRule: {
      Kind: 0,
      TemplateKey: 'single_winner',
      SeatCount: 1,
      BlankVoteCountsForTurnout: true,
      BlankVoteExcludedFromWinnerSelection: true,
      BlankVoteExcludedFromThresholdDenominator: false,
      TieResolutionRule: 'tie_unresolved',
      CalculationBasis: 'highest_non_blank_votes',
    },
    ApprovedClientApplications: [{ ApplicationId: 'hushsocial', Version: '1.0.0' }],
    ProtocolOmegaVersion: 'omega-v1.0.0',
    ReportingPolicy: 0,
    ReviewWindowPolicy: 0,
    CurrentDraftRevision: 1,
    Options: [],
    AcknowledgedWarningCodes: [],
    RequiredApprovalCount: 0,
    CreatedAt: timestamp,
    LastUpdatedAt: timestamp,
    OpenedAt: lifecycleState >= ElectionLifecycleStateProto.Open ? timestamp : undefined,
    ClosedAt: lifecycleState >= ElectionLifecycleStateProto.Closed ? timestamp : undefined,
    FinalizedAt: lifecycleState >= ElectionLifecycleStateProto.Finalized ? timestamp : undefined,
    OpenArtifactId: '',
    CloseArtifactId: '',
    FinalizeArtifactId: '',
  };
}

function createElectionResponse(
  electionId: string,
  lifecycleState: ElectionLifecycleStateProto,
  title: string
): GetElectionResponse {
  return {
    Success: true,
    ErrorMessage: '',
    Election: createElectionRecord(electionId, lifecycleState, title),
    WarningAcknowledgements: [],
    TrusteeInvitations: [],
    BoundaryArtifacts: [],
    GovernedProposals: [],
    GovernedProposalApprovals: [],
    CeremonyProfiles: [],
    CeremonyVersions: [],
    CeremonyTranscriptEvents: [],
    ActiveCeremonyTrusteeStates: [],
  };
}

function createGrant(actorPublicAddress: string): ElectionReportAccessGrantView {
  return {
    Id: 'grant-1',
    ElectionId: 'election-1',
    ActorPublicAddress: actorPublicAddress,
    GrantRole: ElectionReportAccessGrantRoleProto.ReportAccessGrantDesignatedAuditor,
    GrantedAt: timestamp,
    GrantedByPublicAddress: 'actor-address',
  };
}

function createHubViewResponse(): GetElectionHubViewResponse {
  return {
    Success: true,
    ErrorMessage: '',
    ActorPublicAddress: 'actor-address',
    Elections: [
      createHubEntry('election-1', ElectionLifecycleStateProto.Open, 'Open Election'),
      createHubEntry('election-2', ElectionLifecycleStateProto.Draft, 'Draft Election'),
    ],
    HasAnyElectionRoles: true,
    EmptyStateReason: '',
  };
}

function createGrantResponse(grants: ElectionReportAccessGrantView[]): GetElectionReportAccessGrantsResponse {
  return {
    Success: true,
    ErrorMessage: '',
    ActorPublicAddress: 'actor-address',
    CanManageGrants: true,
    DeniedReason: '',
    Grants: grants,
  };
}

describe('useElectionsStore FEAT-103 hub state', () => {
  beforeEach(() => {
    useElectionsStore.getState().reset();
    electionsServiceMock.getElection.mockReset();
    electionsServiceMock.getElectionHubView.mockReset();
    electionsServiceMock.getElectionReportAccessGrants.mockReset();
    identityServiceMock.searchByDisplayName.mockReset();
    blockchainServiceMock.submitTransaction.mockReset();
    transactionServiceMock.createElectionReportAccessGrantTransaction.mockReset();
  });

  it('loads the actor-scoped hub and selects the first election by default', async () => {
    electionsServiceMock.getElectionHubView.mockResolvedValue(createHubViewResponse());
    electionsServiceMock.getElection.mockResolvedValue(
      createElectionResponse('election-1', ElectionLifecycleStateProto.Open, 'Open Election')
    );
    electionsServiceMock.getElectionReportAccessGrants.mockResolvedValue(createGrantResponse([]));

    await useElectionsStore.getState().loadElectionHub('actor-address');

    const state = useElectionsStore.getState();
    expect(state.actorPublicAddress).toBe('actor-address');
    expect(state.hubEntries).toHaveLength(2);
    expect(state.selectedElectionId).toBe('election-1');
    expect(state.selectedHubEntry?.Election.Title).toBe('Open Election');
    expect(electionsServiceMock.getElection).toHaveBeenCalledWith({ ElectionId: 'election-1' });
    expect(electionsServiceMock.getElectionReportAccessGrants).toHaveBeenCalledWith({
      ElectionId: 'election-1',
      ActorPublicAddress: 'actor-address',
    });
  });

  it('searches grant candidates through one store action', async () => {
    identityServiceMock.searchByDisplayName.mockResolvedValue({
      Identities: [
        {
          DisplayName: 'Auditor Alice',
          PublicSigningAddress: 'auditor-address',
          PublicEncryptAddress: 'auditor-encrypt-address',
        },
      ],
    });

    await useElectionsStore.getState().searchGrantCandidates('alice');

    const state = useElectionsStore.getState();
    expect(identityServiceMock.searchByDisplayName).toHaveBeenCalledWith('alice');
    expect(state.grantSearchResults).toHaveLength(1);
    expect(state.grantSearchResults[0].PublicSigningAddress).toBe('auditor-address');
  });

  it('creates a designated-auditor grant and refreshes hub grant state', async () => {
    useElectionsStore.setState({
      actorPublicAddress: 'actor-address',
      ownerPublicAddress: 'actor-address',
      selectedElectionId: 'election-1',
      hubEntries: [createHubEntry('election-1', ElectionLifecycleStateProto.Open, 'Open Election')],
    });

    transactionServiceMock.createElectionReportAccessGrantTransaction.mockResolvedValue({
      signedTransaction: 'signed-grant-tx',
    });
    blockchainServiceMock.submitTransaction.mockResolvedValue({
      successful: true,
      message: '',
    });
    electionsServiceMock.getElectionReportAccessGrants.mockResolvedValue(
      createGrantResponse([createGrant('auditor-address')])
    );
    electionsServiceMock.getElectionHubView.mockResolvedValue(createHubViewResponse());
    electionsServiceMock.getElection.mockResolvedValue(
      createElectionResponse('election-1', ElectionLifecycleStateProto.Open, 'Open Election')
    );

    const result = await useElectionsStore.getState().createReportAccessGrant(
      'auditor-address',
      'actor-encrypt-address',
      'actor-private-encrypt-key',
      'actor-signing-private-key'
    );

    const state = useElectionsStore.getState();
    expect(result).toBe(true);
    expect(
      transactionServiceMock.createElectionReportAccessGrantTransaction
    ).toHaveBeenCalledWith(
      'election-1',
      'actor-address',
      'actor-encrypt-address',
      'actor-private-encrypt-key',
      'auditor-address',
      'actor-signing-private-key'
    );
    expect(blockchainServiceMock.submitTransaction).toHaveBeenCalledWith('signed-grant-tx');
    expect(state.reportAccessGrants).toHaveLength(1);
    expect(state.feedback?.tone).toBe('success');
  });
});
