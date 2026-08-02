import type { HealthStatusInterface } from '@modules/health/interfaces/health-status.interface.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  private readonly logger = new CustomLoggerService(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  public async checkReadiness(): Promise<HealthStatusInterface> {
    const database: boolean = await this.checkDatabase();

    return {
      status: database ? 'ok' : 'degraded',
      database,
      redis: false,
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
}
