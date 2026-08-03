import type { OauthExchangePayloadInterface } from '@modules/oauth/interfaces/oauth-exchange-payload.interface.js';
import type { OauthStatePayloadInterface } from '@modules/oauth/interfaces/oauth-state-payload.interface.js';
import type { OauthStoreRepositoryInterface } from '@modules/oauth/interfaces/oauth-store-repository.interface.js';
import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT } from '@providers/redis/constants/redis.constants.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';

// State and exchange codes are single-use by construction: GETDEL consumes.
@Injectable()
export class OauthStoreRedisRepository implements OauthStoreRepositoryInterface {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClientType) {}

  public async setState(
    state: string,
    payload: OauthStatePayloadInterface,
    ttlSec: number,
  ): Promise<void> {
    await this.redis.set(`oauth:state:${state}`, JSON.stringify(payload), 'EX', ttlSec);
  }

  public async consumeState(state: string): Promise<OauthStatePayloadInterface | null> {
    const raw: string | null = await this.redis.getdel(`oauth:state:${state}`);

    return raw === null ? null : (JSON.parse(raw) as OauthStatePayloadInterface);
  }

  public async setExchange(
    code: string,
    payload: OauthExchangePayloadInterface,
    ttlSec: number,
  ): Promise<void> {
    await this.redis.set(`oauth:exchange:${code}`, JSON.stringify(payload), 'EX', ttlSec);
  }

  public async consumeExchange(code: string): Promise<OauthExchangePayloadInterface | null> {
    const raw: string | null = await this.redis.getdel(`oauth:exchange:${code}`);

    return raw === null ? null : (JSON.parse(raw) as OauthExchangePayloadInterface);
  }
}
