import type { ActivityInterface } from '@modules/activity/interfaces/activity.interface.js';
import type { ActivityTypeEnum } from '@nest-aws-starter/shared';

// CASL subject class — the ability metadata target for activity permissions.
export class ActivityEntity implements ActivityInterface {
  declare readonly id: string;
  declare readonly userId: string | null;
  declare readonly actorId: string | null;
  declare readonly sessionId: string | null;
  declare readonly type: ActivityTypeEnum;
  declare readonly meta: Record<string, unknown> | null;
  declare readonly ip: string | null;
  declare readonly createdAt: Date;
}
