import type { LockoutScopeEnum } from '@nest-aws-starter/shared';

// Raw repository shape — no opaque key. LoginLockoutService adds the
// base64url key clients use to address a lockout over HTTP.
export interface LockoutRecordInterface {
  readonly scope: LockoutScopeEnum;
  readonly value: string;
  readonly ttlSec: number;
}
