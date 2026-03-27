import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AccountElectionsPage from './page';
import { useAppStore } from '@/stores';

const mockReplace = vi.fn();

async function settleAuthGate(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 150));
  });
}

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

vi.mock('@/modules/elections', () => ({
  ElectionsWorkspace: ({
    ownerPublicAddress,
    ownerEncryptionPublicKey,
    ownerEncryptionPrivateKey,
    ownerSigningPrivateKey,
  }: {
    ownerPublicAddress: string;
    ownerEncryptionPublicKey: string;
    ownerEncryptionPrivateKey: string;
    ownerSigningPrivateKey: string;
  }) => (
    <div data-testid="elections-workspace-stub">
      {ownerPublicAddress}:{ownerEncryptionPublicKey}:{ownerEncryptionPrivateKey}:{ownerSigningPrivateKey}
    </div>
  ),
}));

describe('AccountElectionsPage', () => {
  beforeEach(async () => {
    mockReplace.mockClear();
    await act(async () => {
      useAppStore.setState({
        isAuthenticated: true,
        credentials: {
          signingPublicKey: 'owner-public-key',
          signingPrivateKey: 'private-signing-key',
          encryptionPublicKey: 'owner-encryption-key',
          encryptionPrivateKey: 'private-encryption-key',
        },
      });
    });
  });

  afterEach(async () => {
    await act(async () => {
      useAppStore.setState({
        isAuthenticated: false,
        credentials: null,
      });
    });
  });

  it('redirects to auth when the viewer is not authenticated', async () => {
    await act(async () => {
      useAppStore.setState({
        isAuthenticated: false,
        credentials: null,
      });
    });

    render(<AccountElectionsPage />);
    await settleAuthGate();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/auth');
    });
  });

  it('renders the elections workspace for an authenticated owner', async () => {
    render(<AccountElectionsPage />);
    await settleAuthGate();

    expect(await screen.findByTestId('elections-workspace-stub')).toHaveTextContent(
      'owner-public-key:owner-encryption-key:private-encryption-key:private-signing-key'
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
