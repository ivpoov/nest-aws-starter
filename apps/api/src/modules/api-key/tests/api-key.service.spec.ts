import type { ApiKeyInterface } from '@modules/api-key/interfaces/api-key.interface.js';
import type { ApiKeyCreatedInterface } from '@modules/api-key/interfaces/api-key-created.interface.js';
import type { ApiKeyPrincipalInterface } from '@modules/api-key/interfaces/api-key-principal.interface.js';
import type { ApiKeyRepositoryInterface } from '@modules/api-key/interfaces/api-key-repository.interface.js';
import { ApiKeyService } from '@modules/api-key/services/api-key.service.js';
import { NotFoundError } from '@modules/common/errors/not-found.error.js';
import { UnauthorizedError } from '@modules/common/errors/unauthorized.error.js';
import {
  API_KEY_CREATED_EVENT,
  API_KEY_REVOKED_EVENT,
} from '@modules/event/constants/event-names.constants.js';
import type { EventBusService } from '@modules/event/services/event-bus.service.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ownerId = '01890a5d-0000-774b-bcce-b30209990001';

const activeApiKey: ApiKeyInterface = {
  id: '01890a5d-ac96-774b-bcce-b302099a8057',
  name: 'CI deploy bot',
  prefix: 'sk_5f2c9c',
  ownerId,
  lastUsedAt: null,
  revokedAt: null,
  createdAt: new Date('2026-08-04T12:00:00Z'),
};

