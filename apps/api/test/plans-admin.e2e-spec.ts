import { randomUUID } from 'node:crypto';
import type { PaymentProviderInterface } from '@modules/payment/interfaces/payment-provider.interface.js';
import type { PaymentProviderRefValidatorInterface } from '@modules/payment/interfaces/payment-provider-ref-validator.interface.js';
import { PaymentProviderRegistryService } from '@modules/payment/services/payment-provider-registry.service.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';

// STRIPE_ENABLED is false in the e2e env, so the real Stripe ref-validation
// path is never exercised here — a fake provider registered under the
// STRIPE name (the only key ProviderRefsDto whitelists today) that also
// implements PaymentProviderRefValidatorInterface stands in for it, proving
// the registry lookup + duck-typed validator + controller wiring end-to-end.
const fakeProvider: PaymentProviderInterface & PaymentProviderRefValidatorInterface = {
  name: 'STRIPE',
  createCheckoutSession: async () => {
    throw new Error('not exercised by this suite');
  },
  createPortalSession: async () => {
    throw new Error('not exercised by this suite');
  },
  verifyAndParseWebhook: async () => {
    throw new Error('not exercised by this suite');
  },
  validateProviderRef: async (ref: string): Promise<boolean> => ref === 'price_valid',
};

describe('admin plans', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let userToken: string;

  function uniqueIp(): string {
    return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  async function registerUser(
    displayName: string,
  ): Promise<{ email: string; accessToken: string }> {
    const email: string = `plans-admin-e2e-${randomUUID()}@example.com`;
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', uniqueIp())
      .send({ displayName, email, password: 'correct-horse-battery' })
      .expect(201);

    return { email, accessToken: response.body.accessToken };
  }

  function createPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      name: `Plan ${randomUUID()}`,
      description: 'A test plan',
      amountCents: 1500,
      currency: 'USD',
      intervalDays: 30,
      ...overrides,
    };
  }

  beforeAll(async () => {
    app = await createTestApp();
    app.get(PaymentProviderRegistryService).register(fakeProvider);
    prisma = app.get(PrismaService);

    const admin = await registerUser('Plans Admin E2E');
    const user = await registerUser('Plans User E2E');

    userToken = user.accessToken;

    await prisma.user.updateMany({
      where: { authMethods: { some: { email: admin.email } } },
      data: { role: 'ADMIN' },
    });

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-forwarded-for', uniqueIp())
      .send({ email: admin.email, password: 'correct-horse-battery' })
      .expect(200);

    adminToken = login.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated and non-admin callers', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/plans').expect(401);

    const forbidden = await request(app.getHttpServer())
      .get('/api/v1/admin/plans')
      .set('authorization', `Bearer ${userToken}`)
      .expect(403);

    expect(forbidden.body.code).toBe('CASL_FORBIDDEN');
  });

  it('creates a plan and returns it', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/plans')
      .set('authorization', `Bearer ${adminToken}`)
      .send(createPayload({ name: 'Create Test Plan' }))
      .expect(201);

    expect(response.body).toMatchObject({
      name: 'Create Test Plan',
      description: 'A test plan',
      amountCents: 1500,
      currency: 'USD',
      intervalDays: 30,
      providerRefs: {},
      isActive: true,
    });
    expect(response.body.id).toBeTruthy();
  });

  it('rejects an invalid currency code', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/plans')
      .set('authorization', `Bearer ${adminToken}`)
      .send(createPayload({ currency: 'usd' }))
      .expect(400);

    expect(response.body.statusCode).toBe(400);
  });

  it('rejects a non-positive amountCents', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/plans')
      .set('authorization', `Bearer ${adminToken}`)
      .send(createPayload({ amountCents: -100 }))
      .expect(400);
  });

  it('rejects a plan whose provider ref does not validate', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/plans')
      .set('authorization', `Bearer ${adminToken}`)
      .send(createPayload({ providerRefs: { STRIPE: 'price_bad' } }))
      .expect(400);

    expect(response.body.code).toBe('PLAN_PROVIDER_REF_INVALID');
  });

  it('accepts a plan whose provider ref validates', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/plans')
      .set('authorization', `Bearer ${adminToken}`)
      .send(createPayload({ providerRefs: { STRIPE: 'price_valid' } }))
      .expect(201);

    expect(response.body.providerRefs).toEqual({ STRIPE: 'price_valid' });
  });

  it('lists plans with cursor pagination, including inactive ones', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/plans')
      .set('authorization', `Bearer ${adminToken}`)
      .send(createPayload({ name: 'List Test Plan' }))
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/plans/${created.body.id}/activation`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ isActive: false })
      .expect(200);

    const page = await request(app.getHttpServer())
      .get('/api/v1/admin/plans?limit=1')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(page.body.items).toHaveLength(1);
    expect(page.body.nextCursor).toBeTruthy();

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/admin/plans/${created.body.id}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(detail.body.isActive).toBe(false);
  });

  it('returns 404 for an unknown plan id', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/admin/plans/${randomUUID()}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('updates a plan with partial fields', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/plans')
      .set('authorization', `Bearer ${adminToken}`)
      .send(createPayload({ name: 'Update Test Plan' }))
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/admin/plans/${created.body.id}`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ amountCents: 2500 })
      .expect(200);

    expect(updated.body.amountCents).toBe(2500);
    expect(updated.body.name).toBe('Update Test Plan');
  });

  it('activates and deactivates a plan', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/plans')
      .set('authorization', `Bearer ${adminToken}`)
      .send(createPayload({ name: 'Activation Test Plan' }))
      .expect(201);

    const deactivated = await request(app.getHttpServer())
      .patch(`/api/v1/admin/plans/${created.body.id}/activation`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ isActive: false })
      .expect(200);

    expect(deactivated.body.isActive).toBe(false);

    const reactivated = await request(app.getHttpServer())
      .patch(`/api/v1/admin/plans/${created.body.id}/activation`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ isActive: true })
      .expect(200);

    expect(reactivated.body.isActive).toBe(true);
  });

  it('deletes a plan with no subscriptions', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/plans')
      .set('authorization', `Bearer ${adminToken}`)
      .send(createPayload({ name: 'Delete Test Plan' }))
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/plans/${created.body.id}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/admin/plans/${created.body.id}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('forbids deleting a plan with subscriptions (PLAN_HAS_SUBSCRIPTIONS)', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/admin/plans')
      .set('authorization', `Bearer ${adminToken}`)
      .send(createPayload({ name: 'Subscribed Test Plan' }))
      .expect(201);

    const user = await registerUser('Plan Subscriber E2E');
    const method = await prisma.authMethod.findFirst({ where: { email: user.email } });

    await prisma.subscription.create({
      data: {
        userId: method?.userId ?? '',
        planId: created.body.id,
        status: 'ACTIVE',
        provider: 'FAKE',
        providerRef: `sub_${randomUUID()}`,
        currentPeriodEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const response = await request(app.getHttpServer())
      .delete(`/api/v1/admin/plans/${created.body.id}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(409);

    expect(response.body.code).toBe('PLAN_HAS_SUBSCRIPTIONS');
  });
});
