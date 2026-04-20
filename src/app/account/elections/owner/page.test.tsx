import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OwnerElectionsWorkspacePage from './page';
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

describe('OwnerElectionsWorkspacePage', () => {
  beforeEach(async () => {
    mockReplace.mockClear();
    window.history.replaceState({}, '', '/account/elections/owner');
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

    render(<OwnerElectionsWorkspacePage />);
    await settleAuthGate();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/auth');
    });
  });

  it('preserves election scoping query parameters when redirecting to the owner workspace', async () => {
    window.history.replaceState(
      {},
      '',
      '/account/elections/owner?electionId=election-2',
    );

    render(<OwnerElectionsWorkspacePage />);
    await settleAuthGate();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/elections/owner?electionId=election-2');
    });
    expect(useAppStore.getState().activeApp).toBe('voting');
    expect(useAppStore.getState().selectedNav).toBe('open-voting');
  });

  it('preserves draft-creation mode when redirecting to the owner workspace', async () => {
    window.history.replaceState(
      {},
      '',
      '/account/elections/owner?mode=new',
    );

    render(<OwnerElectionsWorkspacePage />);
    await settleAuthGate();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/elections/owner?mode=new');
    });
  });
});
