import type { LockoutScopeEnum } from '../enums/lockout-scope.enum.js';

export interface LockoutResponseInterface {
  readonly key: string;
  readonly scope: LockoutScopeEnum;
  readonly value: string;
  readonly ttlSec: number;
}
