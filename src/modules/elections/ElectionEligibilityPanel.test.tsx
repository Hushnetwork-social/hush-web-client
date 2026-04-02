import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ElectionBindingStatusProto,
  ElectionClassProto,
  ElectionDisclosureModeProto,
  ElectionEligibilityActorRoleProto,
  ElectionGovernanceModeProto,
  ElectionLifecycleStateProto,
  ElectionParticipationStatusProto,
  ElectionVotingRightStatusProto,
  EligibilityMutationPolicyProto,
  EligibilitySourceTypeProto,
  OutcomeRuleKindProto,
  ParticipationPrivacyModeProto,
  ReportingPolicyProto,
  ReviewWindowPolicyProto,
  VoteUpdatePolicyProto,
  type ElectionRecordView,
  type GetElectionEligibilityViewResponse,
  type GetElectionResponse,
} from '@/lib/grpc';
import { ElectionEligibilityPanel } from './ElectionEligibilityPanel';

const { electionsServiceMock } = vi.hoisted(() => ({
  electionsServiceMock: {
    getElection: vi.fn(),
    getElectionEligibilityView: vi.fn(),
  },
}));

vi.mock('@/lib/grpc/services/elections', () => ({
  electionsService: electionsServiceMock,
}));

vi.mock('@/modules/blockchain/BlockchainService', () => ({
  submitTransaction: vi.fn(),
}));

vi.mock('./transactionService', () => ({
  createClaimElectionRosterEntryTransaction: vi.fn(),
}));

const timestamp = { seconds: 1_774_120_000, nanos: 0 };

