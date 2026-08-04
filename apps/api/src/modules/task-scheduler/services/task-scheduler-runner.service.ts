import type { SchedulerConfig } from '@configs/scheduler.config.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { DEFAULT_LOCK_TTL_MS } from '@modules/task-scheduler/constants/task-scheduler.constants.js';
import type { ScheduledJobInterface } from '@modules/task-scheduler/interfaces/scheduled-job.interface.js';
import { ScheduledJobRegistryService } from '@modules/task-scheduler/services/scheduled-job-registry.service.js';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { RedisLockService } from '@providers/redis/services/redis-lock.service.js';
import { CronJob } from 'cron';

// Cron only decides WHEN to attempt a run; the Redis lock decides WHO
// actually runs it. Every tick across every instance races for the lock —
// exactly one wins, the rest log `debug` and move on (10a: no lock, no run).
@Injectable()
export class TaskSchedulerRunnerService implements OnModuleInit {
  private readonly logger = new CustomLoggerService(TaskSchedulerRunnerService.name);

  constructor(
    private readonly jobRegistry: ScheduledJobRegistryService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly redisLock: RedisLockService,
    private readonly configService: ConfigService,
  ) {}

  public onModuleInit(): void {
    const config: SchedulerConfig = this.configService.getOrThrow<SchedulerConfig>('scheduler');

    if (!config.isEnabled) {
      this.logger.log('Scheduler disabled (SCHEDULER_ENABLED=false) — no cron jobs registered');

      return;
    }

    for (const job of this.jobRegistry.getAll()) this.scheduleJob(job);
  }

  // Exposed so tests (and any manual trigger) can invoke a job's lock-guarded
  // run without waiting on cron wall-time.
  public async runJob(job: ScheduledJobInterface): Promise<void> {
    const ttlMs: number = job.lockTtlMs ?? DEFAULT_LOCK_TTL_MS;

    try {
      const executed: boolean | null = await this.redisLock.withLock<boolean>(
        `job:${job.name}`,
        ttlMs,
        async (): Promise<boolean> => {
          await job.run();

          return true;
        },
      );

      if (executed === null) {
        this.logger.debug(`Scheduled job skipped — lock held elsewhere: ${job.name}`);

        return;
      }

      this.logger.log(`Scheduled job completed: ${job.name}`);
    } catch (error) {
      const message: string = error instanceof Error ? error.message : String(error);
      const stack: string | undefined = error instanceof Error ? error.stack : undefined;

      this.logger.error(`Scheduled job failed: ${job.name} — ${message}`, stack);
    }
  }

  private scheduleJob(job: ScheduledJobInterface): void {
    const cronJob: CronJob = CronJob.from({
      cronTime: job.cronExpression,
      onTick: () => this.runJob(job),
    });

    this.schedulerRegistry.addCronJob(job.name, cronJob);
    cronJob.start();

    this.logger.log(`Scheduled job registered: ${job.name} (${job.cronExpression})`);
  }
}
