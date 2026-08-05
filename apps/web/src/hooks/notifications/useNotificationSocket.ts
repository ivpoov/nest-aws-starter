import type { NotificationResponseInterface } from '@nest-aws-starter/shared';
import type { Dispatch, RefObject } from 'react';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { fetchUnreadCount } from '../../apis/notifications';
import {
  NOTIFICATION_EVENT,
  UNREAD_COUNT_EVENT,
} from '../../constants/notification-events.constants';
import { MAX_MANUAL_RECONNECT_ATTEMPTS } from '../../constants/notification-socket.constants';
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
// consumer (bell, dropdown) reads state from it via NotificationSocketContext
// rather than opening a socket of its own.
export function useNotificationSocket(): UseNotificationSocketResultInterface {
  const hasToken: boolean = useAuthStore((state) => Boolean(state.accessToken));
  const [state, dispatch] = useReducer(
    notificationSocketReducer,
    INITIAL_NOTIFICATION_SOCKET_STATE,
  );
  const manualReconnectAttemptsRef = useRef<number>(0);

  useEffect(() => {
    if (!hasToken) return;

    fetchUnreadCount()
      .then((result): void => dispatch({ kind: 'unread-count-set', count: result.count }))
      .catch((caught: unknown): void =>
        logger.warn('Failed to fetch initial unread count', caught),
      );
  }, [hasToken]);

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
  };
}

// Not a hook itself (no "use" prefix, calls no hooks) — a plain factory the
// effect above delegates to so the effect body stays under the size limit.
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
  socket.on(UNREAD_COUNT_EVENT, (count: number): void =>
    dispatch({ kind: 'unread-count-set', count }),
  );
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
