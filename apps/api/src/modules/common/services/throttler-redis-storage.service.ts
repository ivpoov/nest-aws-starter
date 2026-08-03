import { Inject, Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface.js';
import { REDIS_CLIENT } from '@providers/redis/constants/redis.constants.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';

// Minimal Redis-backed throttler storage: rate limits must hold across
// instances, so the counters live in Redis, not process memory.
@Injectable()
export class ThrottlerRedisStorageService implements ThrottlerStorage {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClientType) {}

  public async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const redisKey: string = `throttle:${throttlerName}:${key}`;
    const totalHits: number = await this.redis.incr(redisKey);

    if (totalHits === 1) await this.redis.pexpire(redisKey, ttl);

    let timeToExpireMs: number = await this.redis.pttl(redisKey);

    if (timeToExpireMs < 0) {
      await this.redis.pexpire(redisKey, ttl);
      timeToExpireMs = ttl;
    }

    const isBlocked: boolean = totalHits > limit;

    if (isBlocked && blockDuration > timeToExpireMs) {
      await this.redis.pexpire(redisKey, blockDuration);
      timeToExpireMs = blockDuration;
    }

    return {
      totalHits,
      timeToExpire: Math.ceil(timeToExpireMs / 1000),
      isBlocked,
      timeToBlockExpire: isBlocked ? Math.ceil(timeToExpireMs / 1000) : 0,
    };
  }
}
