import { ACTIVITY_REPOSITORY } from '@modules/activity/constants/activity.constants.js';
import { ActivityAdminController } from '@modules/activity/controllers/activity-admin.controller.js';
import { ActivityListener } from '@modules/activity/listeners/activity.listener.js';
import { activityPermissions } from '@modules/activity/permissions/activity.permissions.js';
import { ActivityPrismaRepository } from '@modules/activity/repositories/activity-prisma.repository.js';
import { ActivityService } from '@modules/activity/services/activity.service.js';
import { CaslModule } from '@modules/casl/casl.module.js';
import { UserModule } from '@modules/user/user.module.js';
import { Module } from '@nestjs/common';

@Module({
  imports: [CaslModule.forFeature({ permissions: activityPermissions }), UserModule],
  controllers: [ActivityAdminController],
  providers: [
    ActivityService,
    ActivityListener,
    { provide: ACTIVITY_REPOSITORY, useClass: ActivityPrismaRepository },
  ],
  exports: [ActivityService],
})
export class ActivityModule {}
