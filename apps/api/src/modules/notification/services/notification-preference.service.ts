import { ValidationError } from '@modules/common/errors/validation.error.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import {
  NOTIFICATION_PREFERENCE_CHANNEL_IMMUTABLE,
  NOTIFICATION_PREFERENCE_TYPE_INVALID,
} from '@modules/notification/constants/notification-errors.constants.js';
import {
  NOTIFICATION_PREFERENCE_CACHE_TTL_MS,
  NOTIFICATION_PREFERENCE_REPOSITORY,
} from '@modules/notification/constants/notification-preference.constants.js';
import { buildNotificationPreferenceCacheKey } from '@modules/notification/constants/notification-preference-cache-key.constants.js';
import {
  DEFAULT_EMAIL_DISABLED_TYPES,
  USER_NOTIFICATION_TYPES,
} from '@modules/notification/constants/notification-preference-defaults.constants.js';
import type { NotificationPreferenceMatrixItemInterface } from '@modules/notification/interfaces/notification-preference-matrix-item.interface.js';
import type { NotificationPreferenceRepositoryInterface } from '@modules/notification/interfaces/notification-preference-repository.interface.js';
import type { StoredNotificationPreferenceInterface } from '@modules/notification/interfaces/stored-notification-preference.interface.js';
import type { UpsertNotificationPreferenceDataInterface } from '@modules/notification/interfaces/upsert-notification-preference-data.interface.js';
import {
  NotificationChannelEnum,
  type NotificationTypeEnum,
  type UpdateNotificationPreferenceRequestInterface,
} from '@nest-aws-starter/shared';
import { Inject, Injectable } from '@nestjs/common';
import { CacheService } from '@providers/cache/services/cache.service.js';
import { CacheFactoryService } from '@providers/cache/services/cache-factory.service.js';

type EmailPreferenceMap = Partial<Record<NotificationTypeEnum, boolean>>;

// Single owner of preference resolution: the GET matrix endpoint and the
// event subscriber's EMAIL gate both go through this service, so "stored row
// overrides the default" is decided in exactly one place.
@Injectable()
export class NotificationPreferenceService {
  private readonly logger = new CustomLoggerService(NotificationPreferenceService.name);
  private readonly cache: CacheService;

  constructor(
    @Inject(NOTIFICATION_PREFERENCE_REPOSITORY)
    private readonly preferenceRepository: NotificationPreferenceRepositoryInterface,
    cacheFactory: CacheFactoryService,
  ) {
    this.cache = cacheFactory.create({ isMemoryEnabled: true });
  }

  // The full grid: IN_APP always enabled and non-editable, EMAIL resolved
  // from the stored override or the default (task-5-brief.md: "returns the
  // full matrix... merging stored rows over defaults").
  public async getMatrix(userId: string): Promise<NotificationPreferenceMatrixItemInterface[]> {
    const emailPreferences: EmailPreferenceMap = await this.loadEmailPreferences(userId);

    return USER_NOTIFICATION_TYPES.flatMap(
      (type: NotificationTypeEnum): NotificationPreferenceMatrixItemInterface[] => [
        { type, channel: NotificationChannelEnum.IN_APP, enabled: true, isEditable: false },
        {
          type,
          channel: NotificationChannelEnum.EMAIL,
          enabled: emailPreferences[type] ?? this.defaultEmailEnabled(type),
          isEditable: true,
        },
      ],
    );
  }

  // The event subscriber's EMAIL gate. ADMIN-audience types are not in
  // USER_NOTIFICATION_TYPES (no per-user recipient) and always resolve to
  // false here — the event subscriber never has a userId for them anyway.
  public async isEmailEnabled(userId: string, type: NotificationTypeEnum): Promise<boolean> {
    if (!USER_NOTIFICATION_TYPES.includes(type)) return false;

    const emailPreferences: EmailPreferenceMap = await this.loadEmailPreferences(userId);

    return emailPreferences[type] ?? this.defaultEmailEnabled(type);
  }

  public async updateMany(
    userId: string,
    updates: UpdateNotificationPreferenceRequestInterface[],
  ): Promise<void> {
    const rows: UpsertNotificationPreferenceDataInterface[] = updates.map(
      (update: UpdateNotificationPreferenceRequestInterface) => this.validate(update),
    );

    await this.preferenceRepository.upsertMany(userId, rows);
    await this.cache.delete(buildNotificationPreferenceCacheKey(userId));
    this.logger.log(`Notification preferences updated for user ${userId}: ${rows.length} row(s)`);
  }

  private validate(
    update: UpdateNotificationPreferenceRequestInterface,
  ): UpsertNotificationPreferenceDataInterface {
    if (update.channel === NotificationChannelEnum.IN_APP) {
      throw new ValidationError(NOTIFICATION_PREFERENCE_CHANNEL_IMMUTABLE);
    }

    if (!USER_NOTIFICATION_TYPES.includes(update.type)) {
      throw new ValidationError(NOTIFICATION_PREFERENCE_TYPE_INVALID);
    }

    return { type: update.type, channel: update.channel, enabled: update.enabled };
  }

  private loadEmailPreferences(userId: string): Promise<EmailPreferenceMap> {
    return this.cache.wrap(
      buildNotificationPreferenceCacheKey(userId),
      NOTIFICATION_PREFERENCE_CACHE_TTL_MS,
      async (): Promise<EmailPreferenceMap> => {
        const stored: StoredNotificationPreferenceInterface[] =
          await this.preferenceRepository.findManyByUserId(userId);

        return Object.fromEntries(
          stored
            .filter(
              (row: StoredNotificationPreferenceInterface): boolean =>
                row.channel === NotificationChannelEnum.EMAIL,
            )
            .map((row: StoredNotificationPreferenceInterface): [NotificationTypeEnum, boolean] => [
              row.type,
              row.enabled,
            ]),
        );
      },
    );
  }

  private defaultEmailEnabled(type: NotificationTypeEnum): boolean {
    return !DEFAULT_EMAIL_DISABLED_TYPES.has(type);
  }
}
