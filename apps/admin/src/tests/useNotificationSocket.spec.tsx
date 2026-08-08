import type { NotificationResponseInterface } from '@nest-aws-starter/shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as notificationsApi from '../apis/notifications';
import {
  MANUAL_RECONNECT_BASE_DELAY_MS,
  MAX_MANUAL_RECONNECT_ATTEMPTS,
  STABLE_CONNECTION_RESET_MS,
} from '../constants/notification-socket.constants';
import { UNREAD_COUNT_POLL_INTERVAL_MS } from '../constants/notification-unread-count-poll.constants';
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
  disconnected: false,
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

function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
}

// One handshake as the real gateway produces it when it rejects a client:
// socket.io always writes CONNECT (so the client fires `connect`) before
// Nest's handleConnection can run and disconnect the socket.
function emitRejectedHandshake(): void {
  act(() => {
    emit('connect');
    emit('disconnect', 'io server disconnect');
  });
}

// Turns every `socket.connect()` the hook issues into another rejected
// handshake, exactly like a gateway that keeps refusing the token (or has
// websockets disabled). The safety valve stops a regressed implementation
// from recursing forever — a bounded, visibly-wrong call count instead.
function autoRejectManualReconnects(): void {
  mockSocket.connect.mockImplementation((): void => {
    if (mockSocket.connect.mock.calls.length > 10) return;

    emit('connect');
    emit('disconnect', 'io server disconnect');
  });
}

