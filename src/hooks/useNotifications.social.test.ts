import { describe, expect, it } from 'vitest';
import {
  applySocialNotificationReadState,
  mergeSocialNotificationItems,
} from './useNotifications';

describe('useNotifications FEAT-091 social helpers', () => {
  it('merges durable inbox items without duplicating replayed notifications', () => {
    const merged = mergeSocialNotificationItems(
      [
        {
          notificationId: 'notif-1',
          kind: 1,
          visibilityClass: 1,
          targetType: 1,
          targetId: 'post-1',
          postId: 'post-1',
          parentCommentId: '',
          actorUserId: 'alice',
          actorDisplayName: 'Alice',
          title: 'First title',
          body: 'First body',
          isRead: false,
          isPrivatePreviewSuppressed: false,
          createdAtUnixMs: 100,
          deepLinkPath: '/social/post/post-1',
          matchedCircleIds: [],
        },
      ],
      [
        {
          notificationId: 'notif-1',
          kind: 1,
          visibilityClass: 1,
          targetType: 1,
          targetId: 'post-1',
          postId: 'post-1',
          parentCommentId: '',
          actorUserId: 'alice',
          actorDisplayName: 'Alice',
          title: 'Updated title',
          body: 'Updated body',
          isRead: true,
          isPrivatePreviewSuppressed: false,
          createdAtUnixMs: 100,
          deepLinkPath: '/social/post/post-1',
          matchedCircleIds: ['circle-a'],
        },
        {
          notificationId: 'notif-2',
          kind: 2,
          visibilityClass: 2,
          targetType: 2,
          targetId: 'comment-1',
          postId: 'post-1',
          parentCommentId: '',
          actorUserId: 'bob',
          actorDisplayName: 'Bob',
          title: 'Second title',
          body: 'Second body',
          isRead: false,
          isPrivatePreviewSuppressed: true,
          createdAtUnixMs: 200,
          deepLinkPath: '/social/post/post-1',
          matchedCircleIds: [],
        },
      ]
    );

    expect(merged).toHaveLength(2);
    expect(merged[0].notificationId).toBe('notif-2');
    expect(merged[1]).toMatchObject({
      notificationId: 'notif-1',
      title: 'Updated title',
      isRead: true,
      matchedCircleIds: ['circle-a'],
    });
  });

  it('marks one or all durable notifications as read deterministically', () => {
    const items = [
      {
        notificationId: 'notif-1',
        kind: 1,
        visibilityClass: 1,
        targetType: 1,
        targetId: 'post-1',
        postId: 'post-1',
        parentCommentId: '',
        actorUserId: 'alice',
        actorDisplayName: 'Alice',
        title: 'First title',
        body: 'First body',
        isRead: false,
        isPrivatePreviewSuppressed: false,
        createdAtUnixMs: 100,
        deepLinkPath: '/social/post/post-1',
        matchedCircleIds: [],
      },
      {
        notificationId: 'notif-2',
        kind: 2,
        visibilityClass: 2,
        targetType: 2,
        targetId: 'comment-1',
        postId: 'post-1',
        parentCommentId: '',
        actorUserId: 'bob',
        actorDisplayName: 'Bob',
        title: 'Second title',
        body: 'Second body',
        isRead: false,
        isPrivatePreviewSuppressed: true,
        createdAtUnixMs: 200,
        deepLinkPath: '/social/post/post-1',
        matchedCircleIds: [],
      },
    ];

    expect(applySocialNotificationReadState(items, 'notif-1', false)).toMatchObject([
      { notificationId: 'notif-1', isRead: true },
      { notificationId: 'notif-2', isRead: false },
    ]);

    expect(applySocialNotificationReadState(items, undefined, true)).toMatchObject([
      { notificationId: 'notif-1', isRead: true },
      { notificationId: 'notif-2', isRead: true },
    ]);
  });
});
