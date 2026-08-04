import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { REDIS_CLIENT } from '@providers/redis/constants/redis.constants.js';
import { redisProvider } from '@providers/redis/redis.provider.js';
import { RedisLockService } from '@providers/redis/services/redis-lock.service.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';

@Global()
@Module({
  providers: [redisProvider, RedisLockService],
  exports: [REDIS_CLIENT, RedisLockService],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClientType) {}

  public async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
