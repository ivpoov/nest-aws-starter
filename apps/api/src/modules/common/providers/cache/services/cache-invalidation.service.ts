import { randomUUID } from 'node:crypto';
import { type RedisConfig, redisConfig } from '@configs/redis.config.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { CACHE_INVALIDATION_CHANNEL } from '@providers/cache/constants/cache.constants.js';
import type { CacheInvalidationMessageInterface } from '@providers/cache/interfaces/cache-invalidation-message.interface.js';
import type { MemoryCacheStore } from '@providers/cache/services/memory-cache-store.service.js';
import { REDIS_CLIENT } from '@providers/redis/constants/redis.constants.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';
import { Cluster, Redis } from 'ioredis';

@Injectable()
export class CacheInvalidationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new CustomLoggerService(CacheInvalidationService.name);
  private readonly senderId: string = randomUUID();
  private readonly memoryStores: MemoryCacheStore[] = [];
  private subscriber: RedisClientType | null = null;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: RedisClientType,
    @Inject(redisConfig.KEY) private readonly config: RedisConfig,
  ) {}

  public async onModuleInit(): Promise<void> {
    // Subscribing puts a connection into subscriber mode, so the shared client cannot be used.
    this.subscriber = this.config.isCluster
      ? new Cluster([this.config.url], { lazyConnect: true })
      : new Redis(this.config.url, { lazyConnect: true });

    this.subscriber.on('message', (_channel: string, message: string): void => {
      void this.handleMessage(message);
    });

    await this.subscriber.subscribe(CACHE_INVALIDATION_CHANNEL);
  }

  public async onModuleDestroy(): Promise<void> {
    if (this.subscriber) await this.subscriber.quit();
  }

  public registerMemoryStore(store: MemoryCacheStore): void {
    this.memoryStores.push(store);
  }

  public async publishDelete(key: string): Promise<void> {
    await this.publish({ op: 'delete', target: key, senderId: this.senderId });
  }

  public async publishDeleteByPrefix(prefix: string): Promise<void> {
    await this.publish({ op: 'deleteByPrefix', target: prefix, senderId: this.senderId });
  }

  public async handleMessage(rawMessage: string): Promise<void> {
    try {
      const message: CacheInvalidationMessageInterface = JSON.parse(rawMessage);

      if (message.senderId === this.senderId) return;

      await Promise.all(
        this.memoryStores.map((store: MemoryCacheStore): Promise<void> => {
          return message.op === 'delete'
            ? store.delete(message.target)
            : store.deleteByPrefix(message.target);
        }),
      );
    } catch (caught) {
      this.logger.warn(`Failed to apply cache invalidation: ${String(caught)}`);
    }
  }

  private async publish(message: CacheInvalidationMessageInterface): Promise<void> {
    await this.redis.publish(CACHE_INVALIDATION_CHANNEL, JSON.stringify(message));
  }
}
