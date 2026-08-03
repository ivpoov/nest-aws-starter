import type { AuthMethodTypeEnum } from '@nest-aws-starter/shared';

export interface AuthMethodUnlinkedPayloadInterface {
  readonly userId: string;
  readonly type: AuthMethodTypeEnum;
}
