import { USER_REPOSITORY } from '@modules/user/constants/user.constants.js';
import { UserPrismaRepository } from '@modules/user/repositories/user-prisma.repository.js';
import { UserService } from '@modules/user/services/user.service.js';
import { Module } from '@nestjs/common';

@Module({
  providers: [UserService, { provide: USER_REPOSITORY, useClass: UserPrismaRepository }],
  exports: [UserService],
})
export class UserModule {}
