import type { OneTimeTokenKindEnum } from '@modules/auth/enums/one-time-token-kind.enum.js';
import type { OneTimeTokenRepositoryInterface } from '@modules/auth/interfaces/one-time-token-repository.interface.js';
import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT } from '@providers/redis/constants/redis.constants.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';

// One-time tokens are Redis keys with native TTLs — no table, no cleanup job.
// GETDEL makes consumption atomic: a token can never be used twice.
@Injectable()
export class OneTimeTokenRedisRepository implements OneTimeTokenRepositoryInterface {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClientType) {}

  public async setToken(
    userId: string,
    kind: OneTimeTokenKindEnum,
    token: string,
    ttlSec: number,
  ): Promise<void> {
    await this.redis.set(this.key(userId, kind), token, 'EX', ttlSec);
  }

  public consumeToken(userId: string, kind: OneTimeTokenKindEnum): Promise<string | null> {
    return this.redis.getdel(this.key(userId, kind));
  }

  private key(userId: string, kind: OneTimeTokenKindEnum): string {
    return `users:${userId}:${kind}`;
  }
}
