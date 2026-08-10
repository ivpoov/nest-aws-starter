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

    // Fail-safe ordering (§7a). Revoke FIRST: a crash after the revoke leaves
    // the account logged out with the OLD password still valid, and the user
    // simply asks for another reset. The old order left the NEW password live
    // with every pre-reset session — including the attacker's — still
    // authenticated, which is the exact property a reset exists to guarantee.
    //
    // Only PART of this is irreducibly cross-store. Session rows are Postgres
    // (SessionPrismaRepository), so `revokeAllForUser`'s row write and the
    // password write below could be one unit; the token allowlist it also
    // clears is Redis, and that half never can be. Making the Postgres halves
    // atomic needs SessionService and SESSION_REPOSITORY to accept a `tx` —
    // tracked as follow-up work, not done here. Until then the ordering is the
    // whole guarantee, so do not reorder these two lines.
    //
    // The argon2 hash is computed before the revoke so the window between the
    // two writes stays as short as possible.
    const passwordHash: string = await hash(password, ARGON2_OPTIONS);

    await this.sessionService.revokeAllForUser(userId);
    await this.userService.updatePasswordHash(method.id, passwordHash);
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

    // Same fail-safe ordering as resetPassword, and the same partly-cross-store
    // caveat documented there. Revoke first, so a crash between the two leaves
    // other devices logged out under the unchanged password rather than logged
    // in under the new one. The actor proved possession of the current
    // password, so their own session stays.
    const passwordHash: string = await hash(password, ARGON2_OPTIONS);

    await this.sessionService.revokeOtherSessions(userId, sessionId);
    await this.userService.updatePasswordHash(method.id, passwordHash);
    this.logger.log(`Password changed for user ${userId}`);
    this.eventBus.emit(AUTH_PASSWORD_CHANGED_EVENT, { userId, sessionId });
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
