import { SESSION_REPOSITORY } from '@modules/session/constants/session.constants.js';
import { SessionController } from '@modules/session/controllers/session.controller.js';
import { SessionRetentionJob } from '@modules/session/jobs/session-retention.job.js';
import { SessionPrismaRepository } from '@modules/session/repositories/session-prisma.repository.js';
import { SessionService } from '@modules/session/services/session.service.js';
import { ScheduledJobRegistryService } from '@modules/task-scheduler/services/scheduled-job-registry.service.js';
import { UserModule } from '@modules/user/user.module.js';
import { forwardRef, Module, type Provider } from '@nestjs/common';

// Same self-registration idiom as the other scheduled jobs — TaskSchedulerModule
// is @Global(), so the registry is already resolvable here.
const retentionJobRegistrationProvider: Provider = {
  provide: Symbol('SESSION_RETENTION_JOB_REGISTRATION'),
  inject: [ScheduledJobRegistryService, SessionService],
  useFactory: (registry: ScheduledJobRegistryService, service: SessionService): boolean => {
    registry.register(new SessionRetentionJob(service));

    return true;
  },
};

@Module({
  imports: [forwardRef(() => UserModule)],
  controllers: [SessionController],
  providers: [
    retentionJobRegistrationProvider,
    SessionService,
    { provide: SESSION_REPOSITORY, useClass: SessionPrismaRepository },
  ],
  exports: [SessionService],
})
export class SessionModule {}
