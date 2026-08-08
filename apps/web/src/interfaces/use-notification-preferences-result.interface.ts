import type {
  ApiErrorInterface,
  NotificationChannelEnum,
  NotificationPreferenceResponseInterface,
  NotificationTypeEnum,
} from '@nest-aws-starter/shared';

export interface UseNotificationPreferencesResultInterface {
  readonly preferences: NotificationPreferenceResponseInterface[];
  readonly isLoading: boolean;
  readonly error: ApiErrorInterface | null;
  // `${type}:${channel}` of the cell currently saving — null when nothing
  // is in flight. Lets the grid disable/spin exactly one toggle.
  readonly pendingKey: string | null;
  readonly toggle: (
    type: NotificationTypeEnum,
    channel: NotificationChannelEnum,
    enabled: boolean,
  ) => Promise<void>;
}
