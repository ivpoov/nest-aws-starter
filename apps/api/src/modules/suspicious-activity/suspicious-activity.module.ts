import { CaslModule } from '@modules/casl/casl.module.js';
import { SessionModule } from '@modules/session/session.module.js';
import { LOCKOUT_REPOSITORY } from '@modules/suspicious-activity/constants/suspicious-activity.constants.js';
import { SuspiciousActivityAdminController } from '@modules/suspicious-activity/controllers/suspicious-activity-admin.controller.js';
import { SuspiciousActivityListener } from '@modules/suspicious-activity/listeners/suspicious-activity.listener.js';
import { suspiciousActivityPermissions } from '@modules/suspicious-activity/permissions/suspicious-activity.permissions.js';
import { LockoutRedisRepository } from '@modules/suspicious-activity/repositories/lockout-redis.repository.js';
import { LoginLockoutService } from '@modules/suspicious-activity/services/login-lockout.service.js';
import { NewDeviceService } from '@modules/suspicious-activity/services/new-device.service.js';
import { UserModule } from '@modules/user/user.module.js';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    CaslModule.forFeature({ permissions: suspiciousActivityPermissions }),
    SessionModule,
    UserModule,
  ],
  controllers: [SuspiciousActivityAdminController],
  providers: [
    LoginLockoutService,
    NewDeviceService,
    SuspiciousActivityListener,
    { provide: LOCKOUT_REPOSITORY, useClass: LockoutRedisRepository },
  ],
  exports: [LoginLockoutService, NewDeviceService],
})
export class SuspiciousActivityModule {}
