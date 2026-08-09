import type { WebAppConfig } from '@configs/web-app.config.js';
import { UnauthorizedError } from '@modules/common/errors/unauthorized.error.js';
import { ValidationError } from '@modules/common/errors/validation.error.js';
import { EventBusService } from '@modules/event/services/event-bus.service.js';
import { OauthIntentEnum } from '@modules/oauth/enums/oauth-intent.enum.js';
import type { OauthExchangePayloadInterface } from '@modules/oauth/interfaces/oauth-exchange-payload.interface.js';
import type { OauthProfileInterface } from '@modules/oauth/interfaces/oauth-profile.interface.js';
import type { OauthProviderInterface } from '@modules/oauth/interfaces/oauth-provider.interface.js';
import type { OauthStatePayloadInterface } from '@modules/oauth/interfaces/oauth-state-payload.interface.js';
import type { OauthStoreRepositoryInterface } from '@modules/oauth/interfaces/oauth-store-repository.interface.js';
import { OauthFlowService } from '@modules/oauth/services/oauth-flow.service.js';
import { OauthProviderRegistryService } from '@modules/oauth/services/oauth-provider-registry.service.js';
import type { SessionService } from '@modules/session/services/session.service.js';
import type { TokenService } from '@modules/token/services/token.service.js';
import type { UserInterface } from '@modules/user/interfaces/user.interface.js';
import type { UserService } from '@modules/user/services/user.service.js';
import { AuthMethodTypeEnum, UserRoleEnum, UserStatusEnum } from '@nest-aws-starter/shared';
import { describe, expect, it, vi } from 'vitest';

const webApp: WebAppConfig = { baseUrl: 'http://localhost:5173' };
const redirect = 'http://localhost:5173/auth/callback';

