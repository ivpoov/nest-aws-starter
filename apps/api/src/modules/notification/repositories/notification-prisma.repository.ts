import type { Prisma } from '@generated/prisma/client.js';
import { NotificationAudience } from '@generated/prisma/enums.js';
import type { NotificationGetPayload, NotificationModel } from '@generated/prisma/models.js';
import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import type { CreateNotificationDataInterface } from '@modules/notification/interfaces/create-notification-data.interface.js';
import type { NotificationInterface } from '@modules/notification/interfaces/notification.interface.js';
import type { NotificationListFiltersInterface } from '@modules/notification/interfaces/notification-list-filters.interface.js';
import type { NotificationListItemInterface } from '@modules/notification/interfaces/notification-list-item.interface.js';
import type { NotificationRepositoryInterface } from '@modules/notification/interfaces/notification-repository.interface.js';
import type { NotificationScopeFiltersInterface } from '@modules/notification/interfaces/notification-scope-filters.interface.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { NotificationAudienceEnum, type NotificationTypeEnum } from '@nest-aws-starter/shared';
import { Injectable } from '@nestjs/common';

type NotificationWithOwnReceipt = NotificationGetPayload<{ include: { receipts: true } }>;

@Injectable()
export class NotificationPrismaRepository implements NotificationRepositoryInterface {
  constructor(private readonly prisma: PrismaService) {}

  // USER audience creates its single reader receipt in the same nested
  // write (eager, per the Task 1 schema note); ADMIN audience creates only
  // the row — no per-admin fan-out, receipts are created lazily by
  // markRead/markAllRead below.
  public async create(data: CreateNotificationDataInterface): Promise<NotificationInterface> {
    const isUserAudience: boolean = data.audience === NotificationAudienceEnum.USER;

    const notification: NotificationModel = await this.prisma.notification.create({
      data: {
        audience: NotificationAudience[data.audience],
        userId: data.userId,
        type: data.type,
        title: data.title,
        body: data.body,
        meta: data.meta as Prisma.InputJsonValue,
        ...(isUserAudience && data.userId && { receipts: { create: [{ userId: data.userId }] } }),
      },
    });

    return this.toDomain(notification);
  }

  public async findById(id: string): Promise<NotificationInterface | null> {
    const notification: NotificationModel | null = await this.prisma.notification.findUnique({
      where: { id },
    });

    return notification ? this.toDomain(notification) : null;
  }

  // Merges the caller's own USER-audience rows with every ADMIN-audience
  // row when includeAdmin is set — one table, no join, per the caller's
  // scope (see NotificationScopeFiltersInterface). `readAt` is resolved
  // from the caller's own receipt via a filtered include, never a second
  // query.
  //
  // Keyset pagination, not Prisma's `cursor` + `skip: 1`: this feed's `where`
  // carries filters over mutable state (unreadOnly), so the cursor row can
  // stop matching between two page requests. `skip: 1` exists only to drop
  // the cursor row, and once the filter has already dropped it the offset
  // eats the next legitimate row instead — the reader silently never sees
  // it. Comparing ids in the `where` is correct for every filter
  // combination because it does not depend on the cursor row surviving.
  public async findManyAfter(
    pagination: CursorPaginationInterface,
    filters: NotificationListFiltersInterface,
  ): Promise<NotificationListItemInterface[]> {
    const notifications: NotificationWithOwnReceipt[] = await this.prisma.notification.findMany({
      where: {
        ...this.buildScopeWhere(filters, filters.audience),
        ...(filters.type && { type: filters.type }),
        ...(filters.unreadOnly && this.unreadFilter(filters.userId)),
        // Strictly older than the previous page's last id — UUIDv7 ids are
        // time-ordered, so `lt` under `id: 'desc'` is "the next page".
        ...(pagination.cursor && { id: { lt: pagination.cursor } }),
      },
      include: { receipts: { where: { userId: filters.userId } } },
      take: pagination.limit,
      // UUIDv7 ids are time-ordered — id order IS creation order.
      orderBy: { id: 'desc' },
    });

    return notifications.map(
      (notification: NotificationWithOwnReceipt): NotificationListItemInterface =>
        this.toListItem(notification),
    );
  }

  public async countUnread(filters: NotificationScopeFiltersInterface): Promise<number> {
    return this.prisma.notification.count({
      where: {
        ...this.buildScopeWhere(filters),
        ...this.unreadFilter(filters.userId),
      },
    });
  }

