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
  getElectionHubNarrative,
  getElectionHubDisplayActionLabel,
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
  it('keeps open mixed-role entries focused on the voter and owner surfaces before results exist', () => {
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
    ]);
  });

  it('keeps a workspace artifact section for mixed-role voters when a report package is available', () => {
    const entry = createHubEntry('election-3', ElectionLifecycleStateProto.Finalized, {
      ActorRoles: {
        IsOwnerAdmin: true,
        IsTrustee: false,
        IsVoter: true,
        IsDesignatedAuditor: false,
      },
      CanViewParticipantResults: true,
      CanViewReportPackage: true,
    });

    expect(getElectionWorkspaceSectionOrder(entry)).toEqual([
      'owner-admin',
      'voter',
      'artifacts',
    ]);
  });

  it('derives the closed-progress banner directly from server truth', () => {
    const entry = createHubEntry('election-2', ElectionLifecycleStateProto.Closed, {
      ClosedProgressStatus:
        ElectionClosedProgressStatusProto.ClosedProgressWaitingForTrusteeShares,
    });

    expect(getClosedProgressBannerState(entry)).toEqual({
      title: 'Waiting for trustee tally shares',
      description:
        'The election is closed and waiting for the required trustee tally shares before votes can be counted and the unofficial result can be published.',
    });
  });

  it('prioritizes the owner narrative for mixed-role closed-progress entries', () => {
    const entry = createHubEntry('election-2b', ElectionLifecycleStateProto.Closed, {
      ActorRoles: {
        IsOwnerAdmin: true,
        IsTrustee: false,
        IsVoter: true,
        IsDesignatedAuditor: false,
      },
      ClosedProgressStatus:
        ElectionClosedProgressStatusProto.ClosedProgressWaitingForTrusteeShares,
    });

    expect(getClosedProgressBannerState(entry)).toEqual({
      title: 'Waiting for trustee tally shares',
      description:
        'Governed close is complete. Vote casting is locked, and the election is waiting for eligible trustees to provide the bound tally shares required to count votes and publish the unofficial result.',
    });
    expect(getElectionHubNarrative(entry)).toContain(
      'Governed close is complete. Vote casting is locked'
    );
  });

  it('maps hub suggested actions into stable client labels', () => {
    expect(
      getElectionHubSuggestedActionLabel(
        ElectionHubNextActionHintProto.ElectionHubActionAuditorReviewPackage
      )
    ).toBe('Review package');
  });

  it('promotes ceremony follow-up reasons into trustee-facing action labels', () => {
    const entry = createHubEntry('election-4', ElectionLifecycleStateProto.Draft, {
      ActorRoles: {
        IsOwnerAdmin: false,
        IsTrustee: true,
        IsVoter: false,
        IsDesignatedAuditor: false,
      },
      SuggestedAction: ElectionHubNextActionHintProto.ElectionHubActionNone,
      SuggestedActionReason:
        'Continue the trustee ceremony. Publish your ceremony transport key first.',
    });

    expect(getElectionHubDisplayActionLabel(entry)).toBe('Continue ceremony');
  });

  it('promotes trustee invitation reasons into a response label', () => {
    const entry = createHubEntry('election-5', ElectionLifecycleStateProto.Draft, {
      SuggestedAction: ElectionHubNextActionHintProto.ElectionHubActionNone,
      SuggestedActionReason: 'A trustee invitation is waiting for your response.',
    });

    expect(getElectionHubDisplayActionLabel(entry)).toBe('Respond to invitation');
  });

  it('promotes close-counting share reasons into a trustee tally-share label', () => {
    const entry = createHubEntry('election-6', ElectionLifecycleStateProto.Closed, {
      ActorRoles: {
        IsOwnerAdmin: false,
        IsTrustee: true,
        IsVoter: false,
        IsDesignatedAuditor: false,
      },
      SuggestedAction: ElectionHubNextActionHintProto.ElectionHubActionNone,
      SuggestedActionReason: 'Submit the bound trustee tally share for close-counting.',
    });

    expect(getElectionHubDisplayActionLabel(entry)).toBe('Submit tally share');
  });

  it('promotes published unofficial results into an explicit review label and narrative', () => {
    const entry = createHubEntry('election-6a', ElectionLifecycleStateProto.Closed, {
      ActorRoles: {
        IsOwnerAdmin: false,
        IsTrustee: true,
        IsVoter: false,
        IsDesignatedAuditor: false,
      },
      SuggestedAction: ElectionHubNextActionHintProto.ElectionHubActionTrusteeReviewResult,
      SuggestedActionReason: 'Review the available election result artifacts.',
      HasUnofficialResult: true,
      HasOfficialResult: false,
    });

    expect(getElectionHubDisplayActionLabel(entry)).toBe('Review unofficial result');
    expect(getElectionHubNarrative(entry)).toContain(
      'Election close is complete and the unofficial result is published.'
    );
  });

  it('promotes closed voter entries into an unofficial-result waiting label', () => {
    const entry = createHubEntry('election-6b', ElectionLifecycleStateProto.Closed, {
      ActorRoles: {
        IsOwnerAdmin: false,
        IsTrustee: false,
        IsVoter: true,
        IsDesignatedAuditor: false,
      },
      SuggestedAction: ElectionHubNextActionHintProto.ElectionHubActionNone,
      SuggestedActionReason: 'No immediate action is required for this election.',
      ClosedProgressStatus:
        ElectionClosedProgressStatusProto.ClosedProgressWaitingForTrusteeShares,
      HasUnofficialResult: false,
      HasOfficialResult: false,
    });

    expect(getElectionHubDisplayActionLabel(entry)).toBe('Waiting for unofficial result');
  });

  it('promotes rejected close-counting share reasons into a trustee resubmit label', () => {
    const entry = createHubEntry('election-7', ElectionLifecycleStateProto.Closed, {
      ActorRoles: {
        IsOwnerAdmin: false,
        IsTrustee: true,
        IsVoter: false,
        IsDesignatedAuditor: false,
      },
      SuggestedAction: ElectionHubNextActionHintProto.ElectionHubActionNone,
      SuggestedActionReason: 'Resubmit the bound trustee tally share for close-counting.',
    });

    expect(getElectionHubDisplayActionLabel(entry)).toBe('Resubmit tally share');
  });

  it('formats non-string artifact values without throwing', () => {
    expect(formatArtifactValue({ value: '1234567890abcdefghijklmnopqrstuvwxyz' })).toBe(
      '1234567890ab...stuvwxyz'
    );
    expect(formatArtifactValue({ raw: [1, 2, 3], length: 32 })).toContain('{"raw":[1,2');
  });
});
