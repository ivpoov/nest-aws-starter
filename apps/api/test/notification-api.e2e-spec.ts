import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { NotificationModel } from '@generated/prisma/models.js';
import { AUTH_NEW_DEVICE_EVENT } from '@modules/event/constants/event-names.constants.js';
import { EventBusService } from '@modules/event/services/event-bus.service.js';
import { UNREAD_COUNT_EVENT } from '@modules/notification/constants/notification-events.constants.js';
import { buildUserRoom } from '@modules/notification/constants/notification-rooms.constants.js';
import { NotificationGateway } from '@modules/notification/gateways/notification.gateway.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';

interface NotificationBodyInterface {
  readonly id: string;
  readonly audience: string;
  readonly userId: string | null;
  readonly type: string;
  readonly title: string;
  readonly createdAt: string;
  readonly readAt: string | null;
}

// History API (Task 4): GET /notifications (own, cursor, merged for admins),
// GET /notifications/unread-count, PATCH /notifications/:id/read (idempotent),
// POST /notifications/read-all. Rows are seeded directly via Prisma (matching
// what the persist-first dispatcher itself writes) so each test controls
// exactly what exists — the dispatcher's own persistence is already covered
// by notification-dispatcher.e2e-spec.ts. The one dispatcher-driven flow here
// is the WS unread-count push, which only a real dispatch can exercise.
describe('notification history API (e2e)', () => {
  let app: NestFastifyApplication;
  let baseUrl: string;
  let prisma: PrismaService;
  let eventBus: EventBusService;
  const openSockets: Socket[] = [];

  function uniqueIp(): string {
    return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  async function registerUser(): Promise<{ id: string; token: string }> {
    const email: string = `notif-api-e2e-${randomUUID()}@example.com`;
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', uniqueIp())
      .send({ displayName: 'Notif API E2E', email, password: 'correct-horse-battery' })
      .expect(201);
    const authMethod = await prisma.authMethod.findFirst({ where: { email } });

    return { id: authMethod?.userId ?? '', token: response.body.accessToken };
  }

  // Same direct-promote-then-relogin pattern as notification-dispatcher.e2e-spec.ts.
  async function registerAdmin(): Promise<{ id: string; token: string }> {
    const user = await registerUser();

    await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });

    const authMethod = await prisma.authMethod.findFirst({ where: { userId: user.id } });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-forwarded-for', uniqueIp())
      .send({ email: authMethod?.email, password: 'correct-horse-battery' })
      .expect(200);

    return { id: user.id, token: login.body.accessToken };
  }

  async function seedUserNotification(
    userId: string,
    type: string = 'NEW_DEVICE_LOGIN',
  ): Promise<NotificationModel> {
    return prisma.notification.create({
      data: {
        audience: 'USER',
        userId,
        type,
        title: 'title',
        body: 'body',
        meta: {},
        receipts: { create: [{ userId }] },
      },
    });
  }

  async function seedAdminNotification(): Promise<NotificationModel> {
    return prisma.notification.create({
      data: { audience: 'ADMIN', userId: null, type: 'USER_BLOCKED', title: 'title', body: 'body' },
    });
  }

  beforeAll(async () => {
    app = await createTestApp();
    await app.listen({ port: 0, host: '127.0.0.1' });
    prisma = app.get(PrismaService);
    eventBus = app.get(EventBusService);

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

  it('rejects every route without a token', async () => {
    await request(app.getHttpServer()).get('/api/v1/notifications').expect(401);
    await request(app.getHttpServer()).get('/api/v1/notifications/unread-count').expect(401);
    await request(app.getHttpServer())
      .patch('/api/v1/notifications/01890a5d-ac96-774b-bcce-b30209000000/read')
      .expect(401);
    await request(app.getHttpServer()).post('/api/v1/notifications/read-all').expect(401);
  });

  it('lists only the caller’s own notifications, unread, newest first', async () => {
    const owner = await registerUser();
    const stranger = await registerUser();
    const older = await seedUserNotification(owner.id);
    const newer = await seedUserNotification(owner.id);

    await seedUserNotification(stranger.id);

    const response = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('authorization', `Bearer ${owner.token}`)
      .expect(200);

    const items = response.body.items as NotificationBodyInterface[];
    const ids: string[] = items.map((item: NotificationBodyInterface): string => item.id);

    expect(ids).toEqual([newer.id, older.id]);
    expect(
      items.every((item: NotificationBodyInterface): boolean => item.userId === owner.id),
    ).toBe(true);
    expect(items.every((item: NotificationBodyInterface): boolean => item.readAt === null)).toBe(
      true,
    );
  });

  it('a user cannot see, page into, or mark-read another user’s notification', async () => {
    const owner = await registerUser();
    const stranger = await registerUser();
    const theirs = await seedUserNotification(owner.id);

    const list = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('authorization', `Bearer ${stranger.token}`)
      .expect(200);

    const listedIds: string[] = (list.body.items as NotificationBodyInterface[]).map(
      (item: NotificationBodyInterface): string => item.id,
    );

    expect(listedIds).not.toContain(theirs.id);

    const markRead = await request(app.getHttpServer())
      .patch(`/api/v1/notifications/${theirs.id}/read`)
      .set('authorization', `Bearer ${stranger.token}`)
      .expect(403);

    expect(markRead.body.code).toBe('NOTIFICATION_ACCESS_DENIED');
  });

  it('returns the coded not-found envelope for a missing id', async () => {
    const owner = await registerUser();

    const response = await request(app.getHttpServer())
      .patch('/api/v1/notifications/01890a5d-ac96-774b-bcce-b30209000000/read')
      .set('authorization', `Bearer ${owner.token}`)
      .expect(404);

    expect(response.body.code).toBe('NOTIFICATION_NOT_FOUND');
  });

  it('mark-read is idempotent and updates the unread count', async () => {
    const owner = await registerUser();
    const first = await seedUserNotification(owner.id);

    await seedUserNotification(owner.id);

    const before = await request(app.getHttpServer())
      .get('/api/v1/notifications/unread-count')
      .set('authorization', `Bearer ${owner.token}`)
      .expect(200);

    expect(before.body.count).toBe(2);

    await request(app.getHttpServer())
      .patch(`/api/v1/notifications/${first.id}/read`)
      .set('authorization', `Bearer ${owner.token}`)
      .expect(204);

    const receiptAfterFirst = await prisma.notificationReceipt.findFirst({
      where: { notificationId: first.id, userId: owner.id },
    });

    expect(receiptAfterFirst?.readAt).toBeTruthy();

    // Re-marking is a no-op — never an error, and the original readAt is
    // preserved rather than bumped on every repeat call.
    await request(app.getHttpServer())
      .patch(`/api/v1/notifications/${first.id}/read`)
      .set('authorization', `Bearer ${owner.token}`)
      .expect(204);

    const receiptAfterSecond = await prisma.notificationReceipt.findFirst({
      where: { notificationId: first.id, userId: owner.id },
    });

    expect(receiptAfterSecond?.readAt?.toISOString()).toBe(
      receiptAfterFirst?.readAt?.toISOString(),
    );

    const after = await request(app.getHttpServer())
      .get('/api/v1/notifications/unread-count')
      .set('authorization', `Bearer ${owner.token}`)
      .expect(200);

    expect(after.body.count).toBe(1);
  });

  it('unreadOnly filters the list and read-all zeroes the unread count', async () => {
    const owner = await registerUser();
    const readRow = await seedUserNotification(owner.id);
    const unreadRow = await seedUserNotification(owner.id);

    await request(app.getHttpServer())
      .patch(`/api/v1/notifications/${readRow.id}/read`)
      .set('authorization', `Bearer ${owner.token}`)
      .expect(204);

    const unreadOnly = await request(app.getHttpServer())
      .get('/api/v1/notifications?unreadOnly=true')
      .set('authorization', `Bearer ${owner.token}`)
      .expect(200);

    const unreadOnlyIds: string[] = (unreadOnly.body.items as NotificationBodyInterface[]).map(
      (item: NotificationBodyInterface): string => item.id,
    );

    expect(unreadOnlyIds).toEqual([unreadRow.id]);

    await request(app.getHttpServer())
      .post('/api/v1/notifications/read-all')
      .set('authorization', `Bearer ${owner.token}`)
      .expect(204);

    const count = await request(app.getHttpServer())
      .get('/api/v1/notifications/unread-count')
      .set('authorization', `Bearer ${owner.token}`)
      .expect(200);

    expect(count.body.count).toBe(0);
  });

  it('an admin sees a merged USER+ADMIN feed; a plain user never sees ADMIN rows', async () => {
    const admin = await registerAdmin();
    const plainUser = await registerUser();
    const adminOwn = await seedUserNotification(admin.id);
    const adminRow = await seedAdminNotification();

    await seedUserNotification(plainUser.id);

    const adminList = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('authorization', `Bearer ${admin.token}`)
      .expect(200);
    const adminIds: string[] = (adminList.body.items as NotificationBodyInterface[]).map(
      (item: NotificationBodyInterface): string => item.id,
    );

    expect(adminIds).toEqual(expect.arrayContaining([adminOwn.id, adminRow.id]));

    const userList = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('authorization', `Bearer ${plainUser.token}`)
      .expect(200);
    const userIds: string[] = (userList.body.items as NotificationBodyInterface[]).map(
      (item: NotificationBodyInterface): string => item.id,
    );

    expect(userIds).not.toContain(adminRow.id);

    const forbidden = await request(app.getHttpServer())
      .patch(`/api/v1/notifications/${adminRow.id}/read`)
      .set('authorization', `Bearer ${plainUser.token}`)
      .expect(403);

    expect(forbidden.body.code).toBe('NOTIFICATION_ACCESS_DENIED');
  });

  // Server-side type/audience filters (the admin history page used to filter
  // fetched pages in memory, so a filtered view showed an arbitrary subset of
  // one page and "load more" could append nothing while staying enabled).
  describe('server-side list filters', () => {
    async function collectFilteredPages(
      token: string,
      query: string,
      limit: number,
    ): Promise<NotificationBodyInterface[]> {
      const collected: NotificationBodyInterface[] = [];
      let cursor: string | null = null;
      let pages: number = 0;

      do {
        const url: string = `/api/v1/notifications?${query}&limit=${limit}${
          cursor ? `&cursor=${cursor}` : ''
        }`;
        const response = await request(app.getHttpServer())
          .get(url)
          .set('authorization', `Bearer ${token}`)
          .expect(200);

        collected.push(...(response.body.items as NotificationBodyInterface[]));
        cursor = response.body.nextCursor;
        pages += 1;

        if (pages > 10) throw new Error('Cursor paging did not terminate');
      } while (cursor);

      return collected;
    }

    it('pages a type-filtered feed across multiple cursor pages, newest first', async () => {
      const owner = await registerUser();
      const paymentRows: NotificationModel[] = [];

      for (let index = 0; index < 5; index += 1) {
        paymentRows.push(await seedUserNotification(owner.id, 'PAYMENT_FAILED'));
      }

      // Newest row overall, and of the excluded type — an unfiltered or
      // page-local filter would surface it (or lose a PAYMENT_FAILED row to
      // it) on the first page.
      const excluded = await seedUserNotification(owner.id, 'NEW_DEVICE_LOGIN');

      const items: NotificationBodyInterface[] = await collectFilteredPages(
        owner.token,
        'type=PAYMENT_FAILED',
        2,
      );
      const ids: string[] = items.map((item: NotificationBodyInterface): string => item.id);

      expect(ids).toEqual(
        [...paymentRows].reverse().map((row: NotificationModel): string => row.id),
      );
      expect(ids).not.toContain(excluded.id);
      expect(
        items.every((item: NotificationBodyInterface): boolean => item.type === 'PAYMENT_FAILED'),
      ).toBe(true);
    });

    // Both rows below are the newest of their audience, so the first page is
    // enough to prove which branch of the merged scope each filter keeps.
    async function fetchFirstPageIds(token: string, query: string): Promise<string[]> {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/notifications?${query}&limit=20`)
        .set('authorization', `Bearer ${token}`)
        .expect(200);

      return (response.body.items as NotificationBodyInterface[]).map(
        (item: NotificationBodyInterface): string => item.id,
      );
    }

    it('narrows an admin’s merged feed to one audience without widening anyone’s scope', async () => {
      const admin = await registerAdmin();
      const ownRow = await seedUserNotification(admin.id);
      const adminRow = await seedAdminNotification();

      const adminOnlyIds: string[] = await fetchFirstPageIds(admin.token, 'audience=ADMIN');

      expect(adminOnlyIds).toContain(adminRow.id);
      expect(adminOnlyIds).not.toContain(ownRow.id);

      const userOnlyIds: string[] = await fetchFirstPageIds(admin.token, 'audience=USER');

      expect(userOnlyIds).toContain(ownRow.id);
      expect(userOnlyIds).not.toContain(adminRow.id);

      // A plain user asking for ADMIN rows gets nothing — the filter narrows,
      // it never grants.
      const plainUser = await registerUser();

      await seedUserNotification(plainUser.id);

      const forbiddenScope = await request(app.getHttpServer())
        .get('/api/v1/notifications?audience=ADMIN')
        .set('authorization', `Bearer ${plainUser.token}`)
        .expect(200);

      expect(forbiddenScope.body.items).toEqual([]);
      expect(forbiddenScope.body.nextCursor).toBeNull();
    });

    it('rejects an unknown type or audience with a 400', async () => {
      const owner = await registerUser();

      await request(app.getHttpServer())
        .get('/api/v1/notifications?type=NOT_A_TYPE')
        .set('authorization', `Bearer ${owner.token}`)
        .expect(400);

      await request(app.getHttpServer())
        .get('/api/v1/notifications?audience=EVERYONE')
        .set('authorization', `Bearer ${owner.token}`)
        .expect(400);
    });
  });

  // The FK/cascade added in 20260808175249_notification_user_fk_cascade: the
  // starter had three userId columns in one migration and only the
  // preference one was constrained, so whoever adds account deletion first
  // would inherit orphaned notification and receipt rows while the
  // preference rows cascaded away.
  it('cascades a user’s notifications and receipts away when the user row is deleted', async () => {
    const owner = await registerUser();
    const row = await seedUserNotification(owner.id);

    expect(await prisma.notificationReceipt.count({ where: { notificationId: row.id } })).toBe(1);

    await prisma.user.delete({ where: { id: owner.id } });

    expect(await prisma.notification.count({ where: { id: row.id } })).toBe(0);
    expect(await prisma.notificationReceipt.count({ where: { notificationId: row.id } })).toBe(0);
  });

  it('lazily creates the admin’s own reader receipt on first mark-read of an ADMIN-audience row', async () => {
    const admin = await registerAdmin();
    const adminRow = await seedAdminNotification();

    const before = await prisma.notificationReceipt.findFirst({
      where: { notificationId: adminRow.id, userId: admin.id },
    });

    expect(before).toBeNull();

    await request(app.getHttpServer())
      .patch(`/api/v1/notifications/${adminRow.id}/read`)
      .set('authorization', `Bearer ${admin.token}`)
      .expect(204);

    const after = await prisma.notificationReceipt.findFirst({
      where: { notificationId: adminRow.id, userId: admin.id },
    });

    expect(after?.readAt).toBeTruthy();
  });

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

  // Room joins happen asynchronously in handleConnection, after the
  // client's own 'connect' fires — poll real room membership before
  // emitting into it (same helper as notification-dispatcher.e2e-spec.ts).
  async function waitForRoomMember(room: string): Promise<void> {
    const deadline: number = Date.now() + 5_000;

    while (Date.now() < deadline) {
      const sockets = await app.get(NotificationGateway).server.in(room).fetchSockets();

      if (sockets.length > 0) return;

      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    throw new Error(`Timed out waiting for a socket to join room: ${room}`);
  }

  it('a connected socket receives an updated unread count after a new notification is dispatched', async () => {
    const user = await registerUser();
    const socket: Socket = connect(user.token);
    const room: string = buildUserRoom(user.id);

    await waitForConnect(socket);
    await waitForRoomMember(room);

    const received: Promise<number> = waitForEvent(socket, UNREAD_COUNT_EVENT);

    eventBus.emit(AUTH_NEW_DEVICE_EVENT, {
      userId: user.id,
      ip: '203.0.113.9',
      device: 'Firefox on Fedora',
    });

    const count: number = await received;

    expect(count).toBe(1);
  });
});
