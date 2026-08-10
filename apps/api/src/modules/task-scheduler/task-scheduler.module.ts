import { ScheduledJobRegistryService } from '@modules/task-scheduler/services/scheduled-job-registry.service.js';
import { TaskSchedulerRunnerService } from '@modules/task-scheduler/services/task-scheduler-runner.service.js';
import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

// Global so future job modules can inject ScheduledJobRegistryService and
// self-register with a single import line in AppModule — the same shape as
// OauthModule for its provider modules. No jobs are wired here; this module
// ships the contract, the registry, and the lock-guarded runner only.
@Global()
@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [ScheduledJobRegistryService, TaskSchedulerRunnerService],
  exports: [ScheduledJobRegistryService],
})
export class TaskSchedulerModule {}
