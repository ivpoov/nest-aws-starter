import type { NotificationSocketStateInterface } from '../../interfaces/notification-socket-state.interface';
import type { NotificationSocketActionType } from '../../types/notification-socket-action.type';

export const INITIAL_NOTIFICATION_SOCKET_STATE: NotificationSocketStateInterface = {
  unreadCount: 0,
  isConnected: false,
};

export function notificationSocketReducer(
  state: NotificationSocketStateInterface,
  action: NotificationSocketActionType,
): NotificationSocketStateInterface {
  switch (action.kind) {
    case 'connected':
      return { ...state, isConnected: true };
    case 'disconnected':
      return { ...state, isConnected: false };
    case 'unread-count-set':
      return { ...state, unreadCount: action.count };
    case 'unread-count-adjusted':
      return { ...state, unreadCount: Math.max(0, state.unreadCount + action.delta) };
    case 'notification-received':
      // A live arrival's only effect on shared state is this optimistic +1
      // on the badge: the gateway's `unread-count` push is deliberately
      // ignored (see notification-events.constants.ts), so without it the
      // badge would sit stale for a whole poll interval. The notification
      // itself is not buffered here — the dropdown and the history page are
      // REST-backed and refetch, so a buffered copy would be state nobody
      // reads (and a second source of truth for read state).
      return { ...state, unreadCount: state.unreadCount + 1 };
    default:
      return state;
  }
}
