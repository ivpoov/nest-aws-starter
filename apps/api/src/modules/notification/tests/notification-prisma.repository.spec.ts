import { NotificationAudience } from '@generated/prisma/enums.js';
import { NOTIFICATION_RECEIPT_BACKFILL_BATCH_SIZE } from '@modules/notification/constants/notification.constants.js';
import { NotificationPrismaRepository } from '@modules/notification/repositories/notification-prisma.repository.js';
import type { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { describe, expect, it, vi } from 'vitest';

function createRepository(): {
  repository: NotificationPrismaRepository;
  notification: Record<string, ReturnType<typeof vi.fn>>;
  notificationReceipt: Record<string, ReturnType<typeof vi.fn>>;
} {
  const notification = { findMany: vi.fn().mockResolvedValue([]) };
  const notificationReceipt = {
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
  };
  const prisma = { notification, notificationReceipt } as unknown as PrismaService;

  return {
    repository: new NotificationPrismaRepository(prisma),
    notification,
    notificationReceipt,
  };
}

function fakeRows(count: number, offset: number): { id: string }[] {
  return Array.from({ length: count }, (_value, index): { id: string } => ({
    id: `notification-${offset + index}`,
  }));
}

// Read-all backfills a reader receipt for every ADMIN-audience row the admin
// has never seen. That set is "every admin notification since the account was
// created", which for a long-lived account is the whole table — it used to be
// read in one unbounded findMany and written in one createMany.
describe('NotificationPrismaRepository.markAllRead', () => {
  it('backfills admin receipts in bounded batches until the backlog is drained', async () => {
    const { repository, notification, notificationReceipt } = createRepository();

    notification.findMany
      .mockResolvedValueOnce(fakeRows(NOTIFICATION_RECEIPT_BACKFILL_BATCH_SIZE, 0))
      .mockResolvedValueOnce(fakeRows(7, NOTIFICATION_RECEIPT_BACKFILL_BATCH_SIZE))
      .mockResolvedValue([]);

    await repository.markAllRead({ userId: 'admin-1', includeAdmin: true });

    expect(notification.findMany).toHaveBeenCalledTimes(2);
    expect(notificationReceipt.createMany).toHaveBeenCalledTimes(2);
    expect(notification.findMany).toHaveBeenCalledWith({
      where: {
        audience: NotificationAudience.ADMIN,
        id: { gt: 'admin-1' },
        receipts: { none: { userId: 'admin-1' } },
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: NOTIFICATION_RECEIPT_BACKFILL_BATCH_SIZE,
    });
  });

  it('stops after one empty batch and writes no receipts', async () => {
    const { repository, notification, notificationReceipt } = createRepository();

    await repository.markAllRead({ userId: 'admin-1', includeAdmin: true });

    expect(notification.findMany).toHaveBeenCalledTimes(1);
    expect(notificationReceipt.createMany).not.toHaveBeenCalled();
  });

  it('never touches admin rows for a non-admin reader', async () => {
    const { repository, notification, notificationReceipt } = createRepository();

    await repository.markAllRead({ userId: 'user-1', includeAdmin: false });

    expect(notificationReceipt.updateMany).toHaveBeenCalledOnce();
    expect(notification.findMany).not.toHaveBeenCalled();
  });
});
