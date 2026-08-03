import { randomUUID } from 'node:crypto';
import { UserService } from '@modules/user/services/user.service.js';
import { AuthMethodTypeEnum, UserRoleEnum, UserStatusEnum } from '@nest-aws-starter/shared';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';

describe('user module (integration)', () => {
  let app: NestFastifyApplication;
  let users: UserService;

  beforeAll(async () => {
    app = await createTestApp();
    users = app.get(UserService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a user with its email method atomically and finds it by auth email', async () => {
    const email: string = `e2e-${randomUUID()}@example.com`;

    const created = await users.createWithEmailMethod({
      displayName: 'E2E Email User',
      email,
      passwordHash: 'argon2-placeholder',
    });

    expect(created.role).toBe(UserRoleEnum.USER);
    expect(created.status).toBe(UserStatusEnum.ACTIVE);

    const found = await users.findByAuthEmail(email);

    expect(found?.id).toBe(created.id);
    expect(found?.methodTypes).toEqual([AuthMethodTypeEnum.EMAIL]);
  });

  it('creates an oauth-born user and reports its method types', async () => {
    const email: string = `e2e-${randomUUID()}@example.com`;

    const created = await users.createWithOauthMethod({
      displayName: 'E2E Google User',
      type: AuthMethodTypeEnum.GOOGLE,
      providerAccountId: `google-${randomUUID()}`,
      email,
      isEmailVerified: true,
    });

    const found = await users.findByAuthEmail(email);

    expect(found?.id).toBe(created.id);
    expect(found?.methodTypes).toEqual([AuthMethodTypeEnum.GOOGLE]);
  });

  it('returns null for an unknown auth email', async () => {
    expect(await users.findByAuthEmail(`nobody-${randomUUID()}@example.com`)).toBeNull();
  });

  it('updates the profile of an existing user', async () => {
    const created = await users.createWithEmailMethod({
      displayName: 'Before',
      email: `e2e-${randomUUID()}@example.com`,
      passwordHash: 'argon2-placeholder',
    });

    const updated = await users.updateProfile(created.id, { displayName: 'After' });

    expect(updated.displayName).toBe('After');
  });
});
