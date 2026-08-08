import { type WebsocketConfig, websocketConfig } from '@configs/websocket.config.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
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
import type { NotificationInterface } from '@modules/notification/interfaces/notification.interface.js';
import type { NotificationRepositoryInterface } from '@modules/notification/interfaces/notification-repository.interface.js';
import { NotificationEmailService } from '@modules/notification/services/notification-email.service.js';
import {
  NotificationAudienceEnum,
  type NotificationResponseInterface,
} from '@nest-aws-starter/shared';
import { Inject, Injectable } from '@nestjs/common';

// The dispatcher's fan-out orchestrator, extracted out of
// NotificationDispatcherService (PR 5 code review) so a future channel
// (e.g. PUSH) has one obvious place to add a step, rather than entangling
// further with the event -> type mapping. Mechanical extraction: the three
// channel steps and their independent containment are unchanged from PR 3/4/5
// — only the constructor arguments moved (notificationRepository, gateway,
// emailService instead of being reached through the dispatcher).
@Injectable()
export class NotificationFanOutService {
  private readonly logger = new CustomLoggerService(NotificationFanOutService.name);

  constructor(
    @Inject(websocketConfig.KEY) private readonly config: WebsocketConfig,
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notificationRepository: NotificationRepositoryInterface,
    private readonly gateway: NotificationGateway,
    private readonly emailService: NotificationEmailService,
  ) {}

  // Channel failures log a warning and never roll back the already-persisted
  // row (backend.md §11a's binding "persist-first" rule). Each step below is
  // independently contained — a failure in one never prevents the next.
  public async fanOut(notification: NotificationInterface): Promise<void> {
    this.emitToRoom(notification);

    if (notification.audience === NotificationAudienceEnum.USER && notification.userId) {
      await this.emitUnreadCount(notification.userId);
      await this.sendEmail(notification);
    }
  }

  // With WEBSOCKET_ENABLED=false no socket server is attached at all
  // (DisabledIoAdapter) — the socket channels are skipped outright rather
  // than emitting into a detached server, mirroring the EMAIL channel's own
  // MAIL_ENABLED gate: off means off, in-app rows and email still flow.
  private emitToRoom(notification: NotificationInterface): void {
    if (!this.config.isEnabled) return;

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
  }

  // EMAIL channel, independently contained like the socket pushes above —
  // a mail failure must never affect the persisted row or the IN_APP push
  // (backend.md §11a's "preferences gate channels, never persistence").
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
    if (!this.config.isEnabled) return;

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
}
