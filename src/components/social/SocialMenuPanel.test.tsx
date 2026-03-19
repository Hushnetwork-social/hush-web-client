import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SocialMenuPanel } from './SocialMenuPanel';

const setSelectedNavMock = vi.fn();
const pushMock = vi.fn();
let selectedNav = 'feed-wall';
let pathname = '/social';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  usePathname: () => pathname,
}));

vi.mock('@/stores', () => ({
  useAppStore: (selector: (state: { selectedNav: string; setSelectedNav: (value: string) => void }) => unknown) =>
    selector({
      selectedNav,
      setSelectedNav: setSelectedNavMock,
    }),
}));

describe('SocialMenuPanel', () => {
  beforeEach(() => {
    selectedNav = 'feed-wall';
    pathname = '/social';
    setSelectedNavMock.mockReset();
    pushMock.mockReset();
  });

  it('renders Feed Wall as default social entry', () => {
    render(<SocialMenuPanel />);

    expect(screen.getByTestId('social-menu-feed-wall')).toHaveTextContent('Feed Wall');
    expect(screen.getByTestId('social-menu-feed-wall').className).toContain('bg-hush-purple');
  });

  it('renders FEAT-084 social operation menu contract', () => {
    render(<SocialMenuPanel />);

    expect(screen.getByTestId('social-menu-following')).toHaveTextContent('Following');
    expect(screen.getByTestId('social-menu-my-posts')).toHaveTextContent('My Posts');
    expect(screen.getByTestId('social-menu-my-replies')).toHaveTextContent('My Replies');
    expect(screen.getByTestId('social-menu-notifications')).toHaveTextContent('Notifications');
    expect(screen.getByTestId('social-menu-profile')).toHaveTextContent('Profile');
    expect(screen.getByTestId('social-menu-settings')).toHaveTextContent('Settings');
    expect(screen.queryByTestId('social-menu-logout')).not.toBeInTheDocument();
    expect(screen.queryByTestId('social-menu-mentions')).not.toBeInTheDocument();
    expect(screen.queryByTestId('social-menu-users')).not.toBeInTheDocument();
  });

  it('forces feed-wall when selected nav is not a social menu item', () => {
    selectedNav = 'new-post';
    render(<SocialMenuPanel />);

    expect(setSelectedNavMock).toHaveBeenCalledWith('feed-wall');
  });

  it('navigates back to the social home route from a nested social page', () => {
    pathname = '/social/post/post-123';
    render(<SocialMenuPanel />);

    fireEvent.click(screen.getByTestId('social-menu-following'));

    expect(setSelectedNavMock).toHaveBeenCalledWith('following');
    expect(pushMock).toHaveBeenCalledWith('/social');
  });

  it('does not push when already on the social home route', () => {
    render(<SocialMenuPanel />);

    fireEvent.click(screen.getByTestId('social-menu-feed-wall'));

    expect(setSelectedNavMock).toHaveBeenCalledWith('feed-wall');
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('routes guest menu clicks through the provided guest action', () => {
    const onGuestAction = vi.fn();
    render(<SocialMenuPanel guestMode={true} onGuestAction={onGuestAction} />);

    fireEvent.click(screen.getByTestId('social-menu-following'));

    expect(onGuestAction).toHaveBeenCalledTimes(1);
    expect(setSelectedNavMock).not.toHaveBeenCalledWith('following');
    expect(pushMock).not.toHaveBeenCalled();
  });
});
