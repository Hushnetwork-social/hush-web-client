import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ElectionHubNextActionHintProto,
  ElectionLifecycleStateProto,
  ElectionParticipationStatusProto,
} from '@/lib/grpc';
import { VoterWorkspaceSummary } from './HushVotingVoterSection';
import {
  createHubEntry,
  createResultArtifact,
  createResultView,
} from './HushVotingWorkspaceTestUtils';

const { electionsServiceMock } = vi.hoisted(() => ({
  electionsServiceMock: {
    getElectionVotingView: vi.fn(),
    verifyElectionReceipt: vi.fn(),
  },
}));

vi.mock('@/lib/grpc/services/elections', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/grpc/services/elections')>();
  return {
    ...actual,
    electionsService: {
      ...actual.electionsService,
      getElectionVotingView: (...args: unknown[]) =>
        electionsServiceMock.getElectionVotingView(...args),
      verifyElectionReceipt: (...args: unknown[]) =>
        electionsServiceMock.verifyElectionReceipt(...args),
    },
  };
});

describe('VoterWorkspaceSummary', () => {
  beforeEach(() => {
    cleanup();
    electionsServiceMock.getElectionVotingView.mockReset();
    electionsServiceMock.verifyElectionReceipt.mockReset();
    localStorage.clear();
    sessionStorage.clear();
    electionsServiceMock.getElectionVotingView.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      HasAcceptedAt: false,
      ReceiptId: '',
      AcceptanceId: '',
      ServerProof: '',
      PersonalParticipationStatus: ElectionParticipationStatusProto.ParticipationDidNotVote,
    });
    electionsServiceMock.verifyElectionReceipt.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      ActorPublicAddress: 'actor-address',
      ElectionId: 'election-open',
      LifecycleState: ElectionLifecycleStateProto.Open,
      HasAcceptedCheckoff: true,
      ReceiptMatchesAcceptedCheckoff: true,
      ParticipationCountedAsVoted: true,
      TallyVerificationAvailable: false,
      VerifiedReceiptId: 'rcpt-open-1',
      VerifiedAcceptanceId: 'acceptance-open-1',
      VerifiedServerProof: 'server-proof-open-1',
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the pre-link voter action when identity claim is still required', async () => {
    const entry = createHubEntry(
      'election-claim',
      ElectionLifecycleStateProto.Finalized,
      'Claim-Link Election',
      {
        ActorRoles: {
          IsOwnerAdmin: false,
          IsTrustee: false,
          IsVoter: false,
          IsDesignatedAuditor: false,
        },
        CanClaimIdentity: true,
        CanViewParticipantResults: false,
        CanViewReportPackage: false,
        CanViewNamedParticipationRoster: false,
        HasUnofficialResult: false,
        HasOfficialResult: false,
        SuggestedAction: ElectionHubNextActionHintProto.ElectionHubActionNone,
      }
    );

    render(
      <VoterWorkspaceSummary
        entry={entry}
        actorPublicAddress="actor-address"
        resultView={null}
      />
    );

    expect(await screen.findByTestId('hush-voting-section-voter')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open identity and eligibility' })).toHaveAttribute(
      'href',
      '/elections/election-claim/eligibility'
    );
  });

  it('shows the hub receipt verifier only after the voter already has an accepted checkoff record', async () => {
    const entry = createHubEntry(
      'election-open',
      ElectionLifecycleStateProto.Open,
      'Annual Elections 2026',
      {
        ActorRoles: {
          IsOwnerAdmin: false,
          IsTrustee: false,
          IsVoter: true,
          IsDesignatedAuditor: false,
        },
        SuggestedAction: ElectionHubNextActionHintProto.ElectionHubActionNone,
        SuggestedActionReason: 'No immediate action is required for this election.',
        CanViewNamedParticipationRoster: false,
        CanViewReportPackage: false,
        CanViewParticipantResults: true,
        HasUnofficialResult: false,
        HasOfficialResult: false,
      }
    );

    electionsServiceMock.getElectionVotingView.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      HasAcceptedAt: true,
      ReceiptId: 'rcpt-open-1',
      AcceptanceId: 'acceptance-open-1',
      ServerProof: 'server-proof-open-1',
      PersonalParticipationStatus: ElectionParticipationStatusProto.ParticipationCountedAsVoted,
    });

    render(
      <VoterWorkspaceSummary
        entry={entry}
        actorPublicAddress="actor-address"
        resultView={null}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('hush-voting-voter-toggle')).toHaveAttribute('aria-expanded', 'false');
    });
    fireEvent.click(screen.getByTestId('hush-voting-voter-toggle'));
    expect(await screen.findByTestId('hush-voting-verify-receipt-trigger')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('hush-voting-verify-receipt-trigger'));
    expect(screen.getByTestId('hush-voting-receipt-input')).not.toHaveAttribute(
      'placeholder',
      expect.stringContaining('Ballot Package Commitment'),
    );
    fireEvent.change(screen.getByTestId('hush-voting-receipt-input'), {
      target: {
        value: [
          'Accepted Ballot Receipt',
          'Election ID: election-open',
          'Receipt ID: rcpt-open-1',
          'Acceptance ID: acceptance-open-1',
          'Accepted At: 03/04/2026, 14:25:12',
          'Server Proof: server-proof-open-1',
        ].join('\n'),
      },
    });
    fireEvent.click(screen.getByTestId('hush-voting-verify-receipt-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('hush-voting-receipt-result')).toHaveTextContent(
        'This voter is marked as voted'
      );
    });
    expect(electionsServiceMock.verifyElectionReceipt).toHaveBeenCalledWith({
      ElectionId: 'election-open',
      ActorPublicAddress: 'actor-address',
      ReceiptId: 'rcpt-open-1',
      AcceptanceId: 'acceptance-open-1',
      ServerProof: 'server-proof-open-1',
    });
  });

  it('confirms the finalized counted set for a verified voter receipt once the official result is sealed', async () => {
    const entry = createHubEntry(
      'election-final',
      ElectionLifecycleStateProto.Finalized,
      'Annual Elections 2026',
      {
        ActorRoles: {
          IsOwnerAdmin: false,
          IsTrustee: false,
          IsVoter: true,
          IsDesignatedAuditor: false,
        },
        SuggestedAction: ElectionHubNextActionHintProto.ElectionHubActionVoterReviewResult,
        SuggestedActionReason: 'The official result is ready for review.',
        CanViewNamedParticipationRoster: false,
        CanViewReportPackage: false,
        CanViewParticipantResults: true,
        HasUnofficialResult: true,
        HasOfficialResult: true,
      }
    );

    const resultView = createResultView({
      CanViewParticipantEncryptedResults: true,
      OfficialResult: createResultArtifact(),
    });
    electionsServiceMock.getElectionVotingView.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      HasAcceptedAt: true,
      ReceiptId: 'rcpt-final-1',
      AcceptanceId: 'acceptance-final-1',
      ServerProof: 'server-proof-final-1',
      PersonalParticipationStatus: ElectionParticipationStatusProto.ParticipationCountedAsVoted,
    });
    electionsServiceMock.verifyElectionReceipt.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      ActorPublicAddress: 'actor-address',
      ElectionId: 'election-final',
      LifecycleState: ElectionLifecycleStateProto.Finalized,
      HasAcceptedCheckoff: true,
      ReceiptMatchesAcceptedCheckoff: true,
      ParticipationCountedAsVoted: true,
      TallyVerificationAvailable: true,
      VerifiedReceiptId: 'rcpt-final-1',
      VerifiedAcceptanceId: 'acceptance-final-1',
      VerifiedServerProof: 'server-proof-final-1',
    });
    window.localStorage.setItem(
      'feat099:receipt:election-final',
      JSON.stringify({
        electionId: 'election-final',
        receiptId: 'rcpt-final-1',
        acceptanceId: 'acceptance-final-1',
        acceptedAt: '2026-04-04 14:25:12',
        ballotPackageCommitment: '85b033d06e016b1d9d392e47ff983ea3d9297da04fad13c5d32f11e7ce474e94',
        serverProof: 'server-proof-final-1',
      }),
    );

    render(
      <VoterWorkspaceSummary
        entry={entry}
        actorPublicAddress="actor-address"
        resultView={resultView}
      />
    );

    fireEvent.click(await screen.findByTestId('hush-voting-verify-receipt-trigger'));
    fireEvent.change(screen.getByTestId('hush-voting-receipt-input'), {
      target: {
        value: [
          'Accepted Ballot Receipt',
          'Election ID: election-final',
          'Receipt ID: rcpt-final-1',
          'Acceptance ID: acceptance-final-1',
          'Accepted At: 04/04/2026, 14:25:12',
          'Ballot Package Commitment: 85b033d06e016b1d9d392e47ff983ea3d9297da04fad13c5d32f11e7ce474e94',
          'Server Proof: server-proof-final-1',
        ].join('\n'),
      },
    });
    fireEvent.click(screen.getByTestId('hush-voting-verify-receipt-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('hush-voting-receipt-result')).toHaveTextContent(
        'included in the finalized counted set'
      );
    });
    expect(screen.getByTestId('hush-voting-receipt-result')).toHaveTextContent(
      'This accepted vote is included in the finalized counted set used for the official result.'
    );
    expect(screen.getByTestId('hush-voting-receipt-result')).toHaveTextContent(
      'The ballot commitment line is independently confirmed on this device.'
    );
  });

  it('shows a warning instead of full success when a finalized receipt cannot confirm the commitment line', async () => {
    const entry = createHubEntry(
      'election-final',
      ElectionLifecycleStateProto.Finalized,
      'Annual Elections 2026',
      {
        ActorRoles: {
          IsOwnerAdmin: false,
          IsTrustee: false,
          IsVoter: true,
          IsDesignatedAuditor: false,
        },
        SuggestedAction: ElectionHubNextActionHintProto.ElectionHubActionVoterReviewResult,
        SuggestedActionReason: 'The official result is ready for review.',
        CanViewNamedParticipationRoster: false,
        CanViewReportPackage: false,
        CanViewParticipantResults: true,
        HasUnofficialResult: true,
        HasOfficialResult: true,
      }
    );

    const resultView = createResultView({
      CanViewParticipantEncryptedResults: true,
      OfficialResult: createResultArtifact(),
    });
    electionsServiceMock.getElectionVotingView.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      HasAcceptedAt: true,
      ReceiptId: 'rcpt-final-1',
      AcceptanceId: 'acceptance-final-1',
      ServerProof: 'server-proof-final-1',
      PersonalParticipationStatus: ElectionParticipationStatusProto.ParticipationCountedAsVoted,
    });
    electionsServiceMock.verifyElectionReceipt.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      ActorPublicAddress: 'actor-address',
      ElectionId: 'election-final',
      LifecycleState: ElectionLifecycleStateProto.Finalized,
      HasAcceptedCheckoff: true,
      ReceiptMatchesAcceptedCheckoff: true,
      ParticipationCountedAsVoted: true,
      TallyVerificationAvailable: true,
      VerifiedReceiptId: 'rcpt-final-1',
      VerifiedAcceptanceId: 'acceptance-final-1',
      VerifiedServerProof: 'server-proof-final-1',
    });

    render(
      <VoterWorkspaceSummary
        entry={entry}
        actorPublicAddress="actor-address"
        resultView={resultView}
      />
    );

    fireEvent.click(await screen.findByTestId('hush-voting-verify-receipt-trigger'));
    fireEvent.change(screen.getByTestId('hush-voting-receipt-input'), {
      target: {
        value: [
          'Accepted Ballot Receipt',
          'Election ID: election-final',
          'Receipt ID: rcpt-final-1',
          'Acceptance ID: acceptance-final-1',
          'Accepted At: 04/04/2026, 14:25:12',
          'Server Proof: server-proof-final-1',
        ].join('\n'),
      },
    });
    fireEvent.click(screen.getByTestId('hush-voting-verify-receipt-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('hush-voting-receipt-result')).toHaveTextContent(
        'Receipt verified with incomplete commitment confirmation'
      );
    });
    expect(screen.getByTestId('hush-voting-receipt-result')).toHaveTextContent(
      'The pasted receipt text does not include a confirmable Ballot Package Commitment line.'
    );
  });

  it('rejects a pasted finalized receipt when the ballot commitment does not match the retained device receipt', async () => {
    const entry = createHubEntry(
      'election-final',
      ElectionLifecycleStateProto.Finalized,
      'Annual Elections 2026',
      {
        ActorRoles: {
          IsOwnerAdmin: false,
          IsTrustee: false,
          IsVoter: true,
          IsDesignatedAuditor: false,
        },
        SuggestedAction: ElectionHubNextActionHintProto.ElectionHubActionVoterReviewResult,
        SuggestedActionReason: 'The official result is ready for review.',
        CanViewNamedParticipationRoster: false,
        CanViewReportPackage: false,
        CanViewParticipantResults: true,
        HasUnofficialResult: true,
        HasOfficialResult: true,
      }
    );

    const resultView = createResultView({
      CanViewParticipantEncryptedResults: true,
      OfficialResult: createResultArtifact(),
    });
    electionsServiceMock.getElectionVotingView.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      HasAcceptedAt: true,
      ReceiptId: 'rcpt-final-1',
      AcceptanceId: 'acceptance-final-1',
      ServerProof: 'server-proof-final-1',
      PersonalParticipationStatus: ElectionParticipationStatusProto.ParticipationCountedAsVoted,
    });
    electionsServiceMock.verifyElectionReceipt.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      ActorPublicAddress: 'actor-address',
      ElectionId: 'election-final',
      LifecycleState: ElectionLifecycleStateProto.Finalized,
      HasAcceptedCheckoff: true,
      ReceiptMatchesAcceptedCheckoff: true,
      ParticipationCountedAsVoted: true,
      TallyVerificationAvailable: true,
      VerifiedReceiptId: 'rcpt-final-1',
      VerifiedAcceptanceId: 'acceptance-final-1',
      VerifiedServerProof: 'server-proof-final-1',
    });
    window.localStorage.setItem(
      'feat099:receipt:election-final',
      JSON.stringify({
        electionId: 'election-final',
        receiptId: 'rcpt-final-1',
        acceptanceId: 'acceptance-final-1',
        acceptedAt: '2026-04-04 14:25:12',
        ballotPackageCommitment: 'expected-commitment',
        serverProof: 'server-proof-final-1',
      }),
    );

    render(
      <VoterWorkspaceSummary
        entry={entry}
        actorPublicAddress="actor-address"
        resultView={resultView}
      />
    );

    fireEvent.click(await screen.findByTestId('hush-voting-verify-receipt-trigger'));
    fireEvent.change(screen.getByTestId('hush-voting-receipt-input'), {
      target: {
        value: [
          'Accepted Ballot Receipt',
          'Election ID: election-final',
          'Receipt ID: rcpt-final-1',
          'Acceptance ID: acceptance-final-1',
          'Accepted At: 04/04/2026, 14:25:12',
          'Ballot Package Commitment: tampered-commitment',
          'Server Proof: server-proof-final-1',
        ].join('\n'),
      },
    });
    fireEvent.click(screen.getByTestId('hush-voting-verify-receipt-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('hush-voting-receipt-result')).toHaveTextContent(
        'Receipt commitment does not match this device record'
      );
    });
    expect(screen.getByTestId('hush-voting-receipt-result')).toHaveTextContent(
      'The pasted Ballot Package Commitment does not match the receipt retained on this device'
    );
  });
});
