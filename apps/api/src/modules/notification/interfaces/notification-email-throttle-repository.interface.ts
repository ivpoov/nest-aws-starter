import type { NotificationTypeEnum } from '@nest-aws-starter/shared';

// Redis-backed send-window state for the EMAIL channel (max 1 mail per
// (user, type) per NOTIFICATION_EMAIL_THROTTLE_WINDOW_SEC). Same shape as
// the account-security lockout: Redis is the only source of truth and is
// disposable by design — a flushed cache just re-opens every send window.
export interface NotificationEmailThrottleRepositoryInterface {
  // Atomically claims the (user, type) send slot for the current window
  // (single SET NX EX — two concurrent claims can never both succeed).
  // True: slot claimed, the caller may send. False: a mail for this pair
  // already went out inside the window.
  claim(userId: string, type: NotificationTypeEnum): Promise<boolean>;
}
