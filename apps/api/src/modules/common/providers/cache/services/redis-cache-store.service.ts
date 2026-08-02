import type { CacheStoreInterface } from '@providers/cache/interfaces/cache-store.interface.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';
import { Cluster, type Redis } from 'ioredis';

export class RedisCacheStore implements CacheStoreInterface {
  constructor(private readonly redis: RedisClientType) {}

  public async get<T>(key: string): Promise<T | null> {
    const raw: string | null = await this.redis.get(key);

    return raw === null ? null : (JSON.parse(raw) as T);
  }

  public async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'PX', ttlMs);
  }

  public async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  public async deleteByPrefix(prefix: string): Promise<void> {
    if (this.redis instanceof Cluster) {
      const masters: Redis[] = this.redis.nodes('master');

      await Promise.all(
        masters.map((node: Redis): Promise<void> => this.deleteByPrefixOnNode(node, prefix)),
      );

      return;
    }

    await this.deleteByPrefixOnNode(this.redis, prefix);
  }

  private async deleteByPrefixOnNode(node: Redis, prefix: string): Promise<void> {
    let cursor: string = '0';

    do {
      const [nextCursor, keys]: [string, string[]] = await node.scan(
        cursor,
        'MATCH',
        `${prefix}*`,
        'COUNT',
        100,
      );

      // Keys are deleted one by one: multi-key DEL fails with CROSSSLOT in cluster mode.
      await Promise.all(keys.map((key: string): Promise<number> => node.del(key)));
      cursor = nextCursor;
    } while (cursor !== '0');
  }
}
