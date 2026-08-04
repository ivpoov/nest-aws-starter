import { randomUUID } from 'node:crypto';
import type { CheckoutSessionInterface } from '@modules/payment/interfaces/checkout-session.interface.js';
import type { PaymentProviderInterface } from '@modules/payment/interfaces/payment-provider.interface.js';
import type { PaymentProviderCancellationInterface } from '@modules/payment/interfaces/payment-provider-cancellation.interface.js';
import { PaymentProviderRegistryService } from '@modules/payment/services/payment-provider-registry.service.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestApp } from './app.factory.js';

const fakeCheckoutUrl = 'https://fake.provider/checkout/session';

const cancelAtPeriodEndSpy = vi.fn().mockResolvedValue(undefined);

const fakeProvider: PaymentProviderInterface & PaymentProviderCancellationInterface = {
  name: 'FAKE',
  createCheckoutSession: async (): Promise<CheckoutSessionInterface> => ({ url: fakeCheckoutUrl }),
  createPortalSession: async (): Promise<string> => 'https://fake.provider/portal',
  verifyAndParseWebhook: async () => {
    throw new Error('not exercised by this suite');
  },
  cancelAtPeriodEnd: cancelAtPeriodEndSpy,
};

describe('billing (fake provider)', () => {
  let app: NestFastifyApplication;
  let userToken: string;
  let planId: string;
  let inactivePlanId: string;
  let cancelUserToken: string;
  let cancelSubscriptionRef: string;

  beforeAll(async () => {
    app = await createTestApp();
    app.get(PaymentProviderRegistryService).register(fakeProvider);
    userToken = await registerUser();

    const plan = await app.get(PrismaService).plan.create({
      data: {
        name: `Pro ${randomUUID()}`,
        amountCents: 1900,
        currency: 'USD',
        intervalDays: 30,
        providerRefs: { FAKE: 'price_fake_123' },
      },
    });

    planId = plan.id;

    const inactivePlan = await app.get(PrismaService).plan.create({
      data: {
        name: `Retired ${randomUUID()}`,
        amountCents: 500,
        currency: 'USD',
        intervalDays: 30,
        providerRefs: { FAKE: 'price_fake_retired' },
        isActive: false,
      },
    });

    inactivePlanId = inactivePlan.id;

    cancelUserToken = await registerUser();
    cancelSubscriptionRef = `sub_fake_${randomUUID()}`;

    const meResponse = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('authorization', `Bearer ${cancelUserToken}`)
      .expect(200);

    await app.get(PrismaService).subscription.create({
      data: {
        userId: meResponse.body.id,
        planId,
        status: 'ACTIVE',
        provider: 'FAKE',
        providerRef: cancelSubscriptionRef,
        providerCustomerRef: `cus_fake_${randomUUID()}`,
        currentPeriodEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  function uniqueIp(): string {
    return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  async function registerUser(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', uniqueIp())
      .send({
        displayName: 'Billing E2E',
        email: `billing-e2e-${randomUUID()}@example.com`,
        password: 'correct-horse-battery',
      })
      .expect(201);

    return response.body.accessToken;
  }

  it('rejects every authenticated route without a token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/billing/checkout')
      .send({ planId })
      .expect(401);
    await request(app.getHttpServer()).post('/api/v1/billing/portal').expect(401);
    await request(app.getHttpServer()).get('/api/v1/billing/subscription').expect(401);
    await request(app.getHttpServer()).post('/api/v1/billing/cancel').expect(401);
  });

  it('lists only active plans publicly, with no providerRefs/isActive in the body', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/billing/plans').expect(200);

    const items: Array<Record<string, unknown>> = response.body.items;
    const ids: unknown[] = items.map((item): unknown => item.id);

    expect(ids).toContain(planId);
    expect(ids).not.toContain(inactivePlanId);

    const activeItem = items.find((item): boolean => item.id === planId);

    expect(activeItem?.providerRefs).toBeUndefined();
    expect(activeItem?.isActive).toBeUndefined();
    expect(activeItem?.amountCents).toBe(1900);
  });

  it('creates a checkout session for an active plan', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/billing/checkout')
      .set('authorization', `Bearer ${userToken}`)
      .send({ planId })
      .expect(200);

    expect(response.body.url).toBe(fakeCheckoutUrl);
  });

  it('returns the coded not-found envelope for an unknown plan', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/billing/checkout')
      .set('authorization', `Bearer ${userToken}`)
      .send({ planId: '01890a5d-ac96-774b-bcce-b30209000000' })
      .expect(404);

    expect(response.body.code).toBe('PLAN_NOT_FOUND');
  });

  it('returns the coded no-subscription envelope when the user has none', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/billing/subscription')
      .set('authorization', `Bearer ${userToken}`)
      .expect(404);

    expect(response.body.code).toBe('PAYMENT_NO_SUBSCRIPTION');
  });

  it('returns the coded no-subscription envelope from the portal when the user has none', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/billing/portal')
      .set('authorization', `Bearer ${userToken}`)
      .expect(404);

    expect(response.body.code).toBe('PAYMENT_NO_SUBSCRIPTION');
  });

  it('returns the coded no-subscription envelope from cancel when the user has none', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/billing/cancel')
      .set('authorization', `Bearer ${userToken}`)
      .expect(404);

    expect(response.body.code).toBe('PAYMENT_NO_SUBSCRIPTION');
  });

  it('cancels the current subscription through the provider then the lifecycle', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/billing/cancel')
      .set('authorization', `Bearer ${cancelUserToken}`)
      .expect(200);

    expect(response.body.status).toBe('CANCELED');
    expect(response.body.canceledAt).not.toBeNull();
    expect(cancelAtPeriodEndSpy).toHaveBeenCalledWith(cancelSubscriptionRef);

    const again = await request(app.getHttpServer())
      .get('/api/v1/billing/subscription')
      .set('authorization', `Bearer ${cancelUserToken}`)
      .expect(404);

    expect(again.body.code).toBe('PAYMENT_NO_SUBSCRIPTION');
  });
});
