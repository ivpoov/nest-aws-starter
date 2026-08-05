import type { NotificationResponseInterface } from '@nest-aws-starter/shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as notificationsApi from '../apis/notifications';
import { useNotificationList } from '../hooks/notifications/useNotificationList';

vi.mock('../apis/notifications');

const adjustUnreadCount = vi.fn();

vi.mock('../contexts/NotificationSocketContext', () => ({
  useNotificationSocketContext: () => ({ unreadCount: 2, adjustUnreadCount }),
}));

function buildItem(id: string, readAt: string | null = null): NotificationResponseInterface {
  return {
    id,
    audience: 'USER' as NotificationResponseInterface['audience'],
    userId: 'u-1',
    type: 'PASSWORD_CHANGED' as NotificationResponseInterface['type'],
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

  it('optimistically marks an item read and reverts on failure', async () => {
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
    expect(result.current.error).not.toBeNull();
  });

  it('keeps an item read when the mark-read request succeeds', async () => {
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
    expect(adjustUnreadCount).toHaveBeenCalledTimes(1);
    expect(adjustUnreadCount).toHaveBeenCalledWith(-1);
  });
});
