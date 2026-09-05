import type { AppConfig } from '@configs/app.config.js';
import type { WebsocketConfig } from '@configs/websocket.config.js';
import type { CurrentUserInterface } from '@interfaces/current-user.interface.js';
import { NotificationGateway } from '@modules/notification/gateways/notification.gateway.js';
import type { WebsocketHandshakeLimiterService } from '@modules/notification/services/websocket-handshake-limiter.service.js';
import type { AuthenticatedSocketType } from '@modules/notification/types/authenticated-socket.type.js';
import { TokenService } from '@modules/token/services/token.service.js';
import { UserRoleEnum } from '@nest-aws-starter/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function createConfig(overrides: Partial<WebsocketConfig> = {}): WebsocketConfig {
  return {
    isEnabled: true,
    heartbeatIntervalMs: 60_000,
    maxConnectionsPerUser: 10,
    handshakesPerMinutePerIp: 30,
    heartbeatConcurrency: 25,
    maxPayloadBytes: 8_192,
    ...overrides,
  };
}

function createUser(overrides: Partial<CurrentUserInterface> = {}): CurrentUserInterface {
  return { id: 'user-1', role: UserRoleEnum.USER, sessionId: 'session-1', ...overrides };
}

// `address` and `headers` are what the handshake rate limiter buckets on, so
// every fake socket carries them.
function createSocket(
  auth: Record<string, unknown> = {},
  handshake: Record<string, unknown> = {},
): AuthenticatedSocketType {
  return {
    id: `socket-${Math.random()}`,
    handshake: { auth, address: '203.0.113.7', headers: {}, ...handshake },
    data: undefined,
    connected: true,
    disconnect: vi.fn(),
    emit: vi.fn(),
    join: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuthenticatedSocketType;
}

// socket.io flips `connected` itself when the transport dies; tests drive it
// directly to reproduce the interleavings that flag is there to catch.
function setConnected(client: AuthenticatedSocketType, connected: boolean): void {
  (client as unknown as { connected: boolean }).connected = connected;
}

// TRUST_PROXY off by default here: the address bucket then comes straight from
// the socket, which is the simpler half of addressOf() and the one most specs
// do not care about.
const untrustedProxyApp = { trustProxy: false } as AppConfig;

describe('NotificationGateway', () => {
  let tokenService: { verifyAccessToken: ReturnType<typeof vi.fn> };
  let handshakeLimiter: { isWithinLimit: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    tokenService = { verifyAccessToken: vi.fn() };
    handshakeLimiter = { isWithinLimit: vi.fn().mockResolvedValue(true) };
  });

  function createGateway(
    config: WebsocketConfig = createConfig(),
    app: AppConfig = untrustedProxyApp,
  ): NotificationGateway {
    return new NotificationGateway(
      config,
      app,
      tokenService as unknown as TokenService,
      handshakeLimiter as unknown as WebsocketHandshakeLimiterService,
    );
  }

  describe('handleConnection', () => {
    it('disconnects immediately without verifying when the gateway is disabled', async () => {
      const gateway: NotificationGateway = createGateway(createConfig({ isEnabled: false }));
      const client: AuthenticatedSocketType = createSocket({ token: 'irrelevant' });

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(tokenService.verifyAccessToken).not.toHaveBeenCalled();
    });

    it('rejects a handshake with no auth.token', async () => {
      const gateway: NotificationGateway = createGateway();
      const client: AuthenticatedSocketType = createSocket();

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.emit).not.toHaveBeenCalled();
      expect(tokenService.verifyAccessToken).not.toHaveBeenCalled();
    });

    it('rejects a handshake whose token fails verification', async () => {
      tokenService.verifyAccessToken.mockRejectedValue(new Error('bad token'));

      const gateway: NotificationGateway = createGateway();
      const client: AuthenticatedSocketType = createSocket({ token: 'bad' });

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.emit).not.toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });

    it('joins only the user room for a plain USER', async () => {
      const user: CurrentUserInterface = createUser({ id: 'user-42', role: UserRoleEnum.USER });

      tokenService.verifyAccessToken.mockResolvedValue(user);

      const gateway: NotificationGateway = createGateway();
      const client: AuthenticatedSocketType = createSocket({ token: 'good' });

      await gateway.handleConnection(client);

      expect(client.join).toHaveBeenCalledExactlyOnceWith('user:user-42');
      expect(client.disconnect).not.toHaveBeenCalled();
      expect(client.data).toEqual({ user, token: 'good' });
    });

    it('joins both the user room and the admins room for an ADMIN', async () => {
      const user: CurrentUserInterface = createUser({ id: 'admin-1', role: UserRoleEnum.ADMIN });

      tokenService.verifyAccessToken.mockResolvedValue(user);

      const gateway: NotificationGateway = createGateway();
      const client: AuthenticatedSocketType = createSocket({ token: 'good' });

      await gateway.handleConnection(client);

      expect(client.join).toHaveBeenCalledWith('user:admin-1');
      expect(client.join).toHaveBeenCalledWith('admins');
      expect(client.join).toHaveBeenCalledTimes(2);
    });
  });

  describe('heartbeat revalidation', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('does not start a sweep when the gateway is disabled', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      const gateway: NotificationGateway = createGateway(createConfig({ isEnabled: false }));

      gateway.afterInit();

      expect(setIntervalSpy).not.toHaveBeenCalled();
    });

    it('re-verifies every tracked socket on each tick and disconnects on revocation', async () => {
      const user: CurrentUserInterface = createUser();

      tokenService.verifyAccessToken.mockResolvedValue(user);

      const gateway: NotificationGateway = createGateway(
        createConfig({ heartbeatIntervalMs: 1_000 }),
      );
      const client: AuthenticatedSocketType = createSocket({ token: 'good' });

      gateway.afterInit();
      await gateway.handleConnection(client);
      tokenService.verifyAccessToken.mockClear();

      tokenService.verifyAccessToken.mockResolvedValueOnce(user);
      await vi.advanceTimersByTimeAsync(1_000);

      expect(tokenService.verifyAccessToken).toHaveBeenCalledExactlyOnceWith('good');
      expect(client.disconnect).not.toHaveBeenCalled();

      tokenService.verifyAccessToken.mockRejectedValueOnce(new Error('revoked'));
      await vi.advanceTimersByTimeAsync(1_000);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.emit).not.toHaveBeenCalled();
    });

    it('stops sweeping a socket once it has disconnected', async () => {
      const user: CurrentUserInterface = createUser();

      tokenService.verifyAccessToken.mockResolvedValue(user);

      const gateway: NotificationGateway = createGateway(
        createConfig({ heartbeatIntervalMs: 1_000 }),
      );
      const client: AuthenticatedSocketType = createSocket({ token: 'good' });

      gateway.afterInit();
      await gateway.handleConnection(client);
      gateway.handleDisconnect(client);
      tokenService.verifyAccessToken.mockClear();

      await vi.advanceTimersByTimeAsync(1_000);

      expect(tokenService.verifyAccessToken).not.toHaveBeenCalled();
    });

    // The tracked-socket set is private by design, so both cases below prove
    // eviction the way the leak would actually hurt: a retained entry costs
    // one token verify + Redis allowlist hit on every tick, forever. Reviving
    // `connected` after the first tick distinguishes "evicted" from merely
    // "skipped this time" — a set that still held the socket would verify it
    // again the moment it looked alive.
    it('does not retain a socket that dropped during the handshake window', async () => {
      const user: CurrentUserInterface = createUser();
      const gateway: NotificationGateway = createGateway(
        createConfig({ heartbeatIntervalMs: 1_000 }),
      );
      const client: AuthenticatedSocketType = createSocket({ token: 'good' });

      // Real interleaving: engine.io fires disconnect while handleConnection
      // is still awaiting the verify, so handleDisconnect deletes from a set
      // the socket has not been added to yet.
      tokenService.verifyAccessToken.mockImplementation(async (): Promise<CurrentUserInterface> => {
        setConnected(client, false);
        gateway.handleDisconnect(client);

        return user;
      });

      gateway.afterInit();
      await gateway.handleConnection(client);

      tokenService.verifyAccessToken.mockReset();
      tokenService.verifyAccessToken.mockResolvedValue(user);

      await vi.advanceTimersByTimeAsync(1_000);

      expect(tokenService.verifyAccessToken).not.toHaveBeenCalled();

      setConnected(client, true);
      await vi.advanceTimersByTimeAsync(1_000);

      expect(tokenService.verifyAccessToken).not.toHaveBeenCalled();
    });

    it('evicts a tracked socket whose transport died without a disconnect event', async () => {
      const user: CurrentUserInterface = createUser();

      tokenService.verifyAccessToken.mockResolvedValue(user);

      const gateway: NotificationGateway = createGateway(
        createConfig({ heartbeatIntervalMs: 1_000 }),
      );
      const client: AuthenticatedSocketType = createSocket({ token: 'good' });

      gateway.afterInit();
      await gateway.handleConnection(client);
      setConnected(client, false);
      tokenService.verifyAccessToken.mockClear();

      await vi.advanceTimersByTimeAsync(1_000);

      expect(tokenService.verifyAccessToken).not.toHaveBeenCalled();

      setConnected(client, true);
      await vi.advanceTimersByTimeAsync(1_000);

      expect(tokenService.verifyAccessToken).not.toHaveBeenCalled();
    });

    it('clears the sweep interval on module destroy, leaving no live timer', async () => {
      const user: CurrentUserInterface = createUser();

      tokenService.verifyAccessToken.mockResolvedValue(user);

      const gateway: NotificationGateway = createGateway(
        createConfig({ heartbeatIntervalMs: 1_000 }),
      );
      const client: AuthenticatedSocketType = createSocket({ token: 'good' });

      gateway.afterInit();
      await gateway.handleConnection(client);
      tokenService.verifyAccessToken.mockClear();

      gateway.onModuleDestroy();
      await vi.advanceTimersByTimeAsync(5_000);

      expect(tokenService.verifyAccessToken).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('onModuleDestroy is a no-op when no sweep was ever started', () => {
      const gateway: NotificationGateway = createGateway();

      expect(() => gateway.onModuleDestroy()).not.toThrow();
    });
  });

  describe('limits', () => {
    // One valid token could previously open unbounded sockets, and every one of
    // them cost a JWT verify plus a Redis read on every heartbeat tick. The cap
    // is what stops a single account turning the sweep into a load generator.
    it('refuses a connection once the user is at the cap', async () => {
      const gateway: NotificationGateway = createGateway(
        createConfig({ maxConnectionsPerUser: 2 }),
      );
      tokenService.verifyAccessToken.mockResolvedValue(createUser());

      const first: AuthenticatedSocketType = createSocket({ token: 'valid' });
      const second: AuthenticatedSocketType = createSocket({ token: 'valid' });
      const third: AuthenticatedSocketType = createSocket({ token: 'valid' });

      await gateway.handleConnection(first);
      await gateway.handleConnection(second);
      await gateway.handleConnection(third);

      expect(first.disconnect).not.toHaveBeenCalled();
      expect(second.disconnect).not.toHaveBeenCalled();
      expect(third.disconnect).toHaveBeenCalledWith(true);
    });

    // The cap is per user, not global: one noisy account must not lock anybody
    // else out.
    it('counts the cap per user rather than across all of them', async () => {
      const gateway: NotificationGateway = createGateway(
        createConfig({ maxConnectionsPerUser: 1 }),
      );
      tokenService.verifyAccessToken.mockResolvedValueOnce(createUser({ id: 'user-a' }));
      tokenService.verifyAccessToken.mockResolvedValueOnce(createUser({ id: 'user-b' }));

      const a: AuthenticatedSocketType = createSocket({ token: 'valid' });
      const b: AuthenticatedSocketType = createSocket({ token: 'valid' });

      await gateway.handleConnection(a);
      await gateway.handleConnection(b);

      expect(a.disconnect).not.toHaveBeenCalled();
      expect(b.disconnect).not.toHaveBeenCalled();
    });

    // Disconnecting has to free the slot, or the cap becomes a permanent lockout
    // after enough reconnects.
    it('frees the slot when a socket disconnects', async () => {
      const gateway: NotificationGateway = createGateway(
        createConfig({ maxConnectionsPerUser: 1 }),
      );
      tokenService.verifyAccessToken.mockResolvedValue(createUser());

      const first: AuthenticatedSocketType = createSocket({ token: 'valid' });
      await gateway.handleConnection(first);
      gateway.handleDisconnect(first);

      const second: AuthenticatedSocketType = createSocket({ token: 'valid' });
      await gateway.handleConnection(second);

      expect(second.disconnect).not.toHaveBeenCalled();
    });

    // Rejected BEFORE the verify: rejecting afterwards still pays the JWT
    // verify and the Redis allowlist read that make a connect flood expensive,
    // which is the entire cost the limit exists to avoid.
    it('rejects a rate-limited handshake without verifying the token', async () => {
      const gateway: NotificationGateway = createGateway();
      handshakeLimiter.isWithinLimit.mockResolvedValue(false);
      const client: AuthenticatedSocketType = createSocket({ token: 'valid' });

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(tokenService.verifyAccessToken).not.toHaveBeenCalled();
    });

    it('buckets the rate limit on the socket address when the proxy is untrusted', async () => {
      const gateway: NotificationGateway = createGateway();
      tokenService.verifyAccessToken.mockResolvedValue(createUser());

      await gateway.handleConnection(
        createSocket({ token: 'valid' }, { headers: { 'x-forwarded-for': '198.51.100.9' } }),
      );

      expect(handshakeLimiter.isWithinLimit).toHaveBeenCalledWith('203.0.113.7');
    });

    // Behind a load balancer every socket shares the balancer's address, so
    // without this the whole fleet would share one bucket and the first thirty
    // handshakes a minute would lock everybody out.
    it('buckets on the forwarded client address when the proxy is trusted', async () => {
      const gateway: NotificationGateway = createGateway(createConfig(), {
        trustProxy: true,
      } as AppConfig);
      tokenService.verifyAccessToken.mockResolvedValue(createUser());

      await gateway.handleConnection(
        createSocket(
          { token: 'valid' },
          { headers: { 'x-forwarded-for': '198.51.100.9, 203.0.113.1' } },
        ),
      );

      expect(handshakeLimiter.isWithinLimit).toHaveBeenCalledWith('198.51.100.9');
    });
  });
});
