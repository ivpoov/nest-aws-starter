import { LOCKOUT_REPOSITORY } from '@modules/account-security/constants/account-security.constants.js';
import { AccountSecurityAdminController } from '@modules/account-security/controllers/account-security-admin.controller.js';
import { AccountSecurityListener } from '@modules/account-security/listeners/account-security.listener.js';
import { accountSecurityPermissions } from '@modules/account-security/permissions/account-security.permissions.js';
import { LockoutRedisRepository } from '@modules/account-security/repositories/lockout-redis.repository.js';
import { LoginLockoutService } from '@modules/account-security/services/login-lockout.service.js';
import { NewDeviceService } from '@modules/account-security/services/new-device.service.js';
import { CaslModule } from '@modules/casl/casl.module.js';
import { SessionModule } from '@modules/session/session.module.js';
import { UserModule } from '@modules/user/user.module.js';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    CaslModule.forFeature({ permissions: accountSecurityPermissions }),
    SessionModule,
    UserModule,
  ],
  controllers: [AccountSecurityAdminController],
  providers: [
    LoginLockoutService,
    NewDeviceService,
    AccountSecurityListener,
    { provide: LOCKOUT_REPOSITORY, useClass: LockoutRedisRepository },
  ],
  exports: [LoginLockoutService, NewDeviceService],
})
export class AccountSecurityModule {}
