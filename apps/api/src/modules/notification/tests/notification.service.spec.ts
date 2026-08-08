import type { CurrentUserInterface } from '@interfaces/current-user.interface.js';
import { ForbiddenError } from '@modules/common/errors/forbidden.error.js';
import { NotFoundError } from '@modules/common/errors/not-found.error.js';
import type { NotificationInterface } from '@modules/notification/interfaces/notification.interface.js';
import type { NotificationListItemInterface } from '@modules/notification/interfaces/notification-list-item.interface.js';
import type { NotificationRepositoryInterface } from '@modules/notification/interfaces/notification-repository.interface.js';
import { NotificationService } from '@modules/notification/services/notification.service.js';
import {
  NotificationAudienceEnum,
  NotificationTypeEnum,
  UserRoleEnum,
} from '@nest-aws-starter/shared';
import { describe, expect, it, vi } from 'vitest';

const ownerId = '01890a5d-0000-774b-bcce-b30209990001';
const strangerId = '01890a5d-0000-774b-bcce-b30209990002';
const adminId = '01890a5d-0000-774b-bcce-b30209990003';

const owner: CurrentUserInterface = { id: ownerId, role: UserRoleEnum.USER, sessionId: 's1' };
const stranger: CurrentUserInterface = { id: strangerId, role: UserRoleEnum.USER, sessionId: 's2' };
const admin: CurrentUserInterface = { id: adminId, role: UserRoleEnum.ADMIN, sessionId: 's3' };

const userRow: NotificationInterface = {
  id: '01890a5d-ac96-774b-bcce-b302099a8057',
  audience: NotificationAudienceEnum.USER,
  userId: ownerId,
  type: NotificationTypeEnum.NEW_DEVICE_LOGIN,
  title: 'New device sign-in',
  body: 'body',
  meta: {},
  createdAt: new Date('2026-08-05T00:00:00Z'),
};

const adminRow: NotificationInterface = {
  id: '01890a5d-ac96-774b-bcce-b302099a9999',
  audience: NotificationAudienceEnum.ADMIN,
  userId: null,
  type: NotificationTypeEnum.USER_BLOCKED,
  title: 'User blocked',
  body: 'body',
  meta: {},
  createdAt: new Date('2026-08-05T00:00:00Z'),
};

interface TestSetupInterface {
  readonly service: NotificationService;
  readonly repository: NotificationRepositoryInterface;
}

