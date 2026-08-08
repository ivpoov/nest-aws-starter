import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { NOTIFICATION_EVENT } from '@modules/notification/constants/notification-events.constants.js';
import {
  ADMIN_ROOM,
  buildUserRoom,
} from '@modules/notification/constants/notification-rooms.constants.js';
import { NotificationGateway } from '@modules/notification/gateways/notification.gateway.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';

// Deliberately not the localhost default the gateway used to hard-code as
// its fallback: CORS_ORIGINS is set here before the app is built so a socket
// endpoint reading its own env at import time (which happens before
// loadEnv()) would visibly disagree with the HTTP layer.
const CONFIGURED_ORIGIN: string = 'https://ws-cors-pin.example';
const OTHER_CONFIGURED_ORIGIN: string = 'https://ws-cors-pin-admin.example';

describe('websocket notification gateway', () => {
  let app: NestFastifyApplication;
  let baseUrl: string;
  let originalCorsOrigins: string | undefined;
  const openSockets: Socket[] = [];

  function uniqueIp(): string {
    return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  async function registerUser(): Promise<{ id: string; accessToken: string }> {
    const email: string = `ws-e2e-${randomUUID()}@example.com`;
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', uniqueIp())
      .send({ displayName: 'WS E2E', email, password: 'correct-horse-battery' })
      .expect(201);
    const authMethod = await app.get(PrismaService).authMethod.findFirst({ where: { email } });

    return { id: authMethod?.userId ?? '', accessToken: response.body.accessToken };
  }

  // Promotes a fresh user to ADMIN directly in the database (there is
  // deliberately no promote endpoint — same approach as
  // admin-users.e2e-spec.ts) and re-logs-in so the access token carries the
  // ADMIN role claim the gateway reads to decide room membership.
  async function registerAdmin(): Promise<{ id: string; accessToken: string }> {
    const user = await registerUser();

    await app.get(PrismaService).user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });

    const authMethod = await app
      .get(PrismaService)
      .authMethod.findFirst({ where: { userId: user.id } });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-forwarded-for', uniqueIp())
      .send({ email: authMethod?.email, password: 'correct-horse-battery' })
      .expect(200);

    return { id: user.id, accessToken: login.body.accessToken };
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

  // handleConnection joins rooms asynchronously (it awaits TokenService
  // first) — the client's own 'connect' event fires as soon as the
  // engine.io handshake is acked, which can race ahead of that room join.
  // Polling actual room membership through the real adapter (works the
  // same whether it's in-memory or, as here, Redis-backed) is the
  // deterministic way to know the join has landed before emitting to it.
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
    originalCorsOrigins = process.env.CORS_ORIGINS;
    process.env.CORS_ORIGINS = `${CONFIGURED_ORIGIN},${OTHER_CONFIGURED_ORIGIN}`;

    app = await createTestApp();
    await app.listen({ port: 0, host: '127.0.0.1' });

    const address: string | AddressInfo | null = app.getHttpServer().address();
    const port: number = typeof address === 'object' && address !== null ? address.port : 0;

    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await app.close();

    if (originalCorsOrigins === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = originalCorsOrigins;
  });

  afterEach(() => {
    while (openSockets.length > 0) openSockets.pop()?.disconnect();
  });

  it('connects with a valid token and joins its user room', async () => {
    const user = await registerUser();
    const socket: Socket = connect(user.accessToken);
    const room: string = buildUserRoom(user.id);

    await waitForConnect(socket);
    await waitForRoomMember(room);

    const received: Promise<{ hello: string }> = waitForEvent(socket, NOTIFICATION_EVENT);

    app.get(NotificationGateway).server.to(room).emit(NOTIFICATION_EVENT, { hello: 'world' });

    await expect(received).resolves.toEqual({ hello: 'world' });
  });

  it('joins the admins room in addition to its own user room when ADMIN', async () => {
    const admin = await registerAdmin();
    const socket: Socket = connect(admin.accessToken);

    await waitForConnect(socket);
    await waitForRoomMember(ADMIN_ROOM);

    const received: Promise<{ broadcast: boolean }> = waitForEvent(socket, NOTIFICATION_EVENT);

    app
      .get(NotificationGateway)
      .server.to(ADMIN_ROOM)
      .emit(NOTIFICATION_EVENT, { broadcast: true });

    await expect(received).resolves.toEqual({ broadcast: true });
  });

  it('rejects and disconnects a connection carrying a garbage token', async () => {
    const socket: Socket = connect('not-a-real-token');

    // No event is emitted to a rejected client (see
    // NotificationGateway.rejectHandshake) — only the disconnect itself is
    // observable, exactly as intended (nothing about the failure leaks).
    const disconnected: Promise<void> = new Promise((resolve) =>
      socket.once('disconnect', () => resolve()),
    );

    await disconnected;
  });

  // One parse, one source: the socket endpoint and the HTTP app must answer
  // an origin question identically, because both read AppConfig.corsOrigins.
  // Asserting the two answers against each other (not against a literal) is
  // what makes them impossible to drift apart again.
  describe('socket CORS shares one source with HTTP CORS', () => {
    async function httpAllowOrigin(origin: string): Promise<string | undefined> {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/providers')
        .set('origin', origin)
        .expect(200);

      return response.headers['access-control-allow-origin'];
    }

    // engine.io's polling handshake is the socket transport's own CORS-bearing
    // response — the same endpoint a browser preflights before upgrading.
    async function socketAllowOrigin(origin: string): Promise<string | undefined> {
      const response = await request(app.getHttpServer())
        .get('/socket.io/?EIO=4&transport=polling')
        .set('origin', origin)
        .expect(200);

      return response.headers['access-control-allow-origin'];
    }

    it('allows every configured origin on both transports', async () => {
      for (const origin of [CONFIGURED_ORIGIN, OTHER_CONFIGURED_ORIGIN]) {
        const fromHttp: string | undefined = await httpAllowOrigin(origin);
        const fromSocket: string | undefined = await socketAllowOrigin(origin);

        expect(fromHttp).toBe(origin);
        expect(fromSocket).toBe(fromHttp);
      }
    });

    it('rejects an unconfigured origin on both transports', async () => {
      const fromHttp: string | undefined = await httpAllowOrigin('https://evil.example');
      const fromSocket: string | undefined = await socketAllowOrigin('https://evil.example');

      expect(fromHttp).toBeUndefined();
      expect(fromSocket).toBe(fromHttp);
    });

    it('never allows the gateway’s former hard-coded localhost fallback', async () => {
      expect(await socketAllowOrigin('http://localhost:5173')).toBeUndefined();
      expect(await httpAllowOrigin('http://localhost:5173')).toBeUndefined();
    });
  });

  it('disconnects a live socket once its session is revoked (heartbeat re-check)', async () => {
    const user = await registerUser();
    const socket: Socket = connect(user.accessToken);

    await waitForConnect(socket);

    const disconnected: Promise<void> = new Promise((resolve) =>
      socket.once('disconnect', () => resolve()),
    );

    // Revokes the access token from the Redis allowlist instantly (same
    // mechanism session.e2e-spec.ts proves for HTTP) — the socket itself
    // stays open until the next heartbeat sweep notices. The e2e env pins
    // WEBSOCKET_HEARTBEAT_INTERVAL_MS to 200ms (vitest.e2e.config.ts) so
    // this doesn't wait the production 60s default.
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('authorization', `Bearer ${user.accessToken}`)
      .expect(204);

    await disconnected;
  });
});

