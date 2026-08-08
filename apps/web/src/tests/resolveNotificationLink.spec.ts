import { NotificationTypeEnum } from '@nest-aws-starter/shared';
import { describe, expect, it } from 'vitest';
import { resolveNotificationLink } from '../utils/resolveNotificationLink';

// The types a USER-audience notification can actually have (the remaining
// four members are ADMIN-audience and never reach apps/web — it has no admin
// section). Every one of them must resolve to a route that exists in
// App.tsx; a click that marks read and then does nothing is a dead end.
const USER_TYPES: NotificationTypeEnum[] = [
  NotificationTypeEnum.NEW_DEVICE_LOGIN,
  NotificationTypeEnum.PASSWORD_CHANGED,
  NotificationTypeEnum.AUTH_METHOD_CHANGED,
  NotificationTypeEnum.SUBSCRIPTION_ACTIVATED,
  NotificationTypeEnum.SUBSCRIPTION_RENEWED,
  NotificationTypeEnum.PAYMENT_FAILED,
  NotificationTypeEnum.SUBSCRIPTION_ENDED,
];

const ADMIN_TYPES: NotificationTypeEnum[] = [
  NotificationTypeEnum.USER_BLOCKED,
  NotificationTypeEnum.SUSPICIOUS_LOGIN,
  NotificationTypeEnum.CONTACT_MESSAGE,
  NotificationTypeEnum.WEBHOOK_FAILED,
];

describe('resolveNotificationLink', () => {
  it.each(USER_TYPES)('routes %s somewhere', (type: NotificationTypeEnum) => {
    expect(resolveNotificationLink(type)).not.toBeNull();
  });

  it('sends a password change to the sessions page, where the user can revoke', () => {
    expect(resolveNotificationLink(NotificationTypeEnum.PASSWORD_CHANGED)).toBe(
      '/settings/sessions',
    );
  });

  it('sends every billing-related type to the billing page', () => {
    expect(resolveNotificationLink(NotificationTypeEnum.PAYMENT_FAILED)).toBe('/settings/billing');
    expect(resolveNotificationLink(NotificationTypeEnum.SUBSCRIPTION_ACTIVATED)).toBe(
      '/settings/billing',
    );
    expect(resolveNotificationLink(NotificationTypeEnum.SUBSCRIPTION_RENEWED)).toBe(
      '/settings/billing',
    );
    expect(resolveNotificationLink(NotificationTypeEnum.SUBSCRIPTION_ENDED)).toBe(
      '/settings/billing',
    );
  });

  it.each(
    ADMIN_TYPES,
  )('does not route the ADMIN-audience type %s', (type: NotificationTypeEnum) => {
    expect(resolveNotificationLink(type)).toBeNull();
  });
});
