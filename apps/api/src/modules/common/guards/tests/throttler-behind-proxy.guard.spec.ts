import { ThrottlerBehindProxyGuard } from '@guards/throttler-behind-proxy.guard.js';
import type { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { describe, expect, it } from 'vitest';

interface GetTrackerAccessorInterface {
  getTracker(request: Record<string, unknown>): Promise<string>;
}

const SOCKET_IP = '198.51.100.7';
const FORGED_IP = '203.0.113.9';

function createGuard(trustProxy: boolean): ThrottlerBehindProxyGuard {
  const options: ThrottlerModuleOptions = { throttlers: [] };
  const storage: ThrottlerStorage = {} as ThrottlerStorage;
  const reflector: Reflector = new Reflector();
  const configService: ConfigService = {
    getOrThrow: (): { trustProxy: boolean } => ({ trustProxy }),
  } as unknown as ConfigService;

  return new ThrottlerBehindProxyGuard(options, storage, reflector, configService);
}

function trackerFor(
  guard: ThrottlerBehindProxyGuard,
  headers: Record<string, string>,
): Promise<string> {
  return (guard as unknown as GetTrackerAccessorInterface).getTracker({ ip: SOCKET_IP, headers });
}

describe('ThrottlerBehindProxyGuard', () => {
  // The security-relevant half: with no trusted proxy in front, x-forwarded-for
  // is attacker-controlled input. Honouring it would let any client mint an
  // unlimited number of rate-limit buckets by changing one header.
  describe('with TRUST_PROXY off', () => {
    it('tracks by the socket ip and ignores a forged x-forwarded-for', async () => {
      const guard: ThrottlerBehindProxyGuard = createGuard(false);

      const tracker: string = await trackerFor(guard, { 'x-forwarded-for': FORGED_IP });

      expect(tracker).toBe(SOCKET_IP);
      expect(tracker).not.toBe(FORGED_IP);
    });

    it('collapses every forged value onto the same tracker', async () => {
      const guard: ThrottlerBehindProxyGuard = createGuard(false);

      const first: string = await trackerFor(guard, { 'x-forwarded-for': '203.0.113.1' });
      const second: string = await trackerFor(guard, { 'x-forwarded-for': '203.0.113.2' });

      expect(first).toBe(second);
    });

    it('ignores a comma-chained forwarded-for too', async () => {
      const guard: ThrottlerBehindProxyGuard = createGuard(false);

      const tracker: string = await trackerFor(guard, {
        'x-forwarded-for': `${FORGED_IP}, 10.0.0.1`,
      });

      expect(tracker).toBe(SOCKET_IP);
    });
  });

  // The operational half: behind an ALB/CloudFront the socket ip is the load
  // balancer's, identical for every client, so the header is the only way to
  // tell clients apart.
  describe('with TRUST_PROXY on', () => {
    it('takes the leftmost forwarded ip', async () => {
      const guard: ThrottlerBehindProxyGuard = createGuard(true);

      const tracker: string = await trackerFor(guard, {
        'x-forwarded-for': `${FORGED_IP}, 10.0.0.1`,
      });

      expect(tracker).toBe(FORGED_IP);
    });

    it('falls back to the socket ip when the header is absent', async () => {
      const guard: ThrottlerBehindProxyGuard = createGuard(true);

      const tracker: string = await trackerFor(guard, {});

      expect(tracker).toBe(SOCKET_IP);
    });
  });
});
