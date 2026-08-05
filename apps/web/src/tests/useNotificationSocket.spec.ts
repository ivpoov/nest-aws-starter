import type { NotificationResponseInterface } from '@nest-aws-starter/shared';
import { renderHook, waitFor } from '@testing-library/react';
import type { Socket } from 'socket.io-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as notificationsApi from '../apis/notifications';
import { useNotificationSocket } from '../hooks/notifications/useNotificationSocket';
import { useAuthStore } from '../stores/auth.store';

vi.mock('../apis/notifications');

type SocketHandler = (...args: unknown[]) => void;
type AuthCallback = (payload: unknown) => void;
interface MockSocketOptionsInterface {
  readonly reconnectionAttempts: number;
  readonly auth: (callback: AuthCallback) => void;
}

const listeners: Record<string, SocketHandler> = {};
const mockSocket = {
  on: vi.fn((event: string, handler: SocketHandler) => {
    listeners[event] = handler;

    return mockSocket;
  }),
  connect: vi.fn(),
  disconnect: vi.fn(),
  removeAllListeners: vi.fn(),
};

const ioMock = vi.fn(
  (_uri: string, _options: MockSocketOptionsInterface): Socket => mockSocket as unknown as Socket,
);

vi.mock('socket.io-client', () => ({
  io: (uri: string, options: MockSocketOptionsInterface): Socket => ioMock(uri, options),
}));

function emit(event: string, ...args: unknown[]): void {
  listeners[event]?.(...args);
}

describe('useNotificationSocket', () => {
  beforeEach(() => {
    useAuthStore.getState().clear();
    localStorage.clear();
    ioMock.mockClear();
    mockSocket.on.mockClear();
    mockSocket.connect.mockClear();
    mockSocket.disconnect.mockClear();
    mockSocket.removeAllListeners.mockClear();
    vi.mocked(notificationsApi.fetchUnreadCount).mockReset();
    vi.mocked(notificationsApi.fetchUnreadCount).mockResolvedValue({ count: 3 });
  });

  it('connects with the store token once authenticated', async () => {
    useAuthStore.getState().setTokens('access-1', 'refresh-1');

    renderHook(() => useNotificationSocket());

    await waitFor(() => expect(ioMock).toHaveBeenCalledTimes(1));

    const [, options] = ioMock.mock.calls[0] as [string, MockSocketOptionsInterface];
    let authPayload: unknown;

    options.auth((payload) => {
      authPayload = payload;
    });

    expect(authPayload).toEqual({ token: 'access-1' });
  });

  it('fetches the initial unread count once authenticated', async () => {
    useAuthStore.getState().setTokens('access-1', 'refresh-1');

    const { result } = renderHook(() => useNotificationSocket());

    await waitFor(() => expect(result.current.unreadCount).toBe(3));
  });

  it('updates the unread count on the unread-count event', async () => {
    useAuthStore.getState().setTokens('access-1', 'refresh-1');

    const { result } = renderHook(() => useNotificationSocket());

    await waitFor(() => expect(ioMock).toHaveBeenCalledTimes(1));

    emit('unread-count', 7);

    await waitFor(() => expect(result.current.unreadCount).toBe(7));
  });

  it('prepends new notifications on the notification event', async () => {
    useAuthStore.getState().setTokens('access-1', 'refresh-1');

    const { result } = renderHook(() => useNotificationSocket());

    await waitFor(() => expect(ioMock).toHaveBeenCalledTimes(1));

    const notification = {
      id: 'n-1',
      audience: 'USER',
      userId: 'u-1',
      type: 'PASSWORD_CHANGED',
      title: 'Password changed',
      body: 'body',
      meta: {},
      createdAt: '2026-08-01T00:00:00.000Z',
      readAt: null,
    } as unknown as NotificationResponseInterface;

    emit('notification', notification);

    await waitFor(() => expect(result.current.liveNotifications).toHaveLength(1));
    expect(result.current.liveNotifications[0]).toEqual(notification);
  });

  it('disconnects the socket on unmount', async () => {
    useAuthStore.getState().setTokens('access-1', 'refresh-1');

    const { unmount } = renderHook(() => useNotificationSocket());

    await waitFor(() => expect(ioMock).toHaveBeenCalledTimes(1));

    unmount();

    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  it('never connects when there is no access token', async () => {
    renderHook(() => useNotificationSocket());

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(ioMock).not.toHaveBeenCalled();
    expect(notificationsApi.fetchUnreadCount).not.toHaveBeenCalled();
  });
});
