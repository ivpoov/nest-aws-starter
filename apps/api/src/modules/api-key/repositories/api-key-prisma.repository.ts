import { Prisma } from '@generated/prisma/client.js';
import type { ApiKeyModel } from '@generated/prisma/models.js';
import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import type { ApiKeyInterface } from '@modules/api-key/interfaces/api-key.interface.js';
import type { ApiKeyRepositoryInterface } from '@modules/api-key/interfaces/api-key-repository.interface.js';
import type { CreateApiKeyDataInterface } from '@modules/api-key/interfaces/create-api-key-data.interface.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ApiKeyPrismaRepository implements ApiKeyRepositoryInterface {
  constructor(private readonly prisma: PrismaService) {}

  public async create(data: CreateApiKeyDataInterface): Promise<ApiKeyInterface> {
    const apiKey: ApiKeyModel = await this.prisma.apiKey.create({ data });

    return this.toDomain(apiKey);
  }

  public async findById(id: string): Promise<ApiKeyInterface | null> {
    const apiKey: ApiKeyModel | null = await this.prisma.apiKey.findUnique({ where: { id } });

    return apiKey ? this.toDomain(apiKey) : null;
  }

  public async findByHashedKey(hashedKey: string): Promise<ApiKeyInterface | null> {
    const apiKey: ApiKeyModel | null = await this.prisma.apiKey.findUnique({
      where: { hashedKey },
    });

    return apiKey ? this.toDomain(apiKey) : null;
  }

  public async findManyAfter(pagination: CursorPaginationInterface): Promise<ApiKeyInterface[]> {
    const apiKeys: ApiKeyModel[] = await this.prisma.apiKey.findMany({
      take: pagination.limit,
      ...(pagination.cursor && { cursor: { id: pagination.cursor }, skip: 1 }),
      // UUIDv7 ids are time-ordered — id order IS creation order.
      orderBy: { id: 'desc' },
    });

    return apiKeys.map((apiKey: ApiKeyModel): ApiKeyInterface => this.toDomain(apiKey));
  }

  public async revoke(id: string, revokedAt: Date): Promise<ApiKeyInterface | null> {
    try {
      const apiKey: ApiKeyModel = await this.prisma.apiKey.update({
        where: { id },
        data: { revokedAt },
      });

      return this.toDomain(apiKey);
    } catch (caught) {
      if (this.isRecordNotFound(caught)) return null;

      throw caught;
    }
  }

  public async touchLastUsedAt(id: string, lastUsedAt: Date): Promise<void> {
    try {
      await this.prisma.apiKey.update({ where: { id }, data: { lastUsedAt } });
    } catch (caught) {
      if (this.isRecordNotFound(caught)) return;

      throw caught;
    }
  }

  // The single permitted Prisma-error touchpoint: P2025 = record not found,
  // mapped to a domain-neutral null/no-op so writes stay atomic (no
  // pre-check race).
  private isRecordNotFound(caught: unknown): boolean {
    return caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === 'P2025';
  }

  private toDomain(apiKey: ApiKeyModel): ApiKeyInterface {
    return {
      id: apiKey.id,
      name: apiKey.name,
      prefix: apiKey.prefix,
      ownerId: apiKey.ownerId,
      lastUsedAt: apiKey.lastUsedAt,
      revokedAt: apiKey.revokedAt,
      createdAt: apiKey.createdAt,
    };
  }
}
