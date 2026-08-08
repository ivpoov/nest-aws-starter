import type { AuthPasswordChangedPayloadInterface } from '@modules/notification/interfaces/auth-password-changed-payload.interface.js';
import type { NotificationContentInterface } from '@modules/notification/interfaces/notification-content.interface.js';

export function buildPasswordChangedContent(
  payload: AuthPasswordChangedPayloadInterface,
): NotificationContentInterface {
  return {
    title: 'Password changed',
    body: 'Your password was changed. If this was not you, secure your account immediately.',
    meta: { sessionId: payload.sessionId },
  };
}
