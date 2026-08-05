import { Prisma } from '@generated/prisma/client.js';
import { FileIntent, FileStatus } from '@generated/prisma/enums.js';
import { FilePrismaRepository } from '@modules/file/repositories/file-prisma.repository.js';
import type { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { FileIntentEnum, FileStatusEnum } from '@nest-aws-starter/shared';
import { describe, expect, it, vi } from 'vitest';

const row = {
  id: '01890a5d-0000-774b-bcce-b302099d0001',
  ownerId: 'owner-1',
  intent: FileIntent.ATTACHMENT,
  key: 'files/owner-1/object-1',
  contentType: 'application/pdf',
  size: 0,
  status: FileStatus.PENDING,
  createdAt: new Date('2026-08-01T00:00:00Z'),
  updatedAt: new Date('2026-08-01T00:00:00Z'),
};

function createRepository(overrides: Record<string, ReturnType<typeof vi.fn>> = {}): {
  repository: FilePrismaRepository;
  file: Record<string, ReturnType<typeof vi.fn>>;
} {
  const file = {
    create: vi.fn().mockResolvedValue(row),
    findUnique: vi.fn().mockResolvedValue(row),
    findMany: vi.fn().mockResolvedValue([row]),
    update: vi.fn().mockResolvedValue({ ...row, status: FileStatus.READY }),
    delete: vi.fn().mockResolvedValue(row),
    ...overrides,
  };
  const prisma = { file } as unknown as PrismaService;
  const repository = new FilePrismaRepository(prisma);

  return { repository, file };
}

describe('FilePrismaRepository.findStalePending', () => {
  const cutoff = new Date('2026-08-02T00:00:00Z');

  it('queries PENDING rows older than cutoff, oldest first, capped at the limit', async () => {
    const { repository, file } = createRepository();

    const result = await repository.findStalePending(cutoff, 200);

    expect(file.findMany).toHaveBeenCalledWith({
      where: { status: FileStatus.PENDING, createdAt: { lt: cutoff } },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    expect(result).toEqual([
      {
        id: row.id,
        ownerId: row.ownerId,
        intent: FileIntentEnum.ATTACHMENT,
        key: row.key,
        contentType: row.contentType,
        size: row.size,
        status: FileStatusEnum.PENDING,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    ]);
  });
});

describe('FilePrismaRepository.deleteById', () => {
  it('deletes the row', async () => {
    const { repository, file } = createRepository();

    await repository.deleteById(row.id);

    expect(file.delete).toHaveBeenCalledWith({ where: { id: row.id } });
  });

  it('swallows a P2025 (already deleted) instead of throwing', async () => {
    const notFound = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '7.8.0',
    });
    const { repository } = createRepository({ delete: vi.fn().mockRejectedValue(notFound) });

    await expect(repository.deleteById('missing')).resolves.toBeUndefined();
  });

  it('rethrows any other Prisma error unchanged', async () => {
    const other = new Prisma.PrismaClientKnownRequestError('Foreign key violation', {
      code: 'P2003',
      clientVersion: '7.8.0',
    });
    const { repository } = createRepository({ delete: vi.fn().mockRejectedValue(other) });

    await expect(repository.deleteById(row.id)).rejects.toBe(other);
  });
});
