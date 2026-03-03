import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SocialPage from './page';

const setSelectedNavMock = vi.fn();
const setAppContextScrollMock = vi.fn();
const requestInnerCircleRetryMock = vi.fn();
let selectedNav = 'feed-wall';
let stateParam: string | null = null;
let mockFeeds = [
  {
    id: 'chat-alice',
    type: 'chat',
    name: 'Alice',
    participants: ['me-address', 'alice-address'],
    otherParticipantPublicSigningAddress: 'alice-address',
  },
  {
    id: 'chat-bob',
    type: 'chat',
    name: 'Bob',
    participants: ['me-address', 'bob-address'],
    otherParticipantPublicSigningAddress: 'bob-address',
  },
  {
    id: 'inner-circle',
    type: 'group',
    name: 'Inner Circle',
    participants: ['me-address', 'alice-address'],
  },
  {
    id: 'support-group',
    type: 'group',
    name: 'HushNetwork Support',
    participants: ['me-address', 'alice-address'],
  },
];
let mockGroupMembers: Record<string, { publicAddress: string }[]> = {
  'inner-circle': [{ publicAddress: 'me-address' }, { publicAddress: 'alice-address' }],
  'support-group': [{ publicAddress: 'me-address' }, { publicAddress: 'alice-address' }],
};

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === 'state' ? stateParam : null),
  }),
}));

vi.mock('@/stores', () => ({
  useAppStore: (
    selector: (state: {
      selectedNav: string;
      credentials: {
        signingPublicKey: string;
        signingPrivateKey: string;
        encryptionPublicKey: string;
        encryptionPrivateKey: string;
      };
      innerCircleSync: {
        status: 'idle' | 'syncing' | 'retrying' | 'error';
        message: string | null;
        attemptCount: number;
        nextRetryAt: number | null;
      };
      requestInnerCircleRetry: () => void;
      setSelectedNav: (value: string) => void;
      appContexts: { social: { scrollOffset: number } };
      setAppContextScroll: (app: 'social', scroll: number) => void;
    }) => unknown
  ) =>
    selector({
      selectedNav,
      credentials: {
        signingPublicKey: 'me-address',
        signingPrivateKey: 'private',
        encryptionPublicKey: 'enc-public',
        encryptionPrivateKey: 'enc-private',
      },
      innerCircleSync: {
        status: 'idle',
        message: null,
        attemptCount: 0,
        nextRetryAt: null,
      },
      requestInnerCircleRetry: requestInnerCircleRetryMock,
      setSelectedNav: setSelectedNavMock,
      appContexts: { social: { scrollOffset: 0 } },
      setAppContextScroll: setAppContextScrollMock,
    }),
}));

vi.mock('@/modules/feeds/useFeedsStore', () => ({
  useFeedsStore: (
    selector: (state: { feeds: unknown[]; groupMembers: Record<string, { publicAddress: string }[]> }) => unknown
  ) =>
    selector({
      feeds: mockFeeds,
      groupMembers: mockGroupMembers,
    }),
}));

