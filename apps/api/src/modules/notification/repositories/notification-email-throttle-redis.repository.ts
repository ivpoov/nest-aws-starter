import {
  NOTIFICATION_EMAIL_THROTTLE_KEY_PREFIX,
  NOTIFICATION_EMAIL_THROTTLE_WINDOW_SEC,
} from '@modules/notification/constants/notification-email-throttle.constants.js';
import type { NotificationEmailThrottleRepositoryInterface } from '@modules/notification/interfaces/notification-email-throttle-repository.interface.js';
import type { NotificationTypeEnum } from '@nest-aws-starter/shared';
import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT } from '@providers/redis/constants/redis.constants.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';

@Injectable()
export class NotificationEmailThrottleRedisRepository
  implements NotificationEmailThrottleRepositoryInterface
{
  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClientType) {}

  // SET NX EX: one atomic command claims the slot and starts the window —
  // the same pattern as LockoutRedisRepository.lock. Only the first claim
  // inside the window returns OK; the TTL is never pushed out by later
  // attempts.
  public async claim(userId: string, type: NotificationTypeEnum): Promise<boolean> {
    const result: string | null = await this.redis.set(
      this.key(userId, type),
      '1',
      'EX',
      NOTIFICATION_EMAIL_THROTTLE_WINDOW_SEC,
      'NX',
    );

    return result === 'OK';
  }

  private key(userId: string, type: NotificationTypeEnum): string {
    return `${NOTIFICATION_EMAIL_THROTTLE_KEY_PREFIX}:${userId}:${type}`;
  }
}
