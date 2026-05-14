import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ElectionOwnerAnomalyPage from './page';
import { useAppStore } from '@/stores';

const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

vi.mock('@/modules/elections/OwnerAnomalyWorkspacePanel', () => ({
  OwnerAnomalyWorkspacePanel: ({
    electionId,
    actorPublicAddress,
    actorEncryptionPublicKey,
    actorEncryptionPrivateKey,
    actorSigningPrivateKey,
  }: {
    electionId: string;
    actorPublicAddress: string;
    actorEncryptionPublicKey: string;
    actorEncryptionPrivateKey: string;
    actorSigningPrivateKey: string;
  }) => (
    <div data-testid="owner-anomaly-panel">
      <span data-testid="owner-anomaly-election-id">{electionId}</span>
      <span data-testid="owner-anomaly-actor">{actorPublicAddress}</span>
      <span data-testid="owner-anomaly-encrypt-public">{actorEncryptionPublicKey}</span>
      <span data-testid="owner-anomaly-encrypt-private">{actorEncryptionPrivateKey}</span>
      <span data-testid="owner-anomaly-signing-private">{actorSigningPrivateKey}</span>
    </div>
  ),
}));

function fulfilledParams(electionId: string): Promise<{ electionId: string }> {
  const params = Promise.resolve({ electionId }) as Promise<{ electionId: string }> & {
    status?: string;
    value?: { electionId: string };
  };
  params.status = 'fulfilled';
  params.value = { electionId };
  return params;
}

async function advanceAuthGate(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 150));
  });
}

describe('ElectionOwnerAnomalyPage', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    useAppStore.setState({
      isAuthenticated: true,
      credentials: {
        signingPublicKey: 'owner-public-key',
        signingPrivateKey: 'owner-private-signing-key',
        encryptionPublicKey: 'owner-public-encryption-key',
        encryptionPrivateKey: 'owner-private-encryption-key',
      },
      activeApp: 'feeds',
      selectedNav: 'feeds',
    });
  });

  afterEach(() => {
    cleanup();
    useAppStore.setState({
      isAuthenticated: false,
      credentials: null,
      activeApp: 'feeds',
      selectedNav: 'feeds',
    });
  });

  it('renders the owner anomaly panel with authenticated credentials after the auth gate', async () => {
    render(<ElectionOwnerAnomalyPage params={fulfilledParams('election-127')} />);

    expect(screen.queryByTestId('owner-anomaly-panel')).not.toBeInTheDocument();

    await advanceAuthGate();

    expect(await screen.findByTestId('owner-anomaly-panel')).toBeInTheDocument();
    expect(screen.getByTestId('owner-anomaly-election-id')).toHaveTextContent('election-127');
    expect(screen.getByTestId('owner-anomaly-actor')).toHaveTextContent('owner-public-key');
    expect(screen.getByTestId('owner-anomaly-encrypt-public'))
      .toHaveTextContent('owner-public-encryption-key');
    expect(screen.getByTestId('owner-anomaly-encrypt-private'))
      .toHaveTextContent('owner-private-encryption-key');
    expect(screen.getByTestId('owner-anomaly-signing-private'))
      .toHaveTextContent('owner-private-signing-key');
    expect(useAppStore.getState().activeApp).toBe('voting');
    expect(useAppStore.getState().selectedNav).toBe('open-voting');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('redirects to auth without rendering owner metadata when credentials are missing', async () => {
    useAppStore.setState({
      isAuthenticated: false,
      credentials: null,
    });

    render(<ElectionOwnerAnomalyPage params={fulfilledParams('election-secret')} />);
    await advanceAuthGate();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/auth');
    });
    expect(screen.queryByTestId('owner-anomaly-panel')).not.toBeInTheDocument();
  });
});
