import type { NotificationContentInterface } from '@modules/notification/interfaces/notification-content.interface.js';
import type { UserBlockedPayloadInterface } from '@modules/notification/interfaces/user-blocked-payload.interface.js';

// ADMIN audience — the notification row itself has no userId (it addresses
// the admin cohort); the blocked user's id travels in meta as deep-link data.
export function buildUserBlockedContent(
  payload: UserBlockedPayloadInterface,
): NotificationContentInterface {
  return {
    title: 'User blocked',
    body: `A user was blocked${payload.reason ? `: ${payload.reason}` : '.'}`,
    meta: { userId: payload.userId, actorId: payload.actorId, reason: payload.reason ?? null },
  };
}
