import { AuthController } from '@modules/auth/controllers/auth.controller.js';
import { AuthService } from '@modules/auth/services/auth.service.js';
import { SessionModule } from '@modules/session/session.module.js';
import { UserModule } from '@modules/user/user.module.js';
import { Module } from '@nestjs/common';

@Module({
  imports: [UserModule, SessionModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
