import type { LockoutScopeEnum } from '@nest-aws-starter/shared';

export interface AuthSuspiciousLoginPayloadInterface {
  readonly scope: LockoutScopeEnum;
  readonly value: string;
}
