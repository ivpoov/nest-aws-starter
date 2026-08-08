import type { NotificationResponseInterface } from '@nest-aws-starter/shared';
import { MAX_LIVE_NOTIFICATIONS } from '../../constants/notification-socket.constants';
import type { NotificationSocketStateInterface } from '../../interfaces/notification-socket-state.interface';
import type { NotificationSocketActionType } from '../../types/notification-socket-action.type';

export const INITIAL_NOTIFICATION_SOCKET_STATE: NotificationSocketStateInterface = {
  unreadCount: 0,
  liveNotifications: [],
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
      // Also bumps the badge by one: the gateway's `unread-count` push is
      // deliberately ignored (it would understate the merged badge for an
      // ADMIN-role user — see notification-events.constants.ts), so a live
      // arrival's only immediate signal is this optimistic +1 — the next
      // poll tick (or the post-read refetch) reconciles it against the
      // server.
      return {
        ...state,
        unreadCount: state.unreadCount + 1,
        liveNotifications: prependNotification(state.liveNotifications, action.notification),
      };
    default:
      return state;
  }
}

function prependNotification(
  notifications: readonly NotificationResponseInterface[],
  notification: NotificationResponseInterface,
): readonly NotificationResponseInterface[] {
  return [notification, ...notifications].slice(0, MAX_LIVE_NOTIFICATIONS);
}
