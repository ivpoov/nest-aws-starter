import { ACTIVITY_REPOSITORY } from '@modules/activity/constants/activity.constants.js';
import { ActivityAdminController } from '@modules/activity/controllers/activity-admin.controller.js';
import { ActivityRetentionJob } from '@modules/activity/jobs/activity-retention.job.js';
import { ActivityListener } from '@modules/activity/listeners/activity.listener.js';
import { activityPermissions } from '@modules/activity/permissions/activity.permissions.js';
import { ActivityPrismaRepository } from '@modules/activity/repositories/activity-prisma.repository.js';
import { ActivityService } from '@modules/activity/services/activity.service.js';
import { CaslModule } from '@modules/casl/casl.module.js';
import { ScheduledJobRegistryService } from '@modules/task-scheduler/services/scheduled-job-registry.service.js';
import { UserModule } from '@modules/user/user.module.js';
import { Module, type Provider } from '@nestjs/common';

// Same self-registration idiom as the other scheduled jobs — TaskSchedulerModule
// is @Global(), so the registry is already resolvable here.
const retentionJobRegistrationProvider: Provider = {
  provide: Symbol('ACTIVITY_RETENTION_JOB_REGISTRATION'),
  inject: [ScheduledJobRegistryService, ActivityService],
  useFactory: (registry: ScheduledJobRegistryService, service: ActivityService): boolean => {
    registry.register(new ActivityRetentionJob(service));

    return true;
  },
};

@Module({
  imports: [CaslModule.forFeature({ permissions: activityPermissions }), UserModule],
  controllers: [ActivityAdminController],
  providers: [
    retentionJobRegistrationProvider,
    ActivityService,
    ActivityListener,
    { provide: ACTIVITY_REPOSITORY, useClass: ActivityPrismaRepository },
  ],
  exports: [ActivityService],
})
export class ActivityModule {}
