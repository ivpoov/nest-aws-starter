import type { SchedulerConfig } from '@configs/scheduler.config.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import type { ScheduledJobInterface } from '@modules/task-scheduler/interfaces/scheduled-job.interface.js';
import { ScheduledJobRegistryService } from '@modules/task-scheduler/services/scheduled-job-registry.service.js';
import { TaskSchedulerRunnerService } from '@modules/task-scheduler/services/task-scheduler-runner.service.js';
import type { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { RedisLockService } from '@providers/redis/services/redis-lock.service.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function createJob(name: string, run: () => Promise<void> = async () => {}): ScheduledJobInterface {
  return { name, cronExpression: '* * * * *', run };
}

function createConfigService(isEnabled: boolean): ConfigService {
  return {
    getOrThrow: (): SchedulerConfig => ({ isEnabled }),
  } as unknown as ConfigService;
}

describe('TaskSchedulerRunnerService', () => {
  let jobRegistry: ScheduledJobRegistryService;
  let schedulerRegistry: SchedulerRegistry;
  let redisLock: { withLock: ReturnType<typeof vi.fn> };
  let debugSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    jobRegistry = new ScheduledJobRegistryService();
    schedulerRegistry = new SchedulerRegistry();
    redisLock = { withLock: vi.fn() };
    debugSpy = vi.spyOn(CustomLoggerService.prototype, 'debug').mockImplementation(() => {});
    errorSpy = vi.spyOn(CustomLoggerService.prototype, 'error').mockImplementation(() => {});
    logSpy = vi.spyOn(CustomLoggerService.prototype, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createRunner(isEnabled: boolean = true): TaskSchedulerRunnerService {
    return new TaskSchedulerRunnerService(
      jobRegistry,
      schedulerRegistry,
      redisLock as unknown as RedisLockService,
      createConfigService(isEnabled),
    );
  }

  describe('runJob', () => {
    it('runs the job through the lock service and logs completion when the lock is acquired', async () => {
      const runner: TaskSchedulerRunnerService = createRunner();
      const job: ScheduledJobInterface = createJob('demo');

      redisLock.withLock.mockImplementation(
        async (_name: string, _ttl: number, fn: () => Promise<boolean>) => fn(),
      );

      await runner.runJob(job);

      expect(redisLock.withLock).toHaveBeenCalledWith(
        'job:demo',
        expect.any(Number),
        expect.any(Function),
      );
      expect(logSpy).toHaveBeenCalledWith('Scheduled job completed: demo');
    });

    it('skips and logs debug when the lock is held elsewhere (two jobs, one lock)', async () => {
      const runner: TaskSchedulerRunnerService = createRunner();
      const winner: ScheduledJobInterface = createJob('shared-lock');
      const loser: ScheduledJobInterface = createJob('shared-lock');

      redisLock.withLock
        .mockResolvedValueOnce(true) // first caller acquires and runs
        .mockResolvedValueOnce(null); // second caller finds the lock held

      await runner.runJob(winner);
      await runner.runJob(loser);

      expect(logSpy).toHaveBeenCalledWith('Scheduled job completed: shared-lock');
      expect(debugSpy).toHaveBeenCalledWith(
        'Scheduled job skipped — lock held elsewhere: shared-lock',
      );
    });

    it('contains an error thrown while running and never rethrows', async () => {
      const runner: TaskSchedulerRunnerService = createRunner();
      const job: ScheduledJobInterface = createJob('boom');

      redisLock.withLock.mockRejectedValue(new Error('run failed'));

      await expect(runner.runJob(job)).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith(
        'Scheduled job failed: boom — run failed',
        expect.anything(),
      );
    });

    it('uses the job-declared lockTtlMs over the default', async () => {
      const runner: TaskSchedulerRunnerService = createRunner();
      const job: ScheduledJobInterface = { ...createJob('custom-ttl'), lockTtlMs: 5_000 };

      redisLock.withLock.mockResolvedValue(true);

      await runner.runJob(job);

      expect(redisLock.withLock).toHaveBeenCalledWith(
        'job:custom-ttl',
        5_000,
        expect.any(Function),
      );
    });
  });

  describe('onModuleInit', () => {
    it('registers a cron job per registered job when the scheduler is enabled', () => {
      const runner: TaskSchedulerRunnerService = createRunner(true);

      jobRegistry.register(createJob('enabled-demo'));

      runner.onModuleInit();

      expect(schedulerRegistry.doesExist('cron', 'enabled-demo')).toBe(true);

      schedulerRegistry.getCronJob('enabled-demo').stop();
    });

    it('registers nothing when the scheduler is disabled', () => {
      const runner: TaskSchedulerRunnerService = createRunner(false);

      jobRegistry.register(createJob('disabled-demo'));

      runner.onModuleInit();

      expect(schedulerRegistry.doesExist('cron', 'disabled-demo')).toBe(false);
    });
  });
});
