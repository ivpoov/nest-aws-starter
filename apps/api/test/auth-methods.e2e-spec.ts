import { randomUUID } from 'node:crypto';
import type { OauthProfileInterface } from '@modules/oauth/interfaces/oauth-profile.interface.js';
import type { OauthProviderInterface } from '@modules/oauth/interfaces/oauth-provider.interface.js';
import { OauthProviderRegistryService } from '@modules/oauth/services/oauth-provider-registry.service.js';
import { UserService } from '@modules/user/services/user.service.js';
import { AuthMethodTypeEnum } from '@nest-aws-starter/shared';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { REDIS_CLIENT } from '@providers/redis/constants/redis.constants.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';
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
    displayName: 'Methods E2E',
    avatarUrl: null,
    ...profile,
  };

  return Buffer.from(JSON.stringify(full)).toString('base64url');
}

describe('auth method linking', () => {
  let app: NestFastifyApplication;
  let redis: RedisClientType;

  beforeAll(async () => {
    app = await createTestApp();
    app.get(OauthProviderRegistryService).register(fakeProvider);
    redis = app.get<RedisClientType>(REDIS_CLIENT);
  });

  afterAll(async () => {
    await app.close();
  });

  function uniqueIp(): string {
    return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  async function registerEmailUser(): Promise<{ email: string; accessToken: string }> {
    const email: string = `methods-e2e-${randomUUID()}@example.com`;
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', uniqueIp())
      .send({ displayName: 'Methods E2E', email, password: 'correct-horse-battery' })
      .expect(201);

    return { email, accessToken: response.body.accessToken };
  }

  async function linkGoogle(accessToken: string): Promise<void> {
    const startResponse = await request(app.getHttpServer())
      .get(`/api/v1/auth/oauth/google/start?intent=link&redirect=${encodeURIComponent(redirect)}`)
      .set('x-forwarded-for', uniqueIp())
      .set('authorization', `Bearer ${accessToken}`)
      .expect(302);
    const state: string =
      new URL(startResponse.headers.location ?? '').searchParams.get('state') ?? '';

    const callbackResponse = await request(app.getHttpServer())
      .get(`/api/v1/auth/oauth/google/callback?state=${state}&code=${encodeProfile({})}`)
      .set('x-forwarded-for', uniqueIp())
      .expect(302);
    const exchangeCode: string =
      new URL(callbackResponse.headers.location ?? '').searchParams.get('code') ?? '';

    await request(app.getHttpServer())
      .post('/api/v1/auth/oauth/exchange')
      .send({ code: exchangeCode })
      .expect(200);
  }

  async function loginViaOauth(
    profile: Partial<OauthProfileInterface>,
  ): Promise<{ accessToken: string }> {
    const startResponse = await request(app.getHttpServer())
      .get(`/api/v1/auth/oauth/google/start?intent=login&redirect=${encodeURIComponent(redirect)}`)
      .set('x-forwarded-for', uniqueIp())
      .expect(302);
    const state: string =
      new URL(startResponse.headers.location ?? '').searchParams.get('state') ?? '';
    const callbackResponse = await request(app.getHttpServer())
      .get(`/api/v1/auth/oauth/google/callback?state=${state}&code=${encodeProfile(profile)}`)
      .set('x-forwarded-for', uniqueIp())
      .expect(302);
    const exchangeCode: string =
      new URL(callbackResponse.headers.location ?? '').searchParams.get('code') ?? '';
    const exchange = await request(app.getHttpServer())
      .post('/api/v1/auth/oauth/exchange')
      .send({ code: exchangeCode })
      .expect(200);

    return { accessToken: exchange.body.tokens.accessToken };
  }

  it('requires authentication', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/methods').expect(401);
  });

  it('lists linked methods without leaking secrets', async () => {
    const { email, accessToken } = await registerEmailUser();
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/methods')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.methods).toHaveLength(1);
    expect(response.body.methods[0].type).toBe('EMAIL');
    expect(response.body.methods[0].email).toBe(email);
    expect(response.body.methods[0].passwordHash).toBeUndefined();
    expect(response.body.methods[0].userId).toBeUndefined();
  });

  it('guards the last remaining method', async () => {
    const { accessToken } = await registerEmailUser();
    const response = await request(app.getHttpServer())
      .delete('/api/v1/auth/methods/EMAIL')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(409);

    expect(response.body.code).toBe('AUTH_LAST_METHOD');
  });

  it('unlinks a provider and refuses a second unlink', async () => {
    const { accessToken } = await registerEmailUser();

    await linkGoogle(accessToken);

    const listed = await request(app.getHttpServer())
      .get('/api/v1/auth/methods')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(
      listed.body.methods.map((method: { type: string }): string => method.type).sort(),
    ).toEqual(['EMAIL', 'GOOGLE']);

    await request(app.getHttpServer())
      .delete('/api/v1/auth/methods/GOOGLE')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(204);

    const replay = await request(app.getHttpServer())
      .delete('/api/v1/auth/methods/GOOGLE')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(404);

    expect(replay.body.code).toBe('AUTH_METHOD_NOT_FOUND');
  });

  it('rejects an unknown method type', async () => {
    const { accessToken } = await registerEmailUser();

    await request(app.getHttpServer())
      .delete('/api/v1/auth/methods/CARRIER_PIGEON')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('adds an email method to an oauth-only account and starts verification', async () => {
    const oauthEmail: string = `oauth-own-${randomUUID()}@example.com`;
    const { accessToken } = await loginViaOauth({ email: oauthEmail });

    // the same address the provider asserted — the expected add-password flow
    await request(app.getHttpServer())
      .post('/api/v1/auth/methods/email')
      .set('x-forwarded-for', uniqueIp())
      .set('authorization', `Bearer ${accessToken}`)
      .send({ email: oauthEmail, password: 'correct-horse-battery' })
      .expect(204);

    const found = await app.get(UserService).findByAuthEmail(oauthEmail);
    const token: string | null = await redis.get(`users:${found?.id}:verify-email`);

    expect(found?.methodTypes.sort()).toEqual(['EMAIL', 'GOOGLE']);
    expect(token).toBeTruthy();

    const replay = await request(app.getHttpServer())
      .post('/api/v1/auth/methods/email')
      .set('x-forwarded-for', uniqueIp())
      .set('authorization', `Bearer ${accessToken}`)
      .send({ email: `other-${randomUUID()}@example.com`, password: 'correct-horse-battery' })
      .expect(409);

    expect(replay.body.code).toBe('AUTH_METHOD_ALREADY_LINKED');
  });

  it('rejects adding an email that signs in another account', async () => {
    const { email } = await registerEmailUser();
    const { accessToken } = await loginViaOauth({});

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/methods/email')
      .set('x-forwarded-for', uniqueIp())
      .set('authorization', `Bearer ${accessToken}`)
      .send({ email, password: 'correct-horse-battery' })
      .expect(409);

    expect(response.body.code).toBe('AUTH_EMAIL_LINKED_TO_OTHER_ACCOUNT');
    expect(response.body.meta.providers).toContain('EMAIL');
  });
});
