import type { LockoutInterface } from '@modules/suspicious-activity/interfaces/lockout.interface.js';
import type { LockoutScopeEnum } from '@nest-aws-starter/shared';

// CASL subject class — the ability metadata target for lockout permissions.
export class LockoutEntity implements LockoutInterface {
  declare readonly key: string;
  declare readonly scope: LockoutScopeEnum;
  declare readonly value: string;
  declare readonly ttlSec: number;
}
