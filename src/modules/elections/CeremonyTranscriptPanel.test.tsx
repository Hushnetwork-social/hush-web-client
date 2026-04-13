import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ElectionRecordView, GetElectionResponse } from '@/lib/grpc';
import {
  ElectionBindingStatusProto,
  ElectionCeremonyVersionStatusProto,
  ElectionClassProto,
  ElectionDisclosureModeProto,
  ElectionGovernanceModeProto,
  ElectionLifecycleStateProto,
  ElectionTrusteeCeremonyStateProto,
  EligibilityMutationPolicyProto,
  EligibilitySourceTypeProto,
  OutcomeRuleKindProto,
  ParticipationPrivacyModeProto,
  ReportingPolicyProto,
  ReviewWindowPolicyProto,
  VoteUpdatePolicyProto,
} from '@/lib/grpc';
import { CeremonyTranscriptPanel } from './CeremonyTranscriptPanel';

const timestamp = { seconds: 1_711_410_000, nanos: 0 };

function createElectionRecord(overrides?: Partial<ElectionRecordView>): ElectionRecordView {
  return {
    ElectionId: 'election-1',
    Title: 'Transcript Election',
    ShortDescription: 'Transcript test election',
    OwnerPublicAddress: 'owner-public-key',
    ExternalReferenceCode: 'REF-TRANSCRIPT',
    LifecycleState: ElectionLifecycleStateProto.Draft,
    ElectionClass: ElectionClassProto.OrganizationalRemoteVoting,
    BindingStatus: ElectionBindingStatusProto.Binding,
    GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
    DisclosureMode: ElectionDisclosureModeProto.FinalResultsOnly,
    ParticipationPrivacyMode:
      ParticipationPrivacyModeProto.PublicCheckoffAnonymousBallotPrivateChoice,
    VoteUpdatePolicy: VoteUpdatePolicyProto.SingleSubmissionOnly,
    EligibilitySourceType: EligibilitySourceTypeProto.OrganizationImportedRoster,
    EligibilityMutationPolicy: EligibilityMutationPolicyProto.FrozenAtOpen,
    OutcomeRule: {
      Kind: OutcomeRuleKindProto.PassFail,
      TemplateKey: 'pass_fail_yes_no',
      SeatCount: 1,
      BlankVoteCountsForTurnout: true,
      BlankVoteExcludedFromWinnerSelection: true,
      BlankVoteExcludedFromThresholdDenominator: true,
      TieResolutionRule: 'tie_unresolved',
      CalculationBasis: 'simple_majority_of_non_blank_votes',
    },
    ApprovedClientApplications: [{ ApplicationId: 'hushsocial', Version: '1.0.0' }],
    ProtocolOmegaVersion: 'omega-v1.0.0',
    ReportingPolicy: ReportingPolicyProto.DefaultPhaseOnePackage,
    ReviewWindowPolicy: ReviewWindowPolicyProto.GovernedReviewWindowReserved,
    CurrentDraftRevision: 1,
    Options: [],
    AcknowledgedWarningCodes: [],
    RequiredApprovalCount: 3,
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
    CeremonyVersions: [
      {
        Id: 'ceremony-version-1',
        ElectionId: 'election-1',
        VersionNumber: 1,
        ProfileId: 'prod-3of5-v1',
        Status: ElectionCeremonyVersionStatusProto.CeremonyVersionInProgress,
        TrusteeCount: 5,
        RequiredApprovalCount: 3,
        BoundTrustees: [],
        StartedByPublicAddress: 'owner-public-key',
        StartedAt: timestamp,
        SupersededReason: '',
        TallyPublicKeyFingerprint: '',
      },
    ],
    CeremonyTranscriptEvents: [
      {
        Id: 'event-owner-1',
        ElectionId: 'election-1',
        CeremonyVersionId: 'ceremony-version-1',
        VersionNumber: 1,
        EventType: 0,
        ActorPublicAddress: 'owner-public-key',
        TrusteeUserAddress: '',
        TrusteeDisplayName: '',
        TrusteeState: ElectionTrusteeCeremonyStateProto.CeremonyStateNotStarted,
        EventSummary: 'Ceremony version 1 started with profile dkg-prod-3of5.',
        EvidenceReference: '',
        RestartReason: '',
        TallyPublicKeyFingerprint: '',
        OccurredAt: { seconds: 1_711_410_001, nanos: 0 },
        HasTrusteeState: false,
      },
      {
        Id: 'event-trustee-one-1',
        ElectionId: 'election-1',
        CeremonyVersionId: 'ceremony-version-1',
        VersionNumber: 1,
        EventType: 0,
        ActorPublicAddress: 'trustee-one-address',
        TrusteeUserAddress: 'trustee-one-address',
        TrusteeDisplayName: 'TrusteeOne',
        TrusteeState: ElectionTrusteeCeremonyStateProto.CeremonyStateAcceptedTrustee,
        EventSummary: 'TrusteeOne published a ceremony transport key.',
        EvidenceReference: '',
        RestartReason: '',
        TallyPublicKeyFingerprint: '',
        OccurredAt: { seconds: 1_711_410_010, nanos: 0 },
        HasTrusteeState: true,
      },
      {
        Id: 'event-trustee-one-2',
        ElectionId: 'election-1',
        CeremonyVersionId: 'ceremony-version-1',
        VersionNumber: 1,
        EventType: 0,
        ActorPublicAddress: 'trustee-one-address',
        TrusteeUserAddress: 'trustee-one-address',
        TrusteeDisplayName: 'TrusteeOne',
        TrusteeState: ElectionTrusteeCeremonyStateProto.CeremonyStateJoined,
        EventSummary: 'TrusteeOne joined ceremony version 1.',
        EvidenceReference: '',
        RestartReason: '',
        TallyPublicKeyFingerprint: '',
        OccurredAt: { seconds: 1_711_410_020, nanos: 0 },
        HasTrusteeState: true,
      },
      {
        Id: 'event-trustee-five-1',
        ElectionId: 'election-1',
        CeremonyVersionId: 'ceremony-version-1',
        VersionNumber: 1,
        EventType: 0,
        ActorPublicAddress: 'trustee-five-address',
        TrusteeUserAddress: 'trustee-five-address',
        TrusteeDisplayName: 'TrusteeFive',
        TrusteeState: ElectionTrusteeCeremonyStateProto.CeremonyStateMaterialSubmitted,
        EventSummary: 'TrusteeFive submitted ceremony material of type dkg-share-package.',
        EvidenceReference: '',
        RestartReason: '',
        TallyPublicKeyFingerprint: '',
        OccurredAt: { seconds: 1_711_410_030, nanos: 0 },
        HasTrusteeState: true,
      },
    ],
    ActiveCeremonyTrusteeStates: [],
    ...overrides,
  };
}

