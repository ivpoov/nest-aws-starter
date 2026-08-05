import type { NotificationResponseInterface } from '@nest-aws-starter/shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Socket } from 'socket.io-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as notificationsApi from '../apis/notifications';
import { useNotificationSocket } from '../hooks/notifications/useNotificationSocket';
import { useAuthStore } from '../stores/auth.store';
import { logger } from '../utils/logger';

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

  it('manually reconnects on an io server disconnect', async () => {
    useAuthStore.getState().setTokens('access-1', 'refresh-1');

    renderHook(() => useNotificationSocket());

    await waitFor(() => expect(ioMock).toHaveBeenCalledTimes(1));

    emit('disconnect', 'io server disconnect');

    expect(mockSocket.connect).toHaveBeenCalledTimes(1);
  });

  it('does not manually reconnect on a transport-level disconnect', async () => {
    useAuthStore.getState().setTokens('access-1', 'refresh-1');

    renderHook(() => useNotificationSocket());

    await waitFor(() => expect(ioMock).toHaveBeenCalledTimes(1));

    emit('disconnect', 'transport close');

    expect(mockSocket.connect).not.toHaveBeenCalled();
  });

  it('bounds manual reconnect attempts and logs a warning once exhausted', async () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    useAuthStore.getState().setTokens('access-1', 'refresh-1');

    renderHook(() => useNotificationSocket());

    await waitFor(() => expect(ioMock).toHaveBeenCalledTimes(1));

    // Three server-initiated disconnects (never followed by a real
    // `connect` event in this mock, so the attempt counter never resets)
    // exhaust the bound; a fourth must not trigger a fourth `connect()`.
    emit('disconnect', 'io server disconnect');
    emit('disconnect', 'io server disconnect');
    emit('disconnect', 'io server disconnect');
    emit('disconnect', 'io server disconnect');

    expect(mockSocket.connect).toHaveBeenCalledTimes(3);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('giving up after repeated server-initiated disconnects'),
    );

    warnSpy.mockRestore();
  });

  it('reads the freshly rotated token on a manual reconnect, not the one captured at mount', async () => {
    useAuthStore.getState().setTokens('access-1', 'refresh-1');

    renderHook(() => useNotificationSocket());

    await waitFor(() => expect(ioMock).toHaveBeenCalledTimes(1));

    const [, options] = ioMock.mock.calls[0] as [string, MockSocketOptionsInterface];
    let firstPayload: unknown;

    options.auth((payload) => {
      firstPayload = payload;
    });
    expect(firstPayload).toEqual({ token: 'access-1' });

    // A silent refresh rotates the store's token, then the gateway's
    // heartbeat sweep rejects the *original* token the socket connected
    // with — a server-initiated disconnect.
    useAuthStore.getState().setTokens('access-2', 'refresh-2');
    emit('disconnect', 'io server disconnect');

    expect(mockSocket.connect).toHaveBeenCalledTimes(1);
    expect(ioMock).toHaveBeenCalledTimes(1); // same socket reused, not recreated

    let secondPayload: unknown;

    options.auth((payload) => {
      secondPayload = payload;
    });
    expect(secondPayload).toEqual({ token: 'access-2' });
  });

  it('tears down the socket and stops reconnecting once logged out', async () => {
    useAuthStore.getState().setTokens('access-1', 'refresh-1');

    renderHook(() => useNotificationSocket());

    await waitFor(() => expect(ioMock).toHaveBeenCalledTimes(1));

    act(() => {
      useAuthStore.getState().clear();
    });

    await waitFor(() => expect(mockSocket.disconnect).toHaveBeenCalledTimes(1));

    mockSocket.connect.mockClear();

    // Even a stray disconnect event arriving after logout (the listener is
    // still wired in this mock, unlike a real socket after
    // removeAllListeners()) must not reconnect: the guard reads the store,
    // not a snapshot taken at connect time.
    emit('disconnect', 'io server disconnect');

    expect(mockSocket.connect).not.toHaveBeenCalled();
  });
});
