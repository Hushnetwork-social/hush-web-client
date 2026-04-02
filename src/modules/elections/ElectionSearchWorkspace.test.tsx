import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { electionsService } from '@/lib/grpc/services/elections';
import { identityService } from '@/lib/grpc/services/identity';
import { ElectionBindingStatusProto, ElectionGovernanceModeProto, ElectionLifecycleStateProto } from '@/lib/grpc';
import { ElectionSearchWorkspace } from './ElectionSearchWorkspace';

const { mockSearchElectionDirectory, mockSearchByDisplayName } = vi.hoisted(() => ({
  mockSearchElectionDirectory: vi.fn(),
  mockSearchByDisplayName: vi.fn(),
}));

const mockPush = vi.fn();

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
  });

  it('searches the election directory and routes results into the eligibility flow', async () => {
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
      Elections: [
        createSummary(
          'election-search',
          ElectionLifecycleStateProto.Draft,
          'Board Election',
          'owner-address'
        ),
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
      Elections: [
        createSummary(
          'election-title-only',
          ElectionLifecycleStateProto.Open,
          'Board Election'
        ),
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
      });
    });

    expect(await screen.findByText('Board Election')).toBeInTheDocument();
  });
});
