import { describe, expect, it } from 'vitest';
import {
  ElectionCeremonyActionTypeProto,
  ElectionCeremonyActorRoleProto,
  ElectionCeremonyVersionStatusProto,
  ElectionTrusteeCeremonyStateProto,
  type GetElectionCeremonyActionViewResponse,
  type GetElectionResponse,
} from '@/lib/grpc';
import {
  getAllowedCeremonyProfiles,
  getCeremonyActionViewStates,
  getCeremonyActorRoleLabel,
  getCeremonyVersionStatusLabel,
  getTrusteeCeremonyStateLabel,
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

    expect(getAllowedCeremonyProfiles(detail)).toHaveLength(1);
    expect(getCeremonyVersionStatusLabel(ElectionCeremonyVersionStatusProto.CeremonyVersionReady)).toBe('Ready');
    expect(getTrusteeCeremonyStateLabel(ElectionTrusteeCeremonyStateProto.CeremonyStateValidationFailed)).toBe('Validation failed');
    expect(getCeremonyActorRoleLabel(ElectionCeremonyActorRoleProto.CeremonyActorTrustee)).toBe('Trustee');
  });
});
