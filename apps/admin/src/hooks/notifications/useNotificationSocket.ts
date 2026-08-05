import type { NotificationResponseInterface } from '@nest-aws-starter/shared';
import type { Dispatch, RefObject } from 'react';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { fetchUnreadCount } from '../../apis/notifications';
import { NOTIFICATION_EVENT } from '../../constants/notification-events.constants';
import { MAX_MANUAL_RECONNECT_ATTEMPTS } from '../../constants/notification-socket.constants';
import { UNREAD_COUNT_POLL_INTERVAL_MS } from '../../constants/notification-unread-count-poll.constants';
import type { UseNotificationSocketResultInterface } from '../../interfaces/use-notification-socket-result.interface';
import { useAuthStore } from '../../stores/auth.store';
import type { NotificationSocketActionType } from '../../types/notification-socket-action.type';
import { getSocketBaseUrl } from '../../utils/getSocketBaseUrl';
import { logger } from '../../utils/logger';
import {
  INITIAL_NOTIFICATION_SOCKET_STATE,
  notificationSocketReducer,
} from './notificationSocketReducer';

// Single socket per tab: this hook owns the whole lifecycle (connect on
// auth, reconnect with a fresh token, disconnect on logout/unmount) — every
// consumer (bell, dropdown, history page) reads state from it via
// NotificationSocketContext rather than opening a socket of its own.
//
// The badge's authoritative number never comes from the socket here (see
// notification-events.constants.ts for why) — it comes from
// GET /notifications/unread-count, fetched once on auth and then on a
// fixed poll. The socket still drives live UX: a `notification` arrival
// bumps the badge by one immediately (see notificationSocketReducer) so it
// does not sit stale for a full poll interval.
export function useNotificationSocket(): UseNotificationSocketResultInterface {
  const hasToken: boolean = useAuthStore((state) => Boolean(state.accessToken));
  const [state, dispatch] = useReducer(
    notificationSocketReducer,
    INITIAL_NOTIFICATION_SOCKET_STATE,
  );
  const manualReconnectAttemptsRef = useRef<number>(0);

  const refreshUnreadCount = useCallback(async (): Promise<void> => {
    try {
      const result = await fetchUnreadCount();

      dispatch({ kind: 'unread-count-set', count: result.count });
    } catch (caught: unknown) {
      logger.warn('Failed to refresh unread count', caught);
    }
  }, []);

  useEffect(() => {
    if (!hasToken) return undefined;

    return startUnreadCountPolling(refreshUnreadCount);
  }, [hasToken, refreshUnreadCount]);

  useEffect(() => {
    if (!hasToken) return undefined;

    return connectNotificationSocket(dispatch, manualReconnectAttemptsRef);
  }, [hasToken]);

  const adjustUnreadCount = useCallback((delta: number): void => {
    dispatch({ kind: 'unread-count-adjusted', delta });
  }, []);

  return {
    unreadCount: state.unreadCount,
    liveNotifications: state.liveNotifications,
    isConnected: state.isConnected,
    adjustUnreadCount,
    refreshUnreadCount,
  };
}

// Not a hook itself (no "use" prefix, calls no hooks) — a plain factory the
// effect above delegates to so the effect body stays under the size limit.
// Fires once immediately (so the badge has a value as soon as the bell
// mounts) then on a fixed interval; a hidden tab skips the fetch but the
// interval keeps ticking, so the next visible tick still lands on schedule
// rather than firing a burst of catch-up requests.
function startUnreadCountPolling(refresh: () => Promise<void>): () => void {
  void refresh();

  const intervalId: ReturnType<typeof setInterval> = setInterval((): void => {
    if (document.visibilityState === 'hidden') return;

    void refresh();
  }, UNREAD_COUNT_POLL_INTERVAL_MS);

  return (): void => clearInterval(intervalId);
}

function connectNotificationSocket(
  dispatch: Dispatch<NotificationSocketActionType>,
  attemptsRef: RefObject<number>,
): () => void {
  const socket: Socket = io(getSocketBaseUrl(), {
    reconnectionAttempts: MAX_MANUAL_RECONNECT_ATTEMPTS,
    auth: (callback): void => callback({ token: useAuthStore.getState().accessToken }),
  });

  attachSocketListeners(socket, dispatch, attemptsRef);

  return (): void => {
    socket.removeAllListeners();
    socket.disconnect();
  };
}

function attachSocketListeners(
  socket: Socket,
  dispatch: Dispatch<NotificationSocketActionType>,
  attemptsRef: RefObject<number>,
): void {
  socket.on('connect', (): void => {
    attemptsRef.current = 0;
    dispatch({ kind: 'connected' });
  });
  socket.on('disconnect', (reason: string): void => {
    dispatch({ kind: 'disconnected' });
    handleServerDisconnect(socket, reason, attemptsRef);
  });
  // No UNREAD_COUNT_EVENT listener here — deliberately, see
  // notification-events.constants.ts.
  socket.on(NOTIFICATION_EVENT, (notification: NotificationResponseInterface): void =>
    dispatch({ kind: 'notification-received', notification }),
  );
}

// The client's built-in reconnection logic does not retry an `io server
// disconnect` (a deliberate server-side disconnect — e.g. the gateway's
// heartbeat sweep rejecting a now-stale token). That case needs a manual
// `connect()`, which re-invokes the `auth` callback above and so picks up
// whatever token the store holds *now* — the whole point being that a
// refresh may have already replaced the one the socket first connected
// with. Bounded so a genuinely dead session (refresh also failing) gives up
// instead of looping forever.
function handleServerDisconnect(
  socket: Socket,
  reason: string,
  attemptsRef: RefObject<number>,
): void {
  if (reason !== 'io server disconnect') return;
  if (!useAuthStore.getState().accessToken) return;

  if (attemptsRef.current >= MAX_MANUAL_RECONNECT_ATTEMPTS) {
    logger.warn('Notification socket: giving up after repeated server-initiated disconnects');

    return;
  }

  attemptsRef.current += 1;
  socket.connect();
}
