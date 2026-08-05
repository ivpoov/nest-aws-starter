import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { NOTIFICATION_EVENT } from '@modules/notification/constants/notification-events.constants.js';
import { ADMIN_ROOM } from '@modules/notification/constants/notification-rooms.constants.js';
import type { NotificationGateway } from '@modules/notification/gateways/notification.gateway.js';
import type { CreateNotificationDataInterface } from '@modules/notification/interfaces/create-notification-data.interface.js';
import type { NotificationInterface } from '@modules/notification/interfaces/notification.interface.js';
import type { NotificationRepositoryInterface } from '@modules/notification/interfaces/notification-repository.interface.js';
import { NotificationDispatcherService } from '@modules/notification/services/notification-dispatcher.service.js';
import type { NotificationEmailService } from '@modules/notification/services/notification-email.service.js';
import { NotificationFanOutService } from '@modules/notification/services/notification-fan-out.service.js';
import {
  AuthMethodTypeEnum,
  LockoutScopeEnum,
  NotificationAudienceEnum,
  NotificationTypeEnum,
} from '@nest-aws-starter/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const userId = '01890a5d-0000-774b-bcce-b30209990001';
const notificationId = '01890a5d-0000-774b-bcce-b30209990099';

function createFakeNotification(
  overrides: Partial<NotificationInterface> = {},
): NotificationInterface {
  return {
    id: notificationId,
    audience: NotificationAudienceEnum.USER,
    userId,
    type: NotificationTypeEnum.NEW_DEVICE_LOGIN,
    title: 'title',
    body: 'body',
    meta: {},
    createdAt: new Date('2026-08-05T00:00:00.000Z'),
    ...overrides,
  };
}

function createDispatcher(callOrder: string[] = []): {
  dispatcher: NotificationDispatcherService;
  create: ReturnType<typeof vi.fn>;
  countUnread: ReturnType<typeof vi.fn>;
  to: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  sendIfEnabled: ReturnType<typeof vi.fn>;
} {
  const create = vi.fn(async (data: CreateNotificationDataInterface) => {
    callOrder.push('persist');

    return createFakeNotification({
      audience: data.audience,
      userId: data.userId,
      type: data.type,
      title: data.title,
      body: data.body,
      meta: data.meta,
    });
  });
  const countUnread = vi.fn().mockResolvedValue(0);
  const emit = vi.fn(() => {
    callOrder.push('emit');
  });
  const to = vi.fn().mockReturnValue({ emit });
  const sendIfEnabled = vi.fn(async () => {
    callOrder.push('email');
  });

  const notificationRepository = {
    create,
    countUnread,
  } as unknown as NotificationRepositoryInterface;
  const gateway = { server: { to } } as unknown as NotificationGateway;
  const emailService = { sendIfEnabled } as unknown as NotificationEmailService;
  // The dispatcher delegates fan-out to a real NotificationFanOutService
  // wired with the same leaf mocks (PR 5 code review's extraction) — the
  // mocking pattern below is unchanged, only which constructor it feeds.
  const fanOutService = new NotificationFanOutService(
    notificationRepository,
    gateway,
    emailService,
  );
  const dispatcher = new NotificationDispatcherService(notificationRepository, fanOutService);

  return { dispatcher, create, countUnread, to, emit, sendIfEnabled };
}

