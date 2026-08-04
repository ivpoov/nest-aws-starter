import type { ScheduledJobInterface } from '@modules/task-scheduler/interfaces/scheduled-job.interface.js';
import { Injectable } from '@nestjs/common';

// Nest has no built-in `multi: true` provider token, so jobs self-register
// here instead of injecting a SCHEDULED_JOB multi-provider — the same
// registry idiom as OauthProviderRegistryService and
// CaslAbilityFactoryService.register(). A future job module injects this
// service (TaskSchedulerModule is @Global()) and calls register() from a
// factory provider, exactly like the oauth provider modules do.
@Injectable()
export class ScheduledJobRegistryService {
  private readonly jobs: Map<string, ScheduledJobInterface> = new Map();

  public register(job: ScheduledJobInterface): void {
    this.jobs.set(job.name, job);
  }

  public getAll(): ScheduledJobInterface[] {
    return [...this.jobs.values()];
  }
}
