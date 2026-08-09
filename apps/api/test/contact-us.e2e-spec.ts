import { randomUUID } from 'node:crypto';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';
import { waitForActivity } from './helpers/wait-for-activity.helper.js';

interface ContactMessageBodyInterface {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly subject: string;
  readonly body: string;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

describe('contact us', () => {
  let app: NestFastifyApplication;
  let adminToken: string;
  let userToken: string;

  function uniqueIp(): string {
    return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  async function registerUser(displayName: string): Promise<{
    email: string;
    accessToken: string;
  }> {
    const email: string = `contact-e2e-${randomUUID()}@example.com`;
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', uniqueIp())
      .send({ displayName, email, password: 'correct-horse-battery' })
      .expect(201);

    return { email, accessToken: response.body.accessToken };
  }

  function submitContact(
    overrides: Partial<{
      name: string;
      email: string;
      subject: string;
      body: string;
      website: string;
    }> = {},
    ip: string = uniqueIp(),
  ) {
    return request(app.getHttpServer())
      .post('/api/v1/contact')
      .set('x-forwarded-for', ip)
      .send({
        name: 'Jane Doe',
        email: 'jane@example.com',
        subject: 'Question about pricing',
        body: 'Hi, I would like to know more.',
        ...overrides,
      });
  }

  async function findMessageBySubject(
    subject: string,
  ): Promise<ContactMessageBodyInterface | undefined> {
    let cursor: string | null = null;

    for (let page = 0; page < 50; page += 1) {
      const query: string = cursor ? `?limit=50&cursor=${cursor}` : '?limit=50';
      const response = await request(app.getHttpServer())
        .get(`/api/v1/admin/contact-messages${query}`)
        .set('authorization', `Bearer ${adminToken}`)
        .expect(200);

      const found = (response.body.items as ContactMessageBodyInterface[]).find(
        (item) => item.subject === subject,
      );

      if (found) return found;

      cursor = response.body.nextCursor;

      if (cursor === null) break;
    }

    return undefined;
  }

  beforeAll(async () => {
    app = await createTestApp();

    const admin = await registerUser('Contact Admin E2E');
    userToken = (await registerUser('Contact User E2E')).accessToken;

    await app.get(PrismaService).user.updateMany({
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

  it('accepts a submission with 204 and records it for the admin inbox as OPEN', async () => {
    const subject = `Submission ${randomUUID()}`;

    await submitContact({ subject }).expect(204);

    const found = await findMessageBySubject(subject);

    expect(found).toBeDefined();
    expect(found?.status).toBe('OPEN');
    expect(found?.name).toBe('Jane Doe');
  });

  it('returns 204 but discards a submission with a filled honeypot field', async () => {
    const subject = `Honeypot ${randomUUID()}`;

    await submitContact({ subject, website: 'https://spam.example' }).expect(204);

    const found = await findMessageBySubject(subject);

    expect(found).toBeUndefined();
  });

  it('records a CONTACT_RECEIVED activity row with the submitter ip', async () => {
    const subject = `Activity ${randomUUID()}`;
    const ip = uniqueIp();

    await submitContact({ subject }, ip).expect(204);
    await findMessageBySubject(subject);

    const matching = await waitForActivity(async () => {
      const activities = await request(app.getHttpServer())
        .get('/api/v1/admin/activities?type=CONTACT_RECEIVED&limit=100')
        .set('authorization', `Bearer ${adminToken}`)
        .expect(200);

      return (
        activities.body.items as { ip: string | null; meta: { contactMessageId: string } }[]
      ).find((item) => item.ip === ip);
    });

    expect(matching).toBeDefined();
    expect(matching?.meta.contactMessageId).toBeTruthy();
  });

  it('rejects an over-length body with the coded validation envelope', async () => {
    const response = await submitContact({ body: 'x'.repeat(5001) }).expect(400);

    expect(response.body.statusCode).toBe(400);
    expect(typeof response.body.code).toBe('string');
    expect(response.body.details).toContain('body');
  });

  it('throttles the contact form at its strict per-ip budget', async () => {
    const ip = uniqueIp();
    const statuses: number[] = [];

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await submitContact({ subject: `Throttle ${attempt} ${randomUUID()}` }, ip);

      statuses.push(response.status);

      if (response.status === 429) {
        expect(response.headers['retry-after']).toBeDefined();

        break;
      }
    }

    expect(statuses).toContain(429);
  });

  it('rejects admin routes for unauthenticated and non-admin callers', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/contact-messages').expect(401);

    const forbidden = await request(app.getHttpServer())
      .get('/api/v1/admin/contact-messages')
      .set('authorization', `Bearer ${userToken}`)
      .expect(403);

    expect(forbidden.body.code).toBe('CASL_FORBIDDEN');
  });

  it('updates status to RESOLVED and filters the list by status', async () => {
    const subject = `Resolve ${randomUUID()}`;

    await submitContact({ subject }).expect(204);

    const found = await findMessageBySubject(subject);

    expect(found).toBeDefined();

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/admin/contact-messages/${found?.id}/status`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ status: 'RESOLVED' })
      .expect(200);

    expect(updated.body.status).toBe('RESOLVED');

    const resolvedList = await request(app.getHttpServer())
      .get('/api/v1/admin/contact-messages?status=RESOLVED&limit=100')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    const stillOpenList = await request(app.getHttpServer())
      .get('/api/v1/admin/contact-messages?status=OPEN&limit=100')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(
      (resolvedList.body.items as ContactMessageBodyInterface[]).some(
        (item) => item.id === found?.id,
      ),
    ).toBe(true);
    expect(
      (stillOpenList.body.items as ContactMessageBodyInterface[]).some(
        (item) => item.id === found?.id,
      ),
    ).toBe(false);
  });

  // Paging used Prisma's `cursor` + `skip: 1`, which offsets past exactly one
  // row on the assumption that the cursor row is still the first row the query
  // matches. `status` is state a row can leave: the moment the admin resolves
  // the cursor message, `status=OPEN` has already excluded it and the offset
  // ate the next legitimate message instead — silently, and only for the
  // filtered inbox.
  it('keeps the message after a cursor whose own row stopped matching the status filter', async () => {
    const marker: string = randomUUID();
    const subjects: string[] = ['oldest', 'middle', 'newest'].map(
      (position: string): string => `Keyset ${position} ${marker}`,
    );

    for (const subject of subjects) {
      await submitContact({ subject }).expect(204);
    }

    const middle: ContactMessageBodyInterface | undefined = await findMessageBySubject(
      subjects[1] as string,
    );
    const newest: ContactMessageBodyInterface | undefined = await findMessageBySubject(
      subjects[2] as string,
    );

    expect(middle).toBeDefined();
    expect(newest).toBeDefined();

    const firstPage = await request(app.getHttpServer())
      .get('/api/v1/admin/contact-messages?status=OPEN&limit=1')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect((firstPage.body.items as ContactMessageBodyInterface[])[0]?.id).toBe(newest?.id);
    expect(firstPage.body.nextCursor).toBe(newest?.id);

    // The cursor row leaves the filtered set between the two requests —
    // exactly what triaging the top of the inbox does.
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/contact-messages/${newest?.id}/status`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ status: 'RESOLVED' })
      .expect(200);

    const secondPage = await request(app.getHttpServer())
      .get(`/api/v1/admin/contact-messages?status=OPEN&limit=1&cursor=${newest?.id}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect((secondPage.body.items as ContactMessageBodyInterface[])[0]?.id).toBe(middle?.id);
  });

  it('returns 404 for a status update on an unknown id', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/admin/contact-messages/01890a5d-ac96-774b-bcce-b30209000000/status')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ status: 'RESOLVED' })
      .expect(404);

    expect(response.body.code).toBe('CONTACT_MESSAGE_NOT_FOUND');
  });
});
