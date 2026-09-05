import type { ActivityService } from '@modules/activity/services/activity.service.js';
import {
  RETENTION_CRON_EXPRESSION,
  RETENTION_LOCK_TTL_MS,
} from '@modules/common/constants/retention.constants.js';
import type { ScheduledJobInterface } from '@modules/task-scheduler/interfaces/scheduled-job.interface.js';

// Not a Nest provider — constructed by the module's registration factory, the
// same idiom as OrphanFileSweepJob and SubscriptionExpiryJob. Nightly, because
// retention is measured in days and an hourly sweep would be busywork that
// still deletes nothing on most runs.
export class ActivityRetentionJob implements ScheduledJobInterface {
  public readonly name: string = 'activity-retention';
  public readonly cronExpression: string = RETENTION_CRON_EXPRESSION;
  public readonly lockTtlMs: number = RETENTION_LOCK_TTL_MS;

  constructor(private readonly service: ActivityService) {}

  public async run(): Promise<void> {
    await this.service.purgeExpired();
  }
}
