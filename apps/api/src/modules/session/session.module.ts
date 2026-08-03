import { SESSION_REPOSITORY } from '@modules/session/constants/session.constants.js';
import { SessionController } from '@modules/session/controllers/session.controller.js';
import { SessionPrismaRepository } from '@modules/session/repositories/session-prisma.repository.js';
import { SessionService } from '@modules/session/services/session.service.js';
import { UserModule } from '@modules/user/user.module.js';
import { Module } from '@nestjs/common';

@Module({
  imports: [UserModule],
  controllers: [SessionController],
  providers: [SessionService, { provide: SESSION_REPOSITORY, useClass: SessionPrismaRepository }],
  exports: [SessionService],
})
export class SessionModule {}
