import {
  ONLINE_USERS_REPOSITORY,
  TOKEN_REPOSITORY,
} from '@modules/token/constants/token.constants.js';
import { OnlineUsersRedisRepository } from '@modules/token/repositories/online-users-redis.repository.js';
import { TokenRedisRepository } from '@modules/token/repositories/token-redis.repository.js';
import { OnlineUsersService } from '@modules/token/services/online-users.service.js';
import { TokenService } from '@modules/token/services/token.service.js';
import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  providers: [
    TokenService,
    OnlineUsersService,
    { provide: TOKEN_REPOSITORY, useClass: TokenRedisRepository },
    { provide: ONLINE_USERS_REPOSITORY, useClass: OnlineUsersRedisRepository },
  ],
  exports: [TokenService, TOKEN_REPOSITORY, OnlineUsersService],
})
export class TokenModule {}
