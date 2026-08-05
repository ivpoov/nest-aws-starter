import type { NotificationAudienceEnum, NotificationTypeEnum } from '@nest-aws-starter/shared';
import type { NotificationHistoryFiltersInterface } from './notification-history-filters.interface';

export interface UseNotificationHistoryFiltersResultInterface {
  readonly filters: NotificationHistoryFiltersInterface;
  readonly toggleType: (type: NotificationTypeEnum) => void;
  readonly clearType: () => void;
  readonly toggleAudience: (audience: NotificationAudienceEnum) => void;
  readonly clearAudience: () => void;
}
