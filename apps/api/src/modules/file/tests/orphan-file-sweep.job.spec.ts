import { OrphanFileSweepJob } from '@modules/file/jobs/orphan-file-sweep.job.js';
import type { FileService } from '@modules/file/services/file.service.js';
import { describe, expect, it, vi } from 'vitest';

describe('OrphanFileSweepJob', () => {
  it('declares the expected name, daily cron, and a generous lock TTL', () => {
    const fileService = { sweepOrphans: vi.fn() } as unknown as FileService;
    const job = new OrphanFileSweepJob(fileService);

    expect(job.name).toBe('orphan-file-sweep');
    expect(job.cronExpression).toBe('0 3 * * *');
    expect(job.lockTtlMs).toBeGreaterThan(0);
  });

  it('run() delegates to fileService.sweepOrphans()', async () => {
    const fileService = {
      sweepOrphans: vi.fn().mockResolvedValue({
        markedReadyCount: 0,
        deletedAbsentCount: 0,
        deletedInvalidCount: 0,
      }),
    } as unknown as FileService;
    const job = new OrphanFileSweepJob(fileService);

    await job.run();

    expect(fileService.sweepOrphans).toHaveBeenCalledOnce();
  });
});
