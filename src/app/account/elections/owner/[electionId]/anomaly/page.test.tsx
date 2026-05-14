import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LegacyOwnerAnomalyPage from './page';

const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
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

describe('LegacyOwnerAnomalyPage', () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('redirects the account route to the canonical owner anomaly workspace route', async () => {
    await act(async () => {
      render(<LegacyOwnerAnomalyPage params={fulfilledParams('election-127')} />);
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/elections/election-127/owner/anomaly');
    });
  });
});