describe('NotificationDispatcherService', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(CustomLoggerService.prototype, 'warn').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(CustomLoggerService.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('matrix rows — content, audience, and room', () => {
    it('auth.new-device -> NEW_DEVICE_LOGIN, USER audience, user room', async () => {
      const { dispatcher, create, to } = createDispatcher();

      await dispatcher.onAuthNewDevice({ userId, ip: '127.0.0.1', device: 'Chrome on Fedora' });

      expect(create).toHaveBeenCalledWith({
        audience: NotificationAudienceEnum.USER,
        userId,
        type: NotificationTypeEnum.NEW_DEVICE_LOGIN,
        title: 'New device sign-in',
        body: 'A new sign-in to your account was detected from Chrome on Fedora.',
        meta: { device: 'Chrome on Fedora', ip: '127.0.0.1' },
      });
      expect(to).toHaveBeenCalledWith(`user:${userId}`);
    });

    it('auth.password-changed -> PASSWORD_CHANGED', async () => {
      const { dispatcher, create } = createDispatcher();

      await dispatcher.onAuthPasswordChanged({ userId, sessionId: 'session-1' });

      expect(create).toHaveBeenCalledWith({
        audience: NotificationAudienceEnum.USER,
        userId,
        type: NotificationTypeEnum.PASSWORD_CHANGED,
        title: 'Password changed',
        body: 'Your password was changed. If this was not you, secure your account immediately.',
        meta: { sessionId: 'session-1' },
      });
    });

    it('auth.method-linked -> AUTH_METHOD_CHANGED (linked)', async () => {
      const { dispatcher, create } = createDispatcher();

      await dispatcher.onAuthMethodLinked({ userId, type: AuthMethodTypeEnum.GOOGLE });

      expect(create).toHaveBeenCalledWith({
        audience: NotificationAudienceEnum.USER,
        userId,
        type: NotificationTypeEnum.AUTH_METHOD_CHANGED,
        title: 'Sign-in method added',
        body: 'A GOOGLE sign-in method was linked to your account.',
        meta: { methodType: AuthMethodTypeEnum.GOOGLE, action: 'linked' },
      });
    });

    it('auth.method-unlinked -> AUTH_METHOD_CHANGED (unlinked)', async () => {
      const { dispatcher, create } = createDispatcher();

      await dispatcher.onAuthMethodUnlinked({ userId, type: AuthMethodTypeEnum.EMAIL });

      expect(create).toHaveBeenCalledWith({
        audience: NotificationAudienceEnum.USER,
        userId,
        type: NotificationTypeEnum.AUTH_METHOD_CHANGED,
        title: 'Sign-in method removed',
        body: 'A EMAIL sign-in method was unlinked to your account.',
        meta: { methodType: AuthMethodTypeEnum.EMAIL, action: 'unlinked' },
      });
    });

    it('subscription.activated -> SUBSCRIPTION_ACTIVATED', async () => {
      const { dispatcher, create } = createDispatcher();

      await dispatcher.onSubscriptionActivated({
        userId,
        subscriptionId: 'sub-1',
        planId: 'plan-1',
      });

      expect(create).toHaveBeenCalledWith({
        audience: NotificationAudienceEnum.USER,
        userId,
        type: NotificationTypeEnum.SUBSCRIPTION_ACTIVATED,
        title: 'Subscription activated',
        body: 'Your subscription is now active.',
        meta: { subscriptionId: 'sub-1', planId: 'plan-1' },
      });
    });

    it('subscription.renewed -> SUBSCRIPTION_RENEWED', async () => {
      const { dispatcher, create } = createDispatcher();

      await dispatcher.onSubscriptionRenewed({ userId, subscriptionId: 'sub-1' });

      expect(create).toHaveBeenCalledWith({
        audience: NotificationAudienceEnum.USER,
        userId,
        type: NotificationTypeEnum.SUBSCRIPTION_RENEWED,
        title: 'Subscription renewed',
        body: 'Your subscription was renewed.',
        meta: { subscriptionId: 'sub-1' },
      });
    });

    it('subscription.past-due -> PAYMENT_FAILED', async () => {
      const { dispatcher, create } = createDispatcher();

      await dispatcher.onSubscriptionPastDue({ userId, subscriptionId: 'sub-1' });

      expect(create).toHaveBeenCalledWith({
        audience: NotificationAudienceEnum.USER,
        userId,
        type: NotificationTypeEnum.PAYMENT_FAILED,
        title: 'Payment failed',
        body: 'We could not process your last payment. Please update your payment method.',
        meta: { subscriptionId: 'sub-1' },
      });
    });

    it('subscription.canceled -> SUBSCRIPTION_ENDED (canceled)', async () => {
      const { dispatcher, create } = createDispatcher();

      await dispatcher.onSubscriptionCanceled({ userId, subscriptionId: 'sub-1' });

      expect(create).toHaveBeenCalledWith({
        audience: NotificationAudienceEnum.USER,
        userId,
        type: NotificationTypeEnum.SUBSCRIPTION_ENDED,
        title: 'Subscription ended',
        body: 'Your subscription was canceled.',
        meta: { subscriptionId: 'sub-1', reason: 'canceled' },
      });
    });

    it('subscription.expired -> SUBSCRIPTION_ENDED (expired)', async () => {
      const { dispatcher, create } = createDispatcher();

      await dispatcher.onSubscriptionExpired({ userId, subscriptionId: 'sub-1' });

      expect(create).toHaveBeenCalledWith({
        audience: NotificationAudienceEnum.USER,
        userId,
        type: NotificationTypeEnum.SUBSCRIPTION_ENDED,
        title: 'Subscription ended',
        body: 'Your subscription has expired.',
        meta: { subscriptionId: 'sub-1', reason: 'expired' },
      });
    });

    it('user.blocked -> USER_BLOCKED, ADMIN audience, admins room', async () => {
      const { dispatcher, create, to } = createDispatcher();

      await dispatcher.onUserBlocked({ userId, actorId: 'admin-1', reason: 'ToS violation' });

      expect(create).toHaveBeenCalledWith({
        audience: NotificationAudienceEnum.ADMIN,
        userId: null,
        type: NotificationTypeEnum.USER_BLOCKED,
        title: 'User blocked',
        body: 'A user was blocked: ToS violation',
        meta: { userId, actorId: 'admin-1', reason: 'ToS violation' },
      });
      expect(to).toHaveBeenCalledWith(ADMIN_ROOM);
    });

    it('auth.suspicious-login -> SUSPICIOUS_LOGIN, ADMIN audience', async () => {
      const { dispatcher, create, to } = createDispatcher();

      await dispatcher.onAuthSuspiciousLogin({ scope: LockoutScopeEnum.IP, value: '127.0.0.1' });

      expect(create).toHaveBeenCalledWith({
        audience: NotificationAudienceEnum.ADMIN,
        userId: null,
        type: NotificationTypeEnum.SUSPICIOUS_LOGIN,
        title: 'Suspicious login activity',
        body: 'Suspicious login activity was detected (IP: 127.0.0.1).',
        meta: { scope: LockoutScopeEnum.IP, value: '127.0.0.1' },
      });
      expect(to).toHaveBeenCalledWith(ADMIN_ROOM);
    });

    it('contact.received -> CONTACT_MESSAGE, ADMIN audience', async () => {
      const { dispatcher, create, to } = createDispatcher();

      await dispatcher.onContactReceived({ contactMessageId: 'contact-1', ip: '127.0.0.1' });

      expect(create).toHaveBeenCalledWith({
        audience: NotificationAudienceEnum.ADMIN,
        userId: null,
        type: NotificationTypeEnum.CONTACT_MESSAGE,
        title: 'New contact message',
        body: 'A new contact message was received.',
        meta: { contactMessageId: 'contact-1', ip: '127.0.0.1' },
      });
      expect(to).toHaveBeenCalledWith(ADMIN_ROOM);
    });

    it('webhook.failed -> WEBHOOK_FAILED, ADMIN audience, admins room', async () => {
      const { dispatcher, create, to } = createDispatcher();

      await dispatcher.onWebhookFailed({
        webhookEventId: 'webhook-1',
        provider: 'STRIPE',
        type: 'PAYMENT_FAILED',
        attempts: 5,
        lastError: 'lifecycle unreachable',
      });

      expect(create).toHaveBeenCalledWith({
        audience: NotificationAudienceEnum.ADMIN,
        userId: null,
        type: NotificationTypeEnum.WEBHOOK_FAILED,
        title: 'Webhook processing failed',
        body: 'A STRIPE webhook (PAYMENT_FAILED) failed after 5 attempt(s).',
        meta: {
          webhookEventId: 'webhook-1',
          provider: 'STRIPE',
          type: 'PAYMENT_FAILED',
          attempts: 5,
          lastError: 'lifecycle unreachable',
        },
      });
      expect(to).toHaveBeenCalledWith(ADMIN_ROOM);
    });
  });

  describe('persist-first ordering and containment', () => {
    it('persists before fanning out to the gateway', async () => {
      const callOrder: string[] = [];
      const { dispatcher } = createDispatcher(callOrder);

      await dispatcher.onAuthNewDevice({ userId, ip: '127.0.0.1', device: 'Chrome on Fedora' });

      // Two emits for a USER-audience row: the notification push, then the
      // unread-count push — then the EMAIL channel, all strictly after the
      // persist.
      expect(callOrder).toEqual(['persist', 'emit', 'emit', 'email']);
    });

    it('emits the denormalized response shape into the room', async () => {
      const { dispatcher, emit } = createDispatcher();

      await dispatcher.onAuthNewDevice({ userId, ip: '127.0.0.1', device: 'Chrome on Fedora' });

      expect(emit).toHaveBeenCalledWith(
        NOTIFICATION_EVENT,
        expect.objectContaining({
          id: notificationId,
          audience: NotificationAudienceEnum.USER,
          userId,
          type: NotificationTypeEnum.NEW_DEVICE_LOGIN,
          createdAt: '2026-08-05T00:00:00.000Z',
        }),
      );
    });

    it('a persistence failure is swallowed, logged, and never reaches the gateway', async () => {
      const { to } = createDispatcher();
      const notificationRepository = {
        create: vi.fn().mockRejectedValue(new Error('db unavailable')),
        countUnread: vi.fn().mockResolvedValue(0),
      } as unknown as NotificationRepositoryInterface;
      const gateway = { server: { to } } as unknown as NotificationGateway;
      const emailService = {
        sendIfEnabled: vi.fn(),
      } as unknown as NotificationEmailService;
      const fanOutService = new NotificationFanOutService(
        notificationRepository,
        gateway,
        emailService,
      );
      const failingDispatcher = new NotificationDispatcherService(
        notificationRepository,
        fanOutService,
      );

      await expect(
        failingDispatcher.onAuthNewDevice({ userId, ip: '127.0.0.1', device: 'Chrome' }),
      ).resolves.toBeUndefined();

      expect(to).not.toHaveBeenCalled();
      expect(emailService.sendIfEnabled).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('a channel delivery failure is swallowed and logged at warn — the row is not rolled back', async () => {
      const create = vi.fn().mockResolvedValue(createFakeNotification());
      const emit = vi.fn(() => {
        throw new Error('socket server unavailable');
      });
      const to = vi.fn().mockReturnValue({ emit });
      const notificationRepository = {
        create,
        countUnread: vi.fn().mockResolvedValue(0),
      } as unknown as NotificationRepositoryInterface;
      const gateway = { server: { to } } as unknown as NotificationGateway;
      const emailService = {
        sendIfEnabled: vi.fn(),
      } as unknown as NotificationEmailService;
      const fanOutService = new NotificationFanOutService(
        notificationRepository,
        gateway,
        emailService,
      );
      const dispatcher = new NotificationDispatcherService(notificationRepository, fanOutService);

      await expect(
        dispatcher.onAuthNewDevice({ userId, ip: '127.0.0.1', device: 'Chrome' }),
      ).resolves.toBeUndefined();

      // Both the notification emit and the unread-count emit go through the
      // same (failing) channel, each independently caught and logged —
      // two warns, never an error, and the row still persisted once. The
      // EMAIL channel is independently contained: a socket failure never
      // stops it from being attempted.
      expect(create).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledTimes(2);
      expect(errorSpy).not.toHaveBeenCalled();
      expect(emailService.sendIfEnabled).toHaveBeenCalledTimes(1);
    });
  });

  describe('EMAIL channel (independently contained)', () => {
    it('sends the EMAIL channel for a USER-audience notification with the persisted content', async () => {
      const { dispatcher, sendIfEnabled } = createDispatcher();

      await dispatcher.onAuthPasswordChanged({ userId, sessionId: 'session-1' });

      expect(sendIfEnabled).toHaveBeenCalledWith(
        userId,
        NotificationTypeEnum.PASSWORD_CHANGED,
        'Password changed',
        'Your password was changed. If this was not you, secure your account immediately.',
      );
    });

    it('never attempts EMAIL for an ADMIN-audience notification (no per-user recipient)', async () => {
      const { dispatcher, sendIfEnabled } = createDispatcher();

      await dispatcher.onUserBlocked({ userId, actorId: 'admin-1', reason: 'ToS violation' });

      expect(sendIfEnabled).not.toHaveBeenCalled();
    });

    it('an EMAIL failure is swallowed and logged at warn — the row and socket push are unaffected', async () => {
      const { dispatcher, create, emit, sendIfEnabled } = createDispatcher();

      sendIfEnabled.mockRejectedValueOnce(new Error('mail transport unavailable'));

      await expect(
        dispatcher.onAuthNewDevice({ userId, ip: '127.0.0.1', device: 'Chrome on Fedora' }),
      ).resolves.toBeUndefined();

      expect(create).toHaveBeenCalledTimes(1);
      expect(emit).toHaveBeenCalledWith(
        NOTIFICATION_EVENT,
        expect.objectContaining({ userId, type: NotificationTypeEnum.NEW_DEVICE_LOGIN }),
      );
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe('unread-count emission (USER-audience only)', () => {
    it('emits an updated unread count to the recipient after a USER-audience notification', async () => {
      const { dispatcher, countUnread, to, emit } = createDispatcher();

      countUnread.mockResolvedValue(4);

      await dispatcher.onAuthNewDevice({ userId, ip: '127.0.0.1', device: 'Chrome on Fedora' });

      expect(countUnread).toHaveBeenCalledWith({ userId, includeAdmin: false });
      expect(to).toHaveBeenCalledWith(`user:${userId}`);
      expect(emit).toHaveBeenCalledWith('unread-count', 4);
    });

    it('does not emit an unread count for an ADMIN-audience notification', async () => {
      const { dispatcher, countUnread, emit } = createDispatcher();

      await dispatcher.onUserBlocked({ userId, actorId: 'admin-1', reason: 'ToS violation' });

      expect(countUnread).not.toHaveBeenCalled();
      expect(emit).not.toHaveBeenCalledWith('unread-count', expect.anything());
    });

    it('a count-query failure is swallowed and logged at warn without affecting the notification emit', async () => {
      const { dispatcher, countUnread, emit } = createDispatcher();

      countUnread.mockRejectedValue(new Error('db unavailable'));

      await expect(
        dispatcher.onAuthNewDevice({ userId, ip: '127.0.0.1', device: 'Chrome on Fedora' }),
      ).resolves.toBeUndefined();

      expect(emit).toHaveBeenCalledWith(
        'notification',
        expect.objectContaining({ userId, type: NotificationTypeEnum.NEW_DEVICE_LOGIN }),
      );
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });
});
