import { randomBytes, timingSafeEqual } from 'node:crypto';
import { type WebAppConfig, webAppConfig } from '@configs/web-app.config.js';
import {
  ARGON2_OPTIONS,
  ONE_TIME_TOKEN_REPOSITORY,
  RESET_PASSWORD_TTL_SEC,
  VERIFY_EMAIL_TTL_SEC,
} from '@modules/auth/constants/auth.constants.js';
import {
  AUTH_INVALID_CREDENTIALS,
  AUTH_ONE_TIME_TOKEN_INVALID,
} from '@modules/auth/constants/auth-errors.constants.js';
import { OneTimeTokenKindEnum } from '@modules/auth/enums/one-time-token-kind.enum.js';
import type { MailContentInterface } from '@modules/auth/interfaces/mail-content.interface.js';
import type { OneTimeTokenRepositoryInterface } from '@modules/auth/interfaces/one-time-token-repository.interface.js';
import { buildResetPasswordMail } from '@modules/auth/templates/reset-password.template.js';
import { buildVerifyEmailMail } from '@modules/auth/templates/verify-email.template.js';
import { UnauthorizedError } from '@modules/common/errors/unauthorized.error.js';
import { AUTH_PASSWORD_CHANGED_EVENT } from '@modules/event/constants/event-names.constants.js';
import { EventBusService } from '@modules/event/services/event-bus.service.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { SessionService } from '@modules/session/services/session.service.js';
import type { AuthMethodInterface } from '@modules/user/interfaces/auth-method.interface.js';
import { UserService } from '@modules/user/services/user.service.js';
import { Inject, Injectable } from '@nestjs/common';
import { MAIL_TRANSPORT } from '@providers/mail/constants/mail.constants.js';
import type { MailTransportInterface } from '@providers/mail/interfaces/mail-transport.interface.js';
import { hash, verify } from 'argon2';

@Injectable()
export class EmailFlowService {
  private readonly logger = new CustomLoggerService(EmailFlowService.name);

  constructor(
    @Inject(webAppConfig.KEY) private readonly config: WebAppConfig,
    @Inject(ONE_TIME_TOKEN_REPOSITORY)
    private readonly tokenRepository: OneTimeTokenRepositoryInterface,
    @Inject(MAIL_TRANSPORT) private readonly mailTransport: MailTransportInterface,
    private readonly userService: UserService,
    private readonly sessionService: SessionService,
    private readonly eventBus: EventBusService,
  ) {}

  public async requestEmailVerification(userId: string): Promise<void> {
    const method: AuthMethodInterface | null =
      await this.userService.findEmailMethodByUserId(userId);

    if (!method?.email || method.isEmailVerified) return;

    const token: string = this.issueToken();

    await this.tokenRepository.setToken(
      userId,
      OneTimeTokenKindEnum.VERIFY_EMAIL,
      token,
      VERIFY_EMAIL_TTL_SEC,
    );

    const link: string = `${this.config.baseUrl}/verify-email?uid=${userId}&token=${token}`;
    const mail: MailContentInterface = buildVerifyEmailMail(link);

    await this.mailTransport.send({ to: method.email, ...mail });
    this.logger.log(`Verification mail sent for user ${userId}`);
  }

  public async verifyEmail(userId: string, token: string): Promise<void> {
    await this.consumeOrThrow(userId, OneTimeTokenKindEnum.VERIFY_EMAIL, token);

    const method: AuthMethodInterface | null =
      await this.userService.findEmailMethodByUserId(userId);

    if (!method) throw new UnauthorizedError(AUTH_ONE_TIME_TOKEN_INVALID);

    await this.userService.markEmailVerified(method.id);
  }

  public async requestPasswordReset(email: string): Promise<void> {
    const method: AuthMethodInterface | null = await this.userService.findEmailMethod(email);

    // Silent success for unknown emails — no account enumeration.
    if (!method?.email) return;

    const token: string = this.issueToken();

    await this.tokenRepository.setToken(
      method.userId,
      OneTimeTokenKindEnum.RESET_PASSWORD,
      token,
      RESET_PASSWORD_TTL_SEC,
    );

    const link: string = `${this.config.baseUrl}/reset-password?uid=${method.userId}&token=${token}`;
    const mail: MailContentInterface = buildResetPasswordMail(link);

    await this.mailTransport.send({ to: method.email, ...mail });
    this.logger.log(`Password reset mail sent for user ${method.userId}`);
  }

  public async resetPassword(userId: string, token: string, password: string): Promise<void> {
    await this.consumeOrThrow(userId, OneTimeTokenKindEnum.RESET_PASSWORD, token);

    const method: AuthMethodInterface | null =
      await this.userService.findEmailMethodByUserId(userId);

    if (!method) throw new UnauthorizedError(AUTH_ONE_TIME_TOKEN_INVALID);

    await this.userService.updatePasswordHash(method.id, await hash(password, ARGON2_OPTIONS));
    // A reset means the password may have been compromised — everything dies.
    await this.sessionService.revokeAllForUser(userId);
    this.logger.log(`Password reset completed for user ${userId}`);
    this.eventBus.emit(AUTH_PASSWORD_CHANGED_EVENT, { userId, sessionId: null });
  }

  public async changePassword(
    userId: string,
    sessionId: string,
    currentPassword: string,
    password: string,
  ): Promise<void> {
    const method: AuthMethodInterface | null =
      await this.userService.findEmailMethodByUserId(userId);

    if (!method?.passwordHash || !(await verify(method.passwordHash, currentPassword))) {
      throw new UnauthorizedError(AUTH_INVALID_CREDENTIALS);
    }

    await this.userService.updatePasswordHash(method.id, await hash(password, ARGON2_OPTIONS));
    // The actor proved possession of the current password — their session stays.
    await this.sessionService.revokeOtherSessions(userId, sessionId);
    this.logger.log(`Password changed for user ${userId}`);
  }

  private issueToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private async consumeOrThrow(
    userId: string,
    kind: OneTimeTokenKindEnum,
    token: string,
  ): Promise<void> {
    const stored: string | null = await this.tokenRepository.consumeToken(userId, kind);

    if (!stored || !this.tokensEqual(stored, token)) {
      throw new UnauthorizedError(AUTH_ONE_TIME_TOKEN_INVALID);
    }
  }

  private tokensEqual(left: string, right: string): boolean {
    const leftBuffer: Buffer = Buffer.from(left);
    const rightBuffer: Buffer = Buffer.from(right);

    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }
}
