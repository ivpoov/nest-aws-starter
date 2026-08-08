import { type NotificationResponseInterface, NotificationTypeEnum } from '@nest-aws-starter/shared';
import { describe, expect, it } from 'vitest';
import { resolveNotificationLink } from '../utils/resolveNotificationLink';

function buildNotification(
  type: NotificationTypeEnum,
  meta: Record<string, unknown>,
): NotificationResponseInterface {
  return {
    id: 'n-1',
    audience: 'ADMIN' as NotificationResponseInterface['audience'],
    userId: null,
    type,
    title: 'Title',
    body: 'Body',
    meta,
    createdAt: '2026-08-01T00:00:00.000Z',
    readAt: null,
  };
}

describe('resolveNotificationLink', () => {
  it('links CONTACT_MESSAGE to the inbox item carried in meta.contactMessageId', () => {
    const notification = buildNotification(NotificationTypeEnum.CONTACT_MESSAGE, {
      contactMessageId: 'msg-123',
      ip: '1.2.3.4',
    });

    expect(resolveNotificationLink(notification)).toBe('/inbox?messageId=msg-123');
  });

  it('does not link CONTACT_MESSAGE when meta has no usable id', () => {
    const notification = buildNotification(NotificationTypeEnum.CONTACT_MESSAGE, {});

    expect(resolveNotificationLink(notification)).toBeNull();
  });

  it('does not link WEBHOOK_FAILED — meta has an id but no admin view can receive it', () => {
    const notification = buildNotification(NotificationTypeEnum.WEBHOOK_FAILED, {
      webhookEventId: 'wh-1',
      provider: 'stripe',
      type: 'invoice.payment_failed',
      attempts: 3,
      lastError: 'boom',
    });

    expect(resolveNotificationLink(notification)).toBeNull();
  });

  it('links USER_BLOCKED to the user drawer carried in meta.userId', () => {
    const notification = buildNotification(NotificationTypeEnum.USER_BLOCKED, {
      userId: 'u-42',
      actorId: 'admin-1',
      reason: 'spam',
    });

    expect(resolveNotificationLink(notification)).toBe('/users?userId=u-42');
  });

  it('does not link USER_BLOCKED when meta carries no usable userId', () => {
    // A row written before the builder attached userId, or one whose meta
    // holds a non-string: navigating would open a drawer that 404s.
    expect(resolveNotificationLink(buildNotification(NotificationTypeEnum.USER_BLOCKED, {}))).toBe(
      null,
    );
    expect(
      resolveNotificationLink(buildNotification(NotificationTypeEnum.USER_BLOCKED, { userId: 7 })),
    ).toBeNull();
    expect(
      resolveNotificationLink(buildNotification(NotificationTypeEnum.USER_BLOCKED, { userId: '' })),
    ).toBeNull();
  });

  it('encodes an id that is not URL-safe', () => {
    const notification = buildNotification(NotificationTypeEnum.CONTACT_MESSAGE, {
      contactMessageId: 'a b&c=d',
    });

    expect(resolveNotificationLink(notification)).toBe('/inbox?messageId=a%20b%26c%3Dd');
  });

  // meta is scope/value only (an email OR an ip), never a userId, so there is
  // no user to open — but the activity log records the events themselves
  // under a matching type, which works for both scopes.
  it('links SUSPICIOUS_LOGIN to the suspicious-login activity log for either scope', () => {
    const byEmail = buildNotification(NotificationTypeEnum.SUSPICIOUS_LOGIN, {
      scope: 'EMAIL',
      value: 'attacker@example.com',
    });
    const byIp = buildNotification(NotificationTypeEnum.SUSPICIOUS_LOGIN, {
      scope: 'IP',
      value: '1.2.3.4',
    });

    expect(resolveNotificationLink(byEmail)).toBe('/activities?type=AUTH_SUSPICIOUS_LOGIN');
    expect(resolveNotificationLink(byIp)).toBe('/activities?type=AUTH_SUSPICIOUS_LOGIN');
  });

  it('links SUSPICIOUS_LOGIN even when meta is empty — the target needs no meta', () => {
    const notification = buildNotification(NotificationTypeEnum.SUSPICIOUS_LOGIN, {});

    expect(resolveNotificationLink(notification)).toBe('/activities?type=AUTH_SUSPICIOUS_LOGIN');
  });

  it('does not link a type with no deep-link target at all', () => {
    const notification = buildNotification(NotificationTypeEnum.PASSWORD_CHANGED, {});

    expect(resolveNotificationLink(notification)).toBeNull();
  });
});
