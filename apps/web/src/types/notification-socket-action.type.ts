import type { NotificationResponseInterface } from '@nest-aws-starter/shared';

export type NotificationSocketActionType =
  | { readonly kind: 'connected' }
  | { readonly kind: 'disconnected' }
  | { readonly kind: 'unread-count-set'; readonly count: number }
  | { readonly kind: 'unread-count-adjusted'; readonly delta: number }
  | {
      readonly kind: 'notification-received';
      readonly notification: NotificationResponseInterface;
    };
