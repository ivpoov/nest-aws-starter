import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import type { ApiKeyInterface } from '@modules/api-key/interfaces/api-key.interface.js';
import type { CreateApiKeyDataInterface } from '@modules/api-key/interfaces/create-api-key-data.interface.js';

export interface ApiKeyRepositoryInterface {
  create(data: CreateApiKeyDataInterface): Promise<ApiKeyInterface>;
  findById(id: string): Promise<ApiKeyInterface | null>;
  findByHashedKey(hashedKey: string): Promise<ApiKeyInterface | null>;
  findManyAfter(pagination: CursorPaginationInterface): Promise<ApiKeyInterface[]>;
  revoke(id: string, revokedAt: Date): Promise<ApiKeyInterface | null>;
  touchLastUsedAt(id: string, lastUsedAt: Date): Promise<void>;
}
