import type { OnlineUsersRepositoryInterface } from '@modules/token/interfaces/online-users-repository.interface.js';
import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT } from '@providers/redis/constants/redis.constants.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';

// Single sorted set, score = last-seen epoch ms. ZADD on touch, prune expired
// members then ZCARD on read — cheap, no DB, no per-user key sprawl.
const ONLINE_USERS_KEY = 'presence:online-users';

@Injectable()
export class OnlineUsersRedisRepository implements OnlineUsersRepositoryInterface {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClientType) {}

  public async touch(userId: string): Promise<void> {
    await this.redis.zadd(ONLINE_USERS_KEY, Date.now(), userId);
  }

  public async countActive(windowSec: number): Promise<number> {
    const cutoff: number = Date.now() - windowSec * 1000;

    await this.redis.zremrangebyscore(ONLINE_USERS_KEY, '-inf', cutoff);

    return this.redis.zcard(ONLINE_USERS_KEY);
  }
}
