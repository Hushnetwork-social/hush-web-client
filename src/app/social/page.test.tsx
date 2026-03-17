import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SocialPage from './page';

const setSelectedNavMock = vi.fn();
const setAppContextScrollMock = vi.fn();
const requestInnerCircleRetryMock = vi.fn();
const createCustomCircleMock = vi.fn();
const addMembersToCustomCircleMock = vi.fn();
const checkIdentityExistsMock = vi.fn();
const triggerSyncNowMock = vi.fn();
const clipboardWriteTextMock = vi.fn();
const getSocialFeedWallMock = vi.fn();
const createSocialPostMock = vi.fn();
const computeSha256Mock = vi.fn();
let mockCredentials: {
  signingPublicKey?: string;
  signingPrivateKey?: string;
  encryptionPublicKey?: string;
  encryptionPrivateKey?: string;
} | null = {
  signingPublicKey: 'me-address',
  signingPrivateKey: 'private',
  encryptionPublicKey: 'enc-public',
  encryptionPrivateKey: 'enc-private',
};
let selectedNav = 'feed-wall';
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
    description: 'Auto-managed inner circle',
    participants: ['me-address', 'alice-address'],
  },
  {
    id: 'support-group',
    type: 'group',
    name: 'HushNetwork Support',
    description: 'Generic group feed',
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
      credentials: mockCredentials,
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

vi.mock('@/modules/social/FeedWallService', () => ({
  getSocialFeedWall: (...args: unknown[]) => getSocialFeedWallMock(...args),
}));

vi.mock('@/modules/social/SocialService', () => ({
  createSocialPost: (...args: unknown[]) => createSocialPostMock(...args),
}));

vi.mock('@/components/social/SocialPostReactions', () => ({
  SocialPostReactions: ({ testIdPrefix }: { testIdPrefix: string }) => (
    <div data-testid={testIdPrefix}>
      <button data-testid={`${testIdPrefix}-add`}>Add</button>
    </div>
  ),
}));

vi.mock('@/lib/attachments/attachmentHash', () => ({
  computeSha256: (...args: unknown[]) => computeSha256Mock(...args),
}));

describe('SocialPage', () => {
  const renderFeedWallAndWaitReady = async () => {
    render(<SocialPage />);
    await waitFor(() => {
      expect(screen.getByTestId('social-populated')).toBeInTheDocument();
    });
  };

  beforeEach(() => {
    selectedNav = 'feed-wall';
    mockCredentials = {
      signingPublicKey: 'me-address',
      signingPrivateKey: 'private',
      encryptionPublicKey: 'enc-public',
      encryptionPrivateKey: 'enc-private',
    };
    setSelectedNavMock.mockReset();
    setAppContextScrollMock.mockReset();
    requestInnerCircleRetryMock.mockReset();
    createCustomCircleMock.mockReset();
    addMembersToCustomCircleMock.mockReset();
    checkIdentityExistsMock.mockReset();
    triggerSyncNowMock.mockReset();
    createSocialPostMock.mockReset();
    createCustomCircleMock.mockResolvedValue({ success: true, message: 'ok' });
    addMembersToCustomCircleMock.mockResolvedValue({ success: true, message: 'ok' });
    checkIdentityExistsMock.mockResolvedValue({
      exists: true,
      publicEncryptAddress: 'alice-encrypt-address',
    });
    triggerSyncNowMock.mockResolvedValue(true);
    createSocialPostMock.mockResolvedValue({
      success: true,
      message: 'ok',
      permalink: '/social/post/test-post',
    });
    getSocialFeedWallMock.mockResolvedValue({
      success: true,
      message: 'ok',
      posts: [
        {
          postId: 'post-1',
          authorPublicAddress: 'me-address',
          content: 'A'.repeat(1205),
          createdAtBlock: 2539,
          visibility: 'open',
          circleFeedIds: [],
        },
        {
          postId: 'post-2',
          authorPublicAddress: 'alice-address',
          content: 'Built a merchant flow on Kasmart for handmade products. Feedback welcome.',
          createdAtBlock: 2538,
          visibility: 'open',
          circleFeedIds: [],
        },
      ],
    });
    computeSha256Mock.mockResolvedValue('a'.repeat(64));
    clipboardWriteTextMock.mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: clipboardWriteTextMock,
      },
    });
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock-social-media'),
      revokeObjectURL: vi.fn(),
    });
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
    window.history.replaceState({}, '', '/social');
  });

  it('renders loading state', () => {
    window.history.replaceState({}, '', '/social?state=loading');
    render(<SocialPage />);

    expect(screen.getByTestId('social-loading')).toBeInTheDocument();
  });

  it('renders empty state', () => {
    window.history.replaceState({}, '', '/social?state=empty');
    render(<SocialPage />);

    expect(screen.getByTestId('social-empty')).toBeInTheDocument();
  });

  it('renders error state', () => {
    window.history.replaceState({}, '', '/social?state=error');
    render(<SocialPage />);

    expect(screen.getByTestId('social-error')).toBeInTheDocument();
  });

  it('renders populated feed wall by default', async () => {
    await renderFeedWallAndWaitReady();

    expect(screen.getByTestId('social-populated')).toBeInTheDocument();
    expect(screen.getByTestId('feed-wall-region')).toBeInTheDocument();
    expect(screen.getByTestId('social-feedwall-composer')).toBeInTheDocument();
    expect(screen.getByTestId('social-new-post-compact-trigger')).toHaveTextContent('What do you want to show us?');
    expect(screen.getByTestId('post-action-reply-post-1')).toHaveTextContent('Reply (0)');
    expect(screen.getByTestId('post-action-link-post-1')).toHaveTextContent('Get Link');
    expect(screen.getByTestId('post-reaction-strip-post-1')).toBeInTheDocument();
    expect(screen.getByTestId('post-reaction-strip-post-1-add')).toHaveTextContent('Add');
    expect(screen.queryByTestId('post-replies-post-1')).not.toBeInTheDocument();
  });

  it('loads public feed wall for guests without an identity', async () => {
    mockCredentials = null;

    await renderFeedWallAndWaitReady();

    expect(getSocialFeedWallMock).toHaveBeenCalledWith(null, false, 100);
    expect(screen.getByTestId('post-reaction-strip-post-1')).toBeInTheDocument();
  });

  it('opens create-account overlay when a guest attempts to reply on a public post', async () => {
    mockCredentials = null;

    await renderFeedWallAndWaitReady();
    fireEvent.click(screen.getByTestId('post-action-reply-post-1'));

    expect(screen.getByTestId('social-auth-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('social-auth-overlay-cta')).toBeInTheDocument();
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

  it('shows failure toast when add-to-circle transaction is rejected by backend', async () => {
    selectedNav = 'following';
    addMembersToCustomCircleMock.mockResolvedValueOnce({ success: false, message: 'backend rejected assignment' });
    render(<SocialPage />);

    fireEvent.click(screen.getByTestId('social-following-item-bob-address'));
    fireEvent.click(screen.getByTestId('social-circle-card-inner-circle'));

    await waitFor(() => {
      expect(addMembersToCustomCircleMock).toHaveBeenCalled();
    });
    expect(screen.getByText('Transaction failed: backend rejected assignment')).toBeInTheDocument();
  });

  it('preserves rendered following rows and circle cards on no-change rerender', () => {
    selectedNav = 'following';
    const { rerender } = render(<SocialPage />);

    const rowBefore = screen.getByTestId('social-following-item-alice-address');
    const circleBefore = screen.getByTestId('social-circle-card-inner-circle');

    rerender(<SocialPage />);

    const rowAfter = screen.getByTestId('social-following-item-alice-address');
    const circleAfter = screen.getByTestId('social-circle-card-inner-circle');

    expect(rowAfter).toBe(rowBefore);
    expect(circleAfter).toBe(circleBefore);
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

  it('expands compact feed-wall composer and allows collapse', async () => {
    await renderFeedWallAndWaitReady();

    fireEvent.click(screen.getByTestId('social-new-post-compact-trigger'));
    expect(screen.getByTestId('social-new-post-draft')).toBeInTheDocument();
    expect(screen.getByTestId('social-new-post-collapse')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('social-new-post-collapse'));
    expect(screen.getByTestId('social-new-post-compact-trigger')).toBeInTheDocument();
  });

  it('enforces media attachment cap in composer', async () => {
    selectedNav = 'new-post';
    render(<SocialPage />);

    const input = screen.getByTestId('social-new-post-file-input') as HTMLInputElement;
    const files = Array.from(
      { length: 5 },
      (_, index) => new File([`image-${index}`], `image-${index}.png`, { type: 'image/png' })
    );
    fireEvent.change(input, { target: { files } });

    await waitFor(() => {
      expect(screen.getByTestId('social-new-post-media-error')).toHaveTextContent('You can attach up to 4 items.');
    });
  });

  it('renders image preview when composer receives media', async () => {
    selectedNav = 'new-post';
    render(<SocialPage />);

    const input = screen.getByTestId('social-new-post-file-input') as HTMLInputElement;
    const file = new File(['image-bytes'], 'image.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId('social-new-post-media-preview-image')).toBeInTheDocument();
      expect(screen.getByTestId('social-new-post-media-list')).toBeInTheDocument();
      expect(screen.getByText('image.png (0MB)')).toBeInTheDocument();
    });
  });

  it('allows publishing media-only post and renders media in feed card', async () => {
    await renderFeedWallAndWaitReady();

    fireEvent.click(screen.getByTestId('social-new-post-compact-trigger'));
    const input = screen.getByTestId('social-new-post-file-input') as HTMLInputElement;
    const file = new File(['image-bytes'], 'media-only.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId('social-new-post-media-preview-image')).toBeInTheDocument();
    });

    const draft = screen.getByTestId('social-new-post-draft') as HTMLTextAreaElement;
    expect(draft.value).toBe('');
    fireEvent.click(screen.getByTestId('social-new-post-publish'));

    await waitFor(() => {
      expect(createSocialPostMock).toHaveBeenCalled();
      expect(screen.queryByTestId('social-new-post-audience-error')).not.toBeInTheDocument();
      expect(screen.getByAltText('media-only.png')).toBeInTheDocument();
    });

    const [publishArgs] = createSocialPostMock.mock.calls[0];
    expect(publishArgs.content).toBe('');
  });

  it('keeps private post valid with at most one custom circle plus Inner Circle', () => {
    selectedNav = 'new-post';
    mockFeeds = [
      ...mockFeeds,
      {
        id: 'friends-circle',
        type: 'group',
        name: 'Friends',
        description: 'Owner-managed custom circle',
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

    fireEvent.click(screen.getByTestId('social-new-post-add-circle'));
    fireEvent.click(screen.getByTestId('social-new-post-custom-circle-friends-circle'));
    expect(screen.getByTestId('social-new-post-selected-circles')).toHaveTextContent('Inner Circle, Friends');
  });

  it('rejects removing Inner Circle when no custom circle is selected', () => {
    selectedNav = 'new-post';

    render(<SocialPage />);

    fireEvent.click(screen.getByTestId('social-new-post-add-circle'));
    fireEvent.click(screen.getByTestId('social-new-post-inner-circle-toggle'));

    expect(screen.getByTestId('social-new-post-audience-error')).toHaveTextContent(
      'Inner Circle cannot be removed unless another private circle is selected.'
    );
  });

  it('does not treat regular admin group feeds as circles', () => {
    selectedNav = 'following';
    mockFeeds = [
      ...mockFeeds,
      {
        id: 'admin-group',
        type: 'group',
        name: 'myPrivateGroup',
        description: 'Regular group feed',
        participants: ['me-address', 'alice-address'],
      },
    ];
    mockGroupMembers = {
      ...mockGroupMembers,
      'admin-group': [{ publicAddress: 'alice-address' }],
    };
    mockMemberRoles = {
      ...mockMemberRoles,
      'admin-group': 'Admin',
    };

    render(<SocialPage />);

    expect(screen.queryByText('myPrivateGroup')).not.toBeInTheDocument();
  });

  it('shows custom circle badges in following list when user belongs to custom circles', () => {
    selectedNav = 'following';
    mockFeeds = [
      ...mockFeeds,
      {
        id: 'friends-circle',
        type: 'group',
        name: 'Friends',
        description: 'Owner-managed custom circle',
        participants: ['me-address', 'alice-address'],
      },
    ];
    mockGroupMembers = {
      ...mockGroupMembers,
      'friends-circle': [{ publicAddress: 'me-address' }, { publicAddress: 'alice-address' }],
    };

    render(<SocialPage />);

    expect(screen.getByTestId('social-following-circle-alice-address-Inner Circle')).toBeInTheDocument();
    expect(screen.getByTestId('social-following-circle-alice-address-Friends')).toBeInTheDocument();
  });

  it('shows generic Private badge for private post received from another user', async () => {
    const circleFeedId = 'd741ab67-e1d4-4008-9cd1-2a51c19ae0ae';
    mockFeeds = [
      ...mockFeeds,
      {
        id: circleFeedId,
        type: 'group',
        name: 'Inner Circle',
        description: 'Auto-managed inner circle',
        participants: ['me-address', 'alice-address'],
      },
    ];
    mockGroupMembers = {
      ...mockGroupMembers,
      [circleFeedId]: [{ publicAddress: 'me-address' }, { publicAddress: 'alice-address' }],
    };

    getSocialFeedWallMock.mockResolvedValue({
      success: true,
      message: 'ok',
      posts: [
        {
          postId: 'post-private-1',
          authorPublicAddress: 'alice-address',
          content: 'private post',
          createdAtBlock: 2540,
          visibility: 'private',
          circleFeedIds: [circleFeedId.toUpperCase()],
        },
      ],
    });

    await renderFeedWallAndWaitReady();

    const privatePreview = await screen.findByText('private post');
    const postCard = privatePreview.closest('article');
    expect(postCard).toBeTruthy();
    const badges = within(postCard as HTMLElement).getByTestId(/post-audience-badges-/);
    expect(within(badges).getByText('Private')).toBeInTheDocument();
    expect(within(badges).queryByText('Inner Circle')).not.toBeInTheDocument();
    expect(within(badges).queryByText(/d741ab67/i)).not.toBeInTheDocument();
  });

  it('shows circle badge for own private post', async () => {
    const circleFeedId = 'd741ab67-e1d4-4008-9cd1-2a51c19ae0ae';
    mockFeeds = [
      ...mockFeeds,
      {
        id: circleFeedId,
        type: 'group',
        name: 'Inner Circle',
        description: 'Auto-managed inner circle',
        participants: ['me-address', 'alice-address'],
      },
    ];
    mockGroupMembers = {
      ...mockGroupMembers,
      [circleFeedId]: [{ publicAddress: 'me-address' }, { publicAddress: 'alice-address' }],
    };

    getSocialFeedWallMock.mockResolvedValue({
      success: true,
      message: 'ok',
      posts: [
        {
          postId: 'post-private-own',
          authorPublicAddress: 'me-address',
          content: 'private own post',
          createdAtBlock: 2540,
          visibility: 'private',
          circleFeedIds: [circleFeedId.toUpperCase()],
        },
      ],
    });

    await renderFeedWallAndWaitReady();

    const privatePreview = await screen.findByText('private own post');
    const postCard = privatePreview.closest('article');
    expect(postCard).toBeTruthy();
    const badges = within(postCard as HTMLElement).getByTestId(/post-audience-badges-/);
    expect(within(badges).getByText('Inner Circle')).toBeInTheDocument();
    expect(within(badges).queryByText('Private')).not.toBeInTheDocument();
  });

  it('falls back to generic Private badge when circle name is not resolved', async () => {
    getSocialFeedWallMock.mockResolvedValue({
      success: true,
      message: 'ok',
      posts: [
        {
          postId: 'post-private-unknown-circle',
          authorPublicAddress: 'alice-address',
          content: 'private post unresolved circle',
          createdAtBlock: 2541,
          visibility: 'private',
          circleFeedIds: ['d741ab67-e1d4-4008-9cd1-2a51c19ae0ae'],
        },
      ],
    });

    await renderFeedWallAndWaitReady();

    const privatePreview = await screen.findByText('private post unresolved circle');
    const postCard = privatePreview.closest('article');
    expect(postCard).toBeTruthy();
    const badges = within(postCard as HTMLElement).getByTestId(/post-audience-badges-/);
    expect(within(badges).getByText('Private')).toBeInTheDocument();
    expect(within(badges).queryByText(/d741ab67/i)).not.toBeInTheDocument();
  });

  it('persists scroll position into social app context', () => {
    render(<SocialPage />);

    const region = screen.getByTestId('feed-wall-region');
    Object.defineProperty(region, 'scrollTop', { value: 120, writable: true });
    region.dispatchEvent(new Event('scroll'));

    expect(setAppContextScrollMock).toHaveBeenCalledWith('social', 120);
  });

  it('opens post detail overlay with full content and replies', async () => {
    await renderFeedWallAndWaitReady();

    fireEvent.click(screen.getByTestId('open-post-detail-post-1'));
    expect(screen.getByTestId('post-detail-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('post-detail-full-text').textContent?.length).toBeGreaterThan(1000);
    expect(screen.getByTestId('post-detail-action-link-post-1')).toHaveTextContent('Get Link');
    expect(screen.getByTestId('post-detail-action-reply-post-1')).toHaveTextContent('Reply (0)');
    expect(screen.queryByTestId('post-detail-composer-top')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('post-detail-action-reply-post-1'));
    expect(screen.getByTestId('post-detail-composer-top')).toBeInTheDocument();
    expect(screen.queryByTestId('post-detail-reply-reply-post-1-reply-1')).not.toBeInTheDocument();
    expect(screen.getByText('Replies (0)')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('close-post-detail'));
    expect(screen.queryByTestId('post-detail-overlay')).not.toBeInTheDocument();
  });

  it('copies post permalink from feed card and detail actions', async () => {
    await renderFeedWallAndWaitReady();

    fireEvent.click(screen.getByTestId('post-action-link-post-1'));
    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledWith(expect.stringContaining('/social/post/post-1'));
    });
    expect(screen.getByText('Post permalink copied.')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('open-post-detail-post-1'));
    fireEvent.click(screen.getByTestId('post-detail-action-link-post-1'));
    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledWith(expect.stringContaining('/social/post/post-1'));
    });
  });

  it('adds a reply with Enter and places it at top of reply list', async () => {
    await renderFeedWallAndWaitReady();

    fireEvent.click(screen.getByTestId('open-post-detail-post-1'));
    fireEvent.click(screen.getByTestId('post-detail-action-reply-post-1'));

    const input = screen.getByTestId('post-detail-composer-input');
    fireEvent.change(input, { target: { value: 'New top reply' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByText('Replies (1)')).toBeInTheDocument();
    const replyCards = screen.getAllByTestId(/post-detail-reply-/);
    expect(replyCards[0]).toHaveTextContent('You');
    expect(replyCards[0]).toHaveTextContent('New top reply');
  });

  it('keeps top reply composer hidden when entering through card Reply action', async () => {
    await renderFeedWallAndWaitReady();

    fireEvent.click(screen.getByTestId('post-action-reply-post-1'));

    expect(screen.getByTestId('post-detail-overlay')).toBeInTheDocument();
    expect(screen.queryByTestId('post-detail-composer-top')).not.toBeInTheDocument();
  });

  it('closes overlay on outside click and Escape', async () => {
    await renderFeedWallAndWaitReady();

    fireEvent.click(screen.getByTestId('open-post-detail-post-1'));
    expect(screen.getByTestId('post-detail-overlay')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('post-detail-overlay'));
    expect(screen.queryByTestId('post-detail-overlay')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('open-post-detail-post-1'));
    expect(screen.getByTestId('post-detail-overlay')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('post-detail-overlay')).not.toBeInTheDocument();
  });

  it('uses ArrowLeft and ArrowRight to navigate media inside the open post detail overlay', async () => {
    getSocialFeedWallMock.mockResolvedValue({
      success: true,
      message: 'ok',
      posts: [
        {
          postId: 'post-1',
          authorPublicAddress: 'me-address',
          content: 'Post with carousel media',
          createdAtBlock: 2539,
          visibility: 'open',
          circleFeedIds: [],
          attachments: [
            {
              id: 'attachment-1',
              kind: 'image',
              fileName: 'image-1.png',
              mimeType: 'image/png',
              sizeBytes: 1024,
              previewUrl: 'blob:image-1',
            },
            {
              id: 'attachment-2',
              kind: 'image',
              fileName: 'image-2.png',
              mimeType: 'image/png',
              sizeBytes: 2048,
              previewUrl: 'blob:image-2',
            },
          ],
        },
      ],
    });

    await renderFeedWallAndWaitReady();

    fireEvent.click(screen.getByTestId('social-post-post-1'));

    const mediaContainer = screen.getByTestId('post-detail-media-post-1-container');
    expect(within(mediaContainer).getByTestId('page-indicator')).toHaveTextContent('1 / 2');

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(within(mediaContainer).getByTestId('page-indicator')).toHaveTextContent('2 / 2');

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(within(mediaContainer).getByTestId('page-indicator')).toHaveTextContent('1 / 2');
  });

  it('reply-to-reply pre-fills mention prefix and Ctrl+Enter adds newline', async () => {
    await renderFeedWallAndWaitReady();

    fireEvent.click(screen.getByTestId('open-post-detail-post-1'));
    fireEvent.click(screen.getByTestId('post-detail-action-reply-post-1'));
    const topComposerInput = screen.getByTestId('post-detail-composer-input');
    fireEvent.change(topComposerInput, { target: { value: 'Seed top reply' } });
    fireEvent.keyDown(topComposerInput, { key: 'Enter' });

    const seededReplyCard = await screen.findByText('Seed top reply');
    const seededReplyContainer = seededReplyCard.closest('[data-testid^="post-detail-reply-"]');
    expect(seededReplyContainer).toBeTruthy();
    const seededReplyButton = within(seededReplyContainer as HTMLElement).getByTestId(/post-detail-reply-reply-/);
    fireEvent.click(seededReplyButton);

    await waitFor(() => {
      expect(screen.getByTestId('inline-composer-input')).toBeInTheDocument();
    });
    const input = screen.getByTestId('inline-composer-input') as HTMLTextAreaElement;
    expect(input.value).toBe('You, ');

    fireEvent.change(input, { target: { value: 'Zbid, first line' } });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    fireEvent.change(input, { target: { value: 'Zbid, first line\nsecond line' } });

    expect(input.value).toContain('\n');
  });
});
