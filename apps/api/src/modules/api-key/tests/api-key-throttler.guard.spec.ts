import { ApiKeyThrottlerGuard } from '@modules/api-key/guards/api-key-throttler.guard.js';
import type { ApiKeyPrincipalInterface } from '@modules/api-key/interfaces/api-key-principal.interface.js';
import type { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { describe, expect, it } from 'vitest';

interface GetTrackerAccessorInterface {
  getTracker(request: Record<string, unknown>): Promise<string>;
}

interface ThrottlersAccessorInterface {
  throttlers: Array<{ name?: string; limit: number; ttl: number }>;
}

function createGuard(): ApiKeyThrottlerGuard {
  const options: ThrottlerModuleOptions = { throttlers: [] };
  const storage = {} as ThrottlerStorage;
  const reflector = new Reflector();
  const configService = {
    getOrThrow: () => ({ trustProxy: false }),
  } as unknown as ConfigService;

  return new ApiKeyThrottlerGuard(options, storage, reflector, configService);
}

describe('ApiKeyThrottlerGuard', () => {
  it('tracks by api key id when request.apiKey is set (ApiKeyGuard already ran)', async () => {
    const guard = createGuard();
    const principal: ApiKeyPrincipalInterface = { id: 'key-1', name: 'bot', ownerId: 'owner-1' };
    const request = { ip: '127.0.0.1', headers: {}, apiKey: principal };

    const tracker: string = await (guard as unknown as GetTrackerAccessorInterface).getTracker(
      request,
    );

    expect(tracker).toBe('apikey:key-1');
  });

  it('falls back to ip when request.apiKey is not set', async () => {
    const guard = createGuard();
    const request = { ip: '127.0.0.1', headers: {} };

    const tracker: string = await (guard as unknown as GetTrackerAccessorInterface).getTracker(
      request,
    );

    expect(tracker).toBe('127.0.0.1');
  });

  it('two different api key ids produce two different trackers', async () => {
    const guard = createGuard();
    const requestA = {
      ip: '127.0.0.1',
      headers: {},
      apiKey: { id: 'key-a', name: 'a', ownerId: 'o' },
    };
    const requestB = {
      ip: '127.0.0.1',
      headers: {},
      apiKey: { id: 'key-b', name: 'b', ownerId: 'o' },
    };

    const trackerA: string = await (guard as unknown as GetTrackerAccessorInterface).getTracker(
      requestA,
    );
    const trackerB: string = await (guard as unknown as GetTrackerAccessorInterface).getTracker(
      requestB,
    );

    expect(trackerA).not.toBe(trackerB);
  });

  // Load-bearing for the "different key, same ip get independent budgets"
  // e2e assertion: this guard must run its own named throttler
  // (API_KEY_THROTTLER_NAME) rather than the global 'default' one, or a
  // @Throttle({ default: ... }) route override meant for this guard would
  // also restrict the global ip-tracked guard on the same handler.
  it('scopes onModuleInit to its own named throttler, decoupled from the shared config', async () => {
    const guard = createGuard();

    await guard.onModuleInit();

    const throttlers = (guard as unknown as ThrottlersAccessorInterface).throttlers;

    expect(throttlers).toHaveLength(1);
    expect(throttlers[0]?.name).toBe('apikey');
    expect(throttlers[0]?.name).not.toBe('default');
  });
});
