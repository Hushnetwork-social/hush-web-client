import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GetElectionCeremonyActionViewResponse, GetElectionResponse } from '@/lib/grpc';
import {
  ElectionCeremonyVersionStatusProto,
  ElectionGovernanceModeProto,
  ElectionLifecycleStateProto,
  ElectionTrusteeCeremonyStateProto,
  ElectionTrusteeInvitationStatusProto,
} from '@/lib/grpc';
import { ElectionCeremonyWorkspaceSection } from './ElectionCeremonyWorkspaceSection';

const timestamp = { seconds: 1_713_000_000, nanos: 0 };

function createElectionDetail(): GetElectionResponse {
  return {
    Success: true,
    ErrorMessage: '',
    Election: {
      ElectionId: 'election-1',
      Title: 'Election with Trustees I',
      ShortDescription: '',
      OwnerPublicAddress: 'owner-public-key',
      LifecycleState: ElectionLifecycleStateProto.Draft,
      GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
      RequiredApprovalCount: 1,
    },
    CeremonyProfiles: [
      {
        ProfileId: 'dkg-prod-1of1',
        DisplayName: 'Production-Like 1 of 1',
        Description: 'Single trustee development profile.',
      },
    ],
    CeremonyVersions: [
      {
        Id: 'ceremony-version-1',
        ElectionId: 'election-1',
        VersionNumber: 1,
        ProfileId: 'dkg-prod-1of1',
        Status: ElectionCeremonyVersionStatusProto.CeremonyVersionInProgress,
        TrusteeCount: 1,
        RequiredApprovalCount: 1,
        TallyPublicKeyFingerprint: '',
        StartedAt: timestamp,
        StartedByPublicAddress: 'owner-public-key',
        IsActive: true,
      },
    ],
    CeremonyTranscriptEvents: [
      {
        Id: 'event-submit',
        CeremonyVersionId: 'ceremony-version-1',
        VersionNumber: 1,
        EventType: 0,
        ActorPublicAddress: 'trustee-one',
        TrusteeUserAddress: 'trustee-one',
        TrusteeDisplayName: 'TrusteeOne',
        TrusteeState: ElectionTrusteeCeremonyStateProto.CeremonyStateMaterialSubmitted,
        EventSummary: 'TrusteeOne submitted ceremony material of type dkg-share-package.',
        EvidenceReference: '',
        RestartReason: '',
        TallyPublicKeyFingerprint: '',
        OccurredAt: { seconds: 1_713_000_040, nanos: 0 },
        HasTrusteeState: true,
      },
      {
        Id: 'event-publish',
        CeremonyVersionId: 'ceremony-version-1',
        VersionNumber: 1,
        EventType: 0,
        ActorPublicAddress: 'trustee-one',
        TrusteeUserAddress: 'trustee-one',
        TrusteeDisplayName: 'TrusteeOne',
        TrusteeState: ElectionTrusteeCeremonyStateProto.CeremonyStateJoined,
        EventSummary: 'TrusteeOne published a ceremony transport key.',
        EvidenceReference: '',
        RestartReason: '',
        TallyPublicKeyFingerprint: '',
        OccurredAt: { seconds: 1_713_000_010, nanos: 0 },
        HasTrusteeState: true,
      },
    ],
    ActiveCeremonyTrusteeStates: [
      {
        Id: 'state-1',
        ElectionId: 'election-1',
        CeremonyVersionId: 'ceremony-version-1',
        TrusteeUserAddress: 'trustee-one',
        TrusteeDisplayName: 'TrusteeOne',
        State: ElectionTrusteeCeremonyStateProto.CeremonyStateMaterialSubmitted,
        TransportPublicKeyFingerprint: 'transport-1',
        TransportPublicKeyPublishedAt: timestamp,
        JoinedAt: timestamp,
        SelfTestSucceededAt: timestamp,
        MaterialSubmittedAt: timestamp,
        ValidationFailedAt: undefined,
        ValidationFailureReason: '',
        CompletedAt: undefined,
        ShareVersion: 'share-v1',
        LastUpdatedAt: timestamp,
      },
    ],
    TrusteeInvitations: [
      {
        Id: 'invite-1',
        ElectionId: 'election-1',
        TrusteeUserAddress: 'trustee-one',
        TrusteeDisplayName: 'TrusteeOne',
        InvitedByPublicAddress: 'owner-public-key',
        LinkedMessageId: 'message-1',
        Status: ElectionTrusteeInvitationStatusProto.Accepted,
        SentAtDraftRevision: 1,
        SentAt: timestamp,
      },
    ],
  } as GetElectionResponse;
}

