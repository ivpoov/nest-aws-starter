import { purgeInBatches } from '@modules/common/helpers/purge-in-batches.helper.js';
import type { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { describe, expect, it, vi } from 'vitest';

function createLogger(): CustomLoggerService {
  return { log: vi.fn(), warn: vi.fn() } as unknown as CustomLoggerService;
}

describe('purgeInBatches', () => {
  it('keeps deleting until a pass returns less than a full batch', async () => {
    const deleteBatch = vi
      .fn()
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(40);

    await expect(purgeInBatches('row', 100, createLogger(), deleteBatch)).resolves.toBe(240);
    expect(deleteBatch).toHaveBeenCalledTimes(3);
  });

  // A short first pass is already the tail, so there is nothing to come back for.
  it('stops after one pass when the first is already short', async () => {
    const deleteBatch = vi.fn().mockResolvedValue(0);

    await expect(purgeInBatches('row', 100, createLogger(), deleteBatch)).resolves.toBe(0);
    expect(deleteBatch).toHaveBeenCalledTimes(1);
  });

  // The property that matters most: a delete that keeps reporting a full batch
  // — a predicate that stopped matching, a permission problem — must not spin
  // forever inside a scheduled job holding a Redis lock.
  it('gives up rather than looping forever when every pass stays full', async () => {
    const deleteBatch = vi.fn().mockResolvedValue(10);
    const logger: CustomLoggerService = createLogger();

    const total: number = await purgeInBatches('row', 10, logger, deleteBatch);

    expect(deleteBatch).toHaveBeenCalledTimes(1_000);
    expect(total).toBe(10_000);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('more remain'));
  });

  it('says nothing when there was nothing to delete', async () => {
    const logger: CustomLoggerService = createLogger();

    await purgeInBatches('row', 100, logger, vi.fn().mockResolvedValue(0));

    expect(logger.log).not.toHaveBeenCalled();
  });
});