function createElectionRecord(overrides?: Partial<ElectionRecordView>): ElectionRecordView {
  return {
    ElectionId: 'election-1',
    Title: 'Annual Elections 2026',
    ShortDescription: 'Association-wide vote',
    OwnerPublicAddress: 'owner-public-key',
    ExternalReferenceCode: 'ORG-2026-01',
    LifecycleState: ElectionLifecycleStateProto.Draft,
    ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
    BindingStatus: ElectionBindingStatusProto.Binding,
    GovernanceMode: ElectionGovernanceModeProto.AdminOnly,
    DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
    ParticipationPrivacyMode:
      ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
    VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
    EligibilitySourceType: EligibilitySourceTypeProto.OrganizationImportedRoster,
    EligibilityMutationPolicy: EligibilityMutationPolicyProto.LateActivationForRosteredVotersOnly,
    OutcomeRule: {
      Kind: OutcomeRuleKindProto.SingleWinner,
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
    ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
    ReviewWindowPolicy: ReviewWindowPolicyProto.NoReviewWindow,
    CurrentDraftRevision: 1,
    Options: [],
    AcknowledgedWarningCodes: [],
    CreatedAt: timestamp,
    LastUpdatedAt: timestamp,
    OpenArtifactId: '',
    CloseArtifactId: '',
    FinalizeArtifactId: '',
    ...overrides,
  };
}

function createElectionResponse(overrides?: Partial<GetElectionResponse>): GetElectionResponse {
  return {
    Success: true,
    ErrorMessage: '',
    Election: createElectionRecord(),
    WarningAcknowledgements: [],
    TrusteeInvitations: [],
    BoundaryArtifacts: [],
    GovernedProposals: [],
    GovernedProposalApprovals: [],
    CeremonyProfiles: [],
    CeremonyVersions: [],
    CeremonyTranscriptEvents: [],
    ActiveCeremonyTrusteeStates: [],
    ...overrides,
  };
}

function createEligibilityResponse(
  overrides?: Partial<GetElectionEligibilityViewResponse>
): GetElectionEligibilityViewResponse {
  return {
    Success: true,
    ErrorMessage: '',
    ActorPublicAddress: 'actor-public-key',
    ActorRole: ElectionEligibilityActorRoleProto.EligibilityActorLinkedVoter,
    CanImportRoster: false,
    CanActivateRoster: false,
    CanReviewRestrictedRoster: false,
    CanClaimIdentity: false,
    UsesTemporaryVerificationCode: true,
    TemporaryVerificationCode: '1111',
    Summary: {
      RosteredCount: 1,
      LinkedCount: 1,
      ActiveCount: 1,
      CurrentDenominatorCount: 1,
      CountedParticipationCount: 0,
    },
    SelfRosterEntry: {
      ElectionId: 'election-1',
      OrganizationVoterId: '10000',
      ContactType: 0,
      ContactValueHint: 'Email ending @example.org',
      LinkStatus: 1,
      VotingRightStatus: ElectionVotingRightStatusProto.VotingRightActive,
      WasPresentAtOpen: true,
      WasActiveAtOpen: true,
      InCurrentDenominator: true,
      ParticipationStatus: ElectionParticipationStatusProto.ParticipationDidNotVote,
      CountsAsParticipation: false,
    },
    RestrictedRosterEntries: [],
    ActivationEvents: [],
    EligibilitySnapshots: [],
    ...overrides,
  };
}

describe('ElectionEligibilityPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    electionsServiceMock.getElection.mockResolvedValue(createElectionResponse());
    electionsServiceMock.getElectionEligibilityView.mockResolvedValue(createEligibilityResponse());
  });

  it('shows linked voter eligibility details without FEAT copy or verification-code recap', async () => {
    render(
      <ElectionEligibilityPanel
        electionId="election-1"
        actorPublicAddress="actor-public-key"
        actorEncryptionPublicKey="actor-encryption-public-key"
        actorEncryptionPrivateKey="actor-encryption-private-key"
        actorSigningPrivateKey="actor-signing-private-key"
      />
    );

    expect(await screen.findByText('Annual Elections 2026')).toBeInTheDocument();
    expect(
      screen.getByText('Review the voter record linked to this Hush account and open the voter detail when you are ready.')
    ).toBeInTheDocument();
    expect(screen.getByText('Voter')).toBeInTheDocument();
    expect(screen.queryByText(/Role:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/FEAT-/)).not.toBeInTheDocument();
    expect(screen.queryByText(/temporary verification code/i)).not.toBeInTheDocument();
    expect(screen.getByText('Election identity')).toBeInTheDocument();
    expect(screen.getByText('Associated number')).toBeInTheDocument();
    expect(screen.getByText('Open voting detail')).toBeInTheDocument();
  });

  it('opens and closes rostered and denominator explanations', async () => {
    render(
      <ElectionEligibilityPanel
        electionId="election-1"
        actorPublicAddress="actor-public-key"
        actorEncryptionPublicKey="actor-encryption-public-key"
        actorEncryptionPrivateKey="actor-encryption-private-key"
        actorSigningPrivateKey="actor-signing-private-key"
      />
    );

    expect(await screen.findByText('Annual Elections 2026')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /about rostered/i }));
    expect(
      screen.getByText(
        'Rostered voters are all members listed on this election roster, whether they are currently eligible to vote or not.'
      )
    ).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(
      screen.queryByText(
        'Rostered voters are all members listed on this election roster, whether they are currently eligible to vote or not.'
      )
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /about denominator/i }));
    expect(
      screen.getByText(
        'Denominator is the subset of rostered voters currently counted as eligible for turnout and result calculations. Rostered but inactive members are excluded.'
      )
    ).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(
      screen.queryByText(
        'Denominator is the subset of rostered voters currently counted as eligible for turnout and result calculations. Rostered but inactive members are excluded.'
      )
    ).not.toBeInTheDocument();
  });

  it('lets admins review the roster and still self-link into the voter surface', async () => {
    electionsServiceMock.getElectionEligibilityView.mockResolvedValue(
      createEligibilityResponse({
        ActorRole: ElectionEligibilityActorRoleProto.EligibilityActorOwner,
        CanReviewRestrictedRoster: true,
        CanClaimIdentity: false,
        SelfRosterEntry: undefined,
        Summary: {
          RosteredCount: 1,
          LinkedCount: 0,
          ActiveCount: 1,
          CurrentDenominatorCount: 1,
          CountedParticipationCount: 0,
        },
        RestrictedRosterEntries: [
          {
            ElectionId: 'election-1',
            OrganizationVoterId: '10001',
            ContactType: 0,
            ContactValueHint: 'Email ending @example.org',
            LinkStatus: 0,
            VotingRightStatus: ElectionVotingRightStatusProto.VotingRightActive,
            WasPresentAtOpen: true,
            WasActiveAtOpen: true,
            InCurrentDenominator: true,
            ParticipationStatus: ElectionParticipationStatusProto.ParticipationDidNotVote,
            CountsAsParticipation: false,
          },
        ],
      })
    );

    render(
      <ElectionEligibilityPanel
        electionId="election-1"
        actorPublicAddress="actor-public-key"
        actorEncryptionPublicKey="actor-encryption-public-key"
        actorEncryptionPrivateKey="actor-encryption-private-key"
        actorSigningPrivateKey="actor-signing-private-key"
      />
    );

    expect(await screen.findByText('Annual Elections 2026')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Review the named participation roster, or link this Hush account to a voter record for this election.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Election identity')).toBeInTheDocument();
    expect(screen.getByTestId('eligibility-claim-org-id')).toBeInTheDocument();
    expect(screen.getByTestId('eligibility-claim-code')).toBeInTheDocument();
    expect(screen.getByText('Restricted participation roster')).toBeInTheDocument();
    expect(screen.getByText('10001')).toBeInTheDocument();
  });

  it('shows admin and voter roles when the owner is linked to a voter identity', async () => {
    electionsServiceMock.getElectionEligibilityView.mockResolvedValue(
      createEligibilityResponse({
        ActorRole: ElectionEligibilityActorRoleProto.EligibilityActorOwner,
        CanReviewRestrictedRoster: true,
        CanClaimIdentity: false,
        SelfRosterEntry: {
          ElectionId: 'election-1',
          OrganizationVoterId: '10001',
          ContactType: 0,
          ContactValueHint: 'Email ending @example.org',
          LinkStatus: 1,
          VotingRightStatus: ElectionVotingRightStatusProto.VotingRightActive,
          WasPresentAtOpen: true,
          WasActiveAtOpen: true,
          InCurrentDenominator: true,
          ParticipationStatus: ElectionParticipationStatusProto.ParticipationDidNotVote,
          CountsAsParticipation: false,
        },
        RestrictedRosterEntries: [
          {
            ElectionId: 'election-1',
            OrganizationVoterId: '10001',
            ContactType: 0,
            ContactValueHint: 'Email ending @example.org',
            LinkStatus: 1,
            VotingRightStatus: ElectionVotingRightStatusProto.VotingRightActive,
            WasPresentAtOpen: true,
            WasActiveAtOpen: true,
            InCurrentDenominator: true,
            ParticipationStatus: ElectionParticipationStatusProto.ParticipationDidNotVote,
            CountsAsParticipation: false,
          },
        ],
      })
    );

    render(
      <ElectionEligibilityPanel
        electionId="election-1"
        actorPublicAddress="actor-public-key"
        actorEncryptionPublicKey="actor-encryption-public-key"
        actorEncryptionPrivateKey="actor-encryption-private-key"
        actorSigningPrivateKey="actor-signing-private-key"
      />
    );

    expect(await screen.findByText('Annual Elections 2026')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Voter')).toBeInTheDocument();
    expect(screen.getAllByText('10001')).toHaveLength(2);
  });
});
