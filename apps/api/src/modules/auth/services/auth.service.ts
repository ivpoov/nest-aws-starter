import { ARGON2_OPTIONS } from '@modules/auth/constants/auth.constants.js';
import {
  AUTH_EMAIL_LINKED_TO_PROVIDER,
  AUTH_EMAIL_TAKEN,
  AUTH_INVALID_CREDENTIALS,
} from '@modules/auth/constants/auth-errors.constants.js';
import type { LoginDto } from '@modules/auth/dtos/login.dto.js';
import type { RegisterDto } from '@modules/auth/dtos/register.dto.js';
import { ConflictError } from '@modules/common/errors/conflict.error.js';
import { ForbiddenError } from '@modules/common/errors/forbidden.error.js';
import { UnauthorizedError } from '@modules/common/errors/unauthorized.error.js';
import {
  AUTH_LOGIN_EVENT,
  USER_REGISTERED_EVENT,
} from '@modules/event/constants/event-names.constants.js';
import { EventBusService } from '@modules/event/services/event-bus.service.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import type { SessionContextInterface } from '@modules/session/interfaces/session-context.interface.js';
import { SessionService } from '@modules/session/services/session.service.js';
import type { TokenPairInterface } from '@modules/token/interfaces/token-pair.interface.js';
import { USER_BLOCKED } from '@modules/user/constants/user-errors.constants.js';
import type { AuthMethodInterface } from '@modules/user/interfaces/auth-method.interface.js';
import type { UserInterface } from '@modules/user/interfaces/user.interface.js';
import type { UserWithMethodTypesInterface } from '@modules/user/interfaces/user-with-method-types.interface.js';
import { UserService } from '@modules/user/services/user.service.js';
import { AuthMethodTypeEnum, UserStatusEnum } from '@nest-aws-starter/shared';
import { Injectable } from '@nestjs/common';
import { hash, verify } from 'argon2';

@Injectable()
export class AuthService {
  private readonly logger = new CustomLoggerService(AuthService.name);
  // Verified against on unknown emails so response timing does not reveal
  // whether an account exists.
  private readonly dummyHashPromise: Promise<string> = hash('dummy-password', ARGON2_OPTIONS);

  constructor(
    private readonly userService: UserService,
    private readonly sessionService: SessionService,
    private readonly eventBus: EventBusService,
  ) {}

  public async register(
    dto: RegisterDto,
    context: SessionContextInterface,
  ): Promise<TokenPairInterface> {
    await this.assertEmailFree(dto.email);

    const passwordHash: string = await hash(dto.password, ARGON2_OPTIONS);
    const user: UserInterface = await this.userService.createWithEmailMethod({
      displayName: dto.displayName,
      email: dto.email,
      passwordHash,
    });

    this.logger.log(`Registered user ${user.id}`);
    this.eventBus.emit(USER_REGISTERED_EVENT, { userId: user.id, ip: context.ip });

    return this.sessionService.createSession(user, context);
  }

  public async login(dto: LoginDto, context: SessionContextInterface): Promise<TokenPairInterface> {
    const method: AuthMethodInterface | null = await this.userService.findEmailMethod(dto.email);

    if (!method?.passwordHash) {
      await verify(await this.dummyHashPromise, dto.password).catch((): boolean => false);

      throw new UnauthorizedError(AUTH_INVALID_CREDENTIALS);
    }

    const isValid: boolean = await verify(method.passwordHash, dto.password);

    if (!isValid) throw new UnauthorizedError(AUTH_INVALID_CREDENTIALS);

    const user: UserInterface = await this.userService.findByIdOrThrow(method.userId);

    if (user.status === UserStatusEnum.BLOCKED) throw new ForbiddenError(USER_BLOCKED);

    await this.userService.touchMethodLastUsed(method.id);
    this.logger.log(`User logged in: ${user.id}`);

    const tokens: TokenPairInterface = await this.sessionService.createSession(user, context);

    this.eventBus.emit(AUTH_LOGIN_EVENT, { userId: user.id, ip: context.ip });

    return tokens;
  }

  public async refresh(refreshToken: string): Promise<TokenPairInterface> {
    return this.sessionService.refresh(refreshToken);
  }

  public async logout(userId: string, sessionId: string): Promise<void> {
    await this.sessionService.revokeSession(userId, sessionId);
    this.logger.log(`User logged out: ${userId}`);
  }

  private async assertEmailFree(email: string): Promise<void> {
    const existing: UserWithMethodTypesInterface | null =
      await this.userService.findByAuthEmail(email);

    if (!existing) return;

    if (existing.methodTypes.includes(AuthMethodTypeEnum.EMAIL)) {
      throw new ConflictError(AUTH_EMAIL_TAKEN);
    }

    // The PoE2 conflict rule, machine-readable: the frontend renders the
    // provider list from meta.providers.
    throw new ConflictError({
      ...AUTH_EMAIL_LINKED_TO_PROVIDER,
      meta: { providers: existing.methodTypes },
    });
  }
}
