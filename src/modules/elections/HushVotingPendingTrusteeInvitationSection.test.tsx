import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ElectionTrusteeInvitationStatusProto } from '@/lib/grpc';
import { PendingTrusteeInvitationSummary } from './HushVotingPendingTrusteeInvitationSection';
import { timestamp } from './HushVotingWorkspaceTestUtils';

describe('PendingTrusteeInvitationSummary', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the invitation summary and trustee metadata', () => {
    render(
      <PendingTrusteeInvitationSummary
        electionTitle="Trustee Threshold Election"
        invitation={{
          Id: 'invite-1',
          ElectionId: 'election-1',
          TrusteeUserAddress: 'trustee-address',
          TrusteeDisplayName: 'Trustee Three',
          InvitedByPublicAddress: 'owner-address',
          LinkedMessageId: 'message-1',
          Status: ElectionTrusteeInvitationStatusProto.Pending,
          SentAtDraftRevision: 7,
          SentAt: timestamp,
        }}
        isSubmitting={false}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />
    );

    expect(screen.getByTestId('hush-voting-pending-trustee-invitation')).toBeInTheDocument();
    expect(screen.getByText('Respond before trustee work unlocks')).toBeInTheDocument();
    expect(screen.getByText('Pending your response')).toBeInTheDocument();
    expect(screen.getByText('Trustee Three')).toBeInTheDocument();
    expect(screen.getByText('owner-address')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('forwards accept and decline actions', () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();

    render(
      <PendingTrusteeInvitationSummary
        electionTitle="Trustee Threshold Election"
        invitation={{
          Id: 'invite-1',
          ElectionId: 'election-1',
          TrusteeUserAddress: 'trustee-address',
          TrusteeDisplayName: 'Trustee Three',
          InvitedByPublicAddress: 'owner-address',
          LinkedMessageId: 'message-1',
          Status: ElectionTrusteeInvitationStatusProto.Pending,
          SentAtDraftRevision: 7,
          SentAt: timestamp,
        }}
        isSubmitting={false}
        onAccept={onAccept}
        onReject={onReject}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Accept invitation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decline invitation' }));

    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledTimes(1);
  });
});
