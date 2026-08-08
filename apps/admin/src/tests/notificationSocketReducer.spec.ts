import { describe, expect, it } from 'vitest';
import {
  INITIAL_NOTIFICATION_SOCKET_STATE,
  notificationSocketReducer,
} from '../hooks/notifications/notificationSocketReducer';
import type { NotificationSocketStateInterface } from '../interfaces/notification-socket-state.interface';

describe('notificationSocketReducer', () => {
  it('sets isConnected on connected/disconnected', () => {
    const connected = notificationSocketReducer(INITIAL_NOTIFICATION_SOCKET_STATE, {
      kind: 'connected',
    });

    expect(connected.isConnected).toBe(true);

    const disconnected = notificationSocketReducer(connected, { kind: 'disconnected' });

    expect(disconnected.isConnected).toBe(false);
  });

  it('sets the unread count on unread-count-set (the poll/refresh path)', () => {
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

  it('bumps the badge once per arrival and keeps no other state', () => {
    let state: NotificationSocketStateInterface = INITIAL_NOTIFICATION_SOCKET_STATE;

    for (let index = 0; index < 25; index += 1) {
      state = notificationSocketReducer(state, { kind: 'notification-received' });
    }

    // Admin trusts neither the socket's `unread-count` push (never even
    // wired up — see notification-events.constants.ts) nor the REST poll
    // to react instantly to a live arrival, so a received notification
    // bumps the badge itself — and that is the *only* thing it changes:
    // the notification is not buffered anywhere.
    expect(state.unreadCount).toBe(25);
    expect(Object.keys(state).sort()).toEqual(['isConnected', 'unreadCount']);
  });
});
