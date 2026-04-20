import { describe, expect, it } from 'vitest';
import {
  ElectionCeremonyActionTypeProto,
  ElectionCeremonyActorRoleProto,
  ElectionCeremonyVersionStatusProto,
  ElectionBindingStatusProto,
  ElectionGovernanceModeProto,
  ElectionTrusteeCeremonyStateProto,
  type GetElectionCeremonyActionViewResponse,
  type GetElectionResponse,
} from '@/lib/grpc';
import {
  createDefaultElectionDraft,
  getFixedCeremonyProfileShape,
  getAllowedCeremonyProfiles,
  getCeremonyActionViewStates,
  getCeremonyActorRoleLabel,
  getModeProfileFamilyLabel,
  getModeProfileFreezeCopy,
  getCeremonyVersionStatusLabel,
  getTrusteeCeremonyStateLabel,
  normalizeElectionDraft,
} from './contracts';

describe('ceremony contract helpers', () => {
  it('maps owner and trustee action availability into stable UI states', () => {
    const view: GetElectionCeremonyActionViewResponse = {
      Success: true,
      ErrorMessage: '',
      ActorRole: ElectionCeremonyActorRoleProto.CeremonyActorTrustee,
      ActorPublicAddress: 'trustee-a',
      OwnerActions: [
        {
          ActionType: ElectionCeremonyActionTypeProto.CeremonyActionStartVersion,
          IsAvailable: true,
          IsCompleted: false,
          Reason: 'Start a ceremony version.',
        },
      ],
      TrusteeActions: [
        {
          ActionType: ElectionCeremonyActionTypeProto.CeremonyActionPublishTransportKey,
          IsAvailable: false,
          IsCompleted: true,
          Reason: 'Transport key already published.',
        },
        {
          ActionType: ElectionCeremonyActionTypeProto.CeremonyActionRunSelfTest,
          IsAvailable: true,
          IsCompleted: false,
          Reason: 'Run the mandatory self-test.',
        },
      ],
      PendingIncomingMessageCount: 1,
      BlockedReasons: [],
    };

    const ownerStates = getCeremonyActionViewStates(view, 'owner');
    const trusteeStates = getCeremonyActionViewStates(view, 'trustee');

    expect(ownerStates).toHaveLength(1);
    expect(ownerStates[0].status).toBe('available');
    expect(trusteeStates).toHaveLength(2);
    expect(trusteeStates[0].status).toBe('completed');
    expect(trusteeStates[1].status).toBe('available');
  });

  it('returns ceremony labels and allowed profiles from the detail model', () => {
    const detail: GetElectionResponse = {
      Success: true,
      ErrorMessage: '',
      Election: {
        ElectionId: 'election-1',
        Title: 'Trustee draft',
        ShortDescription: '',
        OwnerPublicAddress: 'owner',
        ExternalReferenceCode: '',
        LifecycleState: 0,
        ElectionClass: 0,
        BindingStatus: ElectionBindingStatusProto.Binding,
        SelectedProfileId: 'prod-3of5-v1',
        SelectedProfileDevOnly: false,
        GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
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
          BlankVoteExcludedFromThresholdDenominator: true,
          TieResolutionRule: 'tie_unresolved',
          CalculationBasis: 'plurality_of_non_blank_votes',
        },
        ApprovedClientApplications: [],
        ProtocolOmegaVersion: 'omega-v1.0.0',
        ReportingPolicy: 0,
        ReviewWindowPolicy: 0,
        CurrentDraftRevision: 1,
        Options: [],
        AcknowledgedWarningCodes: [],
        RequiredApprovalCount: 3,
        CreatedAt: { seconds: 1, nanos: 0 },
        LastUpdatedAt: { seconds: 1, nanos: 0 },
        OpenedAt: undefined,
        ClosedAt: undefined,
        FinalizedAt: undefined,
        OpenArtifactId: '',
        CloseArtifactId: '',
        FinalizeArtifactId: '',
      },
      WarningAcknowledgements: [],
      TrusteeInvitations: [],
      BoundaryArtifacts: [],
      GovernedProposals: [],
      GovernedProposalApprovals: [],
      CeremonyProfiles: [
        {
          ProfileId: 'prod-3of5-v1',
          DisplayName: 'Production 3 of 5',
          Description: 'Production rollout profile',
          ProviderKey: 'provider-a',
          ProfileVersion: 'v1',
          TrusteeCount: 5,
          RequiredApprovalCount: 3,
          DevOnly: false,
          RegisteredAt: { seconds: 1, nanos: 0 },
          LastUpdatedAt: { seconds: 1, nanos: 0 },
        },
      ],
      CeremonyVersions: [],
      CeremonyTranscriptEvents: [],
      ActiveCeremonyTrusteeStates: [],
    };

    expect(
      getAllowedCeremonyProfiles(
        detail,
        undefined,
        ElectionGovernanceModeProto.TrusteeThreshold,
      ),
    ).toHaveLength(1);
    expect(getFixedCeremonyProfileShape(detail)).toEqual({
      trusteeCount: 5,
      requiredApprovalCount: 3,
    });
    expect(getModeProfileFamilyLabel(ElectionBindingStatusProto.Binding)).toBe(
      'non-dev circuits',
    );
    expect(getModeProfileFreezeCopy(ElectionBindingStatusProto.NonBinding)).toContain(
      'dev/open circuit or a non-dev circuit',
    );
    expect(getCeremonyVersionStatusLabel(ElectionCeremonyVersionStatusProto.CeremonyVersionReady)).toBe('Ready');
    expect(getTrusteeCeremonyStateLabel(ElectionTrusteeCeremonyStateProto.CeremonyStateValidationFailed)).toBe('Validation failed');
    expect(getCeremonyActorRoleLabel(ElectionCeremonyActorRoleProto.CeremonyActorTrustee)).toBe('Trustee');
  });

  it('falls back to the requested governance family when the loaded election detail belongs to another family', () => {
    const detail: GetElectionResponse = {
      Success: true,
      ErrorMessage: '',
      WarningAcknowledgements: [],
      TrusteeInvitations: [],
      BoundaryArtifacts: [],
      GovernedProposals: [],
      GovernedProposalApprovals: [],
      Election: {
        ElectionId: 'election-1',
        Title: 'Admin draft',
        ShortDescription: '',
        OwnerPublicAddress: 'owner',
        ExternalReferenceCode: '',
        LifecycleState: 0,
        ElectionClass: 0,
        BindingStatus: ElectionBindingStatusProto.Binding,
        SelectedProfileId: 'admin-prod-1of1',
        SelectedProfileDevOnly: false,
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
          BlankVoteExcludedFromThresholdDenominator: true,
          TieResolutionRule: 'tie_unresolved',
          CalculationBasis: 'plurality_of_non_blank_votes',
        },
        ApprovedClientApplications: [],
        ProtocolOmegaVersion: 'omega-v1.0.0',
        ReportingPolicy: 0,
        ReviewWindowPolicy: 0,
        CurrentDraftRevision: 1,
        Options: [],
        AcknowledgedWarningCodes: [],
        RequiredApprovalCount: undefined,
        CreatedAt: { seconds: 1, nanos: 0 },
        LastUpdatedAt: { seconds: 1, nanos: 0 },
        OpenedAt: undefined,
        ClosedAt: undefined,
        FinalizedAt: undefined,
        OpenArtifactId: '',
        CloseArtifactId: '',
        FinalizeArtifactId: '',
      },
      CeremonyProfiles: [
        {
          ProfileId: 'admin-prod-1of1',
          DisplayName: 'Admin-only protected circuit',
          Description: 'Admin protected',
          ProviderKey: 'built-in-admin',
          ProfileVersion: 'omega-v1.0.0-admin-prod-1of1',
          TrusteeCount: 1,
          RequiredApprovalCount: 1,
          DevOnly: false,
          RegisteredAt: { seconds: 1, nanos: 0 },
          LastUpdatedAt: { seconds: 1, nanos: 0 },
        },
      ],
      CeremonyVersions: [],
      CeremonyTranscriptEvents: [],
      ActiveCeremonyTrusteeStates: [],
    };

    const trusteeProfiles = getAllowedCeremonyProfiles(
      detail,
      ElectionBindingStatusProto.Binding,
      ElectionGovernanceModeProto.TrusteeThreshold,
    );

    expect(trusteeProfiles.map((profile) => profile.ProfileId)).toEqual([
      'dkg-prod-3of5',
    ]);
    expect(getFixedCeremonyProfileShape(detail)).toBeNull();
  });

  it('aligns trustee-threshold approval count to the selected trustee profile during normalization', () => {
    const normalizedDraft = normalizeElectionDraft({
      ...createDefaultElectionDraft(),
      Title: 'Board Election',
      GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
      BindingStatus: ElectionBindingStatusProto.Binding,
      SelectedProfileId: 'dkg-prod-3of5',
      RequiredApprovalCount: 1,
    });

    expect(normalizedDraft.SelectedProfileId).toBe('dkg-prod-3of5');
    expect(normalizedDraft.RequiredApprovalCount).toBe(3);
  });
});
