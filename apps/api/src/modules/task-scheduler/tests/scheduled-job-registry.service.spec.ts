import type { ScheduledJobInterface } from '@modules/task-scheduler/interfaces/scheduled-job.interface.js';
import { ScheduledJobRegistryService } from '@modules/task-scheduler/services/scheduled-job-registry.service.js';
import { beforeEach, describe, expect, it } from 'vitest';

function createJob(name: string): ScheduledJobInterface {
  return {
    name,
    cronExpression: '* * * * *',
    run: async (): Promise<void> => {},
  };
}

describe('ScheduledJobRegistryService', () => {
  let registry: ScheduledJobRegistryService;

  beforeEach(() => {
    registry = new ScheduledJobRegistryService();
  });

  it('returns an empty list when nothing registered', () => {
    expect(registry.getAll()).toEqual([]);
  });

  it('returns every registered job', () => {
    const jobA: ScheduledJobInterface = createJob('job-a');
    const jobB: ScheduledJobInterface = createJob('job-b');

    registry.register(jobA);
    registry.register(jobB);

    expect(registry.getAll()).toEqual([jobA, jobB]);
  });

  it('registering the same name again replaces the previous job', () => {
    const first: ScheduledJobInterface = createJob('job-a');
    const second: ScheduledJobInterface = createJob('job-a');

    registry.register(first);
    registry.register(second);

    expect(registry.getAll()).toEqual([second]);
  });
});
