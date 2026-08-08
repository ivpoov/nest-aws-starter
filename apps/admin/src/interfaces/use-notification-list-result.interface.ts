import type { ApiErrorInterface, NotificationResponseInterface } from '@nest-aws-starter/shared';

export interface UseNotificationListResultInterface {
  readonly items: NotificationResponseInterface[];
  readonly isLoading: boolean;
  readonly isLoadingMore: boolean;
  readonly hasMore: boolean;
  readonly error: ApiErrorInterface | null;
  readonly loadMore: () => Promise<void>;
  readonly markRead: (id: string) => Promise<void>;
  readonly markAllRead: () => Promise<void>;
}
