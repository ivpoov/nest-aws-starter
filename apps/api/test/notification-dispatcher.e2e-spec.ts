import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import {
  AUTH_LOGIN_EVENT,
  AUTH_NEW_DEVICE_EVENT,
  CONTACT_RECEIVED_EVENT,
  SUBSCRIPTION_PAST_DUE_EVENT,
  USER_BLOCKED_EVENT,
} from '@modules/event/constants/event-names.constants.js';
import { EventBusService } from '@modules/event/services/event-bus.service.js';
import {
  NOTIFICATION_EMAIL_THROTTLE_KEY_PREFIX,
  NOTIFICATION_EMAIL_THROTTLE_REPOSITORY,
  NOTIFICATION_EMAIL_THROTTLE_WINDOW_SEC,
} from '@modules/notification/constants/notification-email-throttle.constants.js';
import { NOTIFICATION_EVENT } from '@modules/notification/constants/notification-events.constants.js';
import {
  ADMIN_ROOM,
  buildUserRoom,
} from '@modules/notification/constants/notification-rooms.constants.js';
import { NotificationGateway } from '@modules/notification/gateways/notification.gateway.js';
import type { NotificationEmailThrottleRepositoryInterface } from '@modules/notification/interfaces/notification-email-throttle-repository.interface.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { type NotificationResponseInterface, NotificationTypeEnum } from '@nest-aws-starter/shared';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { MAIL_TRANSPORT } from '@providers/mail/constants/mail.constants.js';
import type { MailTransportInterface } from '@providers/mail/interfaces/mail-transport.interface.js';
import { REDIS_CLIENT } from '@providers/redis/constants/redis.constants.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestApp } from './app.factory.js';
import { waitForActivity } from './helpers/wait-for-activity.helper.js';

