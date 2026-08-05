import type { NotificationInterface } from '@modules/notification/interfaces/notification.interface.js';
import type { NotificationAudienceEnum, NotificationTypeEnum } from '@nest-aws-starter/shared';

// CASL subject class — the ability metadata target for notification
// permissions. Ownership (a USER row belongs to its userId; an ADMIN row is
// readable only by ADMIN role) is instance-level and enforced in
// NotificationService, not here — this class only gates the class-level
// action (backend.md's coarse role gate, same as every other module).
export class NotificationEntity implements NotificationInterface {
  declare readonly id: string;
  declare readonly audience: NotificationAudienceEnum;
  declare readonly userId: string | null;
  declare readonly type: NotificationTypeEnum;
  declare readonly title: string;
  declare readonly body: string;
  declare readonly meta: Record<string, unknown>;
  declare readonly createdAt: Date;
}