describe('SocialPage', () => {
  beforeEach(() => {
    selectedNav = 'feed-wall';
    stateParam = null;
    setSelectedNavMock.mockReset();
    setAppContextScrollMock.mockReset();
    requestInnerCircleRetryMock.mockReset();
    mockFeeds = [
      {
        id: 'chat-alice',
        type: 'chat',
        name: 'Alice',
        participants: ['me-address', 'alice-address'],
        otherParticipantPublicSigningAddress: 'alice-address',
      },
      {
        id: 'chat-bob',
        type: 'chat',
        name: 'Bob',
        participants: ['me-address', 'bob-address'],
        otherParticipantPublicSigningAddress: 'bob-address',
      },
      {
        id: 'inner-circle',
        type: 'group',
        name: 'Inner Circle',
        participants: ['me-address', 'alice-address'],
      },
      {
        id: 'support-group',
        type: 'group',
        name: 'HushNetwork Support',
        participants: ['me-address', 'alice-address'],
      },
    ];
    mockGroupMembers = {
      'inner-circle': [{ publicAddress: 'me-address' }, { publicAddress: 'alice-address' }],
      'support-group': [{ publicAddress: 'me-address' }, { publicAddress: 'alice-address' }],
    };
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
    expect(screen.getByTestId('post-action-reply-post-1')).toHaveTextContent('Reply (2)');
    expect(screen.getByTestId('post-action-link-post-1')).toHaveTextContent('Get Link');
    expect(screen.getByTestId('post-reaction-strip-post-1')).toBeInTheDocument();
    expect(screen.getByTestId('post-reaction-post-1-👍')).toHaveTextContent('1');
    expect(screen.getByTestId('post-reaction-add-post-1')).toHaveTextContent('Add');
    expect(screen.queryByTestId('post-replies-post-1')).not.toBeInTheDocument();
  });

  it('renders following list with user circles', () => {
    selectedNav = 'following';
    render(<SocialPage />);

    expect(screen.getByTestId('social-following-list')).toBeInTheDocument();
    expect(screen.getByTestId('social-following-item-alice-address')).toBeInTheDocument();
    expect(screen.getByTestId('social-following-item-bob-address')).toBeInTheDocument();
    expect(screen.getByTestId('social-following-circle-alice-address-Inner Circle')).toBeInTheDocument();
    expect(screen.queryByText('HushNetwork Support')).not.toBeInTheDocument();
    expect(screen.getByTestId('social-following-circle-bob-address-Not in circle yet')).toBeInTheDocument();
  });

  it('shows placeholder for non-feed-wall social subviews', () => {
    selectedNav = 'my-posts';
    render(<SocialPage />);

    expect(screen.getByTestId('social-subview-placeholder')).toBeInTheDocument();
  });

  it('persists scroll position into social app context', () => {
    render(<SocialPage />);

    const region = screen.getByTestId('feed-wall-region');
    Object.defineProperty(region, 'scrollTop', { value: 120, writable: true });
    region.dispatchEvent(new Event('scroll'));

    expect(setAppContextScrollMock).toHaveBeenCalledWith('social', 120);
  });

  it('opens post detail overlay with full content and replies', () => {
    render(<SocialPage />);

    fireEvent.click(screen.getByTestId('open-post-detail-post-1'));
    expect(screen.getByTestId('post-detail-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('post-detail-full-text').textContent?.length).toBeGreaterThan(1000);
    expect(screen.getByTestId('post-detail-action-link-post-1')).toHaveTextContent('Get Link');
    expect(screen.getByTestId('post-detail-action-reply-post-1')).toHaveTextContent('Reply (2)');
    expect(screen.queryByTestId('post-detail-composer-top')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('post-detail-action-reply-post-1'));
    expect(screen.getByTestId('post-detail-composer-top')).toBeInTheDocument();
    expect(screen.getByTestId('post-detail-reply-reply-post-1-reply-1')).toHaveTextContent('Reply');
    expect(screen.getByText('Replies (2)')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('close-post-detail'));
    expect(screen.queryByTestId('post-detail-overlay')).not.toBeInTheDocument();
  });

  it('adds a reply with Enter and places it at top of reply list', () => {
    render(<SocialPage />);

    fireEvent.click(screen.getByTestId('open-post-detail-post-1'));
    fireEvent.click(screen.getByTestId('post-detail-action-reply-post-1'));

    const input = screen.getByTestId('post-detail-composer-input');
    fireEvent.change(input, { target: { value: 'New top reply' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByText('Replies (3)')).toBeInTheDocument();
    const replyCards = screen.getAllByTestId(/post-detail-reply-/);
    expect(replyCards[0]).toHaveTextContent('You');
    expect(replyCards[0]).toHaveTextContent('New top reply');
  });

  it('keeps top reply composer hidden when entering through card Reply action', () => {
    render(<SocialPage />);

    fireEvent.click(screen.getByTestId('post-action-reply-post-1'));

    expect(screen.getByTestId('post-detail-overlay')).toBeInTheDocument();
    expect(screen.queryByTestId('post-detail-composer-top')).not.toBeInTheDocument();
  });

  it('closes overlay on outside click and Escape', () => {
    render(<SocialPage />);

    fireEvent.click(screen.getByTestId('open-post-detail-post-1'));
    expect(screen.getByTestId('post-detail-overlay')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('post-detail-overlay'));
    expect(screen.queryByTestId('post-detail-overlay')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('open-post-detail-post-1'));
    expect(screen.getByTestId('post-detail-overlay')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('post-detail-overlay')).not.toBeInTheDocument();
  });

  it('reply-to-reply pre-fills mention prefix and Ctrl+Enter adds newline', () => {
    render(<SocialPage />);

    fireEvent.click(screen.getByTestId('open-post-detail-post-1'));
    fireEvent.click(screen.getByTestId('post-detail-reply-reply-post-1-reply-1'));

    expect(screen.getByTestId('inline-composer-post-1-reply-1')).toBeInTheDocument();
    const input = screen.getByTestId('inline-composer-input') as HTMLTextAreaElement;
    expect(input.value).toBe('Zbid, ');

    fireEvent.change(input, { target: { value: 'Zbid, first line' } });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    fireEvent.change(input, { target: { value: 'Zbid, first line\nsecond line' } });

    expect(input.value).toContain('\n');
  });
});
