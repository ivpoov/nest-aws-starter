import { ONE_TIME_TOKEN_REPOSITORY } from '@modules/auth/constants/auth.constants.js';
import { AuthController } from '@modules/auth/controllers/auth.controller.js';
import { OneTimeTokenRedisRepository } from '@modules/auth/repositories/one-time-token-redis.repository.js';
import { AuthService } from '@modules/auth/services/auth.service.js';
import { EmailFlowService } from '@modules/auth/services/email-flow.service.js';
import { SessionModule } from '@modules/session/session.module.js';
import { UserModule } from '@modules/user/user.module.js';
import { Module } from '@nestjs/common';

@Module({
  imports: [UserModule, SessionModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    EmailFlowService,
    { provide: ONE_TIME_TOKEN_REPOSITORY, useClass: OneTimeTokenRedisRepository },
  ],
  exports: [AuthService],
})
export class AuthModule {}
