import { CaslModule } from '@modules/casl/casl.module.js';
import { SessionModule } from '@modules/session/session.module.js';
import { USER_REPOSITORY } from '@modules/user/constants/user.constants.js';
import { UserController } from '@modules/user/controllers/user.controller.js';
import { UserAdminController } from '@modules/user/controllers/user-admin.controller.js';
import { OauthAvatarListener } from '@modules/user/listeners/oauth-avatar.listener.js';
import { userPermissions } from '@modules/user/permissions/user.permissions.js';
import { UserPrismaRepository } from '@modules/user/repositories/user-prisma.repository.js';
import { ProfileService } from '@modules/user/services/profile.service.js';
import { UserService } from '@modules/user/services/user.service.js';
import { forwardRef, Module } from '@nestjs/common';

@Module({
  imports: [
    CaslModule.forFeature({ permissions: userPermissions }),
    forwardRef(() => SessionModule),
  ],
  controllers: [UserController, UserAdminController],
  providers: [
    UserService,
    ProfileService,
    OauthAvatarListener,
    { provide: USER_REPOSITORY, useClass: UserPrismaRepository },
  ],
  exports: [UserService],
})
export class UserModule {}
