import type {
  ApiErrorInterface,
  NotificationListResponseInterface,
  NotificationResponseInterface,
  NotificationsQueryRequestInterface,
} from '@nest-aws-starter/shared';
import { useCallback, useEffect, useState } from 'react';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../apis/notifications';
import { NOTIFICATION_HISTORY_PAGE_SIZE } from '../../constants/notification-history.constants';
import { useNotificationSocketContext } from '../../contexts/NotificationSocketContext';
import type { NotificationHistoryFiltersInterface } from '../../interfaces/notification-history-filters.interface';
import type { UseNotificationListResultInterface } from '../../interfaces/use-notification-list-result.interface';
import { toApiError } from '../../utils/toApiError';

// REST-backed cursor pagination shared by two consumers: the bell dropdown
// (call with no filters) and the history page (type/audience/unread filters).
// Filters are sent as query params, so the server returns an already-filtered
// page and `hasMore`/`nextCursor` describe the filtered result set — never a
// "No notifications match" empty list next to a live "Load more" button.
// Changing a filter drops the cursor and refetches page one rather than
// appending a differently-filtered page onto a stale list.
// Read-state changes report up to the socket context so the bell badge stays
// in sync; a successful mutation also triggers an authoritative refetch of the
// merged count rather than trusting the optimistic delta alone (see
// useNotificationSocket for why).
export function useNotificationList(
  filters?: NotificationHistoryFiltersInterface,
): UseNotificationListResultInterface {
  const { unreadCount, adjustUnreadCount, refreshUnreadCount } = useNotificationSocketContext();
  const [items, setItems] = useState<NotificationResponseInterface[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<ApiErrorInterface | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    // Drop the previous cursor up front, not just on success: a filter change
    // re-runs this callback, and until the new page lands the old cursor
    // belongs to a different result set — leaving it in place would let a
    // "Load more" click append rows from the previous filter.
    setCursor(null);

    try {
      const result: NotificationListResponseInterface = await fetchNotifications({
        limit: NOTIFICATION_HISTORY_PAGE_SIZE,
        ...toFilterParams(filters),
      });

      setItems(result.items);
      setCursor(result.nextCursor);
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (!cursor || isLoadingMore) return;

    setIsLoadingMore(true);
    setError(null);

    try {
      const result: NotificationListResponseInterface = await fetchNotifications({
        cursor,
        limit: NOTIFICATION_HISTORY_PAGE_SIZE,
        ...toFilterParams(filters),
      });

      setItems((previous: NotificationResponseInterface[]) => [...previous, ...result.items]);
      setCursor(result.nextCursor);
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setIsLoadingMore(false);
    }
  }, [cursor, isLoadingMore, filters]);

  const markRead = useCallback(
    async (id: string): Promise<void> => {
      const target: NotificationResponseInterface | undefined = items.find(
        (item: NotificationResponseInterface): boolean => item.id === id,
      );

      if (!target || target.readAt) return;

      setItems((previous: NotificationResponseInterface[]) =>
        setReadAt(previous, id, new Date().toISOString()),
      );
      adjustUnreadCount(-1);

      try {
        await markNotificationRead(id);
        void refreshUnreadCount();
      } catch (caught) {
        setItems((previous: NotificationResponseInterface[]) => setReadAt(previous, id, null));
        adjustUnreadCount(1);
        setError(toApiError(caught));
      }
    },
    [items, adjustUnreadCount, refreshUnreadCount],
  );

  const markAllRead = useCallback(async (): Promise<void> => {
    const previousItems: NotificationResponseInterface[] = items;
    const previousUnreadCount: number = unreadCount;
    const now: string = new Date().toISOString();

    setItems((current: NotificationResponseInterface[]) =>
      current.map((item: NotificationResponseInterface) =>
        item.readAt ? item : { ...item, readAt: now },
      ),
    );
    adjustUnreadCount(-previousUnreadCount);

    try {
      await markAllNotificationsRead();
      void refreshUnreadCount();
    } catch (caught) {
      setItems(previousItems);
      adjustUnreadCount(previousUnreadCount);
      setError(toApiError(caught));
    }
  }, [items, unreadCount, adjustUnreadCount, refreshUnreadCount]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    items,
    isLoading,
    isLoadingMore,
    hasMore: cursor !== null,
    error,
    loadMore,
    markRead,
    markAllRead,
  };
}

function setReadAt(
  items: NotificationResponseInterface[],
  id: string,
  readAt: string | null,
): NotificationResponseInterface[] {
  return items.map((item: NotificationResponseInterface) =>
    item.id === id ? { ...item, readAt } : item,
  );
}

// Maps filter-bar state onto the wire contract. An "All"/off filter is left
// out of the object entirely rather than sent as null/false, so the request
// carries only the params the user actually narrowed by.
function toFilterParams(
  filters: NotificationHistoryFiltersInterface | undefined,
): NotificationsQueryRequestInterface {
  if (!filters) return {};

  return {
    ...(filters.type === null ? {} : { type: filters.type }),
    ...(filters.audience === null ? {} : { audience: filters.audience }),
    ...(filters.unreadOnly ? { unreadOnly: true } : {}),
  };
}