describe('CeremonyTranscriptPanel', () => {
  it('groups active transcript events into collapsible participant sections', () => {
    render(<CeremonyTranscriptPanel detail={createElectionResponse()} />);

    const trusteeFiveGroup = screen.getByTestId('ceremony-active-group-toggle-trustee-five-address');
    const trusteeOneGroup = screen.getByTestId('ceremony-active-group-toggle-trustee-one-address');

    expect(screen.getByTestId('ceremony-transcript-panel')).toHaveTextContent(
      'Secret payloads stay outside this view.'
    );
    expect(screen.getByText('TrusteeFive')).toBeInTheDocument();
    expect(screen.getByText('TrusteeOne')).toBeInTheDocument();
    expect(screen.getByText('Owner / workflow')).toBeInTheDocument();
    expect(trusteeFiveGroup).toHaveTextContent(
      'TrusteeFive submitted ceremony material of type dkg-share-package.'
    );
    expect(trusteeOneGroup).toHaveTextContent('TrusteeOne joined ceremony version 1.');
    expect(screen.queryByText('TrusteeOne published a ceremony transport key.')).not.toBeInTheDocument();

    fireEvent.click(trusteeOneGroup);

    expect(screen.getAllByText('TrusteeOne joined ceremony version 1.')).toHaveLength(2);
    expect(screen.getByText('TrusteeOne published a ceremony transport key.')).toBeInTheDocument();
  });
});