function createService(overrides: Partial<Record<keyof ApiKeyRepositoryInterface, unknown>> = {}): {
  service: ApiKeyService;
  repository: ApiKeyRepositoryInterface;
  emit: ReturnType<typeof vi.fn>;
} {
  const repository = {
    create: vi
      .fn()
      .mockImplementation(
        async (data: { name: string; prefix: string }) =>
          ({ ...activeApiKey, name: data.name, prefix: data.prefix }) as ApiKeyInterface,
      ),
    findById: vi.fn().mockResolvedValue(activeApiKey),
    findByHashedKey: vi.fn().mockResolvedValue(activeApiKey),
    findManyAfter: vi.fn().mockResolvedValue([activeApiKey]),
    revoke: vi.fn().mockResolvedValue({ ...activeApiKey, revokedAt: new Date() }),
    touchLastUsedAt: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as ApiKeyRepositoryInterface;
  const emit = vi.fn();
  const eventBus = { emit } as unknown as EventBusService;
  const service = new ApiKeyService(repository, eventBus);

  return { service, repository, emit };
}

describe('ApiKeyService', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  describe('create', () => {
    it('generates an sk_ key, stores only its hash, and returns the plaintext once', async () => {
      const { service, repository, emit } = createService();

      const result: ApiKeyCreatedInterface = await service.create('CI deploy bot', ownerId);

      expect(result.key).toMatch(/^sk_[A-Za-z0-9_-]{48}$/);
      expect(result.prefix).toBe(result.key.slice(0, 8));

      const createCall = vi.mocked(repository.create).mock.calls[0]?.[0];

      expect(createCall?.name).toBe('CI deploy bot');
      expect(createCall?.ownerId).toBe(ownerId);
      expect(createCall?.hashedKey).toMatch(/^[a-f0-9]{64}$/);
      expect(createCall?.hashedKey).not.toBe(result.key);
      expect(emit).toHaveBeenCalledWith(API_KEY_CREATED_EVENT, {
        apiKeyId: activeApiKey.id,
        name: activeApiKey.name,
        actorId: ownerId,
      });
    });

    it('generates a fresh key on every call (hash-once semantics)', async () => {
      const { service } = createService();

      const first: ApiKeyCreatedInterface = await service.create('bot 1', ownerId);
      const second: ApiKeyCreatedInterface = await service.create('bot 2', ownerId);

      expect(first.key).not.toBe(second.key);
    });
  });

  describe('revoke', () => {
    it('throws NotFoundError for an unknown id', async () => {
      const { service } = createService({ findById: vi.fn().mockResolvedValue(null) });

      await expect(service.revoke('missing-id', ownerId)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('revokes an active key and emits API_KEY_REVOKED_EVENT', async () => {
      const { service, repository, emit } = createService();

      await service.revoke(activeApiKey.id, ownerId);

      expect(repository.revoke).toHaveBeenCalledWith(activeApiKey.id, expect.any(Date));
      expect(emit).toHaveBeenCalledWith(API_KEY_REVOKED_EVENT, {
        apiKeyId: activeApiKey.id,
        actorId: ownerId,
      });
    });

    it('is idempotent — revoking an already-revoked key is a no-op, no new event', async () => {
      const revokedApiKey: ApiKeyInterface = { ...activeApiKey, revokedAt: new Date() };
      const { service, repository, emit } = createService({
        findById: vi.fn().mockResolvedValue(revokedApiKey),
      });

      await expect(service.revoke(activeApiKey.id, ownerId)).resolves.toBeUndefined();

      expect(repository.revoke).not.toHaveBeenCalled();
      expect(emit).not.toHaveBeenCalled();
    });
  });

  describe('validateKey', () => {
    it('returns a principal for a known, active key', async () => {
      const { service } = createService();

      const principal: ApiKeyPrincipalInterface = await service.validateKey('sk_anything');

      expect(principal).toEqual({
        id: activeApiKey.id,
        name: activeApiKey.name,
        ownerId: activeApiKey.ownerId,
      });
    });

    it('rejects an unknown key', async () => {
      const { service } = createService({ findByHashedKey: vi.fn().mockResolvedValue(null) });

      await expect(service.validateKey('sk_unknown')).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('rejects a revoked key', async () => {
      const revokedApiKey: ApiKeyInterface = { ...activeApiKey, revokedAt: new Date() };
      const { service } = createService({
        findByHashedKey: vi.fn().mockResolvedValue(revokedApiKey),
      });

      await expect(service.validateKey('sk_revoked')).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('touches lastUsedAt when it was never set', async () => {
      const { service, repository } = createService();

      await service.validateKey('sk_anything');
      await vi.waitFor(() => expect(repository.touchLastUsedAt).toHaveBeenCalled());

      expect(repository.touchLastUsedAt).toHaveBeenCalledWith(activeApiKey.id, expect.any(Date));
    });

    it('skips the touch when lastUsedAt is fresh (<60s old)', async () => {
      const freshApiKey: ApiKeyInterface = { ...activeApiKey, lastUsedAt: new Date() };
      const { service, repository } = createService({
        findByHashedKey: vi.fn().mockResolvedValue(freshApiKey),
      });

      await service.validateKey('sk_anything');
      // give the fire-and-forget touch a tick to run, if it were going to
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(repository.touchLastUsedAt).not.toHaveBeenCalled();
    });

    it('touches lastUsedAt again once it is stale (>60s old)', async () => {
      const staleApiKey: ApiKeyInterface = {
        ...activeApiKey,
        lastUsedAt: new Date(Date.now() - 61_000),
      };
      const { service, repository } = createService({
        findByHashedKey: vi.fn().mockResolvedValue(staleApiKey),
      });

      await service.validateKey('sk_anything');
      await vi.waitFor(() => expect(repository.touchLastUsedAt).toHaveBeenCalled());

      expect(repository.touchLastUsedAt).toHaveBeenCalledWith(activeApiKey.id, expect.any(Date));
    });

    it('never fails validateKey when the touch write itself fails', async () => {
      const { service, repository } = createService({
        touchLastUsedAt: vi.fn().mockRejectedValue(new Error('db unavailable')),
      });

      await expect(service.validateKey('sk_anything')).resolves.toBeDefined();
      await vi.waitFor(() => expect(repository.touchLastUsedAt).toHaveBeenCalled());
    });
  });

  describe('findMany', () => {
    it('paginates and computes nextCursor', async () => {
      const { service } = createService();

      const result = await service.findMany({ cursor: null, limit: 1 });

      expect(result.items).toEqual([activeApiKey]);
      expect(result.nextCursor).toBe(activeApiKey.id);
    });

    it('returns a null nextCursor on a short page', async () => {
      const { service } = createService();

      const result = await service.findMany({ cursor: null, limit: 20 });

      expect(result.nextCursor).toBeNull();
    });
  });
});
