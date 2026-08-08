import type { NotificationPreferenceModel } from '@generated/prisma/models.js';
import type { NotificationPreferenceRepositoryInterface } from '@modules/notification/interfaces/notification-preference-repository.interface.js';
import type { StoredNotificationPreferenceInterface } from '@modules/notification/interfaces/stored-notification-preference.interface.js';
import type { UpsertNotificationPreferenceDataInterface } from '@modules/notification/interfaces/upsert-notification-preference-data.interface.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import type { NotificationChannelEnum, NotificationTypeEnum } from '@nest-aws-starter/shared';
import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationPreferencePrismaRepository
  implements NotificationPreferenceRepositoryInterface
{
  constructor(private readonly prisma: PrismaService) {}

  public async findManyByUserId(userId: string): Promise<StoredNotificationPreferenceInterface[]> {
    const rows: NotificationPreferenceModel[] = await this.prisma.notificationPreference.findMany({
      where: { userId },
    });

    return rows.map(
      (row: NotificationPreferenceModel): StoredNotificationPreferenceInterface =>
        this.toDomain(row),
    );
  }

  // No native upsertMany in Prisma — a transaction keeps the batch atomic
  // (a partial write would leave the matrix internally inconsistent).
  public async upsertMany(
    userId: string,
    rows: UpsertNotificationPreferenceDataInterface[],
  ): Promise<void> {
    if (rows.length === 0) return;

    await this.prisma.$transaction(
      rows.map((row: UpsertNotificationPreferenceDataInterface) =>
        this.prisma.notificationPreference.upsert({
          where: { userId_type_channel: { userId, type: row.type, channel: row.channel } },
          create: { userId, type: row.type, channel: row.channel, enabled: row.enabled },
          update: { enabled: row.enabled },
        }),
      ),
    );
  }

  private toDomain(row: NotificationPreferenceModel): StoredNotificationPreferenceInterface {
    return {
      // Raw VarChar columns backing the shared enums (same pattern as
      // NotificationPrismaRepository.toDomain).
      type: row.type as NotificationTypeEnum,
      channel: row.channel as NotificationChannelEnum,
      enabled: row.enabled,
    };
  }
}
