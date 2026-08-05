import {
  AUTH_METHOD_LINKED_EVENT,
  AUTH_METHOD_UNLINKED_EVENT,
  AUTH_NEW_DEVICE_EVENT,
  AUTH_PASSWORD_CHANGED_EVENT,
  AUTH_SUSPICIOUS_LOGIN_EVENT,
  CONTACT_RECEIVED_EVENT,
  SUBSCRIPTION_ACTIVATED_EVENT,
  SUBSCRIPTION_CANCELED_EVENT,
  SUBSCRIPTION_EXPIRED_EVENT,
  SUBSCRIPTION_PAST_DUE_EVENT,
  SUBSCRIPTION_RENEWED_EVENT,
  USER_BLOCKED_EVENT,
  WEBHOOK_FAILED_EVENT,
} from '@modules/event/constants/event-names.constants.js';
import { OnDomainEvent } from '@modules/event/decorators/on-domain-event.decorator.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { buildAuthMethodChangedContent } from '@modules/notification/builders/auth-method-changed.builder.js';
import { buildContactMessageContent } from '@modules/notification/builders/contact-message.builder.js';
import { buildNewDeviceLoginContent } from '@modules/notification/builders/new-device-login.builder.js';
import { buildPasswordChangedContent } from '@modules/notification/builders/password-changed.builder.js';
import { buildPaymentFailedContent } from '@modules/notification/builders/payment-failed.builder.js';
import { buildSubscriptionActivatedContent } from '@modules/notification/builders/subscription-activated.builder.js';
import { buildSubscriptionEndedContent } from '@modules/notification/builders/subscription-ended.builder.js';
import { buildSubscriptionRenewedContent } from '@modules/notification/builders/subscription-renewed.builder.js';
import { buildSuspiciousLoginContent } from '@modules/notification/builders/suspicious-login.builder.js';
import { buildUserBlockedContent } from '@modules/notification/builders/user-blocked.builder.js';
import { buildWebhookFailedContent } from '@modules/notification/builders/webhook-failed.builder.js';
import { NOTIFICATION_REPOSITORY } from '@modules/notification/constants/notification.constants.js';
import {
  NOTIFICATION_EVENT,
  UNREAD_COUNT_EVENT,
} from '@modules/notification/constants/notification-events.constants.js';
import {
  ADMIN_ROOM,
  buildUserRoom,
} from '@modules/notification/constants/notification-rooms.constants.js';
import { NotificationGateway } from '@modules/notification/gateways/notification.gateway.js';
import type { AuthMethodLinkedPayloadInterface } from '@modules/notification/interfaces/auth-method-linked-payload.interface.js';
import type { AuthMethodUnlinkedPayloadInterface } from '@modules/notification/interfaces/auth-method-unlinked-payload.interface.js';
import type { AuthNewDevicePayloadInterface } from '@modules/notification/interfaces/auth-new-device-payload.interface.js';
import type { AuthPasswordChangedPayloadInterface } from '@modules/notification/interfaces/auth-password-changed-payload.interface.js';
import type { AuthSuspiciousLoginPayloadInterface } from '@modules/notification/interfaces/auth-suspicious-login-payload.interface.js';
import type { ContactReceivedPayloadInterface } from '@modules/notification/interfaces/contact-received-payload.interface.js';
import type { DispatchInputInterface } from '@modules/notification/interfaces/dispatch-input.interface.js';
import type { NotificationInterface } from '@modules/notification/interfaces/notification.interface.js';
import type { NotificationRepositoryInterface } from '@modules/notification/interfaces/notification-repository.interface.js';
import type { SubscriptionActivatedPayloadInterface } from '@modules/notification/interfaces/subscription-activated-payload.interface.js';
import type { SubscriptionCanceledPayloadInterface } from '@modules/notification/interfaces/subscription-canceled-payload.interface.js';
import type { SubscriptionExpiredPayloadInterface } from '@modules/notification/interfaces/subscription-expired-payload.interface.js';
import type { SubscriptionPastDuePayloadInterface } from '@modules/notification/interfaces/subscription-past-due-payload.interface.js';
import type { SubscriptionRenewedPayloadInterface } from '@modules/notification/interfaces/subscription-renewed-payload.interface.js';
import type { UserBlockedPayloadInterface } from '@modules/notification/interfaces/user-blocked-payload.interface.js';
import type { WebhookFailedPayloadInterface } from '@modules/notification/interfaces/webhook-failed-payload.interface.js';
import { NotificationEmailService } from '@modules/notification/services/notification-email.service.js';
import {
  NotificationAudienceEnum,
  type NotificationResponseInterface,
  NotificationTypeEnum,
} from '@nest-aws-starter/shared';
import { Inject, Injectable } from '@nestjs/common';

