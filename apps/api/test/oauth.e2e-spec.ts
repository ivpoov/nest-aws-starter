import { randomUUID } from 'node:crypto';
import type { OauthProfileInterface } from '@modules/oauth/interfaces/oauth-profile.interface.js';
import type { OauthProviderInterface } from '@modules/oauth/interfaces/oauth-provider.interface.js';
import { OauthProviderRegistryService } from '@modules/oauth/services/oauth-provider-registry.service.js';
import { UserService } from '@modules/user/services/user.service.js';
import { AuthMethodTypeEnum } from '@nest-aws-starter/shared';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';

const redirect = 'http://localhost:5173/auth/callback';

const fakeProvider: OauthProviderInterface = {
  type: AuthMethodTypeEnum.GOOGLE,
  buildConsentUrl: (state: string): string => `https://fake.provider/consent?state=${state}`,
  exchangeCode: async (code: string): Promise<OauthProfileInterface> =>
    JSON.parse(Buffer.from(code, 'base64url').toString()),
};

function encodeProfile(profile: Partial<OauthProfileInterface>): string {
  const full: OauthProfileInterface = {
    providerAccountId: `acc-${randomUUID()}`,
    email: `oauth-${randomUUID()}@example.com`,
    emailVerified: true,
    displayName: 'OAuth E2E',
    avatarUrl: null,
    ...profile,
  };

  return Buffer.from(JSON.stringify(full)).toString('base64url');
}

