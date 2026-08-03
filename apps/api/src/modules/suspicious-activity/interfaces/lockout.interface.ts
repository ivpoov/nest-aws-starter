import type { LockoutScopeEnum } from '@nest-aws-starter/shared';

export interface LockoutInterface {
  readonly key: string;
  readonly scope: LockoutScopeEnum;
  readonly value: string;
  readonly ttlSec: number;
}
