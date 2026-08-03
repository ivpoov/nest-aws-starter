import type { TokenRepositoryInterface } from '@modules/token/interfaces/token-repository.interface.js';
import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT } from '@providers/redis/constants/redis.constants.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';
import { Cluster, type Redis } from 'ioredis';

// The Redis allowlist IS the source of token truth: a token exists iff its key
// exists; revocation is key deletion and applies to access tokens instantly.
@Injectable()
export class TokenRedisRepository implements TokenRepositoryInterface {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClientType) {}

  public async setAccessToken(
    userId: string,
    sessionId: string,
    token: string,
    ttlSec: number,
  ): Promise<void> {
    await this.redis.set(this.accessKey(userId, sessionId), token, 'EX', ttlSec);
  }

  public async setRefreshToken(
    userId: string,
    sessionId: string,
    token: string,
    ttlSec: number,
  ): Promise<void> {
    await this.redis.set(this.refreshKey(userId, sessionId), token, 'EX', ttlSec);
  }

  public async setPreviousRefreshToken(
    userId: string,
    sessionId: string,
    token: string,
    ttlSec: number,
  ): Promise<void> {
    await this.redis.set(this.previousRefreshKey(userId, sessionId), token, 'EX', ttlSec);
  }

  public getAccessToken(userId: string, sessionId: string): Promise<string | null> {
    return this.redis.get(this.accessKey(userId, sessionId));
  }

  public getRefreshToken(userId: string, sessionId: string): Promise<string | null> {
    return this.redis.get(this.refreshKey(userId, sessionId));
  }

  public getPreviousRefreshToken(userId: string, sessionId: string): Promise<string | null> {
    return this.redis.get(this.previousRefreshKey(userId, sessionId));
  }

  public async deleteAllForSession(userId: string, sessionId: string): Promise<void> {
    await this.redis.del(
      this.accessKey(userId, sessionId),
      this.refreshKey(userId, sessionId),
      this.previousRefreshKey(userId, sessionId),
    );
  }

  public async deleteAllForUser(userId: string): Promise<void> {
    if (this.redis instanceof Cluster) {
      const masters: Redis[] = this.redis.nodes('master');

      await Promise.all(
        masters.map((node: Redis): Promise<void> => this.deleteByPatternOnNode(node, userId)),
      );

      return;
    }

    await this.deleteByPatternOnNode(this.redis, userId);
  }

  private async deleteByPatternOnNode(node: Redis, userId: string): Promise<void> {
    let cursor: string = '0';

    do {
      const [nextCursor, keys]: [string, string[]] = await node.scan(
        cursor,
        'MATCH',
        `users:${userId}:sessions:*`,
        'COUNT',
        100,
      );

      // One by one: multi-key DEL is CROSSSLOT in cluster mode.
      await Promise.all(keys.map((key: string): Promise<number> => node.del(key)));
      cursor = nextCursor;
    } while (cursor !== '0');
  }

  private accessKey(userId: string, sessionId: string): string {
    return `users:${userId}:sessions:${sessionId}:access`;
  }

  private refreshKey(userId: string, sessionId: string): string {
    return `users:${userId}:sessions:${sessionId}:refresh`;
  }

  private previousRefreshKey(userId: string, sessionId: string): string {
    return `users:${userId}:sessions:${sessionId}:refresh:prev`;
  }
}
