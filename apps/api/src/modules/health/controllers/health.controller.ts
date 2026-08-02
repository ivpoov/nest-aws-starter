import type { HealthStatusInterface } from '@modules/health/interfaces/health-status.interface.js';
import type { LivenessStatusInterface } from '@modules/health/interfaces/liveness-status.interface.js';
import { HealthService } from '@modules/health/services/health.service.js';
import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { StatusCodes } from 'http-status-codes';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  public checkLiveness(): LivenessStatusInterface {
    return { status: 'ok' };
  }

  @Get('ready')
  public async checkReadiness(
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<HealthStatusInterface> {
    const health: HealthStatusInterface = await this.healthService.checkReadiness();

    if (health.status === 'degraded') {
      reply.status(StatusCodes.SERVICE_UNAVAILABLE);
    }

    return health;
  }
}
