import {
  FAILED_LOGIN_THRESHOLD,
  LOCKOUT_REPOSITORY,
} from '@modules/account-security/constants/account-security.constants.js';
import { AUTH_TEMPORARILY_LOCKED } from '@modules/account-security/constants/account-security-errors.constants.js';
import type { LockoutInterface } from '@modules/account-security/interfaces/lockout.interface.js';
import type { LockoutKeyInterface } from '@modules/account-security/interfaces/lockout-key.interface.js';
import type { LockoutRecordInterface } from '@modules/account-security/interfaces/lockout-record.interface.js';
import type { LockoutRepositoryInterface } from '@modules/account-security/interfaces/lockout-repository.interface.js';
import { UnauthorizedError } from '@modules/common/errors/unauthorized.error.js';
import { AUTH_SUSPICIOUS_LOGIN_EVENT } from '@modules/event/constants/event-names.constants.js';
import { EventBusService } from '@modules/event/services/event-bus.service.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { LockoutScopeEnum } from '@nest-aws-starter/shared';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class LoginLockoutService {
  private readonly logger = new CustomLoggerService(LoginLockoutService.name);

  constructor(
    @Inject(LOCKOUT_REPOSITORY) private readonly lockoutRepository: LockoutRepositoryInterface,
    private readonly eventBus: EventBusService,
  ) {}

  // Synchronous, read-only, called before credential verification. A Redis
  // outage must never lock every login out — fail open and log loudly.
  public async assertNotLocked(email: string, ip: string): Promise<void> {
    const locked: boolean = await this.isLockedSafely(email, ip);

    if (locked) throw new UnauthorizedError(AUTH_TEMPORARILY_LOCKED);
  }

  // The two scopes are independent accounting, so neither may be lost to the
  // other's failure: `allSettled` means an EMAIL error still leaves the IP
  // counter incremented (and vice versa). The first rejection is re-thrown
  // afterwards so the caller still logs a real failure — the listener that owns
  // this call contains and logs it.
  public async recordFailedLogin(email: string, ip: string): Promise<void> {
    const outcomes: PromiseSettledResult<void>[] = await Promise.allSettled([
      this.recordFailure(LockoutScopeEnum.EMAIL, email),
      this.recordFailure(LockoutScopeEnum.IP, ip),
    ]);
    const failure: PromiseRejectedResult | undefined = outcomes.find(
      (outcome: PromiseSettledResult<void>): outcome is PromiseRejectedResult =>
        outcome.status === 'rejected',
    );

    if (failure) throw failure.reason;
  }

  public async resetFailedAttempts(email: string, ip: string): Promise<void> {
    await this.lockoutRepository.resetFailedAttempts(LockoutScopeEnum.EMAIL, email);
    await this.lockoutRepository.resetFailedAttempts(LockoutScopeEnum.IP, ip);
  }

  public async listLockouts(): Promise<LockoutInterface[]> {
    const records: LockoutRecordInterface[] = await this.lockoutRepository.findAllLockouts();

    return records.map(
      (record: LockoutRecordInterface): LockoutInterface => ({
        ...record,
        key: this.encodeKey(record.scope, record.value),
      }),
    );
  }

  public async release(key: string): Promise<void> {
    const { scope, value } = this.decodeKey(key);

    await this.lockoutRepository.release(scope, value);
    this.logger.log(`Lockout released: ${scope}:${value}`);
  }

  private async isLockedSafely(email: string, ip: string): Promise<boolean> {
    try {
      const [emailLocked, ipLocked]: [boolean, boolean] = await Promise.all([
        this.lockoutRepository.isLocked(LockoutScopeEnum.EMAIL, email),
        this.lockoutRepository.isLocked(LockoutScopeEnum.IP, ip),
      ]);

      return emailLocked || ipLocked;
    } catch (caught) {
      this.logger.warn(`Lockout check failed, failing open: ${String(caught)}`);

      return false;
    }
  }

  private async recordFailure(scope: LockoutScopeEnum, value: string): Promise<void> {
    const count: number = await this.lockoutRepository.incrementFailedAttempts(scope, value);

    if (count < FAILED_LOGIN_THRESHOLD) return;

    const isNewLock: boolean = await this.lockoutRepository.lock(scope, value);

    if (!isNewLock) return;

    this.logger.warn(`Lockout triggered: ${scope}:${value}`);
    this.eventBus.emit(AUTH_SUSPICIOUS_LOGIN_EVENT, { scope, value });
  }

  private encodeKey(scope: LockoutScopeEnum, value: string): string {
    return Buffer.from(`${scope}:${value}`, 'utf8').toString('base64url');
  }

  private decodeKey(key: string): LockoutKeyInterface {
    const decoded: string = Buffer.from(key, 'base64url').toString('utf8');
    const separatorIndex: number = decoded.indexOf(':');

    return {
      scope: decoded.slice(0, separatorIndex) as LockoutScopeEnum,
      value: decoded.slice(separatorIndex + 1),
    };
  }
}