// The only bus subscriber in the module (task-3-brief.md's event -> type
// matrix, all 11 rows mapped). Every handler below funnels into dispatch():
// persist first, fan out second — a channel/socket failure must never lose
// or roll back the row (backend.md's "persist-first" rule), and a
// persistence failure must never break the emitting feature (same
// containment pattern as ActivityListener.safeRecord).
//
// webhook.failed's WEBHOOK_FAILED_EVENT is emitted by
// PaymentWebhookConsumerService at the FAILED ceiling (payment module) —
// the release plan's matrix line, not this module's brief, governs that
// emit site; see task-3-report.md for the correction.
//
// PR 5 adds a third, independently-contained fan-out step: the EMAIL
// channel (NotificationEmailService), gated on the recipient's stored
// preference (or its default) behind mail's own isEnabled — see
// task-5-report.md. This file is already past backend.md's 300-line split
// guideline (it was at 316 before this PR); the 11-row event matrix is the
// bulk of it and splitting the matrix out is left as a follow-up rather
// than risking PR 3/4's existing dispatcher tests in this PR.
@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new CustomLoggerService(NotificationDispatcherService.name);

  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notificationRepository: NotificationRepositoryInterface,
    private readonly gateway: NotificationGateway,
    private readonly emailService: NotificationEmailService,
  ) {}

  @OnDomainEvent(AUTH_NEW_DEVICE_EVENT)
  public async onAuthNewDevice(payload: AuthNewDevicePayloadInterface): Promise<void> {
    await this.dispatch({
      audience: NotificationAudienceEnum.USER,
      userId: payload.userId,
      type: NotificationTypeEnum.NEW_DEVICE_LOGIN,
      content: buildNewDeviceLoginContent(payload),
    });
  }

  @OnDomainEvent(AUTH_PASSWORD_CHANGED_EVENT)
  public async onAuthPasswordChanged(payload: AuthPasswordChangedPayloadInterface): Promise<void> {
    await this.dispatch({
      audience: NotificationAudienceEnum.USER,
      userId: payload.userId,
      type: NotificationTypeEnum.PASSWORD_CHANGED,
      content: buildPasswordChangedContent(payload),
    });
  }

  @OnDomainEvent(AUTH_METHOD_LINKED_EVENT)
  public async onAuthMethodLinked(payload: AuthMethodLinkedPayloadInterface): Promise<void> {
    await this.dispatch({
      audience: NotificationAudienceEnum.USER,
      userId: payload.userId,
      type: NotificationTypeEnum.AUTH_METHOD_CHANGED,
      content: buildAuthMethodChangedContent(payload.type, 'linked'),
    });
  }

  @OnDomainEvent(AUTH_METHOD_UNLINKED_EVENT)
  public async onAuthMethodUnlinked(payload: AuthMethodUnlinkedPayloadInterface): Promise<void> {
    await this.dispatch({
      audience: NotificationAudienceEnum.USER,
      userId: payload.userId,
      type: NotificationTypeEnum.AUTH_METHOD_CHANGED,
      content: buildAuthMethodChangedContent(payload.type, 'unlinked'),
    });
  }

  @OnDomainEvent(SUBSCRIPTION_ACTIVATED_EVENT)
  public async onSubscriptionActivated(
    payload: SubscriptionActivatedPayloadInterface,
  ): Promise<void> {
    await this.dispatch({
      audience: NotificationAudienceEnum.USER,
      userId: payload.userId,
      type: NotificationTypeEnum.SUBSCRIPTION_ACTIVATED,
      content: buildSubscriptionActivatedContent(payload),
    });
  }

  @OnDomainEvent(SUBSCRIPTION_RENEWED_EVENT)
  public async onSubscriptionRenewed(payload: SubscriptionRenewedPayloadInterface): Promise<void> {
    await this.dispatch({
      audience: NotificationAudienceEnum.USER,
      userId: payload.userId,
      type: NotificationTypeEnum.SUBSCRIPTION_RENEWED,
      content: buildSubscriptionRenewedContent(payload),
    });
  }

  @OnDomainEvent(SUBSCRIPTION_PAST_DUE_EVENT)
  public async onSubscriptionPastDue(payload: SubscriptionPastDuePayloadInterface): Promise<void> {
    await this.dispatch({
      audience: NotificationAudienceEnum.USER,
      userId: payload.userId,
      type: NotificationTypeEnum.PAYMENT_FAILED,
      content: buildPaymentFailedContent(payload),
    });
  }

  @OnDomainEvent(SUBSCRIPTION_CANCELED_EVENT)
  public async onSubscriptionCanceled(
    payload: SubscriptionCanceledPayloadInterface,
  ): Promise<void> {
    await this.dispatch({
      audience: NotificationAudienceEnum.USER,
      userId: payload.userId,
      type: NotificationTypeEnum.SUBSCRIPTION_ENDED,
      content: buildSubscriptionEndedContent(payload.subscriptionId, 'canceled'),
    });
  }

  @OnDomainEvent(SUBSCRIPTION_EXPIRED_EVENT)
  public async onSubscriptionExpired(payload: SubscriptionExpiredPayloadInterface): Promise<void> {
    await this.dispatch({
      audience: NotificationAudienceEnum.USER,
      userId: payload.userId,
      type: NotificationTypeEnum.SUBSCRIPTION_ENDED,
      content: buildSubscriptionEndedContent(payload.subscriptionId, 'expired'),
    });
  }

  @OnDomainEvent(USER_BLOCKED_EVENT)
  public async onUserBlocked(payload: UserBlockedPayloadInterface): Promise<void> {
    await this.dispatch({
      audience: NotificationAudienceEnum.ADMIN,
      userId: null,
      type: NotificationTypeEnum.USER_BLOCKED,
      content: buildUserBlockedContent(payload),
    });
  }

  @OnDomainEvent(AUTH_SUSPICIOUS_LOGIN_EVENT)
  public async onAuthSuspiciousLogin(payload: AuthSuspiciousLoginPayloadInterface): Promise<void> {
    await this.dispatch({
      audience: NotificationAudienceEnum.ADMIN,
      userId: null,
      type: NotificationTypeEnum.SUSPICIOUS_LOGIN,
      content: buildSuspiciousLoginContent(payload),
    });
  }

  @OnDomainEvent(CONTACT_RECEIVED_EVENT)
  public async onContactReceived(payload: ContactReceivedPayloadInterface): Promise<void> {
    await this.dispatch({
      audience: NotificationAudienceEnum.ADMIN,
      userId: null,
      type: NotificationTypeEnum.CONTACT_MESSAGE,
      content: buildContactMessageContent(payload),
    });
  }

  @OnDomainEvent(WEBHOOK_FAILED_EVENT)
  public async onWebhookFailed(payload: WebhookFailedPayloadInterface): Promise<void> {
    await this.dispatch({
      audience: NotificationAudienceEnum.ADMIN,
      userId: null,
      type: NotificationTypeEnum.WEBHOOK_FAILED,
      content: buildWebhookFailedContent(payload),
    });
  }

  private async dispatch(input: DispatchInputInterface): Promise<void> {
    const notification: NotificationInterface | null = await this.persist(input);

    if (!notification) return;

    await this.fanOut(notification);
  }

  // Persist-first: a write failure here is terminal for this event — there
  // is no row, so there is nothing left to fan out. Never rethrown, mirrors
  // ActivityListener.safeRecord: a notification failure must never break
  // the feature that emitted the event.
  private async persist(input: DispatchInputInterface): Promise<NotificationInterface | null> {
    try {
      return await this.notificationRepository.create({
        audience: input.audience,
        userId: input.userId,
        type: input.type,
        title: input.content.title,
        body: input.content.body,
        meta: input.content.meta,
      });
    } catch (caught) {
      this.logError(`Failed to persist notification ${input.type}`, caught);

      return null;
    }
  }

  // Channel failures log a warning and never roll back the already-persisted
  // row (backend.md's binding "persist-first" rule). The unread-count push
  // is a separate, independently-contained step (see emitUnreadCount) so a
  // count-query failure can never take down the notification emit above it.
  private async fanOut(notification: NotificationInterface): Promise<void> {
    try {
      const room: string =
        notification.audience === NotificationAudienceEnum.ADMIN
          ? ADMIN_ROOM
          : buildUserRoom(notification.userId as string);

      this.gateway.server.to(room).emit(NOTIFICATION_EVENT, this.toResponse(notification));
    } catch (caught) {
      this.logger.warn(
        `Notification channel delivery failed for ${notification.id}: ${this.describe(caught)}`,
      );
    }

    if (notification.audience === NotificationAudienceEnum.USER && notification.userId) {
      await this.emitUnreadCount(notification.userId);
      await this.sendEmail(notification);
    }
  }

  // EMAIL channel, independently contained like the socket pushes above —
  // a mail failure must never affect the persisted row or the IN_APP push
  // (backend.md's "preferences gate channels, never persistence").
  private async sendEmail(notification: NotificationInterface): Promise<void> {
    if (!notification.userId) return;

    try {
      await this.emailService.sendIfEnabled(
        notification.userId,
        notification.type,
        notification.title,
        notification.body,
      );
    } catch (caught) {
      this.logger.warn(
        `Notification email delivery failed for ${notification.id}: ${this.describe(caught)}`,
      );
    }
  }

  // USER-audience only: PR 3 deferred this push because it needs the
  // read-side query PR 4 built (NotificationRepositoryInterface.countUnread).
  // Scoped to the recipient's own USER-audience unread count, even if they
  // happen to hold the ADMIN role — a merged count would need a User lookup
  // this hot path doesn't otherwise need; GET /notifications/unread-count
  // returns the full merged figure for an admin who wants it. No
  // broadcast-wide equivalent exists for ADMIN-audience rows: unlike a
  // single user's count, admins have independent per-admin read histories
  // (lazy receipts), so there is no single number to push to the whole
  // admins room.
  private async emitUnreadCount(userId: string): Promise<void> {
    try {
      const count: number = await this.notificationRepository.countUnread({
        userId,
        includeAdmin: false,
      });

      this.gateway.server.to(buildUserRoom(userId)).emit(UNREAD_COUNT_EVENT, count);
    } catch (caught) {
      this.logger.warn(`Unread-count emission failed for ${userId}: ${this.describe(caught)}`);
    }
  }

  private toResponse(notification: NotificationInterface): NotificationResponseInterface {
    return {
      id: notification.id,
      audience: notification.audience,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      meta: notification.meta,
      createdAt: notification.createdAt.toISOString(),
      // Brand-new at the moment of this push — never yet read.
      readAt: null,
    };
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private logError(message: string, caught: unknown): void {
    const stack: string | undefined = caught instanceof Error ? caught.stack : undefined;

    this.logger.error(`${message}: ${this.describe(caught)}`, stack);
  }
}