function createLegacySubmittedElectionDetail(): GetElectionResponse {
  const detail = createElectionDetail();
  return {
    ...detail,
    ActiveCeremonyTrusteeStates: [
      {
        ...detail.ActiveCeremonyTrusteeStates[0],
        ShareVersion: '',
      },
    ],
  };
}

function createActionView(): GetElectionCeremonyActionViewResponse {
  return {
    Success: true,
    ErrorMessage: '',
    ActorPublicAddress: 'owner-public-key',
    BlockedReasons: [],
    OwnerActions: [],
    TrusteeActions: [],
  } as GetElectionCeremonyActionViewResponse;
}

describe('ElectionCeremonyWorkspaceSection', () => {
  it('keeps owner transcript groups collapsed by default', () => {
    render(
      <ElectionCeremonyWorkspaceSection
        detail={createElectionDetail()}
        actionView={createActionView()}
        ownerPublicAddress="owner-public-key"
        isSubmitting={false}
        isLoadingCeremonyActionView={false}
        onStart={vi.fn().mockResolvedValue(true)}
        onRestart={vi.fn().mockResolvedValue(true)}
        onCompleteTrustee={vi.fn().mockResolvedValue(true)}
        onRecordValidationFailure={vi.fn().mockResolvedValue(true)}
      />,
    );

    expect(
      screen.queryByText('TrusteeOne published a ceremony transport key.'),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByTestId('ceremony-active-group-toggle-trustee-one'),
    );

    expect(
      screen.getByText('TrusteeOne published a ceremony transport key.'),
    ).toBeInTheDocument();
  });

  it('lets the owner validate a submitted trustee package', async () => {
    const handleCompleteTrustee = vi.fn().mockResolvedValue(true);

    render(
      <ElectionCeremonyWorkspaceSection
        detail={createElectionDetail()}
        actionView={createActionView()}
        ownerPublicAddress="owner-public-key"
        isSubmitting={false}
        isLoadingCeremonyActionView={false}
        onStart={vi.fn().mockResolvedValue(true)}
        onRestart={vi.fn().mockResolvedValue(true)}
        onCompleteTrustee={handleCompleteTrustee}
        onRecordValidationFailure={vi.fn().mockResolvedValue(true)}
      />,
    );

    expect(
      screen.getByTestId('elections-ceremony-owner-validation-queue'),
    ).toHaveTextContent('Ready for approval');
    expect(screen.getByTestId('elections-ceremony-approve-next')).toBeInTheDocument();
    expect(screen.getByText('Approve TrusteeOne')).toBeInTheDocument();
    expect(screen.getAllByText('Trustee-local steps are complete.')[0]).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('elections-ceremony-approve-next'));

    expect(
      await screen.findByText(/This records exactly one approved share toward the 1-share threshold\./i),
    ).toBeInTheDocument();
    expect(screen.getByText(/tally-kc-001-/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('elections-ceremony-validation-confirm-button'));

    await waitFor(() => {
      expect(handleCompleteTrustee).toHaveBeenCalledWith(
        'trustee-one',
        'share-v1',
        expect.stringMatching(/^tally-kc-001-/),
      );
    });
  });

  it('explains when a submitted trustee package needs resubmission before approval is possible', () => {
    render(
      <ElectionCeremonyWorkspaceSection
        detail={createLegacySubmittedElectionDetail()}
        actionView={createActionView()}
        ownerPublicAddress="owner-public-key"
        isSubmitting={false}
        isLoadingCeremonyActionView={false}
        onStart={vi.fn().mockResolvedValue(true)}
        onRestart={vi.fn().mockResolvedValue(true)}
        onCompleteTrustee={vi.fn().mockResolvedValue(true)}
        onRecordValidationFailure={vi.fn().mockResolvedValue(true)}
      />,
    );

    expect(screen.getAllByText('Not ready for approval').length).toBeGreaterThan(0);
    expect(screen.getByText('Resubmission required')).toBeInTheDocument();
    expect(
      screen.getByText(/No trustee is ready for approval yet\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Step 5 is not the blocker for those trustees\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Request resubmission so the trustee can rerun self-test and submit an approvable package\./i),
    ).toBeInTheDocument();
    expect(screen.getByTestId('elections-ceremony-return-next')).toBeInTheDocument();
    expect(screen.queryByTestId('elections-ceremony-approve-next')).not.toBeInTheDocument();
  });
});
