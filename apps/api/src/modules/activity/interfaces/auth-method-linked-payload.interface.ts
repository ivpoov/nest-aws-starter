import type { AuthMethodTypeEnum } from '@nest-aws-starter/shared';

export interface AuthMethodLinkedPayloadInterface {
  readonly userId: string;
  readonly type: AuthMethodTypeEnum;
}
