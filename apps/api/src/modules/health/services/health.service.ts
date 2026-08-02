import type { HealthStatusInterface } from '@modules/health/interfaces/health-status.interface.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT } from '@providers/redis/constants/redis.constants.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';

@Injectable()
export class HealthService {
  private readonly logger = new CustomLoggerService(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClientType,
  ) {}

  public async checkReadiness(): Promise<HealthStatusInterface> {
    const database: boolean = await this.checkDatabase();
    const redis: boolean = await this.checkRedis();

    return {
      status: database && redis ? 'ok' : 'degraded',
      database,
      redis,
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return true;
    } catch (caught) {
      this.logger.warn(`Database readiness check failed: ${String(caught)}`);

      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      await this.redis.ping();

      return true;
    } catch (caught) {
      this.logger.warn(`Redis readiness check failed: ${String(caught)}`);

      return false;
    }
  }
}