// Exercises the persist-first dispatcher end to end: a real domain event
// through the real EventBus, against real Postgres (the row + its
// denormalized content + the eager USER receipt) and real Redis-backed
// Socket.IO (a connected client actually receiving the fan-out). Domain
// events are emitted directly via EventBusService rather than through the
// feature flow that would normally trigger them (login, admin block, ...)
// — this suite owns the dispatcher, not those flows, matching the brief's
// "emit a real domain event through the real EventBus" instruction.
describe('notification dispatcher (persist-first, e2e)', () => {
  let app: NestFastifyApplication;
  let baseUrl: string;
  let eventBus: EventBusService;
  let prisma: PrismaService;
  const openSockets: Socket[] = [];

  function uniqueIp(): string {
    return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  async function registerUser(): Promise<{ id: string; email: string; accessToken: string }> {
    const email: string = `notif-e2e-${randomUUID()}@example.com`;
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', uniqueIp())
      .send({ displayName: 'Notif E2E', email, password: 'correct-horse-battery' })
      .expect(201);
    const authMethod = await prisma.authMethod.findFirst({ where: { email } });

    return { id: authMethod?.userId ?? '', email, accessToken: response.body.accessToken };
  }

  // Same direct-promote-then-relogin pattern as websocket.e2e-spec.ts — no
  // promote-to-ADMIN endpoint exists.
  async function registerAdmin(): Promise<{ id: string; email: string; accessToken: string }> {
    const user = await registerUser();

    await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });

    const authMethod = await prisma.authMethod.findFirst({ where: { userId: user.id } });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-forwarded-for', uniqueIp())
      .send({ email: authMethod?.email, password: 'correct-horse-battery' })
      .expect(200);

    return { id: user.id, email: user.email, accessToken: login.body.accessToken };
  }

  function connect(token: string): Socket {
    const socket: Socket = io(baseUrl, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });

    openSockets.push(socket);

    return socket;
  }

  function waitForConnect(socket: Socket): Promise<void> {
    return new Promise((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });
  }

  function waitForEvent<T>(socket: Socket, event: string): Promise<T> {
    return new Promise((resolve) => socket.once(event, (payload: T) => resolve(payload)));
  }

  // See websocket.e2e-spec.ts's identical helper — room joins happen
  // asynchronously in handleConnection, after the client's own 'connect'
  // fires, so tests poll real room membership before emitting into it.
  async function waitForRoomMember(room: string): Promise<void> {
    const deadline: number = Date.now() + 5_000;

    while (Date.now() < deadline) {
      const sockets = await app.get(NotificationGateway).server.in(room).fetchSockets();

      if (sockets.length > 0) return;

      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    throw new Error(`Timed out waiting for a socket to join room: ${room}`);
  }

  beforeAll(async () => {
    app = await createTestApp();
    await app.listen({ port: 0, host: '127.0.0.1' });
    eventBus = app.get(EventBusService);
    prisma = app.get(PrismaService);

    const address: string | AddressInfo | null = app.getHttpServer().address();
    const port: number = typeof address === 'object' && address !== null ? address.port : 0;

    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    while (openSockets.length > 0) openSockets.pop()?.disconnect();
  });

  it('persists a USER-audience row with denormalized content and an eager receipt', async () => {
    const user = await registerUser();

    eventBus.emit(AUTH_NEW_DEVICE_EVENT, {
      userId: user.id,
      ip: '203.0.113.5',
      device: 'Firefox on Fedora',
    });

    const notification = await waitForActivity(() =>
      prisma.notification.findFirst({ where: { userId: user.id, type: 'NEW_DEVICE_LOGIN' } }),
    );

    expect(notification).toMatchObject({
      audience: 'USER',
      userId: user.id,
      type: 'NEW_DEVICE_LOGIN',
      title: 'New device sign-in',
      body: 'A new sign-in to your account was detected from Firefox on Fedora.',
      meta: { device: 'Firefox on Fedora', ip: '203.0.113.5' },
    });

    const receipt = await prisma.notificationReceipt.findFirst({
      where: { notificationId: notification?.id, userId: user.id },
    });

    expect(receipt).toBeTruthy();
    expect(receipt?.readAt).toBeNull();
  });

  it('persists a single ADMIN-audience row, not one per admin', async () => {
    const target = await registerUser();
    const marker: string = randomUUID();

    eventBus.emit(USER_BLOCKED_EVENT, { userId: target.id, actorId: marker });

    const notification = await waitForActivity(() =>
      prisma.notification.findFirst({
        where: { type: 'USER_BLOCKED', meta: { path: ['actorId'], equals: marker } },
      }),
    );

    expect(notification).toMatchObject({ audience: 'ADMIN', userId: null, type: 'USER_BLOCKED' });

    const rowCount: number = await prisma.notification.count({
      where: { type: 'USER_BLOCKED', meta: { path: ['actorId'], equals: marker } },
    });

    expect(rowCount).toBe(1);
  });

  it('does not persist anything for a domain event outside the dispatcher matrix', async () => {
    const user = await registerUser();

    eventBus.emit(AUTH_LOGIN_EVENT, {
      userId: user.id,
      email: 'irrelevant@example.com',
      ip: '1.2.3.4',
    });

    // No waitForActivity here on purpose — there is nothing to eventually
    // appear. A short settle window covers the fire-and-forget listener
    // dispatch before asserting the count stayed at zero.
    await new Promise((resolve) => setTimeout(resolve, 300));

    const rowCount: number = await prisma.notification.count({ where: { userId: user.id } });

    expect(rowCount).toBe(0);
  });

  it('a connected socket in its user room receives the fan-out', async () => {
    const user = await registerUser();
    const socket: Socket = connect(user.accessToken);
    const room: string = buildUserRoom(user.id);

    await waitForConnect(socket);
    await waitForRoomMember(room);

    const received: Promise<NotificationResponseInterface> = waitForEvent(
      socket,
      NOTIFICATION_EVENT,
    );

    eventBus.emit(AUTH_NEW_DEVICE_EVENT, {
      userId: user.id,
      ip: '198.51.100.7',
      device: 'Safari on macOS',
    });

    const payload: NotificationResponseInterface = await received;

    expect(payload).toMatchObject({
      audience: 'USER',
      userId: user.id,
      type: 'NEW_DEVICE_LOGIN',
      title: 'New device sign-in',
      body: 'A new sign-in to your account was detected from Safari on macOS.',
    });
    expect(new Date(payload.createdAt).toISOString()).toBe(payload.createdAt);
  });

  it('a connected admin socket in the admins room receives an ADMIN-audience fan-out', async () => {
    const admin = await registerAdmin();
    const socket: Socket = connect(admin.accessToken);

    await waitForConnect(socket);
    await waitForRoomMember(ADMIN_ROOM);

    const received: Promise<NotificationResponseInterface> = waitForEvent(
      socket,
      NOTIFICATION_EVENT,
    );

    eventBus.emit(CONTACT_RECEIVED_EVENT, { contactMessageId: randomUUID(), ip: '198.51.100.8' });

    const payload: NotificationResponseInterface = await received;

    expect(payload).toMatchObject({ audience: 'ADMIN', userId: null, type: 'CONTACT_MESSAGE' });
  });

  // The EMAIL channel's storm guard against real Redis: a Stripe retry storm
  // that flips a subscription past-due N times in an hour must persist N
  // in-app rows and send exactly one mail.
  describe('EMAIL channel throttle', () => {
    const stormSize: number = 5;

    function countMailsTo(
      send: ReturnType<typeof vi.spyOn>,
      recipient: string,
      subject: string,
    ): number {
      return send.mock.calls.filter(
        (call: unknown[]): boolean =>
          (call[0] as { to: string; subject: string }).to === recipient &&
          (call[0] as { to: string; subject: string }).subject === subject,
      ).length;
    }

    it('persists every row of a storm but sends exactly one mail per (user, type) window', async () => {
      const user = await registerUser();
      const transport: MailTransportInterface = app.get(MAIL_TRANSPORT);
      const send = vi.spyOn(transport, 'send');

      try {
        for (let attempt = 0; attempt < stormSize; attempt += 1) {
          eventBus.emit(SUBSCRIPTION_PAST_DUE_EVENT, {
            userId: user.id,
            subscriptionId: randomUUID(),
          });
        }

        const rows = await waitForActivity(async () => {
          const count: number = await prisma.notification.count({
            where: { userId: user.id, type: NotificationTypeEnum.PAYMENT_FAILED },
          });

          return count === stormSize ? count : null;
        });

        expect(rows).toBe(stormSize);
        // Settle window for the last handler's EMAIL branch, which runs
        // after its row is already committed.
        await new Promise((resolve) => setTimeout(resolve, 500));

        expect(countMailsTo(send, user.email, 'Payment failed')).toBe(1);

        // A different type for the same user has its own window.
        eventBus.emit(AUTH_NEW_DEVICE_EVENT, {
          userId: user.id,
          ip: '198.51.100.31',
          device: 'Firefox on Fedora',
        });

        await waitForActivity(() =>
          prisma.notification.findFirst({
            where: { userId: user.id, type: NotificationTypeEnum.NEW_DEVICE_LOGIN },
          }),
        );
        await new Promise((resolve) => setTimeout(resolve, 500));

        expect(countMailsTo(send, user.email, 'New device sign-in')).toBe(1);
      } finally {
        send.mockRestore();
      }
    });

    it('lets exactly one of many concurrent claims win, with an hour-long window', async () => {
      const throttle: NotificationEmailThrottleRepositoryInterface = app.get(
        NOTIFICATION_EMAIL_THROTTLE_REPOSITORY,
      );
      const userId: string = randomUUID();

      const claims: boolean[] = await Promise.all(
        Array.from(
          { length: 10 },
          (): Promise<boolean> => throttle.claim(userId, NotificationTypeEnum.PAYMENT_FAILED),
        ),
      );

      expect(claims.filter((claimed: boolean): boolean => claimed)).toHaveLength(1);

      const redis: RedisClientType = app.get(REDIS_CLIENT);
      const ttl: number = await redis.ttl(
        `${NOTIFICATION_EMAIL_THROTTLE_KEY_PREFIX}:${userId}:${NotificationTypeEnum.PAYMENT_FAILED}`,
      );

      // Never pushed out by the losing claims — still the original window.
      expect(ttl).toBeGreaterThan(NOTIFICATION_EMAIL_THROTTLE_WINDOW_SEC - 60);
      expect(ttl).toBeLessThanOrEqual(NOTIFICATION_EMAIL_THROTTLE_WINDOW_SEC);
    });
  });
});
