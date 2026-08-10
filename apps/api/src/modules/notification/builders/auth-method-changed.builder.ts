import type { NotificationContentInterface } from '@modules/notification/interfaces/notification-content.interface.js';
import type { AuthMethodChangeActionType } from '@modules/notification/types/auth-method-change-action.type.js';
import type { AuthMethodTypeEnum } from '@nest-aws-starter/shared';

// Backs both auth.method-linked and auth.method-unlinked — same
// NotificationTypeEnum.AUTH_METHOD_CHANGED member, distinguished only by
// which event fired (see the matrix in NotificationEventSubscriberService).
export function buildAuthMethodChangedContent(
  methodType: AuthMethodTypeEnum,
  action: AuthMethodChangeActionType,
): NotificationContentInterface {
  const isLinked: boolean = action === 'linked';

  return {
    title: isLinked ? 'Sign-in method added' : 'Sign-in method removed',
    body: `A ${methodType} sign-in method was ${action} to your account.`,
    meta: { methodType, action },
  };
}
