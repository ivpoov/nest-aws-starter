import { createHash, randomBytes } from 'node:crypto';
import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import { API_KEY_REPOSITORY } from '@modules/api-key/constants/api-key.constants.js';
import {
  API_KEY_INVALID,
  API_KEY_NOT_FOUND,
} from '@modules/api-key/constants/api-key-errors.constants.js';
import type { ApiKeyInterface } from '@modules/api-key/interfaces/api-key.interface.js';
import type { ApiKeyCreatedInterface } from '@modules/api-key/interfaces/api-key-created.interface.js';
import type { ApiKeyListInterface } from '@modules/api-key/interfaces/api-key-list.interface.js';
import type { ApiKeyPrincipalInterface } from '@modules/api-key/interfaces/api-key-principal.interface.js';
import type { ApiKeyRepositoryInterface } from '@modules/api-key/interfaces/api-key-repository.interface.js';
import { NotFoundError } from '@modules/common/errors/not-found.error.js';
import { UnauthorizedError } from '@modules/common/errors/unauthorized.error.js';
import {
  API_KEY_CREATED_EVENT,
  API_KEY_REVOKED_EVENT,
} from '@modules/event/constants/event-names.constants.js';
import { EventBusService } from '@modules/event/services/event-bus.service.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { Inject, Injectable } from '@nestjs/common';

const KEY_PREFIX = 'sk_';
const KEY_RANDOM_BYTES = 36;
const DISPLAY_PREFIX_LENGTH = 8;
// Below this age the touch is skipped — caps lastUsedAt writes to roughly
// once a minute per key instead of once per request.
const LAST_USED_TOUCH_INTERVAL_MS = 60_000;

@Injectable()
export class ApiKeyService {
  private readonly logger = new CustomLoggerService(ApiKeyService.name);

  constructor(
    @Inject(API_KEY_REPOSITORY)
    private readonly apiKeyRepository: ApiKeyRepositoryInterface,
    private readonly eventBus: EventBusService,
  ) {}

  public async create(name: string, actorId: string): Promise<ApiKeyCreatedInterface> {
    const key: string = this.generateKey();
    const hashedKey: string = this.hashKey(key);
    const prefix: string = key.slice(0, DISPLAY_PREFIX_LENGTH);

    const apiKey: ApiKeyInterface = await this.apiKeyRepository.create({
      name,
      ownerId: actorId,
      hashedKey,
      prefix,
    });

    this.logger.log(`API key created: ${apiKey.id}`);
    this.eventBus.emit(API_KEY_CREATED_EVENT, { apiKeyId: apiKey.id, name: apiKey.name, actorId });

    return {
      id: apiKey.id,
      name: apiKey.name,
      key,
      prefix: apiKey.prefix,
      createdAt: apiKey.createdAt,
    };
  }

  public async findMany(pagination: CursorPaginationInterface): Promise<ApiKeyListInterface> {
    const items: ApiKeyInterface[] = await this.apiKeyRepository.findManyAfter(pagination);
    const lastItem: ApiKeyInterface | undefined = items[items.length - 1];

    return {
      items,
      nextCursor: items.length === pagination.limit && lastItem ? lastItem.id : null,
    };
  }

  // Idempotent: revoking an already-revoked key is a 204 no-op, not a
  // conflict — the caller's desired end state (key is dead) already holds.
  // Only a truly unknown id is a 404.
  public async revoke(id: string, actorId: string): Promise<void> {
    const apiKey: ApiKeyInterface | null = await this.apiKeyRepository.findById(id);

    if (!apiKey) throw new NotFoundError(API_KEY_NOT_FOUND);
    if (apiKey.revokedAt) return;

    await this.apiKeyRepository.revoke(id, new Date());

    this.logger.log(`API key revoked: ${id}`);
    this.eventBus.emit(API_KEY_REVOKED_EVENT, { apiKeyId: id, actorId });
  }

  // The only entry point ApiKeyGuard calls — hashes, looks up, rejects
  // missing/revoked keys, and best-effort touches lastUsedAt.
  public async validateKey(rawKey: string): Promise<ApiKeyPrincipalInterface> {
    const hashedKey: string = this.hashKey(rawKey);
    const apiKey: ApiKeyInterface | null = await this.apiKeyRepository.findByHashedKey(hashedKey);

    if (!apiKey || apiKey.revokedAt) throw new UnauthorizedError(API_KEY_INVALID);

    void this.touchLastUsedIfStale(apiKey);

    return { id: apiKey.id, name: apiKey.name, ownerId: apiKey.ownerId };
  }

  // Fire-and-forget from validateKey() — never adds a write round-trip to
  // the guarded request's critical path, and a failure here must never fail
  // the request that triggered it (same rationale as OauthAvatarListener).
  private async touchLastUsedIfStale(apiKey: ApiKeyInterface): Promise<void> {
    const isStale: boolean =
      !apiKey.lastUsedAt || Date.now() - apiKey.lastUsedAt.getTime() > LAST_USED_TOUCH_INTERVAL_MS;

    if (!isStale) return;

    try {
      await this.apiKeyRepository.touchLastUsedAt(apiKey.id, new Date());
    } catch (caught) {
      this.logger.warn(`Failed to touch lastUsedAt for API key ${apiKey.id}: ${String(caught)}`);
    }
  }

  private generateKey(): string {
    return `${KEY_PREFIX}${randomBytes(KEY_RANDOM_BYTES).toString('base64url')}`;
  }

  private hashKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }
}