const user: UserInterface = {
  id: 'user-1',
  displayName: 'Igor',
  role: UserRoleEnum.USER,
  status: UserStatusEnum.ACTIVE,
  avatarKey: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const profile: OauthProfileInterface = {
  providerAccountId: 'google-123',
  email: 'igor@example.com',
  emailVerified: true,
  displayName: 'Igor',
  avatarUrl: null,
};

class FakeStore implements OauthStoreRepositoryInterface {
  public readonly states: Map<string, OauthStatePayloadInterface> = new Map();
  public readonly exchanges: Map<string, OauthExchangePayloadInterface> = new Map();

  public async setState(state: string, payload: OauthStatePayloadInterface): Promise<void> {
    this.states.set(state, payload);
  }

  public async consumeState(state: string): Promise<OauthStatePayloadInterface | null> {
    const payload: OauthStatePayloadInterface | null = this.states.get(state) ?? null;

    this.states.delete(state);

    return payload;
  }

  public async setExchange(code: string, payload: OauthExchangePayloadInterface): Promise<void> {
    this.exchanges.set(code, payload);
  }

  public async consumeExchange(code: string): Promise<OauthExchangePayloadInterface | null> {
    const payload: OauthExchangePayloadInterface | null = this.exchanges.get(code) ?? null;

    this.exchanges.delete(code);

    return payload;
  }
}

const fakeProvider: OauthProviderInterface = {
  type: AuthMethodTypeEnum.GOOGLE,
  buildConsentUrl: (state: string): string => `https://fake.provider/consent?state=${state}`,
  exchangeCode: async (code: string): Promise<OauthProfileInterface> =>
    JSON.parse(Buffer.from(code, 'base64url').toString()),
};

function encodeProfile(overrides: Partial<OauthProfileInterface> = {}): string {
  return Buffer.from(JSON.stringify({ ...profile, ...overrides })).toString('base64url');
}

interface TestSetupInterface {
  readonly service: OauthFlowService;
  readonly store: FakeStore;
  readonly users: {
    findMethodByProviderAccount: ReturnType<typeof vi.fn>;
    findByAuthEmail: ReturnType<typeof vi.fn>;
    findByIdOrThrow: ReturnType<typeof vi.fn>;
    createWithOauthMethod: ReturnType<typeof vi.fn>;
    addOauthMethod: ReturnType<typeof vi.fn>;
    touchMethodLastUsed: ReturnType<typeof vi.fn>;
  };
}

function createService(): TestSetupInterface {
  const store: FakeStore = new FakeStore();
  const registry: OauthProviderRegistryService = new OauthProviderRegistryService();

  registry.register(fakeProvider);

  const users = {
    findMethodByProviderAccount: vi.fn().mockResolvedValue(null),
    findByAuthEmail: vi.fn().mockResolvedValue(null),
    findByIdOrThrow: vi.fn().mockResolvedValue(user),
    createWithOauthMethod: vi.fn().mockResolvedValue(user),
    addOauthMethod: vi.fn().mockResolvedValue(undefined),
    touchMethodLastUsed: vi.fn().mockResolvedValue(undefined),
  };
  const sessions = {
    createSession: vi
      .fn()
      .mockResolvedValue({ accessToken: 'a', refreshToken: 'r', expiresInSec: 900 }),
  } as unknown as SessionService;
  const eventBus = { emit: vi.fn() };
  const tokens = {
    verifyAccessToken: vi
      .fn()
      .mockResolvedValue({ id: 'linker-1', role: UserRoleEnum.USER, sessionId: 's' }),
  } as unknown as TokenService;
  const service: OauthFlowService = new OauthFlowService(
    webApp,
    store,
    registry,
    tokens,
    users as unknown as UserService,
    sessions,
    eventBus as unknown as EventBusService,
  );

  return { service, store, users };
}

const context = { userAgent: null, ip: '127.0.0.1' };

async function runCallback(
  setup: TestSetupInterface,
  intent: OauthIntentEnum,
  code: string,
): Promise<string> {
  const consentUrl: string = await setup.service.start(
    AuthMethodTypeEnum.GOOGLE,
    intent,
    redirect,
    intent === OauthIntentEnum.LINK ? 'Bearer linker-token' : undefined,
  );
  const state: string = new URL(consentUrl).searchParams.get('state') ?? '';

  return setup.service.handleCallback(AuthMethodTypeEnum.GOOGLE, state, code, context);
}

describe('OauthFlowService login matrix', () => {
  it('logs in an existing method and touches lastUsedAt', async () => {
    const setup: TestSetupInterface = createService();

    setup.users.findMethodByProviderAccount.mockResolvedValue({
      id: 'method-1',
      userId: user.id,
    });

    const url: string = await runCallback(setup, OauthIntentEnum.LOGIN, encodeProfile());

    expect(url).toMatch(/\?code=/);
    expect(setup.users.touchMethodLastUsed).toHaveBeenCalledWith('method-1');
    expect(setup.users.createWithOauthMethod).not.toHaveBeenCalled();
  });

  it('rejects login when a verified provider email belongs to another account', async () => {
    const setup: TestSetupInterface = createService();

    setup.users.findByAuthEmail.mockResolvedValue({
      ...user,
      id: 'other-user',
      methodTypes: [AuthMethodTypeEnum.EMAIL],
    });

    const url: string = await runCallback(setup, OauthIntentEnum.LOGIN, encodeProfile());

    expect(url).toBe(`${redirect}?error=AUTH_EMAIL_LINKED_TO_OTHER_ACCOUNT`);
    expect(setup.users.createWithOauthMethod).not.toHaveBeenCalled();
  });

  it('ignores unverified provider emails when matching accounts', async () => {
    const setup: TestSetupInterface = createService();

    setup.users.findByAuthEmail.mockResolvedValue({
      ...user,
      id: 'other-user',
      methodTypes: [AuthMethodTypeEnum.EMAIL],
    });

    const url: string = await runCallback(
      setup,
      OauthIntentEnum.LOGIN,
      encodeProfile({ emailVerified: false }),
    );

    expect(url).toMatch(/\?code=/);
    expect(setup.users.createWithOauthMethod).toHaveBeenCalledOnce();
    expect(setup.users.findByAuthEmail).not.toHaveBeenCalled();
  });

  it('creates a user on first oauth login without collisions', async () => {
    const setup: TestSetupInterface = createService();

    const url: string = await runCallback(setup, OauthIntentEnum.LOGIN, encodeProfile());
    const code: string = new URL(url).searchParams.get('code') ?? '';
    const payload = await setup.service.exchange(code);

    expect(payload.kind).toBe('LOGIN');
    expect(payload.tokens?.accessToken).toBe('a');
  });
});

describe('OauthFlowService link matrix', () => {
  it('rejects linking a provider account already owned by another user', async () => {
    const setup: TestSetupInterface = createService();

    setup.users.findMethodByProviderAccount.mockResolvedValue({
      id: 'method-x',
      userId: 'someone-else',
    });

    const url: string = await runCallback(setup, OauthIntentEnum.LINK, encodeProfile());

    expect(url).toBe(`${redirect}?error=AUTH_METHOD_LINKED_ELSEWHERE`);
  });

  it('rejects linking when the verified email belongs to another account', async () => {
    const setup: TestSetupInterface = createService();

    setup.users.findByAuthEmail.mockResolvedValue({
      ...user,
      id: 'other-user',
      methodTypes: [AuthMethodTypeEnum.EMAIL],
    });

    const url: string = await runCallback(setup, OauthIntentEnum.LINK, encodeProfile());

    expect(url).toBe(`${redirect}?error=AUTH_EMAIL_LINKED_TO_OTHER_ACCOUNT`);
  });

  it('rejects linking a second method of the same type', async () => {
    const setup: TestSetupInterface = createService();

    setup.users.findByAuthEmail.mockResolvedValue({
      ...user,
      id: 'linker-1',
      methodTypes: [AuthMethodTypeEnum.EMAIL, AuthMethodTypeEnum.GOOGLE],
    });

    const url: string = await runCallback(setup, OauthIntentEnum.LINK, encodeProfile());

    expect(url).toBe(`${redirect}?error=AUTH_METHOD_ALREADY_LINKED`);
  });

  it('links happily and returns a LINK exchange payload', async () => {
    const setup: TestSetupInterface = createService();

    const url: string = await runCallback(setup, OauthIntentEnum.LINK, encodeProfile());
    const code: string = new URL(url).searchParams.get('code') ?? '';
    const payload = await setup.service.exchange(code);

    expect(payload.kind).toBe('LINK');
    expect(payload.linkedProvider).toBe(AuthMethodTypeEnum.GOOGLE);
    expect(setup.users.addOauthMethod).toHaveBeenCalledWith('linker-1', {
      type: AuthMethodTypeEnum.GOOGLE,
      providerAccountId: profile.providerAccountId,
      email: profile.email,
      isEmailVerified: true,
    });
  });
});

describe('OauthFlowService redirect allowlist', () => {
  // Every one of these passes `redirect.startsWith(webApp.baseUrl)` except the
  // last two, and each resolves to a host the web app does not control. The
  // exchange code in the callback redirect is a bearer credential for the
  // victim's session, so a redirect the origin comparison lets through is a
  // full account takeover with no password involved.
  it.each([
    ['a host that only suffixes the allowed origin', 'http://localhost:5173.evil.tld/cb'],
    ['a port that only prefix-matches the allowed port', 'http://localhost:51730/auth/callback'],
    ['userinfo that mimics the allowed origin', 'http://localhost:5173@evil.tld/cb'],
    ['a scheme swap of the allowed origin', 'https://localhost:5173/auth/callback'],
    ['an allowed origin with an unlisted path', 'http://localhost:5173/settings/methods'],
    ['a wholly different origin', 'https://evil.example/cb'],
    ['a protocol-relative target', '//evil.example/cb'],
    ['a relative target', '/auth/callback'],
  ])('rejects %s', async (_label: string, target: string) => {
    const { service } = createService();

    await expect(
      service.start(AuthMethodTypeEnum.GOOGLE, OauthIntentEnum.LOGIN, target, undefined),
    ).rejects.toSatisfy(
      (caught: unknown): boolean =>
        caught instanceof ValidationError && caught.args.code === 'OAUTH_REDIRECT_NOT_ALLOWED',
    );
  });

  it('stores the canonical origin + path, dropping any smuggled query or fragment', async () => {
    const setup: TestSetupInterface = createService();

    await setup.service.start(
      AuthMethodTypeEnum.GOOGLE,
      OauthIntentEnum.LOGIN,
      `${redirect}?next=https://evil.example#frag`,
      undefined,
    );

    const stored: OauthStatePayloadInterface | undefined = [...setup.store.states.values()][0];

    expect(stored?.redirect).toBe(redirect);
  });
});

describe('OauthFlowService plumbing', () => {
  it('rejects unknown providers', async () => {
    const { service } = createService();

    await expect(
      service.start(AuthMethodTypeEnum.DISCORD, OauthIntentEnum.LOGIN, redirect, undefined),
    ).rejects.toSatisfy(
      (caught: unknown): boolean =>
        caught instanceof ValidationError && caught.args.code === 'OAUTH_PROVIDER_NOT_ENABLED',
    );
  });

  it('consumes states single-use', async () => {
    const setup: TestSetupInterface = createService();
    const consentUrl: string = await setup.service.start(
      AuthMethodTypeEnum.GOOGLE,
      OauthIntentEnum.LOGIN,
      redirect,
      undefined,
    );
    const state: string = new URL(consentUrl).searchParams.get('state') ?? '';

    await setup.service.handleCallback(AuthMethodTypeEnum.GOOGLE, state, encodeProfile(), context);

    await expect(
      setup.service.handleCallback(AuthMethodTypeEnum.GOOGLE, state, encodeProfile(), context),
    ).rejects.toSatisfy(
      (caught: unknown): boolean =>
        caught instanceof ValidationError && caught.args.code === 'OAUTH_STATE_INVALID',
    );
  });

  it('consumes exchange codes single-use', async () => {
    const setup: TestSetupInterface = createService();
    const url: string = await runCallback(setup, OauthIntentEnum.LOGIN, encodeProfile());
    const code: string = new URL(url).searchParams.get('code') ?? '';

    await setup.service.exchange(code);

    await expect(setup.service.exchange(code)).rejects.toSatisfy(
      (caught: unknown): boolean =>
        caught instanceof UnauthorizedError && caught.args.code === 'OAUTH_EXCHANGE_CODE_INVALID',
    );
  });

  it('mints a redeemable LOGIN exchange code for admin login-as tokens', async () => {
    const setup: TestSetupInterface = createService();
    const tokens = { accessToken: 'imp-a', refreshToken: 'imp-r', expiresInSec: 900 };

    const code: string = await setup.service.mintExchangeCode(tokens);
    const payload = await setup.service.exchange(code);

    expect(payload).toEqual({ kind: 'LOGIN', tokens, linkedProvider: null });
  });
});
