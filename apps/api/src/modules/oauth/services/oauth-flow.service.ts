import { randomBytes } from 'node:crypto';
import { type WebAppConfig, webAppConfig } from '@configs/web-app.config.js';
import { ConflictError } from '@modules/common/errors/conflict.error.js';
import { ForbiddenError } from '@modules/common/errors/forbidden.error.js';
import { UnauthorizedError } from '@modules/common/errors/unauthorized.error.js';
import { ValidationError } from '@modules/common/errors/validation.error.js';
import {
  AUTH_METHOD_LINKED_EVENT,
  USER_OAUTH_REGISTERED_EVENT,
} from '@modules/event/constants/event-names.constants.js';
import { EventBusService } from '@modules/event/services/event-bus.service.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import {
  OAUTH_EXCHANGE_TTL_SEC,
  OAUTH_STATE_TTL_SEC,
  OAUTH_STORE_REPOSITORY,
} from '@modules/oauth/constants/oauth.constants.js';
import {
  AUTH_EMAIL_LINKED_TO_OTHER_ACCOUNT,
  AUTH_METHOD_ALREADY_LINKED,
  AUTH_METHOD_LINKED_ELSEWHERE,
  OAUTH_EXCHANGE_CODE_INVALID,
  OAUTH_PROVIDER_NOT_ENABLED,
  OAUTH_REDIRECT_NOT_ALLOWED,
  OAUTH_STATE_INVALID,
} from '@modules/oauth/constants/oauth-errors.constants.js';
import { OauthIntentEnum } from '@modules/oauth/enums/oauth-intent.enum.js';
import type { OauthExchangePayloadInterface } from '@modules/oauth/interfaces/oauth-exchange-payload.interface.js';
import type { OauthProfileInterface } from '@modules/oauth/interfaces/oauth-profile.interface.js';
import type { OauthProviderInterface } from '@modules/oauth/interfaces/oauth-provider.interface.js';
import type { OauthStatePayloadInterface } from '@modules/oauth/interfaces/oauth-state-payload.interface.js';
import type { OauthStoreRepositoryInterface } from '@modules/oauth/interfaces/oauth-store-repository.interface.js';
import { OauthProviderRegistryService } from '@modules/oauth/services/oauth-provider-registry.service.js';
import type { SessionContextInterface } from '@modules/session/interfaces/session-context.interface.js';
import { SessionService } from '@modules/session/services/session.service.js';
import type { TokenPairInterface } from '@modules/token/interfaces/token-pair.interface.js';
import { TokenService } from '@modules/token/services/token.service.js';
import { USER_BLOCKED } from '@modules/user/constants/user-errors.constants.js';
import type { AuthMethodInterface } from '@modules/user/interfaces/auth-method.interface.js';
import type { UserInterface } from '@modules/user/interfaces/user.interface.js';
import type { UserWithMethodTypesInterface } from '@modules/user/interfaces/user-with-method-types.interface.js';
import { UserService } from '@modules/user/services/user.service.js';
import {
  type AuthMethodTypeEnum,
  OauthExchangeKindEnum,
  UserStatusEnum,
} from '@nest-aws-starter/shared';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class OauthFlowService {
  private readonly logger = new CustomLoggerService(OauthFlowService.name);

  constructor(
    @Inject(webAppConfig.KEY) private readonly webApp: WebAppConfig,
    @Inject(OAUTH_STORE_REPOSITORY) private readonly store: OauthStoreRepositoryInterface,
    private readonly registry: OauthProviderRegistryService,
    private readonly tokenService: TokenService,
    private readonly userService: UserService,
    private readonly sessionService: SessionService,
    private readonly eventBus: EventBusService,
  ) {}

  public async start(
    type: AuthMethodTypeEnum,
    intent: OauthIntentEnum,
    redirect: string,
    authorizationHeader: string | undefined,
  ): Promise<string> {
    const provider: OauthProviderInterface = this.providerOrThrow(type);

    if (!redirect.startsWith(this.webApp.baseUrl)) {
      throw new ValidationError(OAUTH_REDIRECT_NOT_ALLOWED);
    }

    const userId: string | null =
      intent === OauthIntentEnum.LINK ? await this.requireUserId(authorizationHeader) : null;
    const state: string = randomBytes(32).toString('base64url');

    await this.store.setState(
      state,
      { provider: type, intent, userId, redirect },
      OAUTH_STATE_TTL_SEC,
    );

    return provider.buildConsentUrl(state);
  }

  public async handleCallback(
    type: AuthMethodTypeEnum,
    state: string,
    code: string,
    context: SessionContextInterface,
  ): Promise<string> {
    const provider: OauthProviderInterface = this.providerOrThrow(type);
    const payload: OauthStatePayloadInterface | null = await this.store.consumeState(state);

    if (!payload || payload.provider !== type) {
      throw new ValidationError(OAUTH_STATE_INVALID);
    }

    try {
      const profile: OauthProfileInterface = await provider.exchangeCode(code);
      const result: OauthExchangePayloadInterface = await this.loginOrLink(
        payload,
        profile,
        context,
      );
      const exchangeCode: string = await this.storeExchange(result);

      return `${payload.redirect}?code=${exchangeCode}`;
    } catch (caught) {
      return this.redirectWithError(payload.redirect, caught);
    }
  }

  public async exchange(code: string): Promise<OauthExchangePayloadInterface> {
    const payload: OauthExchangePayloadInterface | null = await this.store.consumeExchange(code);

    if (!payload) throw new UnauthorizedError(OAUTH_EXCHANGE_CODE_INVALID);

    return payload;
  }

  // Reused by admin login-as (@modules/user) so impersonation tokens are
  // handed over exactly like an OAuth login — a one-time code redeemed
  // through the existing public /auth/oauth/exchange endpoint, never tokens
  // in a URL or a response body.
  public mintExchangeCode(tokens: TokenPairInterface): Promise<string> {
    return this.storeExchange({ kind: OauthExchangeKindEnum.LOGIN, tokens, linkedProvider: null });
  }

  private async storeExchange(payload: OauthExchangePayloadInterface): Promise<string> {
    const exchangeCode: string = randomBytes(32).toString('base64url');

    await this.store.setExchange(exchangeCode, payload, OAUTH_EXCHANGE_TTL_SEC);

    return exchangeCode;
  }

  private async loginOrLink(
    state: OauthStatePayloadInterface,
    profile: OauthProfileInterface,
    context: SessionContextInterface,
  ): Promise<OauthExchangePayloadInterface> {
    if (state.intent === OauthIntentEnum.LINK && state.userId) {
      return this.link(state.userId, state.provider, profile);
    }

    return this.login(state.provider, profile, context);
  }

  private async login(
    type: AuthMethodTypeEnum,
    profile: OauthProfileInterface,
    context: SessionContextInterface,
  ): Promise<OauthExchangePayloadInterface> {
    const method: AuthMethodInterface | null = await this.userService.findMethodByProviderAccount(
      type,
      profile.providerAccountId,
    );

    const user: UserInterface = method
      ? await this.loginExisting(method)
      : await this.registerFromProfile(type, profile);
    const tokens: TokenPairInterface = await this.sessionService.createSession(user, context);

    return { kind: OauthExchangeKindEnum.LOGIN, tokens, linkedProvider: null };
  }

  private async loginExisting(method: AuthMethodInterface): Promise<UserInterface> {
    const user: UserInterface = await this.userService.findByIdOrThrow(method.userId);

    if (user.status === UserStatusEnum.BLOCKED) throw new ForbiddenError(USER_BLOCKED);

    await this.userService.touchMethodLastUsed(method.id);

    return user;
  }

  private async registerFromProfile(
    type: AuthMethodTypeEnum,
    profile: OauthProfileInterface,
  ): Promise<UserInterface> {
    await this.assertNoVerifiedEmailCollision(profile, null);

    const user: UserInterface = await this.userService.createWithOauthMethod({
      displayName: profile.displayName,
      type,
      providerAccountId: profile.providerAccountId,
      email: profile.email,
      isEmailVerified: profile.emailVerified,
    });

    this.logger.log(`OAuth signup via ${type}: ${user.id}`);
    this.eventBus.emit(USER_OAUTH_REGISTERED_EVENT, {
      userId: user.id,
      avatarUrl: profile.avatarUrl,
    });

    return user;
  }

  private async link(
    userId: string,
    type: AuthMethodTypeEnum,
    profile: OauthProfileInterface,
  ): Promise<OauthExchangePayloadInterface> {
    const existingMethod: AuthMethodInterface | null =
      await this.userService.findMethodByProviderAccount(type, profile.providerAccountId);

    if (existingMethod && existingMethod.userId !== userId) {
      throw new ConflictError(AUTH_METHOD_LINKED_ELSEWHERE);
    }

    const ownMethods: UserWithMethodTypesInterface | null = profile.email
      ? await this.assertNoVerifiedEmailCollision(profile, userId)
      : null;

    if (
      ownMethods?.methodTypes.includes(type) ||
      (existingMethod && existingMethod.userId === userId)
    ) {
      throw new ConflictError(AUTH_METHOD_ALREADY_LINKED);
    }

    await this.userService.addOauthMethod(userId, {
      type,
      providerAccountId: profile.providerAccountId,
      email: profile.email,
      isEmailVerified: profile.emailVerified,
    });

    this.eventBus.emit(AUTH_METHOD_LINKED_EVENT, { userId, type });

    return { kind: OauthExchangeKindEnum.LINK, tokens: null, linkedProvider: type };
  }

  // Unverified provider emails never participate in matching — an attacker must
  // not claim an account by asserting an unverified address.
  private async assertNoVerifiedEmailCollision(
    profile: OauthProfileInterface,
    selfUserId: string | null,
  ): Promise<UserWithMethodTypesInterface | null> {
    if (!profile.email || !profile.emailVerified) return null;

    const owner: UserWithMethodTypesInterface | null = await this.userService.findByAuthEmail(
      profile.email,
    );

    if (owner && owner.id !== selfUserId) {
      throw new ConflictError({
        ...AUTH_EMAIL_LINKED_TO_OTHER_ACCOUNT,
        meta: { providers: owner.methodTypes },
      });
    }

    return owner;
  }

  private providerOrThrow(type: AuthMethodTypeEnum): OauthProviderInterface {
    const provider: OauthProviderInterface | null = this.registry.get(type);

    if (!provider) throw new ValidationError(OAUTH_PROVIDER_NOT_ENABLED);

    return provider;
  }

  private async requireUserId(authorizationHeader: string | undefined): Promise<string> {
    if (!authorizationHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError(OAUTH_STATE_INVALID);
    }

    const user = await this.tokenService.verifyAccessToken(
      authorizationHeader.slice('Bearer '.length),
    );

    return user.id;
  }

  private redirectWithError(redirect: string, caught: unknown): string {
    if (caught instanceof ConflictError || caught instanceof ForbiddenError) {
      this.logger.warn(`OAuth flow rejected: ${caught.args.code}`);

      return `${redirect}?error=${caught.args.code}`;
    }

    throw caught;
  }
}
