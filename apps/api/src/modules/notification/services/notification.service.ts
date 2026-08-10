import type { CurrentUserInterface } from '@interfaces/current-user.interface.js';
import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import { ForbiddenError } from '@modules/common/errors/forbidden.error.js';
import { NotFoundError } from '@modules/common/errors/not-found.error.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { NOTIFICATION_REPOSITORY } from '@modules/notification/constants/notification.constants.js';
import {
  NOTIFICATION_ACCESS_DENIED,
  NOTIFICATION_NOT_FOUND,
} from '@modules/notification/constants/notification-errors.constants.js';
import type { NotificationInterface } from '@modules/notification/interfaces/notification.interface.js';
import type { NotificationListInterface } from '@modules/notification/interfaces/notification-list.interface.js';
import type { NotificationListItemInterface } from '@modules/notification/interfaces/notification-list-item.interface.js';
import type { NotificationListQueryInterface } from '@modules/notification/interfaces/notification-list-query.interface.js';
import type { NotificationRepositoryInterface } from '@modules/notification/interfaces/notification-repository.interface.js';
import type { NotificationScopeFiltersInterface } from '@modules/notification/interfaces/notification-scope-filters.interface.js';
import type { NotificationUnreadCountInterface } from '@modules/notification/interfaces/notification-unread-count.interface.js';
import { NotificationAudienceEnum, UserRoleEnum } from '@nest-aws-starter/shared';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class NotificationService {
  private readonly logger = new CustomLoggerService(NotificationService.name);

  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notificationRepository: NotificationRepositoryInterface,
  ) {}

  // The merged feed: own USER-audience rows, plus every ADMIN-audience row
  // when the caller is an admin — one merged USER+ADMIN feed from one table,
  // resolved by role, not two requests.
  public async findMany(
    user: CurrentUserInterface,
    pagination: CursorPaginationInterface,
    query: NotificationListQueryInterface,
  ): Promise<NotificationListInterface> {
    const items: NotificationListItemInterface[] = await this.notificationRepository.findManyAfter(
      pagination,
      { ...this.toScope(user), ...query },
    );
    const lastItem: NotificationListItemInterface | undefined = items[items.length - 1];
    const nextCursor: string | null =
      items.length === pagination.limit && lastItem ? lastItem.id : null;

    return { items, nextCursor };
  }

  public async countUnread(user: CurrentUserInterface): Promise<NotificationUnreadCountInterface> {
    const count: number = await this.notificationRepository.countUnread(this.toScope(user));

    return { count };
  }

  // Idempotent by construction: findVisibleOrThrow still 404/403s on a
  // bad/unowned id, but the repository's markRead is itself a no-op once
  // already read — never an error on re-marking.
  public async markRead(id: string, user: CurrentUserInterface): Promise<void> {
    const notification: NotificationInterface = await this.findVisibleOrThrow(id, user);

    await this.notificationRepository.markRead(notification.id, user.id);
    this.logger.debug(`Notification marked read: ${notification.id} by ${user.id}`);
  }

  public async markAllRead(user: CurrentUserInterface): Promise<void> {
    await this.notificationRepository.markAllRead(this.toScope(user));

    this.logger.debug(`All notifications marked read for ${user.id}`);
  }

  // 404 for a missing row, 403 for one that exists but isn't the caller's —
  // existence is not leaked the other way around because notification ids
  // are not guessable (UUIDv7), same pattern as NoteService.findOwnedOrThrow.
  private async findVisibleOrThrow(
    id: string,
    user: CurrentUserInterface,
  ): Promise<NotificationInterface> {
    const notification: NotificationInterface | null =
      await this.notificationRepository.findById(id);

    if (!notification) throw new NotFoundError(NOTIFICATION_NOT_FOUND);

    if (!this.isVisible(notification, user)) throw new ForbiddenError(NOTIFICATION_ACCESS_DENIED);

    return notification;
  }

  // A USER row belongs to its userId; an ADMIN row is readable only by
  // ADMIN role — the binding ownership rule, enforced here,
  // not in CASL (which only gates the class-level action).
  private isVisible(notification: NotificationInterface, user: CurrentUserInterface): boolean {
    if (notification.audience === NotificationAudienceEnum.USER) {
      return notification.userId === user.id;
    }

    return user.role === UserRoleEnum.ADMIN;
  }

  private toScope(user: CurrentUserInterface): NotificationScopeFiltersInterface {
    return { userId: user.id, includeAdmin: user.role === UserRoleEnum.ADMIN };
  }
}
