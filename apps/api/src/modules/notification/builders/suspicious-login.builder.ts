import type { AuthSuspiciousLoginPayloadInterface } from '@modules/notification/interfaces/auth-suspicious-login-payload.interface.js';
import type { NotificationContentInterface } from '@modules/notification/interfaces/notification-content.interface.js';

// ADMIN audience — the lockout scope/value identify what tripped it, not a
// specific account, so there is no userId to attach.
export function buildSuspiciousLoginContent(
  payload: AuthSuspiciousLoginPayloadInterface,
): NotificationContentInterface {
  return {
    title: 'Suspicious login activity',
    body: `Suspicious login activity was detected (${payload.scope}: ${payload.value}).`,
    meta: { scope: payload.scope, value: payload.value },
  };
}
