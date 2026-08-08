import { randomUUID } from 'node:crypto';
import { CurrentUserId } from '@decorators/current-user-id.decorator.js';
import { configureApp } from '@helpers/configure-app.helper.js';
import { RequiresSubscription } from '@modules/payment/decorators/requires-subscription.decorator.js';
import { RequiresSubscriptionGuard } from '@modules/payment/guards/requires-subscription.guard.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { Controller, Get, Module, UseGuards } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from '@src/app.module.js';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// This starter never gates a real route with @RequiresSubscription — the
// guard/decorator pair is a demo for starter users to protect their own
// premium endpoints. This test-only controller (never registered in
// AppModule) is the one place that proves the guard end to end: 403 without
// an active subscription, 200 with one.
@Controller('test-only/premium-note')
class PremiumDemoController {
  @UseGuards(RequiresSubscriptionGuard)
  @RequiresSubscription()
  @Get()
  public get(@CurrentUserId() userId: string): { userId: string } {
    return { userId };
  }
}

@Module({ controllers: [PremiumDemoController] })
class SubscriptionAccessDemoModule {}

// Mirrors app.factory.ts's createTestApp, plus the demo module above —
// global guards/pipes/filters set on the app instance apply uniformly to
// every controller regardless of which imported module contributed it, so
// the demo route still runs through the real JwtAuthGuard.
async function createDemoTestApp(): Promise<NestFastifyApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule, SubscriptionAccessDemoModule],
  }).compile();

  const app: NestFastifyApplication = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ trustProxy: process.env.TRUST_PROXY === 'true' }),
  );

  await configureApp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return app;
}

describe('RequiresSubscription guard (demo-only test route)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let userToken: string;
  let userId: string;

  beforeAll(async () => {
    app = await createDemoTestApp();
    prisma = app.get(PrismaService);

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', uniqueIp())
      .send({
        displayName: 'Access E2E',
        email: `access-e2e-${randomUUID()}@example.com`,
        password: 'correct-horse-battery',
      })
      .expect(201);

    userToken = registerResponse.body.accessToken;

    const meResponse = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('authorization', `Bearer ${userToken}`)
      .expect(200);

    userId = meResponse.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  function uniqueIp(): string {
    return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  it('rejects an unauthenticated request', async () => {
    await request(app.getHttpServer()).get('/api/v1/test-only/premium-note').expect(401);
  });

  it('returns the coded 403 envelope without an active subscription', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/test-only/premium-note')
      .set('authorization', `Bearer ${userToken}`)
      .expect(403);

    expect(response.body.code).toBe('PAYMENT_SUBSCRIPTION_REQUIRED');
  });

  it('returns 200 once the user has an active subscription', async () => {
    const plan = await prisma.plan.create({
      data: {
        name: `Pro ${randomUUID()}`,
        amountCents: 1900,
        currency: 'USD',
        intervalDays: 30,
        providerRefs: {},
      },
    });

    await prisma.subscription.create({
      data: {
        userId,
        planId: plan.id,
        status: 'ACTIVE',
        provider: 'STRIPE',
        providerRef: `sub_access_${randomUUID()}`,
        currentPeriodEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/test-only/premium-note')
      .set('authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(response.body.userId).toBe(userId);
  });
});
