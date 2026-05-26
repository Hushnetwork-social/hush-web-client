import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  READINESS_DASHBOARD_CLIENT_ENV_FLAG,
  READINESS_DASHBOARD_NAV_ID,
  READINESS_DASHBOARD_ROUTE,
} from '@/lib/readinessDashboard/routeGate';
import { VotingMenuPanel } from './VotingMenuPanel';

const setSelectedNavMock = vi.fn();
const pushMock = vi.fn();
const guestActionMock = vi.fn();
let pathnameMock = '/elections';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  usePathname: () => pathnameMock,
}));

vi.mock('@/stores', () => ({
  useAppStore: (selector: (state: { setSelectedNav: (value: string) => void }) => unknown) =>
    selector({
      setSelectedNav: setSelectedNavMock,
    }),
}));

describe('VotingMenuPanel', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv(READINESS_DASHBOARD_CLIENT_ENV_FLAG, 'false');
    setSelectedNavMock.mockReset();
    pushMock.mockReset();
    guestActionMock.mockReset();
    pathnameMock = '/elections';
  });

  it('routes election hub clicks back to the embedded feeds workspace', () => {
    render(<VotingMenuPanel />);

    fireEvent.click(screen.getByTestId('voting-menu-hub'));

    expect(setSelectedNavMock).toHaveBeenCalledWith('open-voting');
    expect(pushMock).toHaveBeenCalledWith('/elections');
  });

  it('routes search clicks into the dedicated voting search screen', () => {
    render(<VotingMenuPanel />);

    fireEvent.click(screen.getByTestId('voting-menu-search'));

    expect(setSelectedNavMock).toHaveBeenCalledWith('open-voting');
    expect(pushMock).toHaveBeenCalledWith('/elections/search');
  });

  it('routes create election into the shared voting owner workspace', () => {
    render(<VotingMenuPanel />);

    fireEvent.click(screen.getByTestId('voting-menu-create'));

    expect(setSelectedNavMock).toHaveBeenCalledWith('open-voting');
    expect(pushMock).toHaveBeenCalledWith('/elections/owner?mode=new');
  });

  it('routes readiness clicks inside the HushVoting menu when enabled', () => {
    vi.stubEnv(READINESS_DASHBOARD_CLIENT_ENV_FLAG, 'true');
    render(<VotingMenuPanel />);

    fireEvent.click(screen.getByTestId('voting-menu-readiness'));

    expect(setSelectedNavMock).toHaveBeenCalledWith(READINESS_DASHBOARD_NAV_ID);
    expect(pushMock).toHaveBeenCalledWith(READINESS_DASHBOARD_ROUTE);
  });

  it('highlights the active voting route like the social shell menu', () => {
    pathnameMock = '/elections/search';
    render(<VotingMenuPanel />);

    expect(screen.getByTestId('voting-menu-search').className).toContain('bg-hush-purple');
    expect(screen.getByTestId('voting-menu-hub').className).toContain('border');
  });

  it('keeps election hub highlighted while viewing an eligibility route', () => {
    pathnameMock = '/elections/election-1/eligibility';
    render(<VotingMenuPanel />);

    expect(screen.getByTestId('voting-menu-hub').className).toContain('bg-hush-purple');
    expect(screen.getByTestId('voting-menu-search').className).toContain('border');
  });

  it('highlights readiness as an internal HushVoting menu route', () => {
    vi.stubEnv(READINESS_DASHBOARD_CLIENT_ENV_FLAG, 'true');
    pathnameMock = READINESS_DASHBOARD_ROUTE;
    render(<VotingMenuPanel />);

    expect(screen.getByTestId('voting-menu-readiness').className).toContain('bg-hush-purple');
    expect(screen.getByTestId('voting-menu-hub').className).toContain('border');
  });

  it('routes guest clicks through the provided guest action', () => {
    render(<VotingMenuPanel guestMode={true} onGuestAction={guestActionMock} />);

    fireEvent.click(screen.getByTestId('voting-menu-search'));

    expect(guestActionMock).toHaveBeenCalledTimes(1);
    expect(setSelectedNavMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('keeps the FEAT-121 benchmark out of ordinary HushVoting navigation', () => {
    render(<VotingMenuPanel />);

    expect(screen.queryByText(/mobile benchmark/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/FEAT-121/i)).not.toBeInTheDocument();
  });

  it('keeps the FEAT-142 readiness dashboard out of the HushVoting menu until enabled', () => {
    render(<VotingMenuPanel />);

    expect(screen.queryByTestId('voting-menu-readiness')).not.toBeInTheDocument();
  });

  it('keeps the FEAT-142 readiness dashboard discoverable after election hub when enabled', () => {
    vi.stubEnv(READINESS_DASHBOARD_CLIENT_ENV_FLAG, 'true');
    render(<VotingMenuPanel />);

    const menuButtons = screen.getAllByRole('button');

    expect(menuButtons[0]).toHaveTextContent('Election Hub');
    expect(menuButtons[1]).toHaveTextContent('Readiness');
    expect(menuButtons[2]).toHaveTextContent('Search Election');
  });
});
