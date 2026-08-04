import type { ActivityTypeEnum } from '../enums/activity-type.enum.js';

export interface ActivityResponseInterface {
  readonly id: string;
  readonly userId: string | null;
  readonly actorId: string | null;
  readonly sessionId: string | null;
  readonly type: ActivityTypeEnum;
  readonly meta: Record<string, unknown> | null;
  readonly ip: string | null;
  readonly createdAt: string;
}
