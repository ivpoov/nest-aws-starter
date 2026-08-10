import type { LockoutRecordInterface } from '@modules/account-security/interfaces/lockout-record.interface.js';
import type { LockoutScopeEnum } from '@nest-aws-starter/shared';

export interface LockoutRepositoryInterface {
  incrementFailedAttempts(scope: LockoutScopeEnum, value: string): Promise<number>;
  isLocked(scope: LockoutScopeEnum, value: string): Promise<boolean>;
  lock(scope: LockoutScopeEnum, value: string): Promise<boolean>;
  resetFailedAttempts(scope: LockoutScopeEnum, value: string): Promise<void>;
  release(scope: LockoutScopeEnum, value: string): Promise<void>;
  findAllLockouts(): Promise<LockoutRecordInterface[]>;
}
