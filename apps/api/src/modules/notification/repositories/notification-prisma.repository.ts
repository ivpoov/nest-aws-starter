import type { Prisma } from '@generated/prisma/client.js';
import { NotificationAudience } from '@generated/prisma/enums.js';
import type { NotificationModel } from '@generated/prisma/models.js';
import type { CreateNotificationDataInterface } from '@modules/notification/interfaces/create-notification-data.interface.js';
import type { NotificationInterface } from '@modules/notification/interfaces/notification.interface.js';
import type { NotificationRepositoryInterface } from '@modules/notification/interfaces/notification-repository.interface.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { NotificationAudienceEnum, type NotificationTypeEnum } from '@nest-aws-starter/shared';
import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationPrismaRepository implements NotificationRepositoryInterface {
  constructor(private readonly prisma: PrismaService) {}

  // USER audience creates its single reader receipt in the same nested
  // write (eager, per the Task 1 schema note); ADMIN audience creates only
  // the row — no per-admin fan-out, receipts are created lazily on first
  // fetch (PR 4's concern).
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