describe('oauth flow (fake provider)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createTestApp();
    app.get(OauthProviderRegistryService).register(fakeProvider);
  });

  afterAll(async () => {
    await app.close();
  });

  function uniqueIp(): string {
    return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  async function startAndCallback(code: string, bearer?: string): Promise<string> {
    const intent: string = bearer ? 'link' : 'login';
    const startRequest = request(app.getHttpServer())
      .get(
        `/api/v1/auth/oauth/google/start?intent=${intent}&redirect=${encodeURIComponent(redirect)}`,
      )
      .set('x-forwarded-for', uniqueIp());

    if (bearer) void startRequest.set('authorization', `Bearer ${bearer}`);

    const startResponse = await startRequest.expect(302);
    const state: string =
      new URL(startResponse.headers.location ?? '').searchParams.get('state') ?? '';

    const callbackResponse = await request(app.getHttpServer())
      .get(`/api/v1/auth/oauth/google/callback?state=${state}&code=${code}`)
      .set('x-forwarded-for', uniqueIp())
      .expect(302);

    return callbackResponse.headers.location ?? '';
  }

  it('lists the registered provider', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/auth/providers').expect(200);

    expect(response.body.providers).toContain('GOOGLE');
  });

  it('runs the full login flow: start, callback, exchange, authenticated request', async () => {
    const location: string = await startAndCallback(encodeProfile({}));

    expect(location.startsWith(`${redirect}?code=`)).toBe(true);

    const exchangeCode: string = new URL(location).searchParams.get('code') ?? '';
    const exchange = await request(app.getHttpServer())
      .post('/api/v1/auth/oauth/exchange')
      .send({ code: exchangeCode })
      .expect(200);

    expect(exchange.body.kind).toBe('LOGIN');
    expect(exchange.body.tokens.accessToken).toMatch(/^eyJ/);

    await request(app.getHttpServer())
      .get('/api/v1/sessions')
      .set('authorization', `Bearer ${exchange.body.tokens.accessToken}`)
      .expect(200);

    // one-time exchange code burns on use
    await request(app.getHttpServer())
      .post('/api/v1/auth/oauth/exchange')
      .send({ code: exchangeCode })
      .expect(401);
  });

  it('redirects with the conflict code when the verified email is taken', async () => {
    const email: string = `oauth-conflict-${randomUUID()}@example.com`;

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', uniqueIp())
      .send({ displayName: 'Email First', email, password: 'correct-horse-battery' })
      .expect(201);

    const location: string = await startAndCallback(encodeProfile({ email }));

    expect(location).toBe(`${redirect}?error=AUTH_EMAIL_LINKED_TO_OTHER_ACCOUNT`);
  });

  it('links a provider to an authenticated account', async () => {
    const email: string = `oauth-link-${randomUUID()}@example.com`;
    const registered = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', uniqueIp())
      .send({ displayName: 'Linker', email, password: 'correct-horse-battery' })
      .expect(201);

    const location: string = await startAndCallback(
      encodeProfile({ email: `provider-side-${randomUUID()}@example.com` }),
      registered.body.accessToken,
    );
    const exchangeCode: string = new URL(location).searchParams.get('code') ?? '';
    const exchange = await request(app.getHttpServer())
      .post('/api/v1/auth/oauth/exchange')
      .send({ code: exchangeCode })
      .expect(200);

    expect(exchange.body.kind).toBe('LINK');
    expect(exchange.body.linkedProvider).toBe('GOOGLE');

    const found = await app.get(UserService).findByAuthEmail(email);

    expect(found?.methodTypes.sort()).toEqual(['EMAIL', 'GOOGLE']);
  });

  it('rejects a reused state', async () => {
    const startResponse = await request(app.getHttpServer())
      .get(`/api/v1/auth/oauth/google/start?intent=login&redirect=${encodeURIComponent(redirect)}`)
      .set('x-forwarded-for', uniqueIp())
      .expect(302);
    const state: string =
      new URL(startResponse.headers.location ?? '').searchParams.get('state') ?? '';

    await request(app.getHttpServer())
      .get(`/api/v1/auth/oauth/google/callback?state=${state}&code=${encodeProfile({})}`)
      .expect(302);

    const replay = await request(app.getHttpServer())
      .get(`/api/v1/auth/oauth/google/callback?state=${state}&code=${encodeProfile({})}`)
      .expect(400);

    expect(replay.body.code).toBe('OAUTH_STATE_INVALID');
  });

  // A redirect target that reaches a host the web app does not control walks
  // off with the one-time exchange code, and that code buys the victim's
  // access AND 30-day refresh token from the public /auth/oauth/exchange
  // endpoint. `startsWith(WEB_APP_BASE_URL)` let every row below through.
  //
  // The `.evil.tld` row is rejected one layer earlier than the rest: with the
  // suite's `WEB_APP_BASE_URL=http://localhost:5173` the suffix lands inside
  // the port, so the value is not a parsable URL at all and the DTO's @IsUrl
  // returns the generic BAD_REQUEST. With a portless base URL
  // (`https://app.example.com`) the same shape IS a valid URL — that case is
  // the `localhost:51730` row, which reaches the origin comparison.
  it.each([
    [
      'a host that only suffixes the allowed origin',
      'http://localhost:5173.evil.tld/cb',
      'BAD_REQUEST',
    ],
    [
      'a port that only prefix-matches the allowed port',
      'http://localhost:51730/auth/callback',
      'OAUTH_REDIRECT_NOT_ALLOWED',
    ],
    [
      'userinfo that mimics the allowed origin',
      'http://localhost:5173@evil.tld/cb',
      'OAUTH_REDIRECT_NOT_ALLOWED',
    ],
    [
      'an allowed origin with an unlisted path',
      'http://localhost:5173/settings/methods',
      'OAUTH_REDIRECT_NOT_ALLOWED',
    ],
    ['a wholly different origin', 'https://evil.example/cb', 'OAUTH_REDIRECT_NOT_ALLOWED'],
    ['a relative target', '/auth/callback', 'BAD_REQUEST'],
  ])('rejects %s as a redirect target', async (_label: string, target: string, code: string) => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/auth/oauth/google/start?intent=login&redirect=${encodeURIComponent(target)}`)
      .set('x-forwarded-for', uniqueIp())
      .expect(400);

    expect(response.body.code).toBe(code);
  });

  it('lands the exchange code only on the canonical allowed callback', async () => {
    const location: string = await startAndCallback(encodeProfile({}));

    expect(location.startsWith(`${redirect}?code=`)).toBe(true);
    expect(new URL(location).origin).toBe(new URL(redirect).origin);
  });
});