describe('useNotificationSocket', () => {
  beforeEach(() => {
    useAuthStore.getState().clear();
    localStorage.clear();
    ioMock.mockClear();
    mockSocket.disconnected = false;
    mockSocket.on.mockClear();
    mockSocket.connect.mockReset();
    mockSocket.disconnect.mockClear();
    mockSocket.removeAllListeners.mockClear();
    vi.mocked(notificationsApi.fetchUnreadCount).mockReset();
    vi.mocked(notificationsApi.fetchUnreadCount).mockResolvedValue({ count: 3 });
    setVisibility('visible');
  });

  afterEach(() => {
    vi.useRealTimers();
    setVisibility('visible');
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

  it('does not react to the socket unread-count event (merged count is REST-only, see notification-events.constants.ts)', async () => {
    useAuthStore.getState().setTokens('access-1', 'refresh-1');

    const { result } = renderHook(() => useNotificationSocket());

    await waitFor(() => expect(result.current.unreadCount).toBe(3));

    emit('unread-count', 999);

    // Give any accidental listener a tick to run, then assert nothing moved.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current.unreadCount).toBe(3);
  });

  it('prepends new notifications and bumps the badge on the notification event', async () => {
    useAuthStore.getState().setTokens('access-1', 'refresh-1');

    const { result } = renderHook(() => useNotificationSocket());

    await waitFor(() => expect(result.current.unreadCount).toBe(3));

    const notification = {
      id: 'n-1',
      audience: 'ADMIN',
      userId: null,
      type: 'CONTACT_MESSAGE',
      title: 'New contact message',
      body: 'body',
      meta: {},
      createdAt: '2026-08-01T00:00:00.000Z',
      readAt: null,
    } as unknown as NotificationResponseInterface;

    emit('notification', notification);

    await waitFor(() => expect(result.current.liveNotifications).toHaveLength(1));
    expect(result.current.liveNotifications[0]).toEqual(notification);
    expect(result.current.unreadCount).toBe(4);
  });

  it('exposes a refreshUnreadCount that overwrites the badge with the authoritative figure', async () => {
    useAuthStore.getState().setTokens('access-1', 'refresh-1');

    const { result } = renderHook(() => useNotificationSocket());

    await waitFor(() => expect(result.current.unreadCount).toBe(3));

    vi.mocked(notificationsApi.fetchUnreadCount).mockResolvedValueOnce({ count: 11 });

    await act(async () => {
      await result.current.refreshUnreadCount();
    });

    expect(result.current.unreadCount).toBe(11);
  });

  it('polls the unread count on the configured interval', async () => {
    vi.useFakeTimers();
    useAuthStore.getState().setTokens('access-1', 'refresh-1');

    renderHook(() => useNotificationSocket());

    await vi.advanceTimersByTimeAsync(0);
    expect(notificationsApi.fetchUnreadCount).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(UNREAD_COUNT_POLL_INTERVAL_MS);
    expect(notificationsApi.fetchUnreadCount).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(UNREAD_COUNT_POLL_INTERVAL_MS);
    expect(notificationsApi.fetchUnreadCount).toHaveBeenCalledTimes(3);
  });

  it('skips a poll tick while the tab is hidden but keeps the interval alive', async () => {
    vi.useFakeTimers();
    useAuthStore.getState().setTokens('access-1', 'refresh-1');

    renderHook(() => useNotificationSocket());

    await vi.advanceTimersByTimeAsync(0);
    expect(notificationsApi.fetchUnreadCount).toHaveBeenCalledTimes(1);

    setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(UNREAD_COUNT_POLL_INTERVAL_MS);
    expect(notificationsApi.fetchUnreadCount).toHaveBeenCalledTimes(1);

    setVisibility('visible');
    await vi.advanceTimersByTimeAsync(UNREAD_COUNT_POLL_INTERVAL_MS);
    expect(notificationsApi.fetchUnreadCount).toHaveBeenCalledTimes(2);
  });

  it('stops polling on unmount', async () => {
    vi.useFakeTimers();
    useAuthStore.getState().setTokens('access-1', 'refresh-1');

    const { unmount } = renderHook(() => useNotificationSocket());

    await vi.advanceTimersByTimeAsync(0);
    expect(notificationsApi.fetchUnreadCount).toHaveBeenCalledTimes(1);

    unmount();

    await vi.advanceTimersByTimeAsync(UNREAD_COUNT_POLL_INTERVAL_MS * 2);
    expect(notificationsApi.fetchUnreadCount).toHaveBeenCalledTimes(1);
  });

  it('disconnects the socket on unmount', async () => {
    useAuthStore.getState().setTokens('access-1', 'refresh-1');

    const { unmount } = renderHook(() => useNotificationSocket());

    await waitFor(() => expect(ioMock).toHaveBeenCalledTimes(1));

    unmount();

    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  it('never connects and never polls when there is no access token', async () => {
    renderHook(() => useNotificationSocket());

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(ioMock).not.toHaveBeenCalled();
    expect(notificationsApi.fetchUnreadCount).not.toHaveBeenCalled();
  });

  it('manually reconnects on an io server disconnect, after the backoff delay', async () => {
    vi.useFakeTimers();
    useAuthStore.getState().setTokens('access-1', 'refresh-1');

    renderHook(() => useNotificationSocket());

    expect(ioMock).toHaveBeenCalledTimes(1);

    emitRejectedHandshake();

    // Not immediately — an instant retry against a gateway that rejects
    // post-CONNECT would spin at one handshake per round trip.
    expect(mockSocket.connect).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(MANUAL_RECONNECT_BASE_DELAY_MS - 1);
    });
    expect(mockSocket.connect).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(mockSocket.connect).toHaveBeenCalledTimes(1);
  });

  it('does not manually reconnect on a transport-level disconnect', async () => {
    useAuthStore.getState().setTokens('access-1', 'refresh-1');

    renderHook(() => useNotificationSocket());

    await waitFor(() => expect(ioMock).toHaveBeenCalledTimes(1));

    emit('disconnect', 'transport close');

    expect(mockSocket.connect).not.toHaveBeenCalled();
  });

  it('bounds manual reconnects when the gateway accepts the transport then rejects each handshake', async () => {
    vi.useFakeTimers();
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    autoRejectManualReconnects();
    useAuthStore.getState().setTokens('access-1', 'refresh-1');

    renderHook(() => useNotificationSocket());

    expect(ioMock).toHaveBeenCalledTimes(1);

    // The initial handshake is rejected the way the real gateway does it:
    // client-side `connect` first, then the server-initiated disconnect.
    emitRejectedHandshake();

    // Give every scheduled retry ample time to fire; each one is answered
    // with another connect → reject cycle by the mock above.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(mockSocket.connect).toHaveBeenCalledTimes(MAX_MANUAL_RECONNECT_ATTEMPTS);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('giving up after repeated server-initiated disconnects'),
    );

    warnSpy.mockRestore();
  });

  it('restores the reconnect budget once a connection survives the stability window', async () => {
    vi.useFakeTimers();
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    autoRejectManualReconnects();
    useAuthStore.getState().setTokens('access-1', 'refresh-1');

    renderHook(() => useNotificationSocket());

    emitRejectedHandshake();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(mockSocket.connect).toHaveBeenCalledTimes(MAX_MANUAL_RECONNECT_ATTEMPTS);

    // A connection that survives the stability window (i.e. the gateway
    // accepted the handshake) earns the budget back…
    mockSocket.connect.mockImplementation((): void => undefined);
    act(() => {
      emit('connect');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STABLE_CONNECTION_RESET_MS);
    });

    // …so a later rejection retries again instead of staying given-up.
    act(() => {
      emit('disconnect', 'io server disconnect');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(MANUAL_RECONNECT_BASE_DELAY_MS);
    });

    expect(mockSocket.connect).toHaveBeenCalledTimes(MAX_MANUAL_RECONNECT_ATTEMPTS + 1);

    warnSpy.mockRestore();
  });

  it('replenishes the budget and reconnects as soon as a refreshed token lands', async () => {
    vi.useFakeTimers();
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    autoRejectManualReconnects();
    useAuthStore.getState().setTokens('access-1', 'refresh-1');

    renderHook(() => useNotificationSocket());

    emitRejectedHandshake();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(mockSocket.connect).toHaveBeenCalledTimes(MAX_MANUAL_RECONNECT_ATTEMPTS);

    // The session was rejected into giving up, then a silent refresh
    // rotates the token: the previously-dead socket must come back with
    // the new credentials rather than stay down until a reload.
    mockSocket.connect.mockImplementation((): void => undefined);
    mockSocket.disconnected = true;
    act(() => {
      useAuthStore.getState().setTokens('access-2', 'refresh-2');
    });

    expect(mockSocket.connect).toHaveBeenCalledTimes(MAX_MANUAL_RECONNECT_ATTEMPTS + 1);

    warnSpy.mockRestore();
  });

  it('cancels a pending manual reconnect when the user logs out', async () => {
    vi.useFakeTimers();
    useAuthStore.getState().setTokens('access-1', 'refresh-1');

    renderHook(() => useNotificationSocket());

    emitRejectedHandshake();

    act(() => {
      useAuthStore.getState().clear();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(mockSocket.connect).not.toHaveBeenCalled();
  });

  it('reads the freshly rotated token on a manual reconnect, not the one captured at mount', async () => {
    vi.useFakeTimers();
    useAuthStore.getState().setTokens('access-1', 'refresh-1');

    renderHook(() => useNotificationSocket());

    expect(ioMock).toHaveBeenCalledTimes(1);

    const [, options] = ioMock.mock.calls[0] as [string, MockSocketOptionsInterface];
    let firstPayload: unknown;

    options.auth((payload) => {
      firstPayload = payload;
    });
    expect(firstPayload).toEqual({ token: 'access-1' });

    // A silent refresh rotates the store's token, then the gateway's
    // heartbeat sweep rejects the *original* token the socket connected
    // with — a server-initiated disconnect.
    act(() => {
      useAuthStore.getState().setTokens('access-2', 'refresh-2');
      emit('connect');
      emit('disconnect', 'io server disconnect');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(MANUAL_RECONNECT_BASE_DELAY_MS);
    });

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
