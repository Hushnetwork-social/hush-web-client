import { describe, expect, it } from 'vitest';
import type { ElectionHubEntryView, ElectionSummary } from '@/lib/grpc';
import {
  ElectionBindingStatusProto,
  ElectionClosedProgressStatusProto,
  ElectionGovernanceModeProto,
  ElectionHubNextActionHintProto,
  ElectionLifecycleStateProto,
} from '@/lib/grpc';
import {
  getClosedProgressBannerState,
  getElectionHubSuggestedActionLabel,
  getElectionWorkspaceSectionOrder,
  formatArtifactValue,
} from './contracts';

const timestamp = { seconds: 1_711_410_000, nanos: 0 };

function createSummary(
  electionId: string,
  lifecycleState: ElectionLifecycleStateProto,
  overrides?: Partial<ElectionSummary>
): ElectionSummary {
  return {
    ElectionId: electionId,
    Title: 'Board Election',
    OwnerPublicAddress: 'owner-address',
    LifecycleState: lifecycleState,
    BindingStatus: ElectionBindingStatusProto.Binding,
    GovernanceMode: ElectionGovernanceModeProto.AdminOnly,
    CurrentDraftRevision: 1,
    LastUpdatedAt: timestamp,
    ...overrides,
  };
}

function createHubEntry(
  electionId: string,
  lifecycleState: ElectionLifecycleStateProto,
  overrides?: Partial<ElectionHubEntryView>
): ElectionHubEntryView {
  return {
    Election: createSummary(electionId, lifecycleState),
    ActorRoles: {
      IsOwnerAdmin: false,
      IsTrustee: false,
      IsVoter: false,
      IsDesignatedAuditor: false,
    },
    SuggestedAction: ElectionHubNextActionHintProto.ElectionHubActionNone,
    SuggestedActionReason: '',
    CanClaimIdentity: false,
    CanViewNamedParticipationRoster: false,
    CanViewReportPackage: false,
    CanViewParticipantResults: false,
    ClosedProgressStatus: ElectionClosedProgressStatusProto.ClosedProgressNone,
    HasUnofficialResult: false,
    HasOfficialResult: false,
    ...overrides,
  };
}

describe('election hub contract helpers', () => {
  it('puts the voter section first for open mixed-role entries', () => {
    const entry = createHubEntry('election-1', ElectionLifecycleStateProto.Open, {
      ActorRoles: {
        IsOwnerAdmin: true,
        IsTrustee: false,
        IsVoter: true,
        IsDesignatedAuditor: false,
      },
      CanViewParticipantResults: true,
    });

    expect(getElectionWorkspaceSectionOrder(entry)).toEqual([
      'voter',
      'owner-admin',
      'results',
    ]);
  });

  it('derives the closed-progress banner directly from server truth', () => {
    const entry = createHubEntry('election-2', ElectionLifecycleStateProto.Closed, {
      ClosedProgressStatus:
        ElectionClosedProgressStatusProto.ClosedProgressWaitingForTrusteeShares,
    });

    expect(getClosedProgressBannerState(entry)).toEqual({
      title: 'Waiting for trustee shares',
      description:
        'The election is closed and waiting for the required trustee shares before tally work can continue.',
    });
  });

  it('maps hub suggested actions into stable client labels', () => {
    expect(
      getElectionHubSuggestedActionLabel(
        ElectionHubNextActionHintProto.ElectionHubActionAuditorReviewPackage
      )
    ).toBe('Review package');
  });

  it('formats non-string artifact values without throwing', () => {
    expect(formatArtifactValue({ value: '1234567890abcdefghijklmnopqrstuvwxyz' })).toBe(
      '1234567890ab...stuvwxyz'
    );
    expect(formatArtifactValue({ raw: [1, 2, 3], length: 32 })).toContain('{"raw":[1,2');
  });
});
