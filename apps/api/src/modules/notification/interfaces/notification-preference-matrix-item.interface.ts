import type { NotificationChannelEnum, NotificationTypeEnum } from '@nest-aws-starter/shared';

// One cell of the full effective matrix (stored override merged over the
// default) — the domain-side counterpart of the shared
// NotificationPreferenceResponseInterface wire shape.
export interface NotificationPreferenceMatrixItemInterface {
  readonly type: NotificationTypeEnum;
  readonly channel: NotificationChannelEnum;
  readonly enabled: boolean;
  readonly isEditable: boolean;
}
