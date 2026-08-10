import type { WebsocketConfig } from '@configs/websocket.config.js';
import { websocketConfig } from '@configs/websocket.config.js';
import type { CurrentUserInterface } from '@interfaces/current-user.interface.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { NOTIFICATION_WS_AUTH_FAILED } from '@modules/notification/constants/notification-errors.constants.js';
import {
  ADMIN_ROOM,
  buildUserRoom,
} from '@modules/notification/constants/notification-rooms.constants.js';
import type { AuthenticatedSocketType } from '@modules/notification/types/authenticated-socket.type.js';
import { TokenService } from '@modules/token/services/token.service.js';
import { UserRoleEnum } from '@nest-aws-starter/shared';
import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server } from 'socket.io';

// Default namespace/path (`/socket.io`). Handshake carries the access token
// in `auth.token` (no cookies — same contract as the HTTP bearer header),
// validated exactly like HTTP via TokenService.verifyAccessToken (signature
// + Redis allowlist). Room-naming contract PR 3's event subscriber depends on
// lives in constants/notification-rooms.constants.ts.
//
// Deliberately no `cors` here: decorator options evaluate at module-import
// time, before .env is loaded and before DI exists — an env read here once
// silently diverged from HTTP CORS. The origins are injected at bootstrap
// by RedisIoAdapter.createIOServer from the same AppConfig.corsOrigins the
// HTTP layer uses (backend.md §11b: transport options that need config are
// an adapter concern, never decorator options).
@WebSocketGateway()
@Injectable()
export class NotificationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  private readonly logger = new CustomLoggerService(NotificationGateway.name);
  private readonly sockets = new Set<AuthenticatedSocketType>();
  private heartbeatIntervalHandle: NodeJS.Timeout | null = null;

  @WebSocketServer()
  public readonly server!: Server;

  constructor(
    @Inject(websocketConfig.KEY) private readonly config: WebsocketConfig,
    private readonly tokenService: TokenService,
  ) {}

  // Shared sweep, not one setInterval per socket: at scale N per-socket
  // timers means N independently-firing callbacks (event-loop/GC pressure,
  // N handles to track). One interval walking the tracked socket set
  // re-validates all of them per tick, with a single handle to clear on
  // shutdown (onModuleDestroy below) — cheaper and simpler to reason about.
  public afterInit(): void {
    if (!this.config.isEnabled) {
      this.logger.log(
        'Notification gateway disabled (WEBSOCKET_ENABLED=false) — no heartbeat sweep started',
      );

      return;
    }

    this.heartbeatIntervalHandle = setInterval(
      () => void this.revalidateAll(),
      this.config.heartbeatIntervalMs,
    );
  }

  public onModuleDestroy(): void {
    if (!this.heartbeatIntervalHandle) return;

    clearInterval(this.heartbeatIntervalHandle);
    this.heartbeatIntervalHandle = null;
  }

  public async handleConnection(client: AuthenticatedSocketType): Promise<void> {
    if (!this.config.isEnabled) {
      client.disconnect(true);

      return;
    }

    const token: string | undefined = this.extractToken(client);

    if (!token) {
      this.rejectHandshake(client, 'missing auth.token');

      return;
    }

    const user: CurrentUserInterface | null = await this.verify(client, token);

    if (!user) return;

    client.data = { user, token };
    await this.joinRooms(client, user);
    this.sockets.add(client);

    // A client that dropped during the async verify/join windows has already
    // fired handleDisconnect (against a set it was never in) — without this
    // re-check its dead socket would sit in the set forever, paying one
    // token verify + Redis hit per sweep.
    if (!client.connected) {
      this.sockets.delete(client);

      return;
    }

    this.logger.debug(`WS connected: user=${user.id} socket=${client.id}`);
  }

  public handleDisconnect(client: AuthenticatedSocketType): void {
    this.sockets.delete(client);

    this.logger.debug(`WS disconnected: socket=${client.id}`);
  }

  private async verify(
    client: AuthenticatedSocketType,
    token: string,
  ): Promise<CurrentUserInterface | null> {
    try {
      return await this.tokenService.verifyAccessToken(token);
    } catch (error) {
      this.rejectHandshake(client, this.describeError(error));

      return null;
    }
  }

  private extractToken(client: AuthenticatedSocketType): string | undefined {
    const token: unknown = client.handshake.auth.token;

    return typeof token === 'string' && token.length > 0 ? token : undefined;
  }

  // No event is emitted to the client here on purpose — the gateway's only
  // ever emits `notification`/`unread-count` (see
  // notification-events.constants.ts); an unauthorized socket is simply
  // disconnected, and the real reason is only ever visible server-side.
  private rejectHandshake(client: AuthenticatedSocketType, reason: string): void {
    this.logger.debug(
      `WS auth rejected (${client.id}): ${NOTIFICATION_WS_AUTH_FAILED.code} — ${reason}`,
    );
    client.disconnect(true);
  }

  private describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private async joinRooms(
    client: AuthenticatedSocketType,
    user: CurrentUserInterface,
  ): Promise<void> {
    await client.join(buildUserRoom(user.id));

    if (user.role === UserRoleEnum.ADMIN) await client.join(ADMIN_ROOM);
  }

  private async revalidateAll(): Promise<void> {
    await Promise.all(
      [...this.sockets].map((client: AuthenticatedSocketType) => this.revalidateOne(client)),
    );
  }

  private async revalidateOne(client: AuthenticatedSocketType): Promise<void> {
    // Belt and braces for the handshake-window race above: a socket that is
    // already dead needs no re-verify, only eviction from the set.
    if (!client.connected) {
      this.sockets.delete(client);

      return;
    }

    try {
      await this.tokenService.verifyAccessToken(client.data.token);
    } catch (error) {
      this.rejectHandshake(client, `heartbeat revalidation failed: ${this.describeError(error)}`);
    }
  }
}