// backend.md §12's "no third state" for the socket transport. The e2e env
// pins WEBSOCKET_ENABLED=true for every other suite, so this one builds its
// own app with the flag off — the whole point is that bootstrap, not the
// gateway, is what turns the transport off.
describe('websocket notification gateway (WEBSOCKET_ENABLED=false)', () => {
  let app: NestFastifyApplication;
  let baseUrl: string;
  let originalFlag: string | undefined;

  beforeAll(async () => {
    originalFlag = process.env.WEBSOCKET_ENABLED;
    process.env.WEBSOCKET_ENABLED = 'false';

    app = await createTestApp();
    await app.listen({ port: 0, host: '127.0.0.1' });

    const address: string | AddressInfo | null = app.getHttpServer().address();
    const port: number = typeof address === 'object' && address !== null ? address.port : 0;

    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await app.close();

    if (originalFlag === undefined) delete process.env.WEBSOCKET_ENABLED;
    else process.env.WEBSOCKET_ENABLED = originalFlag;
  });

  it('exposes no socket endpoint on the API port', async () => {
    // A 404 (not an engine.io open packet) is the observable proof that no
    // Socket.IO server is attached to the HTTP server at all.
    await request(app.getHttpServer()).get('/socket.io/?EIO=4&transport=polling').expect(404);
  });

  it('refuses a handshake outright instead of accepting then dropping it', async () => {
    const email: string = `ws-off-e2e-${randomUUID()}@example.com`;
    const registered = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', `10.${Math.floor(Math.random() * 255)}.9.9`)
      .send({ displayName: 'WS Off E2E', email, password: 'correct-horse-battery' })
      .expect(201);

    const socket: Socket = io(baseUrl, {
      auth: { token: registered.body.accessToken },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });

    try {
      const outcome: string = await new Promise((resolve) => {
        socket.once('connect', () => resolve('connected'));
        socket.once('connect_error', () => resolve('refused'));
      });

      // "connected" here would mean the accept-then-disconnect reconnect-loop
      // behaviour the disabled adapter exists to prevent.
      expect(outcome).toBe('refused');
    } finally {
      socket.disconnect();
    }
  });

  it('still serves HTTP, so the flag scopes to the socket transport only', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/providers').expect(200);
  });
});
