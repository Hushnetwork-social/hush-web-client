import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SocialMenuPanel } from './SocialMenuPanel';

const setSelectedNavMock = vi.fn();
let selectedNav = 'feed-wall';

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
    setSelectedNavMock.mockReset();
  });

  it('renders Feed Wall as default social entry', () => {
    render(<SocialMenuPanel />);

    expect(screen.getByTestId('social-menu-feed-wall')).toHaveTextContent('Feed Wall');
    expect(screen.getByTestId('social-menu-feed-wall').className).toContain('bg-hush-purple');
  });

  it('forces feed-wall when selected nav is not a social menu item', () => {
    selectedNav = 'new-post';
    render(<SocialMenuPanel />);

    expect(setSelectedNavMock).toHaveBeenCalledWith('feed-wall');
  });
});
