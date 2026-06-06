import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ElectionLifecycleStateProto } from '@/lib/grpc';
import { ElectionOwnAnomalyWorkspacePanel } from './ElectionOwnAnomalyWorkspacePanel';
import { createElectionRecord } from './HushVotingWorkspaceTestUtils';

const {
  electionsServiceMock,
  useElectionsStoreMock,
  loadElectionMock,
  resetMock,
} = vi.hoisted(() => ({
  electionsServiceMock: {
    getElectionAnomalyOwnThread: vi.fn(),
  },
  useElectionsStoreMock: vi.fn(),
  loadElectionMock: vi.fn(),
  resetMock: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/grpc/services/elections', () => ({
  electionsService: electionsServiceMock,
}));

vi.mock('./useElectionsStore', () => ({
  useElectionsStore: () => useElectionsStoreMock(),
}));

describe('ElectionOwnAnomalyWorkspacePanel', () => {
  beforeEach(() => {
    loadElectionMock.mockResolvedValue(null);
    useElectionsStoreMock.mockReturnValue({
      isLoadingDetail: false,
      loadElection: loadElectionMock,
      reset: resetMock,
      selectedElection: {
        Success: true,
        ErrorMessage: '',
        Election: createElectionRecord(
          'election-127',
          ElectionLifecycleStateProto.Open,
          'Non-Dev HushVoting Veritas Election III',
          { OwnerPublicAddress: 'owner-address' },
        ),
        TrusteeInvitations: [],
      },
    });
    electionsServiceMock.getElectionAnomalyOwnThread.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      ActorPublicAddress: 'operator-address',
      ElectionId: 'election-127',
      HasThread: false,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the role-neutral submitter anomaly workspace', async () => {
    render(
      <ElectionOwnAnomalyWorkspacePanel
        electionId="election-127"
        actorPublicAddress="operator-address"
        actorEncryptionPublicKey="operator-encrypt-public"
        actorEncryptionPrivateKey="operator-encrypt-private"
        actorSigningPrivateKey="operator-signing-private"
      />,
    );

    expect(screen.getByRole('link', { name: 'Back to election' })).toHaveAttribute(
      'href',
      '/elections/election-127',
    );
    expect(screen.getByText('Non-Dev HushVoting Veritas Election III')).toBeInTheDocument();
    expect(await screen.findByText('Report an anomaly')).toBeInTheDocument();
    expect(screen.getByText(/This is the submitter workspace, separate from authority triage/))
      .toBeInTheDocument();
    await waitFor(() => {
      expect(electionsServiceMock.getElectionAnomalyOwnThread).toHaveBeenCalledWith({
        ElectionId: 'election-127',
        ActorPublicAddress: 'operator-address',
      });
    });
  });
});
