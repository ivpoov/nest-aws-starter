import type { NotificationChannelEnum, NotificationTypeEnum } from '@nest-aws-starter/shared';

// A persisted override row. IN_APP is never persisted (it is immutable and
// always on), so in practice `channel` is always EMAIL — but the shape
// stays generic, matching the schema's [userId, type, channel] uniqueness,
// so a future channel needs no migration.
export interface StoredNotificationPreferenceInterface {
  readonly type: NotificationTypeEnum;
  readonly channel: NotificationChannelEnum;
  readonly enabled: boolean;
}
