import { act, render, waitFor } from '@testing-library/react';
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
        activeApp: 'feeds',
        selectedNav: 'feeds',
      });
    });
  });

  afterEach(async () => {
    await act(async () => {
      useAppStore.setState({
        isAuthenticated: false,
        credentials: null,
        activeApp: 'feeds',
        selectedNav: 'feeds',
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

  it('redirects authenticated owners to the new HushVoting! route', async () => {
    render(<AccountElectionsPage />);
    await settleAuthGate();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/elections');
    });
    expect(useAppStore.getState().activeApp).toBe('voting');
    expect(useAppStore.getState().selectedNav).toBe('open-voting');
  });
});
