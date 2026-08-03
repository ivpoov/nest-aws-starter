import { TOKEN_REPOSITORY } from '@modules/token/constants/token.constants.js';
import { TokenRedisRepository } from '@modules/token/repositories/token-redis.repository.js';
import { TokenService } from '@modules/token/services/token.service.js';
import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  providers: [TokenService, { provide: TOKEN_REPOSITORY, useClass: TokenRedisRepository }],
  exports: [TokenService, TOKEN_REPOSITORY],
})
export class TokenModule {}
