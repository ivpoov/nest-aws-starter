import { NotFoundError } from '@modules/common/errors/not-found.error.js';
import type { ContactMessageInterface } from '@modules/contact-us/interfaces/contact-message.interface.js';
import type { ContactMessageRepositoryInterface } from '@modules/contact-us/interfaces/contact-message-repository.interface.js';
import { ContactMessageService } from '@modules/contact-us/services/contact-message.service.js';
import type { EventBusService } from '@modules/event/services/event-bus.service.js';
import { ContactMessageStatusEnum } from '@nest-aws-starter/shared';
import { describe, expect, it, vi } from 'vitest';

const message: ContactMessageInterface = {
  id: '01890a5d-ac96-774b-bcce-b302099a8057',
  name: 'Jane Doe',
  email: 'jane@example.com',
  subject: 'Question',
  body: 'Hi there',
  status: ContactMessageStatusEnum.OPEN,
  createdAt: new Date('2026-08-03T12:00:00Z'),
  updatedAt: new Date('2026-08-03T12:00:00Z'),
};

interface TestSetupInterface {
  readonly service: ContactMessageService;
  readonly repository: ContactMessageRepositoryInterface;
  readonly emit: ReturnType<typeof vi.fn>;
}

function createService(
  overrides: Partial<ContactMessageRepositoryInterface> = {},
): TestSetupInterface {
  const repository: ContactMessageRepositoryInterface = {
    create: vi.fn().mockResolvedValue(message),
    findManyAfter: vi.fn().mockResolvedValue([message]),
    updateStatus: vi.fn().mockResolvedValue(message),
    ...overrides,
  };
  const emit = vi.fn();
  const eventBus = { emit } as unknown as EventBusService;
  const service: ContactMessageService = new ContactMessageService(repository, eventBus);

  return { service, repository, emit };
}

describe('ContactMessageService', () => {
  const data = {
    name: 'Jane Doe',
    email: 'jane@example.com',
    subject: 'Question',
    body: 'Hi there',
  };

  it('persists the message and emits contact.received on a clean submission', async () => {
    const { service, repository, emit } = createService();

    await service.submit(data, undefined, '127.0.0.1');

    expect(repository.create).toHaveBeenCalledWith(data);
    expect(emit).toHaveBeenCalledWith('contact.received', {
      contactMessageId: message.id,
      ip: '127.0.0.1',
    });
  });

  it('short-circuits silently when the honeypot field is filled, never persisting', async () => {
    const { service, repository, emit } = createService();

    await service.submit(data, 'i-am-a-bot', '127.0.0.1');

    expect(repository.create).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('pages the admin list by cursor', async () => {
    const secondMessage: ContactMessageInterface = {
      ...message,
      id: '01890a5d-ac96-774b-bcce-b302099a9999',
    };
    const findManyAfter = vi.fn().mockResolvedValue([message, secondMessage]);
    const { service } = createService({ findManyAfter });

    const fullPage = await service.findMany({ cursor: null, limit: 2 }, {});

    expect(findManyAfter).toHaveBeenCalledWith({ cursor: null, limit: 2 }, {});
    expect(fullPage.items).toHaveLength(2);
    expect(fullPage.nextCursor).toBe(secondMessage.id);

    const { service: shortService } = createService({
      findManyAfter: vi.fn().mockResolvedValue([message]),
    });
    const shortPage = await shortService.findMany({ cursor: null, limit: 2 }, {});

    expect(shortPage.nextCursor).toBeNull();
  });

  it('updates status and returns the updated message', async () => {
    const resolved: ContactMessageInterface = {
      ...message,
      status: ContactMessageStatusEnum.RESOLVED,
    };
    const updateStatus = vi.fn().mockResolvedValue(resolved);
    const { service } = createService({ updateStatus });

    const result = await service.updateStatus(message.id, ContactMessageStatusEnum.RESOLVED);

    expect(updateStatus).toHaveBeenCalledWith(message.id, ContactMessageStatusEnum.RESOLVED);
    expect(result.status).toBe(ContactMessageStatusEnum.RESOLVED);
  });

  it('throws the coded not-found error when updating a missing message', async () => {
    const { service } = createService({ updateStatus: vi.fn().mockResolvedValue(null) });

    try {
      await service.updateStatus('missing-id', ContactMessageStatusEnum.RESOLVED);
      expect.unreachable('should have thrown');
    } catch (caught) {
      expect(caught).toBeInstanceOf(NotFoundError);
      expect((caught as NotFoundError).args.code).toBe('CONTACT_MESSAGE_NOT_FOUND');
    }
  });
});
