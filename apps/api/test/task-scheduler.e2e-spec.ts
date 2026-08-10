import { randomUUID } from 'node:crypto';
import type { ScheduledJobInterface } from '@modules/task-scheduler/interfaces/scheduled-job.interface.js';
import { ScheduledJobRegistryService } from '@modules/task-scheduler/services/scheduled-job-registry.service.js';
import { TaskSchedulerRunnerService } from '@modules/task-scheduler/services/task-scheduler-runner.service.js';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { SchedulerRegistry } from '@nestjs/schedule';
import { REDIS_CLIENT } from '@providers/redis/constants/redis.constants.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Two real Nest apps against one Redis. Cron
// wall-time is never awaited: the job is registered post-boot on both
// instances and its lock-guarded run is triggered directly (the same path
// SchedulerRegistry's onTick would call), so the outcome is deterministic
// instead of racing a fast cron interval against test timeouts.
describe('task scheduler (2 instances, 1 redis)', () => {
  let appA: NestFastifyApplication;
  let appB: NestFastifyApplication;
  let redis: RedisClientType;

  beforeAll(async () => {
    appA = await createTestApp();
    appB = await createTestApp();
    redis = appA.get<RedisClientType>(REDIS_CLIENT);
  });

  afterAll(async () => {
    await appA.close();
    await appB.close();
  });

  // The e2e harness pins SCHEDULER_ENABLED=false (vitest.e2e.config.ts), so
  // this suite always runs with the gate closed. No production module
  // registers a real job at boot yet either, so this assertion only shows
  // the registry starts empty — it does NOT exercise the gate itself (both
  // enabled and disabled are covered by TaskSchedulerRunnerService's
  // onModuleInit unit test). Once a real job is wired at boot, this becomes
  // a genuine "gate suppresses scheduling" check.
  it('starts with no cron jobs registered (no production job wired yet)', () => {
    const schedulerRegistry: SchedulerRegistry = appA.get(SchedulerRegistry);

    expect(schedulerRegistry.getCronJobs().size).toBe(0);
  });

  it('a job registered on both instances runs exactly once when they race for the same lock', async () => {
    const jobName: string = `noop-${randomUUID()}`;
    const counterKey: string = `task-scheduler-e2e:${jobName}`;
    const job: ScheduledJobInterface = {
      name: jobName,
      cronExpression: '* * * * *',
      // The assertion only means anything if both instances' acquire
      // attempts overlap in wall-clock time. Without a deliberate hold,
      // instance A can acquire → increment → release before instance B's
      // acquire request even reaches Redis (likely under slow CI network
      // round-trips), so B legitimately re-acquires the freed lock and also
      // runs — the counter hits 2 with no lock malfunction, and the test
      // proves nothing. Holding the lock for 750ms — far longer than any
      // realistic Redis RTT — guarantees the two acquire attempts race
      // against each other instead of running in sequence.
      run: async (): Promise<void> => {
        await redis.incr(counterKey);
        await sleep(750);
      },
    };

    // Mirrors two processes booting with the same job wiring registered.
    appA.get(ScheduledJobRegistryService).register(job);
    appB.get(ScheduledJobRegistryService).register(job);

    const runnerA: TaskSchedulerRunnerService = appA.get(TaskSchedulerRunnerService);
    const runnerB: TaskSchedulerRunnerService = appB.get(TaskSchedulerRunnerService);

    await Promise.all([runnerA.runJob(job), runnerB.runJob(job)]);

    const executions: string | null = await redis.get(counterKey);

    expect(executions).toBe('1');

    await redis.del(counterKey);
  });
});
