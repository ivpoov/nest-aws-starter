import {
  NotificationAudienceEnum,
  type NotificationResponseInterface,
  NotificationTypeEnum,
} from '@nest-aws-starter/shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as notificationsApi from '../apis/notifications';
import { NOTIFICATION_HISTORY_PAGE_SIZE } from '../constants/notification-history.constants';
import { useNotificationList } from '../hooks/notifications/useNotificationList';
import type { NotificationHistoryFiltersInterface } from '../interfaces/notification-history-filters.interface';

vi.mock('../apis/notifications');

const adjustUnreadCount = vi.fn();
const refreshUnreadCount = vi.fn().mockResolvedValue(undefined);

vi.mock('../contexts/NotificationSocketContext', () => ({
  useNotificationSocketContext: () => ({ unreadCount: 2, adjustUnreadCount, refreshUnreadCount }),
}));

function buildItem(
  id: string,
  readAt: string | null = null,
  type: NotificationTypeEnum = NotificationTypeEnum.PASSWORD_CHANGED,
  audience: NotificationAudienceEnum = NotificationAudienceEnum.USER,
): NotificationResponseInterface {
  return {
    id,
    audience,
    userId: audience === NotificationAudienceEnum.USER ? 'u-1' : null,
    type,
    title: `Title ${id}`,
    body: 'Body',
    meta: {},
    createdAt: '2026-08-01T00:00:00.000Z',
    readAt,
  };
}

describe('useNotificationList', () => {
  beforeEach(() => {
    adjustUnreadCount.mockClear();
    refreshUnreadCount.mockClear();
  });

  it('loads the first page and fetches the next page on loadMore', async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValueOnce({
      items: [buildItem('n-1')],
      nextCursor: 'n-1',
    });

    const { result } = renderHook(() => useNotificationList());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.hasMore).toBe(true);

    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValueOnce({
      items: [buildItem('n-2')],
      nextCursor: null,
    });

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.items.map((item) => item.id)).toEqual(['n-1', 'n-2']);
    expect(result.current.hasMore).toBe(false);
    expect(notificationsApi.fetchNotifications).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'n-1' }),
    );
  });

  it('sends type/audience/unreadOnly as query params instead of filtering fetched pages', async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValueOnce({
      items: [
        buildItem('n-2', null, NotificationTypeEnum.WEBHOOK_FAILED, NotificationAudienceEnum.ADMIN),
      ],
      nextCursor: null,
    });

    const { result } = renderHook(() =>
      useNotificationList({
        type: NotificationTypeEnum.WEBHOOK_FAILED,
        audience: NotificationAudienceEnum.ADMIN,
        unreadOnly: true,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(notificationsApi.fetchNotifications).toHaveBeenCalledWith({
      limit: NOTIFICATION_HISTORY_PAGE_SIZE,
      type: NotificationTypeEnum.WEBHOOK_FAILED,
      audience: NotificationAudienceEnum.ADMIN,
      unreadOnly: true,
    });
    expect(result.current.items.map((item) => item.id)).toEqual(['n-2']);
  });

  it('omits every filter left on "All" rather than sending null/false', async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValueOnce({
      items: [],
      nextCursor: null,
    });

    const { result } = renderHook(() =>
      useNotificationList({ type: null, audience: null, unreadOnly: false }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(notificationsApi.fetchNotifications).toHaveBeenCalledWith({
      limit: NOTIFICATION_HISTORY_PAGE_SIZE,
    });
  });

  // The bug this replaced: a filtered view paginated on the *unfiltered*
  // cursor, so page two came back unfiltered and `hasMore` described a result
  // set the user was not looking at — a rare-type filter rendered "No
  // notifications match" right next to a live "Load more" button.
  it('carries the active filters into loadMore so a filtered view paginates on its own cursor', async () => {
    const filters: NotificationHistoryFiltersInterface = {
      type: NotificationTypeEnum.WEBHOOK_FAILED,
      audience: null,
      unreadOnly: false,
    };

    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValueOnce({
      items: [buildItem('n-1', null, NotificationTypeEnum.WEBHOOK_FAILED)],
      nextCursor: 'n-1',
    });

    const { result } = renderHook(() => useNotificationList(filters));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasMore).toBe(true);

    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValueOnce({
      items: [buildItem('n-2', null, NotificationTypeEnum.WEBHOOK_FAILED)],
      nextCursor: null,
    });

    await act(async () => {
      await result.current.loadMore();
    });

    expect(notificationsApi.fetchNotifications).toHaveBeenLastCalledWith({
      cursor: 'n-1',
      limit: NOTIFICATION_HISTORY_PAGE_SIZE,
      type: NotificationTypeEnum.WEBHOOK_FAILED,
    });
    expect(result.current.items.map((item) => item.id)).toEqual(['n-1', 'n-2']);
    expect(result.current.hasMore).toBe(false);
  });

  it('resets pagination — refetches page one and replaces items — when filters change', async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValueOnce({
      items: [buildItem('n-1', null, NotificationTypeEnum.PASSWORD_CHANGED)],
      nextCursor: 'n-1',
    });

    const { result, rerender } = renderHook(
      ({ filters }: { filters: NotificationHistoryFiltersInterface | undefined }) =>
        useNotificationList(filters),
      {
        initialProps: {
          filters: undefined as NotificationHistoryFiltersInterface | undefined,
        },
      },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items.map((item) => item.id)).toEqual(['n-1']);
    expect(result.current.hasMore).toBe(true);

    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValueOnce({
      items: [buildItem('n-2', null, NotificationTypeEnum.WEBHOOK_FAILED)],
      nextCursor: null,
    });

    rerender({
      filters: {
        type: NotificationTypeEnum.WEBHOOK_FAILED,
        audience: null,
        unreadOnly: false,
      },
    });

    await waitFor(() => expect(result.current.items.map((item) => item.id)).toEqual(['n-2']));
    expect(result.current.hasMore).toBe(false);
    // No `cursor` — the previous page's cursor belonged to the unfiltered
    // result set and must not be reused for the newly filtered one.
    expect(notificationsApi.fetchNotifications).toHaveBeenLastCalledWith({
      limit: NOTIFICATION_HISTORY_PAGE_SIZE,
      type: NotificationTypeEnum.WEBHOOK_FAILED,
    });
  });

  it('optimistically marks an item read, refreshes the authoritative count on success', async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue({
      items: [buildItem('n-1')],
      nextCursor: null,
    });
    vi.mocked(notificationsApi.markNotificationRead).mockResolvedValue(undefined);

    const { result } = renderHook(() => useNotificationList());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.markRead('n-1');
    });

    expect(result.current.items[0]?.readAt).not.toBeNull();
    expect(adjustUnreadCount).toHaveBeenCalledWith(-1);
    expect(refreshUnreadCount).toHaveBeenCalledTimes(1);
  });

  it('reverts the optimistic mark-read and does not refresh the count on failure', async () => {
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue({
      items: [buildItem('n-1')],
      nextCursor: null,
    });
    vi.mocked(notificationsApi.markNotificationRead).mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useNotificationList());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.markRead('n-1');
    });

    expect(result.current.items[0]?.readAt).toBeNull();
    expect(adjustUnreadCount).toHaveBeenNthCalledWith(1, -1);
    expect(adjustUnreadCount).toHaveBeenNthCalledWith(2, 1);
    expect(refreshUnreadCount).not.toHaveBeenCalled();
    expect(result.current.error).not.toBeNull();
  });
});
