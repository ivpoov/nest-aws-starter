import { Prisma } from '@generated/prisma/client.js';
import type { ContactMessageInterface } from '@modules/contact-us/interfaces/contact-message.interface.js';
import { ContactMessagePrismaRepository } from '@modules/contact-us/repositories/contact-message-prisma.repository.js';
import type { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { ContactMessageStatusEnum } from '@nest-aws-starter/shared';
import { describe, expect, it, vi } from 'vitest';

const row = {
  id: '01890a5d-ac96-774b-bcce-b302099a8057',
  name: 'Jane Doe',
  email: 'jane@example.com',
  subject: 'Question',
  body: 'Hi there',
  status: 'OPEN',
  createdAt: new Date('2026-08-03T12:00:00Z'),
  updatedAt: new Date('2026-08-03T12:00:00Z'),
};

function createRepository(overrides: Record<string, ReturnType<typeof vi.fn>> = {}): {
  repository: ContactMessagePrismaRepository;
  contactMessage: Record<string, ReturnType<typeof vi.fn>>;
} {
  const contactMessage = {
    create: vi.fn().mockResolvedValue(row),
    findMany: vi.fn().mockResolvedValue([row]),
    update: vi.fn().mockResolvedValue(row),
    ...overrides,
  };
  const prisma = { contactMessage } as unknown as PrismaService;
  const repository = new ContactMessagePrismaRepository(prisma);

  return { repository, contactMessage };
}

describe('ContactMessagePrismaRepository', () => {
  it('maps a created row to the domain interface', async () => {
    const { repository } = createRepository();

    const message: ContactMessageInterface = await repository.create({
      name: 'Jane Doe',
      email: 'jane@example.com',
      subject: 'Question',
      body: 'Hi there',
    });

    expect(message).toEqual({
      id: row.id,
      name: row.name,
      email: row.email,
      subject: row.subject,
      body: row.body,
      status: ContactMessageStatusEnum.OPEN,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  });

  it('applies the status filter and cursor on findManyAfter', async () => {
    const { repository, contactMessage } = createRepository();

    await repository.findManyAfter(
      { cursor: 'prev-id', limit: 10 },
      { status: ContactMessageStatusEnum.RESOLVED },
    );

    expect(contactMessage.findMany).toHaveBeenCalledWith({
      where: { status: 'RESOLVED' },
      take: 10,
      cursor: { id: 'prev-id' },
      skip: 1,
      orderBy: { id: 'desc' },
    });
  });

  it('maps updateStatus to the domain interface', async () => {
    const resolvedRow = { ...row, status: 'RESOLVED' };
    const { repository } = createRepository({ update: vi.fn().mockResolvedValue(resolvedRow) });

    const message: ContactMessageInterface | null = await repository.updateStatus(
      row.id,
      ContactMessageStatusEnum.RESOLVED,
    );

    expect(message?.status).toBe(ContactMessageStatusEnum.RESOLVED);
  });

  it('maps a not-found update (P2025) to null instead of throwing', async () => {
    const notFound = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '7.8.0',
    });
    const { repository } = createRepository({ update: vi.fn().mockRejectedValue(notFound) });

    const message: ContactMessageInterface | null = await repository.updateStatus(
      'missing-id',
      ContactMessageStatusEnum.RESOLVED,
    );

    expect(message).toBeNull();
  });
});
