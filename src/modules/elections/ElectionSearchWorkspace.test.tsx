import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { electionsService } from '@/lib/grpc/services/elections';
import { identityService } from '@/lib/grpc/services/identity';
import { ElectionBindingStatusProto, ElectionGovernanceModeProto, ElectionLifecycleStateProto } from '@/lib/grpc';
import { useAppStore } from '@/stores/useAppStore';
import { ElectionSearchWorkspace } from './ElectionSearchWorkspace';

const { mockSearchElectionDirectory, mockSearchByDisplayName } = vi.hoisted(() => ({
  mockSearchElectionDirectory: vi.fn(),
  mockSearchByDisplayName: vi.fn(),
}));

const mockPush = vi.fn();
const TEST_CREDENTIALS = {
  signingPublicKey: 'actor-address',
  signingPrivateKey: 'signing-private-key',
  encryptionPublicKey: 'encryption-public-key',
  encryptionPrivateKey: 'encryption-private-key',
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock('@/lib/grpc/services/elections', async () => {
  const actual = await vi.importActual<typeof import('@/lib/grpc/services/elections')>('@/lib/grpc/services/elections');
  return {
    ...actual,
    electionsService: {
      ...actual.electionsService,
      searchElectionDirectory: mockSearchElectionDirectory,
    },
  };
});

vi.mock('@/lib/grpc/services/identity', async () => {
  const actual = await vi.importActual<typeof import('@/lib/grpc/services/identity')>('@/lib/grpc/services/identity');
  return {
    ...actual,
    identityService: {
      ...actual.identityService,
      searchByDisplayName: mockSearchByDisplayName,
    },
  };
});

function createSummary(
  electionId: string,
  lifecycleState: ElectionLifecycleStateProto,
  title: string,
  ownerPublicAddress: string = 'actor-address'
) {
  return {
    ElectionId: electionId,
    Title: title,
    OwnerPublicAddress: ownerPublicAddress,
    LifecycleState: lifecycleState,
    BindingStatus: ElectionBindingStatusProto.Binding,
    GovernanceMode: ElectionGovernanceModeProto.AdminOnly,
    CurrentDraftRevision: 2,
    LastUpdatedAt: { seconds: 1_711_410_000, nanos: 0 },
  };
}

describe('ElectionSearchWorkspace', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockSearchElectionDirectory.mockReset();
    mockSearchByDisplayName.mockReset();
    useAppStore.setState({ credentials: TEST_CREDENTIALS });
  });

  it('searches the election directory and routes claimable results into the eligibility flow', async () => {
    mockSearchByDisplayName.mockResolvedValue({
      Identities: [
        {
          DisplayName: 'Alice Owner',
          PublicSigningAddress: 'owner-address',
          PublicEncryptAddress: 'owner-encrypt',
        },
      ],
    });
    mockSearchElectionDirectory.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      SearchTerm: 'alice',
      ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
      Elections: [],
      Entries: [
        {
          Election: createSummary(
            'election-search',
            ElectionLifecycleStateProto.Draft,
            'Board Election',
            'owner-address'
          ),
          ActorRoles: {
            IsOwnerAdmin: false,
            IsTrustee: false,
            IsVoter: false,
            IsDesignatedAuditor: false,
          },
          CanOpenEligibility: true,
          EligibilityDisabledReason: '',
        },
      ],
    });

    render(<ElectionSearchWorkspace />);

    fireEvent.change(screen.getByLabelText('Search elections'), {
      target: { value: 'alice' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search elections' }));

    await waitFor(() => {
      expect(identityService.searchByDisplayName).toHaveBeenCalledWith('alice');
      expect(electionsService.searchElectionDirectory).toHaveBeenCalledWith({
        SearchTerm: 'alice',
        OwnerPublicAddresses: ['owner-address'],
        Limit: 12,
        ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
      });
    });

    expect(await screen.findByText('Board Election')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Open eligibility/i }));

    expect(mockPush).toHaveBeenCalledWith('/elections/election-search/eligibility');
  });

  it('falls back to title-only discovery when owner alias lookup fails', async () => {
    mockSearchByDisplayName.mockRejectedValue(new Error('identity directory unavailable'));
    mockSearchElectionDirectory.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      SearchTerm: 'board',
      ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
      Elections: [],
      Entries: [
        {
          Election: createSummary(
            'election-title-only',
            ElectionLifecycleStateProto.Open,
            'Board Election'
          ),
          ActorRoles: {
            IsOwnerAdmin: false,
            IsTrustee: false,
            IsVoter: false,
            IsDesignatedAuditor: false,
          },
          CanOpenEligibility: true,
          EligibilityDisabledReason: '',
        },
      ],
    });

    render(<ElectionSearchWorkspace />);

    fireEvent.change(screen.getByLabelText('Search elections'), {
      target: { value: 'board' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search elections' }));

    await waitFor(() => {
      expect(electionsService.searchElectionDirectory).toHaveBeenCalledWith({
        SearchTerm: 'board',
        OwnerPublicAddresses: [],
        Limit: 12,
        ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
      });
    });

    expect(await screen.findByText('Board Election')).toBeInTheDocument();
  });

  it('keeps finalized elections visible but disables the eligibility action', async () => {
    mockSearchByDisplayName.mockResolvedValue({ Identities: [] });
    mockSearchElectionDirectory.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      SearchTerm: 'admin',
      ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
      Elections: [],
      Entries: [
        {
          Election: createSummary(
            'election-finalized',
            ElectionLifecycleStateProto.Finalized,
            'AdminOnly Election I'
          ),
          ActorRoles: {
            IsOwnerAdmin: false,
            IsTrustee: false,
            IsVoter: false,
            IsDesignatedAuditor: false,
          },
          CanOpenEligibility: false,
          EligibilityDisabledReason: 'Claim-link discovery is unavailable after finalization.',
        },
      ],
    });

    render(<ElectionSearchWorkspace />);

    fireEvent.change(screen.getByLabelText('Search elections'), {
      target: { value: 'admin' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search elections' }));

    expect(await screen.findByText('AdminOnly Election I')).toBeInTheDocument();
    expect(screen.getByText('Claim-link discovery is unavailable after finalization.')).toBeInTheDocument();
    expect(screen.getByText('Eligibility unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Open eligibility/i })).not.toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows mixed-role discovery correctly and still allows trustee-only or auditor-only accounts to claim-link', async () => {
    mockSearchByDisplayName.mockResolvedValue({ Identities: [] });
    mockSearchElectionDirectory.mockResolvedValue({
      Success: true,
      ErrorMessage: '',
      SearchTerm: 'admin',
      ActorPublicAddress: TEST_CREDENTIALS.signingPublicKey,
      Elections: [],
      Entries: [
        {
          Election: createSummary(
            'election-owner-claimable',
            ElectionLifecycleStateProto.Draft,
            'AdminOnly Election III'
          ),
          ActorRoles: {
            IsOwnerAdmin: true,
            IsTrustee: false,
            IsVoter: false,
            IsDesignatedAuditor: false,
          },
          CanOpenEligibility: true,
          EligibilityDisabledReason: '',
        },
        {
          Election: createSummary(
            'election-owner',
            ElectionLifecycleStateProto.Open,
            'AdminOnly Election II'
          ),
          ActorRoles: {
            IsOwnerAdmin: true,
            IsTrustee: false,
            IsVoter: false,
            IsDesignatedAuditor: true,
          },
          CanOpenEligibility: true,
          EligibilityDisabledReason: '',
        },
        {
          Election: createSummary(
            'election-trustee',
            ElectionLifecycleStateProto.Draft,
            'Trustee Election'
          ),
          ActorRoles: {
            IsOwnerAdmin: false,
            IsTrustee: true,
            IsVoter: false,
            IsDesignatedAuditor: false,
          },
          CanOpenEligibility: true,
          EligibilityDisabledReason: '',
        },
        {
          Election: createSummary(
            'election-linked-voter',
            ElectionLifecycleStateProto.Open,
            'Linked Voter Election'
          ),
          ActorRoles: {
            IsOwnerAdmin: false,
            IsTrustee: false,
            IsVoter: true,
            IsDesignatedAuditor: false,
          },
          CanOpenEligibility: false,
          EligibilityDisabledReason: 'This election is already linked to this Hush account.',
        },
      ],
    });

    render(<ElectionSearchWorkspace />);

    fireEvent.change(screen.getByLabelText('Search elections'), {
      target: { value: 'admin' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search elections' }));

    expect(await screen.findByText('AdminOnly Election III')).toBeInTheDocument();
    expect(screen.getAllByText('ElectionOwner')).toHaveLength(2);
    expect(await screen.findByText('AdminOnly Election II')).toBeInTheDocument();
    expect(screen.getByText('Auditor')).toBeInTheDocument();
    expect(await screen.findByText('Trustee Election')).toBeInTheDocument();
    expect(screen.getByText('Trustee')).toBeInTheDocument();
    expect(await screen.findByText('Linked Voter Election')).toBeInTheDocument();
    expect(screen.getByText('This election is already linked to this Hush account.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Open eligibility/i })).toHaveLength(3);
  });
});