function createService(
  overrides: Partial<NotificationRepositoryInterface> = {},
): TestSetupInterface {
  const repository: NotificationRepositoryInterface = {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(userRow),
    findManyAfter: vi.fn().mockResolvedValue([]),
    countUnread: vi.fn().mockResolvedValue(0),
    markRead: vi.fn().mockResolvedValue(undefined),
    markAllRead: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const service: NotificationService = new NotificationService(repository);

  return { service, repository };
}

describe('NotificationService', () => {
  describe('findMany', () => {
    it('scopes a plain USER to their own rows only and pages by cursor', async () => {
      const item: NotificationListItemInterface = { ...userRow, readAt: null };
      const findManyAfter = vi.fn().mockResolvedValue([item]);
      const { service } = createService({ findManyAfter });

      const page = await service.findMany(
        owner,
        { cursor: null, limit: 20 },
        { unreadOnly: false },
      );

      expect(findManyAfter).toHaveBeenCalledWith(
        { cursor: null, limit: 20 },
        { userId: ownerId, includeAdmin: false, unreadOnly: false },
      );
      expect(page.items).toEqual([item]);
      expect(page.nextCursor).toBeNull();
    });

    it('includes ADMIN-audience rows in the scope for an ADMIN caller', async () => {
      const findManyAfter = vi.fn().mockResolvedValue([]);
      const { service } = createService({ findManyAfter });

      await service.findMany(admin, { cursor: null, limit: 20 }, { unreadOnly: true });

      expect(findManyAfter).toHaveBeenCalledWith(
        { cursor: null, limit: 20 },
        { userId: adminId, includeAdmin: true, unreadOnly: true },
      );
    });

    it('forwards the server-side type/audience filters into the repository query', async () => {
      const findManyAfter = vi.fn().mockResolvedValue([]);
      const { service } = createService({ findManyAfter });

      await service.findMany(
        admin,
        { cursor: null, limit: 20 },
        {
          unreadOnly: false,
          type: NotificationTypeEnum.CONTACT_MESSAGE,
          audience: NotificationAudienceEnum.ADMIN,
        },
      );

      expect(findManyAfter).toHaveBeenCalledWith(
        { cursor: null, limit: 20 },
        {
          userId: adminId,
          includeAdmin: true,
          unreadOnly: false,
          type: NotificationTypeEnum.CONTACT_MESSAGE,
          audience: NotificationAudienceEnum.ADMIN,
        },
      );
    });

    it('sets nextCursor to the last item id only when the page is full', async () => {
      const items: NotificationListItemInterface[] = [
        { ...userRow, id: 'a', readAt: null },
        { ...userRow, id: 'b', readAt: null },
      ];
      const { service } = createService({ findManyAfter: vi.fn().mockResolvedValue(items) });

      const fullPage = await service.findMany(
        owner,
        { cursor: null, limit: 2 },
        { unreadOnly: false },
      );

      expect(fullPage.nextCursor).toBe('b');

      const { service: shortService } = createService({
        findManyAfter: vi.fn().mockResolvedValue([items[0]]),
      });
      const shortPage = await shortService.findMany(
        owner,
        { cursor: null, limit: 2 },
        { unreadOnly: false },
      );

      expect(shortPage.nextCursor).toBeNull();
    });
  });

  describe('countUnread', () => {
    it('wraps the repository count in the wire shape', async () => {
      const { service } = createService({ countUnread: vi.fn().mockResolvedValue(5) });

      await expect(service.countUnread(owner)).resolves.toEqual({ count: 5 });
    });
  });

  describe('markRead — ownership', () => {
    it('is a no-op success for the owning user (delegates to the idempotent repository)', async () => {
      const { service, repository } = createService({
        findById: vi.fn().mockResolvedValue(userRow),
      });

      await service.markRead(userRow.id, owner);

      expect(repository.markRead).toHaveBeenCalledWith(userRow.id, ownerId);
    });

    it('throws 404 for a missing notification', async () => {
      const { service, repository } = createService({ findById: vi.fn().mockResolvedValue(null) });

      await expect(service.markRead('missing-id', owner)).rejects.toBeInstanceOf(NotFoundError);
      expect(repository.markRead).not.toHaveBeenCalled();
    });

    it('throws 403 for a USER-audience row belonging to another user', async () => {
      const { service, repository } = createService({
        findById: vi.fn().mockResolvedValue(userRow),
      });

      const caught: unknown = await service
        .markRead(userRow.id, stranger)
        .then(() => null)
        .catch((error: unknown): unknown => error);

      expect(caught).toBeInstanceOf(ForbiddenError);
      expect((caught as ForbiddenError).args.code).toBe('NOTIFICATION_ACCESS_DENIED');
      expect(repository.markRead).not.toHaveBeenCalled();
    });

    it('throws 403 for an ADMIN-audience row when the caller is a plain USER', async () => {
      const { service, repository } = createService({
        findById: vi.fn().mockResolvedValue(adminRow),
      });

      await expect(service.markRead(adminRow.id, owner)).rejects.toBeInstanceOf(ForbiddenError);
      expect(repository.markRead).not.toHaveBeenCalled();
    });

    it('allows an ADMIN caller to mark an ADMIN-audience row read', async () => {
      const { service, repository } = createService({
        findById: vi.fn().mockResolvedValue(adminRow),
      });

      await service.markRead(adminRow.id, admin);

      expect(repository.markRead).toHaveBeenCalledWith(adminRow.id, adminId);
    });
  });

  describe('markAllRead', () => {
    it('scopes to the caller — includeAdmin only for an ADMIN role', async () => {
      const { service, repository } = createService();

      await service.markAllRead(owner);

      expect(repository.markAllRead).toHaveBeenCalledWith({ userId: ownerId, includeAdmin: false });

      await service.markAllRead(admin);

      expect(repository.markAllRead).toHaveBeenCalledWith({ userId: adminId, includeAdmin: true });
    });
  });
});
