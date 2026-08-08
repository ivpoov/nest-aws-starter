import type { StoredNotificationPreferenceInterface } from '@modules/notification/interfaces/stored-notification-preference.interface.js';
import type { UpsertNotificationPreferenceDataInterface } from '@modules/notification/interfaces/upsert-notification-preference-data.interface.js';

export interface NotificationPreferenceRepositoryInterface {
  findManyByUserId(userId: string): Promise<StoredNotificationPreferenceInterface[]>;
  upsertMany(userId: string, rows: UpsertNotificationPreferenceDataInterface[]): Promise<void>;
}
