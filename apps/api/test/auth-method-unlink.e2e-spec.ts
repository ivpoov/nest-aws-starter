import { randomUUID } from 'node:crypto';
import { MethodLinkingService } from '@modules/auth/services/method-linking.service.js';
import { ConflictError } from '@modules/common/errors/conflict.error.js';
import { NotFoundError } from '@modules/common/errors/not-found.error.js';
import type { AuthMethodInterface } from '@modules/user/interfaces/auth-method.interface.js';
import type { UserInterface } from '@modules/user/interfaces/user.interface.js';
import { UserService } from '@modules/user/services/user.service.js';
import { AuthMethodTypeEnum } from '@nest-aws-starter/shared';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';

// Both unlinks are issued without awaiting the first — a sequential pair would
// pass against the broken read-then-delete and prove nothing.
describe('auth method unlinking under concurrency', () => {
  let app: NestFastifyApplication;
  let linking: MethodLinkingService;
  let users: UserService;

  beforeAll(async () => {
    app = await createTestApp();
    linking = app.get(MethodLinkingService);
    users = app.get(UserService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createUserWithTwoMethods(): Promise<UserInterface> {
    const user: UserInterface = await users.createWithEmailMethod({
      displayName: 'Unlink E2E',
      email: `unlink-e2e-${randomUUID()}@example.com`,
      passwordHash: 'argon2-placeholder-never-verified-here',
    });

    await users.addOauthMethod(user.id, {
      type: AuthMethodTypeEnum.GOOGLE,
      providerAccountId: `acc-${randomUUID()}`,
      email: `unlink-oauth-${randomUUID()}@example.com`,
      isEmailVerified: true,
    });

    return user;
  }

  it('leaves an account reachable when both of its methods are unlinked at once', async () => {
    const user: UserInterface = await createUserWithTwoMethods();

    const settled: PromiseSettledResult<void>[] = await Promise.allSettled([
      linking.unlinkMethod(user.id, AuthMethodTypeEnum.EMAIL),
      linking.unlinkMethod(user.id, AuthMethodTypeEnum.GOOGLE),
    ]);
    const remaining: AuthMethodInterface[] = await users.findMethodsByUserId(user.id);

    // An account with zero auth methods is permanently unreachable — no login
    // path can ever recover it without direct database surgery.
    expect(remaining).toHaveLength(1);
    expect(
      settled.filter(
        (result: PromiseSettledResult<void>): boolean => result.status === 'fulfilled',
      ),
    ).toHaveLength(1);
  });

  it('reports the loser of the race as a last-method conflict', async () => {
    const user: UserInterface = await createUserWithTwoMethods();

    const settled: PromiseSettledResult<void>[] = await Promise.allSettled([
      linking.unlinkMethod(user.id, AuthMethodTypeEnum.EMAIL),
      linking.unlinkMethod(user.id, AuthMethodTypeEnum.GOOGLE),
    ]);
    const rejected: PromiseSettledResult<void>[] = settled.filter(
      (result: PromiseSettledResult<void>): boolean => result.status === 'rejected',
    );

    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);
    expect((rejected[0] as PromiseRejectedResult).reason.args.code).toBe('AUTH_LAST_METHOD');
  });

  it('holds under a wider stampede of concurrent unlinks', async () => {
    const user: UserInterface = await createUserWithTwoMethods();
    const attempts: Promise<void>[] = [
      AuthMethodTypeEnum.EMAIL,
      AuthMethodTypeEnum.GOOGLE,
      AuthMethodTypeEnum.EMAIL,
      AuthMethodTypeEnum.GOOGLE,
      AuthMethodTypeEnum.EMAIL,
      AuthMethodTypeEnum.GOOGLE,
    ].map((type: AuthMethodTypeEnum): Promise<void> => linking.unlinkMethod(user.id, type));

    await Promise.allSettled(attempts);
    const remaining: AuthMethodInterface[] = await users.findMethodsByUserId(user.id);

    expect(remaining).toHaveLength(1);
  });

  it('still refuses to unlink the only method of a single-method account', async () => {
    const user: UserInterface = await users.createWithEmailMethod({
      displayName: 'Unlink E2E',
      email: `unlink-solo-${randomUUID()}@example.com`,
      passwordHash: 'argon2-placeholder-never-verified-here',
    });

    await expect(linking.unlinkMethod(user.id, AuthMethodTypeEnum.EMAIL)).rejects.toBeInstanceOf(
      ConflictError,
    );
    await expect(users.findMethodsByUserId(user.id)).resolves.toHaveLength(1);
  });

  it('still reports an unlinked type as not found', async () => {
    const user: UserInterface = await createUserWithTwoMethods();

    await linking.unlinkMethod(user.id, AuthMethodTypeEnum.GOOGLE);

    await expect(linking.unlinkMethod(user.id, AuthMethodTypeEnum.GOOGLE)).rejects.toSatisfy(
      (caught: unknown): boolean =>
        caught instanceof NotFoundError && caught.args.code === 'AUTH_METHOD_NOT_FOUND',
    );
  });
});
