import type { AuthLoginFailedPayloadInterface } from '@modules/account-security/interfaces/auth-login-failed-payload.interface.js';
import type { AuthLoginPayloadInterface } from '@modules/account-security/interfaces/auth-login-payload.interface.js';
import type { AuthNewDevicePayloadInterface } from '@modules/account-security/interfaces/auth-new-device-payload.interface.js';
import { LoginLockoutService } from '@modules/account-security/services/login-lockout.service.js';
import { NewDeviceService } from '@modules/account-security/services/new-device.service.js';
import {
  AUTH_LOGIN_EVENT,
  AUTH_LOGIN_FAILED_EVENT,
  AUTH_NEW_DEVICE_EVENT,
} from '@modules/event/constants/event-names.constants.js';
import { OnDomainEvent } from '@modules/event/decorators/on-domain-event.decorator.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { Injectable } from '@nestjs/common';

// Counting and notifying are best-effort side effects of a login that already
// happened (or already failed) — a Redis or mail hiccup here must never
// surface to the auth request that emitted the event (same rationale as
// ActivityListener.safeRecord).
@Injectable()
export class AccountSecurityListener {
  private readonly logger = new CustomLoggerService(AccountSecurityListener.name);

  constructor(
    private readonly loginLockoutService: LoginLockoutService,
    private readonly newDeviceService: NewDeviceService,
  ) {}

  @OnDomainEvent(AUTH_LOGIN_FAILED_EVENT)
  public async onAuthLoginFailed(payload: AuthLoginFailedPayloadInterface): Promise<void> {
    await this.safely('record failed login', () =>
      this.loginLockoutService.recordFailedLogin(payload.email, payload.ip),
    );
  }

  @OnDomainEvent(AUTH_LOGIN_EVENT)
  public async onAuthLogin(payload: AuthLoginPayloadInterface): Promise<void> {
    await this.safely('reset failed login counters', () =>
      this.loginLockoutService.resetFailedAttempts(payload.email, payload.ip),
    );
  }

  @OnDomainEvent(AUTH_NEW_DEVICE_EVENT)
  public async onAuthNewDevice(payload: AuthNewDevicePayloadInterface): Promise<void> {
    await this.safely('send new-device alert', () =>
      this.newDeviceService.sendAlert(payload.userId, payload.device, payload.ip),
    );
  }

  private async safely(action: string, run: () => Promise<void>): Promise<void> {
    try {
      await run();
    } catch (caught) {
      const stack: string | undefined = caught instanceof Error ? caught.stack : undefined;

      this.logger.error(`Failed to ${action}: ${String(caught)}`, stack);
    }
  }
}
