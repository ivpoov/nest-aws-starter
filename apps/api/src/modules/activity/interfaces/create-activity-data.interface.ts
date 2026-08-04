import type { ActivityTypeEnum } from '@nest-aws-starter/shared';

export interface CreateActivityDataInterface {
  readonly userId?: string | null | undefined;
  readonly actorId?: string | null | undefined;
  readonly sessionId?: string | null | undefined;
  readonly type: ActivityTypeEnum;
  readonly meta?: Record<string, unknown> | null | undefined;
  readonly ip?: string | null | undefined;
}
