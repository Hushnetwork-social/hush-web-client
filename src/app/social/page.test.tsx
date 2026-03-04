import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SocialPage from './page';

const setSelectedNavMock = vi.fn();
const setAppContextScrollMock = vi.fn();
const requestInnerCircleRetryMock = vi.fn();
const createCustomCircleMock = vi.fn();
const addMembersToCustomCircleMock = vi.fn();
const checkIdentityExistsMock = vi.fn();
const triggerSyncNowMock = vi.fn();
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
let mockMemberRoles: Record<string, string> = {
  'inner-circle': 'Admin',
  'support-group': 'Member',
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
    selector: (state: { feeds: unknown[]; groupMembers: Record<string, { publicAddress: string }[]>; memberRoles: Record<string, string> }) => unknown
  ) =>
    selector({
      feeds: mockFeeds,
      groupMembers: mockGroupMembers,
      memberRoles: mockMemberRoles,
    }),
}));

vi.mock('@/modules/feeds/FeedsService', () => ({
  createCustomCircle: (...args: unknown[]) => createCustomCircleMock(...args),
  addMembersToCustomCircle: (...args: unknown[]) => addMembersToCustomCircleMock(...args),
}));

vi.mock('@/modules/identity/IdentityService', () => ({
  checkIdentityExists: (...args: unknown[]) => checkIdentityExistsMock(...args),
}));

vi.mock('@/lib/sync', () => ({
  useSyncContext: () => ({
    triggerSyncNow: triggerSyncNowMock,
  }),
}));

describe('SocialPage', () => {
  beforeEach(() => {
    selectedNav = 'feed-wall';
    stateParam = null;
    setSelectedNavMock.mockReset();
    setAppContextScrollMock.mockReset();
    requestInnerCircleRetryMock.mockReset();
    createCustomCircleMock.mockReset();
    addMembersToCustomCircleMock.mockReset();
    checkIdentityExistsMock.mockReset();
    triggerSyncNowMock.mockReset();
    createCustomCircleMock.mockResolvedValue({ success: true, message: 'ok' });
    addMembersToCustomCircleMock.mockResolvedValue({ success: true, message: 'ok' });
    checkIdentityExistsMock.mockResolvedValue({
      exists: true,
      publicEncryptAddress: 'alice-encrypt-address',
    });
    triggerSyncNowMock.mockResolvedValue(true);
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
    mockMemberRoles = {
      'inner-circle': 'Admin',
      'support-group': 'Member',
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
    expect(screen.getByTestId('social-circles-panel')).toBeInTheDocument();
    expect(screen.getByTestId('social-circles-strip')).toBeInTheDocument();
    expect(screen.getByTestId('social-circle-card-inner-circle')).toBeInTheDocument();
  });

  it('opens create-circle modal and submits transaction', async () => {
    selectedNav = 'following';
    render(<SocialPage />);

    fireEvent.click(screen.getByTestId('social-create-circle-button'));
    fireEvent.change(screen.getByTestId('social-create-circle-input'), { target: { value: 'Friends' } });
    fireEvent.click(screen.getByTestId('social-create-circle-submit'));

    await waitFor(() => {
      expect(createCustomCircleMock).toHaveBeenCalledWith('me-address', 'Friends', 'private');
      expect(triggerSyncNowMock).toHaveBeenCalled();
    });
    expect(screen.queryByTestId('social-create-circle-modal')).not.toBeInTheDocument();
  });

  it('assigns selected member to circle through mobile tap flow and confirms after projection refresh', async () => {
    selectedNav = 'following';
    const { rerender } = render(<SocialPage />);

    fireEvent.click(screen.getByTestId('social-following-item-bob-address'));
    fireEvent.click(screen.getByTestId('social-circle-card-inner-circle'));

    await waitFor(() => {
      expect(checkIdentityExistsMock).toHaveBeenCalledWith('bob-address');
      expect(addMembersToCustomCircleMock).toHaveBeenCalled();
      expect(triggerSyncNowMock).toHaveBeenCalled();
    });
    expect(screen.getByText('Bob is being added to Circle Inner Circle')).toBeInTheDocument();
    expect(screen.getByTestId('social-circle-pending-inner-circle-bob-address')).toBeInTheDocument();

    mockGroupMembers = {
      ...mockGroupMembers,
      'inner-circle': [
        { publicAddress: 'me-address' },
        { publicAddress: 'alice-address' },
        { publicAddress: 'bob-address' },
      ],
    };
    rerender(<SocialPage />);

    await waitFor(() => {
      expect(screen.getByText('Member Bob added to Circle Inner Circle')).toBeInTheDocument();
    });
  });

  it('blocks duplicate assignment before submission', async () => {
    selectedNav = 'following';
    render(<SocialPage />);

    fireEvent.click(screen.getByTestId('social-following-item-alice-address'));
    fireEvent.click(screen.getByTestId('social-circle-card-inner-circle'));

    await waitFor(() => {
      expect(addMembersToCustomCircleMock).not.toHaveBeenCalled();
    });
    expect(screen.getByText('Transaction failed: Alice is already in Inner Circle')).toBeInTheDocument();
  });

  it('shows placeholder for non-feed-wall social subviews', () => {
    selectedNav = 'my-posts';
    render(<SocialPage />);

    expect(screen.getByTestId('social-subview-placeholder')).toBeInTheDocument();
  });

  it('defaults private post audience to Inner Circle in new-post composer', () => {
    selectedNav = 'new-post';
    render(<SocialPage />);

    expect(screen.getByTestId('social-new-post')).toBeInTheDocument();
    expect(screen.getByTestId('social-new-post-selected-circles')).toHaveTextContent('Selected circles: Inner Circle');
  });

  it('keeps private post valid with at most one custom circle plus Inner Circle', () => {
    selectedNav = 'new-post';
    mockFeeds = [
      ...mockFeeds,
      {
        id: 'friends-circle',
        type: 'group',
        name: 'Friends',
        participants: ['me-address', 'alice-address'],
      },
    ];
    mockGroupMembers = {
      ...mockGroupMembers,
      'friends-circle': [{ publicAddress: 'alice-address' }],
    };
    mockMemberRoles = {
      ...mockMemberRoles,
      'friends-circle': 'Admin',
    };

    render(<SocialPage />);

    fireEvent.click(screen.getByTestId('social-new-post-custom-circle-friends-circle'));
    expect(screen.getByTestId('social-new-post-selected-circles')).toHaveTextContent('Inner Circle, Friends');
  });

  it('rejects publish when private post has zero selected circles', () => {
    selectedNav = 'new-post';
    mockFeeds = [
      ...mockFeeds,
      {
        id: 'friends-circle',
        type: 'group',
        name: 'Friends',
        participants: ['me-address', 'alice-address'],
      },
    ];
    mockGroupMembers = {
      ...mockGroupMembers,
      'friends-circle': [{ publicAddress: 'alice-address' }],
    };
    mockMemberRoles = {
      ...mockMemberRoles,
      'friends-circle': 'Admin',
    };

    render(<SocialPage />);

    fireEvent.click(screen.getByTestId('social-new-post-custom-circle-friends-circle'));
    fireEvent.click(screen.getByTestId('social-new-post-inner-circle-toggle'));
    fireEvent.click(screen.getByTestId('social-new-post-clear-custom-circle'));
    fireEvent.click(screen.getByTestId('social-new-post-publish'));

    expect(screen.getByTestId('social-new-post-audience-error')).toHaveTextContent(
      'Private post requires at least one selected circle.'
    );
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
