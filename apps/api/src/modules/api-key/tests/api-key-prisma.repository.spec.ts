import { Prisma } from '@generated/prisma/client.js';
import type { ApiKeyInterface } from '@modules/api-key/interfaces/api-key.interface.js';
import { ApiKeyPrismaRepository } from '@modules/api-key/repositories/api-key-prisma.repository.js';
import type { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { describe, expect, it, vi } from 'vitest';

const row = {
  id: '01890a5d-ac96-774b-bcce-b302099a8057',
  name: 'CI deploy bot',
  hashedKey: 'a'.repeat(64),
  prefix: 'sk_5f2c9c',
  ownerId: '01890a5d-0000-774b-bcce-b30209990001',
  lastUsedAt: null,
  revokedAt: null,
  createdAt: new Date('2026-08-04T12:00:00Z'),
};

function createRepository(overrides: Record<string, ReturnType<typeof vi.fn>> = {}): {
  repository: ApiKeyPrismaRepository;
  apiKey: Record<string, ReturnType<typeof vi.fn>>;
} {
  const apiKey = {
    create: vi.fn().mockResolvedValue(row),
    findUnique: vi.fn().mockResolvedValue(row),
    findMany: vi.fn().mockResolvedValue([row]),
    update: vi.fn().mockResolvedValue(row),
    ...overrides,
  };
  const prisma = { apiKey } as unknown as PrismaService;
  const repository = new ApiKeyPrismaRepository(prisma);

  return { repository, apiKey };
}

describe('ApiKeyPrismaRepository', () => {
  it('maps a created row to the domain interface, excluding hashedKey', async () => {
    const { repository } = createRepository();

    const apiKey: ApiKeyInterface = await repository.create({
      name: row.name,
      ownerId: row.ownerId,
      hashedKey: row.hashedKey,
      prefix: row.prefix,
    });

    expect(apiKey).toEqual({
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      ownerId: row.ownerId,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: row.createdAt,
    });
    expect(apiKey).not.toHaveProperty('hashedKey');
  });

  it('looks up by hashedKey', async () => {
    const { repository, apiKey } = createRepository();

    await repository.findByHashedKey(row.hashedKey);

    expect(apiKey.findUnique).toHaveBeenCalledWith({ where: { hashedKey: row.hashedKey } });
  });

  it('returns null when findByHashedKey finds nothing', async () => {
    const { repository } = createRepository({ findUnique: vi.fn().mockResolvedValue(null) });

    const apiKey: ApiKeyInterface | null = await repository.findByHashedKey('unknown');

    expect(apiKey).toBeNull();
  });

  it('applies cursor pagination on findManyAfter', async () => {
    const { repository, apiKey } = createRepository();

    await repository.findManyAfter({ cursor: 'prev-id', limit: 10 });

    expect(apiKey.findMany).toHaveBeenCalledWith({
      take: 10,
      cursor: { id: 'prev-id' },
      skip: 1,
      orderBy: { id: 'desc' },
    });
  });

  it('sets revokedAt on revoke', async () => {
    const revokedAt = new Date('2026-08-04T13:00:00Z');
    const { repository, apiKey } = createRepository({
      update: vi.fn().mockResolvedValue({ ...row, revokedAt }),
    });

    const result: ApiKeyInterface | null = await repository.revoke(row.id, revokedAt);

    expect(apiKey.update).toHaveBeenCalledWith({ where: { id: row.id }, data: { revokedAt } });
    expect(result?.revokedAt).toEqual(revokedAt);
  });

  it('maps a not-found revoke (P2025) to null instead of throwing', async () => {
    const notFound = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '7.8.0',
    });
    const { repository } = createRepository({ update: vi.fn().mockRejectedValue(notFound) });

    const result: ApiKeyInterface | null = await repository.revoke('missing-id', new Date());

    expect(result).toBeNull();
  });

  it('touches lastUsedAt', async () => {
    const lastUsedAt = new Date('2026-08-04T13:00:00Z');
    const { repository, apiKey } = createRepository();

    await repository.touchLastUsedAt(row.id, lastUsedAt);

    expect(apiKey.update).toHaveBeenCalledWith({
      where: { id: row.id },
      data: { lastUsedAt },
    });
  });

  it('swallows a not-found (P2025) touchLastUsedAt instead of throwing', async () => {
    const notFound = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '7.8.0',
    });
    const { repository } = createRepository({ update: vi.fn().mockRejectedValue(notFound) });

    await expect(repository.touchLastUsedAt('missing-id', new Date())).resolves.toBeUndefined();
  });
});
