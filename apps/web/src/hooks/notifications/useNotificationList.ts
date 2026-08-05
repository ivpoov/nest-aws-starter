import type {
  ApiErrorInterface,
  NotificationListResponseInterface,
  NotificationResponseInterface,
} from '@nest-aws-starter/shared';
import { useCallback, useEffect, useState } from 'react';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../apis/notifications';
import { NOTIFICATION_LIST_PAGE_SIZE } from '../../constants/notification-list.constants';
import { useNotificationSocketContext } from '../../contexts/NotificationSocketContext';
import type { UseNotificationListResultInterface } from '../../interfaces/use-notification-list-result.interface';
import { toApiError } from '../../utils/toApiError';

// REST-backed cursor pagination for the dropdown — the socket hook's live
// feed is a separate concern (see useNotificationSocket); this hook only
// reconciles its own item list, and reports read-state changes up to the
// socket context so the bell badge stays in sync (the API never pushes a
// fresh unread-count on a read — see notification-fan-out.service.ts).
export function useNotificationList(): UseNotificationListResultInterface {
  const { unreadCount, adjustUnreadCount } = useNotificationSocketContext();
  const [items, setItems] = useState<NotificationResponseInterface[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<ApiErrorInterface | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const result: NotificationListResponseInterface = await fetchNotifications({
        limit: NOTIFICATION_LIST_PAGE_SIZE,
      });

      setItems(result.items);
      setCursor(result.nextCursor);
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMore = useCallback(async (): Promise<void> => {
    if (!cursor || isLoadingMore) return;

    setIsLoadingMore(true);
    setError(null);

    try {
      const result: NotificationListResponseInterface = await fetchNotifications({
        cursor,
        limit: NOTIFICATION_LIST_PAGE_SIZE,
      });

      setItems((previous: NotificationResponseInterface[]) => [...previous, ...result.items]);
      setCursor(result.nextCursor);
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setIsLoadingMore(false);
    }
  }, [cursor, isLoadingMore]);

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
      } catch (caught) {
        setItems((previous: NotificationResponseInterface[]) => setReadAt(previous, id, null));
        adjustUnreadCount(1);
        setError(toApiError(caught));
      }
    },
    [items, adjustUnreadCount],
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
    } catch (caught) {
      setItems(previousItems);
      adjustUnreadCount(previousUnreadCount);
      setError(toApiError(caught));
    }
  }, [items, unreadCount, adjustUnreadCount]);

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
