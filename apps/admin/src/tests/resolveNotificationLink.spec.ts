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

  it('does not link SUSPICIOUS_LOGIN — meta carries no userId, only scope/value', () => {
    const notification = buildNotification(NotificationTypeEnum.SUSPICIOUS_LOGIN, {
      scope: 'EMAIL',
      value: 'attacker@example.com',
    });

    expect(resolveNotificationLink(notification)).toBeNull();
  });

  it('does not link a type with no deep-link target at all', () => {
    const notification = buildNotification(NotificationTypeEnum.PASSWORD_CHANGED, {});

    expect(resolveNotificationLink(notification)).toBeNull();
  });
});
