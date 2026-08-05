import { WebhookRetryJob } from '@modules/payment/jobs/webhook-retry.job.js';
import type { WebhookRetryService } from '@modules/payment/services/webhook-retry.service.js';
import { describe, expect, it, vi } from 'vitest';

describe('WebhookRetryJob', () => {
  it('declares the expected name, hourly cron, and a generous lock TTL', () => {
    const webhookRetryService = { sweep: vi.fn() } as unknown as WebhookRetryService;
    const job = new WebhookRetryJob(webhookRetryService);

    expect(job.name).toBe('webhook-retry');
    expect(job.cronExpression).toBe('0 * * * *');
    expect(job.lockTtlMs).toBeGreaterThan(0);
  });

  it('run() delegates to webhookRetryService.sweep()', async () => {
    const webhookRetryService = {
      sweep: vi.fn().mockResolvedValue({ failedRetriedCount: 0, staleReceivedRetriedCount: 0 }),
    } as unknown as WebhookRetryService;
    const job = new WebhookRetryJob(webhookRetryService);

    await job.run();

    expect(webhookRetryService.sweep).toHaveBeenCalledOnce();
  });
});
