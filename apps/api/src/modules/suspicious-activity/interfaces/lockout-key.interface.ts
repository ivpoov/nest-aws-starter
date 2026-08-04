import type { LockoutScopeEnum } from '@nest-aws-starter/shared';

export interface LockoutKeyInterface {
  readonly scope: LockoutScopeEnum;
  readonly value: string;
}
