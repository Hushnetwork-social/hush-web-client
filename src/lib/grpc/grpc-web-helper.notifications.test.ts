import { describe, expect, it } from 'vitest';
import {
  buildUpdateSocialNotificationPreferencesRequest,
  parseGetSocialNotificationPreferencesResponse,
  parseSocialNotificationInboxResponse,
  parseUpdateSocialNotificationPreferencesResponse,
  SocialNotificationKind,
  SocialNotificationTargetType,
  SocialNotificationVisibilityClass,
  encodeBoolField,
  encodeString,
  encodeVarintField,
} from './grpc-web-helper';

function encodeEmbeddedMessage(fieldNumber: number, bytes: number[]): number[] {
  const tag = (fieldNumber << 3) | 2;
  return [
    ...(() => {
      const encodedTag = [];
      let value = tag;
      while (value > 0x7f) {
        encodedTag.push((value & 0x7f) | 0x80);
        value >>= 7;
      }
      encodedTag.push(value);
      return encodedTag;
    })(),
    ...(() => {
      const encodedLength = [];
      let value = bytes.length;
      while (value > 0x7f) {
        encodedLength.push((value & 0x7f) | 0x80);
        value >>= 7;
      }
      encodedLength.push(value);
      return encodedLength;
    })(),
    ...bytes,
  ];
}

describe('grpc-web-helper FEAT-091 social notification contracts', () => {
  it('parses private-safe inbox items without preview leakage', () => {
    const itemBytes = [
      ...encodeString(1, 'notif-1'),
      ...encodeVarintField(2, SocialNotificationKind.REACTION),
      ...encodeVarintField(3, SocialNotificationVisibilityClass.CLOSE),
      ...encodeVarintField(4, SocialNotificationTargetType.COMMENT),
      ...encodeString(5, 'comment-1'),
      ...encodeString(10, 'New reaction'),
      ...encodeBoolField(13, true),
      ...encodeVarintField(14, 1710939000000),
      ...encodeString(15, '/social?notification=notif-1'),
      ...encodeString(16, 'circle-a'),
    ];

    const responseBytes = new Uint8Array([
      ...encodeEmbeddedMessage(1, itemBytes),
      ...encodeBoolField(2, true),
    ]);

    const response = parseSocialNotificationInboxResponse(responseBytes);

    expect(response.hasMore).toBe(true);
    expect(response.items).toHaveLength(1);
    expect(response.items[0]).toMatchObject({
      notificationId: 'notif-1',
      kind: SocialNotificationKind.REACTION,
      visibilityClass: SocialNotificationVisibilityClass.CLOSE,
      targetType: SocialNotificationTargetType.COMMENT,
      targetId: 'comment-1',
      title: 'New reaction',
      body: '',
      isPrivatePreviewSuppressed: true,
      matchedCircleIds: ['circle-a'],
    });
  });

  it('parses nested social notification preferences response', () => {
    const preferencesBytes = [
      ...encodeBoolField(1, false),
      ...encodeBoolField(2, true),
      ...encodeEmbeddedMessage(3, [
        ...encodeString(1, 'circle-a'),
        ...encodeBoolField(2, true),
      ]),
      ...encodeVarintField(4, 1710939000000),
    ];

    const responseBytes = new Uint8Array([
      ...encodeEmbeddedMessage(1, preferencesBytes),
    ]);

    const preferences = parseGetSocialNotificationPreferencesResponse(responseBytes);

    expect(preferences).toEqual({
      openActivityEnabled: false,
      closeActivityEnabled: true,
      circleMutes: [{ circleId: 'circle-a', isMuted: true }],
      updatedAtUnixMs: 1710939000000,
    });
  });

  it('builds and parses preference update contracts consistently', () => {
    const requestBytes = buildUpdateSocialNotificationPreferencesRequest('user-a', {
      openActivityEnabled: false,
      closeActivityEnabled: true,
      circleMutes: [{ circleId: 'circle-a', isMuted: true }],
    });

    expect(requestBytes.length).toBeGreaterThan(0);

    const responseBytes = new Uint8Array([
      ...encodeBoolField(1, true),
      ...encodeString(2, ''),
      ...encodeEmbeddedMessage(3, [
        ...encodeBoolField(1, false),
        ...encodeBoolField(2, true),
        ...encodeEmbeddedMessage(3, [
          ...encodeString(1, 'circle-a'),
          ...encodeBoolField(2, true),
        ]),
        ...encodeVarintField(4, 1710939000000),
      ]),
    ]);

    const response = parseUpdateSocialNotificationPreferencesResponse(responseBytes);

    expect(response.success).toBe(true);
    expect(response.preferences.openActivityEnabled).toBe(false);
    expect(response.preferences.closeActivityEnabled).toBe(true);
    expect(response.preferences.circleMutes).toEqual([{ circleId: 'circle-a', isMuted: true }]);
  });
});
