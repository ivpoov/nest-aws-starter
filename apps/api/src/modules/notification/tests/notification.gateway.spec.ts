import type { WebsocketConfig } from '@configs/websocket.config.js';
import type { CurrentUserInterface } from '@interfaces/current-user.interface.js';
import { NotificationGateway } from '@modules/notification/gateways/notification.gateway.js';
import type { AuthenticatedSocketType } from '@modules/notification/types/authenticated-socket.type.js';
import { TokenService } from '@modules/token/services/token.service.js';
import { UserRoleEnum } from '@nest-aws-starter/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function createConfig(overrides: Partial<WebsocketConfig> = {}): WebsocketConfig {
  return { isEnabled: true, heartbeatIntervalMs: 60_000, ...overrides };
}

function createUser(overrides: Partial<CurrentUserInterface> = {}): CurrentUserInterface {
  return { id: 'user-1', role: UserRoleEnum.USER, sessionId: 'session-1', ...overrides };
}

function createSocket(auth: Record<string, unknown> = {}): AuthenticatedSocketType {
  return {
    id: `socket-${Math.random()}`,
    handshake: { auth },
    data: undefined,
    disconnect: vi.fn(),
    emit: vi.fn(),
    join: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuthenticatedSocketType;
}

describe('NotificationGateway', () => {
  let tokenService: { verifyAccessToken: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    tokenService = { verifyAccessToken: vi.fn() };
  });

  function createGateway(config: WebsocketConfig = createConfig()): NotificationGateway {
    return new NotificationGateway(config, tokenService as unknown as TokenService);
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
});
