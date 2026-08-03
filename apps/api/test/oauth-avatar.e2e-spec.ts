import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { OauthProfileInterface } from '@modules/oauth/interfaces/oauth-profile.interface.js';
import type { OauthProviderInterface } from '@modules/oauth/interfaces/oauth-provider.interface.js';
import { OauthProviderRegistryService } from '@modules/oauth/services/oauth-provider-registry.service.js';
import type { UserWithMethodTypesInterface } from '@modules/user/interfaces/user-with-method-types.interface.js';
import { UserService } from '@modules/user/services/user.service.js';
import { AuthMethodTypeEnum } from '@nest-aws-starter/shared';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';
import { ensureBucket } from './helpers/ensure-bucket.helper.js';

const redirect = 'http://localhost:5173/auth/callback';
const PNG_BYTES: Buffer = Buffer.from(
  '89504e470d0a1a0a0000000d494844520000000100000001080600000000000000',
  'hex',
);

const fakeProvider: OauthProviderInterface = {
  type: AuthMethodTypeEnum.GOOGLE,
  buildConsentUrl: (state: string): string => `https://fake.provider/consent?state=${state}`,
  exchangeCode: async (code: string): Promise<OauthProfileInterface> =>
    JSON.parse(Buffer.from(code, 'base64url').toString()),
};

describe('oauth avatar sync', () => {
  let app: NestFastifyApplication;
  let avatarServer: Server;
  let avatarBaseUrl: string;

  beforeAll(async () => {
    await ensureBucket();
    app = await createTestApp();
    app.get(OauthProviderRegistryService).register(fakeProvider);

    avatarServer = createServer((incoming, response) => {
      if (incoming.url?.endsWith('/nope.exe')) {
        response.writeHead(200, { 'content-type': 'application/octet-stream' });
        response.end(Buffer.from('MZ'));

        return;
      }

      response.writeHead(200, { 'content-type': 'image/png' });
      response.end(PNG_BYTES);
    });
    await new Promise<void>((resolve) => avatarServer.listen(0, '127.0.0.1', resolve));
    avatarBaseUrl = `http://127.0.0.1:${(avatarServer.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      avatarServer.close(() => resolve());
    });
    await app.close();
  });

  function uniqueIp(): string {
    return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  function encodeProfile(profile: Partial<OauthProfileInterface>): string {
    const full: OauthProfileInterface = {
      providerAccountId: `acc-${randomUUID()}`,
      email: `avatar-${randomUUID()}@example.com`,
      emailVerified: true,
      displayName: 'Avatar E2E',
      avatarUrl: null,
      ...profile,
    };

    return Buffer.from(JSON.stringify(full)).toString('base64url');
  }

  async function loginViaOauth(profile: Partial<OauthProfileInterface>): Promise<void> {
    const startResponse = await request(app.getHttpServer())
      .get(`/api/v1/auth/oauth/google/start?intent=login&redirect=${encodeURIComponent(redirect)}`)
      .set('x-forwarded-for', uniqueIp())
      .expect(302);
    const state: string =
      new URL(startResponse.headers.location ?? '').searchParams.get('state') ?? '';

    await request(app.getHttpServer())
      .get(`/api/v1/auth/oauth/google/callback?state=${state}&code=${encodeProfile(profile)}`)
      .set('x-forwarded-for', uniqueIp())
      .expect(302);
  }

  async function waitForAvatar(email: string): Promise<string | null> {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const found: UserWithMethodTypesInterface | null = await app
        .get(UserService)
        .findByAuthEmail(email);

      if (found?.avatarKey) return found.avatarKey;

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    return null;
  }

  it('downloads the provider avatar into s3 and stores the key', async () => {
    const email: string = `avatar-ok-${randomUUID()}@example.com`;

    await loginViaOauth({ email, avatarUrl: `${avatarBaseUrl}/pic.png` });

    const found = await app.get(UserService).findByAuthEmail(email);
    const avatarKey: string | null = await waitForAvatar(email);

    expect(avatarKey).toBe(`avatars/${found?.id}`);
  });

  it('leaves the profile untouched when the avatar is not an allowed image', async () => {
    const email: string = `avatar-bad-${randomUUID()}@example.com`;

    await loginViaOauth({ email, avatarUrl: `${avatarBaseUrl}/nope.exe` });

    // signup itself must succeed; the avatar stays empty
    await new Promise((resolve) => setTimeout(resolve, 1_000));

    const found = await app.get(UserService).findByAuthEmail(email);

    expect(found?.methodTypes).toEqual([AuthMethodTypeEnum.GOOGLE]);
    expect(found?.avatarKey).toBeNull();
  });
});
