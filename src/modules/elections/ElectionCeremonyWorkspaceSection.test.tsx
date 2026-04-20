import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GetElectionCeremonyActionViewResponse, GetElectionResponse } from '@/lib/grpc';
import {
  ElectionBindingStatusProto,
  ElectionCeremonyVersionStatusProto,
  ElectionGovernanceModeProto,
  ElectionLifecycleStateProto,
  ElectionTrusteeCeremonyStateProto,
  ElectionTrusteeInvitationStatusProto,
} from '@/lib/grpc';
import { ElectionCeremonyWorkspaceSection } from './ElectionCeremonyWorkspaceSection';

const timestamp = { seconds: 1_713_000_000, nanos: 0 };

type ElectionDetailOverrides = Partial<Omit<GetElectionResponse, 'Election'>> & {
  Election?: Partial<NonNullable<GetElectionResponse['Election']>>;
};

function createElectionDetail(
  overrides?: ElectionDetailOverrides,
): GetElectionResponse {
  const election = {
    ElectionId: 'election-1',
    Title: 'Election with Trustees I',
    ShortDescription: '',
    OwnerPublicAddress: 'owner-public-key',
    LifecycleState: ElectionLifecycleStateProto.Draft,
    GovernanceMode: ElectionGovernanceModeProto.TrusteeThreshold,
    BindingStatus: ElectionBindingStatusProto.Binding,
    SelectedProfileId: 'dkg-prod-1of1',
    SelectedProfileDevOnly: false,
    RequiredApprovalCount: 1,
    ...(overrides?.Election ?? {}),
  };

  const detail: GetElectionResponse = {
    Success: true,
    ErrorMessage: '',
    Election: election,
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

  return {
    ...detail,
    ...overrides,
    Election: election,
  };
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

function createReadyElectionWithPendingLegacyValidation(): GetElectionResponse {
  const detail = createElectionDetail({
    CeremonyVersions: [
      {
        Id: 'ceremony-version-1',
        ElectionId: 'election-1',
        VersionNumber: 1,
        ProfileId: 'dkg-prod-3of5',
        Status: ElectionCeremonyVersionStatusProto.CeremonyVersionReady,
        TrusteeCount: 5,
        RequiredApprovalCount: 3,
        TallyPublicKeyFingerprint: 'fingerprint-1',
        StartedAt: timestamp,
        CompletedAt: timestamp,
        StartedByPublicAddress: 'owner-public-key',
        IsActive: true,
      },
    ],
  });

  return {
    ...detail,
    ActiveCeremonyTrusteeStates: [
      {
        ...detail.ActiveCeremonyTrusteeStates[0],
        TrusteeDisplayName: 'TrusteeOne',
        TrusteeUserAddress: 'trustee-one',
        State: ElectionTrusteeCeremonyStateProto.CeremonyStateCompleted,
        CompletedAt: timestamp,
      },
      {
        ...detail.ActiveCeremonyTrusteeStates[0],
        Id: 'state-2',
        TrusteeDisplayName: 'TrusteeThree',
        TrusteeUserAddress: 'trustee-three',
        State: ElectionTrusteeCeremonyStateProto.CeremonyStateCompleted,
        CompletedAt: timestamp,
      },
      {
        ...detail.ActiveCeremonyTrusteeStates[0],
        Id: 'state-3',
        TrusteeDisplayName: 'TrusteeFour',
        TrusteeUserAddress: 'trustee-four',
        State: ElectionTrusteeCeremonyStateProto.CeremonyStateCompleted,
        CompletedAt: timestamp,
      },
      {
        ...detail.ActiveCeremonyTrusteeStates[0],
        Id: 'state-4',
        TrusteeDisplayName: 'LateTrustee',
        TrusteeUserAddress: 'trustee-late',
        State: ElectionTrusteeCeremonyStateProto.CeremonyStateMaterialSubmitted,
        ShareVersion: 'share-late-v1',
      },
    ],
    TrusteeInvitations: [
      {
        ...detail.TrusteeInvitations[0],
        TrusteeDisplayName: 'TrusteeOne',
        TrusteeUserAddress: 'trustee-one',
      },
      {
        ...detail.TrusteeInvitations[0],
        Id: 'invite-2',
        TrusteeDisplayName: 'TrusteeThree',
        TrusteeUserAddress: 'trustee-three',
      },
      {
        ...detail.TrusteeInvitations[0],
        Id: 'invite-3',
        TrusteeDisplayName: 'TrusteeFour',
        TrusteeUserAddress: 'trustee-four',
      },
      {
        ...detail.TrusteeInvitations[0],
        Id: 'invite-4',
        TrusteeDisplayName: 'LateTrustee',
        TrusteeUserAddress: 'trustee-late',
      },
      {
        ...detail.TrusteeInvitations[0],
        Id: 'invite-5',
        TrusteeDisplayName: 'TrusteeFive',
        TrusteeUserAddress: 'trustee-five',
      },
    ],
    CeremonyTranscriptEvents: [
      {
        Id: 'event-ready',
        CeremonyVersionId: 'ceremony-version-1',
        VersionNumber: 1,
        EventType: 0,
        ActorPublicAddress: 'owner-public-key',
        TrusteeUserAddress: '',
        TrusteeDisplayName: '',
        TrusteeState: undefined,
        EventSummary: 'Ceremony version 1 validated every bound trustee package and is ready.',
        EvidenceReference: '',
        RestartReason: '',
        TallyPublicKeyFingerprint: 'fingerprint-1',
        OccurredAt: { seconds: 1_713_000_050, nanos: 0 },
        HasTrusteeState: false,
      },
      ...detail.CeremonyTranscriptEvents,
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
      await screen.findByText(/This marks exactly one bound trustee package complete for the active version\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/server derives the ceremony tally public key from the recorded trustee commitments/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('elections-ceremony-validation-confirm-button'));

    await waitFor(() => {
      expect(handleCompleteTrustee).toHaveBeenCalledWith(
        'trustee-one',
        'share-v1',
        null,
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

  it('keeps owner approval available for a ready legacy version that still has incomplete trustee packages', () => {
    render(
      <ElectionCeremonyWorkspaceSection
        detail={createReadyElectionWithPendingLegacyValidation()}
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

    expect(screen.getByTestId('elections-ceremony-approve-next')).toBeInTheDocument();
    expect(screen.getByTestId('elections-ceremony-complete-trustee-late')).toBeInTheDocument();
    expect(screen.getByText('Validated for active version')).toBeInTheDocument();
    expect(screen.getAllByText('3 of 5').length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Approve the available trustee shares one trustee at a time until all 5 bound trustee packages are completed\./i),
    ).toBeInTheDocument();
    expect(screen.queryByText('Needs new version')).not.toBeInTheDocument();
  });

  it('shows mode-aware ceremony profile guidance', async () => {
    render(
      <ElectionCeremonyWorkspaceSection
        detail={createElectionDetail({
          Election: {
            BindingStatus: ElectionBindingStatusProto.NonBinding,
            SelectedProfileId: 'dkg-dev-open-1of1',
            SelectedProfileDevOnly: true,
          },
          CeremonyProfiles: [
            {
              ProfileId: 'dkg-dev-open-1of1',
              DisplayName: 'Open Audit 1 of 1',
              Description: 'Readable ballot audit profile.',
              ProviderKey: 'provider-dev',
              ProfileVersion: 'v1',
              TrusteeCount: 1,
              RequiredApprovalCount: 1,
              DevOnly: true,
              RegisteredAt: timestamp,
              LastUpdatedAt: timestamp,
            },
          ],
          CeremonyVersions: [],
          CeremonyTranscriptEvents: [],
          ActiveCeremonyTrusteeStates: [],
        })}
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
      screen.getByTestId('elections-ceremony-mode-profile-summary'),
    ).toHaveTextContent('Non-binding election');
    expect(
      screen.getByTestId('elections-ceremony-mode-profile-summary'),
    ).toHaveTextContent('dev/open and non-dev circuits');
    expect(
      screen.getByTestId('elections-ceremony-mode-profile-summary'),
    ).toHaveTextContent('Change the selection in Draft Policy before starting or restarting the ceremony');
    expect(
      await screen.findByText(/Current selection: Open Audit 1 of 1\./i),
    ).toBeInTheDocument();
  });
});
