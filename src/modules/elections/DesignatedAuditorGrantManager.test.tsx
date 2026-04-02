import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GetElectionResponse } from '@/lib/grpc';
import { DesignatedAuditorGrantManager } from './DesignatedAuditorGrantManager';
import { useElectionsStore } from './useElectionsStore';

const { mockGetIdentity } = vi.hoisted(() => ({
  mockGetIdentity: vi.fn(),
}));

vi.mock('@/lib/grpc/services/identity', () => ({
  identityService: {
    getIdentity: mockGetIdentity,
  },
}));

const storeReset = useElectionsStore.getState().reset;

function createDetail(): GetElectionResponse {
  return {
    Success: true,
    ErrorMessage: '',
    Election: {
      ElectionId: 'election-1',
      OwnerPublicAddress: 'owner-address',
    },
    TrusteeInvitations: [],
  } as GetElectionResponse;
}

describe('DesignatedAuditorGrantManager', () => {
  beforeEach(() => {
    cleanup();
    storeReset();
    mockGetIdentity.mockReset();
  });

  afterEach(() => {
    cleanup();
    storeReset();
  });

  it('shows resolved grant identities and exposes an icon-only refresh control in the heading', async () => {
    const loadReportAccessGrants = vi.fn().mockResolvedValue(null);

    mockGetIdentity.mockImplementation(async (address: string) => {
      if (address === 'auditor-address') {
        return {
          Successfull: true,
          Message: '',
          ProfileName: 'Auditor Alice',
          PublicSigningAddress: 'auditor-address',
          PublicEncryptAddress: 'auditor-encrypt-address',
          IsPublic: true,
        };
      }

      if (address === 'owner-address') {
        return {
          Successfull: true,
          Message: '',
          ProfileName: 'Owner Alex',
          PublicSigningAddress: 'owner-address',
          PublicEncryptAddress: 'owner-encrypt-address',
          IsPublic: true,
        };
      }

      return {
        Successfull: false,
        Message: 'not found',
        ProfileName: '',
        PublicSigningAddress: address,
        PublicEncryptAddress: '',
        IsPublic: false,
      };
    });

    useElectionsStore.setState({
      actorPublicAddress: 'owner-address',
      canManageReportAccessGrants: true,
      createReportAccessGrant: vi.fn().mockResolvedValue(true),
      grantSearchError: null,
      grantSearchQuery: '',
      grantSearchResults: [],
      isLoadingReportAccessGrants: false,
      isSearchingGrantCandidates: false,
      isSubmitting: false,
      loadReportAccessGrants,
      reportAccessGrantDeniedReason: '',
      reportAccessGrants: [
        {
          Id: 'grant-1',
          ElectionId: 'election-1',
          ActorPublicAddress: 'auditor-address',
          GrantRole: 0,
          GrantedAt: { seconds: 1, nanos: 0 },
          GrantedByPublicAddress: 'owner-address',
        },
      ],
      searchGrantCandidates: vi.fn().mockResolvedValue(undefined),
      clearGrantCandidateSearch: vi.fn(),
      reset: vi.fn(),
    });

    render(
      <DesignatedAuditorGrantManager
        detail={createDetail()}
        actorEncryptionPublicKey="actor-encrypt-address"
        actorEncryptionPrivateKey="actor-private-encrypt-key"
        actorSigningPrivateKey="actor-signing-private-key"
      />
    );

    const refreshButton = screen.getByRole('button', { name: 'Refresh auditor grants' });
    expect(refreshButton).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Refresh$/ })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(mockGetIdentity).toHaveBeenCalledWith('auditor-address');
      expect(mockGetIdentity).toHaveBeenCalledWith('owner-address');
    });

    expect(await screen.findByText('Auditor Alice')).toBeInTheDocument();
    expect(await screen.findByText('(aud...ess)')).toBeInTheDocument();
    expect(
      await screen.findByText((_, node) => node?.textContent === 'Granted by Owner Alex (own...ess)')
    ).toBeInTheDocument();

    fireEvent.click(refreshButton);

    expect(loadReportAccessGrants).toHaveBeenCalledWith('owner-address', 'election-1');
  });
});