  // True no-op when the reader already has a read receipt: preserves the
  // original readAt rather than bumping it on every repeat call. Otherwise
  // creates the receipt (lazy for ADMIN-audience rows — their first-ever
  // reader receipt) or flips the existing eager USER receipt's readAt.
  public async markRead(notificationId: string, readerId: string): Promise<void> {
    const existing: { readAt: Date | null } | null =
      await this.prisma.notificationReceipt.findUnique({
        where: { notificationId_userId: { notificationId, userId: readerId } },
        select: { readAt: true },
      });

    if (existing?.readAt) return;

    await this.prisma.notificationReceipt.upsert({
      where: { notificationId_userId: { notificationId, userId: readerId } },
      create: { notificationId, userId: readerId, readAt: new Date() },
      update: { readAt: new Date() },
    });
  }

  public async markAllRead(filters: NotificationScopeFiltersInterface): Promise<void> {
    await this.prisma.notificationReceipt.updateMany({
      where: { userId: filters.userId, readAt: null },
      data: { readAt: new Date() },
    });

    if (!filters.includeAdmin) return;

    await this.createMissingAdminReceipts(filters.userId);
  }

  // Lazy admin receipts: every ADMIN-audience row this admin has never seen
  // gets a reader receipt, created already-read (read-all's whole point).
  // Bounded to the admin's visible scope (rows newer than their account, the
  // same id cursor buildScopeWhere uses) — rows outside the feed need no
  // receipt, so this stops materializing every ADMIN row ever written.
  private async createMissingAdminReceipts(adminId: string): Promise<void> {
    const unseen: { id: string }[] = await this.prisma.notification.findMany({
      where: {
        audience: NotificationAudience.ADMIN,
        id: { gt: adminId },
        receipts: { none: { userId: adminId } },
      },
      select: { id: true },
    });

    if (unseen.length === 0) return;

    await this.prisma.notificationReceipt.createMany({
      data: unseen.map((notification: { id: string }) => ({
        notificationId: notification.id,
        userId: adminId,
        readAt: new Date(),
      })),
      skipDuplicates: true,
    });
  }

  // Own USER-audience rows, plus ADMIN-audience rows when the caller is an
  // admin. ADMIN rows are bounded to those newer than the admin's account:
  // user ids and notification ids are both UUIDv7 (time-ordered), so the
  // reader's own id doubles as the account-creation cursor. A fresh or newly
  // promoted admin therefore starts at zero backlog instead of inheriting
  // every ADMIN row ever written as unread, and the badge poll's anti-join
  // becomes a range scan on @@index([audience, id]).
  //
  // The optional `audience` filter narrows the scope to one branch; it never
  // widens it (a non-admin asking for ADMIN rows gets `OR: []` — no rows).
  private buildScopeWhere(
    filters: NotificationScopeFiltersInterface,
    audience?: NotificationAudienceEnum,
  ): Prisma.NotificationWhereInput {
    const scopes: Prisma.NotificationWhereInput[] = [
      ...(audience !== NotificationAudienceEnum.ADMIN
        ? [{ audience: NotificationAudience.USER, userId: filters.userId }]
        : []),
      ...(filters.includeAdmin && audience !== NotificationAudienceEnum.USER
        ? [{ audience: NotificationAudience.ADMIN, id: { gt: filters.userId } }]
        : []),
    ];

    return { OR: scopes };
  }

  // Unread = the reader has no read receipt for the row yet, OR has one
  // whose readAt is still null. Works uniformly for USER rows (always have
  // an eager receipt) and ADMIN rows (may have none at all).
  private unreadFilter(readerId: string): Prisma.NotificationWhereInput {
    return {
      receipts: { none: { userId: readerId, readAt: { not: null } } },
    };
  }

  private toListItem(notification: NotificationWithOwnReceipt): NotificationListItemInterface {
    return {
      ...this.toDomain(notification),
      readAt: notification.receipts[0]?.readAt ?? null,
    };
  }

  private toDomain(notification: NotificationModel): NotificationInterface {
    return {
      id: notification.id,
      audience: NotificationAudienceEnum[notification.audience],
      userId: notification.userId,
      // Raw VarChar column backing NotificationTypeEnum (see schema comment)
      // — never a native Prisma enum, so this is a plain narrowing cast.
      type: notification.type as NotificationTypeEnum,
      title: notification.title,
      body: notification.body,
      meta: notification.meta as Record<string, unknown>,
      createdAt: notification.createdAt,
    };
  }
}
