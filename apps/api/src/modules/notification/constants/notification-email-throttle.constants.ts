export const NOTIFICATION_EMAIL_THROTTLE_REPOSITORY = Symbol(
  'NOTIFICATION_EMAIL_THROTTLE_REPOSITORY',
);

// Binding rule: max 1 email per (user, type) per hour — a
// webhook/login storm may persist N rows but must never send N mails.
export const NOTIFICATION_EMAIL_THROTTLE_WINDOW_SEC: number = 3600;

export const NOTIFICATION_EMAIL_THROTTLE_KEY_PREFIX: string = 'notification:email-throttle';
