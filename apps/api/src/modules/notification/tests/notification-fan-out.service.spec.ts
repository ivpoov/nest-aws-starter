import type { WebsocketConfig } from '@configs/websocket.config.js';
import type { NotificationGateway } from '@modules/notification/gateways/notification.gateway.js';
import type { NotificationInterface } from '@modules/notification/interfaces/notification.interface.js';
import type { NotificationRepositoryInterface } from '@modules/notification/interfaces/notification-repository.interface.js';
import type { NotificationEmailService } from '@modules/notification/services/notification-email.service.js';
import { NotificationFanOutService } from '@modules/notification/services/notification-fan-out.service.js';
import { NotificationAudienceEnum, NotificationTypeEnum } from '@nest-aws-starter/shared';
import { describe, expect, it, vi } from 'vitest';

const userId = '01890a5d-0000-774b-bcce-b30209990001';

const websocket: WebsocketConfig = { isEnabled: true, heartbeatIntervalMs: 60_000 };

const notification: NotificationInterface = {
  id: '01890a5d-0000-774b-bcce-b30209990099',
  audience: NotificationAudienceEnum.USER,
  userId,
  type: NotificationTypeEnum.NEW_DEVICE_LOGIN,
  title: 'title',
  body: 'body',
  meta: {},
  createdAt: new Date('2026-08-05T00:00:00.000Z'),
};

interface TestSetupInterface {
  readonly service: NotificationFanOutService;
  readonly emit: ReturnType<typeof vi.fn>;
  readonly sendIfEnabled: ReturnType<typeof vi.fn>;
}

function createService(): TestSetupInterface {
  const emit = vi.fn();
  const to = vi.fn().mockReturnValue({ emit });
  const sendIfEnabled = vi.fn().mockResolvedValue(undefined);
  const notificationRepository = {
    countUnread: vi.fn().mockResolvedValue(0),
  } as unknown as NotificationRepositoryInterface;
  const gateway = { server: { to } } as unknown as NotificationGateway;
  const emailService = { sendIfEnabled } as unknown as NotificationEmailService;

  const service: NotificationFanOutService = new NotificationFanOutService(
    websocket,
    notificationRepository,
    gateway,
    emailService,
  );

  return { service, emit, sendIfEnabled };
}

describe('NotificationFanOutService', () => {
  it('emits both socket events while the application is running', async () => {
    const { service, emit } = createService();

    await service.fanOut(notification);

    // The notification itself, then the recipient's unread count.
    expect(emit).toHaveBeenCalledTimes(2);
  });

  // The emit itself cannot be made safe from here: under the Redis adapter
  // `server.to(...).emit(...)` returns synchronously while the library
  // publishes on a promise it never catches, so a connection closing
  // mid-publish rejects out of reach of any try/catch at the call site — and
  // Node terminates the process for an unhandled rejection. Not emitting at
  // all, once shutdown has begun, is the only place that is preventable.
  // Both hooks, because which one fires first is the whole bug: Nest runs every
  // onModuleDestroy before any onApplicationShutdown, and Redis closes in that
  // first phase. A guard wired only to the later hook is wired to a moment that
  // arrives after the connection has already gone.
  it.each([
    ['onModuleDestroy' as const],
    ['onApplicationShutdown' as const],
  ])('stops emitting to sockets once %s has run', async (hook) => {
    const { service, emit } = createService();

    service[hook]();
    await service.fanOut(notification);

    expect(emit).not.toHaveBeenCalled();
  });

  // Only the live channel is dropped. Email is what a user would otherwise
  // never learn about, and the row is already persisted by the time fan-out
  // runs — whereas a missed socket push is re-fetched by the next client that
  // reconnects.
  it('still sends the email after shutdown has begun', async () => {
    const { service, sendIfEnabled } = createService();

    service.onModuleDestroy();
    await service.fanOut(notification);

    expect(sendIfEnabled).toHaveBeenCalledTimes(1);
  });
});
