import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SocialPage from './page';

const setSelectedNavMock = vi.fn();
let selectedNav = 'feed-wall';
let stateParam: string | null = null;

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === 'state' ? stateParam : null),
  }),
}));

vi.mock('@/stores', () => ({
  useAppStore: (selector: (state: { selectedNav: string; setSelectedNav: (value: string) => void }) => unknown) =>
    selector({
      selectedNav,
      setSelectedNav: setSelectedNavMock,
    }),
}));

describe('SocialPage', () => {
  beforeEach(() => {
    selectedNav = 'feed-wall';
    stateParam = null;
    setSelectedNavMock.mockReset();
    sessionStorage.clear();
  });

  it('renders loading state', () => {
    stateParam = 'loading';
    render(<SocialPage />);

    expect(screen.getByTestId('social-loading')).toBeInTheDocument();
  });

  it('renders empty state', () => {
    stateParam = 'empty';
    render(<SocialPage />);

    expect(screen.getByTestId('social-empty')).toBeInTheDocument();
  });

  it('renders error state', () => {
    stateParam = 'error';
    render(<SocialPage />);

    expect(screen.getByTestId('social-error')).toBeInTheDocument();
  });

  it('renders populated feed wall by default', () => {
    render(<SocialPage />);

    expect(screen.getByTestId('social-populated')).toBeInTheDocument();
    expect(screen.getByTestId('feed-wall-region')).toBeInTheDocument();
  });

  it('shows switch indicator when app was switched to social', () => {
    sessionStorage.setItem('hush_app_switch_to', 'social');
    render(<SocialPage />);

    expect(screen.getByTestId('app-switch-indicator')).toHaveTextContent('HushSocial!');
  });

  it('shows placeholder for non-feed-wall social subviews', () => {
    selectedNav = 'following';
    render(<SocialPage />);

    expect(screen.getByTestId('social-subview-placeholder')).toBeInTheDocument();
  });
});
