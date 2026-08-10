import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { AUTH_PASSWORD_CHANGED_EVENT } from '@modules/event/constants/event-names.constants.js';
import { EventBusService } from '@modules/event/services/event-bus.service.js';
import { NOTIFICATION_EVENT } from '@modules/notification/constants/notification-events.constants.js';
import { buildUserRoom } from '@modules/notification/constants/notification-rooms.constants.js';
import { NotificationGateway } from '@modules/notification/gateways/notification.gateway.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import {
  NotificationChannelEnum,
  type NotificationPreferencesResponseInterface,
  NotificationTypeEnum,
} from '@nest-aws-starter/shared';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { MAIL_TRANSPORT } from '@providers/mail/constants/mail.constants.js';
import type { MailTransportInterface } from '@providers/mail/interfaces/mail-transport.interface.js';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestApp } from './app.factory.js';

// GET/PUT /notifications/preferences (Task 5) plus the event subscriber's EMAIL
// channel: "preferences gate channels, never persistence" is exercised via
// a real domain event through the real EventBus, same as
// notification-event-subscriber.e2e-spec.ts — the EMAIL send itself is asserted
// by spying on the real MAIL_TRANSPORT (mail.e2e-spec.ts already proves the
// SES transport itself works against LocalStack).
describe('notification preferences (e2e)', () => {
  let app: NestFastifyApplication;
  let baseUrl: string;
  let prisma: PrismaService;
  let eventBus: EventBusService;
  let sendSpy: ReturnType<typeof vi.spyOn>;
  const openSockets: Socket[] = [];

  function uniqueIp(): string {
    return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  async function registerUser(): Promise<{ id: string; accessToken: string; email: string }> {
    const email: string = `notif-prefs-e2e-${randomUUID()}@example.com`;
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', uniqueIp())
      .send({ displayName: 'Notif Prefs E2E', email, password: 'correct-horse-battery' })
      .expect(201);
    const authMethod = await prisma.authMethod.findFirst({ where: { email } });

    return { id: authMethod?.userId ?? '', accessToken: response.body.accessToken, email };
  }

  function getMatrix(token: string) {
    return request(app.getHttpServer())
      .get('/api/v1/notifications/preferences')
      .set('authorization', `Bearer ${token}`);
  }

  function putMatrix(token: string, preferences: unknown[]) {
    return request(app.getHttpServer())
      .put('/api/v1/notifications/preferences')
      .set('authorization', `Bearer ${token}`)
      .send({ preferences });
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

  // Same poll as notification-event-subscriber.e2e-spec.ts — room joins happen
  // asynchronously in handleConnection, after the client's own 'connect'.
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

  beforeEach(() => {
    sendSpy = vi
      .spyOn(app.get<MailTransportInterface>(MAIL_TRANSPORT), 'send')
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    while (openSockets.length > 0) openSockets.pop()?.disconnect();
    sendSpy.mockRestore();
  });

  it('GET returns the complete matrix for a fresh user, defaults applied', async () => {
    const user = await registerUser();

    const response = await getMatrix(user.accessToken).expect(200);
    const body: NotificationPreferencesResponseInterface = response.body;

    // 7 USER-audience types x 2 channels — no ADMIN-audience type present.
    expect(body.preferences).toHaveLength(14);
    expect(body.preferences.some((row) => row.type === NotificationTypeEnum.USER_BLOCKED)).toBe(
      false,
    );

    const inApp = body.preferences.find(
      (row) =>
        row.type === NotificationTypeEnum.PASSWORD_CHANGED &&
        row.channel === NotificationChannelEnum.IN_APP,
    );

    expect(inApp).toEqual({
      type: NotificationTypeEnum.PASSWORD_CHANGED,
      channel: NotificationChannelEnum.IN_APP,
      enabled: true,
      isEditable: false,
    });

    const renewedEmail = body.preferences.find(
      (row) =>
        row.type === NotificationTypeEnum.SUBSCRIPTION_RENEWED &&
        row.channel === NotificationChannelEnum.EMAIL,
    );

    // The one documented default exception.
    expect(renewedEmail?.enabled).toBe(false);

    const passwordEmail = body.preferences.find(
      (row) =>
        row.type === NotificationTypeEnum.PASSWORD_CHANGED &&
        row.channel === NotificationChannelEnum.EMAIL,
    );

    expect(passwordEmail?.enabled).toBe(true);
  });

  it('PUT persists and is reflected on the next GET', async () => {
    const user = await registerUser();

    await putMatrix(user.accessToken, [
      {
        type: NotificationTypeEnum.PASSWORD_CHANGED,
        channel: NotificationChannelEnum.EMAIL,
        enabled: false,
      },
    ]).expect(204);

    const response = await getMatrix(user.accessToken).expect(200);
    const body: NotificationPreferencesResponseInterface = response.body;
    const passwordEmail = body.preferences.find(
      (row) =>
        row.type === NotificationTypeEnum.PASSWORD_CHANGED &&
        row.channel === NotificationChannelEnum.EMAIL,
    );

    expect(passwordEmail?.enabled).toBe(false);
  });

  it('rejects a write to the immutable IN_APP channel with a coded error', async () => {
    const user = await registerUser();

    const response = await putMatrix(user.accessToken, [
      {
        type: NotificationTypeEnum.PASSWORD_CHANGED,
        channel: NotificationChannelEnum.IN_APP,
        enabled: false,
      },
    ]).expect(400);

    expect(response.body.code).toBe('NOTIFICATION_PREFERENCE_CHANNEL_IMMUTABLE');
  });

  // Atomicity, end to end: a batch with one valid row and one invalid row
  // is rejected whole — the valid row must never land, even though it
  // would have been perfectly fine on its own.
  it('a mixed valid/invalid batch is rejected whole — the valid row is never persisted', async () => {
    const user = await registerUser();

    const response = await putMatrix(user.accessToken, [
      {
        type: NotificationTypeEnum.PASSWORD_CHANGED,
        channel: NotificationChannelEnum.EMAIL,
        enabled: false,
      },
      {
        type: NotificationTypeEnum.NEW_DEVICE_LOGIN,
        channel: NotificationChannelEnum.IN_APP,
        enabled: false,
      },
    ]).expect(400);

    expect(response.body.code).toBe('NOTIFICATION_PREFERENCE_CHANNEL_IMMUTABLE');

    const matrix = await getMatrix(user.accessToken).expect(200);
    const passwordEmail = (
      matrix.body as NotificationPreferencesResponseInterface
    ).preferences.find(
      (row) =>
        row.type === NotificationTypeEnum.PASSWORD_CHANGED &&
        row.channel === NotificationChannelEnum.EMAIL,
    );

    // Still the default (true) — the valid row in the same batch never persisted.
    expect(passwordEmail?.enabled).toBe(true);
  });

  it('rejects a write for an ADMIN-audience type with no per-user preference', async () => {
    const user = await registerUser();

    const response = await putMatrix(user.accessToken, [
      {
        type: NotificationTypeEnum.USER_BLOCKED,
        channel: NotificationChannelEnum.EMAIL,
        enabled: false,
      },
    ]).expect(400);

    expect(response.body.code).toBe('NOTIFICATION_PREFERENCE_TYPE_INVALID');
  });

  it('is authenticated — 401 without a token', async () => {
    await request(app.getHttpServer()).get('/api/v1/notifications/preferences').expect(401);
  });

  it("cross-user isolation: one user's write never affects another user's matrix", async () => {
    const userA = await registerUser();
    const userB = await registerUser();

    await putMatrix(userA.accessToken, [
      {
        type: NotificationTypeEnum.PASSWORD_CHANGED,
        channel: NotificationChannelEnum.EMAIL,
        enabled: false,
      },
    ]).expect(204);

    const responseA = await getMatrix(userA.accessToken).expect(200);
    const responseB = await getMatrix(userB.accessToken).expect(200);
    const emailA = (responseA.body as NotificationPreferencesResponseInterface).preferences.find(
      (row) =>
        row.type === NotificationTypeEnum.PASSWORD_CHANGED &&
        row.channel === NotificationChannelEnum.EMAIL,
    );
    const emailB = (responseB.body as NotificationPreferencesResponseInterface).preferences.find(
      (row) =>
        row.type === NotificationTypeEnum.PASSWORD_CHANGED &&
        row.channel === NotificationChannelEnum.EMAIL,
    );

    expect(emailA?.enabled).toBe(false);
    expect(emailB?.enabled).toBe(true);
  });

  // The binding rule: preferences gate channels, never persistence.
  it('EMAIL off: the row still lands and the socket still receives it, but no mail is sent', async () => {
    const user = await registerUser();

    await putMatrix(user.accessToken, [
      {
        type: NotificationTypeEnum.PASSWORD_CHANGED,
        channel: NotificationChannelEnum.EMAIL,
        enabled: false,
      },
    ]).expect(204);

    const socket: Socket = connect(user.accessToken);
    const room: string = buildUserRoom(user.id);

    await waitForConnect(socket);
    await waitForRoomMember(room);

    const received = waitForEvent(socket, NOTIFICATION_EVENT);

    eventBus.emit(AUTH_PASSWORD_CHANGED_EVENT, { userId: user.id, sessionId: 'session-1' });

    await received;

    const notification = await prisma.notification.findFirst({
      where: { userId: user.id, type: 'PASSWORD_CHANGED' },
    });

    expect(notification).toBeTruthy();
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('EMAIL on (default): a matching notification triggers a mail send to the verified method', async () => {
    const user = await registerUser();

    eventBus.emit(AUTH_PASSWORD_CHANGED_EVENT, { userId: user.id, sessionId: 'session-1' });

    await vi.waitFor(() => expect(sendSpy).toHaveBeenCalledTimes(1), { timeout: 5_000 });

    expect(sendSpy).toHaveBeenCalledWith(expect.objectContaining({ to: user.email }));
  });
});
