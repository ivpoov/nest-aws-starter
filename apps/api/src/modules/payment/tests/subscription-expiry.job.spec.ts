import type { SubscriptionLifecycleInterface } from '@modules/payment/interfaces/subscription-lifecycle.interface.js';
import { SubscriptionExpiryJob } from '@modules/payment/jobs/subscription-expiry.job.js';
import { describe, expect, it, vi } from 'vitest';

describe('SubscriptionExpiryJob', () => {
  it('declares the expected name, hourly cron, and a generous lock TTL', () => {
    const lifecycle = { expireOverdue: vi.fn() } as unknown as SubscriptionLifecycleInterface;
    const job = new SubscriptionExpiryJob(lifecycle);

    expect(job.name).toBe('subscription-expiry');
    expect(job.cronExpression).toBe('0 * * * *');
    expect(job.lockTtlMs).toBeGreaterThan(0);
  });

  it('run() delegates to lifecycle.expireOverdue()', async () => {
    const lifecycle = {
      expireOverdue: vi.fn().mockResolvedValue(undefined),
    } as unknown as SubscriptionLifecycleInterface;
    const job = new SubscriptionExpiryJob(lifecycle);

    await job.run();

    expect(lifecycle.expireOverdue).toHaveBeenCalledOnce();
  });
});
