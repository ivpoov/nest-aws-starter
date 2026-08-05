import {
  FILE_SWEEP_CRON_EXPRESSION,
  FILE_SWEEP_LOCK_TTL_MS,
} from '@modules/file/constants/file-sweep.constants.js';
import type { FileService } from '@modules/file/services/file.service.js';
import type { ScheduledJobInterface } from '@modules/task-scheduler/interfaces/scheduled-job.interface.js';

// Not a Nest provider — constructed directly by file.module.ts's
// registration factory, same idiom as SubscriptionExpiryJob. Daily cron (the
// 24h staleness threshold makes hourly pointless busywork);
// FileService.sweepOrphans() owns the S3-verify / mark-ready / delete
// decision.
export class OrphanFileSweepJob implements ScheduledJobInterface {
  public readonly name: string = 'orphan-file-sweep';
  public readonly cronExpression: string = FILE_SWEEP_CRON_EXPRESSION;
  public readonly lockTtlMs: number = FILE_SWEEP_LOCK_TTL_MS;

  constructor(private readonly fileService: FileService) {}

  public async run(): Promise<void> {
    await this.fileService.sweepOrphans();
  }
}
