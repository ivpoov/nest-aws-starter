import type { NotificationResponseInterface } from '@nest-aws-starter/shared';
import { describe, expect, it } from 'vitest';
import {
  INITIAL_NOTIFICATION_SOCKET_STATE,
  notificationSocketReducer,
} from '../hooks/notifications/notificationSocketReducer';
import type { NotificationSocketStateInterface } from '../interfaces/notification-socket-state.interface';

function buildNotification(id: string): NotificationResponseInterface {
  return {
    id,
    audience: 'USER' as NotificationResponseInterface['audience'],
    userId: 'u-1',
    type: 'PASSWORD_CHANGED' as NotificationResponseInterface['type'],
    title: 'Title',
    body: 'Body',
    meta: {},
    createdAt: '2026-08-01T00:00:00.000Z',
    readAt: null,
  };
}

describe('notificationSocketReducer', () => {
  it('sets isConnected on connected/disconnected', () => {
    const connected = notificationSocketReducer(INITIAL_NOTIFICATION_SOCKET_STATE, {
      kind: 'connected',
    });

    expect(connected.isConnected).toBe(true);

    const disconnected = notificationSocketReducer(connected, { kind: 'disconnected' });

    expect(disconnected.isConnected).toBe(false);
  });

  it('sets the unread count on unread-count-set', () => {
    const state = notificationSocketReducer(INITIAL_NOTIFICATION_SOCKET_STATE, {
      kind: 'unread-count-set',
      count: 5,
    });

    expect(state.unreadCount).toBe(5);
  });

  it('adjusts the unread count and floors it at zero', () => {
    const seeded: NotificationSocketStateInterface = {
      ...INITIAL_NOTIFICATION_SOCKET_STATE,
      unreadCount: 2,
    };

    const decremented = notificationSocketReducer(seeded, {
      kind: 'unread-count-adjusted',
      delta: -1,
    });

    expect(decremented.unreadCount).toBe(1);

    const flooredAtZero = notificationSocketReducer(decremented, {
      kind: 'unread-count-adjusted',
      delta: -10,
    });

    expect(flooredAtZero.unreadCount).toBe(0);
  });

  it('prepends a received notification and caps the buffer', () => {
    let state: NotificationSocketStateInterface = INITIAL_NOTIFICATION_SOCKET_STATE;

    for (let index = 0; index < 25; index += 1) {
      state = notificationSocketReducer(state, {
        kind: 'notification-received',
        notification: buildNotification(`n-${index}`),
      });
    }

    expect(state.liveNotifications).toHaveLength(20);
    expect(state.liveNotifications[0]?.id).toBe('n-24');
  });
});
